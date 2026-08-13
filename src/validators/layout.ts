import { addFooter } from "../components/footer.js";
import { renderLayout, type RenderContext } from "../layouts/registry.js";
import type { PptxSlide } from "../pptx.js";
import { THEME } from "../theme.js";
import type { Deck, Slide } from "../types.js";
import {
  collectBoundsViolations,
  collectUnexpectedOverlaps,
  type ElementBox,
} from "../utils/bounds.js";
import type { ValidationIssue } from "./types.js";

const NOOP_SLIDE: PptxSlide = {
  addImage: () => undefined,
  addShape: () => undefined,
  addText: () => undefined,
};

export function validateMinimumFontSizes(
  slideId: string,
  elements: readonly ElementBox[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const element of elements) {
    if (element.kind !== "text") continue;
    if (element.fontSize === undefined) {
      issues.push({
        check: "minimum-font-size",
        code: "missing-font-size-metadata",
        severity: "warning",
        slideId,
        elementId: element.id,
        message: `Text element "${element.id}" does not declare font-size metadata.`,
      });
      continue;
    }
    const minimum = element.minimumFontSize ?? THEME.fontSizes.minimum;
    if (!Number.isFinite(element.fontSize) || element.fontSize < minimum) {
      issues.push({
        check: "minimum-font-size",
        code: "font-size-below-minimum",
        severity: "warning",
        slideId,
        elementId: element.id,
        message: `Element "${element.id}" uses ${element.fontSize}pt; minimum is ${minimum}pt.`,
      });
    }
    if (
      element.fit === "shrink" &&
      (element.text === undefined || Array.from(element.text).length > shrinkRiskThreshold(element))
    ) {
      issues.push({
        check: "minimum-font-size",
        code: "font-shrink-risk",
        severity: "warning",
        slideId,
        elementId: element.id,
        message: `Text element "${element.id}" may shrink below its declared ${element.fontSize}pt; inspect it in PowerPoint.`,
      });
    }
  }
  return issues;
}

function shrinkRiskThreshold(element: ElementBox): number {
  if (element.fontSize === undefined || element.fontSize <= 0) return 0;
  // Conservative single-region capacity heuristic. East Asian glyphs are close to one em wide;
  // allowing 1.35x accounts for common Latin words and punctuation without warning on every
  // merely shrink-capable text box. This is advisory, not an attempt to reproduce PowerPoint.
  const charactersPerLine = (element.w * 72) / element.fontSize;
  const lineCount = Math.max(1, (element.h * 72) / (element.fontSize * 1.25));
  return Math.max(1, Math.floor(charactersPerLine * lineCount * 1.35));
}

function renderSlideElements(
  deck: Deck,
  slide: Slide,
  index: number,
  context: RenderContext,
): ElementBox[] {
  return [
    ...renderLayout(NOOP_SLIDE, slide, context),
    ...addFooter(NOOP_SLIDE, deck.meta.title, index + 1),
  ];
}

export function validateLayouts(deck: Deck, context: RenderContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [index, slide] of deck.slides.entries()) {
    let elements: ElementBox[];
    try {
      elements = renderSlideElements(deck, slide, index, context);
    } catch (error) {
      issues.push({
        check: "bounds",
        code: "layout-render-error",
        severity: "error",
        slideId: slide.id,
        message: `Unable to evaluate layout: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    for (const violation of collectBoundsViolations(elements)) {
      issues.push({
        check: "bounds",
        code: violation.code,
        severity: "error",
        slideId: slide.id,
        elementId: violation.elementId,
        message: violation.message,
      });
    }
    for (const violation of collectUnexpectedOverlaps(elements)) {
      issues.push({
        check: "overlap",
        code: "unexpected-overlap",
        severity: "error",
        slideId: slide.id,
        elementId: `${violation.firstId}|${violation.secondId}`,
        message: violation.message,
      });
    }
    if (elements.some((element) => element.kind === "connector")) {
      issues.push({
        check: "overlap",
        code: "connector-overlap-advisory",
        severity: "warning",
        slideId: slide.id,
        message:
          "Connector line intersections are not inferred from rectangular envelopes; inspect connector routing in the preview and Microsoft PowerPoint.",
      });
    }
    issues.push(...validateMinimumFontSizes(slide.id, elements));
  }
  return issues;
}
