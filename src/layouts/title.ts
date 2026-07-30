import { SLIDE_HEIGHT, SLIDE_WIDTH, THEME } from "../theme.js";
import type { PptxSlide } from "../pptx.js";
import type { TitleSlide } from "../types.js";
import { assertElementsWithinBounds } from "../utils/bounds.js";

export function renderTitleLayout(slide: PptxSlide, content: TitleSlide): void {
  const titleBox = { name: "cover title", x: 1.05, y: 2, w: 11.2, h: 1 };
  const subtitleBox = { name: "cover subtitle", x: 1.05, y: 3.18, w: 11.2, h: 0.42 };
  const authorBox = { name: "cover attribution", x: 1.05, y: 4.35, w: 11.2, h: 0.65 };
  assertElementsWithinBounds([titleBox, subtitleBox, authorBox]);
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH,
    h: SLIDE_HEIGHT,
    fill: { color: THEME.colors.background },
    line: { color: THEME.colors.background, transparency: 100 },
  });
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 0.22,
    h: SLIDE_HEIGHT,
    fill: { color: THEME.colors.primary },
    line: { color: THEME.colors.primary, transparency: 100 },
  });
  slide.addText(content.title, {
    ...titleBox,
    fontFace: THEME.fonts.chinese,
    fontSize: THEME.fontSizes.coverTitle,
    bold: true,
    color: THEME.colors.primary,
    margin: 0,
    fit: "shrink",
  });
  if (content.subtitle)
    slide.addText(content.subtitle, {
      ...subtitleBox,
      fontFace: THEME.fonts.chinese,
      fontSize: THEME.fontSizes.sectionHeading,
      color: THEME.colors.secondary,
      margin: 0,
      fit: "shrink",
    });
  const attribution = [content.author, content.affiliation, content.date]
    .filter(Boolean)
    .join(" | ");
  if (attribution)
    slide.addText(attribution, {
      ...authorBox,
      fontFace: THEME.fonts.chinese,
      fontSize: THEME.fontSizes.body,
      color: THEME.colors.textSecondary,
      margin: 0,
      fit: "shrink",
    });
}
