# Agents

## 项目定位

这是一个邮件分析 POC，不是生产级邮件管理系统。

## 当前边界

- 仅支持 `classic Outlook`
- 仅支持 `Windows`
- 默认只读，不写回 Outlook
- 默认通过 `GitHub Copilot` 做 AI 分析
- 优先模型顺序：`5.5 -> 5.4`

## 实现要求

- `src/` 中使用 `TypeScript`
- `scripts/` 中放 Windows 执行脚本和 VBS 采集器
- `prompts/` 中放 AI 提示词
- `releases/` 中放带版本号的 VSIX 包

