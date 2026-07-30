import { SAFE_MARGINS, THEME } from "../theme.js";
import type { PptxSlide } from "../pptx.js";
import { assertElementsWithinBounds } from "../utils/bounds.js";

export function addSlideTitle(slide: PptxSlide, title: string): void {
  const box = { name: "slide title", x: SAFE_MARGINS.left, y: 0.48, w: 12.23, h: 0.48 };
  assertElementsWithinBounds([box]);
  slide.addText(title, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: THEME.fonts.chinese,
    fontSize: THEME.fontSizes.slideTitle,
    bold: true,
    color: THEME.colors.primary,
    margin: 0,
    fit: "shrink",
  });
  slide.addShape("line", {
    x: SAFE_MARGINS.left,
    y: 1.12,
    w: 12.23,
    h: 0,
    line: { color: THEME.colors.divider, width: 1 },
  });
}
