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
