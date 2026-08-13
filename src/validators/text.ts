import type { Deck, Slide, TextSection } from "../types.js";
import type { ValidationIssue } from "./types.js";

function characters(value: string): number {
  return Array.from(value).length;
}

function warning(slideId: string, code: string, message: string, path?: string): ValidationIssue {
  return { check: "text-length", code, severity: "warning", slideId, path, message };
}

function lengthIssue(
  slideId: string,
  value: string | undefined,
  maximum: number,
  code: string,
  label: string,
  path: string,
): ValidationIssue | undefined {
  if (!value || characters(value) <= maximum) return undefined;
  return warning(
    slideId,
    code,
    `${label} has ${characters(value)} characters; the preferred maximum is ${maximum}.`,
    path,
  );
}

function sectionIssues(
  slide: Slide,
  section: TextSection,
  sectionIndex: number,
  charactersPerLine: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const prefix = `slides.${slide.id}.sections.${sectionIndex}`;
  const headingIssue = lengthIssue(
    slide.id,
    section.heading,
    24,
    "section-heading-too-long",
    `Section ${sectionIndex + 1} heading`,
    `${prefix}.heading`,
  );
  if (headingIssue) issues.push(headingIssue);
  for (const [index, bullet] of (section.bullets ?? []).entries()) {
    const length = characters(bullet);
    if (length > 35)
      issues.push(
        warning(
          slide.id,
          "bullet-text-too-long",
          `Bullet ${index + 1} has ${length} characters; the preferred maximum is 35.`,
          `${prefix}.bullets.${index}`,
        ),
      );
  }
  const values = [...(section.bullets ?? []), ...(section.paragraphs ?? [])];
  const estimatedLines =
    (section.heading ? 1 : 0) +
    values.reduce(
      (sum, value) => sum + Math.max(1, Math.ceil(characters(value) / charactersPerLine)),
      0,
    );
  if (estimatedLines > 7)
    issues.push(
      warning(
        slide.id,
        "text-region-too-dense",
        `Text region ${sectionIndex + 1} is estimated at ${estimatedLines} lines; the preferred maximum is 7.`,
        prefix,
      ),
    );
  return issues;
}

function commonSlideIssues(slide: Slide): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (slide.title && characters(slide.title) > 36)
    issues.push(
      warning(
        slide.id,
        "slide-title-too-long",
        `Slide title has ${characters(slide.title)} characters; keep it concise to avoid wrapping.`,
        `slides.${slide.id}.title`,
      ),
    );
  return issues;
}

function slideTextIssues(slide: Slide): ValidationIssue[] {
  const issues = commonSlideIssues(slide);
  if (slide.layout === "title-slide") {
    const fields = [
      lengthIssue(
        slide.id,
        slide.subtitle,
        50,
        "cover-subtitle-too-long",
        "Cover subtitle",
        `slides.${slide.id}.subtitle`,
      ),
      lengthIssue(
        slide.id,
        slide.author,
        30,
        "cover-author-too-long",
        "Cover author",
        `slides.${slide.id}.author`,
      ),
      lengthIssue(
        slide.id,
        slide.affiliation,
        40,
        "cover-affiliation-too-long",
        "Cover affiliation",
        `slides.${slide.id}.affiliation`,
      ),
      lengthIssue(
        slide.id,
        slide.date,
        24,
        "cover-date-too-long",
        "Cover date",
        `slides.${slide.id}.date`,
      ),
    ];
    issues.push(...fields.filter((issue): issue is ValidationIssue => issue !== undefined));
  } else if (slide.layout === "text-slide" || slide.layout === "text-image-slide") {
    const bulletCount = slide.sections.reduce(
      (count, section) => count + (section.bullets?.length ?? 0),
      0,
    );
    if (bulletCount > 4)
      issues.push(
        warning(
          slide.id,
          "too-many-bullets",
          `Slide contains ${bulletCount} bullets; the preferred maximum is 4.`,
          `slides.${slide.id}.sections`,
        ),
      );
    const charactersPerLine =
      slide.layout === "text-image-slide" || slide.sections.length > 1 ? 27 : 55;
    slide.sections.forEach((section, index) =>
      issues.push(...sectionIssues(slide, section, index, charactersPerLine)),
    );
    if (slide.layout === "text-image-slide") {
      const captionIssue = lengthIssue(
        slide.id,
        slide.imageCaption,
        60,
        "image-caption-too-long",
        "Image caption",
        `slides.${slide.id}.imageCaption`,
      );
      if (captionIssue) issues.push(captionIssue);
    }
  } else if (slide.layout === "diagram-slide") {
    slide.diagram.nodes.forEach((node, index) => {
      const length = characters(node.label);
      if (length > 18)
        issues.push(
          warning(
            slide.id,
            "diagram-long-node-text",
            `Diagram node "${node.id}" has ${length} characters; shorten it or split the diagram.`,
            `slides.${slide.id}.diagram.nodes.${index}.label`,
          ),
        );
    });
    slide.diagram.edges.forEach((edge, index) => {
      if (edge.label && characters(edge.label) > 12)
        issues.push(
          warning(
            slide.id,
            "diagram-long-edge-label",
            `Diagram edge label has ${characters(edge.label)} characters; the preferred maximum is 12.`,
            `slides.${slide.id}.diagram.edges.${index}.label`,
          ),
        );
    });
  } else if (slide.layout === "results-slide") {
    slide.metrics?.forEach((metric, index) => {
      const metricIssues = [
        lengthIssue(
          slide.id,
          metric.label,
          18,
          "metric-label-too-long",
          `Metric ${index + 1} label`,
          `slides.${slide.id}.metrics.${index}.label`,
        ),
        lengthIssue(
          slide.id,
          metric.value,
          18,
          "metric-value-too-long",
          `Metric ${index + 1} value`,
          `slides.${slide.id}.metrics.${index}.value`,
        ),
        lengthIssue(
          slide.id,
          metric.detail,
          35,
          "metric-detail-too-long",
          `Metric ${index + 1} detail`,
          `slides.${slide.id}.metrics.${index}.detail`,
        ),
      ];
      issues.push(...metricIssues.filter((issue): issue is ValidationIssue => issue !== undefined));
    });
    const captionIssue = lengthIssue(
      slide.id,
      slide.chartCaption,
      60,
      "chart-caption-too-long",
      "Chart caption",
      `slides.${slide.id}.chartCaption`,
    );
    if (captionIssue) issues.push(captionIssue);
    if (slide.takeaway && characters(slide.takeaway) > 70)
      issues.push(
        warning(
          slide.id,
          "takeaway-too-long",
          `Takeaway has ${characters(slide.takeaway)} characters; the preferred maximum is 70.`,
        ),
      );
  }
  return issues;
}

export function validateTextDensity(deck: Deck): ValidationIssue[] {
  return deck.slides.flatMap(slideTextIssues);
}
