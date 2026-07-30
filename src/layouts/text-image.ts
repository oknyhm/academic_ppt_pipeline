import { addSlideTitle } from "../components/title.js";
import { THEME } from "../theme.js";
import type { PptxSlide } from "../pptx.js";
import type { TextImageSlide } from "../types.js";
import { assertElementsWithinBounds } from "../utils/bounds.js";
import { containImage, type ImageSize } from "../utils/image-fit.js";

export function renderTextImageLayout(
  slide: PptxSlide,
  content: TextImageSlide,
  imagePath: string,
  imageSize: ImageSize,
): void {
  addSlideTitle(slide, content.title);
  const imageBox = { x: content.imagePosition === "left" ? 0.7 : 7.25, y: 1.55, w: 5.38, h: 4.9 };
  const textBox = { x: content.imagePosition === "left" ? 6.58 : 0.7, y: 1.55, w: 5.98, h: 4.7 };
  const placement = containImage(imageSize, imageBox);
  assertElementsWithinBounds([
    { name: "image frame", ...imageBox },
    { name: "image", ...placement },
    { name: "text-image body", ...textBox },
  ]);
  slide.addShape("rect", {
    ...imageBox,
    fill: { color: THEME.colors.surface },
    line: { color: THEME.colors.divider, width: 1 },
  });
  slide.addImage({ path: imagePath, altText: content.image.alt, ...placement });
  const body = content.sections
    .flatMap((section) => [
      section.heading,
      ...(section.bullets ?? []),
      ...(section.paragraphs ?? []),
    ])
    .filter((line): line is string => Boolean(line))
    .join("\n");
  slide.addText(body, {
    ...textBox,
    fontFace: THEME.fonts.chinese,
    fontSize: THEME.fontSizes.body,
    color: THEME.colors.textPrimary,
    margin: 0,
    breakLine: true,
    fit: "shrink",
    valign: "top",
  });
  if (content.imageCaption) {
    const captionBox = { name: "image caption", x: imageBox.x, y: 6.52, w: imageBox.w, h: 0.2 };
    assertElementsWithinBounds([captionBox]);
    slide.addText(content.imageCaption, {
      x: captionBox.x,
      y: captionBox.y,
      w: captionBox.w,
      h: captionBox.h,
      fontFace: THEME.fonts.chinese,
      fontSize: THEME.fontSizes.caption,
      color: THEME.colors.textSecondary,
      align: "center",
      margin: 0,
      fit: "shrink",
    });
  }
}
