import { ZodError } from "zod";
import type { ValidationIssue } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function findDuplicateSlideIdIssues(source: unknown): ValidationIssue[] {
  if (!isRecord(source) || !Array.isArray(source.slides)) return [];
  const seen = new Map<string, number>();
  const issues: ValidationIssue[] = [];
  source.slides.forEach((candidate, index) => {
    if (!isRecord(candidate) || typeof candidate.id !== "string") return;
    const firstIndex = seen.get(candidate.id);
    if (firstIndex === undefined) {
      seen.set(candidate.id, index);
      return;
    }
    issues.push({
      check: "duplicate-slide-id",
      code: "duplicate-slide-id",
      severity: "error",
      slideId: candidate.id,
      path: `slides.${index}.id`,
      message: `Duplicate slide id "${candidate.id}" (first declared at slides.${firstIndex}.id).`,
    });
  });
  return issues;
}

export function zodErrorIssues(error: ZodError): ValidationIssue[] {
  return error.issues
    .filter((issue) => !issue.message.startsWith("Duplicate slide id:"))
    .map((issue) => ({
      check: "schema" as const,
      code: "schema-error",
      severity: "error" as const,
      path: issue.path.map(String).join("."),
      message: issue.message,
    }));
}
