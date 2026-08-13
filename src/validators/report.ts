import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  VALIDATION_CHECKS,
  type ValidationCheckName,
  type ValidationIssue,
  type ValidationReport,
} from "./types.js";

const CHECK_ORDER = new Map(VALIDATION_CHECKS.map((check, index) => [check, index]));

function compareOptional(first?: string, second?: string): number {
  return (first ?? "").localeCompare(second ?? "", "en");
}

export function sortValidationIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort(
    (first, second) =>
      (CHECK_ORDER.get(first.check) ?? Number.MAX_SAFE_INTEGER) -
        (CHECK_ORDER.get(second.check) ?? Number.MAX_SAFE_INTEGER) ||
      compareOptional(first.slideId, second.slideId) ||
      compareOptional(first.path, second.path) ||
      compareOptional(first.elementId, second.elementId) ||
      first.code.localeCompare(second.code, "en") ||
      first.message.localeCompare(second.message, "en"),
  );
}

export function createValidationReport(options: {
  deckPath: string;
  slideCount: number;
  issues: readonly ValidationIssue[];
  skippedChecks?: ReadonlySet<ValidationCheckName>;
}): ValidationReport {
  const sorted = sortValidationIssues(options.issues);
  const errors = sorted.filter((issue) => issue.severity === "error");
  const warnings = sorted.filter((issue) => issue.severity === "warning");
  const skipped = options.skippedChecks ?? new Set<ValidationCheckName>();
  const checks = VALIDATION_CHECKS.map((name) => {
    const checkErrors = errors.filter((issue) => issue.check === name).length;
    const checkWarnings = warnings.filter((issue) => issue.check === name).length;
    return {
      name,
      status: skipped.has(name)
        ? ("skipped" as const)
        : checkErrors > 0
          ? ("failed" as const)
          : checkWarnings > 0
            ? ("warning" as const)
            : ("passed" as const),
      errors: checkErrors,
      warnings: checkWarnings,
    };
  });
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    deckPath: options.deckPath,
    valid: errors.length === 0,
    manualReviewRequired: true,
    manualReviewMessage:
      "Automated checks are advisory for visual quality. Inspect the generated deck in Microsoft PowerPoint before delivery.",
    checks,
    summary: { slides: options.slideCount, errors: errors.length, warnings: warnings.length },
    errors,
    warnings,
  };
}

export async function writeValidationReport(
  report: ValidationReport,
  reportPath = "output/validation-report.json",
): Promise<string> {
  const absolutePath = resolve(process.cwd(), reportPath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return absolutePath;
}
