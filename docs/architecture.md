# 系统架构

## 可编辑流程图

`diagram-slide` 由 `process-node` 和 `connector` 组件构成，节点文本、圆角矩形和箭头均为 PptxGenJS 原生对象。布局只提供 `linear-process`、`three-branch`、`input-process-output` 三个固定模板，不提供任意图自动布局。每个节点和连接线都返回 Box 元数据；生成器统一检查越界、重叠及节点文本长度警告，并把警告写入 `output/validation-report.json`。连接线的 OOXML 变换范围始终写为非负值，向上/向左连线通过翻转标记表达方向。

当前示例 deck 是 10 页能力展厅：覆盖全部五种注册布局、三种固定流程图模板、三张公式 SVG 页以及两张 CSV 驱动的结果页。它是布局与组件的可视化回归样本，而非新的研究结论。

## Office SVG 回退修复

PptxGenJS 4.0.1 会把 SVG 资源的 PNG 回退媒体错误地写为 SVG 字节。`src/generate-ppt.ts` 在写入 PPTX 后扫描 `ppt/media/*.png`，将实际 SVG 内容用 resvg 栅格化为透明 PNG，再用 JSZip 重打包。SVG 主媒体不变，Office 读取的 PNG 回退有效。

## 公式 SVG 流水线

`content/equations.yaml` 中的 LaTeX 表达式由 `scripts/generate-equations.ts` 使用 MathJax 转换为 Office 兼容的 `assets/equations/<stable-id>.svg`：`currentColor` 被规范化为主题主文字色。脚本同时用 resvg 以固定 3,000 像素宽度生成同 ID 的透明 PNG。`assets/equations/manifest.json` 保存源 LaTeX、SHA-256、两种输出路径及 PNG 宽度。构建在 SVG 和 PNG 均存在、哈希与 PNG 宽度未变化时跳过渲染。公式页引用 SVG；PptxGenJS 在 PPTX 中将 PNG 放于主 `a:blip`，SVG 放于 Office 2019+ 的 `asvg:svgBlip` 扩展。写包后处理器会把该 PNG 回退重建为真实的 3,000 像素宽 PNG。标题和说明仍是 PowerPoint 原生可编辑文本。

## 构建流程

```text
content/deck.yaml ──┐
                    ├─ 统一静态验证 ──> output/validation-report.json
                    └─ 布局注册表 ──> PptxGenJS ──> output/generated/sample.pptx
data/*.csv ─────────────> pandas + matplotlib ──> assets/charts/*.svg 和 *.png

output/generated/sample.pptx
        └─ 可选 LibreOffice ──> preview/sample.pdf
                                      └─ pdftoppm / ImageMagick ──> preview/slide-*.png
```

`npm run build` 先验证 deck 并刷新 `output/validation-report.json`，再运行图表和公式资产生成，最后再次验证并生成 PPTX。这样即使后续资产脚本提前失败，本轮仍不会把旧验证报告误认为新结果。

`npm run build:all` 在核心 `build` 成功后调用可选预览步骤。LibreOffice 或 PDF 栅格器不可用时，预览脚本只输出清晰告警并正常退出，不把可选桌面工具变成核心构建依赖。

## 可选 AI 插图

AI 插图采用双通道、单一资产契约：

```text
content/image-prompts.yaml ──> images:plan ──> output/image-generation-plan.json
          │
          ├─ 首选：Codex 交互会话内置 imagegen ──> 人工视觉审查 ──> images:register ──┐
          │                                                                         ├─> assets/generated/<id>.png
          └─ 可选：images:api + OPENAI_API_KEY ──> OpenAI Image API ────────────────┘   assets/generated/manifest.json v2
                                                                                              │
                                                                                       images:verify
```

Codex 内置 imagegen 是使用 `gpt-image-2` 的对话宿主能力，不能由 npm、Node.js 或 CI 直接调用，也不使用仓库的 `OPENAI_API_KEY`。因此 `images:plan` 只报告资产状态；Codex 在会话中逐项生成并视觉审查后，将选定 PNG 交给 `images:register`。`images:api` 才是显式的无人值守/批量通道，`npm run images` 仅作为其兼容别名。缺少 key 时 API 分支正常跳过。

两条通道读取相同的稳定 ID、用途、尺寸、提示词与人工编写 `alt`。manifest v2 为每个已登记 PNG 保存 `executor`、提示词、可用时的模型/质量、`promptSha256`、`requestSha256`、`assetSha256`、实际宽高、输出路径和登记时间。计划器据此区分 `current`、`missing`、`stale` 与 `invalid`；登记器校验完整 PNG、精确请求像素，并使用原子写入保护资产和 manifest。

该分支不被 `npm run build` 调用，也不属于核心 PPT 依赖。`title-slide` 可用语义 `illustrationId` 选择已登记封面图；验证器只有在 manifest、提示词和文件哈希均匹配时才把它放入封面右侧局部区域。缺图或过期时只给 warning，并继续使用原生纯色/形状回退。生成图不得承载权威文字、公式、数值、图表、技术架构或实验结论。

## 主要模块

- `content/`：唯一规范 deck 内容来源；页面只声明语义字段和 `layout`。
- `src/types.ts`：Zod schema 与推导出的领域类型。
- `src/layouts/`：布局注册和语义到 PowerPoint 坐标的映射；每个布局返回 `ElementBox[]`。
- `src/components/`：标题、页脚、正文、图片和指标卡等可复用 PowerPoint 对象。
- `src/utils/bounds.ts`：元素边界和非预期重叠检查。
- `src/validators/`：统一编排 schema、重复 ID、资产、Box、字号和文本密度验证，并生成机器可读报告。
- `scripts/generate_charts.py`：从 CSV 生成独立 SVG/PNG 研究图表。
- `scripts/generate-images.ts`：规划、登记、校验 Codex 内置生图结果，以及显式执行可选 Image API 通道。
- `scripts/render-preview.ps1`：Windows 预览入口；探测 LibreOffice 与 PDF 栅格器并生成 PDF/逐页 PNG。
- `assets/generated/manifest.json`：Codex 内置与 API 两条通道共用的插图 manifest v2。
- `assets/charts/`：构建产生的图表资产；SVG 优先，PNG 为回退。
- `src/generate-ppt.ts`：资产预检、布局调度、元素验证及 PPTX 写入。

## 布局与验证

支持的布局：`title-slide`、`text-slide`、`text-image-slide`、`diagram-slide`、`results-slide`。

布局与组件为每个 PowerPoint 对象返回 Box 元数据，其中 `layer` 为 `background`、`decoration`、`content` 或 `overlay`。生成器会拒绝超出 13.333 × 7.5 英寸页面的元素，以及未标记为预期的重叠。背景对象和显式声明的装饰重叠不触发错误。

`npm run validate` 使用与生成器相同的布局和 Box 元数据完成预检，统一覆盖：YAML/Zod schema、重复 slide ID、缺失或损坏资产、无效 Box 尺寸、越界、非预期重叠、声明字号和文本密度。Schema、ID、资产与几何结构问题是阻断错误；字号和文本密度是非阻断告警。全部结果写入 `output/validation-report.json`，报告同时声明必须继续进行人工视觉验收。

## 预览与交付边界

预览是可选 QA 分支，不改变 PPTX 主产物。LibreOffice 可用时，`npm run preview` 将 `output/generated/sample.pptx` 只读转换为 `preview/sample.pdf`；之后优先用 Poppler `pdftoppm`，缺失时尝试 ImageMagick 与 Ghostscript，输出 `preview/slide-*.png`。预览先在临时目录完成并校验页数、文件连续性和 PNG 签名，再事务式发布到项目 `preview/`；输出路径被限制在该目录内，并拒绝符号链接、junction 等 reparse point。

未安装 LibreOffice 时，脚本删除旧 `sample.pdf` 与 `slide-*.png` 后给出安装/PATH 提示并正常返回，避免陈旧预览冒充当前构建。LibreOffice 可用但缺少 PDF 栅格器时，只发布本轮新 PDF并清除旧 PNG，再正常返回。真正的转换或产物校验失败会报告失败，且不会用半成品替换此前完整发布的预览。

自动检查只能发现结构和明显渲染问题，最终仍须在目标 Microsoft PowerPoint 2024 中逐页人工检查。流水线只写 `output/generated/`、`output/validation-report.json` 与 `preview/`，不读取后回写、也不覆盖 `output/final-edited.pptx`。

## 可编辑性边界

标题、正文、页脚、页码、节点标签、指标和 takeaway 全部使用原生 PowerPoint 文本或形状。图表是由可再生 CSV 资产导出的 SVG/PNG 图片；其页面标题和结论仍为可编辑对象。
