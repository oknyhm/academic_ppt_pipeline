# 阶段变更留痕

## 阶段 15：Codex 内置生图双通道与 QA 边界加固

### 为什么修改？

原有可选插图流水线只有 Image API 入口，容易让使用者误以为 `npm run images` 能调用 Codex 对话内置 imagegen；同时需要让内置生成结果与 API 结果共用可验证的资产契约。预览流水线也需要更明确地处理缺失工具、陈旧预览和项目输出边界，避免自动检查结果被误读。

### 修改内容

- 将 Codex 内置 imagegen 定为首选交互通道，按当前官方说明登记其 `gpt-image-2` 模型；明确它不能由 npm、Node.js 或 CI 直接调用，也不需要仓库的 `OPENAI_API_KEY`。
- 增加 `images:plan` → Codex 会话逐项生图与视觉审查 → `images:register` → `images:verify` 工作流；计划命令只输出状态，不伪装成生图命令。
- 保留 `images:api` 作为显式无人值守/批量通道，`images` 仅为兼容别名；缺少 API key 时安全跳过，核心 `build` 无 AI 图片仍使用原生回退成功运行。
- 两条通道统一使用 manifest v2，记录执行器、模型、提示词/请求/资产哈希、实际像素、稳定输出路径和登记时间；`images:verify` 会把执行器对应的模型、质量和请求哈希也纳入过期判断；规范提示词源增加人工编写的 `alt`。
- 为 `title-slide` 增加语义 `illustrationId`：只有提示词、manifest 与 PNG 哈希一致时才在封面局部使用插图；缺失或过期时只告警并回退到原生主题。
- 登记流程验证稳定 ID、完整 PNG 和精确像素，以原子写入保护资产与 manifest，并要求人工确认后才能替换已登记结果。
- 继续区分验证器的阻断结构错误与非阻断视觉质量告警；最终验收环境仍为 Microsoft PowerPoint 2024。
- 加固预览发布边界：仅向项目 `preview/` 发布，拒绝符号链接/junction；缺 LibreOffice 时清除旧 PDF/PNG，缺栅格器时仅保留本轮 PDF并清除旧 PNG，转换失败不发布半成品。
- 保持 `output/generated/` 与 `output/final-edited.pptx` 隔离，不覆盖人工编辑版本。
- 调整 `build` 顺序，先刷新验证报告再运行图表/公式生成；CLI 输出强制限制在 `output/generated/`。

### 验证

- `npm run images:plan` 与 `npm run images:verify` 通过：两张由 Codex 内置 imagegen 生成并人工审查的 1536×1024 PNG 均为 `current`，manifest v2 的提示词、像素和文件哈希一致。
- `npm run format:check`、`npm run typecheck` 与 `npm run lint` 均通过。
- `npm test` 通过：7 个测试文件、30 项测试全部成功；覆盖生图登记/过期检测、输出边界、完整几何问题收集、精确重叠授权、字号/文本告警、PPTX SVG/PNG 兼容结构。
- `npm run validate` 通过并刷新 `output/validation-report.json`：10 页、0 个错误、5 个非阻断告警（2 个示例文本密度告警和 3 个连接线人工检查提示）。
- `npm run build:all` 通过：生成 10 页 `output/generated/sample.pptx`、`preview/sample.pdf` 与 `preview/slide-1.png` 至 `slide-10.png`。
- 临时移走封面 PNG 后再次生成成功：报告 `optional-illustration-fallback` 告警并产出原生主题封面；恢复资产后重新验证为 0 个错误。
- 显式尝试把 CLI 输出写到 `output/final-edited.pptx` 被拒绝，且未创建/覆盖该文件。
- 已逐页检查 10 张预览：AI 封面插图仅位于右侧局部，文本仍可编辑；公式、流程图和图表均可见，未发现裁切、空白页或明显非预期重叠。
- 已在临时副本中实测缺 LibreOffice、缺 PDF 栅格器、junction 越界与栅格器缺页分支：陈旧产物清理、事务回滚和退出状态均符合文档。
- 尝试用 PowerPoint COM 自动打开最终文件，但当前非交互 Windows 登录会话返回 `0x80070520`（登录会话不存在），未能启动 PowerPoint；这不是 PPTX 修复报错。仍需在用户桌面会话的 Microsoft PowerPoint 2024 中打开文件，确认无修复提示并完成目标渲染器人工验收。

## 阶段 14：PPT 预览与统一质量检查流水线

### 为什么修改？

现有生成器能在写入时检查部分布局几何问题，但缺少可独立运行、可供 CI 读取的统一验证报告，也缺少把 PPTX 转为逐页图片进行快速视觉巡检的可选流水线。需要在不引入核心桌面依赖、不触碰人工编辑版本的前提下补齐这两部分。

### 修改内容

- 新增 `src/validators/`，统一检查 YAML/Zod schema、重复 slide ID、缺失或损坏资产、Box 尺寸/越界、非预期重叠、组件声明字号和文本密度。
- 结构错误会阻断验证和核心构建；字号、文本密度与自动视觉检查只记录为告警。统一结果写入 `output/validation-report.json`，并明确提示仍需 PowerPoint 人工验收。
- 新增 `scripts/render-preview.ps1` 与 `npm run preview`：可选调用 LibreOffice 生成 `preview/sample.pdf`，再优先用 Poppler `pdftoppm`、回退到 ImageMagick，生成 `preview/slide-*.png`。
- LibreOffice 或 PDF 栅格器未安装时输出安装/PATH 提示并以状态码 0 跳过，不影响核心构建。
- 新增 `npm run build:all`，按顺序执行核心 `build` 和可选 `preview`。
- 所有生成文件限定在 `output/generated/`、`output/validation-report.json` 和 `preview/`；不会覆盖 `output/final-edited.pptx`。
- 更新 README、架构、内容 schema 验证说明和故障排除文档。

### 验证

- `npm run format:check`、`npm run typecheck` 和 `npm run lint` 均通过。
- `npm test` 通过：6 个测试文件、21 项测试全部成功。
- `npm run validate` 通过并写入完整报告：10 页、0 个错误、2 个文本密度告警。
- `npm run build:all` 通过：重新生成图表、复用未修改公式、生成 10 页 `sample.pptx`，随后完成 LibreOffice PDF 导出与 Poppler PNG 转换。
- 实际生成 `preview/sample.pdf` 和 `preview/slide-1.png` 至 `preview/slide-10.png`；逐页检查未发现空白页、裁切或明显非预期重叠，第 2 页内容偏密与自动报告告警一致。
- 临时移除工具 PATH 后执行预览脚本，确认缺少 LibreOffice 时给出安装提示并以状态码 0 安全跳过。
- 使用本机 Microsoft PowerPoint 2024 打开 `output/generated/sample.pptx`，成功识别 10 页且未触发内容修复提示。最终交付仍要求人工逐页复核。

## 阶段 13：可选 AI 概念插图流水线

### 为什么修改？

需要允许为封面和概念说明生成无文字装饰插图，但不能让 API 密钥、网络调用或生成失败影响可复现的核心 PPT 构建。

### 修改内容

- 新增 `scripts/generate-images.ts`、`content/image-prompts.yaml` 与 `assets/generated/`。
- 使用官方 OpenAI Node SDK 的 Image API 与 `gpt-image-2`；SDK 是 `optionalDependencies`，`npm run build` 不调用 `npm run images`。
- 提示词 schema 限制用途为封面或概念插图，并强制五项无文字/标签/数字/公式/水印约束。
- 以提示词、模型、尺寸和质量生成哈希缓存；manifest 保存提示词、模型、尺寸、质量、输出路径、生成时间和哈希。
- 无 `OPENAI_API_KEY` 时正常跳过；瞬态请求有限重试，其他 API 失败不影响主构建。封面的纯色原生形状是无图时回退。
- 无密钥跳过时仅输出明确说明，不再将待生成项表述为“unchanged”。同时修正 README 中残留的第一阶段范围描述。
- 更新 `.env.example`、README、架构、内容 schema 与故障排除文档，并增加无密钥和提示词约束测试。

### 验证

- 在无密钥环境运行 `npm run images`，确认安全跳过。
- 运行 TypeScript 检查、lint、测试和主构建；主构建不产生任何 API 请求。

## 阶段 12：十页能力展厅示例

### 为什么修改？

需要在一份可直接打开的 PowerPoint 中集中查看当前已实现的布局、图形与资产流水线形式，而不是只用七页研究叙事样例。

### 修改内容

- 将 `content/deck.yaml` 扩展为十页能力展厅。
- 覆盖封面、双栏文本、三张 SVG 公式图文页、线性/输入—处理—输出/三分支流程图和两张 CSV 图表结果页。
- 保持所有内容为语义 YAML；不新增坐标、布局、外部资产或依赖。
- 更新示例 deck 测试的页数、布局顺序与三种流程图模板断言。
- 兼容性集成测试的时限调整为 20 秒，以容纳十页 deck 中五个 SVG 的高分辨率 PNG 回退重建。
- 更新 README、架构与内容 schema 文档；故障排除文档已审查，无行为变化，无需修改。

### 验证

- 运行内容校验、TypeScript 检查、lint、测试、完整构建，并在 PowerPoint 中打开生成文件。

## 阶段 11：Office 2024+ 的 SVG 主资源与 PNG 回退

### 为什么修改？

目标环境为本机 PowerPoint 2024，公式应以矢量 SVG 显示；同时需要保留高分辨率 PNG，供不支持 SVG 的 Office 使用。

### 修改内容

- 公式 SVG 将 MathJax 的 `currentColor` 规范化为主题主文字色，避免 Office SVG 渲染器无法继承 CSS 颜色而显示空白；manifest 渲染版本使旧 SVG 缓存自动失效。
- 示例 deck 恢复引用 SVG。
- PPTX 写入后将 SVG 的 PNG 主 blip 回退重建为真实透明、3,000 像素宽 PNG；`asvg:svgBlip` 保持指向 SVG。
- 回归测试检查公式页同时存在主 PNG 关系与 `asvg:svgBlip` SVG 关系，并验证 PNG 回退尺寸。
- 更新 README、架构、内容 schema 与故障排除文档。

### 验证

- 运行公式生成、TypeScript 检查、lint、测试、完整构建，并用本机 PowerPoint 2024 打开生成文件。

## 阶段 10：提高公式 PNG 的显示分辨率

### 为什么修改？

SVG 改用 PNG 嵌入后，默认栅格尺寸在 PowerPoint 的公式展示框和高倍率缩放下出现明显模糊。

### 修改内容

- 公式 PNG 改为由 resvg 以固定 3,000 像素宽度渲染，保持透明背景和纵横比。
- manifest 新增 `pngWidth`；旧的低分辨率缓存会自动失效并重新生成。
- 公式测试增加最小输出像素宽度断言；更新 README、架构、schema 和故障排除文档。

### 验证

- 运行公式生成、TypeScript 检查、lint、测试、完整构建，并用 PowerPoint 打开新文件。

## 阶段 9：公式的 PowerPoint PNG 嵌入回退

### 为什么修改？

部分 PowerPoint 版本可打开生成文件，但不渲染 MathJax 公式 SVG 主媒体，导致公式区域空白。

### 修改内容

- 公式生成器现在为每个稳定公式 ID 同时输出透明 SVG 源文件和透明 PNG 渲染文件。
- manifest 记录 SVG 与 PNG 路径；仅当哈希和两种文件都存在时跳过生成。
- 示例 deck 的三页公式改为引用 PNG，以保证 PowerPoint 显示；SVG 与 LaTeX 继续保留用于复现。
- 更新 README、架构、schema 和故障排除文档。

### 验证

- 新增测试验证每个公式 SVG 可转换为带有效 PNG 文件签名的透明回退图。
- 运行 TypeScript 检查、lint、测试和完整构建，并用 PowerPoint 打开生成文件。

## 阶段 8：PowerPoint SVG 回退兼容性修复

### 为什么修改

PowerPoint 在打开 `sample.pptx` 时提示内容错误。检查压缩包后发现 PptxGenJS 为 SVG 写出的 `.png` 回退媒体实际包含 SVG/XML 字节，违反 PNG 内容类型。

### 修改内容

- 增加 resvg 栅格化与 JSZip 重打包依赖。
- 在 PPTX 写入后替换所有伪 PNG SVG 回退媒体为真实透明 PNG，同时保留 SVG 主媒体。
- 修复流程图向上箭头产生的负 OOXML 变换尺寸，改为非负范围加翻转标记。
- 新增回归测试，检查所有嵌入 PNG 媒体都以标准 PNG 签名开头。
- 回归测试同时检查 slide XML 无负变换尺寸；PowerPoint COM 自动化已成功打开修复后的 7 页文件。
- 更新 README、架构和故障排除文档；内容 schema 无字段变化，已审查无需修改。

### 验证

- XML 与关系部件结构检查。
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## 阶段 7：原生可编辑流程图组件

### 为什么修改

示例需要表达人脸语义解耦与水印检测的关系，但技术流程不应依赖整页图片或不可编辑图示。因此以固定模板提供可验证的原生节点和连接线。

### 修改内容

- 扩展 diagram schema：节点、边、强调状态和三种固定模板。
- 新增原生圆角模块节点与带箭头连接线组件；所有节点标签可在 PowerPoint 中编辑。
- 为图示加入节点 ID/边引用校验、Box 边界和重叠验证，以及长节点文本警告。
- 构建将警告写入 `output/validation-report.json`。
- 将示例中的流程图替换为输入人脸、语义编码器、身份/表情/属性三分支、水印绑定和盲检测。
- 更新 README、架构、内容 schema 与故障排除文档。

### 验证

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## 阶段 6：可复现公式 SVG 流水线与神经网络示例

### 为什么修改

学术 PPT 中的公式应从可审查的 LaTeX 源自动生成矢量资产，而不是使用截图；示例 deck 也需要把神经网络原理、优化公式和已发表指标串联为完整叙事。

### 修改内容

- 添加 MathJax 驱动的 `npm run equations` 和 `content/equations.yaml`。
- 以稳定公式 ID 输出透明 SVG，并在 `assets/equations/manifest.json` 保存源 LaTeX、哈希和输出路径映射；未修改公式会跳过。
- 对公式 ID、重复项和无效 LaTeX 提供清晰错误；加入三个有效公式和无效 LaTeX 测试。
- 将示例扩展到 7 页，覆盖前向传播、交叉熵、梯度下降、训练闭环和带论文来源的指标图表。
- 更新 README、架构、内容 schema 与故障排除文档。

### 验证

- `npm run equations`
- `npm run charts`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

本文件记录项目每个实现阶段的修改原因、修改内容和验证结果。后续代码、内容或构建行为发生变更时，应在对应修改完成后追加条目。

## 阶段 5：文档维护规范

### 为什么修改

项目已具备内容、布局、图表和构建流程，需要将其接口和常见故障固定为项目文档，并确保后续变更不会使文档过期。

### 修改内容

- 新增架构、内容 schema 和故障排除文档。
- 在根目录 `AGENTS.md` 中规定：每次修改后更新 `docs/stage.md`，并在同一任务中审查并尝试更新三份核心技术文档。

### 验证

- 人工核对文档与当前目录结构、npm scripts、内容 schema 和构建流程一致。

## 阶段 1：项目骨架与内容验证

### 为什么修改

建立结构化内容驱动的学术 PPT 生成流水线基础，使后续渲染器可以在稳定、可验证的内容模型上开发。

### 修改内容

- 建立 TypeScript、ESLint、Prettier 和 Vitest 工具链。
- 添加 `pptxgenjs`、`yaml`、`zod` 作为运行时依赖。
- 定义 Deck、Slide 及五类语义页面的 Zod schema。
- 添加 YAML 示例内容、验证 CLI 和有效/无效输入测试。
- 固化 16:9 页面尺寸、配色、字体和安全边距主题常量。

### 验证

- `npm run validate`
- `npm run typecheck`
- `npm run lint`
- `npm test`

## 阶段 2：最小 PptxGenJS 生成器

### 为什么修改

将已验证的 YAML 内容实际转换为可编辑 PowerPoint，并先覆盖最基础的封面和正文场景。

### 修改内容

- 添加 PPTX 生成入口及 `npm run build`。
- 实现公共标题、页脚、页码组件。
- 实现 `title`、`text`、`text-image` 布局。
- 添加图片 contain/cover 计算、PNG/JPEG 尺寸读取和缺失图片预检。
- 添加所有写入元素的尺寸与页面边界检查。
- 将示例第 3 页从本阶段未支持的 `diagram` 调整为 `text`，确保全部示例页可生成。
- 实际生成 `output/generated/sample.pptx`。

### 验证

- `npm run format:check`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## 阶段 4：可复现科研图表流水线

### 为什么修改

科研图表需要由可检查的原始数据稳定再生，并与可编辑的 PowerPoint 标题和结论分离，避免将研究结论固化为不可维护的整页截图。

### 修改内容

- 添加两份带来源字段的 CSV：公开论文中的 SwAV Table 5 与 SimCLR Table B.2 示例数据。
- 添加仅依赖 pandas 和 matplotlib 的图表脚本；不使用 seaborn、3D 图表或外部资产生成器。
- 脚本验证列名、空值和数值字段，并对每张图输出独立 SVG 与 PNG 备用文件。
- 为结果布局增加可选 chart 语义槽位；图表作为本地图片插入，标题与 takeaway 继续使用 PowerPoint 可编辑文本。
- 添加 `npm run charts`，并令完整构建先生成图表。

### 验证

- `npm run charts`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## 阶段 3：可扩展布局与组件系统

### 为什么修改

随着布局数量增加，直接在生成入口中维护坐标和绘制分支会使验证与复用变得困难。因此需要让内容仅表达语义与布局名称，并将绘制坐标和元素验证集中到布局、组件和统一验证流程中。

### 修改内容

- 将页面判别字段由 `type` 重构为 `layout`，内容 YAML 不包含 `x`、`y`、`w`、`h` 等坐标。
- 新增布局注册表与五种布局：`title-slide`、`text-slide`、`text-image-slide`、`diagram-slide`、`results-slide`。
- 新增文本块、图片和指标卡组件；标题及页脚组件改为返回元素 Box 元数据。
- 为每个元素声明 `background`、`decoration`、`content` 或 `overlay` 层级。
- 在生成器中统一执行边界检查与非预期重叠检查；背景与明确标记的装饰重叠不报错。
- 将示例内容扩展为覆盖全部五种布局，并使用项目内手工 SVG 装饰资产，不接入外部资产生成器。

### 验证

- `npm run format:check`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
