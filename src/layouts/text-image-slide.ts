import { addContainedImage } from "../components/image.js";
import { addSlideTitle } from "../components/title.js";
import { addTextBlock } from "../components/text-block.js";
import type { PptxSlide } from "../pptx.js";
import { SLIDE_HEIGHT, SLIDE_WIDTH, THEME } from "../theme.js";
import type { TextImageSlide } from "../types.js";
import type { ElementBox } from "../utils/bounds.js";
import type { ImageSize } from "../utils/image-fit.js";

export function renderTextImageSlide(
  slide: PptxSlide,
  content: TextImageSlide,
  imagePath: string,
  imageSize: ImageSize,
): ElementBox[] {
  const background: ElementBox = {
    id: "background",
    layer: "background",
    x: 0,
    y: 0,
    w: SLIDE_WIDTH,
    h: SLIDE_HEIGHT,
  };
  slide.addShape("rect", {
    ...background,
    fill: { color: THEME.colors.background },
    line: { color: THEME.colors.background, transparency: 100 },
  });
  const imageFrame = { x: content.imagePosition === "left" ? 0.7 : 7.25, y: 1.55, w: 5.38, h: 4.9 };
  const textX = content.imagePosition === "left" ? 6.58 : 0.7;
  const boxes = [
    background,
    ...addSlideTitle(slide, content.title),
    ...addContainedImage(
      slide,
      imagePath,
      content.image.alt,
      imageFrame,
      imageSize,
      "primary-image",
    ),
  ];
  content.sections.forEach((section, index) =>
    boxes.push(
      ...addTextBlock(slide, section, textX, 1.55 + index * 2.15, 5.98, `section-${index + 1}`),
    ),
  );
  if (content.imageCaption) {
    const caption: ElementBox = {
      id: "image-caption",
      layer: "content",
      kind: "text",
      x: imageFrame.x,
      y: 6.52,
      w: imageFrame.w,
      h: 0.2,
      text: content.imageCaption,
      fontSize: THEME.fontSizes.caption,
      minimumFontSize: THEME.fontSizes.minimum,
      fit: "shrink",
    };
    boxes.push(caption);
    slide.addText(content.imageCaption, {
      x: caption.x,
      y: caption.y,
      w: caption.w,
      h: caption.h,
      fontFace: THEME.fonts.chinese,
      fontSize: caption.fontSize,
      color: THEME.colors.textSecondary,
      align: "center",
      margin: 0,
      fit: "shrink",
    });
  }
  return boxes;
}
