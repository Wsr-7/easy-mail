# 安全与合规边界

## 基本原则

第一版必须是本地 POC，不做中心化邮件采集。

```text
默认不上传邮件正文。
默认不发送邮件。
默认不删除邮件。
默认不移动邮件。
默认不写回 Outlook。
```

## 数据边界

本地文件：

```text
data/mail-digest.md
data/analysis-result.json
data/mail-summary.md
data/ignored.json
```

这些文件可能包含邮件主题、发件人和正文片段。默认应存放在用户本机目录，并加入 `.gitignore`，禁止提交到仓库。

## AI 边界

VS Code 插件调用 GitHub Copilot 模型时，邮件摘要内容会进入 Copilot 处理链路。上线前必须确认：

```text
1. 公司是否允许邮件内容进入 GitHub Copilot。
2. 是否只能发送正文片段，不能发送完整正文。
3. 是否需要脱敏发件人、客户名、合同号。
4. 是否需要禁用 draftReply。
5. 是否需要仅对用户主动选择的邮件调用 AI。
```

如果公司不允许邮件正文进入 Copilot，则插件只能做：

```text
1. 本地规则打分。
2. 主题级摘要。
3. 用户手动复制选中邮件内容到允许的工具。
```

## VBScript 风险

VBScript 只作为 POC：

```text
1. Microsoft 已宣布 VBScript deprecated。
2. 企业 EDR 可能拦截 Windows Script Host。
3. 代码签名和集中分发能力弱。
4. 错误处理和依赖管理较弱。
```

长期应迁移到：

```text
C# signed local agent + Outlook Object Model + 本地 SQLite
```

## 权限最小化

第一版采集器只读以下字段：

```text
Subject
SenderName
SenderEmailAddress
ReceivedTime
UnRead
Importance
To
CC
Body excerpt
```

第一版不读取附件，不读取 calendar，不访问联系人，不写回 Outlook。

## 审计建议

POC 阶段记录本地日志：

```text
1. 采集时间。
2. 扫描文件夹。
3. 邮件数量。
4. 是否包含正文片段。
5. 调用 Copilot 的时间。
6. 生成结果文件路径。
```

不要在日志中写入完整正文。

