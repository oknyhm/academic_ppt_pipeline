import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../theme.js";

export interface ElementBox {
  id: string;
  layer: "background" | "decoration" | "content" | "overlay";
  kind?: "shape" | "text" | "image" | "connector";
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  fontSize?: number;
  minimumFontSize?: number;
  fit?: "shrink";
  overlapGroup?: string;
  allowedOverlapWith?: readonly string[];
}

export const GEOMETRY_EPSILON = 1e-6;

export interface BoundsViolation {
  code: "invalid-dimensions" | "element-out-of-bounds";
  elementId: string;
  message: string;
}

export interface OverlapViolation {
  firstId: string;
  secondId: string;
  message: string;
}

export function collectBoundsViolations(
  elements: readonly ElementBox[],
  epsilon = GEOMETRY_EPSILON,
): BoundsViolation[] {
  const violations: BoundsViolation[] = [];
  for (const element of elements) {
    const values = [element.x, element.y, element.w, element.h];
    if (
      !values.every(Number.isFinite) ||
      element.x < -epsilon ||
      element.y < -epsilon ||
      element.w < -epsilon ||
      element.h < -epsilon
    ) {
      violations.push({
        code: "invalid-dimensions",
        elementId: element.id,
        message: `Invalid dimensions for ${element.id}.`,
      });
      continue;
    }
    if (
      element.x + element.w > SLIDE_WIDTH + epsilon ||
      element.y + element.h > SLIDE_HEIGHT + epsilon
    ) {
      violations.push({
        code: "element-out-of-bounds",
        elementId: element.id,
        message: `Element exceeds slide bounds: ${element.id}.`,
      });
    }
  }
  return violations;
}

export function assertElementsWithinBounds(elements: readonly ElementBox[]): void {
  const violations = collectBoundsViolations(elements);
  if (violations.length > 0) throw new Error(violations.map(({ message }) => message).join("\n"));
}

function hasFiniteGeometry(element: ElementBox): boolean {
  return [element.x, element.y, element.w, element.h].every(Number.isFinite);
}

function boxesOverlap(first: ElementBox, second: ElementBox, epsilon: number): boolean {
  if (!hasFiniteGeometry(first) || !hasFiniteGeometry(second)) return false;
  return (
    first.x < second.x + second.w - epsilon &&
    first.x + first.w > second.x + epsilon &&
    first.y < second.y + second.h - epsilon &&
    first.y + first.h > second.y + epsilon
  );
}

function isExpectedOverlap(first: ElementBox, second: ElementBox): boolean {
  return (
    first.layer === "background" ||
    second.layer === "background" ||
    (first.overlapGroup !== undefined && first.overlapGroup === second.overlapGroup) ||
    first.allowedOverlapWith?.includes(second.id) === true ||
    second.allowedOverlapWith?.includes(first.id) === true
  );
}

export function collectUnexpectedOverlaps(
  elements: readonly ElementBox[],
  epsilon = GEOMETRY_EPSILON,
): OverlapViolation[] {
  const violations: OverlapViolation[] = [];
  for (let firstIndex = 0; firstIndex < elements.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < elements.length; secondIndex += 1) {
      const first = elements[firstIndex];
      const second = elements[secondIndex];
      // A connector's rectangular box is only a coarse envelope around a line segment. Comparing
      // that envelope with rectangles produces false positives, so connector routing remains a
      // visual-preview/manual-review responsibility until a line-segment validator is introduced.
      if (first.kind === "connector" || second.kind === "connector") continue;
      if (boxesOverlap(first, second, epsilon) && !isExpectedOverlap(first, second)) {
        violations.push({
          firstId: first.id,
          secondId: second.id,
          message: `Unexpected overlap: ${first.id} and ${second.id}.`,
        });
      }
    }
  }
  return violations;
}

export function assertNoUnexpectedOverlap(elements: readonly ElementBox[]): void {
  const violations = collectUnexpectedOverlaps(elements);
  if (violations.length > 0) throw new Error(violations.map(({ message }) => message).join("\n"));
}
