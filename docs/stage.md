# 阶段变更留痕

本文件记录项目每个实现阶段的修改原因、修改内容和验证结果。后续代码、内容或构建行为发生变更时，应在对应修改完成后追加条目。

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
