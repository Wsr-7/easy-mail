# Email Analysis 0.2+ Repo-Specific 新版设计架构与 Codex 实施方案

> 版本：repo 源码审阅版  
> 基于源码包：`email-analysis-0.1 2.zip`  
> 当前项目形态：VS Code Extension POC，面向 `Windows + classic Outlook + GitHub Copilot`  
> 目标读者：后续接手实现的 Codex / AI Coding Agent / 开发者  
> 核心原则：**只读、本地、安全、Single Mail 与 Thread Mail 双一等公民**

---

## 0. 这份文档和上一版架构文档的关系

上一版文档是架构蓝图，主要回答：项目应该往哪里演进、为什么要做 Thread Timeline、为什么要做 Security Gate、为什么坚持只读。

这份文档是在完整解压并审阅当前源码结构后的 **repo-specific 实施版**，重点回答：

1. 当前仓库已有代码是什么样。
2. 哪些地方可以直接复用。
3. 哪些地方必须先补齐。
4. 每个版本应该改哪些文件。
5. 每个阶段怎么交给 Codex 执行。
6. 哪些实现风险会影响后续功能。

如果两份文档有表达差异，以本文件的执行顺序为准；但上一版中的产品边界和总体方向仍然有效。

---

## 1. 项目最终定位

当前项目不应该继续定位为简单的 “Email Analysis POC”。建议演进为：

> **Local Read-only Outlook Mail Intelligence Desk**  
> 一个面向 classic Outlook 的本地只读邮件分析工作台，同时支持单封邮件分析与邮件线程分析。

中文定位：

> **本地只读 Outlook 邮件智能工作台**：用于单封邮件分拣、长邮件链时间线重建、AI 总结、待办识别、回复草稿与报告生成。

核心表达：

```text
Single Mail Analysis gives breadth.
Thread Analysis gives depth.
Security Gate defines the boundary.
Reports turn analysis into working artifacts.
```

中文表达：

```text
单封邮件分析负责快速覆盖。
线程邮件分析负责深入理解。
安全门负责定义边界。
报告负责沉淀工作产物。
```

---

## 2. 固定边界：哪些永远不做

这些原则应该写进 `README.md`、`docs/security.md`、`agents.md`，也应该作为 Codex 后续实现时的硬约束。

```text
1. 不做 PST / OST 解析。
2. 不自动发送邮件。
3. 不自动删除邮件。
4. 不自动移动邮件。
5. 不自动写回 Outlook category / flag / read state。
6. 不读取附件正文。第一阶段只读取附件 metadata。
7. 不绕过 Outlook / Windows / 企业安全策略。
8. 不做后台 Windows Service。
9. 不做服务器端 Office 自动化。
10. 不默认长期保存原始正文。
```

当前项目的正确边界是：

```text
classic Outlook 本地只读采集
-> 本地短期缓存
-> 安全过滤 / 脱敏
-> 用户可控地调用 Copilot / 后续内部模型
-> 本地 Dashboard / Markdown 报告
```

---

## 3. 当前源码结构审计

### 3.1 当前目录结构

当前 zip 解压后的主要结构如下：

```text
email-analysis-0.1/
  README.md
  TODO.md
  agents.md
  default-config.json
  package.json
  prompts/
    analysis-prompt.md
    base-system.md
    output-schema.md
    prompt-config.default.json
  scripts/
    collect-outlook-mails.vbs
    clean-out.js
    package-dev-vsix.js
    run-sample-validation.ps1
    classify-mail.sample.js
  src/
    extension.ts
    lib/
      analysis-schema.ts
      classification.ts
      dashboard-state.ts
      digest.ts
      mail-store.ts
      prompt-config.ts
      summary.ts
    test/
      analysis-schema.test.ts
      classification.test.ts
      dashboard-state.test.ts
      digest.test.ts
      mail-store.test.ts
      prompt-config.test.ts
      summary.test.ts
  docs/
    design.md
    implementation-steps.md
    progressive-analysis-design.md
    security.md
    acceptance-criteria.md
```

### 3.2 当前已完成能力

当前项目已经不是纯脚本 Demo，而是一个可打包 VSIX 的 VS Code 插件 POC。

已具备：

```text
1. classic Outlook -> VBScript -> mail-digest.md。
2. VS Code extension 调用 cscript.exe。
3. 解析 Markdown digest。
4. 生成 mail-store.json。
5. 使用 InternetMessageId / EntryId / hash 做稳定去重。
6. 维护 mail-index.json 与 folder anchors，支持 More History。
7. classification-cache.json。
8. analysis-result.json。
9. mail-summary.md。
10. GitHub Copilot Language Model API 调用。
11. Prompt config 自定义分类。
12. 重要发件人 importantSender。
13. Dashboard Webview。
14. Pending / blocked / analysed 队列。
15. Analyze Next Batch / Analyze Selected / Analyze All Allowed。
16. Copy Draft / Ignore。
17. 本地 cache retention。
18. 基础测试。
```

### 3.3 当前关键模块职责

#### `src/extension.ts`

这是当前最大文件，承担了太多职责：

```text
1. VS Code command 注册。
2. 调用 VBS 采集器。
3. 读取 / 写入配置。
4. 读取 / 写入所有 data 文件。
5. 调用 Copilot 模型。
6. 合并 analysis-result。
7. 构造 DashboardState。
8. 渲染完整 HTML / CSS / JS。
9. 处理 webview message。
10. 日志。
```

短期不建议大拆，否则会拖慢功能实现。推荐策略是：

```text
v0.2-v0.4：保持 extension.ts 作为应用编排层，只把新增核心逻辑放到 src/lib。
v0.6 后：再逐步抽出 dashboard-renderer、app-storage、llm-provider。
```

#### `scripts/collect-outlook-mails.vbs`

当前采集字段：

```text
mailId
internetMessageId
entryId
subject
senderName
senderEmail
receivedTime
sortKey
folderPath
unread
importance
toMe
ccMe
bodyExcerpt
```

当前没有采集：

```text
conversationId
conversationIndex
sentOn
to
cc
attachmentCount
attachmentNames
reply/forward marker
```

Thread Timeline 依赖 `conversationId` 和 `conversationIndex`，所以 v0.3 首先要改这里。

#### `src/lib/digest.ts`

当前只解析 Markdown digest。`DigestItem` 字段没有 conversation 相关字段。

短期可以继续扩展 Markdown schema，但中长期应该从 Markdown 机器传输迁移到 JSON。

#### `src/lib/mail-store.ts`

当前核心数据结构：

```ts
export interface StoredMail {
  mailId: string;
  sourceMailId: string;
  internetMessageId: string;
  entryId: string;
  subject: string;
  from: string;
  receivedTime: string;
  folder: string;
  unread: string;
  importance: string;
  toMe: string;
  ccMe: string;
  bodyExcerpt: string;
  pulledAt: string;
}
```

关键行为：

```text
1. mergeDigestIntoStore 会把新邮件合并进 mail-store.json。
2. mergeDigestIntoIndex 会维护去重索引和 folder anchors。
3. stableMailId 优先 InternetMessageId，其次 EntryId，最后 hash。
4. analyzeBatchCore 成功后会 removeStoredMailByIds，把已分析邮件从 mail-store.json 移除。
```

这个行为对当前 single mail 分析是合理的，因为它减少本地正文缓存；但对 Thread Timeline 是一个重要风险：

> 如果已分析邮件从 `mail-store.json` 移除，后续 Thread Timeline 可能丢失线程中的历史消息正文。

因此 v0.3 必须引入 ThreadStore 或 MailLedger 来保留线程所需的短期上下文。

#### `src/lib/classification.ts`

当前 classification 主要是基于关键字的本地密级判断：

```text
HIGH REGISTERED: high registered / highly restricted / secret
REGISTERED: registered / restricted / confidential / contract / budget
INTERNAL: 有 @ 或 Inbox
PUBLIC: fallback
```

当前 `buildQueueState` 的 blocked 本质上是：

```text
不能自动分析 / 需要手动确认
```

但它还不是完整 Security Gate。后续需要新增：

```text
allow / manual_confirm / block
redaction
hard block keywords
manual confirm keywords
partial context
thread-level gate
```

#### `src/lib/analysis-schema.ts`

当前分析结果是 single-mail-oriented：

```ts
export interface AnalysisItem {
  mailId: string;
  category: Category;
  priority: Priority;
  subject: string;
  sender: string;
  receivedTime: string;
  summary: string;
  reason: string;
  suggestedAction: string;
  draftReply: string;
  confidence: number;
  needsOriginalMailCheck: boolean;
}
```

这是单封邮件分析的好基础，不应该被 Thread Analysis 替代。

#### `src/lib/dashboard-state.ts`

当前只面向 single mail categories：

```text
mustHandleToday
importantSender
risk
waitingForMe
followUp
notice
uncertain
ignored
```

后续应该保持 Mail categories，同时新增 Thread views。

---

## 4. 新版总体架构

### 4.1 架构图

```text
classic Outlook
      │
      ▼
VBScript Collector
      │
      ├── mail-digest.md             # 兼容当前调试和人工查看
      │
      ▼
Digest Parser
      │
      ▼
Mail Store / Mail Index              # 当前已存在
      │
      ├── Single Mail Security Gate
      │       │
      │       ▼
      │   Single Mail AI Analysis
      │       │
      │       ▼
      │   analysis-result.json
      │
      └── Thread Engine
              │
              ▼
          thread-store.json
              │
              ▼
          Thread Security Gate
              │
              ▼
          Thread AI Analysis
              │
              ▼
          thread-analysis-result.json

Single Mail Result + Thread Result
      │
      ▼
Unified Dashboard
      │
      ▼
Reports
  - mail-summary.md
  - daily-brief.md
  - thread-report.md
  - weekly-pattern-report.md
```

### 4.2 核心设计原则

#### 原则 1：MailRecord 是事实层，ThreadRecord 是聚合视图

不能把 single mail 降级成 thread 的附属物。

```text
MailRecord: 一封邮件事实。
ThreadRecord: 多封邮件构成的上下文视图。
```

#### 原则 2：Single Mail 和 Thread Mail 是双一等公民

```text
单封邮件适合快速分拣、通知过滤、任务识别、回复草稿。
线程邮件适合长邮件链阅读、决策追踪、风险总结、上下文分析。
```

#### 原则 3：AI 分析必须经过 Security Gate

无论 single mail 还是 thread，进入模型之前必须经过：

```text
classification -> hard block -> manual confirm -> redaction -> payload build
```

#### 原则 4：Markdown 是人读产物，不应长期作为唯一机器数据格式

当前可继续兼容 `mail-digest.md`，但后续新增复杂结构时应优先 JSON。

---

## 5. 数据层新版设计

### 5.1 当前数据文件

当前已经存在：

```text
data/mail-digest.md
data/mail-store.json
data/mail-index.json
data/classification-cache.json
data/analysis-result.json
data/mail-summary.md
data/ignored.json
data/model-info.json
```

### 5.2 新增数据文件

建议逐步新增：

```text
data/thread-store.json
data/thread-analysis-result.json
data/security-decision-cache.json
data/redaction-cache.json                 # 可选，默认不落盘原文映射
data/daily-brief.md
data/thread-report.md
data/weekly-pattern-report.md
```

### 5.3 是否需要新增 `mail-ledger.json`

这是源码审阅后最重要的设计点。

当前 `mail-store.json` 是“待分析原文队列”，并且分析成功后会移除已分析邮件。Thread Timeline 需要跨批次聚合邮件。如果直接依赖 `mail-store.json`，会出现：

```text
1. 邮件 A/B/C 被拉取。
2. A/B 被分析并从 mail-store 移除。
3. 之后构建 thread 时只剩 C。
4. 时间线不完整。
```

因此有两个选择。

#### 选择 A：改变 `mail-store.json` 语义，不再分析后删除

优点：

```text
实现简单，Thread Engine 可直接使用 mail-store。
```

缺点：

```text
安全性变差，因为原文缓存时间变长。
与当前 docs/progressive-analysis-design.md 中“分析后移除原文”的设计冲突。
```

不推荐。

#### 选择 B：保留 `mail-store.json` 作为短期原文队列，新增 ThreadStore 保存线程视图

优点：

```text
兼容当前实现。
仍可保留分析后移除原文的安全策略。
Thread Timeline 可以有自己的 retention。
```

缺点：

```text
需要新增 thread-store merge/prune 逻辑。
需要定义 thread-store 中能保存哪些正文内容。
```

推荐。

### 5.4 推荐数据策略

推荐采用：

```text
mail-store.json:
  当前短期原文队列，继续服务 single mail analysis。
  可以在分析后移除已分析邮件。

mail-index.json:
  长一点的去重索引，不含正文。

thread-store.json:
  线程视图缓存，保存 metadata + 可配置保留期内的 bodyDelta/bodyPreview。
  默认 retention 与 mailStoreRetentionDays 一致，避免长期保存原文。

analysis-result.json:
  single mail AI 结果。

thread-analysis-result.json:
  thread AI 结果。
```

这样可以兼顾安全和 Thread Timeline。

---

## 6. 新增核心 TypeScript 数据结构

### 6.1 扩展 `DigestItem`

文件：`src/lib/digest.ts`

新增字段全部建议先做 optional / default empty，保证兼容旧 digest。

```ts
export interface DigestItem {
  mailId: string;
  internetMessageId: string;
  entryId: string;
  conversationId: string;
  conversationIndex: string;
  subject: string;
  from: string;
  senderName: string;
  senderEmail: string;
  receivedTime: string;
  sentTime: string;
  folder: string;
  unread: string;
  importance: string;
  toMe: string;
  ccMe: string;
  to: string;
  cc: string;
  attachmentCount: number;
  attachmentNames: string[];
  bodyExcerpt: string;
}
```

兼容原则：

```text
1. parseDigest 解析不到字段时填空字符串或 0。
2. 已有测试继续通过。
3. 新增测试覆盖 conversation 字段。
```

### 6.2 扩展 `StoredMail`

文件：`src/lib/mail-store.ts`

```ts
export interface StoredMail {
  mailId: string;
  sourceMailId: string;
  internetMessageId: string;
  entryId: string;
  conversationId: string;
  conversationIndex: string;
  subject: string;
  from: string;
  senderName: string;
  senderEmail: string;
  receivedTime: string;
  sentTime: string;
  folder: string;
  unread: string;
  importance: string;
  toMe: string;
  ccMe: string;
  to: string;
  cc: string;
  attachmentCount: number;
  attachmentNames: string[];
  bodyExcerpt: string;
  bodyHash: string;
  pulledAt: string;
}
```

注意：`from` 当前已经是 `Name <email>` 格式。为了后续脱敏和参与人聚合，建议新增 `senderName` / `senderEmail`，但保留 `from` 兼容旧 UI。

### 6.3 新增 `AnalysisTarget`

文件：`src/lib/analysis-target.ts`

```ts
import type { StoredMail } from "./mail-store";
import type { ThreadRecord } from "./thread-store";

export type AnalysisTargetType = "mail" | "thread";

export interface BaseAnalysisTarget {
  id: string;
  type: AnalysisTargetType;
  title: string;
  updatedAt: string;
}

export interface MailAnalysisTarget extends BaseAnalysisTarget {
  type: "mail";
  mail: StoredMail;
}

export interface ThreadAnalysisTarget extends BaseAnalysisTarget {
  type: "thread";
  thread: ThreadRecord;
}

export type AnalysisTarget = MailAnalysisTarget | ThreadAnalysisTarget;
```

v0.2 先引入，不一定马上大规模使用。它的作用是为 v0.5 的统一分析服务铺路。

### 6.4 新增 `ThreadStore`

文件：`src/lib/thread-store.ts`

```ts
export interface ThreadStore {
  generatedAt: string;
  lastBuiltAt: string;
  items: ThreadRecord[];
}

export interface ThreadRecord {
  threadId: string;
  conversationId: string;
  normalizedSubject: string;
  subject: string;
  participants: string[];
  folders: string[];
  startTime: string;
  lastTime: string;
  messageCount: number;
  unreadCount: number;
  hasAttachments: boolean;
  sourceMailIds: string[];
  timeline: ThreadMessage[];
  contentStatus: "available" | "partial" | "metadataOnly";
  security?: ThreadSecuritySummary;
}

export interface ThreadMessage {
  mailId: string;
  internetMessageId: string;
  entryId: string;
  conversationId: string;
  conversationIndex: string;
  subject: string;
  from: string;
  senderName: string;
  senderEmail: string;
  receivedTime: string;
  sentTime: string;
  folder: string;
  bodyPreview: string;
  bodyClean: string;
  bodyDelta: string;
  bodyHash: string;
  isDuplicateBody: boolean;
  contentAvailable: boolean;
  attachmentCount: number;
  attachmentNames: string[];
}

export interface ThreadSecuritySummary {
  totalMessages: number;
  allowedMessages: number;
  manualConfirmMessages: number;
  blockedMessages: number;
  highestClassificationLevel: number;
  partialContext: boolean;
  reasons: string[];
}
```

### 6.5 新增 `ThreadAnalysisResult`

文件：`src/lib/thread-analysis-schema.ts`

```ts
export interface ThreadAnalysisResult {
  generatedAt: string;
  overview: ThreadAnalysisOverview;
  items: ThreadAnalysisItem[];
}

export interface ThreadAnalysisOverview {
  totalThreads: number;
  mustHandleToday: number;
  risks: number;
  waitingForMe: number;
  notices: number;
}

export interface ThreadAnalysisItem {
  threadId: string;
  category: string;
  priority: "P0" | "P1" | "P2" | "P3";
  subject: string;
  participants: string[];
  lastTime: string;
  oneLineSummary: string;
  currentStatus: string;
  keyDecisions: string[];
  openQuestions: string[];
  actionItems: ThreadActionItem[];
  waitingOn: string[];
  risks: ThreadRisk[];
  needMyReply: boolean;
  suggestedAction: string;
  draftReply: string;
  confidence: number;
  evidence: ThreadEvidence[];
  needsOriginalMailCheck: boolean;
  partialContext: boolean;
}

export interface ThreadActionItem {
  owner: string;
  task: string;
  deadline: string;
  sourceMailId: string;
  sourceTime: string;
}

export interface ThreadRisk {
  level: "low" | "medium" | "high";
  description: string;
  sourceMailId: string;
}

export interface ThreadEvidence {
  sourceMailId: string;
  quote: string;
  reason: string;
}
```

---

## 7. Security Gate 设计

### 7.1 当前 classification 与新版 Security Gate 的关系

当前 `classification.ts` 不要删除。它应该变成 Security Gate 的一个输入。

当前：

```text
classification.ts:
  classifyMail -> MailClassification
  buildQueueState -> allowed / blocked / analysed
```

新版：

```text
classification.ts:
  只负责密级判断。

security-gate.ts:
  根据密级、关键词、用户配置、是否手动选择，决定 allow / manual_confirm / block。

redaction.ts:
  对允许进入模型的 payload 做脱敏。
```

### 7.2 新增 `redaction.ts`

文件：`src/lib/redaction.ts`

```ts
export interface RedactionPolicy {
  enabled: boolean;
  redactEmail: boolean;
  redactPhone: boolean;
  redactUrl: boolean;
  redactIp: boolean;
  redactToken: boolean;
  redactMoney: boolean;
  redactIdLike: boolean;
  customPatterns: RedactionPattern[];
}

export interface RedactionPattern {
  id: string;
  pattern: string;
  replacement: string;
}

export interface RedactionResult {
  text: string;
  findings: RedactionFinding[];
  stats: RedactionStats;
}

export interface RedactionFinding {
  type: string;
  replacement: string;
  count: number;
}

export interface RedactionStats {
  totalReplacements: number;
  byType: Record<string, number>;
}
```

第一版脱敏规则：

```text
email        -> [EMAIL_n]
phone        -> [PHONE_n]
url          -> [URL_n]
ip           -> [IP_n]
token/secret -> [SECRET_n]
money        -> [MONEY_n]
id-like      -> [ID_n]
```

注意：

```text
1. 默认不要把 [EMAIL_1] -> 原始邮箱 的映射落盘。
2. 如果未来要可逆脱敏，只能存在内存中，且用户关闭插件后消失。
3. 日志不要记录原始正文和原始敏感值。
```

### 7.3 新增 `security-gate.ts`

文件：`src/lib/security-gate.ts`

```ts
export type GateAction = "allow" | "manual_confirm" | "block";

export interface SecurityPolicy {
  enabled: boolean;
  autoAnalyzeEnabled: boolean;
  autoAnalyzeMaxClassificationLevel: number;
  hardBlockKeywords: string[];
  manualConfirmKeywords: string[];
  redaction: RedactionPolicy;
}

export interface GateDecision {
  targetId: string;
  targetType: "mail" | "thread";
  action: GateAction;
  classificationLevel: number;
  classificationLabel: string;
  reasons: string[];
  redactionStats: RedactionStats;
  partialContext: boolean;
  updatedAt: string;
}
```

规则：

```text
1. hardBlockKeywords 命中：block。
2. classification.level > maxAutoLevel：manual_confirm。
3. autoAnalyzeEnabled=false：manual_confirm。
4. manualConfirmKeywords 命中：manual_confirm。
5. 其他：allow。
6. 用户 Analyze Selected 可以允许 manual_confirm 项进入模型，但不能允许 block 项进入模型。
7. block 永远不能被自动或手动分析，除非未来明确新增 override 配置；当前不做 override。
```

### 7.4 Thread-level Security Gate

线程分析不能简单地“只要一封敏感就整个失败”。推荐：

```text
1. 对 thread 中每封 ThreadMessage 运行 Mail-level Gate。
2. block 的消息从 AI payload 中排除。
3. manual_confirm 的消息：
   - 自动分析时排除；
   - 用户手动 Analyze Thread 时允许进入，但仍要脱敏；
4. allow 的消息进入 payload。
5. 如果有消息被排除，ThreadAnalysisItem.partialContext = true。
6. Dashboard 提示：该线程分析基于部分上下文。
```

---

## 8. Thread Timeline 设计

### 8.1 Thread ID 策略

优先：

```text
thread:${conversationId}
```

如果没有 conversationId：

```text
thread-subject:${normalizedSubject}:${hash(participants + date bucket)}
```

实现函数：

```ts
export function stableThreadId(mail: StoredMail): string {
  if (mail.conversationId.trim()) {
    return `conversation:${mail.conversationId.trim()}`;
  }
  return `fallback:${sha256(normalizeSubject(mail.subject)).slice(0, 16)}`;
}
```

### 8.2 主题归一化

文件：`src/lib/thread-engine.ts`

```ts
export function normalizeSubject(subject: string): string {
  return String(subject || "")
    .replace(/^\s*(re|fw|fwd|答复|回复|转发)\s*[:：]\s*/i, "")
    .replace(/^\s*(re|fw|fwd)\s*\[\d+\]\s*[:：]\s*/i, "")
    .trim()
    .toLowerCase();
}
```

注意：这个只是 fallback，不要用它替代 ConversationID。

### 8.3 排序策略

优先顺序：

```text
1. conversationIndex lexicographic sort，如果字段可靠。
2. sentTime。
3. receivedTime。
4. mailId。
```

注意风险：

```text
ConversationIndex 在 VBS 输出中可能包含不可见字符或不适合 Markdown 的字符。
第一版先 SafeString 输出，如果排序异常，fallback 到 receivedTime。
中长期建议让采集器输出 JSON，并对 conversationIndex 做安全编码。
```

### 8.4 正文清洗与 delta 抽取

文件：`src/lib/thread-timeline.ts`

第一版用规则，不引入复杂库。

切割规则：

```text
-----Original Message-----
From:
Sent:
To:
Subject:
发件人:
发送时间:
收件人:
主题:
On ... wrote:
________________________________
```

实现函数：

```ts
export function cleanMailBody(text: string): string;
export function extractReplyDelta(cleanBody: string): string;
export function hashBody(text: string): string;
```

第一版不要求完美，只要能明显减少 Outlook 历史引用污染。

### 8.5 去重策略

线程内去重：

```text
1. 对 bodyDelta normalize 后 sha256。
2. 同一 thread 内相同 hash 只标记第一条为非重复。
3. 重复消息仍显示 metadata，但 body 可折叠或显示 “duplicate quoted content”。
```

---

## 9. Dashboard 新版设计

### 9.1 当前问题

当前 Dashboard HTML 全部在 `extension.ts#getDashboardHtml()` 中拼接，已经可以工作，但继续扩展会变得很难维护。

短期推荐：

```text
v0.2-v0.3 仍然在 extension.ts 中扩展 render 函数，避免大重构。
v0.4 后开始抽出 dashboard-renderer.ts。
```

### 9.2 新版 Tab 结构

建议新增顶部或次级导航：

```text
Today | Mail | Threads | Security Review | Reports
```

#### Today

融合 single mail 和 thread：

```text
Must Handle Mails
Must Handle Threads
Need Reply Mails
Need Reply Threads
Risk Mails
Risk Threads
```

#### Mail

保留当前分类卡片能力：

```text
Pending Mail
Manual Confirmation Required
Must Handle Today
Important Sender
Risk
Waiting For Me
Follow-up
Notice
Uncertain
Ignored
```

#### Threads

新增：

```text
Long Threads
Recently Active Threads
Need My Reply
High Risk Threads
```

Thread Card 显示：

```text
Subject
participants
messageCount
lastTime
contentStatus
security badge
Open Timeline
Analyze Thread
Generate Thread Report
```

Timeline Detail 显示：

```text
[2026-06-17 09:12] Alice
bodyDelta...

[2026-06-17 09:28] Bob
bodyDelta...
```

#### Security Review

显示：

```text
Mail manual_confirm
Mail blocked
Thread partial context
Redaction stats
Blocked reasons
```

#### Reports

显示或打开：

```text
mail-summary.md
daily-brief.md
thread-report.md
weekly-pattern-report.md
```

---

## 10. Prompt 与模型调用设计

### 10.1 保留 Single Mail Prompt

当前：

```text
prompts/base-system.md
prompts/output-schema.md
prompts/prompt-config.default.json
```

这些继续服务 single mail analysis。

### 10.2 新增 Thread Prompt

新增：

```text
prompts/thread-base-system.md
prompts/thread-output-schema.md
prompts/thread-analysis-prompt.md
```

Thread prompt 输入应该是 JSON-like timeline，而不是 Markdown digest。

示例输入：

```json
{
  "threadId": "conversation:xxx",
  "subject": "Release window confirmation",
  "participants": ["Alice", "Bob"],
  "partialContext": false,
  "timeline": [
    {
      "mailId": "internet:<a@example.com>",
      "time": "2026-06-17 09:12:00",
      "from": "Alice",
      "bodyDelta": "Can we move the release window to Thursday?"
    }
  ]
}
```

Thread prompt 应要求：

```text
1. 不要编造没有出现在 timeline 的事实。
2. 如果上下文不完整，partialContext=true 并保守判断。
3. 每个 decision / risk / actionItem 尽量带 sourceMailId。
4. draftReply 只生成文本，不自动发送。
5. 返回严格 JSON。
```

### 10.3 Provider 抽象

当前模型调用直接写在 `extension.ts#analyzeBatchCore()`：

```ts
const models = await vscode.lm.selectChatModels({ vendor: "copilot" });
const response = await selectedModel.sendRequest(...)
```

v0.6 建议抽出：

```text
src/lib/llm-provider.ts
src/lib/copilot-provider.ts
src/lib/mock-provider.ts
```

接口：

```ts
export interface LlmProvider {
  listModels(): Promise<AvailableModel[]>;
  sendPrompt(prompt: string, options: LlmRequestOptions): Promise<string>;
}
```

短期不要急着抽，否则会影响 v0.3 / v0.4 主线。

---

## 11. 版本路线图：repo-specific 修正版

### v0.2：Single Mail 稳定化与双视图基础

目标：

```text
不削弱现有 single mail；先把分析结构、安全雏形和扩展点补齐。
```

改动文件：

```text
src/lib/analysis-schema.ts
src/lib/analysis-target.ts                 # 新增
src/lib/classification.ts
src/lib/security-gate.ts                   # 可先做 mail-level minimal
src/test/analysis-schema.test.ts
src/test/classification.test.ts
src/test/security-gate.test.ts             # 新增
prompts/output-schema.md
README.md
docs/progressive-analysis-design.md
docs/security.md
```

具体步骤：

```text
1. 在 AnalysisItem 中新增 optional evidence 字段，保持旧 JSON 兼容。
2. 新增 analysis-target.ts，但暂不大规模接入。
3. 把 classification 的职责说明清楚：只判断密级。
4. 新增 security-gate.ts 的 mail-level allow/manual_confirm/block 逻辑。
5. 当前 buildQueueState 可先不替换，但增加测试确保行为一致。
6. 更新 output-schema.md，允许 evidence 但不强制。
7. npm test 保持通过。
```

验收标准：

```text
1. 旧 sample 流程仍能跑通。
2. analysis-result.json 旧结构仍兼容。
3. 单封邮件 Dashboard 不退化。
4. 新增 GateDecision 单元测试。
```

---

### v0.3：Thread Timeline MVP

目标：

```text
不调用 AI，也能把长邮件链按时间顺序聊天式展示。
```

改动文件：

```text
scripts/collect-outlook-mails.vbs
src/lib/digest.ts
src/lib/mail-store.ts
src/lib/thread-store.ts                   # 新增
src/lib/thread-engine.ts                  # 新增
src/lib/thread-timeline.ts                # 新增
src/extension.ts
src/test/digest.test.ts
src/test/mail-store.test.ts
src/test/thread-engine.test.ts            # 新增
src/test/thread-timeline.test.ts          # 新增
package.json                              # 如新增 command/config
README.md
user guide.md
```

具体步骤：

```text
1. VBS BuildMailRecord 增加 conversationId / conversationIndex / sentTime / to / cc / attachment metadata。
2. VBS WriteDigest 输出新增字段。
3. VBS sample records 生成 2-3 封同 conversationId 的长线程样例。
4. digest.ts 解析新增字段。
5. mail-store.ts StoredMail 增加新增字段，并保证旧输入 normalize 时填默认值。
6. 新增 thread-store.ts 定义 ThreadStore。
7. 新增 thread-engine.ts，从 StoredMail[] 构建 ThreadStore。
8. 新增 thread-timeline.ts 做 bodyClean/bodyDelta/hash/duplicate 标记。
9. extension.ts 新增 getThreadStorePath/readThreadStore/writeThreadStore。
10. pullMailCore merge store 后构建/更新 thread-store.json。
11. Dashboard 增加 Threads 区域，先不做复杂 tab 也可以，先在 pending/summary 后显示 Thread cards。
12. Thread card 可展开显示 timeline。
```

验收标准：

```text
1. sample mode 可以展示一个多封邮件线程。
2. 同一 conversationId 聚合为一个 ThreadRecord。
3. timeline 按 conversationIndex 或 receivedTime 排序。
4. 重复正文可标记 isDuplicateBody。
5. 不调用 Copilot 也能使用 Thread Timeline。
6. Mail Dashboard 不受影响。
```

---

### v0.4：Unified Security Gate + Redaction

目标：

```text
所有进入 AI 的 single mail / thread 内容都必须经过安全门与脱敏。
```

改动文件：

```text
src/lib/redaction.ts                      # 新增
src/lib/security-gate.ts                  # 扩展
src/lib/classification.ts
src/lib/mail-store.ts
src/lib/thread-store.ts
src/extension.ts
src/test/redaction.test.ts                # 新增
src/test/security-gate.test.ts            # 扩展
src/test/thread-security.test.ts          # 可选
package.json                              # 新增配置项
default-config.json
README.md
docs/security.md
```

新增配置建议：

```json
{
  "securityGateEnabled": true,
  "redactionEnabled": true,
  "hardBlockKeywords": ["secret", "private key", "password", "token"],
  "manualConfirmKeywords": ["contract", "budget", "confidential"],
  "redactEmail": true,
  "redactPhone": true,
  "redactUrl": true,
  "redactIp": true,
  "redactToken": true,
  "redactMoney": true
}
```

具体步骤：

```text
1. 实现 redactText。
2. 实现 buildMailGateDecision。
3. 实现 buildThreadGateDecision。
4. analyzeBatchCore 构造 digestText 前，对 batch 做 gate + redaction。
5. Analyze Next Batch 只能自动分析 allow。
6. Analyze Selected 可以分析 manual_confirm，但不能分析 block。
7. Thread analysis payload 只包含 allowed/manual-confirm-confirmed 且已脱敏的 timeline message。
8. Dashboard 显示 blocked reason 与 redaction stats。
```

验收标准：

```text
1. hard block 邮件永不进入模型。
2. manual_confirm 邮件不会自动进入模型。
3. selected manual_confirm 邮件可以在用户明确操作后进入模型，但必须脱敏。
4. 邮箱、URL、IP、token、金额可被脱敏。
5. Thread 中部分消息被排除时 partialContext=true。
```

---

### v0.5：Thread-level AI Analysis + Dual-view Dashboard

目标：

```text
新增线程级 AI，但 single mail analysis 保持一等能力。
```

改动文件：

```text
src/lib/thread-analysis-schema.ts          # 新增
src/lib/thread-prompt-builder.ts           # 新增
src/lib/thread-analysis-service.ts         # 新增，或先放 extension.ts 编排
src/lib/dashboard-state.ts                 # 扩展 unified state
src/extension.ts
prompts/thread-base-system.md              # 新增
prompts/thread-output-schema.md            # 新增
src/test/thread-analysis-schema.test.ts    # 新增
src/test/thread-prompt-builder.test.ts     # 新增
README.md
user guide.md
```

具体步骤：

```text
1. 新增 thread-analysis-result.json 路径。
2. 新增 parseThreadAnalysisJson / normalizeThreadAnalysis。
3. 新增 buildThreadAnalysisPrompt。
4. Dashboard Thread card 增加 Analyze Thread 按钮。
5. extension.ts handleMessage 增加 analyzeThread。
6. 调用 Copilot 时使用 redacted timeline。
7. 结果合并到 thread-analysis-result.json。
8. Dashboard 显示 currentStatus / decisions / openQuestions / actionItems / risks / draftReply。
9. Today 区域同时合并 mail 和 thread 的 P0/P1 项。
```

验收标准：

```text
1. 单封邮件分析仍可独立运行。
2. 线程可以独立分析。
3. Thread result 中包含 currentStatus、keyDecisions、openQuestions、actionItems、risks、draftReply。
4. 每个 action/risk 尽量带 sourceMailId。
5. partialContext 线程有明确 UI 提示。
```

---

### v0.6：Reports + Provider 抽象 + 代码结构整理

目标：

```text
把分析结果变成工作产物，并降低 extension.ts 耦合。
```

改动文件：

```text
src/lib/report-daily.ts                    # 新增
src/lib/report-single-mail.ts              # 新增
src/lib/report-thread.ts                   # 新增
src/lib/report-weekly.ts                   # 新增
src/lib/llm-provider.ts                    # 新增
src/lib/copilot-provider.ts                # 新增
src/lib/mock-provider.ts                   # 新增
src/lib/dashboard-renderer.ts              # 可选新增
src/extension.ts                           # 逐步瘦身
src/test/report-*.test.ts                  # 新增
README.md
user guide.md
docs/design.md
```

具体步骤：

```text
1. 新增 Daily Brief：融合 mail + thread。
2. 新增 Single Mail Report。
3. 新增 Thread Report。
4. 新增 Weekly Pattern Report。
5. 报告默认使用脱敏后内容。
6. 抽出 LlmProvider。
7. CopilotProvider 复用当前 vscode.lm 实现。
8. MockProvider 支持测试。
9. 视情况把 Dashboard render 函数从 extension.ts 移出。
```

验收标准：

```text
1. 可以导出 daily-brief.md。
2. 可以导出 thread-report.md。
3. 报告遵守 Security Gate。
4. extension.ts 明显变薄，模型调用逻辑可测试。
```

---

## 12. Repo-specific GitHub Issues

### Issue 1：Stabilize Single Mail Analysis Schema and Evidence

版本：v0.2  
优先级：P0

任务：

```text
1. 扩展 AnalysisItem，新增 optional evidence/source 字段。
2. normalizeAnalysis 对旧数据保持兼容。
3. 更新 prompts/output-schema.md。
4. 更新 summary.ts，可选显示 evidence。
5. 增加 analysis-schema.test。
```

验收：

```text
旧 JSON 仍可解析。
新 JSON 中 evidence 可保留。
npm test 通过。
```

---

### Issue 2：Introduce AnalysisTarget Abstraction

版本：v0.2  
优先级：P0

任务：

```text
1. 新增 src/lib/analysis-target.ts。
2. 定义 MailAnalysisTarget / ThreadAnalysisTarget。
3. 先不强制改 analyzeBatchCore，只加测试和类型。
```

验收：

```text
AnalysisTarget 可表示 mail/thread。
不影响现有运行。
```

---

### Issue 3：Add Mail-level Security Gate Skeleton

版本：v0.2  
优先级：P0

任务：

```text
1. 新增 src/lib/security-gate.ts。
2. 用现有 MailClassification 生成 GateDecision。
3. 支持 allow/manual_confirm/block。
4. 当前 buildQueueState 可暂不替换。
```

验收：

```text
classification level 超阈值 -> manual_confirm。
hardBlockKeywords 命中 -> block。
测试覆盖。
```

---

### Issue 4：Add Conversation Fields to Outlook Collector

版本：v0.3  
优先级：P0

任务：

```text
1. VBS BuildMailRecord 增加 SafeConversationId。
2. VBS BuildMailRecord 增加 SafeConversationIndex。
3. WriteDigest 输出 ConversationId / ConversationIndex。
4. sample digest 生成同线程样例。
5. digest.ts 解析新增字段。
```

验收：

```text
sample mode 中至少两封邮件有相同 conversationId。
parseDigest 能解析字段。
旧 digest 仍可解析。
```

---

### Issue 5：Extend StoredMail for Thread Metadata

版本：v0.3  
优先级：P0

任务：

```text
1. StoredMail 增加 conversationId / conversationIndex / senderName / senderEmail / to / cc / attachment metadata。
2. digestItemToStoredMail 写入新字段。
3. normalizeStoredMail 对旧数据填默认值。
4. buildBatchDigestMarkdown 可选择输出新字段，至少不破坏旧 prompt。
```

验收：

```text
mail-store.test 通过并新增字段测试。
旧 mail-store.json 仍可 normalize。
```

---

### Issue 6：Implement ThreadStore and Thread Engine

版本：v0.3  
优先级：P0

任务：

```text
1. 新增 thread-store.ts。
2. 新增 thread-engine.ts。
3. 从 StoredMail[] 构建 ThreadRecord[]。
4. 实现 normalizedSubject / stableThreadId / participants / folders / unreadCount。
5. 实现 thread-store normalize / prune。
```

验收：

```text
同 conversationId 的邮件聚合为一个 thread。
无 conversationId 时 fallback 到 subject。
测试覆盖。
```

---

### Issue 7：Implement Thread Timeline Body Delta and Dedup

版本：v0.3  
优先级：P0

任务：

```text
1. 新增 thread-timeline.ts。
2. cleanMailBody。
3. extractReplyDelta。
4. hashBody。
5. mark duplicate body。
```

验收：

```text
Outlook quoted history 被基础切割。
重复 body 被标记。
Thread timeline 可显示 bodyDelta。
```

---

### Issue 8：Add Threads View Without Weakening Mail View

版本：v0.3  
优先级：P0

任务：

```text
1. extension.ts 新增 read/write thread-store。
2. pullMailCore 后构建 thread-store。
3. getDashboardHtml 渲染 Thread cards。
4. Thread card 可展开 timeline。
5. Mail card 保持原样。
```

验收：

```text
Mail View 仍正常。
Threads View 显示 thread cards。
Sample mode 可演示长线程。
```

---

### Issue 9：Implement Redaction and Unified Security Gate

版本：v0.4  
优先级：P1

任务：

```text
1. redaction.ts。
2. security-gate.ts 扩展 thread-level gate。
3. analyzeBatchCore 接入 redaction payload。
4. thread prompt builder 使用 redacted timeline。
5. Dashboard 显示安全状态。
```

验收：

```text
敏感字段不会进入 AI payload。
block 项不能被分析。
manual_confirm 需要用户操作。
partialContext 正确显示。
```

---

### Issue 10：Add Thread-level AI and Unified Reports

版本：v0.5-v0.6  
优先级：P1/P2

任务：

```text
1. thread-analysis-schema.ts。
2. thread prompts。
3. analyzeThread command/message。
4. thread-analysis-result.json。
5. report-thread.ts。
6. daily-brief.ts。
```

验收：

```text
线程能 AI 分析。
报告能导出。
单封邮件分析不退化。
```

---

## 13. Codex 执行建议

### 13.1 不要一次性让 Codex 做完整 v0.2-v0.6

建议每次只给一个 issue，并要求：

```text
1. 先读相关文件。
2. 给出修改计划。
3. 小步 patch。
4. 新增/修改测试。
5. 运行 npm test。
6. 总结改动。
```

### 13.2 每个 issue 的通用 Codex Prompt 模板

```text
你正在维护一个 VS Code extension 项目 email-analysis。
当前项目是 Windows + classic Outlook + VBScript + VS Code Copilot 的本地只读邮件分析工具。

硬约束：
- 不自动发送邮件。
- 不删除/移动/写回 Outlook。
- 不做 PST/OST。
- 不长期保存原始正文。
- Single Mail Analysis 不能退化。
- 新增功能必须有测试。

请完成 Issue X：...

请先阅读以下文件：
- src/extension.ts
- src/lib/...
- scripts/collect-outlook-mails.vbs
- src/test/...

实现要求：
...

验收标准：
...

完成后请运行：
- npm test

如果无法运行测试，请说明原因，并保证 TypeScript 编译层面没有明显错误。
```

### 13.3 推荐 commit 顺序

```text
commit 1: v0.2 schema and analysis target
commit 2: v0.2 mail-level security gate skeleton
commit 3: v0.3 collector conversation fields
commit 4: v0.3 stored mail extension
commit 5: v0.3 thread store and engine
commit 6: v0.3 dashboard threads view
commit 7: v0.4 redaction
commit 8: v0.4 unified security gate integration
commit 9: v0.5 thread AI
commit 10: v0.6 reports/provider extraction
```

---

## 14. 关键风险点与注意事项

### 14.1 `mail-store.json` 分析后移除导致 Thread Timeline 不完整

风险：高。

处理：

```text
v0.3 新增 thread-store.json，并在 pullMailCore 后立即从 prunedStore 构建/合并 ThreadStore。
thread-store 的正文保留期要可配置，默认短期。
```

### 14.2 Markdown digest 越来越脆弱

风险：中高。

当前 digest 解析依赖固定文本结构。新增字段越多，Markdown 作为机器传输越容易出问题。

短期：继续扩展 Markdown，保证兼容。

中期：新增 `mail-raw.json`，让 VBS 同时输出 Markdown + JSON。

推荐未来迁移：

```text
VBS -> mail-raw.json + mail-digest.md
extension 内部优先读 mail-raw.json
mail-digest.md 只做人类调试产物
```

### 14.3 ConversationIndex 输出可能不稳定

风险：中。

处理：

```text
1. VBS SafeString 包裹。
2. Markdown 输出时转义。
3. Thread sort 失败时 fallback receivedTime。
4. 后续 JSON 输出时可对 conversationIndex 做编码。
```

### 14.4 Outlook Object Model / WSH 被企业策略限制

风险：中。

当前已经选择 VBScript + classic Outlook，这在 POC 阶段可行，但企业 EDR/WSH 策略可能拦截。

处理：

```text
1. 错误消息要清晰。
2. 保留 sample mode。
3. 不承诺所有公司机器都可用。
4. 长期如果产品化，再考虑 signed C# local agent。
```

### 14.5 `toMe` / `ccMe` 当前实现不准确

当前 VBS：

```text
toMe = Len(mail.To) > 0
ccMe = Len(mail.CC) > 0
```

这只是“有 To/Cc”，不是“是否发给我”。

风险：中。

处理：

```text
v0.3 先保留。
v0.5 前不要让 AI 过度依赖 toMe/ccMe。
后续可通过 ns.CurrentUser 或 account smtp address 判断。
```

### 14.6 Security Gate 与用户手动分析的边界

风险：高。

规则必须明确：

```text
自动分析：只允许 allow。
手动分析：允许 manual_confirm，但必须脱敏。
硬阻断：block 永远不能分析。
```

不要让 `Analyze Selected` 直接绕过 Security Gate。

### 14.7 原文缓存与 Thread Timeline 的矛盾

Thread Timeline 越好用，越需要保留正文；安全越严格，越不应该保留正文。

解决：

```text
1. 默认短期保留。
2. thread-store contentStatus 标记 available/partial/metadataOnly。
3. 过期后仍可展示 thread metadata，但正文不可用。
4. 用户可以重新 Pull 对应范围恢复内容。
```

### 14.8 extension.ts 过大

风险：中。

当前文件包含应用编排、模型调用、HTML 渲染、存储和事件处理。

短期不要大拆，因为容易引入回归。

建议：

```text
v0.2-v0.4：新增核心逻辑放 src/lib。
v0.6：抽出 llm-provider / report / dashboard-renderer。
```

---

## 15. 推荐测试清单

新增测试文件：

```text
src/test/analysis-target.test.ts
src/test/security-gate.test.ts
src/test/redaction.test.ts
src/test/thread-engine.test.ts
src/test/thread-timeline.test.ts
src/test/thread-store.test.ts
src/test/thread-analysis-schema.test.ts
src/test/thread-prompt-builder.test.ts
src/test/report-thread.test.ts
src/test/report-daily.test.ts
```

重点测试用例：

```text
1. 旧 digest 仍可解析。
2. 新 digest conversation 字段可解析。
3. 旧 mail-store json normalize 后不报错。
4. StoredMail 新字段默认值正确。
5. 同 conversationId 聚合为同一 ThreadRecord。
6. 无 conversationId fallback subject 聚合。
7. conversationIndex 排序。
8. receivedTime fallback 排序。
9. quoted history extraction。
10. body hash duplicate detection。
11. security gate allow/manual_confirm/block。
12. hard block 不能进入 analysis。
13. redaction 邮箱/URL/token/IP。
14. thread partialContext。
15. thread analysis JSON normalize。
16. report markdown 不包含未脱敏敏感值。
```

---

## 16. 最小可行落地顺序

如果时间有限，不要贪多。最小可行路线是：

```text
Step 1: v0.2 issue 1-3
  稳住 single mail 与 gate skeleton。

Step 2: v0.3 issue 4-8
  做出 Thread Timeline MVP。
  这是最重要的特色功能。

Step 3: v0.4 issue 9
  做出 Redaction + Unified Security Gate。

Step 4: v0.5 issue 10 的前半
  Thread AI。

Step 5: v0.6 issue 10 的后半
  Reports 和 provider 抽象。
```

其中真正的里程碑是：

```text
M1: Single Mail 不退化。
M2: Sample mode 展示长线程 Timeline。
M3: AI payload 经过 Redaction。
M4: Thread AI 给出状态/待办/风险/草稿。
M5: Daily Brief / Thread Report 可导出。
```

---

## 17. 对当前代码的具体改造提示

### 17.1 `extension.ts#pullMailCore`

当前逻辑：

```text
run VBS
parse digest
mergeDigestIntoStore
mergeDigestIntoIndex
prune store/index
write store/index
ensure classifications
refresh
```

v0.3 后建议变成：

```text
run VBS
parse digest
mergeDigestIntoStore
mergeDigestIntoIndex
prune store/index
write store/index
ensure classifications
build/merge ThreadStore from prunedStore.items
prune ThreadStore
write ThreadStore
refresh
```

### 17.2 `extension.ts#analyzeBatchCore`

当前逻辑：

```text
read store/index/classification/analysis
buildQueueState
select batch
buildBatchDigestMarkdown(batch)
composeAnalysisPrompt
send Copilot request
parse JSON
merge analysis
write result/summary
remove analysed mails from store
refresh
```

v0.4 后建议变成：

```text
read store/index/classification/analysis
buildQueueState or securityQueueState
select batch
run Security Gate
remove block items
if selected: allow manual_confirm after explicit action
redact batch
buildBatchDigestMarkdown(redactedBatch)
composeAnalysisPrompt
send Copilot request
parse JSON
merge analysis
write result/summary
remove analysed mails from mail-store only after thread-store has been updated
refresh
```

### 17.3 `buildBatchDigestMarkdown`

当前直接写正文。v0.4 后应支持：

```ts
buildBatchDigestMarkdown(items, { redacted: true })
```

或者让调用方传入已经 redacted 的 `StoredMail[]`，保持函数简单。

### 17.4 Dashboard 渲染

短期新增 render 函数：

```ts
function renderThreadsPanel(...): string
function renderThreadCard(...): string
function renderThreadTimeline(...): string
function renderSecurityReviewPanel(...): string
```

不要一开始重写 Dashboard 前端。

---

## 18. 最终总结

当前仓库的基础很好：它已经完成了本地 Outlook 采集、VS Code 插件、Copilot 分析、mail store、去重、classification gating、dashboard、报告和测试。

下一阶段不应该推倒重来。正确做法是：

```text
保留当前 single mail pipeline
  + 补强 single mail schema / evidence
  + 引入 Security Gate
  + 增加 ThreadStore / Thread Timeline
  + 增加 Thread-level AI
  + 最后做 Reports / Provider 抽象
```

最关键的实现注意点是：

```text
1. Single Mail 和 Thread Mail 都是一等能力。
2. 不要让 Thread 改造破坏现有 Mail Dashboard。
3. mail-store 当前会在分析后移除正文，所以 Thread Timeline 必须有自己的短期缓存策略。
4. Analyze Selected 不能绕过 Security Gate。
5. Thread Timeline 即使不调用 AI，也应该成为独立可用特色功能。
```

推荐下一步直接让 Codex 从 v0.2 Issue 1 开始做，小步提交，每个 issue 都跑测试。
