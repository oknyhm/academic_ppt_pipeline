import { addArrowConnector, type NodePosition } from "../components/connector.js";
import { addProcessNode } from "../components/process-node.js";
import { addSlideTitle } from "../components/title.js";
import type { PptxSlide } from "../pptx.js";
import { SLIDE_HEIGHT, SLIDE_WIDTH, THEME } from "../theme.js";
import type { Diagram, DiagramSlide } from "../types.js";
import type { ElementBox } from "../utils/bounds.js";

function linearPositions(diagram: Diagram): Map<string, NodePosition> {
  const gap = 0.28;
  const width = Math.min(2.1, (12.1 - gap * (diagram.nodes.length - 1)) / diagram.nodes.length);
  const totalWidth = diagram.nodes.length * width + (diagram.nodes.length - 1) * gap;
  const startX = (SLIDE_WIDTH - totalWidth) / 2;
  return new Map(
    diagram.nodes.map((node, index) => [
      node.id,
      { x: startX + index * (width + gap), y: 3.05, w: width, h: 0.95 },
    ]),
  );
}

function inputProcessOutputPositions(diagram: Diagram): Map<string, NodePosition> {
  const positions = [
    { x: 1.0, y: 3.0, w: 2.7, h: 1.0 },
    { x: 5.32, y: 3.0, w: 2.7, h: 1.0 },
    { x: 9.64, y: 3.0, w: 2.7, h: 1.0 },
  ];
  return new Map(diagram.nodes.map((node, index) => [node.id, positions[index]]));
}

function threeBranchPositions(diagram: Diagram): Map<string, NodePosition> {
  const positions = [
    { x: 0.5, y: 3.05, w: 1.45, h: 0.85 },
    { x: 2.3, y: 3.05, w: 1.75, h: 0.85 },
    { x: 4.45, y: 1.65, w: 2.0, h: 0.72 },
    { x: 4.45, y: 3.1, w: 2.0, h: 0.72 },
    { x: 4.45, y: 4.55, w: 2.0, h: 0.72 },
    { x: 7.1, y: 3.1, w: 1.95, h: 0.85 },
    { x: 10.0, y: 3.1, w: 2.45, h: 0.85 },
  ];
  return new Map(diagram.nodes.map((node, index) => [node.id, positions[index]]));
}

function fixedTemplatePositions(diagram: Diagram): Map<string, NodePosition> {
  switch (diagram.kind) {
    case "linear-process":
      return linearPositions(diagram);
    case "input-process-output":
      return inputProcessOutputPositions(diagram);
    case "three-branch":
      return threeBranchPositions(diagram);
  }
}

export function getDiagramTextWarnings(slideId: string, diagram: Diagram): string[] {
  return diagram.nodes
    .filter((node) => Array.from(node.label).length > 18)
    .map(
      (node) =>
        `Slide "${slideId}" node "${node.id}" has long text (${Array.from(node.label).length} characters); shorten it or split the diagram.`,
    );
}

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
  const positions = fixedTemplatePositions(content.diagram);
  for (const edge of content.diagram.edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to)
      throw new Error(`Diagram layout is missing a position for edge ${edge.from} -> ${edge.to}.`);
    boxes.push(...addArrowConnector(slide, `${edge.from}-${edge.to}`, from, to, edge.label));
  }
  for (const node of content.diagram.nodes) {
    const position = positions.get(node.id);
    if (!position) throw new Error(`Diagram layout is missing a position for node ${node.id}.`);
    boxes.push(...addProcessNode(slide, node, position.x, position.y, position.w, position.h));
  }
  return boxes;
}
