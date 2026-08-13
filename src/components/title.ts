import { SAFE_MARGINS, THEME } from "../theme.js";
import type { PptxSlide } from "../pptx.js";
import type { ElementBox } from "../utils/bounds.js";

export function addSlideTitle(slide: PptxSlide, title: string): ElementBox[] {
  const box: ElementBox = {
    id: "slide-title",
    layer: "content",
    kind: "text",
    x: SAFE_MARGINS.left,
    y: 0.48,
    w: 12.23,
    h: 0.48,
    text: title,
    fontSize: THEME.fontSizes.slideTitle,
    minimumFontSize: THEME.fontSizes.minimum,
    fit: "shrink",
  };
  const divider: ElementBox = {
    id: "title-divider",
    layer: "decoration",
    x: SAFE_MARGINS.left,
    y: 1.12,
    w: 12.23,
    h: 0.01,
  };
  slide.addText(title, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: THEME.fonts.chinese,
    fontSize: box.fontSize,
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
  return [box, divider];
}
