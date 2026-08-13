import type { PptxSlide } from "../pptx.js";
import { SLIDE_HEIGHT, SLIDE_WIDTH, THEME } from "../theme.js";
import type { TitleSlide } from "../types.js";
import type { ElementBox } from "../utils/bounds.js";
import { containImage, type ImageSize } from "../utils/image-fit.js";

export function renderTitleSlide(
  slide: PptxSlide,
  content: TitleSlide,
  illustration?: { path: string; size: ImageSize; alt: string },
): ElementBox[] {
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
  const title: ElementBox = {
    id: "cover-title",
    layer: "content",
    kind: "text",
    x: 1.05,
    y: 2,
    w: illustration ? 5.75 : 11.2,
    h: 1,
    text: content.title,
    fontSize: THEME.fontSizes.coverTitle,
    minimumFontSize: THEME.fontSizes.minimum,
    fit: "shrink",
  };
  const subtitle: ElementBox = {
    id: "cover-subtitle",
    layer: "content",
    kind: "text",
    x: 1.05,
    y: 3.18,
    w: illustration ? 5.75 : 11.2,
    h: 0.42,
    text: content.subtitle,
    fontSize: THEME.fontSizes.sectionHeading,
    minimumFontSize: THEME.fontSizes.minimum,
    fit: "shrink",
  };
  const attribution: ElementBox = {
    id: "cover-attribution",
    layer: "content",
    kind: "text",
    x: 1.05,
    y: 4.35,
    w: illustration ? 5.75 : 11.2,
    h: 0.65,
    fontSize: THEME.fontSizes.body,
    minimumFontSize: THEME.fontSizes.minimum,
    fit: "shrink",
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
    x: title.x,
    y: title.y,
    w: title.w,
    h: title.h,
    fontFace: THEME.fonts.chinese,
    fontSize: title.fontSize,
    bold: true,
    color: THEME.colors.primary,
    margin: 0,
    fit: "shrink",
  });
  if (content.subtitle)
    slide.addText(content.subtitle, {
      x: subtitle.x,
      y: subtitle.y,
      w: subtitle.w,
      h: subtitle.h,
      fontFace: THEME.fonts.chinese,
      fontSize: subtitle.fontSize,
      color: THEME.colors.secondary,
      margin: 0,
      fit: "shrink",
    });
  const authorLine = [content.author, content.affiliation, content.date]
    .filter(Boolean)
    .join(" | ");
  attribution.text = authorLine;
  if (authorLine)
    slide.addText(authorLine, {
      x: attribution.x,
      y: attribution.y,
      w: attribution.w,
      h: attribution.h,
      fontFace: THEME.fonts.chinese,
      fontSize: attribution.fontSize,
      color: THEME.colors.textSecondary,
      margin: 0,
      fit: "shrink",
    });
  const illustrationBox: ElementBox | undefined = illustration
    ? {
        id: "cover-illustration",
        layer: "decoration",
        kind: "image",
        x: 7.15,
        y: 0.75,
        w: 5.75,
        h: 6,
      }
    : undefined;
  if (illustration && illustrationBox) {
    slide.addImage({
      path: illustration.path,
      ...containImage(illustration.size, illustrationBox),
      transparency: 3,
    });
  }
  return [
    background,
    accent,
    ...(illustrationBox ? [illustrationBox] : []),
    title,
    ...(content.subtitle ? [subtitle] : []),
    ...(authorLine ? [attribution] : []),
  ];
}
