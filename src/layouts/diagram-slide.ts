import { addSlideTitle } from "../components/title.js";
import type { PptxSlide } from "../pptx.js";
import { SLIDE_HEIGHT, SLIDE_WIDTH, THEME } from "../theme.js";
import type { DiagramSlide } from "../types.js";
import type { ElementBox } from "../utils/bounds.js";

export function renderDiagramSlide(slide: PptxSlide, content: DiagramSlide): ElementBox[] {
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
  const nodeCount = content.diagram.nodes.length;
  const nodeWidth = Math.min(2.1, (11.8 - (nodeCount - 1) * 0.38) / nodeCount);
  const startX = (SLIDE_WIDTH - (nodeCount * nodeWidth + (nodeCount - 1) * 0.38)) / 2;
  const nodeY = 3.0;
  content.diagram.nodes.forEach((node, index) => {
    const x = startX + index * (nodeWidth + 0.38);
    const surface: ElementBox = {
      id: `node-${node.id}-surface`,
      layer: "decoration",
      x,
      y: nodeY,
      w: nodeWidth,
      h: 1.05,
      intentionalOverlap: true,
    };
    const label: ElementBox = {
      id: `node-${node.id}-label`,
      layer: "content",
      x: x + 0.16,
      y: nodeY + 0.3,
      w: nodeWidth - 0.32,
      h: 0.4,
    };
    boxes.push(surface, label);
    slide.addShape("roundRect", {
      ...surface,
      rectRadius: 0.06,
      fill: { color: THEME.colors.surface },
      line: { color: THEME.colors.secondary, width: 1.2 },
    });
    slide.addText(node.label, {
      ...label,
      align: "center",
      valign: "mid",
      fontFace: THEME.fonts.chinese,
      fontSize: THEME.fontSizes.body,
      color: THEME.colors.textPrimary,
      margin: 0,
      fit: "shrink",
    });
    if (index < nodeCount - 1) {
      const connector: ElementBox = {
        id: `connector-${node.id}`,
        layer: "decoration",
        x: x + nodeWidth,
        y: nodeY + 0.52,
        w: 0.38,
        h: 0.01,
      };
      boxes.push(connector);
      slide.addShape("line", {
        ...connector,
        line: {
          color: THEME.colors.accent,
          width: 1.6,
          beginArrowType: "none",
          endArrowType: "triangle",
        },
      });
    }
  });
  return boxes;
}
