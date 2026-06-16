# Email Analysis

本项目用于验证一条不依赖 Microsoft Graph Mail API 的邮件 AI 分析路线：

```text
classic Outlook
  -> VBScript 采集邮件并生成 Markdown
  -> VS Code 插件读取 Markdown
  -> GitHub Copilot Language Model API 生成结构化 JSON
  -> VS Code sidebar / dashboard 展示分类、优先级、行动项和回复草稿
```

## 当前目标

- 先做本地 POC，不接公司中心化服务。
- 支持 classic Outlook，本机通过 Outlook COM 读取邮件。
- 支持自定义拉取范围：最近 N 封、最近 N 小时。
- 支持只扫描指定 Outlook 文件夹。
- 输入数据使用 Markdown，AI 输出使用 JSON，看板再生成 Markdown 总结。
- VS Code 插件可打包为 `.vsix`，即使当前机器没有安装 VS Code，也可以用 Node.js 工具链构建。

## 文档

- [设计方案](docs/design.md)
- [实现步骤](docs/implementation-steps.md)
- [VSIX 构建与发布](docs/vsix-build.md)
- [安全与合规边界](docs/security.md)

## 非目标

- 不自动删除邮件。
- 不自动发送邮件。
- 不绕过公司 PowerShell Constrained Language 策略。
- 不解析 `.ost` 文件。
- 不支持 new Outlook 后台本地扫描。

