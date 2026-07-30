import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../theme.js";

export interface ElementBox {
  id: string;
  layer: "background" | "decoration" | "content" | "overlay";
  x: number;
  y: number;
  w: number;
  h: number;
  intentionalOverlap?: boolean;
}

export function assertElementsWithinBounds(elements: readonly ElementBox[]): void {
  for (const element of elements) {
    const values = [element.x, element.y, element.w, element.h];
    if (
      !values.every(Number.isFinite) ||
      element.x < 0 ||
      element.y < 0 ||
      element.w < 0 ||
      element.h < 0
    ) {
      throw new Error(`Invalid dimensions for ${element.id}.`);
    }
    if (element.x + element.w > SLIDE_WIDTH || element.y + element.h > SLIDE_HEIGHT) {
      throw new Error(`Element exceeds slide bounds: ${element.id}.`);
    }
  }
}

function boxesOverlap(first: ElementBox, second: ElementBox): boolean {
  return (
    first.x < second.x + second.w &&
    first.x + first.w > second.x &&
    first.y < second.y + second.h &&
    first.y + first.h > second.y
  );
}

function isExpectedOverlap(first: ElementBox, second: ElementBox): boolean {
  return (
    first.layer === "background" ||
    second.layer === "background" ||
    first.intentionalOverlap === true ||
    second.intentionalOverlap === true
  );
}

export function assertNoUnexpectedOverlap(elements: readonly ElementBox[]): void {
  for (let firstIndex = 0; firstIndex < elements.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < elements.length; secondIndex += 1) {
      const first = elements[firstIndex];
      const second = elements[secondIndex];
      if (boxesOverlap(first, second) && !isExpectedOverlap(first, second)) {
        throw new Error(`Unexpected overlap: ${first.id} and ${second.id}.`);
      }
    }
  }
}
