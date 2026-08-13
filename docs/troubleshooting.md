# 故障排除

## 流程图构建失败或出现警告

- `Diagram edge must reference existing node ids`：检查 `edges.from` 与 `edges.to` 是否对应 `nodes[].id`。
- 固定模板节点数错误：`input-process-output` 需要 3 个节点，`three-branch` 需要 7 个节点；请使用其他模板或拆分页面。
- `Layout validation failed`：节点或连线越界/重叠。调整模板或组件代码，不能在 YAML 中添加坐标。
- `diagram-long-node-text` 警告：缩短节点文案，或拆分流程图；警告记录在 `output/validation-report.json`，不会单独阻止构建。

## PowerPoint 提示“发现内容有问题”

- 重新运行 `npm run build`。构建末尾应输出 `Repaired ... SVG PNG fallbacks for Office compatibility.`。
- 不要使用 PowerPoint 的修复结果覆盖 `output/generated/sample.pptx`；先确认当前构建已运行完成。
- 回归测试 `tests/pptx-compatibility.test.ts` 会检查所有嵌入的 PNG 回退媒体是否具有有效 PNG 文件头。
- 该测试也会检查所有 slide XML 中不存在负 `a:ext` 尺寸；斜向连接线必须使用非负尺寸加翻转标记。

## `npm run equations` 失败

- `id` 必须是唯一的小写 kebab-case，`latex` 不能为空。
- 无效表达式会以 `Invalid LaTeX` 开头报告，并包含原始输入。
- SVG 未更新通常表示 manifest 中的 SHA-256 与 LaTeX 相同且输出文件存在；删除该公式 SVG 后重跑可强制重建。
- 公式页的 `Missing image asset` 表示应先运行 `npm run equations`，并检查相对 `content/deck.yaml` 的路径。
- 若 PowerPoint 2024+ 中公式区域空白，请重新运行 `npm run equations && npm run build`；示例 deck 应引用 `assets/equations/<id>.svg`，生成器会同时嵌入 SVG 与 PNG 回退。若问题持续，检查公式 SVG 是否仍含 `currentColor`。
- 若旧版 Office 显示的是回退图且在大倍率缩放时模糊，确认 manifest 中的 `pngWidth` 为 `3000`，然后运行 `npm run equations && npm run build` 重新生成高分辨率 PNG 与 PPTX。

## AI 插图规划、登记或 API 生成失败

- `npm run images:plan` 只检查提示词、manifest 和本地 PNG，并写入 `output/image-generation-plan.json`；它不会调用 Codex 内置 imagegen。npm、Node.js 和 CI 均不能直接调用该对话能力。
- 首选内置通道时，请在 Codex 交互会话中要求按计划逐项生图。对每张结果进行视觉审查并复制到可访问路径后，运行 `npm run images:register -- --id <prompt-id> --source <png-path>`；不要只把文件留在 Codex 管理的生成目录。
- `Image ... must be ...`：登记 PNG 的实际像素与 `content/image-prompts.yaml` 的 `size` 不一致。选择正确尺寸的结果或重新生成，不要只修改扩展名。
- `Refusing to overwrite` 或 `already registered`：现有资产与新结果不同。确认已经审查替代图后，显式追加 `--replace`；默认保护已登记资产。
- `missing` 表示 PNG 或 manifest 项不存在；`stale` 表示提示词、尺寸、输出路径、文件哈希或元数据已变化；`invalid` 表示 PNG/manifest 无法通过结构或尺寸校验。修正后重新登记，再运行 `npm run images:verify`。
- `npm run images:api`（以及兼容别名 `npm run images`）才会调用 Image API。`Skipping API image generation: OPENAI_API_KEY is not configured` 是正常跳过；该 key 不用于 Codex 内置通道，主 `npm run build` 也不依赖它。
- API 的 429 与 5xx 最多重试三次；其他错误记录为该插图的非阻断失败。检查组织验证、额度、密钥权限和网络后重试。
- `Image prompt must include ...` 表示缺少必需的无文字、无标签、无数字、无公式或无水印约束；`alt` 也必须由人编写。修正 `content/image-prompts.yaml`，不要绕过 schema。
- 不要把 `assets/generated/` 的插图用作实验数据、模型架构证据、公式、数值或引用来源。无有效 AI 图片时核心 PPT 仍应使用原生纯色/形状回退成功构建。
- `optional-illustration-fallback` 是非阻断告警：`illustrationId` 对应的提示词、manifest 或 PNG 缺失/过期，封面会自动回退到原生形状。运行 `npm run images:plan` 查看原因，重新视觉审查并登记后再构建。

## `npm run charts` 失败

- 确认 Python 3.12 或兼容版本可用：`python --version`。
- 安装固定依赖：`python -m pip install -r requirements-charts.txt`。
- 脚本会报告缺失 CSV、缺少列、空值或非数值列。修复 `data/` 中对应 CSV，而不是在图表脚本中填补数据。
- 每张图会同时写入 `assets/charts/*.svg` 与 `*.png`；检查目录写权限和文件是否被其他程序锁定。

## `npm run validate` 失败

- 检查页面是否有唯一 `id` 和已注册的 `layout`。
- 不要在 YAML 添加 `x`、`y`、`w`、`h`；这些是布局实现细节。
- `Metric.value` 是字符串，例如 `value: "80.4"`。
- 引用 ID 必须和 `meta.citations` 中的 ID 对应。
- 查看 `output/validation-report.json` 的 `errors` 和 `warnings`：schema、重复 ID、缺失/损坏资产、无效 Box 尺寸、越界和非预期重叠会阻断构建；字号和文本密度只产生告警。
- 资产路径相对 `content/deck.yaml` 所在目录解析。文件虽然存在但无法读取图片尺寸时，也会按损坏资产处理。
- 自动报告中的告警不等于 PowerPoint 已通过视觉验收；完成构建后仍需逐页人工检查。

## `npm run preview` 跳过或失败

- `LibreOffice was not found`：安装 LibreOffice，并确认 `soffice` 或 `soffice.com` 可以从 PowerShell 的 PATH 找到；也可将 LibreOffice 的 `program` 目录加入 PATH。脚本会删除旧 `preview/sample.pdf` 和 `preview/slide-*.png`、给出提示并以状态码 0 跳过，不影响 `npm run build`。
- 已安装 LibreOffice 但仍无法探测：重新打开 PowerShell 以加载新的 PATH，运行 `Get-Command soffice.com` 检查；若使用非标准安装目录，将其 `program` 目录加入 PATH。
- 已生成 `preview/sample.pdf` 但没有 `preview/slide-*.png`：这是缺少栅格器时的允许结果；脚本会发布本轮新 PDF 并清除旧 PNG。安装 Poppler 并让 `pdftoppm` 可从 PATH 找到，或同时安装 ImageMagick 与 Ghostscript 作为回退。用 `Get-Command pdftoppm`、`Get-Command magick` 和 `Get-Command gswin64c` 检查。
- PDF/PNG 转换或产物校验失败：先关闭正在打开 `sample.pptx`、`sample.pdf` 或旧预览图的 PowerPoint、LibreOffice 和图片查看器，然后重试；还应确认 `preview/` 可写且磁盘空间充足。脚本在临时目录校验完才发布，因此失败时此前完整预览可能仍然存在；请核对文件时间，不要把旧预览当成本轮结果。
- LibreOffice 无输出或报告文件锁：关闭后台 LibreOffice 进程后重试。不要把人工编辑文件作为预览输出；默认脚本只读取 `output/generated/sample.pptx`。
- `Preview output must stay inside...` 或 `reparse point`：预览目标逃离项目 `preview/`，或路径中包含符号链接/junction。改用普通的项目内 `preview/` 目录，不要放宽安全检查。
- `npm run build:all` 中预览被跳过属于允许状态。核心 PPTX 和验证报告仍应生成；安装可选工具后可单独重跑 `npm run preview`。
- PNG 预览只用于快速发现裁切、空白和明显布局问题。颜色、字体替换、SVG 回退及动画等最终效果必须在目标 Microsoft PowerPoint 2024 中检查。

## PPTX 构建失败

- `Missing image asset` 或 `Missing chart asset`：确认资产路径相对 `content/deck.yaml` 解析正确，并先运行 `npm run charts`。
- `Unsupported or invalid image file`：仅使用 PNG、JPEG 或 SVG，且确保文件包含有效尺寸或 SVG `viewBox`。
- `Layout validation failed`：错误会指出越界或冲突的 Box ID。应调整布局/组件代码，不应在 YAML 里手工写坐标。
- 若 `sample.pptx` 正在被 PowerPoint 打开，关闭文件后重试；构建只写入 `output/generated/`，不会覆盖 `output/final-edited.pptx`。

## Windows 与 Node 问题

- 请在项目根目录的 PowerShell 中运行 npm 命令。
- Windows 路径应通过 Node `path` API 处理，YAML 中使用相对路径。
- 若受限环境中的 Node/tsx 报 `uv_os_get_passwd` 系统内存错误，请在正常本机终端重试；这不是 deck 内容错误。
