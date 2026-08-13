import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import {
  GeneratedImageManifestSchema,
  hashImagePrompt,
  ImagePromptFileSchema,
} from "../../scripts/generate-images.js";
import type { RenderContext } from "../layouts/registry.js";
import type { AssetRef, Deck } from "../types.js";
import type { ImageSize } from "../utils/image-fit.js";
import type { ValidationIssue } from "./types.js";

const SENTINEL_SIZE: ImageSize = { width: 1, height: 1 };

function pngSize(buffer: Buffer): ImageSize | undefined {
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
    return undefined;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegSize(buffer: Buffer): ImageSize | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return undefined;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > buffer.length) return undefined;
    if (marker >= 0xc0 && marker <= 0xc3)
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    offset += length + 2;
  }
  return undefined;
}

function svgSize(buffer: Buffer): ImageSize | undefined {
  const source = buffer.toString("utf8");
  if (!/<svg\b/i.test(source)) return undefined;
  const viewBox = source.match(
    /viewBox=["']\s*[-+]?\d+(?:\.\d+)?\s+[-+]?\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i,
  );
  if (viewBox) return { width: Number(viewBox[1]), height: Number(viewBox[2]) };
  const width = source.match(/\bwidth=["'](\d+(?:\.\d+)?)(?:px|pt|in|cm|mm)?["']/i);
  const height = source.match(/\bheight=["'](\d+(?:\.\d+)?)(?:px|pt|in|cm|mm)?["']/i);
  return width && height ? { width: Number(width[1]), height: Number(height[1]) } : undefined;
}

async function inspectAsset(path: string): Promise<ImageSize> {
  const buffer = await readFile(path);
  const size = pngSize(buffer) ?? jpegSize(buffer) ?? svgSize(buffer);
  if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height))
    throw new Error("Only valid PNG, JPEG, and SVG assets with readable dimensions are supported.");
  if (size.width <= 0 || size.height <= 0) throw new Error("Asset dimensions must be positive.");
  return size;
}

async function preflightIllustrations(
  deck: Deck,
  deckDirectory: string,
): Promise<{
  illustrations: Map<string, { path: string; size: ImageSize; alt: string }>;
  issues: ValidationIssue[];
}> {
  const illustrations = new Map<string, { path: string; size: ImageSize; alt: string }>();
  const issues: ValidationIssue[] = [];
  const requested = new Map<string, string>();
  for (const slide of deck.slides) {
    if (slide.layout === "title-slide" && slide.illustrationId)
      requested.set(slide.illustrationId, slide.id);
  }
  if (requested.size === 0) return { illustrations, issues };
  const projectRoot = resolve(deckDirectory, "..");
  const promptPath = resolve(projectRoot, "content/image-prompts.yaml");
  const manifestPath = resolve(projectRoot, "assets/generated/manifest.json");
  try {
    const prompts = ImagePromptFileSchema.parse(parse(await readFile(promptPath, "utf8")));
    const manifest = GeneratedImageManifestSchema.parse(
      JSON.parse(await readFile(manifestPath, "utf8")) as unknown,
    );
    for (const [id, slideId] of requested) {
      const prompt = prompts.images.find((image) => image.id === id);
      const metadata = manifest.images[id];
      if (!prompt || !metadata) {
        issues.push(optionalIllustrationIssue(slideId, id, "Prompt or manifest entry is absent."));
        continue;
      }
      const assetPath = resolve(projectRoot, metadata.output);
      try {
        const buffer = await readFile(assetPath);
        const size = await inspectAsset(assetPath);
        const actualHash = createHash("sha256").update(buffer).digest("hex");
        if (
          metadata.promptSha256 !== hashImagePrompt(prompt) ||
          metadata.assetSha256 !== actualHash ||
          metadata.actualWidth !== size.width ||
          metadata.actualHeight !== size.height
        ) {
          issues.push(optionalIllustrationIssue(slideId, id, "Manifest or asset hash is stale."));
          continue;
        }
        illustrations.set(id, { path: assetPath, size, alt: prompt.alt });
      } catch (error) {
        issues.push(
          optionalIllustrationIssue(
            slideId,
            id,
            error instanceof Error ? error.message : String(error),
          ),
        );
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    for (const [id, slideId] of requested)
      issues.push(optionalIllustrationIssue(slideId, id, reason));
  }
  return { illustrations, issues };
}

function optionalIllustrationIssue(
  slideId: string,
  illustrationId: string,
  reason: string,
): ValidationIssue {
  return {
    check: "assets",
    code: "optional-illustration-fallback",
    severity: "warning",
    slideId,
    path: illustrationId,
    message: `Optional illustration "${illustrationId}" is unavailable or stale; the native-shape fallback will be used. ${reason}`,
  };
}

async function registerAsset(
  registry: Map<string, { path: string; size: ImageSize }>,
  issues: ValidationIssue[],
  deckDirectory: string,
  slideId: string,
  asset: AssetRef,
  assetKind: "image" | "chart",
): Promise<void> {
  const absolutePath = resolve(deckDirectory, asset.path);
  try {
    registry.set(slideId, { path: absolutePath, size: await inspectAsset(absolutePath) });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const missing =
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT";
    issues.push({
      check: "assets",
      code: missing ? "missing-asset" : "invalid-asset",
      severity: "error",
      slideId,
      path: asset.path,
      message: missing
        ? `Missing ${assetKind} asset for slide "${slideId}": ${absolutePath}`
        : `Invalid ${assetKind} asset for slide "${slideId}": ${absolutePath}. ${reason}`,
    });
    registry.set(slideId, { path: absolutePath, size: SENTINEL_SIZE });
  }
}

export async function preflightAssets(
  deck: Deck,
  deckDirectory: string,
): Promise<{ context: RenderContext; issues: ValidationIssue[] }> {
  const images = new Map<string, { path: string; size: ImageSize }>();
  const charts = new Map<string, { path: string; size: ImageSize }>();
  const issues: ValidationIssue[] = [];
  await Promise.all(
    deck.slides.map(async (slide) => {
      if (slide.layout === "text-image-slide")
        await registerAsset(images, issues, deckDirectory, slide.id, slide.image, "image");
      else if (slide.layout === "results-slide" && slide.chart)
        await registerAsset(charts, issues, deckDirectory, slide.id, slide.chart, "chart");
    }),
  );
  const optionalIllustrations = await preflightIllustrations(deck, deckDirectory);
  issues.push(...optionalIllustrations.issues);
  return {
    context: { images, charts, illustrations: optionalIllustrations.illustrations },
    issues,
  };
}
