# User Guide

## 适用环境

- Windows
- classic Outlook
- VS Code
- GitHub Copilot 已登录

## 主要命令

- `Email Analysis: Pull Mail`
- `Email Analysis: Generate Sample Digest`
- `Email Analysis: Analyze Next Batch with Copilot`
- `Email Analysis: Analyze All Allowed with Copilot`
- `Email Analysis: Refresh Dashboard`
- `Email Analysis: Open Digest`
- `Email Analysis: Open Summary`
- `Email Analysis: Open Settings`
- `Email Analysis: Open Prompt Config`

看板顶部也提供同等按钮：

- `Pull Mail`
- `Sample`
- `Analyze Next Batch`
- `Analyze Selected`
- `Analyze All Allowed`
- `Refresh`
- `Open Digest`
- `Open Summary`
- `Settings File`
- `Prompt Config`

执行 `Pull Mail`、`Sample` 或 `Analyze` 时，看板会显示进行中的 loading 条，VS Code 也会显示任务进度提示。

## 渐进式分析

`Pull Mail` 只负责拉取邮件并导入本地 `mail-store.json`。插件会根据邮件的文件夹、时间、发件人、标题和正文摘要生成稳定 ID，已经拉过的邮件会跳过。

拉取后，邮件会先进入 `未分析邮件` 面板。分析入口有三种：

- `Analyze Next Batch`：只分析当前允许自动分析的下一批邮件。
- `Analyze Selected`：分析用户在未分析/需确认面板中勾选的邮件。
- `Analyze All Allowed`：分析当前所有允许自动分析的邮件。

看板顶部会显示：

- 已拉取
- 未分析
- 已分析
- 需确认

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
- `analysisBatchSize`
- `autoAnalyzeEnabled`
- `autoAnalyzeMaxClassificationLevel`

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

`analysisBatchSize` 表示 `Analyze Next Batch` 每次最多分析多少封邮件。

`autoAnalyzeEnabled` 控制是否允许自动分析。关闭后，邮件会进入手动确认路径，需要用户勾选后点 `Analyze Selected`。

`autoAnalyzeMaxClassificationLevel` 控制自动分析允许的最高密级。默认密级：

- `0` Public
- `1` Internal
- `2` Confidential
- `3` Restricted
- `4` Highly Restricted

高于这个值的邮件不会自动送给 Copilot，只能由用户手动勾选确认后分析。

设置面板默认折叠，点击 `设置` / `Settings` 后才会展开。分类面板也默认可折叠，`今天必须处理` / `Must Handle Today` 默认展开，其它分类可以按需展开。

## 自定义分类 Prompt

首次运行后，插件会在全局存储目录创建：

```text
prompt-config.json
```

点击看板里的 `Prompt Config` 可以打开它。用户可以在这里增加或修改分类：

```json
{
  "id": "vipCustomer",
  "labelZh": "VIP 客户",
  "labelEn": "VIP Customer",
  "description": "Important customer mail that needs extra attention.",
  "priorityHint": "Usually P0 or P1"
}
```

分析时插件会组合：

- `prompts/base-system.md`
- `prompt-config.json`
- `prompts/output-schema.md`
- 语言指令
- 当前批次邮件内容

然后再发送给 Copilot。
