# TODO

## 当前交付状态

- [x] 创建 `email-analysis` 项目目录。
- [x] 编写总体设计文档。
- [x] 编写 step by step 实现步骤。
- [x] 编写 VSIX 构建说明。
- [x] 编写安全与合规边界。
- [x] 初始化本地 git repo。
- [ ] 创建 GitHub repo：`Wsr-7/email-analysis`。
- [ ] 推送 `main` 分支。

## POC 实现任务

- [ ] 实现 `scripts/collect-outlook-mails.vbs`。
- [ ] 支持最近 N 封邮件采集。
- [ ] 支持最近 N 小时邮件采集。
- [ ] 支持指定一个或多个 Outlook 文件夹。
- [ ] 输出 `data/mail-digest.md`。
- [ ] 创建 VS Code extension TypeScript 骨架。
- [ ] 实现 sidebar / dashboard。
- [ ] 调用 VBScript 生成 digest。
- [ ] 调用 VS Code Language Model API 使用 GitHub Copilot。
- [ ] 生成 `data/analysis-result.json`。
- [ ] 生成 `data/mail-summary.md`。
- [ ] 打包 `.vsix`。

## 当前阻塞

- `gh auth status` 显示 `Wsr-7` 当前 token invalid，需要重新认证或让当前 Codex 进程可见有效 `GH_TOKEN` / `GITHUB_TOKEN`。
- 当前进程、Windows 用户级环境变量、机器级环境变量均未发现 `GH_TOKEN` / `GITHUB_TOKEN`。
- 已尝试 `gh auth login` 和 `gh auth refresh`，两次都在交互授权阶段超时，尚未完成认证。
