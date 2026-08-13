import type { PptxSlide } from "../pptx.js";
import { THEME } from "../theme.js";
import type { ElementBox } from "../utils/bounds.js";
import { containImage, type ImageBox, type ImageSize } from "../utils/image-fit.js";

export function addContainedImage(
  slide: PptxSlide,
  path: string,
  altText: string,
  frame: ImageBox,
  size: ImageSize,
  id: string,
): ElementBox[] {
  const placement = containImage(size, frame);
  const overlapGroup = `image-${id}`;
  const frameBox: ElementBox = {
    id: `${id}-frame`,
    layer: "decoration",
    kind: "shape",
    ...frame,
    overlapGroup,
  };
  const imageBox: ElementBox = {
    id,
    layer: "content",
    kind: "image",
    ...placement,
    overlapGroup,
  };
  slide.addShape("rect", {
    ...frame,
    fill: { color: THEME.colors.surface },
    line: { color: THEME.colors.divider, width: 1 },
  });
  slide.addImage({ path, altText, ...placement });
  return [frameBox, imageBox];
}
