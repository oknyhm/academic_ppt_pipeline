# 阶段变更留痕

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
