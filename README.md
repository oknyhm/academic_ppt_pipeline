# Structured Academic PPT Pipeline

一个以结构化 YAML 内容驱动的学术 PowerPoint 构建项目。当前版本支持五种注册布局、可编辑文本与原生图形、可复现图表和公式资产，并提供静态验证与可选逐页预览。

## Prerequisites

- Node.js 22 或更高版本
- npm 10 或更高版本
- Windows 11 / PowerShell（主要开发环境）
- 可选：LibreOffice（将 PPTX 导出为 PDF）
- 可选：Poppler 的 `pdftoppm`，或作为回退的 ImageMagick（将 PDF 转为逐页 PNG）

## Quick start

```powershell
npm install
npm run validate
npm run build
npm run preview
npm run build:all
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

`npm run build` 会生成 `output/generated/sample.pptx`。五种注册布局均支持本地 PNG/JPEG/SVG 资产，缺失或损坏资产会在写入 PPTX 前报告。AI 插图和 LibreOffice 预览均为隔离的可选分支，不属于核心构建依赖；当前不接入 Mermaid、Graphviz、TikZ 或复杂动画。

## Project conventions

- 规范内容文件为 `content/deck.yaml`。
- 页面通过稳定的 `id` 和 `layout` 声明，不在 YAML 中写入坐标。
- 生成的 `.pptx` 只能写入 `output/generated/`；校验报告写入 `output/validation-report.json`，预览文件写入 `preview/`。
- 构建和预览流程不得写入或覆盖人工编辑版本 `output/final-edited.pptx`。

## Validation and preview

`npm run validate` 对 `content/deck.yaml` 执行统一静态检查：

- YAML/Zod schema 错误和重复 slide ID
- 缺失或损坏的图片、图表、公式等本地资产
- 布局返回的 Box 尺寸、页面越界和非预期重叠
- 组件声明的字号下限
- 标题、正文、节点等文本长度与内容密度

Schema、重复 ID、资产、Box 尺寸/越界和非预期重叠属于结构错误，会使校验及核心构建失败。字号和文本密度属于质量告警，不会单独阻断构建。每次校验都会生成 `output/validation-report.json`，其中同时记录错误、告警以及仍需人工复核的说明。

`npm run preview` 调用 `scripts/render-preview.ps1`。脚本在检测到 LibreOffice 时，将 `output/generated/sample.pptx` 导出为 `preview/sample.pdf`；随后优先使用 Poppler 的 `pdftoppm`、找不到时回退到 ImageMagick 与 Ghostscript，生成 `preview/slide-*.png`。未安装 LibreOffice 时会清除旧 PDF/PNG，避免把历史预览误认为当前结果；只有 PDF 栅格器缺失时会保留本轮新 PDF、清除旧 PNG。两种缺工具情况都会打印安装与 PATH 提示并以成功状态跳过，因此不影响核心 `npm run build`。

```powershell
npm run build:all
```

`build:all` 等价于先完成核心 `build`，再尝试生成预览。自动验证和预览只用于发现明显问题；最终交付前仍必须在目标 Microsoft PowerPoint 2024 中人工检查全部页面。

## Layout system

Slides declare a stable `id`, a semantic `layout` name, and layout-specific content only. The sample deck covers `title-slide`, `text-slide`, `text-image-slide`, `diagram-slide`, and `results-slide`. Layouts own all coordinates and return layered element metadata (`background`, `decoration`, `content`, `overlay`) for bounds and overlap validation.

## Research charts

Chart source data is stored under `data/`; `scripts/generate_charts.py` validates required columns, missing values, and numeric fields before generating one SVG and one PNG fallback per CSV in `assets/charts/`. The script uses pandas and matplotlib only (no seaborn or 3D charts). Install the pinned Python dependencies with `python -m pip install -r requirements-charts.txt`, then run:

```powershell
npm run charts
```

`npm run build` refreshes validation before running the chart step. Results slides may reference a local chart asset; the chart is inserted as an image while the slide title and takeaway remain editable PowerPoint text. The supplied CSV values are traceable published examples: SwAV Table 5 and SimCLR Table B.2, whose source references are declared in `content/deck.yaml`.

## Equations

LaTeX inputs live in `content/equations.yaml`. The MathJax-based generator writes transparent SVG formulas to `assets/equations/` and records the LaTeX-to-file mapping and SHA-256 hashes in `assets/equations/manifest.json`.

```powershell
npm run equations
```

Unchanged formulas are skipped. Each formula produces a transparent SVG source and a 3,000-pixel-wide transparent PNG rendering. The sample deck embeds the SVG as the Office 2019+ vector resource and packages a real 3,000-pixel-wide PNG fallback for compatibility; titles and explanations remain editable PowerPoint text. `npm run build` runs chart and equation generation before rendering the 10-slide capability showcase.

## Optional AI illustrations

AI 插图与核心 PowerPoint 构建隔离，只能用于封面或概念性装饰，不能作为实验结果、公式、技术架构或研究证据。首选流程是在 Codex 交互会话中使用内置 imagegen（官方当前说明其使用 `gpt-image-2`）；该能力不能被 npm、Node.js 或 CI 直接调用，也不读取仓库的 `OPENAI_API_KEY`：

```powershell
npm run images:plan
# 请 Codex 按计划逐项调用内置 imagegen，并对结果做视觉审查。
npm run images:register -- --id <prompt-id> --source <reviewed-png-path>
npm run images:verify
```

`images:plan` 只生成 `output/image-generation-plan.json`，列出 `current`、`missing`、`stale` 或 `invalid` 状态；它不会自行生成图片。Codex 选定的结果必须先复制到可访问路径，再由 `images:register` 校验 PNG、精确像素和稳定 ID，并登记到 `assets/generated/manifest.json`。替换已登记但过期的资产需要在人工复核后显式加 `--replace`。

需要无人值守或批量运行时，可显式选择 Image API 通道：

```powershell
$env:OPENAI_API_KEY = "your_key"
npm run images:api
```

`npm run images` 是 `images:api` 的兼容别名，不代表调用 Codex 内置工具。两条通道共用 `content/image-prompts.yaml`、稳定输出路径和 manifest v2；提示词源保存人工编写的 `alt`，manifest 保存执行器、提示词/请求/文件哈希及实际像素。封面可用语义字段 `illustrationId` 引用已登记插图；有效图只占局部装饰区域，缺失或过期时输出 warning 并自动回退到原生形状。未设置 API key 时 API 通道正常跳过。`npm run build` 不调用任何生图命令，即使没有 AI 图片也能完成核心构建。

## Editable process diagrams

`diagram-slide` uses only native PowerPoint shapes, text, and arrow connectors. Content declares a fixed-template `kind`, semantic nodes, edges, and optional node emphasis—never coordinates. Supported templates are `linear-process`, `three-branch`, and `input-process-output`. Long node labels are emitted as validation warnings in `output/validation-report.json`; bounds and unexpected overlap remain build errors.

## PowerPoint SVG compatibility

For every embedded SVG (formulas and charts), the generator repairs PptxGenJS's invalid PNG fallback media after writing the package. SVG remains the primary vector asset, while a real transparent PNG fallback is embedded for Office compatibility. This avoids the PowerPoint “found a problem with content” repair prompt.
