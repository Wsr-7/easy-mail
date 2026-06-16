# User Guide

## 适用环境

- Windows
- classic Outlook
- VS Code
- GitHub Copilot 已登录

## 主要命令

- `Email Analysis: Pull Mail`
- `Email Analysis: Generate Sample Digest`
- `Email Analysis: Analyze with Copilot`
- `Email Analysis: Refresh Dashboard`
- `Email Analysis: Open Digest`
- `Email Analysis: Open Summary`
- `Email Analysis: Open Settings`

看板顶部也提供同等按钮：

- `Pull Mail`
- `Sample`
- `Analyze`
- `Refresh`
- `Open Digest`
- `Open Summary`
- `Settings File`

执行 `Pull Mail`、`Sample` 或 `Analyze` 时，看板会显示进行中的 loading 条，VS Code 也会显示任务进度提示。

## 推荐测试路径

### 无 Outlook / 无 Copilot 的本地演示

1. 安装扩展。
2. 执行 `Email Analysis: Generate Sample Digest`。
3. 执行 `Email Analysis: Open Digest`。
4. 检查 `mail-digest.md` 是否生成。

### 有 Copilot 的完整演示

1. 执行 `Email Analysis: Pull Mail` 或 `Generate Sample Digest`。
2. 执行 `Email Analysis: Analyze with Copilot`。
3. 打开 sidebar 中的 `Dashboard`。
4. 检查分类统计、卡片内容、`Copy Draft` 和 `Ignore`。

## 配置

插件首次运行会创建本地配置文件：

```text
email-analysis.config.json
```

关键字段：

- `rangeMode`
- `recentHours`
- `maxItems`
- `folders`
- `bodyExcerptChars`
- `sampleMode`
- `modelFamily`
- `outputLanguage`

`rangeMode` 可选值：

- `recentHours`
- `maxItems`

AI 分析默认优先请求 `gpt-5.4`。如果当前 VS Code / Copilot 运行时没有暴露这个模型族，插件会使用当前可用的 Copilot 模型。

如果需要改默认模型，可以在配置文件中调整：

```json
"modelFamily": "gpt-5.4"
```

`outputLanguage` 可选值：

- `zh-CN`：插件界面、分类名、字段名、摘要、原因、建议动作使用中文；邮件原文和回复草稿保持英文
- `en-US`：插件界面、分类名、字段名、摘要、原因、建议动作使用英文；邮件原文和回复草稿保持英文

这里有两层语言控制：

- 插件界面语言：看板按钮、设置项、统计字段、分类标题。
- Copilot 分析输出语言：`summary`、`reason`、`suggestedAction`。

两层当前共用 `outputLanguage`，所以切换一次即可同时生效。邮件主题、发件人、原文摘录和 `draftReply` 不会被插件强行翻译。

`bodyExcerptChars` / `Body Chars` 表示每封邮件最多截取多少个正文字符送给 Copilot。它不是摘要长度，而是输入裁剪上限；数值越大，模型看到的上下文越多，但分析可能更慢，也更容易超过上下文预算。

设置面板默认折叠，点击 `设置` / `Settings` 后才会展开。分类面板也默认可折叠，`今天必须处理` / `Must Handle Today` 默认展开，其它分类可以按需展开。
