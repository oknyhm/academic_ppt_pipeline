import type { PptxSlide } from "../pptx.js";
import { THEME } from "../theme.js";
import type { DiagramNode } from "../types.js";
import type { ElementBox } from "../utils/bounds.js";

interface NodeStyle {
  fill: string;
  line: string;
  text: string;
}

const NODE_STYLES: Record<DiagramNode["emphasis"], NodeStyle> = {
  normal: {
    fill: THEME.colors.surface,
    line: THEME.colors.secondary,
    text: THEME.colors.textPrimary,
  },
  primary: { fill: THEME.colors.primary, line: THEME.colors.primary, text: THEME.colors.surface },
  accent: {
    fill: THEME.colors.accent,
    line: THEME.colors.secondary,
    text: THEME.colors.textPrimary,
  },
  warning: { fill: THEME.colors.warning, line: THEME.colors.warning, text: THEME.colors.surface },
};

export function addProcessNode(
  slide: PptxSlide,
  node: DiagramNode,
  x: number,
  y: number,
  w: number,
  h: number,
): ElementBox[] {
  const style = NODE_STYLES[node.emphasis];
  const overlapGroup = `process-node-${node.id}`;
  const surface: ElementBox = {
    id: `node-${node.id}-surface`,
    layer: "decoration",
    x,
    y,
    w,
    h,
    overlapGroup,
  };
  const label: ElementBox = {
    id: `node-${node.id}-label`,
    layer: "content",
    kind: "text",
    x: x + 0.12,
    y: y + 0.18,
    w: w - 0.24,
    h: h - 0.36,
    text: node.label,
    fontSize: THEME.fontSizes.body,
    minimumFontSize: THEME.fontSizes.minimum,
    fit: "shrink",
    overlapGroup,
  };
  slide.addShape("roundRect", {
    ...surface,
    rectRadius: 0.06,
    fill: { color: style.fill },
    line: { color: style.line, width: 1.2 },
  });
  slide.addText(node.label, {
    x: label.x,
    y: label.y,
    w: label.w,
    h: label.h,
    align: "center",
    valign: "mid",
    fontFace: THEME.fonts.chinese,
    fontSize: label.fontSize,
    color: style.text,
    margin: 0,
    fit: "shrink",
  });
  return [surface, label];
}
