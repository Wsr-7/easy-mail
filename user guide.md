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

`rangeMode` 可选值：

- `recentHours`
- `maxItems`

AI 分析默认优先请求 `gpt-5.4`。如果当前 VS Code / Copilot 运行时没有暴露这个模型族，插件会使用当前可用的 Copilot 模型。

如果需要改默认模型，可以在配置文件中调整：

```json
"modelFamily": "gpt-5.4"
```
