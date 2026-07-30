import { addMetricCard } from "../components/metric-card.js";
import { addSlideTitle } from "../components/title.js";
import type { PptxSlide } from "../pptx.js";
import { SLIDE_HEIGHT, SLIDE_WIDTH, THEME } from "../theme.js";
import type { ResultsSlide } from "../types.js";
import type { ElementBox } from "../utils/bounds.js";

export function renderResultsSlide(slide: PptxSlide, content: ResultsSlide): ElementBox[] {
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
  const boxes = [background, ...addSlideTitle(slide, content.title)];
  const metrics = content.metrics ?? [];
  const cardWidth = metrics.length <= 2 ? 3.5 : 2.72;
  const gap = 0.28;
  const totalWidth = metrics.length * cardWidth + Math.max(0, metrics.length - 1) * gap;
  const startX = (SLIDE_WIDTH - totalWidth) / 2;
  metrics.forEach((metric, index) =>
    boxes.push(
      ...addMetricCard(
        slide,
        metric,
        startX + index * (cardWidth + gap),
        2.05,
        cardWidth,
        `metric-${index + 1}`,
      ),
    ),
  );
  if (content.takeaway) {
    const takeaway: ElementBox = {
      id: "takeaway",
      layer: "overlay",
      x: 1.1,
      y: 4.35,
      w: 11.13,
      h: 0.62,
    };
    boxes.push(takeaway);
    slide.addShape("roundRect", {
      x: takeaway.x,
      y: takeaway.y,
      w: takeaway.w,
      h: takeaway.h,
      rectRadius: 0.05,
      fill: { color: THEME.colors.surface },
      line: { color: THEME.colors.divider, width: 1 },
    });
    slide.addText(content.takeaway, {
      ...takeaway,
      fontFace: THEME.fonts.chinese,
      fontSize: THEME.fontSizes.body,
      color: THEME.colors.primary,
      bold: true,
      align: "center",
      valign: "mid",
      margin: 0.08,
      fit: "shrink",
    });
  }
  return boxes;
}
