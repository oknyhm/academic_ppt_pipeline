import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import JSZip from "jszip";
import { parse } from "yaml";
import { addFooter } from "./components/footer.js";
import { renderLayout } from "./layouts/registry.js";
import type { PptxPresentationConstructor } from "./pptx.js";
import { SLIDE_HEIGHT, SLIDE_WIDTH, THEME } from "./theme.js";
import { DeckSchema, type AssetRef, type Deck } from "./types.js";
import type { ImageSize } from "./utils/image-fit.js";
import { assertElementsWithinBounds, assertNoUnexpectedOverlap } from "./utils/bounds.js";
import { getSlideWarnings, type ValidationWarning } from "./validation.js";

const DEFAULT_DECK_PATH = "content/deck.yaml";
const DEFAULT_OUTPUT_PATH = "output/generated/sample.pptx";
const SVG_FALLBACK_WIDTH = 3_000;
const require = createRequire(import.meta.url);
const PptxPresentation = require("pptxgenjs") as PptxPresentationConstructor;

function isSvgMedia(buffer: Buffer): boolean {
  return buffer.toString("utf8", 0, Math.min(buffer.length, 256)).includes("<svg");
}

export async function repairSvgFallbacks(pptxPath: string): Promise<number> {
  const archive = await JSZip.loadAsync(await readFile(pptxPath));
  let repaired = 0;
  for (const entry of Object.values(archive.files)) {
    if (entry.dir || !entry.name.startsWith("ppt/media/") || !entry.name.endsWith(".png")) continue;
    const media = await entry.async("nodebuffer");
    if (!isSvgMedia(media)) continue;
    let png: Buffer;
    try {
      png = new Resvg(media, {
        background: "rgba(0,0,0,0)",
        fitTo: { mode: "width", value: SVG_FALLBACK_WIDTH },
      })
        .render()
        .asPng();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Unable to create a PNG fallback for ${entry.name}: ${message}`);
    }
    archive.file(entry.name, png);
    repaired += 1;
  }
  if (repaired > 0) {
    await writeFile(
      pptxPath,
      await archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
    );
  }
  return repaired;
}

function imageSizeFromPng(buffer: Buffer): ImageSize | undefined {
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || buffer.length < 24)
    return undefined;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function imageSizeFromJpeg(buffer: Buffer): ImageSize | undefined {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
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

function imageSizeFromSvg(buffer: Buffer): ImageSize | undefined {
  const source = buffer.toString("utf8");
  const viewBox = source.match(
    /viewBox=["']\s*\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i,
  );
  if (viewBox) return { width: Number(viewBox[1]), height: Number(viewBox[2]) };
  const width = source.match(/\bwidth=["'](\d+(?:\.\d+)?)/i);
  const height = source.match(/\bheight=["'](\d+(?:\.\d+)?)/i);
  return width && height ? { width: Number(width[1]), height: Number(height[1]) } : undefined;
}

export async function getImageSize(imagePath: string): Promise<ImageSize> {
  const buffer = await readFile(imagePath);
  const size = imageSizeFromPng(buffer) ?? imageSizeFromJpeg(buffer) ?? imageSizeFromSvg(buffer);
  if (!size || size.width <= 0 || size.height <= 0)
    throw new Error(
      `Unsupported or invalid image file: ${imagePath}. Only PNG, JPEG, and SVG are supported.`,
    );
  return size;
}

async function resolveAsset(
  slideId: string,
  asset: AssetRef,
  deckDirectory: string,
  assetKind: "chart" | "image",
): Promise<{ path: string; size: ImageSize }> {
  const imagePath = resolve(deckDirectory, asset.path);
  try {
    await access(imagePath, constants.R_OK);
  } catch {
    throw new Error(`Missing ${assetKind} asset for slide "${slideId}": ${imagePath}`);
  }
  return { path: imagePath, size: await getImageSize(imagePath) };
}

export async function loadDeck(deckPath: string): Promise<Deck> {
  return DeckSchema.parse(parse(await readFile(deckPath, "utf8")));
}

export async function generatePresentation(
  deck: Deck,
  deckDirectory: string,
  outputPath: string,
): Promise<string> {
  const images = new Map<string, { path: string; size: ImageSize }>();
  const charts = new Map<string, { path: string; size: ImageSize }>();
  const warnings: ValidationWarning[] = [];
  for (const content of deck.slides)
    if (content.layout === "text-image-slide")
      images.set(content.id, await resolveAsset(content.id, content.image, deckDirectory, "image"));
    else if (content.layout === "results-slide" && content.chart)
      charts.set(content.id, await resolveAsset(content.id, content.chart, deckDirectory, "chart"));

  const pptx = new PptxPresentation();
  pptx.defineLayout({ name: "ACADEMIC_WIDE", width: SLIDE_WIDTH, height: SLIDE_HEIGHT });
  pptx.layout = "ACADEMIC_WIDE";
  pptx.author = "Structured Academic PPT Pipeline";
  pptx.subject = deck.meta.title;
  pptx.title = deck.meta.title;
  pptx.theme = { headFontFace: THEME.fonts.chinese, bodyFontFace: THEME.fonts.chinese };
  for (const [index, content] of deck.slides.entries()) {
    const slide = pptx.addSlide();
    const boxes = [
      ...renderLayout(slide, content, { images, charts }),
      ...addFooter(slide, deck.meta.title, index + 1),
    ];
    try {
      assertElementsWithinBounds(boxes);
      assertNoUnexpectedOverlap(boxes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Layout validation failed for slide "${content.id}": ${message}`);
    }
    warnings.push(...getSlideWarnings(content));
  }
  const absoluteOutputPath = resolve(outputPath);
  await mkdir(resolve(absoluteOutputPath, ".."), { recursive: true });
  await pptx.writeFile({ fileName: absoluteOutputPath, compression: true });
  const repairedFallbacks = await repairSvgFallbacks(absoluteOutputPath);
  if (repairedFallbacks > 0)
    console.log(`Repaired ${repairedFallbacks} SVG PNG fallbacks for Office compatibility.`);
  const reportPath = resolve(dirname(dirname(absoluteOutputPath)), "validation-report.json");
  await writeFile(reportPath, `${JSON.stringify({ valid: true, warnings }, null, 2)}\n`, "utf8");
  for (const warning of warnings) console.warn(`Validation warning: ${warning.message}`);
  return absoluteOutputPath;
}

async function main(): Promise<void> {
  const [deckPath = DEFAULT_DECK_PATH, outputPath = DEFAULT_OUTPUT_PATH] = process.argv.slice(2);
  const absoluteDeckPath = resolve(process.cwd(), deckPath);
  const deck = await loadDeck(absoluteDeckPath);
  const generatedPath = await generatePresentation(
    deck,
    resolve(absoluteDeckPath, ".."),
    outputPath,
  );
  console.log(`Generated ${deck.slides.length} slides: ${generatedPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
