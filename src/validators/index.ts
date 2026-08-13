import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse } from "yaml";
import type { RenderContext } from "../layouts/registry.js";
import { DeckSchema, type Deck } from "../types.js";
import { preflightAssets } from "./assets.js";
import { validateLayouts } from "./layout.js";
import { createValidationReport, writeValidationReport } from "./report.js";
import { findDuplicateSlideIdIssues, zodErrorIssues } from "./schema.js";
import { validateTextDensity } from "./text.js";
import {
  VALIDATION_CHECKS,
  type ValidDeckValidationResult,
  type ValidationCheckName,
  type ValidationIssue,
  type ValidationResult,
} from "./types.js";

const EMPTY_CONTEXT: RenderContext = {
  images: new Map(),
  charts: new Map(),
  illustrations: new Map(),
};

export async function validateDeck(
  deck: Deck,
  deckDirectory: string,
  deckPathLabel = "<in-memory>",
): Promise<ValidDeckValidationResult> {
  const duplicateIssues = findDuplicateSlideIdIssues(deck);
  const { context, issues: assetIssues } = await preflightAssets(deck, deckDirectory);
  const issues = [
    ...duplicateIssues,
    ...assetIssues,
    ...validateLayouts(deck, context),
    ...validateTextDensity(deck),
  ];
  return {
    deck,
    context,
    report: createValidationReport({
      deckPath: deckPathLabel,
      slideCount: deck.slides.length,
      issues,
    }),
  };
}

function failedFileResult(
  deckPath: string,
  issues: ValidationIssue[],
  slideCount: number,
  duplicateCheckEvaluated: boolean,
): ValidationResult {
  const skippedChecks = new Set<ValidationCheckName>(
    VALIDATION_CHECKS.filter(
      (check) =>
        check !== "schema" && (duplicateCheckEvaluated ? check !== "duplicate-slide-id" : true),
    ),
  );
  return {
    context: EMPTY_CONTEXT,
    report: createValidationReport({ deckPath, slideCount, issues, skippedChecks }),
  };
}

export async function validateDeckFile(
  deckPath: string,
  reportPath = "output/validation-report.json",
): Promise<ValidationResult> {
  const absoluteDeckPath = resolve(process.cwd(), deckPath);
  let source: string;
  try {
    source = await readFile(absoluteDeckPath, "utf8");
  } catch (error) {
    const result = failedFileResult(
      deckPath,
      [
        {
          check: "schema",
          code: "deck-read-error",
          severity: "error",
          path: deckPath,
          message: `Unable to read deck file: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      0,
      false,
    );
    await writeValidationReport(result.report, reportPath);
    return result;
  }

  let raw: unknown;
  try {
    raw = parse(source);
  } catch (error) {
    const result = failedFileResult(
      deckPath,
      [
        {
          check: "schema",
          code: "yaml-parse-error",
          severity: "error",
          path: deckPath,
          message: `Unable to parse deck YAML: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      0,
      false,
    );
    await writeValidationReport(result.report, reportPath);
    return result;
  }

  const duplicateIssues = findDuplicateSlideIdIssues(raw);
  const parsed = DeckSchema.safeParse(raw);
  if (!parsed.success) {
    const slideCount =
      typeof raw === "object" && raw !== null && "slides" in raw && Array.isArray(raw.slides)
        ? raw.slides.length
        : 0;
    const result = failedFileResult(
      deckPath,
      [...duplicateIssues, ...zodErrorIssues(parsed.error)],
      slideCount,
      true,
    );
    await writeValidationReport(result.report, reportPath);
    return result;
  }

  const result = await validateDeck(parsed.data, dirname(absoluteDeckPath), deckPath);
  await writeValidationReport(result.report, reportPath);
  return result;
}

export { createValidationReport, writeValidationReport } from "./report.js";
export type {
  ValidationCheckName,
  ValidationCheckResult,
  ValidationIssue,
  ValidationReport,
  ValidationResult,
  ValidationSeverity,
} from "./types.js";
