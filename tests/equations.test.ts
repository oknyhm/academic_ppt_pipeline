import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { EquationFileSchema, renderLatexToSvg } from "../scripts/generate-equations.js";

describe("equation generation", () => {
  it("validates and renders the three example LaTeX formulas", async () => {
    const source = await readFile(resolve(process.cwd(), "content/equations.yaml"), "utf8");
    const input = EquationFileSchema.parse(parse(source));

    expect(input.equations).toHaveLength(3);
    for (const equation of input.equations) {
      const svg = renderLatexToSvg(equation.latex);
      expect(svg).toMatch(/^<svg/);
      expect(svg).not.toContain("<rect");
    }
  });

  it("reports invalid LaTeX clearly", () => {
    expect(() => renderLatexToSvg("\\frac{a")).toThrow("Invalid LaTeX");
  });
});
