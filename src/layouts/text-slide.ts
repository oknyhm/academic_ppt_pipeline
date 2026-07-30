import { addSlideTitle } from "../components/title.js";
import { addTextBlock } from "../components/text-block.js";
import type { PptxSlide } from "../pptx.js";
import { SAFE_MARGINS, SLIDE_HEIGHT, SLIDE_WIDTH, THEME } from "../theme.js";
import type { TextSlide } from "../types.js";
import type { ElementBox } from "../utils/bounds.js";

export function renderTextSlide(slide: PptxSlide, content: TextSlide): ElementBox[] {
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
  const sectionWidth = content.sections.length === 1 ? 12.23 : 5.91;
  const boxes = [background, ...addSlideTitle(slide, content.title)];
  content.sections.forEach((section, index) =>
    boxes.push(
      ...addTextBlock(
        slide,
        section,
        SAFE_MARGINS.left + index * (sectionWidth + 0.4),
        1.52,
        sectionWidth,
        `section-${index + 1}`,
      ),
    ),
  );
  return boxes;
}
