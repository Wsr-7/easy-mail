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
- 支持在看板中配置拉取参数、分析语言和模型 family
- 支持可折叠分类面板
- 生成：
  - `mail-digest.md`
  - `analysis-result.json`
  - `mail-summary.md`

更多说明见：

- [user guide.md](./user%20guide.md)
- [setup.md](./setup.md)
- [docs/acceptance-criteria.md](./docs/acceptance-criteria.md)
