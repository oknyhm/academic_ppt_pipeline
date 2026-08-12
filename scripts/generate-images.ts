import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { z } from "zod";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_SOURCE_PATH = resolve(PROJECT_ROOT, "content/image-prompts.yaml");
const DEFAULT_OUTPUT_DIR = resolve(PROJECT_ROOT, "assets/generated");
const DEFAULT_MODEL = "gpt-image-2";
const DEFAULT_QUALITY = "low";
const REQUIRED_NEGATIVE_CONSTRAINTS = [
  "no text",
  "no labels",
  "no numbers",
  "no formula",
  "no watermark",
];

export const ImagePromptSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Image id must be lowercase kebab-case."),
  purpose: z.enum(["cover", "conceptual"]),
  prompt: z.string().min(1),
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

type ImagePrompt = z.infer<typeof ImagePromptSchema>;

interface GeneratedImageMetadata {
  prompt: string;
  model: string;
  size: ImagePrompt["size"];
  quality: string;
  output: string;
  generatedAt: string;
  sha256: string;
}

interface GeneratedImageManifest {
  source: string;
  images: Record<string, GeneratedImageMetadata>;
}

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

function hashImageRequest(image: ImagePrompt): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        prompt: image.prompt,
        model: DEFAULT_MODEL,
        size: image.size,
        quality: DEFAULT_QUALITY,
      }),
    )
    .digest("hex");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function readManifest(path: string): Promise<GeneratedImageManifest> {
  if (!(await exists(path))) return { source: "content/image-prompts.yaml", images: {} };
  return JSON.parse(await readFile(path, "utf8")) as GeneratedImageManifest;
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
      return Buffer.from(base64, "base64");
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
  const input = ImagePromptFileSchema.parse(parse(await readFile(sourcePath, "utf8")));
  if (!apiKey) {
    console.log(
      "Skipping AI image generation: OPENAI_API_KEY is not configured. The PPT uses its pure-color fallback.",
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
  const previousManifest = await readManifest(manifestPath);
  const nextManifest: GeneratedImageManifest = { source: "content/image-prompts.yaml", images: {} };
  const client = options.client ?? (await createClient(apiKey));
  const generated: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const image of input.images) {
    const output = `assets/generated/${image.id}.png`;
    const outputPath = resolve(outputDir, `${image.id}.png`);
    const sha256 = hashImageRequest(image);
    const previous = previousManifest.images[image.id];
    if (previous?.sha256 === sha256 && previous.output === output && (await exists(outputPath))) {
      nextManifest.images[image.id] = previous;
      skipped.push(image.id);
      continue;
    }
    try {
      await writeFile(outputPath, await generateWithRetry(client, image));
      nextManifest.images[image.id] = {
        prompt: image.prompt,
        model: DEFAULT_MODEL,
        size: image.size,
        quality: DEFAULT_QUALITY,
        output,
        generatedAt: new Date().toISOString(),
        sha256,
      };
      generated.push(image.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`AI image generation failed for "${image.id}": ${message}`);
      failed.push(image.id);
    }
  }
  await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
  return { generated, skipped, failed };
}

async function main(): Promise<void> {
  const result = await generateImages();
  if (result.reason === "missing-api-key") return;
  for (const id of result.generated) console.log(`Generated assets/generated/${id}.png`);
  for (const id of result.skipped) console.log(`Skipped unchanged assets/generated/${id}.png`);
  if (result.failed.length > 0)
    console.warn(
      `AI image generation completed with ${result.failed.length} non-blocking failure(s).`,
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(
      `AI image generation input failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
