import { renderDiagramSlide } from "./diagram-slide.js";
import { renderResultsSlide } from "./results-slide.js";
import { renderTextImageSlide } from "./text-image-slide.js";
import { renderTextSlide } from "./text-slide.js";
import { renderTitleSlide } from "./title-slide.js";
import type { PptxSlide } from "../pptx.js";
import type { Slide } from "../types.js";
import type { ElementBox } from "../utils/bounds.js";
import type { ImageSize } from "../utils/image-fit.js";

export interface RenderContext {
  images: ReadonlyMap<string, { path: string; size: ImageSize }>;
}

export function renderLayout(
  slide: PptxSlide,
  content: Slide,
  context: RenderContext,
): ElementBox[] {
  switch (content.layout) {
    case "title-slide":
      return renderTitleSlide(slide, content);
    case "text-slide":
      return renderTextSlide(slide, content);
    case "text-image-slide": {
      const image = context.images.get(content.id);
      if (!image) throw new Error(`Image preflight failed for slide "${content.id}".`);
      return renderTextImageSlide(slide, content, image.path, image.size);
    }
    case "diagram-slide":
      return renderDiagramSlide(slide, content);
    case "results-slide":
      return renderResultsSlide(slide, content);
  }
}
