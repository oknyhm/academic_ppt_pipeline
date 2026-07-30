import type { PptxSlide } from "../pptx.js";
import { SLIDE_HEIGHT, SLIDE_WIDTH, THEME } from "../theme.js";
import type { TitleSlide } from "../types.js";
import type { ElementBox } from "../utils/bounds.js";

export function renderTitleSlide(slide: PptxSlide, content: TitleSlide): ElementBox[] {
  const background: ElementBox = {
    id: "background",
    layer: "background",
    x: 0,
    y: 0,
    w: SLIDE_WIDTH,
    h: SLIDE_HEIGHT,
  };
  const accent: ElementBox = {
    id: "cover-accent",
    layer: "decoration",
    x: 0,
    y: 0,
    w: 0.22,
    h: SLIDE_HEIGHT,
  };
  const title: ElementBox = { id: "cover-title", layer: "content", x: 1.05, y: 2, w: 11.2, h: 1 };
  const subtitle: ElementBox = {
    id: "cover-subtitle",
    layer: "content",
    x: 1.05,
    y: 3.18,
    w: 11.2,
    h: 0.42,
  };
  const attribution: ElementBox = {
    id: "cover-attribution",
    layer: "content",
    x: 1.05,
    y: 4.35,
    w: 11.2,
    h: 0.65,
  };
  slide.addShape("rect", {
    ...background,
    fill: { color: THEME.colors.background },
    line: { color: THEME.colors.background, transparency: 100 },
  });
  slide.addShape("rect", {
    ...accent,
    fill: { color: THEME.colors.primary },
    line: { color: THEME.colors.primary, transparency: 100 },
  });
  slide.addText(content.title, {
    ...title,
    fontFace: THEME.fonts.chinese,
    fontSize: THEME.fontSizes.coverTitle,
    bold: true,
    color: THEME.colors.primary,
    margin: 0,
    fit: "shrink",
  });
  if (content.subtitle)
    slide.addText(content.subtitle, {
      ...subtitle,
      fontFace: THEME.fonts.chinese,
      fontSize: THEME.fontSizes.sectionHeading,
      color: THEME.colors.secondary,
      margin: 0,
      fit: "shrink",
    });
  const authorLine = [content.author, content.affiliation, content.date]
    .filter(Boolean)
    .join(" | ");
  if (authorLine)
    slide.addText(authorLine, {
      ...attribution,
      fontFace: THEME.fonts.chinese,
      fontSize: THEME.fontSizes.body,
      color: THEME.colors.textSecondary,
      margin: 0,
      fit: "shrink",
    });
  return [
    background,
    accent,
    title,
    ...(content.subtitle ? [subtitle] : []),
    ...(authorLine ? [attribution] : []),
  ];
}
