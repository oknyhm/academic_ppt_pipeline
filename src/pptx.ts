export interface PptxSlide {
  addImage(options: object): void;
  addShape(shape: string, options: object): void;
  addText(text: string | object[], options: object): void;
  background?: { color: string };
}

export interface PptxPresentation {
  author: string;
  layout: string;
  subject: string;
  theme: { bodyFontFace: string; headFontFace: string };
  title: string;
  addSlide(): PptxSlide;
  defineLayout(layout: { name: string; width: number; height: number }): void;
  writeFile(options: { compression: boolean; fileName: string }): Promise<string>;
}

export type PptxPresentationConstructor = new () => PptxPresentation;
