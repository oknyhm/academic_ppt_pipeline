import { expect, it } from "vitest";
import { generatePresentation } from "../src/generate-ppt.js";
import type { Deck } from "../src/types.js";

it("reports a missing image asset before writing a presentation", async () => {
  const deck: Deck = {
    meta: { title: "Image test" },
    slides: [
      {
        id: "missing-image",
        layout: "text-image-slide",
        title: "Missing image",
        imagePosition: "right",
        image: { path: "not-found.png", alt: "Missing test image" },
        sections: [{ bullets: ["A missing asset should fail clearly."] }],
      },
    ],
  };
  await expect(
    generatePresentation(deck, process.cwd(), "output/generated/should-not-exist.pptx"),
  ).rejects.toThrow('Missing image asset for slide "missing-image"');
});
