# TODO

## 当前交付状态

- [x] 创建 `easy-mail` 项目目录。
- [x] 编写总体设计文档。
- [x] 编写 step by step 实现步骤。
- [x] 编写 VSIX 构建说明。
- [x] 编写安全与合规边界。
- [x] 初始化本地 git repo。
- [x] 创建 GitHub repo：`Wsr-7/easy-mail`。
- [x] 推送 `main` 分支。

## POC 实现任务

- [x] 实现 `scripts/collect-outlook-mails.vbs`。
- [x] 支持最近 N 封邮件采集。
- [x] 支持最近 N 小时邮件采集。
- [x] 支持指定一个或多个 Outlook 文件夹。
- [x] 输出 `data/mail-digest.md`。
- [x] 创建 VS Code extension TypeScript 骨架。
- [x] 实现 sidebar / dashboard。
- [x] 调用 VBScript 生成 digest。
- [x] 调用 VS Code Language Model API 使用 GitHub Copilot。
- [x] 生成 `data/analysis-result.json`。
- [x] 生成 `data/mail-summary.md`。
- [x] 打包 `.vsix`。

## 当前阻塞

- 无代码层阻塞。
- 仍需在另一台 `Windows + classic Outlook + VS Code + GitHub Copilot` 机器上做真实人工联调。
