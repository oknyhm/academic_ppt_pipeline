import { getDiagramTextWarnings } from "./layouts/diagram-slide.js";
import type { Slide } from "./types.js";

export interface ValidationWarning {
  code: "diagram-long-node-text";
  slideId: string;
  message: string;
}

export function getSlideWarnings(slide: Slide): ValidationWarning[] {
  if (slide.layout !== "diagram-slide") return [];
  return getDiagramTextWarnings(slide.id, slide.diagram).map((message) => ({
    code: "diagram-long-node-text",
    slideId: slide.id,
    message,
  }));
}
