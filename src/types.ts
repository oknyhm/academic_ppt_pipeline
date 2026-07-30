import { z } from "zod";

export const LayoutNameSchema = z.enum([
  "title-slide",
  "text-slide",
  "text-image-slide",
  "diagram-slide",
  "results-slide",
]);
export type LayoutName = z.infer<typeof LayoutNameSchema>;

export const CitationSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  url: z.url().optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const AssetRefSchema = z.object({
  path: z.string().min(1),
  alt: z.string().min(1),
  source: z.string().min(1).optional(),
});
export type AssetRef = z.infer<typeof AssetRefSchema>;

export const TextSectionSchema = z
  .object({
    heading: z.string().min(1).optional(),
    bullets: z.array(z.string().min(1)).min(1).max(4).optional(),
    paragraphs: z.array(z.string().min(1)).min(1).max(3).optional(),
  })
  .refine((section) => section.bullets !== undefined || section.paragraphs !== undefined, {
    message: "A text section requires bullets or paragraphs.",
  });
export type TextSection = z.infer<typeof TextSectionSchema>;

const BaseSlideFields = {
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  speakerNotes: z.string().min(1).optional(),
  citations: z.array(z.string().min(1)).optional(),
};

export const TitleSlideSchema = z.object({
  ...BaseSlideFields,
  layout: z.literal("title-slide"),
  title: z.string().min(1),
  subtitle: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  affiliation: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
});
export type TitleSlide = z.infer<typeof TitleSlideSchema>;

export const TextSlideSchema = z.object({
  ...BaseSlideFields,
  layout: z.literal("text-slide"),
  title: z.string().min(1),
  sections: z.array(TextSectionSchema).min(1).max(2),
});
export type TextSlide = z.infer<typeof TextSlideSchema>;

export const TextImageSlideSchema = z.object({
  ...BaseSlideFields,
  layout: z.literal("text-image-slide"),
  title: z.string().min(1),
  sections: z.array(TextSectionSchema).min(1).max(2),
  image: AssetRefSchema,
  imageCaption: z.string().min(1).optional(),
  imagePosition: z.enum(["left", "right"]),
});
export type TextImageSlide = z.infer<typeof TextImageSlideSchema>;

export const DiagramNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  emphasis: z.enum(["normal", "primary", "accent", "warning"]).default("normal"),
});
export type DiagramNode = z.infer<typeof DiagramNodeSchema>;

export const DiagramEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().min(1).optional(),
});
export type DiagramEdge = z.infer<typeof DiagramEdgeSchema>;

export const DiagramSchema = z
  .object({
    kind: z.enum(["linear-process", "three-branch", "input-process-output"]),
    nodes: z.array(DiagramNodeSchema).min(2).max(7),
    edges: z.array(DiagramEdgeSchema).min(1).max(10),
  })
  .superRefine((diagram, context) => {
    const nodeIds = new Set<string>();
    diagram.nodes.forEach((node, index) => {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "id"],
          message: `Duplicate diagram node id: ${node.id}`,
        });
      }
      nodeIds.add(node.id);
    });
    diagram.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        context.addIssue({
          code: "custom",
          path: ["edges", index],
          message: `Diagram edge must reference existing node ids: ${edge.from} -> ${edge.to}`,
        });
      }
      if (edge.from === edge.to) {
        context.addIssue({
          code: "custom",
          path: ["edges", index],
          message: "Diagram edge cannot connect a node to itself.",
        });
      }
    });
    const requiredCount =
      diagram.kind === "three-branch" ? 7 : diagram.kind === "input-process-output" ? 3 : undefined;
    if (requiredCount && diagram.nodes.length !== requiredCount) {
      context.addIssue({
        code: "custom",
        path: ["nodes"],
        message: `${diagram.kind} requires exactly ${requiredCount} nodes for its fixed template.`,
      });
    }
  });
export type Diagram = z.infer<typeof DiagramSchema>;

export const DiagramSlideSchema = z.object({
  ...BaseSlideFields,
  layout: z.literal("diagram-slide"),
  title: z.string().min(1),
  diagram: DiagramSchema,
});
export type DiagramSlide = z.infer<typeof DiagramSlideSchema>;

export const MetricSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  detail: z.string().min(1).optional(),
});
export type Metric = z.infer<typeof MetricSchema>;

export const ResultsSlideSchema = z.object({
  ...BaseSlideFields,
  layout: z.literal("results-slide"),
  title: z.string().min(1),
  metrics: z.array(MetricSchema).min(1).max(4).optional(),
  chart: AssetRefSchema.optional(),
  chartCaption: z.string().min(1).optional(),
  takeaway: z.string().min(1).optional(),
});
export type ResultsSlide = z.infer<typeof ResultsSlideSchema>;

export const SlideSchema = z.discriminatedUnion("layout", [
  TitleSlideSchema,
  TextSlideSchema,
  TextImageSlideSchema,
  DiagramSlideSchema,
  ResultsSlideSchema,
]);
export type Slide = z.infer<typeof SlideSchema>;

export const DeckSchema = z
  .object({
    meta: z.object({
      title: z.string().min(1),
      language: z.enum(["zh-CN", "en-US"]).optional(),
      citations: z.array(CitationSchema).optional(),
    }),
    slides: z.array(SlideSchema).min(1),
  })
  .superRefine((deck, context) => {
    const seenIds = new Set<string>();
    deck.slides.forEach((slide, index) => {
      if (seenIds.has(slide.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate slide id: ${slide.id}`,
          path: ["slides", index, "id"],
        });
      }
      seenIds.add(slide.id);
    });
  });
export type Deck = z.infer<typeof DeckSchema>;
