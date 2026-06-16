# Email Analysis POC

`Email Analysis POC` 是一个面向 `classic Outlook + VS Code + GitHub Copilot` 的本地邮件分析插件原型。

它完成这条本地链路：

```text
classic Outlook
  -> VBScript 采集邮件
  -> mail-digest.md
  -> VS Code 插件调用 Copilot
  -> analysis-result.json
  -> Dashboard + mail-summary.md
```

## 根目录结构

```text
prompts/     Copilot 分析提示词
scripts/     VBScript 与构建/验证脚本
src/         TypeScript 插件源码
releases/    打包生成的带版本号 VSIX
```

## 关键能力

- 支持 `最近 N 封` 与 `最近 N 小时`
- 支持 `指定一个或多个 Outlook 文件夹`
- 支持 `sample mode`，无 Outlook 也能演示
- 支持 `GitHub Copilot` 模型分析，默认优先请求 `gpt-5.4`，不可用时使用 VS Code 当前可用的 Copilot 模型
- 支持在看板中配置拉取参数、界面/分析语言和模型 family
- 支持 Pull / Analyze 任务进度提示，避免长任务无反馈
- 支持渐进式分析：拉取后进入本地 JSON mail store，按批次或选中邮件分析
- 支持优先用 `InternetMessageId` / `EntryId` 去重，缺失时才使用 hash 兜底
- 支持未分析、已分析、需手动确认统计和面板
- 支持短期原文缓存、7 天去重索引、7 天分析摘要和手动清理本地缓存
- 支持 classification gating：超过配置密级的邮件不会自动送 Copilot，密级为 `PUBLIC` / `INTERNAL` / `REGISTERED` / `HIGH REGISTERED`
- 支持自定义分类 prompt，程序会组合 prompt 后分析邮件
- 支持重点发件人/邮件组分类 `importantSender`
- 支持可折叠分类面板
- 生成：
  - `mail-digest.md`
  - `mail-store.json`
  - `mail-index.json`
  - `classification-cache.json`
  - `analysis-result.json`
  - `mail-summary.md`

更多说明见：

- [user guide.md](./user%20guide.md)
- [setup.md](./setup.md)
- [docs/acceptance-criteria.md](./docs/acceptance-criteria.md)
