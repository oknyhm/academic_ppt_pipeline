import { SAFE_MARGINS, SLIDE_HEIGHT, SLIDE_WIDTH, THEME } from "../theme.js";
import type { PptxSlide } from "../pptx.js";
import type { ElementBox } from "../utils/bounds.js";

export function addFooter(slide: PptxSlide, deckTitle: string, pageNumber: number): ElementBox[] {
  const footerBox = {
    id: "footer-title",
    layer: "content" as const,
    x: SAFE_MARGINS.left,
    y: SLIDE_HEIGHT - SAFE_MARGINS.bottom - 0.18,
    w: 10.9,
    h: 0.14,
  };
  const pageBox = {
    id: "page-number",
    layer: "content" as const,
    x: SLIDE_WIDTH - SAFE_MARGINS.right - 0.45,
    y: footerBox.y,
    w: 0.45,
    h: footerBox.h,
  };
  const divider: ElementBox = {
    id: "footer-divider",
    layer: "decoration",
    x: SAFE_MARGINS.left,
    y: footerBox.y - 0.08,
    w: SLIDE_WIDTH - SAFE_MARGINS.left - SAFE_MARGINS.right,
    h: 0.01,
  };
  slide.addShape("line", {
    x: SAFE_MARGINS.left,
    y: footerBox.y - 0.08,
    w: SLIDE_WIDTH - SAFE_MARGINS.left - SAFE_MARGINS.right,
    h: 0,
    line: { color: THEME.colors.divider, width: 0.5 },
  });
  slide.addText(deckTitle, {
    x: footerBox.x,
    y: footerBox.y,
    w: footerBox.w,
    h: footerBox.h,
    fontFace: THEME.fonts.english,
    fontSize: THEME.fontSizes.footer,
    color: THEME.colors.textSecondary,
    margin: 0,
    fit: "shrink",
  });
  slide.addText(String(pageNumber), {
    x: pageBox.x,
    y: pageBox.y,
    w: pageBox.w,
    h: pageBox.h,
    align: "right",
    fontFace: THEME.fonts.english,
    fontSize: THEME.fontSizes.footer,
    color: THEME.colors.textSecondary,
    margin: 0,
  });
  return [footerBox, pageBox, divider];
}
