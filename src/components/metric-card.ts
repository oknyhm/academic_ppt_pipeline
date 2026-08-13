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
  const surfaceId = `${id}-surface`;
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const detailId = `${id}-detail`;
  const surface: ElementBox = {
    id: surfaceId,
    layer: "decoration",
    x,
    y,
    w,
    h,
    allowedOverlapWith: [labelId, valueId, ...(metric.detail ? [detailId] : [])],
  };
  const label: ElementBox = {
    id: labelId,
    layer: "content",
    kind: "text",
    x: x + 0.22,
    y: y + 0.2,
    w: w - 0.44,
    h: 0.24,
    text: metric.label,
    fontSize: THEME.fontSizes.caption,
    minimumFontSize: THEME.fontSizes.minimum,
    fit: "shrink",
    allowedOverlapWith: [surfaceId],
  };
  const value: ElementBox = {
    id: valueId,
    layer: "content",
    kind: "text",
    x: x + 0.22,
    y: y + 0.52,
    w: w - 0.44,
    h: 0.4,
    text: metric.value,
    fontSize: 24,
    minimumFontSize: THEME.fontSizes.minimum,
    fit: "shrink",
    allowedOverlapWith: [surfaceId],
  };
  const detail: ElementBox | undefined = metric.detail
    ? {
        id: detailId,
        layer: "content",
        kind: "text",
        x: x + 0.22,
        y: y + 1.02,
        w: w - 0.44,
        h: 0.2,
        text: metric.detail,
        fontSize: THEME.fontSizes.caption,
        minimumFontSize: THEME.fontSizes.minimum,
        fit: "shrink",
        allowedOverlapWith: [surfaceId],
      }
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
    x: label.x,
    y: label.y,
    w: label.w,
    h: label.h,
    fontFace: THEME.fonts.chinese,
    fontSize: label.fontSize,
    color: THEME.colors.textSecondary,
    margin: 0,
    fit: "shrink",
  });
  slide.addText(metric.value, {
    x: value.x,
    y: value.y,
    w: value.w,
    h: value.h,
    fontFace: THEME.fonts.english,
    fontSize: value.fontSize,
    bold: true,
    color: THEME.colors.primary,
    margin: 0,
    fit: "shrink",
  });
  if (detail)
    slide.addText(metric.detail ?? "", {
      x: detail.x,
      y: detail.y,
      w: detail.w,
      h: detail.h,
      fontFace: THEME.fonts.chinese,
      fontSize: detail.fontSize,
      color: THEME.colors.textSecondary,
      margin: 0,
      fit: "shrink",
    });
  return detail ? [surface, label, value, detail] : [surface, label, value];
}
