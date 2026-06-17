- [x] 对设计文档做实现级补充，并固化验收标准
- [x] 实现 `collect-outlook-mails.vbs`
- [x] 实现 sample digest 生成路径
- [x] 实现 VS Code 扩展清单和入口
- [x] 实现本地配置与数据目录管理
- [x] 实现 `Pull Mail`
- [x] 实现 `Analyze with Copilot`
- [x] 实现 JSON 校验与 Markdown summary 生成
- [x] 实现 dashboard webview
- [x] 实现 `Copy Draft` / `Ignore` 交互
- [x] 实现本地自动化测试
- [x] 尝试打包 `.vsix`
- [x] 更新文档
- [x] 运行验证
- [x] 提交并推送

## 验收要求

- [x] 本地 sample 流程可跑通
- [x] 关键逻辑有测试
- [x] 远端仓库已更新

## 当前迭代

- [x] 定位 dashboard 现有实现
- [x] 增加 Pull / Analyze 进度反馈
- [x] 设置区改为按需展开
- [x] 让 `outputLanguage` 同时控制 UI 语言
- [x] 更新文档
- [x] 运行验证并推送

## 渐进式分析迭代

- [x] 固化设计文档
- [x] 新增 mail store 与稳定去重 id
- [x] 新增 pending / blocked / analysed 队列状态
- [x] 新增 batch / selected 分析入口
- [x] 新增 classification gating 配置与默认分类器
- [x] 新增 prompt 组合与自定义分类配置
- [x] 更新 dashboard 控件和文档
- [x] 增加测试并打包
- [x] 提交并推送

## v0.2 / Issue 1: Single Mail Analysis Schema and Evidence

- [x] 目标：只实现 `email-analysis-repo-specific-implementation-plan.md` 中 v0.2 / Issue 1
- [x] 验收：旧 JSON 仍可解析
- [x] 验收：新 JSON 中 optional `source` / `evidence` 可保留
- [x] 验收：summary 可选显示 evidence
- [x] 验收：`prompts/output-schema.md` 描述新增字段
- [x] 验收：`npm test` 通过

### Working Notes

- `architecture-background.md` 只作为背景；本轮唯一执行依据是 `docs/v2-design/email-analysis-repo-specific-implementation-plan.md`。
- 不实现 Issue 2/3，不改 thread/security gate，不打包，除非后续明确要求。
- 保留 existing single mail analysis pipeline，不改变 category / priority / draft reply 行为。

## v0.3 Wave 0-1: Thread Timeline MVP Data Layer

- [x] Wave 0：确认 v0.2 / Issue 1 成果存在
- [x] Wave 0：baseline `npm test` 通过
- [x] Wave 1A：Thread Data fields
- [x] Wave 1B：Thread Store / Engine
- [x] Wave 1C：Thread Timeline helpers
- [x] Wave 1：统一验证 `npm test`

### Working Notes

- 本阶段从 `docs/v2-design/email-analysis-repo-specific-implementation-plan.md` 的 v0.3 Thread Timeline MVP 开始。
- `src/extension.ts` 暂不修改，留给后续 Thread Timeline Integration Agent。
- `scripts/collect-outlook-mails.vbs`、`src/lib/digest.ts`、`src/lib/mail-store.ts` 归 Thread Data Agent。
- `src/lib/thread-store.ts` / `src/lib/thread-engine.ts` 归 Thread Engine Agent。
- `src/lib/thread-timeline.ts` 归 Thread Timeline Agent。

## v0.3 Wave 1 Integration: Thread Timeline MVP

- [x] pull mail 后写入 `thread-store.json`
- [x] `thread-store` 合并新旧线程，避免分析后清空 `mail-store` 导致线程上下文立即丢失
- [x] clear local cache 同步清空 thread store
- [x] Dashboard 显示 Threads 面板和 thread 统计
- [x] 邮件卡片显示所属 thread，并可跳转到 thread card
- [x] Thread timeline mailId 可跳回邮件卡片
- [x] `npm test` 通过

### Working Notes

- 本轮只完成 v0.3 Thread Timeline 阅读能力，不调用 Copilot 做 Thread AI。
- 没有新增 Outlook 写回能力，仍保持只读。
- `src/extension.ts` 只做 thread-store 接入和 dashboard render 扩展。

## v0.4 Wave 2: Redaction + Security Gate

- [x] Wave 2E：新增 Redaction 纯模块和单测
- [x] Wave 2F：新增 Security Gate 纯模块和单测
- [x] Wave 2：统一接入测试脚本并运行 `npm test`
- [x] Wave 2：提交纯模块小提交
- [x] Wave 2 Integration：分析入口过滤 block，手动选择允许 manual_confirm
- [x] Wave 2 Integration：AI payload 使用 redacted mail digest
- [x] Wave 2 Integration：Dashboard 显示 mail/thread security 状态
- [x] Wave 2 Integration：统一验证 `npm test`

### Working Notes

- 本阶段先不接 `src/extension.ts`，不改变现有 Single Mail 分析入口。
- `classification.ts` 保持为 Security Gate 的输入，不推倒重写。
- Wave 2 Integration 已接入 redacted payload、block/manual_confirm 行为和 Dashboard 安全状态。

## v0.5 Wave 3: Thread AI Foundation

- [x] 当前状态：`main` 已同步远端，Wave 2 完成且工作树干净
- [x] 决策：先做 Thread AI schema / prompt builder 纯模块，不接 UI / Copilot
- [x] 新增 `thread-analysis-schema.ts` 和 schema tests
- [x] 新增 `thread-prompt-builder.ts`、thread prompts 和 prompt builder tests
- [x] 运行 `npm test`
- [x] 提交 v0.5 foundation 小提交

### Working Notes

- 本切片不修改 `src/extension.ts`，避免把 Thread AI command、Dashboard 和 Copilot 调用一次性混入。
- Thread prompt 输入使用 JSON-like timeline，不复用 single mail Markdown digest。
- Provider abstraction 仍然推迟到 Thread AI 跑通之后。

## v0.6 Wave 3: Reports Foundation

- [x] 新增 single mail report 纯模块和测试
- [x] 新增 thread report 纯模块和测试
- [x] 新增 daily brief 纯模块和测试
- [x] 接入主 `npm test`
- [x] 提交 reports foundation 小提交

### Working Notes

- Reports 只消费已分析结果字段，不读取 mail-store 原始正文。
- Reports 暂不接 Dashboard / commands，留给后续 Integration Agent 决定入口。

## v0.5 Wave 3 Integration: Thread AI

- [x] 新增 `thread-analysis-result.json` 读写
- [x] 新增 `Analyze Thread` command / Dashboard 入口
- [x] Thread AI prompt 使用 redacted timeline
- [x] blocked thread 不进入模型
- [x] Dashboard 展示 Thread Analysis 摘要
- [x] 运行 `npm test`

### Working Notes

- 本阶段仍然不做 Provider abstraction。
- Reports 生成器已存在，但暂不接 Dashboard / commands。

## Wave 3.5: Reports Integration

- [x] 新增 Daily Brief / Thread Report / Single Mail Report 生成入口
- [x] Dashboard 增加报告生成和打开按钮
- [x] 报告写入本地 `data/*.md`
- [x] 运行 `npm test`

### Working Notes

- 本切片只接入现有 report 纯模块，不做 Provider abstraction。
- 报告只消费已分析结果，不读取 `mail-store` 原始正文。

### Results

- 新增 `Generate Reports` / `Open Daily Brief` / `Open Thread Report` / `Open Single Mail Report` 命令和 Dashboard 按钮。
- 报告文件输出到本地 data 目录：`daily-brief.md`、`thread-report.md`、`single-mail-report.md`。
- `npm test` 通过。

## Wave 4: Provider Abstraction

- [x] 新增 `LlmProvider` 接口和模型选择 helpers
- [x] 新增 `CopilotProvider`，复用当前 `vscode.lm` 行为
- [x] 新增 `MockProvider` 和 provider unit tests
- [x] Single Mail AI / Thread AI 统一走 provider
- [x] 运行 `npm test`

### Working Notes

- 本阶段最后做 Provider abstraction，不再改 Thread AI / Reports 业务逻辑。
- 不实现复杂 OpenAI-compatible / internal API provider，只预留接口边界。
- `src/extension.ts` 是高冲突集成文件，由主线程串行修改。

### Results

- 新增 provider 边界：`llm-provider.ts`、`copilot-provider.ts`、`mock-provider.ts`。
- Dashboard 模型列表与分析发送路径共用同一套模型选择 helper。
- Single Mail AI 和 Thread AI 继续使用 Copilot，但经由 `LlmProvider` 调用。
- `npm test` 通过。
