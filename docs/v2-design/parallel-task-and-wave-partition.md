请使用 parallel-goals-for-a-task skill（刚刚创建到.codex/skills全局skills目录下，不确定是否已经加载完成并可用），把剩余工作拆成适合并行 subagent 执行的 goals，并在我确认后执行。  
保持之前的策略:email-analysis-repo-specific-implementation-plan.md为主要执行依据。如email-analysis-new-architecture-design.md只作为背景参考；如果两份文档有冲突，或者以下内容与implementation plan 有冲突，都以 repo-specific implementation plan 为准。。  
  
核心目标：  
Build the remaining next-stage email-analysis architecture in the current VS Code extension / TypeScript / VBScript repo. Preserve the completed v0.2 Single Mail Analysis work, then add Thread Timeline, Thread Store, Thread Engine, Security Gate and Redaction, Thread-level Analysis, unified reports, and later LLM Provider abstraction. The project must remain read-only: no PST/OST parsing, no automatic sending, no deleting, no moving, no archiving, no marking read/unread, and no writeback to Outlook. Output should be incremental repo changes with tests, not a huge risky rewrite.  
最重要的并行规则：  
1. 不要按 v0.3、v0.4、v0.5、v0.6 这种大版本粒度直接并行。  
2. 要按 Wave + 文件所有权 + Integration Agent 拆分。  
3. 纯新增模块可以并行。  
4. 共享核心文件必须串行集成。  
5. src/extension.ts 只能由 Integration Agent 修改，其他 subagent 默认不要改。  
6. src/lib/mail-store.ts、scripts/collect-outlook-mails.vbs、src/lib/digest.ts、src/lib/dashboard-state.ts 都是高冲突文件，要明确文件 owner。  
7. 不要一次性实现所有路线图。每个 Wave 完成后必须跑测试并确认现有 Single Mail pipeline 不退化。  
8. 不要做无关重构，不要格式化整个项目，不要引入新依赖，除非明确说明必要性。  
9. 每个 subagent 必须说明它可以修改哪些文件、不能修改哪些文件、交付物是什么、如何验证。  
10. 如果多个 subagent 的建议冲突，由主 agent 或 Integration Agent 统一裁决。  
11. 已完成的 v0.2 / Issue 1 只允许做兼容性检查和小修，不允许推倒重来。  
请从以下 Wave 开始规划：  
Wave 0：Current State Verification / Baseline Check 由一个 agent 先做，不并行。  
目标：  
* 快速审查当前仓库状态。  
* 确认 v0.2 / Issue 1 已完成。  
* 跑 baseline tests。  
* 列出后续实现可以依赖的现有类型、schema、tests、prompt、summary 输出。  
* 不改业务逻辑，除非发现非常小的编译或测试修复。  
建议检查：  
* src/lib/analysis-schema.ts  
* src/lib/summary.ts  
* prompts/output-schema.md  
* 相关 tests  
* src/lib/mail-store.ts  
* src/extension.ts  
* src/lib/classification.ts  
完成标准：  
* npm test 通过，或说明失败原因。  
* 明确哪些 v0.2 / Issue 1 内容已经存在。  
* 明确剩余工作从 v0.3 开始。  
* 不破坏当前 Single Mail Analysis。  
Wave 1：v0.3 Thread Timeline Data Layer 可以部分并行，但 collector/digest/stored mail 字段强相关，建议把采集和存储字段交给同一个 agent。  
建议拆成：  
Agent A：Thread Data Agent 负责文件：  
* scripts/collect-outlook-mails.vbs  
* src/lib/digest.ts  
* src/lib/mail-store.ts  
* 相关 tests  
目标：  
* 在 VBS 采集中增加 conversation/thread 相关字段。  
* 至少包括 conversationId、conversationIndex。  
* 可选增加 sentOn、to、cc、attachmentCount、attachmentNames 等 metadata。  
* DigestItem / StoredMail 兼容新增字段。  
* 旧 digest 和旧 store 数据仍能解析。  
* VBS 字段读取必须安全兜底，字段为空不能导致采集失败。  
* 不改变当前 single mail pipeline 行为。  
* 不接入 Dashboard。  
* 不做 Thread AI。  
边界：  
* 可以改 collector / digest / mail-store。  
* 不要改 src/extension.ts，除非主 Integration Agent 明确要求。  
* 不要改 Dashboard UI。  
验证：  
* 新增或更新 digest/mail-store tests。  
* 使用 sample mode 或 fixture 验证旧字段和新增字段都能解析。  
* npm test。  
Agent B：Thread Engine Agent 负责文件：  
* src/lib/thread-schema.ts  
* src/lib/thread-store.ts  
* src/lib/thread-engine.ts  
* 相关 tests  
目标：  
* 新增 ThreadRecord / ThreadMessage / ThreadStore 数据结构。  
* 从 StoredMail[] 构建 ThreadRecord[]。  
* 按 conversationId 聚合。  
* conversationId 缺失时 fallback 到 normalizedSubject 或其他保守策略。  
* 生成 participants / folders / startTime / lastTime / messageCount / sourceMailIds / timeline。  
* 不接 extension。  
* 不接 Dashboard。  
* 不做 AI。  
边界：  
* 不改 src/extension.ts。  
* 不改 VBS collector。  
* 不改 mail-store，除非只是读取已有类型。  
验证：  
* thread-engine unit tests。  
* 覆盖单封邮件、同 conversationId 多封邮件、conversationId 缺失 fallback、时间排序。  
Agent C：Thread Timeline Agent 负责文件：  
* src/lib/thread-timeline.ts  
* 相关 tests  
目标：  
* 实现 cleanMailBody。  
* 实现 extractReplyDelta。  
* 实现 hashBody。  
* 实现 markDuplicateBodies。  
* 支持基础中英文 Outlook 引用头切割。  
* 降低长邮件链重复引用污染。  
* 这是纯函数模块，不接 extension，不接 Dashboard。  
边界：  
* 不改 src/extension.ts。  
* 不改 collector。  
* 不改 mail-store。  
* 不做 AI。  
验证：  
* 针对英文 From/Sent/To/Subject 引用头测试。  
* 针对中文 发件人/发送时间/收件人/主题 引用头测试。  
* 针对重复正文 hash 去重测试。  
Wave 1 Integration：Thread Timeline MVP Integration 由单独 Integration Agent 执行。  
Agent D：Thread Timeline Integration Agent 负责文件：  
* src/extension.ts  
* src/lib/dashboard-state.ts  
* 必要的 tests  
目标：  
* 在 pull mail 后构建或刷新 thread-store.json。  
* Dashboard 新增 Threads View。  
* 保留现有 Mail View，不弱化 single mail 分类面板。  
* Mail card 可以显示所属 thread 信息。  
* Thread card 显示 subject / participants / messageCount / lastTime。  
* Thread detail 显示 timeline。  
* Mail detail 和 Thread detail 可以互相跳转。  
* v0.3 只做 timeline 阅读能力，不做 Thread AI。  
* 确保当前 single mail analysis、mail-summary、analysis-result 行为不回归。  
边界：  
* 不重新实现 Thread Engine / Timeline 逻辑，只接入已有模块。  
* 不做 Security Gate 大改。  
* 不做 Provider 抽象。  
验证：  
* npm test。  
* sample mode 能展示 Mail View。  
* sample mode 能展示 Threads View。  
* 现有 Single Mail Dashboard 仍可用。  
Wave 2：v0.4 Security Gate + Redaction 可以部分并行。  
Agent E：Redaction Agent 负责文件：  
* src/lib/redaction.ts  
* 相关 tests  
目标：  
* 实现 email / phone / url / ip / token / money / customPatterns 脱敏。  
* 输出 RedactionResult 和 stats。  
* 不接 extension。  
* 不接 Dashboard。  
验证：  
* redaction unit tests。  
* 覆盖常见敏感信息和 custom pattern。  
Agent F：Unified Security Gate Agent 负责文件：  
* src/lib/security-gate.ts  
* src/lib/security-types.ts  
* 相关 tests  
目标：  
* 在现有 v0.2/v0.3 基础上扩展 security gate。  
* 支持 mail-level gate。  
* 支持 thread-level gate。  
* 支持 allow / manual_confirm / block。  
* 支持 partialContext。  
* 与 redaction 类型集成，但不要直接接 extension。  
* 保持已有 classification gating 兼容。  
验证：  
* mail-level gate tests。  
* thread-level gate tests。  
* partial context tests。  
* block/manual/allow 分支 tests。  
Wave 2 Integration：  
Agent G：Security Integration Agent 负责文件：  
* src/extension.ts  
* src/lib/dashboard-state.ts  
* 必要 tests  
目标：  
* 分析入口接入 Security Gate。  
* block 项不能进入模型。  
* manual_confirm 项需要用户明确操作。  
* AI payload 默认使用 redacted content。  
* Dashboard 显示安全状态。  
* Thread 分析前检查 partial context。  
* 不自动发送、不移动、不删除、不写回 Outlook。  
验证：  
* npm test。  
* sample data 中能看到 allow/manual/block 状态。  
* 现有 single mail analysis 不回归。  
Wave 3：v0.5 Thread-level AI + v0.6 Reports 先做 Thread AI schema 和 reports，最后再做 provider abstraction。不要把 Provider 抽象和 Thread AI Integration 同时做。  
Agent H：Thread AI Schema / Prompt Agent 负责文件：  
* src/lib/thread-analysis-schema.ts  
* 相关 tests  
* prompts/thread-analysis-prompt.md  
* prompts/thread-output-schema.md  
目标：  
* 定义 ThreadAnalysisResult。  
* 支持 currentStatus / decisions / openQuestions / actionItems / risks / needMyReply / draftReply / evidence sourceMailId / needsOriginalMailCheck。  
* 设计 thread analysis prompt。  
* 输入应基于 redacted timeline。  
* 不接 extension。  
验证：  
* schema normalization tests。  
* JSON parse / validation tests。  
* prompt fixture 测试，如果项目已有类似测试风格则沿用。  
Agent I：Reports Agent 负责文件：  
* src/lib/report-thread.ts  
* src/lib/report-daily.ts  
* src/lib/report-single-mail.ts  
* 相关 tests  
目标：  
* 生成 Daily Brief。  
* 生成 Single Mail Report。  
* 生成 Thread Report。  
* 报告必须遵守 Security Gate / Redaction 结果。  
* 不接 Dashboard，除非 Integration Agent 要求。  
验证：  
* markdown snapshot 或 string tests。  
* 确认 blocked/redacted 内容不会泄露。  
Wave 3 Integration：  
Agent J：Thread AI Integration Agent 负责文件：  
* src/extension.ts  
* src/lib/dashboard-state.ts  
* 必要 tests  
目标：  
* 新增 analyzeThread command 或对应入口。  
* 从 thread-store 构建 redacted timeline payload。  
* 调用当前 Copilot 逻辑。  
* 写入 thread-analysis-result.json 或合适的新结果文件。  
* Dashboard 展示 thread analysis。  
* 不同时做 Provider Abstraction。  
验证：  
* npm test。  
* sample mode 不依赖真实 Outlook。  
* 现有 single mail analysis 不回归。  
* Thread Timeline 未分析时仍可独立使用。  
Wave 4：v0.6 Provider Abstraction 最后做。  
Agent K：Provider Abstraction Agent 负责文件：  
* src/lib/llm-provider.ts  
* src/lib/copilot-provider.ts  
* src/lib/mock-provider.ts  
* 相关 tests  
目标：  
* 在 Single Mail AI 和 Thread AI 都跑通后，再抽象模型调用。  
* 保留当前 Copilot provider 行为。  
* 增加 MockProvider 方便测试。  
* 预留 OpenAI-compatible / internal API provider 接口，但不要强行实现复杂 provider。  
验证：  
* provider unit tests。  
* 现有 Copilot 调用路径行为不变。  
* npm test。  
文件所有权规则：  
* src/extension.ts：Integration Agent only，高冲突。  
* src/lib/dashboard-state.ts：UI/Integration Agent only，高冲突。  
* scripts/collect-outlook-mails.vbs：Thread Data Agent only。  
* src/lib/digest.ts：Thread Data Agent only。  
* src/lib/mail-store.ts：Thread Data Agent only。  
* src/lib/analysis-schema.ts：v0.2/Issue1 已完成，除非修 bug，否则不要改。  
* src/lib/summary.ts：v0.2/Issue1 已完成，除非修 bug，否则不要改。  
* src/lib/thread-store.ts、src/lib/thread-engine.ts：Thread Engine Agent only。  
* src/lib/thread-timeline.ts：Thread Timeline Agent only。  
* src/lib/redaction.ts：Redaction Agent only。  
* src/lib/security-gate.ts：Security Agent only。  
* src/lib/report-*.ts：Reports Agent only。  
* prompts/*：对应 Prompt/Schema Agent 修改，避免多人同时改同一个 prompt。  
所有 subagent 都必须遵守：  
* 不要自动发送、删除、移动、归档、标记 Outlook 邮件。  
* 不做 PST/OST 解析。  
* 不把原始正文长期落盘。  
* 不破坏当前 single mail analysis。  
* 不做无关重构。  
* 不引入新依赖，除非说明原因并获得主 agent 接受。  
* 每个任务必须有测试或明确验证方式。  
* 每次集成后运行 npm test。  
* 如果当前仓库没有覆盖某些测试，至少新增针对本模块的 unit tests。  
* 如果测试无法运行，说明原因、已做的静态验证、以及需要人工验证的步骤。  
请先输出：  
1. Filled Brief。  
2. Top-level goal。  
3. Parallel dispatch plan，按 Wave 拆分。  
4. 每个 subagent 的 /goal prompt。  
5. 推荐执行顺序和合并顺序。  
6. 风险控制策略。  
7. 第一批应该立即执行的 goals。  
请注意：第一批应该从 Current State Verification + v0.3 Thread Timeline Data Layer 开始，不要重新做 v0.2 / Issue 1，不要直接跳到 Thread AI 或 Provider Abstraction。  
请按这个计划开始执行 Wave 0 和 Wave 1，完成后汇报 diff、测试结果、风险点和下一步建议。  
