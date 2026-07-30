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
