import { SLIDE_HEIGHT, SLIDE_WIDTH } from "../theme.js";

export interface ElementBox {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
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
      throw new Error(`Invalid dimensions for ${element.name}.`);
    }
    if (element.x + element.w > SLIDE_WIDTH || element.y + element.h > SLIDE_HEIGHT) {
      throw new Error(`Element exceeds slide bounds: ${element.name}.`);
    }
  }
}
