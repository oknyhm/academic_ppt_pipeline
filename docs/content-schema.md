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

`content/image-prompts.yaml` 与 deck 内容分离，不能声明研究结论、图表、数值或技术证据。每项字段如下：

| 字段      | 要求                                                                 |
| --------- | -------------------------------------------------------------------- |
| `id`      | 必需；稳定的小写 kebab-case ID，同时决定 `assets/generated/<id>.png` |
| `purpose` | 必需；仅 `cover` 或 `conceptual`                                     |
| `prompt`  | 必需；生成提示词                                                     |
| `alt`     | 必需；由人编写的无障碍替代说明，不能依赖模型自动猜测                 |
| `size`    | 可选；`1536x1024`、`1024x1536` 或 `1024x1024`，默认 `1536x1024`      |

```yaml
images:
  - id: cover-neural-network-concept
    purpose: cover
    size: 1536x1024
    alt: Abstract neural-network nodes concentrated on the right side.
    prompt: >-
      Restrained academic illustration with no text, no labels, no numbers,
      no formula, no watermark.
```

每条提示词必须逐字包含 `no text`、`no labels`、`no numbers`、`no formula`、`no watermark`。`npm run images:plan` 根据提示词、用途、尺寸、manifest 与 PNG 字节报告 `current`、`missing`、`stale` 或 `invalid`；该命令不会调用任何生图服务。

Codex 内置通道必须在交互会话中逐项生成并视觉审查，再运行：

```powershell
npm run images:register -- --id <prompt-id> --source <reviewed-png-path>
npm run images:verify
```

登记文件必须是完整 PNG，实际像素必须和 `size` 完全一致。覆盖已登记但过期的文件需要显式 `--replace`。无人值守或批量场景可选择 `npm run images:api`；`npm run images` 是该 API 命令的兼容别名，不会调用 Codex 内置 imagegen。

`assets/generated/manifest.json` 使用 version 2。每项记录 `executor`（`codex-built-in` 或 `openai-api`）、提示词、可用时的模型与质量、输出路径、登记时间、提示词/请求/资产 SHA-256 和实际宽高。`alt` 保存在规范提示词 YAML 中。两类记录共用相同 ID 和输出路径；manifest 不是 deck schema 的任意绘图入口。

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

## 验证行为

本阶段不改变任何内容字段；`npm run validate` 只是把现有 schema 与生成阶段检查统一到一份报告中：

- YAML/Zod schema 错误与重复 slide ID 是阻断错误。
- `image`、`chart` 等声明资产缺失或无法读取尺寸时是阻断错误。
- 布局根据语义内容生成 Box 元数据后，无效尺寸、元素越界及非预期重叠是阻断错误。
- 组件声明字号低于允许下限、标题/正文/流程节点等文本过长或密度过高时产生告警，不会单独阻断构建。

结果写入 `output/validation-report.json`。报告用于自动化检查，不代表视觉验收通过；生成的 PPTX 仍须在 Microsoft PowerPoint 中人工检查。内容文件依旧不能通过坐标或低层绘图字段绕过布局验证。

## 布局字段

| `layout`           | 必需语义字段                                  | 可选字段                                                      |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------- |
| `title-slide`      | `title`                                       | `subtitle`、`author`、`affiliation`、`date`、`illustrationId` |
| `text-slide`       | `title`、`sections`                           | `citations`、`speakerNotes`                                   |
| `text-image-slide` | `title`、`sections`、`image`、`imagePosition` | `imageCaption`                                                |
| `diagram-slide`    | `title`、`diagram.kind`、`diagram.nodes`      | `citations`                                                   |
| `results-slide`    | `title`                                       | `metrics`、`chart`、`chartCaption`、`takeaway`、`citations`   |

`sections` 含一至两个正文区。每个区至少给出 `bullets` 或 `paragraphs`；项目符号最多 4 条。

`title-slide.illustrationId` 是可选的语义引用，只能指向 `content/image-prompts.yaml` 中已登记的封面插图 ID。manifest、提示词与 PNG 哈希全部匹配时，布局只在封面右侧插入局部装饰图，标题等文字仍是原生可编辑对象；缺失或过期时验证器产生 warning，并自动使用原生形状/纯色封面，不阻断核心构建。

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
