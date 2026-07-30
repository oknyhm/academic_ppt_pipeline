import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { z } from "zod";
import { parse } from "yaml";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_SOURCE_PATH = resolve(PROJECT_ROOT, "content/equations.yaml");
const DEFAULT_OUTPUT_DIR = resolve(PROJECT_ROOT, "assets/equations");

export const EquationDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Equation id must be lowercase kebab-case."),
  latex: z.string().min(1),
  description: z.string().min(1).optional(),
});

export const EquationFileSchema = z
  .object({ equations: z.array(EquationDefinitionSchema).min(1) })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    value.equations.forEach((equation, index) => {
      if (ids.has(equation.id)) {
        context.addIssue({
          code: "custom",
          path: ["equations", index, "id"],
          message: `Duplicate equation id: ${equation.id}`,
        });
      }
      ids.add(equation.id);
    });
  });

export type EquationDefinition = z.infer<typeof EquationDefinitionSchema>;

interface EquationManifestEntry {
  latex: string;
  sha256: string;
  svg: string;
}

interface EquationManifest {
  source: string;
  transparentBackground: true;
  equations: Record<string, EquationManifestEntry>;
}

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const inputJax = new TeX({ packages: AllPackages });
const outputJax = new SVG({ fontCache: "none" });
const document = mathjax.document("", { InputJax: inputJax, OutputJax: outputJax });

function hashLatex(latex: string): string {
  return createHash("sha256").update(latex, "utf8").digest("hex");
}

export function renderLatexToSvg(latex: string): string {
  try {
    const node = document.convert(latex, { display: true });
    const rendered = adaptor.outerHTML(node);
    if (rendered.includes('data-mml-node="merror"')) {
      throw new Error("MathJax could not parse the expression.");
    }
    const svg = rendered.match(/<svg[\s\S]*<\/svg>/)?.[0];
    if (!svg || svg.includes("<rect")) {
      throw new Error("MathJax did not return a transparent SVG formula.");
    }
    return svg;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid LaTeX "${latex}": ${message}`);
  }
}

async function outputExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function readManifest(path: string): Promise<EquationManifest> {
  if (!(await outputExists(path))) {
    return { source: "content/equations.yaml", transparentBackground: true, equations: {} };
  }
  return JSON.parse(await readFile(path, "utf8")) as EquationManifest;
}

export async function generateEquations(
  sourcePath = DEFAULT_SOURCE_PATH,
  outputDir = DEFAULT_OUTPUT_DIR,
): Promise<{ generated: string[]; skipped: string[] }> {
  const input = EquationFileSchema.parse(parse(await readFile(sourcePath, "utf8")));
  await mkdir(outputDir, { recursive: true });
  const manifestPath = resolve(outputDir, "manifest.json");
  const previousManifest = await readManifest(manifestPath);
  const nextManifest: EquationManifest = {
    source: "content/equations.yaml",
    transparentBackground: true,
    equations: {},
  };
  const generated: string[] = [];
  const skipped: string[] = [];

  for (const equation of input.equations) {
    const svgPath = resolve(outputDir, `${equation.id}.svg`);
    const svg = `assets/equations/${equation.id}.svg`;
    const sha256 = hashLatex(equation.latex);
    const previous = previousManifest.equations[equation.id];
    if (previous?.sha256 === sha256 && previous.svg === svg && (await outputExists(svgPath))) {
      skipped.push(equation.id);
    } else {
      await writeFile(svgPath, renderLatexToSvg(equation.latex), "utf8");
      generated.push(equation.id);
    }
    nextManifest.equations[equation.id] = { latex: equation.latex, sha256, svg };
  }
  await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
  return { generated, skipped };
}

async function main(): Promise<void> {
  const result = await generateEquations();
  for (const id of result.generated) console.log(`Generated assets/equations/${id}.svg`);
  for (const id of result.skipped) console.log(`Skipped unchanged assets/equations/${id}.svg`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(
      `Equation generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
