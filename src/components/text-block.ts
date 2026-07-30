import type { PptxSlide } from "../pptx.js";
import { THEME } from "../theme.js";
import type { TextSection } from "../types.js";
import type { ElementBox } from "../utils/bounds.js";

export function addTextBlock(
  slide: PptxSlide,
  section: TextSection,
  x: number,
  y: number,
  w: number,
  id: string,
): ElementBox[] {
  const headingHeight = section.heading ? 0.32 : 0;
  const lineCount = (section.bullets?.length ?? 0) + (section.paragraphs?.length ?? 0);
  const bodyHeight = Math.max(0.48, lineCount * 0.38);
  const boxes: ElementBox[] = [];
  if (section.heading) {
    const heading: ElementBox = {
      id: `${id}-heading`,
      layer: "content",
      x,
      y,
      w,
      h: headingHeight,
    };
    boxes.push(heading);
    slide.addText(section.heading, {
      ...heading,
      fontFace: THEME.fonts.chinese,
      fontSize: THEME.fontSizes.sectionHeading,
      bold: true,
      color: THEME.colors.secondary,
      margin: 0,
    });
  }
  const body: ElementBox = {
    id: `${id}-body`,
    layer: "content",
    x,
    y: y + headingHeight + 0.08,
    w,
    h: bodyHeight,
  };
  boxes.push(body);
  const paragraphs = [
    ...(section.bullets ?? []).map((text) => ({
      text,
      options: { bullet: { indent: 14 }, hanging: 3 },
    })),
    ...(section.paragraphs ?? []).map((text) => ({ text, options: { breakLine: true } })),
  ];
  slide.addText(paragraphs, {
    ...body,
    fontFace: THEME.fonts.chinese,
    fontSize: THEME.fontSizes.body,
    color: THEME.colors.textPrimary,
    margin: 0,
    paraSpaceAfterPt: 10,
    valign: "top",
    fit: "shrink",
  });
  return boxes;
}
