import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { DeckSchema } from "../src/types.js";
import { getDiagramTextWarnings } from "../src/layouts/diagram-slide.js";
import {
  assertElementsWithinBounds,
  assertNoUnexpectedOverlap,
  collectBoundsViolations,
  collectUnexpectedOverlaps,
} from "../src/utils/bounds.js";
import { containImage, coverImage } from "../src/utils/image-fit.js";

describe("DeckSchema", () => {
  it("accepts the example deck", async () => {
    const source = await readFile(resolve(process.cwd(), "content/deck.yaml"), "utf8");
    const result = DeckSchema.safeParse(parse(source));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slides).toHaveLength(10);
      expect(result.data.slides[0]).toMatchObject({
        layout: "title-slide",
        illustrationId: "cover-neural-network-concept",
      });
      expect(result.data.slides.map((slide) => slide.layout)).toEqual([
        "title-slide",
        "text-slide",
        "text-image-slide",
        "text-image-slide",
        "text-image-slide",
        "diagram-slide",
        "diagram-slide",
        "diagram-slide",
        "results-slide",
        "results-slide",
      ]);
      const diagramKinds = result.data.slides
        .filter((slide) => slide.layout === "diagram-slide")
        .map((slide) => slide.diagram.kind);
      expect(diagramKinds).toEqual(["linear-process", "input-process-output", "three-branch"]);
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

  it("rejects diagram edges that reference missing nodes", () => {
    const result = DeckSchema.safeParse({
      meta: { title: "Invalid diagram" },
      slides: [
        {
          id: "diagram",
          layout: "diagram-slide",
          title: "Invalid edge",
          diagram: {
            kind: "linear-process",
            nodes: [
              { id: "input", label: "Input" },
              { id: "output", label: "Output" },
            ],
            edges: [{ from: "input", to: "missing" }],
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("existing node ids");
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

  it("collects every invalid or out-of-bounds element and tolerates floating-point noise", () => {
    expect(
      collectBoundsViolations([
        { id: "invalid", layer: "content", x: Number.NaN, y: 0, w: 1, h: 1 },
        { id: "right", layer: "content", x: 13, y: 0, w: 1, h: 1 },
        { id: "bottom", layer: "content", x: 0, y: 7.25, w: 1, h: 1 },
        { id: "epsilon", layer: "content", x: 0, y: 0, w: 13.3330000001, h: 7.5 },
      ]),
    ).toEqual([
      expect.objectContaining({ code: "invalid-dimensions", elementId: "invalid" }),
      expect.objectContaining({ code: "element-out-of-bounds", elementId: "right" }),
      expect.objectContaining({ code: "element-out-of-bounds", elementId: "bottom" }),
    ]);
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

  it("collects all overlaps and only permits explicitly related elements", () => {
    const overlaps = collectUnexpectedOverlaps([
      {
        id: "surface",
        layer: "decoration",
        x: 1,
        y: 1,
        w: 4,
        h: 3,
        allowedOverlapWith: ["own-label"],
      },
      { id: "own-label", layer: "content", x: 1.2, y: 1.2, w: 1, h: 0.4 },
      { id: "foreign-label", layer: "content", x: 2, y: 1.2, w: 1, h: 0.4 },
      { id: "foreign-value", layer: "content", x: 2.5, y: 1.3, w: 1, h: 0.4 },
      { id: "touching", layer: "content", x: 5, y: 1, w: 1, h: 1 },
      { id: "connector", layer: "decoration", kind: "connector", x: 1, y: 1, w: 4, h: 2 },
    ]);

    expect(overlaps.map(({ firstId, secondId }) => [firstId, secondId])).toEqual([
      ["surface", "foreign-label"],
      ["surface", "foreign-value"],
      ["own-label", "foreign-label"],
      ["foreign-label", "foreign-value"],
    ]);
  });

  it("warns when a diagram node label is too long", () => {
    const warnings = getDiagramTextWarnings("diagram", {
      kind: "linear-process",
      nodes: [
        {
          id: "input",
          label: "A deliberately long diagram node label that needs shortening",
          emphasis: "normal",
        },
        { id: "output", label: "Output", emphasis: "normal" },
      ],
      edges: [{ from: "input", to: "output" }],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("long text");
  });
});
