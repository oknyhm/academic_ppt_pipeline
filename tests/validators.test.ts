import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Deck } from "../src/types.js";
import type { ElementBox } from "../src/utils/bounds.js";
import { validateDeck, validateDeckFile } from "../src/validators/index.js";
import { validateMinimumFontSizes } from "../src/validators/layout.js";
import { validateTextDensity } from "../src/validators/text.js";

let temporaryDirectory: string | undefined;

afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = undefined;
});

async function makeTemporaryDirectory(): Promise<string> {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "ppt-validation-"));
  return temporaryDirectory;
}

describe("static validation pipeline", () => {
  it("validates the sample deck and writes every check to the report", async () => {
    const directory = await makeTemporaryDirectory();
    const reportPath = join(directory, "validation-report.json");
    const result = await validateDeckFile("content/deck.yaml", reportPath);

    expect(result.deck?.slides).toHaveLength(10);
    expect(result.report.valid).toBe(true);
    expect(result.report.summary.errors).toBe(0);
    expect(result.report.manualReviewRequired).toBe(true);
    expect(result.report.checks.map((check) => check.name)).toEqual([
      "schema",
      "duplicate-slide-id",
      "assets",
      "bounds",
      "minimum-font-size",
      "text-length",
      "overlap",
    ]);
    const saved = JSON.parse(await readFile(reportPath, "utf8")) as {
      valid: boolean;
      summary: { slides: number };
    };
    expect(saved).toMatchObject({ valid: true, summary: { slides: 10 } });
  });

  it("writes a report when YAML parsing fails", async () => {
    const directory = await makeTemporaryDirectory();
    const deckPath = join(directory, "invalid.yaml");
    const reportPath = join(directory, "validation-report.json");
    await writeFile(deckPath, "meta:\n  title: [\n", "utf8");

    const result = await validateDeckFile(deckPath, reportPath);

    expect(result.deck).toBeUndefined();
    expect(result.report.valid).toBe(false);
    expect(result.report.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "yaml-parse-error" })]),
    );
    expect(result.report.checks.find((check) => check.name === "duplicate-slide-id")?.status).toBe(
      "skipped",
    );
    await expect(readFile(reportPath, "utf8")).resolves.toContain('"valid": false');
  });

  it("reports duplicate ids even when another schema field is invalid", async () => {
    const directory = await makeTemporaryDirectory();
    const deckPath = join(directory, "duplicate.yaml");
    const reportPath = join(directory, "validation-report.json");
    await writeFile(
      deckPath,
      [
        "meta:",
        "  title: Invalid deck",
        "slides:",
        "  - id: repeated",
        "    layout: title-slide",
        "    title: First",
        "  - id: repeated",
        "    layout: text-slide",
        "    title: Second",
        "    sections: []",
      ].join("\n"),
      "utf8",
    );

    const result = await validateDeckFile(deckPath, reportPath);

    expect(result.report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate-slide-id" }),
        expect.objectContaining({ code: "schema-error" }),
      ]),
    );
  });

  it("reports missing assets before PPTX generation", async () => {
    const deck: Deck = {
      meta: { title: "Asset validation" },
      slides: [
        {
          id: "missing-image",
          layout: "text-image-slide",
          title: "Missing image",
          imagePosition: "right",
          image: { path: "does-not-exist.png", alt: "Missing" },
          sections: [{ bullets: ["Asset preflight must fail."] }],
        },
      ],
    };

    const result = await validateDeck(deck, process.cwd());

    expect(result.report.valid).toBe(false);
    expect(result.report.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "missing-asset" })]),
    );
  });

  it("uses a warning and native fallback when an optional generated illustration is missing", async () => {
    const directory = await makeTemporaryDirectory();
    const deck: Deck = {
      meta: { title: "Optional illustration" },
      slides: [
        {
          id: "cover",
          layout: "title-slide",
          title: "Fallback cover",
          illustrationId: "missing-concept",
        },
      ],
    };

    const result = await validateDeck(deck, directory);

    expect(result.report.valid).toBe(true);
    expect(result.context.illustrations.size).toBe(0);
    expect(result.report.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check: "assets",
          code: "optional-illustration-fallback",
        }),
      ]),
    );
  });

  it("detects a results layout that exceeds the slide bounds", async () => {
    const metrics = Array.from({ length: 4 }, (_, index) => ({
      label: `Metric ${index + 1}`,
      value: String(index + 1),
    }));
    const deck: Deck = {
      meta: { title: "Bounds validation" },
      slides: [
        {
          id: "crowded-results",
          layout: "results-slide",
          title: "Crowded results",
          chart: { path: "assets/charts/method-comparison.svg", alt: "Chart" },
          metrics,
        },
      ],
    };

    const result = await validateDeck(deck, resolve(process.cwd()));

    expect(result.report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ check: "bounds", code: "element-out-of-bounds" }),
      ]),
    );
  });

  it("records the connector overlap limitation for diagram slides", async () => {
    const deck: Deck = {
      meta: { title: "Connector validation" },
      slides: [
        {
          id: "connector-slide",
          layout: "diagram-slide",
          title: "Connector routing",
          diagram: {
            kind: "linear-process",
            nodes: [
              { id: "first", label: "First", emphasis: "normal" },
              { id: "second", label: "Second", emphasis: "normal" },
            ],
            edges: [{ from: "first", to: "second" }],
          },
        },
      ],
    };

    const result = await validateDeck(deck, process.cwd());

    expect(result.report.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check: "overlap",
          code: "connector-overlap-advisory",
        }),
      ]),
    );
  });

  it("warns below the applicable minimum font size and permits the footer exception", () => {
    const boxes: ElementBox[] = [
      {
        id: "small-body",
        layer: "content",
        kind: "text",
        x: 1,
        y: 1,
        w: 2,
        h: 1,
        fontSize: 10,
        minimumFontSize: 11,
      },
      {
        id: "footer",
        layer: "content",
        kind: "text",
        x: 1,
        y: 7,
        w: 2,
        h: 0.2,
        fontSize: 10,
        minimumFontSize: 9,
      },
    ];

    expect(validateMinimumFontSizes("font-test", boxes)).toEqual([
      expect.objectContaining({ severity: "warning", elementId: "small-body" }),
    ]);
  });

  it("warns when text metadata is missing and when PowerPoint may shrink text", () => {
    const boxes: ElementBox[] = [
      { id: "missing-size", layer: "content", kind: "text", x: 1, y: 1, w: 2, h: 1 },
      {
        id: "shrinkable",
        layer: "content",
        kind: "text",
        x: 1,
        y: 2,
        w: 2,
        h: 1,
        fontSize: 18,
        fit: "shrink",
        text: "This text is intentionally much too long for a narrow two-inch text box.",
      },
    ];

    expect(validateMinimumFontSizes("font-test", boxes)).toEqual([
      expect.objectContaining({ code: "missing-font-size-metadata", elementId: "missing-size" }),
      expect.objectContaining({ code: "font-shrink-risk", elementId: "shrinkable" }),
    ]);
  });

  it("warns for long cover, section, caption, and metric fields", () => {
    const deck: Deck = {
      meta: { title: "Text validation" },
      slides: [
        {
          id: "cover-copy",
          layout: "title-slide",
          title: "Cover",
          subtitle: "S".repeat(51),
          author: "A".repeat(31),
          affiliation: "F".repeat(41),
        },
        {
          id: "image-copy",
          layout: "text-image-slide",
          title: "Image",
          image: { path: "unused.svg", alt: "Unused" },
          imagePosition: "right",
          imageCaption: "C".repeat(61),
          sections: [{ heading: "H".repeat(25), bullets: ["Short"] }],
        },
        {
          id: "result-copy",
          layout: "results-slide",
          title: "Results",
          chartCaption: "C".repeat(61),
          metrics: [{ label: "L".repeat(19), value: "V".repeat(19), detail: "D".repeat(36) }],
        },
      ],
    };

    expect(validateTextDensity(deck).map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "cover-subtitle-too-long",
        "cover-author-too-long",
        "cover-affiliation-too-long",
        "section-heading-too-long",
        "image-caption-too-long",
        "metric-label-too-long",
        "metric-value-too-long",
        "metric-detail-too-long",
        "chart-caption-too-long",
      ]),
    );
  });
});
