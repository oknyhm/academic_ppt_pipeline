import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import JSZip from "jszip";
import { parse } from "yaml";
import { addFooter } from "./components/footer.js";
import { renderLayout } from "./layouts/registry.js";
import type { PptxPresentationConstructor } from "./pptx.js";
import { SLIDE_HEIGHT, SLIDE_WIDTH, THEME } from "./theme.js";
import { DeckSchema, type Deck } from "./types.js";
import { assertElementsWithinBounds, assertNoUnexpectedOverlap } from "./utils/bounds.js";
import { validateDeck, validateDeckFile } from "./validators/index.js";

const DEFAULT_DECK_PATH = "content/deck.yaml";
const DEFAULT_OUTPUT_PATH = "output/generated/sample.pptx";
const SVG_FALLBACK_WIDTH = 3_000;
const require = createRequire(import.meta.url);
const PptxPresentation = require("pptxgenjs") as PptxPresentationConstructor;

function isInsideDirectory(path: string, directory: string): boolean {
  const relativePath = relative(directory, path);
  return relativePath === "" || (!relativePath.startsWith("..") && !relativePath.includes(":"));
}

export function assertSafeCliOutputPath(outputPath: string): string {
  const absoluteOutputPath = resolve(process.cwd(), outputPath);
  const generatedDirectory = resolve(process.cwd(), "output/generated");
  const finalEditedPath = resolve(process.cwd(), "output/final-edited.pptx");
  if (
    absoluteOutputPath === finalEditedPath ||
    !isInsideDirectory(absoluteOutputPath, generatedDirectory)
  )
    throw new Error(
      `CLI output must stay under ${generatedDirectory}; output/final-edited.pptx is reserved for manual edits.`,
    );
  return absoluteOutputPath;
}

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

export async function loadDeck(deckPath: string): Promise<Deck> {
  return DeckSchema.parse(parse(await readFile(deckPath, "utf8")));
}

export async function generatePresentation(
  deck: Deck,
  deckDirectory: string,
  outputPath: string,
): Promise<string> {
  const validation = await validateDeck(deck, deckDirectory);
  if (!validation.report.valid) {
    throw new Error(validation.report.errors.map((issue) => issue.message).join("\n"));
  }
  const { images, charts, illustrations } = validation.context;

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
      ...renderLayout(slide, content, { images, charts, illustrations }),
      ...addFooter(slide, deck.meta.title, index + 1),
    ];
    try {
      assertElementsWithinBounds(boxes);
      assertNoUnexpectedOverlap(boxes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Layout validation failed for slide "${content.id}": ${message}`);
    }
  }
  const absoluteOutputPath = resolve(outputPath);
  await mkdir(resolve(absoluteOutputPath, ".."), { recursive: true });
  await pptx.writeFile({ fileName: absoluteOutputPath, compression: true });
  const repairedFallbacks = await repairSvgFallbacks(absoluteOutputPath);
  if (repairedFallbacks > 0)
    console.log(`Repaired ${repairedFallbacks} SVG PNG fallbacks for Office compatibility.`);
  for (const warning of validation.report.warnings)
    console.warn(`Validation warning: ${warning.message}`);
  return absoluteOutputPath;
}

async function main(): Promise<void> {
  const [deckPath = DEFAULT_DECK_PATH, outputPath = DEFAULT_OUTPUT_PATH] = process.argv.slice(2);
  const absoluteDeckPath = resolve(process.cwd(), deckPath);
  const safeOutputPath = assertSafeCliOutputPath(outputPath);
  const validation = await validateDeckFile(deckPath);
  if (!validation.deck || !validation.report.valid) {
    throw new Error(
      `Static validation failed with ${validation.report.summary.errors} error(s). See output/validation-report.json.`,
    );
  }
  const deck = validation.deck;
  const generatedPath = await generatePresentation(
    deck,
    resolve(absoluteDeckPath, ".."),
    safeOutputPath,
  );
  console.log(`Generated ${deck.slides.length} slides: ${generatedPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
