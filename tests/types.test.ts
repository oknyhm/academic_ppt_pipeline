import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { DeckSchema } from "../src/types.js";
import { assertElementsWithinBounds, assertNoUnexpectedOverlap } from "../src/utils/bounds.js";
import { containImage, coverImage } from "../src/utils/image-fit.js";

describe("DeckSchema", () => {
  it("accepts the example deck", async () => {
    const source = await readFile(resolve(process.cwd(), "content/deck.yaml"), "utf8");
    const result = DeckSchema.safeParse(parse(source));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slides).toHaveLength(7);
      expect(result.data.slides.map((slide) => slide.layout)).toEqual([
        "title-slide",
        "text-slide",
        "text-image-slide",
        "text-image-slide",
        "text-image-slide",
        "diagram-slide",
        "results-slide",
      ]);
    }
  });

  it("keeps coordinates out of the content document", async () => {
    const source = await readFile(resolve(process.cwd(), "content/deck.yaml"), "utf8");
    expect(source).not.toMatch(/^\s*(x|y|w|h):/m);
  });

  it("rejects duplicate slide ids", () => {
    const result = DeckSchema.safeParse({
      meta: { title: "Invalid deck" },
      slides: [
        { id: "duplicate", layout: "title-slide", title: "One" },
        { id: "duplicate", layout: "text-slide", title: "Two", sections: [{ bullets: ["Point"] }] },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Duplicate slide id");
    }
  });
});

describe("layout helpers", () => {
  it("fits images with contain and cover modes", () => {
    expect(containImage({ width: 4, height: 2 }, { x: 0, y: 0, w: 2, h: 2 })).toEqual({
      x: 0,
      y: 0.5,
      w: 2,
      h: 1,
    });
    expect(coverImage({ width: 4, height: 2 }, { x: 0, y: 0, w: 2, h: 2 })).toEqual({
      x: -1,
      y: 0,
      w: 4,
      h: 2,
    });
  });

  it("rejects elements outside the slide", () => {
    expect(() =>
      assertElementsWithinBounds([{ id: "overflow", layer: "content", x: 13, y: 0, w: 1, h: 1 }]),
    ).toThrow("Element exceeds slide bounds");
  });

  it("rejects unexpected overlap but allows background overlap", () => {
    expect(() =>
      assertNoUnexpectedOverlap([
        { id: "first", layer: "content", x: 1, y: 1, w: 2, h: 1 },
        { id: "second", layer: "content", x: 2, y: 1, w: 2, h: 1 },
      ]),
    ).toThrow("Unexpected overlap");
    expect(() =>
      assertNoUnexpectedOverlap([
        { id: "background", layer: "background", x: 0, y: 0, w: 13.333, h: 7.5 },
        { id: "content", layer: "content", x: 1, y: 1, w: 2, h: 1 },
      ]),
    ).not.toThrow();
  });
});
