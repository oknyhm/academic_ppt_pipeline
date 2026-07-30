export interface ImageSize {
  width: number;
  height: number;
}

export interface ImageBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function assertPositiveDimensions(image: ImageSize, box: ImageBox): void {
  if (image.width <= 0 || image.height <= 0 || box.w <= 0 || box.h <= 0) {
    throw new Error("Image and container dimensions must be positive.");
  }
}

export function containImage(image: ImageSize, box: ImageBox): ImageBox {
  assertPositiveDimensions(image, box);
  const scale = Math.min(box.w / image.width, box.h / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

export function coverImage(image: ImageSize, box: ImageBox): ImageBox {
  assertPositiveDimensions(image, box);
  const scale = Math.max(box.w / image.width, box.h / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}
