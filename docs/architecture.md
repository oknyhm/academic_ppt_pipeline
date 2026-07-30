# 系统架构

## 公式 SVG 流水线

`content/equations.yaml` 中的 LaTeX 表达式由 `scripts/generate-equations.ts` 使用 MathJax 转换为 `assets/equations/<stable-id>.svg`。每个 SVG 透明且只含单个公式；`assets/equations/manifest.json` 保存源 LaTeX、SHA-256 和输出路径映射。构建会先运行 `npm run equations`，哈希未变化且目标 SVG 存在时跳过渲染。deck 的公式页面通过标准 `text-image-slide.image` 引用 SVG，因此标题和说明仍是 PowerPoint 原生可编辑文本。

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
