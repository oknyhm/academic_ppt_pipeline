# 系统架构

## 可编辑流程图

`diagram-slide` 由 `process-node` 和 `connector` 组件构成，节点文本、圆角矩形和箭头均为 PptxGenJS 原生对象。布局只提供 `linear-process`、`three-branch`、`input-process-output` 三个固定模板，不提供任意图自动布局。每个节点和连接线都返回 Box 元数据；生成器统一检查越界、重叠及节点文本长度警告，并把警告写入 `output/validation-report.json`。连接线的 OOXML 变换范围始终写为非负值，向上/向左连线通过翻转标记表达方向。

## Office SVG 回退修复

PptxGenJS 4.0.1 会把 SVG 资源的 PNG 回退媒体错误地写为 SVG 字节。`src/generate-ppt.ts` 在写入 PPTX 后扫描 `ppt/media/*.png`，将实际 SVG 内容用 resvg 栅格化为透明 PNG，再用 JSZip 重打包。SVG 主媒体不变，Office 读取的 PNG 回退有效。

## 公式 SVG 流水线

`content/equations.yaml` 中的 LaTeX 表达式由 `scripts/generate-equations.ts` 使用 MathJax 转换为 Office 兼容的 `assets/equations/<stable-id>.svg`：`currentColor` 被规范化为主题主文字色。脚本同时用 resvg 以固定 3,000 像素宽度生成同 ID 的透明 PNG。`assets/equations/manifest.json` 保存源 LaTeX、SHA-256、两种输出路径及 PNG 宽度。构建在 SVG 和 PNG 均存在、哈希与 PNG 宽度未变化时跳过渲染。公式页引用 SVG；PptxGenJS 在 PPTX 中将 PNG 放于主 `a:blip`，SVG 放于 Office 2019+ 的 `asvg:svgBlip` 扩展。写包后处理器会把该 PNG 回退重建为真实的 3,000 像素宽 PNG。标题和说明仍是 PowerPoint 原生可编辑文本。

## 构建流程

```text
content/deck.yaml ──┐
                    ├─ YAML 解析与 Zod 校验 ──> 布局注册表 ──> PptxGenJS ──> output/generated/sample.pptx
data/*.csv ─────────┤
                    └─ pandas + matplotlib ──> assets/charts/*.svg 和 *.png
```

`npm run build` 先运行 `npm run charts`，再验证 deck，最后生成 PPTX。因此结果页引用的图表始终来自当前 CSV 输入。

## 主要模块

- `content/`：唯一规范 deck 内容来源；页面只声明语义字段和 `layout`。
- `src/types.ts`：Zod schema 与推导出的领域类型。
- `src/layouts/`：布局注册和语义到 PowerPoint 坐标的映射；每个布局返回 `ElementBox[]`。
- `src/components/`：标题、页脚、正文、图片和指标卡等可复用 PowerPoint 对象。
- `src/utils/bounds.ts`：元素边界和非预期重叠检查。
- `scripts/generate_charts.py`：从 CSV 生成独立 SVG/PNG 研究图表。
- `assets/charts/`：构建产生的图表资产；SVG 优先，PNG 为回退。
- `src/generate-ppt.ts`：资产预检、布局调度、元素验证及 PPTX 写入。

## 布局与验证

支持的布局：`title-slide`、`text-slide`、`text-image-slide`、`diagram-slide`、`results-slide`。

布局与组件为每个 PowerPoint 对象返回 Box 元数据，其中 `layer` 为 `background`、`decoration`、`content` 或 `overlay`。生成器会拒绝超出 13.333 × 7.5 英寸页面的元素，以及未标记为预期的重叠。背景对象和显式声明的装饰重叠不触发错误。

## 可编辑性边界

标题、正文、页脚、页码、节点标签、指标和 takeaway 全部使用原生 PowerPoint 文本或形状。图表是由可再生 CSV 资产导出的 SVG/PNG 图片；其页面标题和结论仍为可编辑对象。
