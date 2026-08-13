import { addMetricCard } from "../components/metric-card.js";
import { addContainedImage } from "../components/image.js";
import { addSlideTitle } from "../components/title.js";
import type { PptxSlide } from "../pptx.js";
import { SLIDE_HEIGHT, SLIDE_WIDTH, THEME } from "../theme.js";
import type { ResultsSlide } from "../types.js";
import type { ElementBox } from "../utils/bounds.js";
import type { ImageSize } from "../utils/image-fit.js";

export function renderResultsSlide(
  slide: PptxSlide,
  content: ResultsSlide,
  chart?: { path: string; size: ImageSize },
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
  const boxes = [background, ...addSlideTitle(slide, content.title)];
  const metrics = content.metrics ?? [];
  const cardWidth = chart ? 3.7 : metrics.length <= 2 ? 3.5 : 2.72;
  const gap = 0.28;
  const totalWidth = metrics.length * cardWidth + Math.max(0, metrics.length - 1) * gap;
  const startX = chart ? 0.7 : (SLIDE_WIDTH - totalWidth) / 2;
  metrics.forEach((metric, index) => {
    const x = chart ? startX : startX + index * (cardWidth + gap);
    const y = chart ? 1.65 + index * 1.6 : 2.05;
    boxes.push(...addMetricCard(slide, metric, x, y, cardWidth, `metric-${index + 1}`));
  });
  if (chart) {
    const frame = { x: 5.0, y: 1.55, w: 7.55, h: 4.65 };
    boxes.push(
      ...addContainedImage(
        slide,
        chart.path,
        content.chart?.alt ?? "Research chart",
        frame,
        chart.size,
        "results-chart",
      ),
    );
    if (content.chartCaption) {
      const caption: ElementBox = {
        id: "chart-caption",
        layer: "content",
        kind: "text",
        x: frame.x,
        y: 6.25,
        w: frame.w,
        h: 0.18,
        text: content.chartCaption,
        fontSize: THEME.fontSizes.caption,
        minimumFontSize: THEME.fontSizes.minimum,
        fit: "shrink",
      };
      boxes.push(caption);
      slide.addText(content.chartCaption, {
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
  }
  if (content.takeaway) {
    const takeaway: ElementBox = {
      id: "takeaway",
      layer: "overlay",
      kind: "text",
      x: 1.1,
      y: chart ? 6.47 : 4.35,
      w: 11.13,
      h: chart ? 0.32 : 0.62,
      text: content.takeaway,
      fontSize: THEME.fontSizes.body,
      minimumFontSize: THEME.fontSizes.minimum,
      fit: "shrink",
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
      x: takeaway.x,
      y: takeaway.y,
      w: takeaway.w,
      h: takeaway.h,
      fontFace: THEME.fonts.chinese,
      fontSize: takeaway.fontSize,
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
