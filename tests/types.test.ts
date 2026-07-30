import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { DeckSchema } from "../src/types.js";
import { assertElementsWithinBounds } from "../src/utils/bounds.js";
import { containImage, coverImage } from "../src/utils/image-fit.js";

describe("DeckSchema", () => {
  it("accepts the example deck", async () => {
    const source = await readFile(resolve(process.cwd(), "content/deck.yaml"), "utf8");
    const result = DeckSchema.safeParse(parse(source));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slides).toHaveLength(3);
    }
  });

  it("rejects duplicate slide ids", () => {
    const result = DeckSchema.safeParse({
      meta: { title: "Invalid deck" },
      slides: [
        { id: "duplicate", type: "title", title: "One" },
        { id: "duplicate", type: "text", title: "Two", sections: [{ bullets: ["Point"] }] },
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
      assertElementsWithinBounds([{ name: "overflow", x: 13, y: 0, w: 1, h: 1 }]),
    ).toThrow("Element exceeds slide bounds");
  });
});
