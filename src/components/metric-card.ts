import type { PptxSlide } from "../pptx.js";
import { THEME } from "../theme.js";
import type { Metric } from "../types.js";
import type { ElementBox } from "../utils/bounds.js";

export function addMetricCard(
  slide: PptxSlide,
  metric: Metric,
  x: number,
  y: number,
  w: number,
  id: string,
): ElementBox[] {
  const h = 1.45;
  const surface: ElementBox = {
    id: `${id}-surface`,
    layer: "decoration",
    x,
    y,
    w,
    h,
    intentionalOverlap: true,
  };
  const label: ElementBox = {
    id: `${id}-label`,
    layer: "content",
    x: x + 0.22,
    y: y + 0.2,
    w: w - 0.44,
    h: 0.24,
  };
  const value: ElementBox = {
    id: `${id}-value`,
    layer: "content",
    x: x + 0.22,
    y: y + 0.52,
    w: w - 0.44,
    h: 0.4,
  };
  const detail: ElementBox | undefined = metric.detail
    ? { id: `${id}-detail`, layer: "content", x: x + 0.22, y: y + 1.02, w: w - 0.44, h: 0.2 }
    : undefined;
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    fill: { color: THEME.colors.surface },
    line: { color: THEME.colors.divider, width: 1 },
  });
  slide.addText(metric.label, {
    ...label,
    fontFace: THEME.fonts.chinese,
    fontSize: THEME.fontSizes.caption,
    color: THEME.colors.textSecondary,
    margin: 0,
    fit: "shrink",
  });
  slide.addText(metric.value, {
    ...value,
    fontFace: THEME.fonts.english,
    fontSize: 24,
    bold: true,
    color: THEME.colors.primary,
    margin: 0,
    fit: "shrink",
  });
  if (detail)
    slide.addText(metric.detail ?? "", {
      ...detail,
      fontFace: THEME.fonts.chinese,
      fontSize: THEME.fontSizes.caption,
      color: THEME.colors.textSecondary,
      margin: 0,
      fit: "shrink",
    });
  return detail ? [surface, label, value, detail] : [surface, label, value];
}
