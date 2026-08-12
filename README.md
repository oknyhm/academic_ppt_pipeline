# Structured Academic PPT Pipeline

一个以结构化 YAML 内容驱动的学术 PowerPoint 构建项目。当前版本可验证 YAML，并生成含可编辑标题、正文、页脚和页码的最小 PowerPoint。

## Prerequisites

- Node.js 22 或更高版本
- npm 10 或更高版本
- Windows 11 / PowerShell（主要开发环境）

## Quick start

```powershell
npm install
npm run validate
npm run build
npm run typecheck
npm run lint
npm test
```

默认输入为 `content/deck.yaml`。也可验证其他文件：

```powershell
npx tsx src/cli.ts validate path/to/deck.yaml
```

## Current scope

- YAML 解析与 Zod Deck/Slide schema 验证
- 标题、文本、文本-图片、原生图示、结果五种语义页面类型
- 重复页面 ID 检查与页面摘要输出
- TypeScript、ESLint、Prettier 和 Vitest 工具链

`npm run build` 会生成 `output/generated/sample.pptx`。当前支持 `title`、`text` 和 `text-image` 布局；`text-image` 只接受本地 PNG/JPEG 文件，缺失资产会中止构建并显示其绝对路径。

当前不包含图像 API、LaTeX/MathJax、Mermaid、LibreOffice、图表、公式、流程图或复杂动画。

> Current implementation note: the two preceding scaffold-era sentences are obsolete. The project now supports all five registered layouts, PNG/JPEG/SVG assets, reproducible charts, MathJax equations, and native diagrams. AI illustrations are optional only; they are not part of `npm run build` and are never used as technical evidence.

## Project conventions

- 规范内容文件为 `content/deck.yaml`。
- 页面通过稳定的 `id` 和 `type` 声明，不在 YAML 中写入坐标。
- 未来生成的 `.pptx` 只能写入 `output/generated/`，不得覆盖 `output/final-edited.pptx`。

## Layout system

Slides declare a stable `id`, a semantic `layout` name, and layout-specific content only. The sample deck covers `title-slide`, `text-slide`, `text-image-slide`, `diagram-slide`, and `results-slide`. Layouts own all coordinates and return layered element metadata (`background`, `decoration`, `content`, `overlay`) for bounds and overlap validation.

## Research charts

Chart source data is stored under `data/`; `scripts/generate_charts.py` validates required columns, missing values, and numeric fields before generating one SVG and one PNG fallback per CSV in `assets/charts/`. The script uses pandas and matplotlib only (no seaborn or 3D charts). Install the pinned Python dependencies with `python -m pip install -r requirements-charts.txt`, then run:

```powershell
npm run charts
```

`npm run build` runs the chart step first. Results slides may reference a local chart asset; the chart is inserted as an image while the slide title and takeaway remain editable PowerPoint text. The supplied CSV values are traceable published examples: SwAV Table 5 and SimCLR Table B.2, whose source references are declared in `content/deck.yaml`.

## Equations

LaTeX inputs live in `content/equations.yaml`. The MathJax-based generator writes transparent SVG formulas to `assets/equations/` and records the LaTeX-to-file mapping and SHA-256 hashes in `assets/equations/manifest.json`.

```powershell
npm run equations
```

Unchanged formulas are skipped. Each formula produces a transparent SVG source and a 3,000-pixel-wide transparent PNG rendering. The sample deck embeds the SVG as the Office 2019+ vector resource and packages a real 3,000-pixel-wide PNG fallback for compatibility; titles and explanations remain editable PowerPoint text. `npm run build` runs chart and equation generation before rendering the 10-slide capability showcase.

## Optional AI illustrations

AI illustrations are isolated from the core PowerPoint build. `npm run build` never calls the image API and the title layout continues to use its native pure-color background when no generated illustration exists. To opt in, set `OPENAI_API_KEY` in your PowerShell environment, then run:

```powershell
$env:OPENAI_API_KEY = "your_key"
npm run images
```

`content/image-prompts.yaml` permits only `cover` and `conceptual` images. Every prompt must prohibit text, labels, numbers, formulas, and watermarks. The optional official `openai` SDK uses the Image API with `gpt-image-2`; generated PNGs and prompt/model/size/time/hash metadata are stored in `assets/generated/`. Unchanged requests are skipped. Missing keys and transient API failures do not block `npm run build`.

## Editable process diagrams

`diagram-slide` uses only native PowerPoint shapes, text, and arrow connectors. Content declares a fixed-template `kind`, semantic nodes, edges, and optional node emphasis—never coordinates. Supported templates are `linear-process`, `three-branch`, and `input-process-output`. Long node labels are emitted as validation warnings in `output/validation-report.json`; bounds and unexpected overlap remain build errors.

## PowerPoint SVG compatibility

For every embedded SVG (formulas and charts), the generator repairs PptxGenJS's invalid PNG fallback media after writing the package. SVG remains the primary vector asset, while a real transparent PNG fallback is embedded for Office compatibility. This avoids the PowerPoint “found a problem with content” repair prompt.
