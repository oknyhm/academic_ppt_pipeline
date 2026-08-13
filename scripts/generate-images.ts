import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { z } from "zod";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_SOURCE_PATH = resolve(PROJECT_ROOT, "content/image-prompts.yaml");
const DEFAULT_OUTPUT_DIR = resolve(PROJECT_ROOT, "assets/generated");
const DEFAULT_PLAN_PATH = resolve(PROJECT_ROOT, "output/image-generation-plan.json");
const DEFAULT_MODEL = "gpt-image-2";
const DEFAULT_QUALITY = "low";
const REQUIRED_NEGATIVE_CONSTRAINTS = [
  "no text",
  "no labels",
  "no numbers",
  "no formula",
  "no watermark",
];
const PNG_SIGNATURE = "89504e470d0a1a0a";

export const ImagePromptSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Image id must be lowercase kebab-case."),
  purpose: z.enum(["cover", "conceptual"]),
  prompt: z.string().min(1),
  alt: z.string().min(1, "A human-authored alt description is required."),
  size: z.enum(["1536x1024", "1024x1536", "1024x1024"]).default("1536x1024"),
});

export const ImagePromptFileSchema = z
  .object({ images: z.array(ImagePromptSchema).min(1) })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    value.images.forEach((image, index) => {
      if (ids.has(image.id)) {
        context.addIssue({
          code: "custom",
          path: ["images", index, "id"],
          message: `Duplicate image id: ${image.id}`,
        });
      }
      ids.add(image.id);
      for (const constraint of REQUIRED_NEGATIVE_CONSTRAINTS) {
        if (!image.prompt.toLowerCase().includes(constraint)) {
          context.addIssue({
            code: "custom",
            path: ["images", index, "prompt"],
            message: `Image prompt must include "${constraint}".`,
          });
        }
      }
    });
  });

const GeneratedImageMetadataSchema = z.object({
  executor: z.enum(["codex-built-in", "openai-api"]),
  prompt: z.string().min(1),
  model: z.string().min(1).nullable(),
  size: ImagePromptSchema.shape.size,
  quality: z.string().min(1).nullable(),
  output: z.string().min(1),
  recordedAt: z.iso.datetime(),
  promptSha256: z.string().regex(/^[a-f0-9]{64}$/),
  requestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  assetSha256: z.string().regex(/^[a-f0-9]{64}$/),
  actualWidth: z.number().int().positive(),
  actualHeight: z.number().int().positive(),
});

export const GeneratedImageManifestSchema = z.object({
  version: z.literal(2),
  source: z.string().min(1),
  images: z.record(z.string(), GeneratedImageMetadataSchema),
});

export type ImagePrompt = z.infer<typeof ImagePromptSchema>;
export type GeneratedImageMetadata = z.infer<typeof GeneratedImageMetadataSchema>;
export type GeneratedImageManifest = z.infer<typeof GeneratedImageManifestSchema>;
export type ImagePlanState = "current" | "missing" | "stale" | "invalid";

interface ImageClient {
  images: {
    generate(options: {
      model: string;
      prompt: string;
      size: ImagePrompt["size"];
      quality: string;
      output_format: "png";
      n: 1;
    }): Promise<{ data: Array<{ b64_json?: string | null }> }>;
  };
}

export interface GenerateImagesOptions {
  sourcePath?: string;
  outputDir?: string;
  apiKey?: string;
  client?: ImageClient;
}

export interface GenerateImagesResult {
  generated: string[];
  skipped: string[];
  failed: string[];
  reason?: "missing-api-key";
}

export interface RegisterCodexImageOptions {
  id: string;
  sourceFile: string;
  sourcePath?: string;
  outputDir?: string;
  replace?: boolean;
  recordedAt?: Date;
}

export interface ImagePlanEntry {
  id: string;
  purpose: ImagePrompt["purpose"];
  state: ImagePlanState;
  output: string;
  reason: string;
}

export interface ImageGenerationPlan {
  version: 1;
  source: string;
  preferredExecutor: "codex-built-in";
  entries: ImagePlanEntry[];
}

function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashImagePrompt(image: ImagePrompt): string {
  return digest(
    JSON.stringify({
      id: image.id,
      purpose: image.purpose,
      prompt: image.prompt,
      size: image.size,
    }),
  );
}

function hashImageRequest(
  image: ImagePrompt,
  executor: GeneratedImageMetadata["executor"],
  model: string | null,
  quality: string | null,
): string {
  return digest(
    JSON.stringify({
      executor,
      promptSha256: hashImagePrompt(image),
      model,
      quality,
      size: image.size,
    }),
  );
}

function portableProjectPath(path: string): string {
  return relative(PROJECT_ROOT, path).replaceAll("\\", "/");
}

function assetOutput(id: string): string {
  return `assets/generated/${id}.png`;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function inspectPng(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 45 || buffer.subarray(0, 8).toString("hex") !== PNG_SIGNATURE)
    throw new Error("The selected file is not a PNG image.");
  let offset = 8;
  let width = 0;
  let height = 0;
  let foundIdat = false;
  let foundIend = false;
  let chunkIndex = 0;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) throw new Error("The PNG contains a truncated chunk.");
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const expectedCrc = buffer.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(buffer.subarray(offset + 4, offset + 8 + length));
    if (expectedCrc !== actualCrc)
      throw new Error(`The PNG ${type} chunk has an invalid checksum.`);
    if (chunkIndex === 0 && (type !== "IHDR" || length !== 13))
      throw new Error("The PNG does not start with a valid IHDR chunk.");
    if (type === "IHDR") {
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
    } else if (type === "IDAT") {
      foundIdat = true;
    } else if (type === "IEND") {
      foundIend = true;
      offset = end;
      break;
    }
    offset = end;
    chunkIndex += 1;
  }
  if (!foundIdat || !foundIend || offset !== buffer.length)
    throw new Error("The PNG is incomplete or contains trailing bytes.");
  if (width <= 0 || height <= 0) throw new Error("The PNG dimensions must be positive.");
  return { width, height };
}

function expectedDimensions(size: ImagePrompt["size"]): { width: number; height: number } {
  const [width, height] = size.split("x").map(Number);
  return { width, height };
}

function assertRequestedDimensions(
  image: ImagePrompt,
  actual: { width: number; height: number },
): void {
  const expected = expectedDimensions(image.size);
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(
      `Image "${image.id}" must be ${image.size}, but the selected PNG is ${actual.width}x${actual.height}.`,
    );
  }
}

async function loadPromptFile(sourcePath: string): Promise<z.infer<typeof ImagePromptFileSchema>> {
  return ImagePromptFileSchema.parse(parse(await readFile(sourcePath, "utf8")));
}

function emptyManifest(sourcePath: string): GeneratedImageManifest {
  return { version: 2, source: portableProjectPath(sourcePath), images: {} };
}

async function readManifest(
  manifestPath: string,
  sourcePath: string,
): Promise<GeneratedImageManifest> {
  if (!(await exists(manifestPath))) return emptyManifest(sourcePath);
  let value: unknown;
  try {
    value = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Unable to read image manifest ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const parsed = GeneratedImageManifestSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(`Invalid image manifest ${manifestPath}: ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

async function writeAtomic(path: string, data: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const token = `${process.pid}-${Date.now()}`;
  const temporaryPath = resolve(dirname(path), `.${basename(path)}.${token}.tmp`);
  const backupPath = resolve(dirname(path), `.${basename(path)}.${token}.bak`);
  await writeFile(temporaryPath, data);
  let backedUp = false;
  try {
    if (await exists(path)) {
      await rename(path, backupPath);
      backedUp = true;
    }
    await rename(temporaryPath, path);
    if (backedUp) await rm(backupPath, { force: true });
  } catch (error) {
    if (backedUp && !(await exists(path)) && (await exists(backupPath)))
      await rename(backupPath, path);
    throw error;
  } finally {
    await rm(temporaryPath, { force: true });
    await rm(backupPath, { force: true });
  }
}

async function writeManifest(path: string, manifest: GeneratedImageManifest): Promise<void> {
  await writeAtomic(
    path,
    `${JSON.stringify(GeneratedImageManifestSchema.parse(manifest), null, 2)}\n`,
  );
}

async function inspectPlanEntry(
  image: ImagePrompt,
  metadata: GeneratedImageMetadata | undefined,
  outputPath: string,
): Promise<Pick<ImagePlanEntry, "state" | "reason">> {
  if (!metadata) {
    return {
      state: "missing",
      reason: (await exists(outputPath))
        ? "Asset exists but is not registered."
        : "Asset is absent.",
    };
  }
  if (metadata.promptSha256 !== hashImagePrompt(image) || metadata.output !== assetOutput(image.id))
    return { state: "stale", reason: "Prompt, size, or output metadata changed." };
  const expectedQuality = metadata.executor === "openai-api" ? DEFAULT_QUALITY : null;
  if (
    metadata.model !== DEFAULT_MODEL ||
    metadata.quality !== expectedQuality ||
    metadata.requestSha256 !==
      hashImageRequest(image, metadata.executor, DEFAULT_MODEL, expectedQuality)
  )
    return { state: "stale", reason: "Generation runtime metadata changed." };
  if (!(await exists(outputPath)))
    return { state: "missing", reason: "Registered asset is absent." };
  try {
    const buffer = await readFile(outputPath);
    const dimensions = inspectPng(buffer);
    assertRequestedDimensions(image, dimensions);
    if (digest(buffer) !== metadata.assetSha256)
      return { state: "stale", reason: "Asset bytes no longer match the manifest." };
    if (
      dimensions.width !== metadata.actualWidth ||
      dimensions.height !== metadata.actualHeight ||
      image.prompt !== metadata.prompt
    )
      return { state: "stale", reason: "Asset metadata no longer matches the prompt or file." };
    return { state: "current", reason: "Prompt, manifest, and asset are current." };
  } catch (error) {
    return {
      state: "invalid",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function planImages(
  options: Pick<GenerateImagesOptions, "sourcePath" | "outputDir"> = {},
): Promise<ImageGenerationPlan> {
  const sourcePath = options.sourcePath ?? DEFAULT_SOURCE_PATH;
  const outputDir = options.outputDir ?? DEFAULT_OUTPUT_DIR;
  const input = await loadPromptFile(sourcePath);
  const manifest = await readManifest(resolve(outputDir, "manifest.json"), sourcePath);
  const entries: ImagePlanEntry[] = [];
  for (const image of input.images) {
    const state = await inspectPlanEntry(
      image,
      manifest.images[image.id],
      resolve(outputDir, `${image.id}.png`),
    );
    entries.push({
      id: image.id,
      purpose: image.purpose,
      output: assetOutput(image.id),
      ...state,
    });
  }
  return {
    version: 1,
    source: portableProjectPath(sourcePath),
    preferredExecutor: "codex-built-in",
    entries,
  };
}

export async function writeImagePlan(
  plan: ImageGenerationPlan,
  planPath = DEFAULT_PLAN_PATH,
): Promise<void> {
  await writeAtomic(planPath, `${JSON.stringify(plan, null, 2)}\n`);
}

export async function registerCodexImage(
  options: RegisterCodexImageOptions,
): Promise<{ outputPath: string; skipped: boolean }> {
  const sourcePath = options.sourcePath ?? DEFAULT_SOURCE_PATH;
  const outputDir = options.outputDir ?? DEFAULT_OUTPUT_DIR;
  const input = await loadPromptFile(sourcePath);
  const image = input.images.find((candidate) => candidate.id === options.id);
  if (!image) throw new Error(`Unknown image id "${options.id}" in ${sourcePath}.`);
  const sourceFile = resolve(options.sourceFile);
  const sourceBuffer = await readFile(sourceFile);
  const dimensions = inspectPng(sourceBuffer);
  assertRequestedDimensions(image, dimensions);
  const manifestPath = resolve(outputDir, "manifest.json");
  const manifest = await readManifest(manifestPath, sourcePath);
  const outputPath = resolve(outputDir, `${image.id}.png`);
  const previous = manifest.images[image.id];
  const assetSha256 = digest(sourceBuffer);
  const previousState = await inspectPlanEntry(image, previous, outputPath);
  if (previousState.state === "current" && previous?.assetSha256 === assetSha256)
    return { outputPath, skipped: true };
  if (previous && !options.replace)
    throw new Error(
      `Image "${image.id}" is already registered but ${previousState.reason.toLowerCase()} Use --replace after reviewing the new image.`,
    );
  if (
    sourceFile !== outputPath &&
    (await exists(outputPath)) &&
    digest(await readFile(outputPath)) !== assetSha256 &&
    !options.replace
  )
    throw new Error(`Refusing to overwrite ${outputPath}; pass --replace after visual review.`);
  if (sourceFile !== outputPath) await writeAtomic(outputPath, sourceBuffer);
  manifest.version = 2;
  manifest.source = portableProjectPath(sourcePath);
  manifest.images[image.id] = {
    executor: "codex-built-in",
    prompt: image.prompt,
    model: "gpt-image-2",
    size: image.size,
    quality: null,
    output: assetOutput(image.id),
    recordedAt: (options.recordedAt ?? new Date()).toISOString(),
    promptSha256: hashImagePrompt(image),
    requestSha256: hashImageRequest(image, "codex-built-in", "gpt-image-2", null),
    assetSha256,
    actualWidth: dimensions.width,
    actualHeight: dimensions.height,
  };
  await writeManifest(manifestPath, manifest);
  return { outputPath, skipped: false };
}

function isTransientError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("status" in error)) return false;
  const status = (error as { status?: unknown }).status;
  return status === 429 || (typeof status === "number" && status >= 500);
}

async function generateWithRetry(client: ImageClient, image: ImagePrompt): Promise<Buffer> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await client.images.generate({
        model: DEFAULT_MODEL,
        prompt: image.prompt,
        size: image.size,
        quality: DEFAULT_QUALITY,
        output_format: "png",
        n: 1,
      });
      const base64 = response.data[0]?.b64_json;
      if (!base64) throw new Error("Image API response did not contain b64_json image data.");
      const buffer = Buffer.from(base64, "base64");
      assertRequestedDimensions(image, inspectPng(buffer));
      return buffer;
    } catch (error) {
      if (attempt === maxAttempts || !isTransientError(error)) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
    }
  }
  throw new Error("Image generation retry loop ended unexpectedly.");
}

async function createClient(apiKey: string): Promise<ImageClient> {
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey }) as unknown as ImageClient;
}

export async function generateImages(
  options: GenerateImagesOptions = {},
): Promise<GenerateImagesResult> {
  const sourcePath = options.sourcePath ?? DEFAULT_SOURCE_PATH;
  const outputDir = options.outputDir ?? DEFAULT_OUTPUT_DIR;
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const input = await loadPromptFile(sourcePath);
  if (!apiKey) {
    console.log(
      "Skipping API image generation: OPENAI_API_KEY is not configured. Use Codex built-in image generation plus npm run images:register, or keep the PPT fallback.",
    );
    return {
      generated: [],
      skipped: input.images.map((image) => image.id),
      failed: [],
      reason: "missing-api-key",
    };
  }

  await mkdir(outputDir, { recursive: true });
  const manifestPath = resolve(outputDir, "manifest.json");
  const manifest = await readManifest(manifestPath, sourcePath);
  const client = options.client ?? (await createClient(apiKey));
  const generated: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const image of input.images) {
    const outputPath = resolve(outputDir, `${image.id}.png`);
    const current = await inspectPlanEntry(image, manifest.images[image.id], outputPath);
    if (current.state === "current") {
      skipped.push(image.id);
      continue;
    }
    try {
      const buffer = await generateWithRetry(client, image);
      const dimensions = inspectPng(buffer);
      await writeAtomic(outputPath, buffer);
      manifest.images[image.id] = {
        executor: "openai-api",
        prompt: image.prompt,
        model: DEFAULT_MODEL,
        size: image.size,
        quality: DEFAULT_QUALITY,
        output: assetOutput(image.id),
        recordedAt: new Date().toISOString(),
        promptSha256: hashImagePrompt(image),
        requestSha256: hashImageRequest(image, "openai-api", DEFAULT_MODEL, DEFAULT_QUALITY),
        assetSha256: digest(buffer),
        actualWidth: dimensions.width,
        actualHeight: dimensions.height,
      };
      generated.push(image.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`API image generation failed for "${image.id}": ${message}`);
      failed.push(image.id);
    }
  }
  manifest.version = 2;
  manifest.source = portableProjectPath(sourcePath);
  await writeManifest(manifestPath, manifest);
  return { generated, skipped, failed };
}

function flagValue(arguments_: string[], name: string): string | undefined {
  const index = arguments_.indexOf(name);
  return index >= 0 ? arguments_[index + 1] : undefined;
}

async function main(): Promise<void> {
  const [command = "api", ...arguments_] = process.argv.slice(2);
  if (command === "plan") {
    const plan = await planImages();
    await writeImagePlan(plan);
    for (const entry of plan.entries)
      console.log(`${entry.state.padEnd(7)} ${entry.id}: ${entry.reason}`);
    console.log(`Plan: ${DEFAULT_PLAN_PATH}`);
    console.log(
      "For missing or stale entries, ask Codex to use its built-in image generation tool, visually review each result, then register it with npm run images:register.",
    );
    return;
  }
  if (command === "register") {
    const id = flagValue(arguments_, "--id");
    const sourceFile = flagValue(arguments_, "--source");
    if (!id || !sourceFile)
      throw new Error(
        "Usage: npm run images:register -- --id <prompt-id> --source <png-path> [--replace]",
      );
    const result = await registerCodexImage({
      id,
      sourceFile,
      replace: arguments_.includes("--replace"),
    });
    console.log(
      result.skipped
        ? `Skipped unchanged ${result.outputPath}`
        : `Registered Codex built-in image at ${result.outputPath}`,
    );
    return;
  }
  if (command === "verify") {
    const plan = await planImages();
    const problems = plan.entries.filter((entry) => entry.state !== "current");
    for (const entry of plan.entries)
      console.log(`${entry.state.padEnd(7)} ${entry.id}: ${entry.reason}`);
    if (problems.length > 0)
      throw new Error(
        `${problems.length} generated image asset(s) are missing, stale, or invalid.`,
      );
    console.log(`Verified ${plan.entries.length} generated image asset(s).`);
    return;
  }
  if (command !== "api") throw new Error(`Unknown image command "${command}".`);
  const result = await generateImages();
  if (result.reason === "missing-api-key") return;
  for (const id of result.generated) console.log(`Generated assets/generated/${id}.png`);
  for (const id of result.skipped) console.log(`Skipped current assets/generated/${id}.png`);
  if (result.failed.length > 0)
    console.warn(
      `API image generation completed with ${result.failed.length} non-blocking failure(s).`,
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(
      `AI image asset workflow failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
