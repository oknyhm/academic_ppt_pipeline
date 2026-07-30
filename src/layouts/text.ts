import { addSlideTitle } from "../components/title.js";
import { SAFE_MARGINS, THEME } from "../theme.js";
import type { PptxSlide } from "../pptx.js";
import type { TextSection, TextSlide } from "../types.js";
import { assertElementsWithinBounds } from "../utils/bounds.js";

function addTextSection(
  slide: PptxSlide,
  section: TextSection,
  x: number,
  y: number,
  w: number,
): void {
  const headingHeight = section.heading ? 0.32 : 0;
  const lines = (section.bullets?.length ?? 0) + (section.paragraphs?.length ?? 0);
  const box = { name: "text section", x, y, w, h: headingHeight + Math.max(0.48, lines * 0.38) };
  assertElementsWithinBounds([box]);
  if (section.heading)
    slide.addText(section.heading, {
      x,
      y,
      w,
      h: headingHeight,
      fontFace: THEME.fonts.chinese,
      fontSize: THEME.fontSizes.sectionHeading,
      bold: true,
      color: THEME.colors.secondary,
      margin: 0,
    });
  const paragraphs = [
    ...(section.bullets ?? []).map((text) => ({
      text,
      options: { bullet: { indent: 14 }, hanging: 3 },
    })),
    ...(section.paragraphs ?? []).map((text) => ({ text, options: { breakLine: true } })),
  ];
  slide.addText(paragraphs, {
    x,
    y: y + headingHeight + 0.08,
    w,
    h: box.h - headingHeight,
    fontFace: THEME.fonts.chinese,
    fontSize: THEME.fontSizes.body,
    color: THEME.colors.textPrimary,
    margin: 0,
    paraSpaceAfterPt: 10,
    valign: "top",
    fit: "shrink",
  });
}

export function renderTextLayout(slide: PptxSlide, content: TextSlide): void {
  addSlideTitle(slide, content.title);
  const sectionWidth = content.sections.length === 1 ? 12.23 : 5.91;
  content.sections.forEach((section, index) =>
    addTextSection(
      slide,
      section,
      SAFE_MARGINS.left + index * (sectionWidth + 0.4),
      1.52,
      sectionWidth,
    ),
  );
}
