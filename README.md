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

## Project conventions

- 规范内容文件为 `content/deck.yaml`。
- 页面通过稳定的 `id` 和 `type` 声明，不在 YAML 中写入坐标。
- 未来生成的 `.pptx` 只能写入 `output/generated/`，不得覆盖 `output/final-edited.pptx`。
