import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertSafeCliOutputPath } from "../src/generate-ppt.js";

describe("generated output boundary", () => {
  it("accepts output/generated and rejects the manual edit boundary", () => {
    expect(assertSafeCliOutputPath("output/generated/custom.pptx")).toBe(
      resolve("output/generated/custom.pptx"),
    );
    expect(() => assertSafeCliOutputPath("output/final-edited.pptx")).toThrow(
      /reserved for manual edits/i,
    );
    expect(() => assertSafeCliOutputPath("sample.pptx")).toThrow(/must stay under/i);
  });
});
