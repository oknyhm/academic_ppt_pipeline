import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import JSZip from "jszip";
import { afterEach, expect, it } from "vitest";
import { generatePresentation, loadDeck } from "../src/generate-ppt.js";

let temporaryDirectory: string | undefined;

afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = undefined;
});

it("writes Office SVG blips with high-resolution PNG fallbacks", async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "pptx-svg-fallback-"));
  const outputPath = join(temporaryDirectory, "sample.pptx");
  const deck = await loadDeck(resolve(process.cwd(), "content/deck.yaml"));

  await generatePresentation(deck, resolve(process.cwd(), "content"), outputPath);

  const archive = await JSZip.loadAsync(await readFile(outputPath));
  const pngMedia = Object.values(archive.files).filter(
    (entry) => !entry.dir && entry.name.startsWith("ppt/media/") && entry.name.endsWith(".png"),
  );
  expect(pngMedia.length).toBeGreaterThan(0);
  for (const entry of pngMedia) {
    const media = await entry.async("nodebuffer");
    expect(media.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(media.readUInt32BE(16)).toBeGreaterThanOrEqual(3_000);
  }
  const formulaSlideXml = await archive.file("ppt/slides/slide3.xml")?.async("string");
  const formulaRelations = await archive.file("ppt/slides/_rels/slide3.xml.rels")?.async("string");
  expect(formulaSlideXml).toContain('<a:blip r:embed="rId1">');
  expect(formulaSlideXml).toContain("<asvg:svgBlip");
  expect(formulaSlideXml).toContain('r:embed="rId2"');
  expect(formulaRelations).toContain('Target="../media/image-3-1.png"');
  expect(formulaRelations).toContain('Target="../media/image-3-2.svg"');
  const slideXml = Object.values(archive.files).filter(
    (entry) => !entry.dir && /^ppt\/slides\/slide\d+\.xml$/.test(entry.name),
  );
  for (const entry of slideXml) {
    const xml = await entry.async("string");
    expect(xml).not.toMatch(/<a:ext cx="-\d+"|<a:ext cx="\d+" cy="-\d+"/);
  }
});
