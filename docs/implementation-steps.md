# Step by Step 实现步骤

## Phase 0: 仓库和文档

验收标准：

- `easy-mail` 是独立 git repo。
- `docs/` 下有设计、实现、VSIX、安全文档。
- 已推送到 `Wsr-7/easy-mail`。

步骤：

```text
1. 创建 easy-mail 目录。
2. 创建 README.md 和 docs。
3. 初始化 git repo。
4. 提交文档。
5. 使用 gh 创建 GitHub repo。
6. 推送 main 分支。
```

## Phase 1: VBScript 邮件采集器

验收标准：

- 能从 classic Outlook 读取 Inbox 最近 50 封邮件。
- 能输出 `data/mail-digest.md`。
- 不读取全文，只读取正文截断。
- 不写回 Outlook。

实现步骤：

```text
1. 新建 scripts/collect-outlook-mails.vbs。
2. 通过 CreateObject("Outlook.Application") 获取 Outlook Application。
3. 通过 GetNamespace("MAPI") 获取 MAPI namespace。
4. 读取默认 Inbox folder。
5. 对 Items 按 ReceivedTime 倒序排序。
6. 遍历最多 maxItems 封邮件。
7. 提取 subject、sender、receivedTime、unread、importance、body excerpt。
8. 转义 Markdown 中可能破坏结构的内容。
9. 写入 data/mail-digest.md。
10. 在无 Outlook、无邮件、COM 报错时给出清晰错误。
```

后续扩展：

```text
1. 支持命令行参数：recentHours、maxItems、folders。
2. 支持扫描多个文件夹。
3. 支持递归子文件夹。
4. 支持输出 folder inventory，供 VS Code 插件选择。
```

## Phase 2: VS Code 插件骨架

验收标准：

- 插件可以被 `vsce package` 打成 `.vsix`。
- 提供 Activity Bar 和 Sidebar。
- 提供 `Pull Mail`、`Analyze`、`Refresh`、`Open Digest` 命令。

实现步骤：

```text
1. 在 vscode-extension/ 下创建 TypeScript VS Code extension。
2. 定义 package.json contribution points：
   - viewsContainers.activitybar
   - views
   - commands
3. 实现 ExtensionContext 初始化。
4. 实现 TreeDataProvider 展示分类。
5. 实现 WebviewViewProvider 展示 dashboard。
6. 实现命令注册。
7. 实现本地 data 路径解析。
8. 实现打开 digest / summary 文件。
```

## Phase 3: 插件调用 VBScript

验收标准：

- 点击 `Pull Mail` 后生成最新 `data/mail-digest.md`。
- 命令失败时能在 VS Code 中看到错误。

实现步骤：

```text
1. 插件读取配置。
2. 使用 child_process 调用 cscript.exe。
3. 传入 maxItems、recentHours、folders、bodyExcerptChars。
4. 等待命令结束。
5. 检查 data/mail-digest.md 是否存在。
6. 刷新 dashboard 状态。
```

注意：

```text
使用 cscript.exe 而不是 wscript.exe，便于捕获 stdout/stderr。
```

## Phase 4: Copilot 分析

验收标准：

- 点击 `Analyze` 后调用 GitHub Copilot 模型。
- 生成 `data/analysis-result.json`。
- JSON 可以被插件解析。
- 同时生成 `data/mail-summary.md`。

实现步骤：

```text
1. 读取 data/mail-digest.md。
2. 调用 vscode.lm.selectChatModels({ vendor: "copilot" })。
3. 如果没有可用模型，提示用户登录 GitHub Copilot。
4. 构造 system/user prompt。
5. 要求模型只返回 JSON，不返回 Markdown fence。
6. 接收 response stream。
7. 清理可能出现的代码围栏。
8. JSON.parse。
9. 做 schema 基础校验。
10. 保存 analysis-result.json。
11. 根据 JSON 生成 mail-summary.md。
12. 刷新 dashboard。
```

建议 prompt 约束：

```text
你是企业邮件分析助手。只根据输入邮件内容判断，不要编造。
请返回严格 JSON，不能包含 Markdown 代码围栏。
category 只能使用 mustHandleToday、risk、waitingForMe、followUp、notice、ignored、uncertain。
priority 只能使用 P0、P1、P2、P3。
如果正文不足以判断，needsOriginalMailCheck=true。
```

## Phase 5: Dashboard

验收标准：

- 左侧分类显示数量。
- 主面板按分类和优先级展示邮件卡片。
- 支持 Copy Draft、Ignore、Open Digest、Open Summary。

实现步骤：

```text
1. 从 analysis-result.json 读取 overview 和 items。
2. 按 category 分组。
3. 分类内按 priority 和 receivedTime 排序。
4. Webview 渲染统计卡片。
5. Webview 渲染邮件卡片。
6. 实现 webview -> extension message：
   - copyDraft
   - ignore
   - reanalyzeSelected
7. ignored 状态保存到 globalState 或 data/ignored.json。
```

## Phase 6: 本地试用

验收标准：

- 在一台 classic Outlook 机器上完成完整链路：
  `Pull Mail -> Analyze -> Dashboard -> Copy Draft`。

试用步骤：

```text
1. 安装 .vsix。
2. 打开 VS Code。
3. 登录 GitHub Copilot。
4. 打开 Easy Mail sidebar。
5. 点击 Pull Mail。
6. 检查 mail-digest.md。
7. 点击 Analyze。
8. 检查 dashboard 分类和 mail-summary.md。
9. 记录误判邮件，调整 prompt 和规则。
```

## Phase 7: 长期产品化

如果 POC 证明有价值，下一步不要继续扩大 VBScript，而是迁移采集器：

```text
VBScript POC -> C# signed local agent -> Intune/SCCM/GPO 分发
```

长期能力：

```text
1. 代码签名。
2. 安装包。
3. 自动升级。
4. 本地 SQLite。
5. Windows notification。
6. 可选写回 Outlook category。
7. 统一策略配置。
8. 安全审计日志。
```

