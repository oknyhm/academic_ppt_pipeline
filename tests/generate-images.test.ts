import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  generateImages,
  GeneratedImageManifestSchema,
  ImagePromptFileSchema,
  inspectPng,
  planImages,
  registerCodexImage,
} from "../scripts/generate-images.js";

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
  return output;
}

function makePng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rowLength = width * 4 + 1;
  const pixels = Buffer.alloc(rowLength * height);
  for (let row = 0; row < height; row += 1) pixels[row * rowLength] = 0;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const TEST_PROMPT =
  "Academic abstract illustration, no text, no labels, no numbers, no formula, no watermark.";

async function writePromptFile(path: string, prompt = TEST_PROMPT): Promise<void> {
  await writeFile(
    path,
    `images:\n  - id: test-concept\n    purpose: conceptual\n    size: 1024x1024\n    alt: Abstract blue geometry.\n    prompt: ${prompt}\n`,
    "utf8",
  );
}

describe("optional AI image generation", () => {
  it("validates decorative prompts with all required negative constraints", async () => {
    const source = await readFile(resolve(process.cwd(), "content/image-prompts.yaml"), "utf8");
    const input = ImagePromptFileSchema.parse(parse(source));

    expect(input.images).toHaveLength(2);
    expect(input.images.map((image) => image.purpose)).toEqual(["cover", "conceptual"]);
    expect(input.images.every((image) => image.alt.length > 0)).toBe(true);
  });

  it("rejects a prompt without the required no-text constraint", () => {
    const result = ImagePromptFileSchema.safeParse({
      images: [
        {
          id: "invalid-image",
          purpose: "conceptual",
          alt: "Abstract neural network.",
          prompt: "Abstract neural network, no labels, no numbers, no formula, no watermark.",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("skips the API path safely without a key", async () => {
    const result = await generateImages({ apiKey: "" });
    expect(result).toEqual({
      generated: [],
      skipped: ["cover-neural-network-concept", "representation-learning-concept"],
      failed: [],
      reason: "missing-api-key",
    });
  });

  it("registers a Codex built-in result and reports it as current", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "ppt-image-register-"));
    const sourcePath = resolve(root, "image-prompts.yaml");
    const sourceFile = resolve(root, "codex-result.png");
    const outputDir = resolve(root, "assets");
    await writePromptFile(sourcePath);
    const png = makePng(1024, 1024);
    await writeFile(sourceFile, png);

    const first = await registerCodexImage({
      id: "test-concept",
      sourceFile,
      sourcePath,
      outputDir,
      recordedAt: new Date("2026-08-13T00:00:00.000Z"),
    });
    const manifest = GeneratedImageManifestSchema.parse(
      JSON.parse(await readFile(resolve(outputDir, "manifest.json"), "utf8")),
    );
    const metadata = manifest.images["test-concept"];
    expect(first.skipped).toBe(false);
    expect(metadata.executor).toBe("codex-built-in");
    expect(metadata.model).toBe("gpt-image-2");
    expect(metadata.actualWidth).toBe(1024);
    expect(metadata.actualHeight).toBe(1024);
    expect(metadata.assetSha256).toBe(createHash("sha256").update(png).digest("hex"));
    expect((await planImages({ sourcePath, outputDir })).entries[0]?.state).toBe("current");

    const second = await registerCodexImage({
      id: "test-concept",
      sourceFile,
      sourcePath,
      outputDir,
    });
    expect(second.skipped).toBe(true);

    metadata.model = null;
    await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest)}\n`);
    expect((await planImages({ sourcePath, outputDir })).entries[0]?.state).toBe("stale");
  });

  it("detects stale prompts and rejects invalid PNG input", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "ppt-image-stale-"));
    const sourcePath = resolve(root, "image-prompts.yaml");
    const sourceFile = resolve(root, "codex-result.png");
    const outputDir = resolve(root, "assets");
    await writePromptFile(sourcePath);
    await writeFile(sourceFile, makePng(1024, 1024));
    await registerCodexImage({ id: "test-concept", sourceFile, sourcePath, outputDir });

    await writePromptFile(sourcePath, `${TEST_PROMPT} Subtle layered planes.`);
    expect((await planImages({ sourcePath, outputDir })).entries[0]?.state).toBe("stale");

    const invalid = Buffer.from("not a png");
    expect(() => inspectPng(invalid)).toThrow(/not a PNG/i);
  });
});
