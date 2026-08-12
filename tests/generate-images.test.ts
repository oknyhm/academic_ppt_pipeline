import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { generateImages, ImagePromptFileSchema } from "../scripts/generate-images.js";

describe("optional AI image generation", () => {
  it("validates decorative prompts with all required negative constraints", async () => {
    const source = await readFile(resolve(process.cwd(), "content/image-prompts.yaml"), "utf8");
    const input = ImagePromptFileSchema.parse(parse(source));

    expect(input.images).toHaveLength(2);
    expect(input.images.map((image) => image.purpose)).toEqual(["cover", "conceptual"]);
  });

  it("rejects a prompt without the required no-text constraint", () => {
    const result = ImagePromptFileSchema.safeParse({
      images: [
        {
          id: "invalid-image",
          purpose: "conceptual",
          prompt: "Abstract neural network, no labels, no numbers, no formula, no watermark.",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("skips safely without an API key", async () => {
    const result = await generateImages({ apiKey: "" });
    expect(result).toEqual({
      generated: [],
      skipped: ["cover-neural-network-concept", "representation-learning-concept"],
      failed: [],
      reason: "missing-api-key",
    });
  });
});
