# Easy Mail 新版设计架构与实现方案

> 面向仓库：`Wsr-7/easy-mail`  
> 文档目的：交给 Codex / AI Coding Agent 继续做功能实现  
> 版本建议：从当前 `0.1.x POC` 演进到 `0.2 ~ 0.6`  
> 生成日期：2026-06-17  
> 核心原则：**只读、本地、可控、安全、Single Mail 与 Thread Mail 双主线并重**

---

## 目录

1. [结论摘要](#1-结论摘要)
2. [当前仓库状态判断](#2-当前仓库状态判断)
3. [产品定位与边界](#3-产品定位与边界)
4. [核心设计原则](#4-核心设计原则)
5. [新版总体架构](#5-新版总体架构)
6. [目录结构建议](#6-目录结构建议)
7. [核心数据模型设计](#7-核心数据模型设计)
8. [采集层改造方案](#8-采集层改造方案)
9. [Single Mail Analysis 设计](#9-single-mail-analysis-设计)
10. [Thread Timeline 设计](#10-thread-timeline-设计)
11. [Thread-level AI Analysis 设计](#11-thread-level-ai-analysis-设计)
12. [Security Gate 与 Redaction 设计](#12-security-gate-与-redaction-设计)
13. [Dashboard 新版信息架构](#13-dashboard-新版信息架构)
14. [报告系统设计](#14-报告系统设计)
15. [LLM Provider 抽象设计](#15-llm-provider-抽象设计)
16. [配置项设计](#16-配置项设计)
17. [本地文件与缓存策略](#17-本地文件与缓存策略)
18. [Prompt 设计](#18-prompt-设计)
19. [测试方案与验收标准](#19-测试方案与验收标准)
20. [版本路线图 v0.2 ~ v0.6](#20-版本路线图-v02--v06)
21. [建议 GitHub Issues](#21-建议-github-issues)
22. [实现顺序建议](#22-实现顺序建议)
23. [注意事项与风险点](#23-注意事项与风险点)
24. [Codex 执行指南](#24-codex-执行指南)
25. [参考资料](#25-参考资料)

---

## 1. 结论摘要

当前项目已经完成了一个有价值的 POC：

```text
classic Outlook
  -> VBScript 采集邮件
  -> mail-digest.md
  -> VS Code 插件调用 Copilot
  -> analysis-result.json
  -> Dashboard + mail-summary.md
```

下一阶段不应该推倒重来，也不应该从 `mail-first` 直接转成 `thread-first`。正确方向是升级为：

```text
Local Read-only Outlook Mail Intelligence Workbench
```

或者中文定位为：

```text
本地只读 Outlook 邮件分析工作台：同时支持单封邮件分析与邮件线程分析。
```

核心能力应演进成四根主轴：

```text
Single Mail Analysis  负责快速覆盖、分类、待办识别、回复草稿
Thread Timeline       负责长邮件链按时间线阅读，即使不调用 AI 也有价值
Thread AI Analysis    负责上下文理解、决策追踪、风险与待办提取
Security Gate         负责范围控制、密级判断、脱敏、人工确认和阻断
```

一句话原则：

```text
Single Mail 是广度。
Thread Mail 是深度。
Security Gate 是边界。
Reports 是产物。
```

---

## 2. 当前仓库状态判断

### 2.1 当前已经具备的能力

根据当前仓库 README、User Guide、package 配置与验收文档，项目已经具备以下能力：

- VS Code 插件形态。
- 面向 Windows + classic Outlook。
- 使用 VBScript 从本地 Outlook 采集邮件。
- 支持最近 N 封与最近 N 小时。
- 支持指定一个或多个 Outlook 文件夹。
- 支持 sample mode，无 Outlook 也能演示。
- 调用 VS Code Language Model API / GitHub Copilot 做分析。
- 生成 `mail-digest.md`、`mail-store.json`、`mail-index.json`、`classification-cache.json`、`analysis-result.json`、`mail-summary.md`。
- 支持渐进式分析：Fetch 后进入本地 JSON mail store，再按批次或选中邮件分析。
- 优先用 `InternetMessageId` / `EntryId` 去重，缺失时才用 hash 兜底。
- 支持未分析、已分析、需手动确认统计和面板。
- 支持短期原文缓存、7 天去重索引、7 天分析摘要和手动清理本地缓存。
- 支持 classification gating：超过配置密级的邮件不会自动送 Copilot。
- 支持重点发件人 / 邮件组分类 `importantSender`。
- Dashboard 已经有分类面板和 Copy Draft 等交互。

这些能力说明当前项目已经不是单纯脚本，而是一个可继续演进的本地邮件分析插件底座。

### 2.2 当前主要短板

当前短板不是“没有 AI 总结”，而是以下几个方面：

1. **Single Mail 能力需要 schema 稳定化**  
   当前单封邮件分析已经可用，但需要补充 evidence、source、confidence、需要人工检查等字段，便于后续报告与可信展示。

2. **长邮件链能力不足**  
   当前主要围绕单封邮件。需要新增 Thread Timeline，把长邮件链变成聊天式时间线。

3. **Security Gate 还不够体系化**  
   当前 classification gating 是安全雏形，但还不是完整的 security pipeline。需要支持 allow / manual_confirm / block、redaction、partial context、审计信息。

4. **Markdown digest 仍承担过多内部数据职责**  
   `mail-digest.md` 适合给人看，但不适合长期作为内部主数据格式。后续应逐步让 JSON 成为主链路，Markdown 作为产物。

5. **模型调用层与 Copilot 耦合较强**  
   当前默认 Copilot 是合理的，但后续应抽象出 provider，以便接公司内部 OpenAI-compatible API 或 mock provider。

6. **Reports 还可以升级为工作产物**  
   目前有 `mail-summary.md`，后续应区分 Daily Brief、Single Mail Report、Thread Report、Weekly Pattern Report。

---

## 3. 产品定位与边界

### 3.1 新版产品定位

推荐 README 里的定位改成：

```text
Easy Mail 是一个面向 Windows classic Outlook + VS Code 的本地只读邮件分析工作台。
它提供两种互补的一等分析视图：

1. Single Mail Analysis
   用于快速收件箱分拣、优先级判断、待办识别、通知过滤、回复草稿和每日处理。

2. Thread Analysis
   用于长邮件链时间线重建、上下文理解、决策追踪、未解决问题提取、风险识别和线程级回复草稿。

Single mail analysis gives breadth.
Thread analysis gives depth.
Both are first-class capabilities.
```

### 3.2 明确非目标

以下边界建议写进 README、agents.md 和安全文档：

```text
永远不做：
1. 不做 PST / OST 离线解析。
2. 不自动发送邮件。
3. 不自动删除邮件。
4. 不自动移动邮件。
5. 不自动修改 Outlook 邮件状态。
6. 不读取附件正文，默认只展示附件元数据。
7. 不把原始正文长期落盘。
8. 不绕过 Outlook / 企业安全策略。
9. 不做后台 Windows Service 或服务器端 Outlook 自动化。
10. 不默认全量扫描邮箱。
```

### 3.3 为什么坚持只读

只读设计不是功能缺失，而是产品可信度的一部分。

在企业高安全环境下，自动发送、自动移动、自动删除都会引入明显风险：

- 误发邮件风险。
- 误移动或误删除业务邮件风险。
- Outlook Object Model Guard / 企业 GPO 风险。
- 用户对工具失去信任。
- 审计困难。

所以本项目应长期坚持：

```text
Read-only by design.
Draft-only, never send.
Analyze-only, never mutate Outlook.
```

---

## 4. 核心设计原则

### 4.1 MailRecord 是事实层

所有采集到的邮件先进入 `MailRecord`。它是系统的基础事实层。

```text
MailRecord 是一等实体。
ThreadRecord 是基于 MailRecord 构建出来的聚合视图。
```

不要把单封邮件降级为 Thread 的附属品。

### 4.2 Single Mail 和 Thread Mail 双一等公民

二者是不同粒度的理解方式：

```text
一封邮件是一个事件。
一个线程是一段协作过程。
```

所以 UI、schema、analysis service、report 都应同时支持：

```text
mail target
thread target
```

### 4.3 先本地安全处理，再调用模型

所有要进入模型的内容都必须经过：

```text
范围控制 -> 密级判断 -> 脱敏 -> 安全决策 -> redacted payload
```

模型永远不应直接接触 raw Outlook body，除非用户明确开启本地原文模式，且仍只在本机使用。

### 4.4 Markdown 是产物，不是主数据

后续应逐步演进为：

```text
JSON = internal data contract
Markdown = human-readable report/artifact
```

短期保持兼容，不能破坏现有 `mail-digest.md` 和 `mail-summary.md` 工作流。

### 4.5 所有功能都必须 sample-mode 可测试

任何新功能都要能在无 Outlook / 无 Copilot 的情况下做基本验证：

- sample mail。
- sample thread。
- mock provider。
- node test。
- validate sample command。

---

## 5. 新版总体架构

### 5.1 总体架构图

```text
Classic Outlook
      │
      │  VBScript / COM Collector
      ▼
Raw Mail Pull Result
      │
      ▼
Mail Store  ─────────────────────────────┐
      │                                  │
      │                                  ▼
      │                            Thread Engine
      │                                  │
      ▼                                  ▼
Mail Security Gate                 Thread Store
      │                                  │
      │                                  ▼
      │                            Thread Security Gate
      │                                  │
      ▼                                  ▼
Single Mail AI Analysis            Thread Timeline / Thread AI Analysis
      │                                  │
      └──────────────┬───────────────────┘
                     ▼
              Unified Dashboard
                     │
                     ▼
              Reports / Markdown Export
```

### 5.2 分层职责

| 层 | 责任 | 关键模块 |
|---|---|---|
| Collector | 从 classic Outlook 读取邮件 | `collect-outlook-mails.vbs` |
| Mail Store | 保存短期待分析邮件与索引 | `mail-store.ts` |
| Thread Engine | 从 MailRecord 构建 ThreadRecord | `thread-engine.ts` |
| Security Gate | 安全决策与脱敏 | `security-gate.ts`, `redaction.ts` |
| Analysis | 调用模型分析 mail/thread | `mail-analysis-service.ts`, `thread-analysis-service.ts` |
| Provider | 模型后端适配 | `llm-provider.ts`, `copilot-provider.ts` |
| Dashboard | 展示与交互 | Webview / dashboard state |
| Reports | 生成 Markdown 工作产物 | `report-daily.ts`, `report-thread.ts` |

### 5.3 目标链路

#### Single Mail 链路

```text
Fetch Mail
  -> Mail Store
  -> Mail-level Security Gate
  -> Redacted Mail Payload
  -> Single Mail AI Analysis
  -> Mail Dashboard
  -> Single Mail Report / Daily Brief
```

#### Thread Mail 链路

```text
Fetch Mail
  -> Mail Store
  -> Thread Engine
  -> Thread Store
  -> Thread-level Security Gate
  -> Redacted Thread Timeline Payload
  -> Thread Timeline View
  -> Thread AI Analysis
  -> Thread Report
```

---

## 6. 目录结构建议

在不大改当前仓库结构的前提下，建议新增 / 调整如下：

```text
src/
  lib/
    analysis-target.ts              # 新增：mail/thread 统一分析目标抽象
    single-mail-analysis-schema.ts   # 新增或从 analysis-schema.ts 拆分
    thread-schema.ts                 # 新增：ThreadRecord / ThreadMessage
    thread-store.ts                  # 新增：thread-store.json 读写
    thread-engine.ts                 # 新增：MailRecord -> ThreadRecord
    thread-timeline.ts               # 新增：timeline 构建、排序、清洗、去重
    security-policy.ts               # 新增：安全策略配置结构
    security-gate.ts                 # 新增：统一安全决策
    mail-security-gate.ts            # 可选：mail gate 细分
    thread-security-gate.ts          # 可选：thread gate 细分
    redaction.ts                     # 新增：脱敏规则
    mail-analysis-service.ts         # 新增：单封邮件分析服务
    thread-analysis-service.ts       # 新增：线程分析服务
    model-input-builder.ts           # 新增：构建 redacted AI payload
    llm-provider.ts                  # 新增：模型 provider 接口
    copilot-provider.ts              # 新增或迁移现有 Copilot 逻辑
    mock-provider.ts                 # 新增：测试用 mock provider
    report-daily.ts                  # 新增：Daily Brief
    report-single-mail.ts            # 新增：单封邮件报告
    report-thread.ts                 # 新增：线程报告
    report-weekly.ts                 # 新增：周报趋势

prompts/
  single-mail-system.md
  single-mail-output-schema.md
  thread-system.md
  thread-output-schema.md
  daily-brief.md
  draft-reply.md

scripts/
  collect-outlook-mails.vbs          # 增强：增加 thread 字段
  run-sample-validation.ps1          # 增强：覆盖 thread/security/report

docs/
  architecture-v2.md                 # 可将本文档放入仓库
  security-design.md
  thread-timeline-design.md
  roadmap-v0.2-v0.6.md
```

原则：

```text
不要一次性重命名太多现有文件。
不要破坏现有命令。
新增模块优先，迁移逻辑次之。
```

---

## 7. 核心数据模型设计

### 7.1 AnalysisTarget

用于统一 mail 和 thread 的分析入口。

```ts
export type AnalysisTargetType = "mail" | "thread";

export interface AnalysisTargetBase {
  id: string;
  type: AnalysisTargetType;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  classificationLevel?: ClassificationLevel;
  securityDecision?: GateDecision;
}

export interface MailAnalysisTarget extends AnalysisTargetBase {
  type: "mail";
  mailId: string;
  subject: string;
  fromName: string;
  fromEmail?: string;
  receivedTime: string;
  folder: string;
  bodyExcerpt: string;
}

export interface ThreadAnalysisTarget extends AnalysisTargetBase {
  type: "thread";
  threadId: string;
  conversationId: string;
  subject: string;
  participants: string[];
  messageCount: number;
  timeline: ThreadMessage[];
}

export type AnalysisTarget = MailAnalysisTarget | ThreadAnalysisTarget;
```

### 7.2 MailRecord 增强建议

当前项目已经有 `StoredMail` / `MailStore` 概念。建议在兼容现有字段的基础上逐步增加：

```ts
export interface MailRecord {
  mailId: string;
  internetMessageId?: string;
  entryId?: string;
  storeId?: string;

  // thread fields
  conversationId?: string;
  conversationIndex?: string;

  subject: string;
  normalizedSubject?: string;
  fromName: string;
  fromEmail?: string;
  to?: string[];
  cc?: string[];
  receivedTime: string;
  sentTime?: string;
  folder: string;
  unread?: boolean;
  importance?: string;

  bodyExcerpt: string;
  bodyHash?: string;

  hasAttachments?: boolean;
  attachments?: AttachmentMeta[];

  classificationLevel?: ClassificationLevel;
  importedAt: string;
}
```

注意：

- `conversationId` / `conversationIndex` 是 thread timeline 的关键。
- `bodyExcerpt` 仍然短期缓存，不能长期保存。
- 不要默认存附件正文。

### 7.3 ThreadRecord

```ts
export interface ThreadStore {
  version: 1;
  generatedAt: string;
  threads: ThreadRecord[];
}

export interface ThreadRecord {
  threadId: string;
  conversationId: string;
  subject: string;
  normalizedSubject: string;
  folders: string[];
  participants: string[];
  startTime: string;
  lastTime: string;
  messageCount: number;
  unreadCount: number;
  hasAttachments: boolean;
  sourceMailIds: string[];
  timeline: ThreadMessage[];
  security?: ThreadSecuritySummary;
  analysis?: ThreadAnalysisResult;
}

export interface ThreadMessage {
  mailId: string;
  internetMessageId?: string;
  entryId?: string;
  conversationIndex?: string;
  subject: string;
  fromName: string;
  fromEmail?: string;
  to?: string[];
  cc?: string[];
  receivedTime: string;
  sentTime?: string;
  folder: string;

  bodyRawExcerpt?: string;
  bodyClean: string;
  bodyDelta: string;
  bodyHash: string;
  isDuplicateBody: boolean;

  hasAttachments?: boolean;
  attachments?: AttachmentMeta[];

  classificationLevel?: ClassificationLevel;
  gateDecision?: GateDecision;
}

export interface AttachmentMeta {
  name: string;
  size?: number;
  type?: string;
}
```

### 7.4 SingleMailAnalysisResult

```ts
export interface SingleMailAnalysisResult {
  mailId: string;
  targetType: "mail";
  generatedAt: string;
  category: MailCategory;
  priority: "P0" | "P1" | "P2" | "P3";
  subject: string;
  summary: string;
  reason: string;
  needReply: boolean;
  suggestedAction: string;
  draftReply?: string;
  deadline?: string;
  confidence: number;
  evidence?: MailEvidence[];
  needsOriginalMailCheck: boolean;
}

export interface MailEvidence {
  mailId: string;
  quote?: string;
  reason: string;
}
```

### 7.5 ThreadAnalysisResult

```ts
export interface ThreadAnalysisResult {
  threadId: string;
  targetType: "thread";
  generatedAt: string;
  category: ThreadCategory;
  priority: "P0" | "P1" | "P2" | "P3";
  oneLineSummary: string;
  currentStatus: string;
  keyDecisions: string[];
  openQuestions: string[];
  actionItems: ThreadActionItem[];
  waitingOn: string[];
  risks: ThreadRisk[];
  needMyReply: boolean;
  suggestedAction: string;
  draftReply?: string;
  confidence: number;
  evidence: ThreadEvidence[];
  partialContext: boolean;
  needsOriginalMailCheck: boolean;
}

export interface ThreadActionItem {
  owner: string;
  task: string;
  deadline?: string;
  sourceMailId: string;
  sourceTime: string;
}

export interface ThreadRisk {
  level: "low" | "medium" | "high";
  description: string;
  evidenceMailId: string;
}

export interface ThreadEvidence {
  mailId: string;
  quote?: string;
  reason: string;
}
```

---

## 8. 采集层改造方案

### 8.1 当前采集器保持为主路线

继续保留：

```text
scripts/collect-outlook-mails.vbs
```

不要切到 PST，不要引入 Python 主采集器。当前项目已经使用 VBScript，并且仓库语言组成里 TypeScript + VBScript 是合理状态。

### 8.2 新增采集字段

VBS 输出中增加：

```text
ConversationID
ConversationIndex
InternetMessageID
EntryID
SenderName
SenderEmailAddress
To
CC
ReceivedTime
SentOn
Subject
Body
Unread
Importance
Attachments metadata
```

注意：

- `ConversationID` 可能为空，要有 fallback。
- `ConversationIndex` 可能取不到，要 fallback 到 `ReceivedTime` 排序。
- `SenderEmailAddress` 可能触发安全策略或返回 Exchange internal address，要容错。
- 附件只采集名称、大小、类型，不读取正文。

### 8.3 Collector 输出格式演进

短期：继续输出 `mail-digest.md`，确保旧功能不坏。

中期：同时输出 JSON：

```text
data/mail-pull-result.json
```

建议结构：

```json
{
  "version": 1,
  "generatedAt": "2026-06-17T10:00:00",
  "range": {
    "mode": "recentHours",
    "recentHours": 24,
    "maxItems": 50,
    "folders": ["Inbox"]
  },
  "items": [
    {
      "entryId": "...",
      "internetMessageId": "...",
      "conversationId": "...",
      "conversationIndex": "...",
      "subject": "...",
      "fromName": "...",
      "receivedTime": "...",
      "folder": "Inbox",
      "bodyExcerpt": "..."
    }
  ]
}
```

长期：内部链路优先读 JSON，Markdown 仅作为人类可读产物。

### 8.4 Restrict 使用注意

继续用 Outlook COM 的 `Items.Restrict` 做时间过滤。不要全量遍历邮箱。

风险点：

- Outlook 本地时间字符串格式可能受 Windows 区域设置影响。
- 当前项目已经说明 `ReceivedTime` 使用 Outlook / Windows 本地时间，不二次转 UTC。这个策略应继续保留。
- 多文件夹要保留 per-folder anchor，避免 Inbox 和子文件夹混淆。

### 8.5 sample mode 同步升级

sample mode 必须能生成：

- 单封邮件样本。
- 长邮件链样本。
- 含重复引用正文的样本。
- 含敏感信息的样本。
- 含附件元数据的样本。
- 含 partial context 的样本。

这对 Codex 迭代尤其重要，因为大部分测试不能依赖真实 Outlook。

---

## 9. Single Mail Analysis 设计

### 9.1 定位

Single Mail Analysis 继续作为核心一等能力，不能被 Thread 功能弱化。

它主要回答：

```text
这封邮件是什么？
重要吗？
今天要不要处理？
是否需要回复？
有什么 deadline？
建议怎么做？
可以怎么回复？
```

适合：

- 系统通知。
- 审批提醒。
- 会议变更。
- 日报周报。
- 告警邮件。
- Jira / GitHub / ServiceNow 通知。
- HR / 行政通知。
- 短邮件。

### 9.2 实现步骤

1. 抽出或新增 `single-mail-analysis-schema.ts`。
2. 保留当前 `analysis-schema.ts` 兼容层。
3. 增加 `needReply`、`deadline`、`evidence`、`needsOriginalMailCheck` 字段。
4. 调整 dashboard state，使旧结果和新结果都能渲染。
5. 增加 schema 校验测试。
6. 保持 `analysis-result.json` 兼容。

### 9.3 输入构造

模型输入不要直接使用 raw mail，而是：

```ts
interface SingleMailModelInput {
  mailId: string;
  subject: string;
  from: string;
  receivedTime: string;
  folder: string;
  importance?: string;
  body: string; // redacted body excerpt
  classificationLevel: ClassificationLevel;
}
```

### 9.4 输出要求

模型必须输出 JSON，并且所有字段可解析。

失败策略：

- JSON parse 失败：保留原错误，标记该邮件 `analysisFailed`。
- 必填字段缺失：进入 `uncertain`。
- confidence 低于阈值：`needsOriginalMailCheck = true`。

---

## 10. Thread Timeline 设计

### 10.1 定位

Thread Timeline 是新版的特色功能之一。

它的价值在于：

```text
即使不调用 AI，也能把长邮件链变成按时间顺序的聊天记录。
```

这本身就是独立可用功能。

### 10.2 聚合策略

优先级：

```text
1. conversationId
2. normalizedSubject + participants + time window fallback
3. subject-only fallback 仅用于 sample 或极端情况，不默认启用
```

### 10.3 排序策略

优先级：

```text
1. conversationIndex
2. receivedTime
3. sentTime
4. mailId stable sort
```

### 10.4 正文清洗

最小规则：

```text
- 去掉连续空行。
- 去掉常见签名尾部。
- 识别 -----Original Message-----。
- 识别 From: / Sent: / To: / Subject:。
- 识别 发件人 / 发送时间 / 收件人 / 主题。
- 识别 Outlook / Gmail 常见引用头。
- 识别 > quoted lines。
```

建议先实现自有规则，不急于引入外部库。

后续可选：参考 Mailgun Talon 这类邮件引用与签名解析库，但不要在第一版引入 Python 依赖。

### 10.5 bodyDelta

Thread Timeline 的关键不是保留每封完整正文，而是尽量提取每封邮件新增内容：

```text
bodyRawExcerpt -> bodyClean -> bodyDelta -> bodyHash
```

规则：

- `bodyClean`：清洗空白和明显噪声。
- `bodyDelta`：去除引用历史后，本封邮件真正新增的内容。
- `bodyHash`：对 normalized bodyDelta 做 hash。
- `isDuplicateBody`：如果 hash 已出现，则标记重复。

### 10.6 Timeline 展示

Thread Detail 示例：

```text
Thread: 项目上线窗口确认
Messages: 12
Participants: 张三, 李四, 王五
Last updated: 2026-06-17 10:03

[2026-06-17 09:12] 张三
本周上线窗口是否可以提前到周四？

[2026-06-17 09:28] 李四
研发没问题，但需要测试今天确认回归范围。

[2026-06-17 10:03] 王五
测试可以配合，前提是今晚前冻结需求。
```

每条消息支持：

```text
Show raw excerpt
Copy message
Analyze this mail
Open related single mail card
```

### 10.7 实现步骤

1. Collector 增加 `conversationId` / `conversationIndex`。
2. MailRecord 增加 thread 字段。
3. 新增 `thread-schema.ts`。
4. 新增 `thread-engine.ts`。
5. 新增 `thread-store.ts`。
6. 新增 `thread-timeline.ts`。
7. 增加 sample long thread。
8. Dashboard 新增 Threads Tab。
9. 增加单元测试。

---

## 11. Thread-level AI Analysis 设计

### 11.1 定位

Thread AI 不是替代 Single Mail AI，而是解决复杂上下文问题。

它回答：

```text
这个事情发展到哪一步了？
谁说了什么？
做了哪些决定？
还有哪些问题未解决？
谁在等谁？
我现在该不该回复？
有什么风险？
回复草稿应该怎么写？
```

### 11.2 输入

模型输入应使用 redacted timeline：

```json
{
  "threadId": "...",
  "subject": "...",
  "participants": ["..."],
  "partialContext": false,
  "timeline": [
    {
      "mailId": "...",
      "time": "2026-06-17 09:12",
      "from": "[EMAIL_1]",
      "bodyDelta": "..."
    }
  ]
}
```

### 11.3 输出

要求模型输出 `ThreadAnalysisResult`。

必须包含：

- `oneLineSummary`
- `currentStatus`
- `keyDecisions`
- `openQuestions`
- `actionItems`
- `waitingOn`
- `risks`
- `needMyReply`
- `suggestedAction`
- `draftReply`
- `evidence`
- `partialContext`
- `needsOriginalMailCheck`

### 11.4 Evidence 设计

所有重要结论尽量带 source mailId。

```json
{
  "task": "确认测试回归范围",
  "owner": "[EMAIL_2]",
  "deadline": "今晚",
  "sourceMailId": "mail_abc",
  "sourceTime": "2026-06-17 10:03"
}
```

### 11.5 Partial Context

如果线程中部分邮件被 Security Gate 阻断，仍可分析允许部分，但必须标记：

```json
{
  "partialContext": true,
  "needsOriginalMailCheck": true
}
```

Dashboard 应显示：

```text
This thread was analyzed with partial context: 2 of 12 messages were excluded by security policy.
```

### 11.6 实现步骤

1. 新增 `thread-analysis-schema.ts`。
2. 新增 thread prompt。
3. 新增 `thread-analysis-service.ts`。
4. 新增 `model-input-builder.ts` 支持 thread input。
5. 接入 `LlmProvider.analyzeThread()`。
6. Dashboard Thread Card 展示 AI 结果。
7. Thread Report 使用 ThreadAnalysisResult。

---

## 12. Security Gate 与 Redaction 设计

### 12.1 目标

Security Gate 是新版最重要的工程边界。

它的职责是：

```text
决定什么内容可以进模型、什么内容需要人工确认、什么内容必须阻断，以及进入模型前如何脱敏。
```

### 12.2 处理流程

```text
Input: MailRecord or ThreadRecord

1. Scope Check
   - folder allow/deny
   - sender allow/deny
   - time range

2. Classification
   - PUBLIC
   - INTERNAL
   - REGISTERED
   - HIGH_REGISTERED

3. Keyword Rules
   - hardBlockKeywords
   - manualConfirmKeywords

4. Redaction
   - email
   - phone
   - URL
   - IP
   - token/secret/key
   - money
   - custom patterns

5. Decision
   - allow
   - manual_confirm
   - block

6. Output
   - GateDecision
   - Redacted payload
   - Redaction stats
```

### 12.3 数据结构

```ts
export type GateAction = "allow" | "manual_confirm" | "block";

export interface GateDecision {
  targetId: string;
  targetType: "mail" | "thread";
  action: GateAction;
  classificationLevel: ClassificationLevel;
  reasons: string[];
  findings: SecurityFinding[];
  redactionStats: RedactionStats;
  partialContext?: boolean;
  createdAt: string;
}

export interface SecurityFinding {
  type: "keyword" | "pattern" | "classification" | "scope";
  level: ClassificationLevel;
  action: GateAction;
  label: string;
  matched?: string;
  message?: string;
}

export interface RedactionStats {
  email: number;
  phone: number;
  url: number;
  ip: number;
  token: number;
  money: number;
  custom: number;
}
```

### 12.4 Redaction Policy

```ts
export interface RedactionPolicy {
  enabled: boolean;
  redactEmail: boolean;
  redactPhone: boolean;
  redactIdNumber: boolean;
  redactIp: boolean;
  redactUrl: boolean;
  redactToken: boolean;
  redactMoney: boolean;
  customPatterns: RedactionPattern[];
}

export interface RedactionPattern {
  name: string;
  regex: string;
  replacement: string;
  action?: "redact" | "manual_confirm" | "block";
}
```

### 12.5 脱敏规则建议

默认规则：

```text
Email                -> [EMAIL_1]
Phone                -> [PHONE_1]
URL                  -> [URL_1]
IP                   -> [IP_1]
Access token/secret  -> [SECRET_1]
Money                -> [MONEY_1]
ID/SSN               -> [ID_1]
Internal host        -> [INTERNAL_HOST_1]
Ticket ID            -> [TICKET_1]
```

注意：

- 映射表默认只在内存中保存。
- 默认不把 `[EMAIL_1] -> alice@company.com` 映射落盘。
- 报告默认使用脱敏后的内容。

### 12.6 Mail-level Gate

单封邮件：

```text
allow           -> 可自动分析
manual_confirm  -> 放入需确认面板
block           -> 不进入模型，只展示阻断原因
```

### 12.7 Thread-level Gate

线程需要汇总所有 message 的 gate decision。

```ts
export interface ThreadSecuritySummary {
  threadId: string;
  totalMessages: number;
  allowedMessages: number;
  manualConfirmMessages: number;
  blockedMessages: number;
  highestClassification: ClassificationLevel;
  partialContext: boolean;
  reasons: string[];
}
```

策略：

```text
1. 所有 message allow：thread allow。
2. 部分 message manual_confirm：thread manual_confirm，或只分析 allow 部分。
3. 部分 message block：默认剔除 blocked message，继续分析 allow 部分，并标记 partialContext。
4. 全部 message block：thread block。
```

### 12.8 Dashboard Security Review

新增面板展示：

```text
Allowed
Manual Confirmation Required
Blocked
Partial Context Threads
```

用户需要看到：

- 为什么被拦截。
- 命中了什么规则。
- 脱敏后将送给模型的内容预览。
- 是否允许手动分析。

---

## 13. Dashboard 新版信息架构

### 13.1 推荐一级 Tab

```text
1. Today
2. Mail
3. Threads
4. Security Review
5. Reports
6. Settings
```

### 13.2 Today Tab

Today 是行动视角，不是数据类型视角。

展示：

```text
Must Handle Today
Need My Reply
Risk
Waiting For Me
Follow-up
Notice
```

每个分组中可以混合：

```text
Mail cards
Thread cards
```

### 13.3 Mail Tab

保留当前单封邮件主能力：

```text
未分析邮件
已分析邮件
需确认邮件
按分类折叠面板
Copy Draft
Ignore
Open Digest
Open Summary
```

增强：

```text
Open Thread
Analyze This Mail
Generate Single Mail Report
Show Security Decision
```

### 13.4 Threads Tab

新增核心特色：

```text
Recently Active Threads
Long Threads
Need My Reply Threads
Risk Threads
Partial Context Threads
```

Thread Card 显示：

```text
Subject
Participants
Message count
Last updated
Unread count
Security status
AI summary
Need my reply
Risk level
Open Timeline
Analyze Thread
Generate Thread Report
```

### 13.5 Security Review Tab

展示：

```text
Manual confirmation queue
Blocked items
Partial-context threads
Redacted preview
Rule hit details
```

### 13.6 Reports Tab

展示：

```text
Daily Brief
Single Mail Reports
Thread Reports
Weekly Pattern Report
Export Markdown
Open Summary
Clear Local Cache
```

---

## 14. 报告系统设计

### 14.1 Daily Brief

```markdown
# Daily Mail Brief

## 今天必须处理

## 需要我回复

## 风险 / 升级 / 合规

## 我在等别人

## 重要线程进展

## 仅通知

## 建议回复草稿
```

### 14.2 Single Mail Report

```markdown
# Single Mail Report: <subject>

## Metadata
- From:
- Time:
- Folder:
- Classification:

## Summary

## Why It Matters

## Suggested Action

## Draft Reply

## Evidence
```

### 14.3 Thread Report

```markdown
# Thread Report: <subject>

## 一句话总结

## 当前状态

## 时间线

## 已达成决定

## 未解决问题

## 待办事项

## 风险

## 建议回复

## 安全说明
- 是否 partial context
- 有多少邮件被排除
```

### 14.4 Weekly Pattern Report

后期高级功能：

```markdown
# Weekly Mail Pattern Report

## 本周重复出现的问题

## 高频沟通对象

## 经常等待我回复的主题

## 风险趋势

## 建议建立规则的邮件源
```

---

## 15. LLM Provider 抽象设计

### 15.1 目标

当前默认使用 VS Code Language Model API / Copilot 是合理的。后续需要支持：

- Copilot Provider。
- Mock Provider。
- OpenAI-compatible Provider。
- 公司内部模型 Provider。

### 15.2 接口

```ts
export interface LlmProvider {
  id: string;
  listModels(): Promise<ModelInfo[]>;
  analyzeSingleMail(input: SingleMailModelInput): Promise<SingleMailAnalysisResult>;
  analyzeThread(input: ThreadModelInput): Promise<ThreadAnalysisResult>;
  generateDailyBrief(input: DailyBriefInput): Promise<string>;
}

export interface ModelInfo {
  id: string;
  vendor?: string;
  family?: string;
  name?: string;
}
```

### 15.3 Provider 实现

```text
CopilotProvider
  使用当前 VS Code Language Model API。

MockProvider
  用于测试，不调用真实模型。

OpenAICompatibleProvider
  后续用于公司内部 model API。
```

### 15.4 注意事项

- Provider 层不要接触 raw body，只接收 redacted payload。
- 调用日志不能保存完整 prompt。
- 模型错误要可恢复，不要导致整个 Dashboard 崩溃。
- JSON parse 失败要有 fallback。

---

## 16. 配置项设计

在当前配置基础上新增：

```json
{
  "easyMail.thread.enabled": true,
  "easyMail.thread.minMessageCount": 2,
  "easyMail.thread.longThreadThreshold": 5,
  "easyMail.thread.maxMessagesPerThread": 50,
  "easyMail.thread.bodyCharsPerMessage": 2000,
  "easyMail.thread.extractBodyDelta": true,
  "easyMail.thread.deduplicateBody": true,

  "easyMail.securityGate.enabled": true,
  "easyMail.securityGate.defaultAction": "manual_confirm",
  "easyMail.securityGate.hardBlockKeywords": [],
  "easyMail.securityGate.manualConfirmKeywords": [],
  "easyMail.securityGate.allowedFolders": [],
  "easyMail.securityGate.deniedFolders": [],
  "easyMail.securityGate.allowedSenders": [],
  "easyMail.securityGate.deniedSenders": [],

  "easyMail.redaction.enabled": true,
  "easyMail.redaction.email": true,
  "easyMail.redaction.phone": true,
  "easyMail.redaction.url": true,
  "easyMail.redaction.ip": true,
  "easyMail.redaction.token": true,
  "easyMail.redaction.money": true,
  "easyMail.redaction.customPatterns": [],

  "easyMail.provider.type": "copilot",
  "easyMail.reports.defaultFormat": "markdown"
}
```

注意：

- 保留现有配置键，避免破坏用户现有设置。
- 新配置默认保守。
- Security Gate 默认开启。
- Redaction 默认开启。

---

## 17. 本地文件与缓存策略

### 17.1 当前文件继续保留

```text
data/mail-digest.md
data/mail-store.json
data/mail-index.json
data/classification-cache.json
data/analysis-result.json
data/mail-summary.md
```

### 17.2 新增文件

```text
data/mail-pull-result.json
data/thread-store.json
data/thread-analysis-result.json
data/security-decision-cache.json
data/redaction-stats.json
data/reports/daily-brief.md
data/reports/thread-<threadId>.md
data/reports/mail-<mailId>.md
```

### 17.3 保留策略

建议：

```text
mail-store.json             raw body 短期队列，默认 1 天
mail-index.json             去重锚点，默认 7 天
analysis-result.json        摘要结果，默认 7 天
thread-store.json           timeline 元数据，默认 7 天；bodyDelta 可短期保留
security-decision-cache     可保留 7 天，不保存 raw body
reports                     用户主动生成，默认保留，仍使用 redacted 内容
```

### 17.4 日志规则

日志只允许保存：

```text
时间
操作类型
targetId hash
邮件数量
字符数
被阻断数量
模型 provider
耗时
错误类型
```

日志不允许保存：

```text
原始正文
完整 prompt
真实邮箱映射表
附件内容
未脱敏报告
```

---

## 18. Prompt 设计

### 18.1 Prompt 文件布局

```text
prompts/
  single-mail-system.md
  single-mail-output-schema.md
  thread-system.md
  thread-output-schema.md
  daily-brief.md
  draft-reply.md
```

### 18.2 Single Mail Prompt 要点

要求：

```text
你是本地只读邮件分析助手。
你只能基于提供内容判断。
不得声称已发送、已移动、已删除邮件。
输出严格 JSON。
如果不确定，设置 needsOriginalMailCheck = true。
```

### 18.3 Thread Prompt 要点

要求：

```text
输入是按时间排序的邮件线程 timeline。
每条 message 的 bodyDelta 是本封邮件新增内容，不一定是完整上下文。
如果 partialContext = true，必须保守判断。
所有待办和风险尽量提供 sourceMailId。
输出严格 JSON。
```

### 18.4 Draft Reply Prompt 要点

要求：

```text
只生成回复草稿。
不得说已经发送。
语气专业、简洁。
如缺少关键信息，要在 missingInfo 中指出。
```

---

## 19. 测试方案与验收标准

### 19.1 单元测试

新增测试：

```text
src/test/analysis-target.test.ts
src/test/single-mail-analysis-schema.test.ts
src/test/thread-engine.test.ts
src/test/thread-store.test.ts
src/test/thread-timeline.test.ts
src/test/security-gate.test.ts
src/test/redaction.test.ts
src/test/thread-analysis-schema.test.ts
src/test/report-thread.test.ts
src/test/llm-provider.test.ts
```

### 19.2 Sample 测试场景

必须覆盖：

1. 单封普通邮件。
2. 单封重要邮件。
3. 单封需要回复邮件。
4. 长邮件链 10 封以上。
5. 长邮件链包含重复引用正文。
6. 线程中部分邮件被 security gate block。
7. 邮件含邮箱、手机号、URL、token。
8. 模型返回非法 JSON。
9. 无模型可用。
10. 无 Outlook sample mode。

### 19.3 验收命令

保持：

```bash
npm run compile
npm test
npm run validate:sample
```

新增 sample validation 目标：

```text
1. 生成 sample mail pull result。
2. 构建 mail-store。
3. 构建 thread-store。
4. 执行 redaction。
5. 使用 mock provider 生成 mail analysis。
6. 使用 mock provider 生成 thread analysis。
7. 生成 daily brief 和 thread report。
```

---

## 20. 版本路线图 v0.2 ~ v0.6

### v0.2：Single Mail Analysis 稳定化 + 双视图基础

目标：稳住现有能力，不急着做长邮件链。

实现：

```text
1. 稳定 SingleMailAnalysisResult。
2. 新增 AnalysisTarget 抽象。
3. 增加 evidence / sourceMailId / needsOriginalMailCheck。
4. 初步 Mail-level Security Gate。
5. 保持现有 mail-store / dashboard / summary 兼容。
```

验收：

```text
单封邮件分析能力不退化。
Dashboard 仍能按分类展示。
每条结果能说明 reason / suggestedAction / confidence。
```

### v0.3：Thread Timeline MVP

目标：新增特色阅读体验，但不替代 Mail View。

实现：

```text
1. Collector 增加 conversationId / conversationIndex。
2. 新增 ThreadStore / ThreadRecord。
3. 新增 Thread Engine。
4. 新增 Thread Timeline。
5. Dashboard 新增 Threads Tab。
```

验收：

```text
长邮件链可以按时间线展示。
不调用 AI 也能使用。
Mail Tab 不受影响。
```

### v0.4：Unified Security Gate + Redaction

目标：安全能力从配置项升级为系统能力。

实现：

```text
1. 新增统一 SecurityGate。
2. 新增 Redaction。
3. 支持 allow / manual_confirm / block。
4. 支持 mail-level gate。
5. 支持 thread-level gate。
6. 支持 partial context。
7. Dashboard 新增 Security Review。
```

验收：

```text
所有进入 AI 的内容先经过 security gate。
敏感信息默认脱敏。
被阻断内容不会进入模型。
```

### v0.5：Thread-level AI + Dual-view Dashboard

目标：Mail Analysis 负责广度，Thread Analysis 负责深度。

实现：

```text
1. 新增 ThreadAnalysisResult。
2. 新增 thread prompt。
3. 新增 thread analysis service。
4. Today 页面融合 mail 和 thread。
5. Thread Card 展示 currentStatus / actionItems / risks / draftReply。
```

验收：

```text
单封邮件仍能独立分析。
长线程能生成结构化分析。
每个关键结论尽量带 sourceMailId。
```

### v0.6：Reports + Provider Abstraction

目标：从分析工具升级为邮件工作流产物生成器。

实现：

```text
1. Daily Brief。
2. Single Mail Report。
3. Thread Report。
4. Weekly Pattern Report。
5. LLM Provider 抽象。
6. Copilot Provider / Mock Provider。
7. 预留 OpenAI-compatible Provider。
```

验收：

```text
可以导出每日简报、单封邮件报告、线程报告。
报告遵守 Security Gate / Redaction。
模型调用层不再和 Copilot 强耦合。
```

---

## 21. 建议 GitHub Issues

### Issue 1：Stabilize Single Mail Analysis Schema and Evidence

**Version:** v0.2  
**Priority:** P0

任务：

```text
1. 新增或整理 SingleMailAnalysisResult。
2. 增加 evidence / sourceMailId / needsOriginalMailCheck。
3. 保留 category / priority / summary / reason / suggestedAction / draftReply。
4. 保证旧 analysis-result.json 兼容。
5. 增加 schema parse / validation 测试。
```

验收：

```text
单封邮件分析结果结构稳定。
Dashboard 能正常展示旧能力。
每条分析结果能说明为什么这么判断。
```

---

### Issue 2：Introduce Unified AnalysisTarget Abstraction

**Version:** v0.2  
**Priority:** P0

任务：

```text
1. 新增 analysis-target.ts。
2. 定义 MailAnalysisTarget / ThreadAnalysisTarget。
3. 当前 single mail analysis 改为基于 MailAnalysisTarget。
4. 预留 ThreadAnalysisTarget。
```

验收：

```text
single mail 可以包装成 MailAnalysisTarget。
thread 后续可以包装成 ThreadAnalysisTarget。
分析服务可以基于 target.type 分发。
```

---

### Issue 3：Add Mail-level Security Gate

**Version:** v0.2 / v0.4  
**Priority:** P0

任务：

```text
1. 新增 MailSecurityGate。
2. 输出 allow / manual_confirm / block。
3. 支持 classification threshold。
4. 支持 blocked reason。
5. 接入当前 autoAnalyzeMaxClassificationLevel 配置。
```

验收：

```text
超过阈值的邮件不会自动分析。
需要确认的邮件进入 manual review。
被阻断的邮件有明确原因。
```

---

### Issue 4：Add ConversationID and ConversationIndex to Outlook Collector

**Version:** v0.3  
**Priority:** P0

任务：

```text
1. VBS 采集增加 ConversationID。
2. VBS 采集增加 ConversationIndex。
3. 输出到 mail-store 或 mail-pull-result.json。
4. sample mode 补充 conversation 字段。
```

验收：

```text
同一邮件链中的邮件有相同 conversationId。
可以基于 conversationId 做初步聚合。
sample mode 能演示 thread 聚合。
```

---

### Issue 5：Introduce ThreadStore and ThreadRecord Schema

**Version:** v0.3  
**Priority:** P0

任务：

```text
1. 新增 thread-schema.ts。
2. 新增 thread-store.ts。
3. 从 MailStore 构建 ThreadStore。
4. MailRecord 仍然独立存在。
```

验收：

```text
可以生成 thread-store.json。
ThreadRecord 作为聚合视图存在。
不破坏 MailRecord / Mail Dashboard。
```

---

### Issue 6：Build Thread Timeline Engine

**Version:** v0.3  
**Priority:** P0

任务：

```text
1. 按 conversationId 聚合。
2. 按 conversationIndex / receivedTime 排序。
3. 生成 timeline。
4. 做基础正文清洗。
5. 做 body hash 去重。
6. 标记 duplicate body。
```

验收：

```text
长邮件链可以展示为聊天记录。
重复引用正文不会严重污染时间线。
用户不调用 AI 也能看懂线程。
```

---

### Issue 7：Add Threads Tab Without Weakening Mail Tab

**Version:** v0.3  
**Priority:** P0

任务：

```text
1. Dashboard 新增 Threads Tab。
2. 保留原 Mail Tab / 分类面板。
3. Thread Card 显示 subject / participants / messageCount / lastTime。
4. Thread Detail 显示 timeline。
5. Mail Detail 可以跳转到所属 Thread。
6. Thread Detail 可以跳回单封 Mail。
```

验收：

```text
用户既可以按单封邮件处理，也可以按线程处理。
两种视图互相跳转，但互不替代。
```

---

### Issue 8：Implement Redaction and Unified Security Gate

**Version:** v0.4  
**Priority:** P1

任务：

```text
1. 新增 redaction.ts。
2. 支持 email / phone / url / ip / token / money 脱敏。
3. 新增 SecurityGate。
4. 支持 MailGateDecision。
5. 支持 ThreadGateDecision。
6. 支持 partial context。
```

验收：

```text
AI payload 中默认不包含原始敏感字段。
线程中部分邮件被阻断时，可以只分析允许部分。
Dashboard 显示安全决策原因。
```

---

### Issue 9：Add Thread-level AI Analysis

**Version:** v0.5  
**Priority:** P1

任务：

```text
1. 新增 ThreadAnalysisResult。
2. 新增 thread prompt。
3. 输入使用 redacted timeline。
4. 输出 currentStatus / decisions / openQuestions / actionItems / risks / draftReply。
5. 支持 evidence sourceMailId。
```

验收：

```text
长线程可以生成结构化分析结果。
分析结果能回溯到具体邮件。
不影响 single mail analysis。
```

---

### Issue 10：Add Unified Reports for Mail and Thread

**Version:** v0.6  
**Priority:** P2

任务：

```text
1. Daily Brief。
2. Single Mail Report。
3. Thread Report。
4. Weekly Pattern Report。
5. Markdown export。
6. Report 遵守 Security Gate / Redaction。
```

验收：

```text
可以导出今日简报。
可以导出单封邮件报告。
可以导出线程报告。
报告默认不泄露被脱敏内容。
```

---

## 22. 实现顺序建议

### 第一批：不破坏现有功能

```text
1. Stabilize Single Mail Analysis Schema and Evidence
2. Introduce Unified AnalysisTarget Abstraction
3. Add Mail-level Security Gate
```

目标：把当前 POC 稳住。

### 第二批：新增 Thread Timeline

```text
4. Add ConversationID and ConversationIndex to Outlook Collector
5. Introduce ThreadStore and ThreadRecord Schema
6. Build Thread Timeline Engine
7. Add Threads Tab Without Weakening Mail Tab
```

目标：做出特色阅读能力。

### 第三批：安全体系化

```text
8. Implement Redaction and Unified Security Gate
```

目标：所有 AI 输入可控。

### 第四批：AI 深度分析

```text
9. Add Thread-level AI Analysis
```

目标：线程级理解。

### 第五批：产物化与扩展

```text
10. Add Unified Reports for Mail and Thread
```

目标：输出可复用工作产物。

---

## 23. 注意事项与风险点

### 23.1 classic Outlook / new Outlook 风险

本方案依赖 classic Outlook 的 COM / Outlook Object Model 能力。New Outlook 不支持 COM add-ins / VBA / Outlook Object Model / MAPI 等传统扩展能力。因此文档和 UI 都应明确：

```text
This extension requires Windows classic Outlook.
New Outlook is not supported.
```

### 23.2 Outlook Object Model Guard

某些属性或动作可能触发 Outlook 安全提示，尤其是访问地址簿信息、自动发送等。虽然本项目只读且不自动发送，但仍要对 `SenderEmailAddress` 等字段做容错。

策略：

```text
1. 字段读取失败不影响整封邮件采集。
2. sender email 失败时 fallback 到 sender name。
3. 不做自动发送，避免 send warning。
4. 不尝试绕过企业安全策略。
```

### 23.3 不要做 unattended / service

Office 应用不适合在无人值守、非交互式服务端环境自动化。项目应保持本机交互式 VS Code 插件形态，不做 Windows Service。

### 23.4 Thread 聚合误判

风险：

- `ConversationID` 缺失。
- 主题相似但不是同一线程。
- 邮件被转发后上下文混杂。
- 跨文件夹 / 归档邮件不完整。

策略：

```text
1. conversationId 优先。
2. fallback 聚合要保守。
3. UI 显示 thread confidence。
4. 允许用户从单封邮件进入所属 thread，但不强制。
```

### 23.5 bodyDelta 误切风险

引用切割没有统一标准，可能误删有效内容。

策略：

```text
1. 第一版只做基础规则。
2. bodyDelta 旁边保留 Show raw excerpt。
3. AI 分析结果可标记 needsOriginalMailCheck。
4. 不把 bodyDelta 结果当成不可质疑事实。
```

### 23.6 脱敏误伤风险

风险：

- URL / token 识别不准。
- 项目代号被误脱敏。
- 脱敏后影响模型理解。

策略：

```text
1. 脱敏规则可配置。
2. Dashboard 提供 redacted preview。
3. 默认保守脱敏。
4. 自定义 pattern 支持 manual_confirm / block。
```

### 23.7 模型 JSON 输出不稳定

策略：

```text
1. prompt 强制 JSON。
2. schema validation。
3. parse 失败进入 uncertain。
4. 保留 raw error，不保存原始 prompt。
5. MockProvider 覆盖测试。
```

### 23.8 性能风险

长线程、多个文件夹、历史加载可能变慢。

策略：

```text
1. 继续使用 range limit。
2. thread max messages 默认 50。
3. body chars per message 默认 2000。
4. thread analysis 不默认分析所有线程，只分析 selected 或 high-value threads。
5. Dashboard 分页 / 虚拟列表可后续实现。
```

### 23.9 本地缓存风险

策略：

```text
1. raw body 默认短期保留。
2. analysis summary 保留 7 天。
3. reports 使用 redacted 内容。
4. Clear Local Cache 保留并增强。
5. 不在日志中保存原文。
```

---

## 24. Codex 执行指南

### 24.1 总体要求

Codex 在实现时必须遵守：

```text
1. 不破坏现有 commands。
2. 不破坏 sample mode。
3. 不删除现有 mail analysis 能力。
4. 新增功能优先通过新模块实现。
5. 每个 issue 都要补测试。
6. 每次改动后运行 npm run compile 和 npm test。
7. 不引入 PST / OST。
8. 不实现自动发送 / 删除 / 移动。
9. 不把 raw body 写入日志。
10. 所有 AI 输入必须经过 Security Gate / Redaction。
```

### 24.2 每个 Issue 的实现流程

建议 Codex 对每个 issue 使用以下流程：

```text
1. 阅读 README.md、user guide.md、agents.md、docs/acceptance-criteria.md。
2. 定位当前相关模块。
3. 先写或更新类型定义。
4. 写单元测试。
5. 实现最小功能。
6. 跑 npm run compile。
7. 跑 npm test。
8. 如果涉及 sample，跑 npm run validate:sample。
9. 更新 README / user guide / agents.md 中必要说明。
10. 提交变更说明。
```

### 24.3 禁止事项

```text
不要一次性重构整个仓库。
不要把 mail-store 改成 SQLite。
不要把 VBS 替换成 Python。
不要引入外部 LLM SDK 作为默认依赖。
不要默认读取附件内容。
不要自动发送邮件。
不要默认全量扫描邮箱。
不要让 Thread 功能覆盖 Mail 功能。
```

### 24.4 建议分支命名

```text
feature/v0.2-single-mail-schema
feature/v0.2-analysis-target
feature/v0.3-thread-collector-fields
feature/v0.3-thread-store
feature/v0.3-thread-timeline
feature/v0.4-security-gate
feature/v0.4-redaction
feature/v0.5-thread-ai
feature/v0.6-reports
```

### 24.5 Definition of Done

每个功能完成必须满足：

```text
1. TypeScript 编译通过。
2. 单元测试通过。
3. sample mode 可运行。
4. 旧功能不回退。
5. 文档更新。
6. 不违反只读边界。
7. 不新增原文长期落盘风险。
```

---

## 25. 参考资料

1. 当前仓库 README：`https://github.com/Wsr-7/easy-mail`
2. 当前 User Guide：`https://github.com/Wsr-7/easy-mail/blob/main/user%20guide.md`
3. 当前验收标准：`https://github.com/Wsr-7/easy-mail/blob/main/docs/acceptance-criteria.md`
4. Microsoft: Feature comparison between new Outlook and classic Outlook  
   `https://support.microsoft.com/en-us/office/feature-comparison-between-new-outlook-and-classic-outlook-de453583-1e76-48bf-975a-2e9cd2ee16dd`
5. Microsoft: Outlook MailItem.ConversationID  
   `https://learn.microsoft.com/en-us/office/vba/api/outlook.mailitem.conversationid`
6. Microsoft: Outlook MailItem.ConversationIndex  
   `https://learn.microsoft.com/en-us/office/vba/api/outlook.mailitem.conversationindex`
7. Microsoft: Outlook Conversation.GetTable  
   `https://learn.microsoft.com/en-us/office/vba/api/outlook.conversation.gettable`
8. Microsoft: Outlook Items.Restrict  
   `https://learn.microsoft.com/en-us/office/vba/api/outlook.items.restrict`
9. Microsoft: Security Behavior of the Outlook Object Model  
   `https://learn.microsoft.com/en-us/office/vba/outlook/how-to/security/security-behavior-of-the-outlook-object-model`
10. Microsoft: Outlook Object Model Security Warnings  
    `https://learn.microsoft.com/en-us/office/vba/outlook/how-to/security/outlook-object-model-security-warnings`
11. Microsoft: Considerations for unattended automation of Office  
    `https://learn.microsoft.com/en-us/office/client-developer/integration/considerations-unattended-automation-office-microsoft-365-for-unattended-rpa`
12. VS Code Language Model API  
    `https://code.visualstudio.com/api/extension-guides/ai/language-model`
13. Mailgun Talon quotation/signature extraction  
    `https://github.com/mailgun/talon`
