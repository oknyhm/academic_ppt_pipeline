# 内容 Schema

## 流程图

`diagram-slide` 只描述节点与边，不写坐标。节点可选 `emphasis`：`normal`、`primary`、`accent`、`warning`。边使用节点 ID：

```yaml
layout: diagram-slide
title: 人脸语义解耦
diagram:
  kind: three-branch
  nodes:
    - id: input
      label: 输入人脸
    - id: encoder
      label: 语义编码器
      emphasis: primary
  edges:
    - from: input
      to: encoder
```

`linear-process` 支持 2–7 个节点；`input-process-output` 固定为 3 个节点；`three-branch` 固定为 7 个节点，按输入、处理、三个分支、绑定、输出的顺序映射。每条边必须引用已有且不同的节点 ID。

当前 `content/deck.yaml` 的能力展厅覆盖以上三种流程图模板；模板顺序由布局实现决定，内容文件仍只声明节点、边与强调状态。

## 公式源文件

公式独立存放在 `content/equations.yaml`。每个条目必须有稳定的小写 kebab-case `id` 和非空 LaTeX：

```yaml
equations:
  - id: neural-forward
    latex: "\\mathbf{h} = \\sigma(\\mathbf{W}\\mathbf{x} + \\mathbf{b})"
    description: 可选的公式说明。
```

生成后会得到 `../assets/equations/<id>.svg`（Office 2019+ 的矢量主资源）和以固定 3,000 像素宽度渲染的 `../assets/equations/<id>.png`（回退图）。示例 deck 用普通 `image` 资产引用 SVG；生成器会在 PPTX 中把 PNG 作为主 blip 回退、SVG 作为 `asvg:svgBlip` 扩展。源 LaTeX、两种输出路径与 PNG 宽度在 `assets/equations/manifest.json` 中保存。

## 可选插图提示词

`content/image-prompts.yaml` 与 deck 内容分离，不能声明研究结论、图表、数值或技术证据。每项使用稳定 kebab-case `id`、`purpose`（仅 `cover` 或 `conceptual`）、`prompt` 和可选 `size`。提示词必须逐字包含以下约束：`no text`、`no labels`、`no numbers`、`no formula`、`no watermark`。生成器使用这些字段和固定模型/质量计算缓存哈希。

规范内容文件是 `content/deck.yaml`，并由 `src/types.ts` 中的 Zod schema 验证。内容文件不能包含 `x`、`y`、`w` 或 `h` 坐标；坐标只存在于注册布局中。

## 顶层结构

```yaml
meta:
  title: Deck 标题
  language: zh-CN
  citations:
    - id: stable-citation-id
      text: 来源说明
      url: https://example.org/source
slides: []
```

每页都需要稳定 `id` 和 `layout`。可选字段包括 `speakerNotes` 和 `citations`（引用 `meta.citations` 中的 ID）。重复 slide ID 会导致验证失败。

## 布局字段

| `layout` | 必需语义字段 | 可选字段 |
|---|---|---|
| `title-slide` | `title` | `subtitle`、`author`、`affiliation`、`date` |
| `text-slide` | `title`、`sections` | `citations`、`speakerNotes` |
| `text-image-slide` | `title`、`sections`、`image`、`imagePosition` | `imageCaption` |
| `diagram-slide` | `title`、`diagram.kind`、`diagram.nodes` | `citations` |
| `results-slide` | `title` | `metrics`、`chart`、`chartCaption`、`takeaway`、`citations` |

`sections` 含一至两个正文区。每个区至少给出 `bullets` 或 `paragraphs`；项目符号最多 4 条。

## 资产引用

`image` 和 `chart` 使用相同的语义对象：

```yaml
path: ../assets/charts/method-comparison.svg
alt: 图表的无障碍替代文本
source: data/method-comparison.csv
```

路径相对 `content/deck.yaml` 所在目录解析。构建支持 PNG、JPEG 和 SVG；文件不存在或无法识别尺寸时会失败。`results-slide.chart` 只能引用图表构建已生成的资产。

## 结果页示例

```yaml
id: results
layout: results-slide
title: 实验结果
chart:
  path: ../assets/charts/method-comparison.svg
  alt: 方法比较图
  source: data/method-comparison.csv
chartCaption: 图表数据与适用条件说明。
metrics:
  - label: 指标名称
    value: "80.4"
    detail: 说明
takeaway: 可编辑的结论文本。
citations:
  - source-id
```
