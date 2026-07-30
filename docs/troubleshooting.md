# 故障排除

## `npm run equations` 失败

- `id` 必须是唯一的小写 kebab-case，`latex` 不能为空。
- 无效表达式会以 `Invalid LaTeX` 开头报告，并包含原始输入。
- SVG 未更新通常表示 manifest 中的 SHA-256 与 LaTeX 相同且输出文件存在；删除该公式 SVG 后重跑可强制重建。
- 公式页的 `Missing image asset` 表示应先运行 `npm run equations`，并检查相对 `content/deck.yaml` 的路径。

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

## PPTX 构建失败

- `Missing image asset` 或 `Missing chart asset`：确认资产路径相对 `content/deck.yaml` 解析正确，并先运行 `npm run charts`。
- `Unsupported or invalid image file`：仅使用 PNG、JPEG 或 SVG，且确保文件包含有效尺寸或 SVG `viewBox`。
- `Layout validation failed`：错误会指出越界或冲突的 Box ID。应调整布局/组件代码，不应在 YAML 里手工写坐标。
- 若 `sample.pptx` 正在被 PowerPoint 打开，关闭文件后重试；构建只写入 `output/generated/`，不会覆盖 `output/final-edited.pptx`。

## Windows 与 Node 问题

- 请在项目根目录的 PowerShell 中运行 npm 命令。
- Windows 路径应通过 Node `path` API 处理，YAML 中使用相对路径。
- 若受限环境中的 Node/tsx 报 `uv_os_get_passwd` 系统内存错误，请在正常本机终端重试；这不是 deck 内容错误。
