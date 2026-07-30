import type { PptxSlide } from "../pptx.js";
import { THEME } from "../theme.js";
import type { ElementBox } from "../utils/bounds.js";

export interface NodePosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function addArrowConnector(
  slide: PptxSlide,
  id: string,
  from: NodePosition,
  to: NodePosition,
  label?: string,
): ElementBox[] {
  const startX = from.x + from.w;
  const startY = from.y + from.h / 2;
  const endX = to.x;
  const endY = to.y + to.h / 2;
  const flipH = endX < startX;
  const flipV = endY < startY;
  const connector: ElementBox = {
    id: `connector-${id}`,
    layer: "decoration",
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    w: Math.abs(endX - startX),
    h: Math.max(0.01, Math.abs(endY - startY)),
    intentionalOverlap: true,
  };
  slide.addShape("line", {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    w: Math.abs(endX - startX),
    h: Math.max(0.01, Math.abs(endY - startY)),
    flipH,
    flipV,
    line: {
      color: THEME.colors.accent,
      width: 1.6,
      beginArrowType: "none",
      endArrowType: "triangle",
    },
  });
  if (!label) return [connector];
  const labelBox: ElementBox = {
    id: `connector-${id}-label`,
    layer: "overlay",
    x: (startX + endX) / 2 - 0.55,
    y: (startY + endY) / 2 - 0.28,
    w: 1.1,
    h: 0.18,
    intentionalOverlap: true,
  };
  slide.addText(label, {
    ...labelBox,
    fontFace: THEME.fonts.chinese,
    fontSize: THEME.fontSizes.caption,
    color: THEME.colors.textSecondary,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  return [connector, labelBox];
}
