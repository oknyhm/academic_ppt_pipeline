import type { RenderContext } from "../layouts/registry.js";
import type { Deck } from "../types.js";

export const VALIDATION_CHECKS = [
  "schema",
  "duplicate-slide-id",
  "assets",
  "bounds",
  "minimum-font-size",
  "text-length",
  "overlap",
] as const;

export type ValidationCheckName = (typeof VALIDATION_CHECKS)[number];
export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  check: ValidationCheckName;
  code: string;
  severity: ValidationSeverity;
  message: string;
  slideId?: string;
  elementId?: string;
  path?: string;
}

export interface ValidationCheckResult {
  name: ValidationCheckName;
  status: "passed" | "warning" | "failed" | "skipped";
  errors: number;
  warnings: number;
}

export interface ValidationReport {
  version: 1;
  generatedAt: string;
  deckPath: string;
  valid: boolean;
  manualReviewRequired: true;
  manualReviewMessage: string;
  checks: ValidationCheckResult[];
  summary: {
    slides: number;
    errors: number;
    warnings: number;
  };
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationResult {
  deck?: Deck;
  context: RenderContext;
  report: ValidationReport;
}

export type ValidDeckValidationResult = ValidationResult & { deck: Deck };
