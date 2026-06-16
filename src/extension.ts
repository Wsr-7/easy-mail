import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import * as cp from "node:child_process";
import { parseDigest, type DigestData } from "./lib/digest";
import { normalizeAnalysis, parseAnalysisJson, type AnalysisResult } from "./lib/analysis-schema";
import { buildSummaryMarkdown } from "./lib/summary";
import { buildDashboardState, CATEGORY_ORDER, type DashboardState } from "./lib/dashboard-state";

type Locale = "zh-CN" | "en-US";

type BusyState = {
  label: string;
  detail: string;
  startedAt: string;
};

type DashboardLabels = {
  toolbar: Record<"pullMail" | "sample" | "analyze" | "refresh" | "openDigest" | "openSummary" | "settingsFile", string>;
  settings: {
    title: string;
    range: string;
    output: string;
    recentHours: string;
    maxItems: string;
    folders: string;
    bodyChars: string;
    bodyCharsHelp: string;
    modelFamily: string;
    save: string;
    recentHoursOption: string;
    maxItemsOption: string;
    zhOption: string;
    enOption: string;
  };
  meta: Record<"range" | "folders" | "generated" | "requestedModel" | "lastUsedModel", string>;
  stats: Record<"mustHandle" | "risk" | "waiting" | "notice", string>;
  categories: Record<string, string>;
  card: Record<"from" | "received" | "summary" | "reason" | "suggestedAction" | "copyDraft" | "ignore" | "noItems", string>;
  progress: Record<"pullMail" | "sampleDigest" | "analyze", string> & { detail: string };
  model: Record<"fallback" | "preferred", string>;
};

const LABELS: Record<Locale, DashboardLabels> = {
  "zh-CN": {
    toolbar: {
      pullMail: "拉取邮件",
      sample: "示例数据",
      analyze: "分析",
      refresh: "刷新",
      openDigest: "打开邮件摘要",
      openSummary: "打开分析总结",
      settingsFile: "配置文件"
    },
    settings: {
      title: "设置",
      range: "范围",
      output: "语言",
      recentHours: "最近小时数",
      maxItems: "最多邮件数",
      folders: "文件夹（用 ; 分隔）",
      bodyChars: "正文截断字符数",
      bodyCharsHelp: "限制每封邮件送给 Copilot 的正文长度，避免分析过慢或上下文过大。",
      modelFamily: "请求模型",
      save: "保存设置",
      recentHoursOption: "最近小时数",
      maxItemsOption: "最多邮件数",
      zhOption: "中文界面和中文分析",
      enOption: "English UI and analysis"
    },
    meta: {
      range: "范围",
      folders: "文件夹",
      generated: "生成时间",
      requestedModel: "请求模型",
      lastUsedModel: "上次使用模型"
    },
    stats: {
      mustHandle: "必须处理",
      risk: "风险",
      waiting: "等待回复",
      notice: "通知"
    },
    categories: {
      mustHandleToday: "今天必须处理",
      risk: "风险邮件",
      waitingForMe: "等待我回复",
      followUp: "需要跟进",
      notice: "普通通知",
      ignored: "已忽略",
      uncertain: "不确定"
    },
    card: {
      from: "发件人",
      received: "收到时间",
      summary: "摘要",
      reason: "判断原因",
      suggestedAction: "建议动作",
      copyDraft: "复制回复草稿",
      ignore: "忽略",
      noItems: "暂无邮件"
    },
    progress: {
      pullMail: "正在拉取邮件",
      sampleDigest: "正在生成示例数据",
      analyze: "正在调用 Copilot 分析",
      detail: "任务进行中，请稍候..."
    },
    model: {
      fallback: "回退模型",
      preferred: "首选模型"
    }
  },
  "en-US": {
    toolbar: {
      pullMail: "Pull Mail",
      sample: "Sample",
      analyze: "Analyze",
      refresh: "Refresh",
      openDigest: "Open Digest",
      openSummary: "Open Summary",
      settingsFile: "Settings File"
    },
    settings: {
      title: "Settings",
      range: "Range",
      output: "Language",
      recentHours: "Recent Hours",
      maxItems: "Max Items",
      folders: "Folders (; separated)",
      bodyChars: "Body Chars",
      bodyCharsHelp: "Limits how many body characters per email are sent to Copilot.",
      modelFamily: "Requested Model",
      save: "Save Settings",
      recentHoursOption: "Recent Hours",
      maxItemsOption: "Max Items",
      zhOption: "中文界面和中文分析",
      enOption: "English UI and analysis"
    },
    meta: {
      range: "Range",
      folders: "Folders",
      generated: "Generated",
      requestedModel: "Requested model",
      lastUsedModel: "Last used model"
    },
    stats: {
      mustHandle: "Must Handle",
      risk: "Risk",
      waiting: "Waiting",
      notice: "Notice"
    },
    categories: {
      mustHandleToday: "Must Handle Today",
      risk: "Risk",
      waitingForMe: "Waiting For Me",
      followUp: "Follow-up",
      notice: "Notice",
      ignored: "Ignored",
      uncertain: "Uncertain"
    },
    card: {
      from: "From",
      received: "Received",
      summary: "Summary",
      reason: "Reason",
      suggestedAction: "Suggested Action",
      copyDraft: "Copy Draft",
      ignore: "Ignore",
      noItems: "No items"
    },
    progress: {
      pullMail: "Pulling mail",
      sampleDigest: "Generating sample digest",
      analyze: "Analyzing with Copilot",
      detail: "Task is running. Please wait..."
    },
    model: {
      fallback: "fallback",
      preferred: "preferred"
    }
  }
};

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const app = new EmailAnalysisApp(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("emailAnalysis.dashboard", app.dashboardProvider),
    vscode.commands.registerCommand("emailAnalysis.pullMail", () => app.pullMail(false)),
    vscode.commands.registerCommand("emailAnalysis.generateSampleDigest", () => app.pullMail(true)),
    vscode.commands.registerCommand("emailAnalysis.analyze", () => app.analyze()),
    vscode.commands.registerCommand("emailAnalysis.refreshDashboard", () => app.refresh()),
    vscode.commands.registerCommand("emailAnalysis.openDigest", () => app.openDigest()),
    vscode.commands.registerCommand("emailAnalysis.openSummary", () => app.openSummary()),
    vscode.commands.registerCommand("emailAnalysis.openSettings", () => app.openSettings())
  );

  await app.initialize();
}

export function deactivate(): void {}

class EmailAnalysisApp {
  public readonly dashboardProvider: DashboardProvider;
  private busy: BusyState | null = null;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.dashboardProvider = new DashboardProvider(() => this.getDashboardHtml(), (message) => this.handleMessage(message));
  }

  public async initialize(): Promise<void> {
    await fs.promises.mkdir(this.getDataDir(), { recursive: true });
    await this.ensureConfig();
    await this.refresh();
  }

  public async pullMail(forceSample: boolean): Promise<void> {
    const locale = await this.readLocale();
    const labels = getLabels(locale);
    await this.runWithBusy(forceSample ? labels.progress.sampleDigest : labels.progress.pullMail, labels.progress.detail, async () => {
      await this.pullMailCore(forceSample);
    });
  }

  private async pullMailCore(forceSample: boolean): Promise<void> {
    const config = await this.readConfig();
    await fs.promises.mkdir(this.getDataDir(), { recursive: true });
    const scriptPath = await this.findCollectorScript();
    const args = ["//nologo", scriptPath];
    const maxItems = Number(config.maxItems || 50);
    const recentHours = Number(config.recentHours || 24);
    const rangeMode = String(config.rangeMode || "recentHours");
    args.push("--max-items", String(maxItems));
    args.push("--recent-hours", String(rangeMode === "maxItems" ? 0 : recentHours));
    args.push("--folders", (config.folders || ["Inbox"]).join(";"));
    args.push("--body-chars", String(config.bodyExcerptChars || 1200));
    args.push("--output", this.getDigestPath());
    if (forceSample || config.sampleMode) {
      args.push("--sample");
    }

    await runProcess("cscript.exe", args);
    await this.refresh();
    await vscode.window.showInformationMessage("Email digest generated.");
  }

  public async analyze(): Promise<void> {
    const locale = await this.readLocale();
    const labels = getLabels(locale);
    await this.runWithBusy(labels.progress.analyze, labels.progress.detail, async () => {
      await this.analyzeCore();
    });
  }

  private async analyzeCore(): Promise<void> {
    if (!fs.existsSync(this.getDigestPath())) {
      throw new Error("Digest file does not exist. Run Pull Mail first.");
    }

    const config = await this.readConfig();
    const digestText = await fs.promises.readFile(this.getDigestPath(), "utf8");
    const promptTemplate = await fs.promises.readFile(path.join(this.context.extensionPath, "prompts", "analysis-prompt.md"), "utf8");
    const configuredFamily = typeof config.modelFamily === "string" ? config.modelFamily.trim() : "gpt-5.4";
    const preferredModels = configuredFamily
      ? await vscode.lm.selectChatModels({ vendor: "copilot", family: configuredFamily })
      : [];
    const models = preferredModels.length ? preferredModels : await vscode.lm.selectChatModels({ vendor: "copilot" });
    if (!models.length) {
      throw new Error("No GitHub Copilot model is available in this VS Code session.");
    }

    const selectedModel = models[0];
    await this.writeModelInfo({
      requestedFamily: configuredFamily || "auto",
      usedFallback: preferredModels.length === 0,
      actualFamily: selectedModel.family,
      actualId: selectedModel.id,
      actualName: selectedModel.name,
      actualVendor: selectedModel.vendor,
      analyzedAt: new Date().toISOString()
    });

    const prompt = createAnalysisPrompt(promptTemplate, digestText, String(config.outputLanguage || "zh-CN"));
    const response = await selectedModel.sendRequest(
      [vscode.LanguageModelChatMessage.User(prompt)],
      {},
      new vscode.CancellationTokenSource().token
    );
    const raw = await readResponseText(response.text);
    const analysis = parseAnalysisJson(raw);

    const normalized = normalizeAnalysis(analysis);
    await fs.promises.writeFile(this.getAnalysisPath(), JSON.stringify(normalized, null, 2), "utf8");
    await fs.promises.writeFile(this.getSummaryPath(), buildSummaryMarkdown(normalized), "utf8");
    await this.refresh();
    await vscode.window.showInformationMessage("Email analysis completed.");
  }

  private async runWithBusy<T>(label: string, detail: string, task: () => Promise<T>): Promise<T> {
    this.busy = { label, detail, startedAt: new Date().toISOString() };
    await this.refresh();
    try {
      return await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: label, cancellable: false },
        async (progress) => {
          progress.report({ message: detail });
          return await task();
        }
      );
    } finally {
      this.busy = null;
      await this.refresh();
    }
  }

  public async refresh(): Promise<void> {
    await this.dashboardProvider.update();
  }

  public async openDigest(): Promise<void> {
    await openTextDocument(this.getDigestPath());
  }

  public async openSummary(): Promise<void> {
    await openTextDocument(this.getSummaryPath());
  }

  public async openSettings(): Promise<void> {
    await openTextDocument(this.getConfigPath());
  }

  private getDataDir(): string {
    return path.join(this.context.globalStorageUri.fsPath, "data");
  }

  private getConfigPath(): string {
    return path.join(this.context.globalStorageUri.fsPath, "email-analysis.config.json");
  }

  private getDigestPath(): string {
    return path.join(this.getDataDir(), "mail-digest.md");
  }

  private getAnalysisPath(): string {
    return path.join(this.getDataDir(), "analysis-result.json");
  }

  private getSummaryPath(): string {
    return path.join(this.getDataDir(), "mail-summary.md");
  }

  private getIgnoredPath(): string {
    return path.join(this.getDataDir(), "ignored.json");
  }

  private getModelInfoPath(): string {
    return path.join(this.getDataDir(), "model-info.json");
  }

  private async ensureConfig(): Promise<void> {
    await fs.promises.mkdir(this.context.globalStorageUri.fsPath, { recursive: true });
    if (!fs.existsSync(this.getConfigPath())) {
      const defaults = path.join(this.context.extensionPath, "default-config.json");
      await fs.promises.copyFile(defaults, this.getConfigPath());
    }
  }

  private async readConfig(): Promise<Record<string, any>> {
    await this.ensureConfig();
    const raw = await fs.promises.readFile(this.getConfigPath(), "utf8");
    return JSON.parse(raw);
  }

  private async readLocale(): Promise<Locale> {
    try {
      return getLocaleFromConfig(await this.readConfig());
    } catch {
      return "zh-CN";
    }
  }

  private async writeConfig(config: Record<string, any>): Promise<void> {
    await fs.promises.writeFile(this.getConfigPath(), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }

  private async readIgnoredIds(): Promise<string[]> {
    if (!fs.existsSync(this.getIgnoredPath())) {
      return [];
    }

    try {
      const raw = await fs.promises.readFile(this.getIgnoredPath(), "utf8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private async writeIgnoredIds(ids: string[]): Promise<void> {
    await fs.promises.writeFile(this.getIgnoredPath(), JSON.stringify(ids, null, 2), "utf8");
  }

  private async readModelInfo(): Promise<Record<string, unknown>> {
    if (!fs.existsSync(this.getModelInfoPath())) {
      return {};
    }

    try {
      return JSON.parse(await fs.promises.readFile(this.getModelInfoPath(), "utf8"));
    } catch {
      return {};
    }
  }

  private async writeModelInfo(info: Record<string, unknown>): Promise<void> {
    await fs.promises.writeFile(this.getModelInfoPath(), `${JSON.stringify(info, null, 2)}\n`, "utf8");
  }

  private async findCollectorScript(): Promise<string> {
    const candidate = path.join(this.context.extensionPath, "scripts", "collect-outlook-mails.vbs");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    throw new Error("collect-outlook-mails.vbs not found in extension package.");
  }

  private async loadState(): Promise<DashboardState> {
    const config = await this.readConfig();
    const digest: DigestData = fs.existsSync(this.getDigestPath())
      ? parseDigest(await fs.promises.readFile(this.getDigestPath(), "utf8"))
      : { metadata: { generatedAt: "", rangeMode: "", recentHours: 0, maxItems: 0, folders: [] }, items: [] };
    const analysis: AnalysisResult = fs.existsSync(this.getAnalysisPath())
      ? normalizeAnalysis(JSON.parse(await fs.promises.readFile(this.getAnalysisPath(), "utf8")))
      : { generatedAt: "", overview: { totalMails: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 }, items: [] };
    const ignoredIds = await this.readIgnoredIds();
    const state = buildDashboardState(config, digest, analysis, ignoredIds) as DashboardState & { modelInfo?: Record<string, unknown> };
    state.modelInfo = await this.readModelInfo();
    return state;
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== "object") {
      return;
    }

    const typed = message as { type?: string; draftReply?: string; mailId?: string; config?: unknown };
    if (typed.type === "copyDraft") {
      await vscode.env.clipboard.writeText(String(typed.draftReply || ""));
      await vscode.window.showInformationMessage("Draft reply copied.");
      return;
    }

    if (typed.type === "ignore") {
      const ignoredIds = await this.readIgnoredIds();
      if (typed.mailId && !ignoredIds.includes(typed.mailId)) {
        ignoredIds.push(typed.mailId);
        await this.writeIgnoredIds(ignoredIds);
      }
      await this.refresh();
      return;
    }

    if (typed.type === "refresh") {
      await this.refresh();
      return;
    }

    if (typed.type === "openDigest") {
      await this.openDigest();
      return;
    }

    if (typed.type === "openSummary") {
      await this.openSummary();
      return;
    }

    if (typed.type === "pullMail") {
      await this.pullMail(false);
      return;
    }

    if (typed.type === "sampleDigest") {
      await this.pullMail(true);
      return;
    }

    if (typed.type === "analyze") {
      await this.analyze();
      return;
    }

    if (typed.type === "openSettings") {
      await this.openSettings();
      return;
    }

    if (typed.type === "saveConfig") {
      await this.saveConfigFromMessage(typed);
      await this.refresh();
    }
  }

  private async saveConfigFromMessage(message: { config?: unknown }): Promise<void> {
    if (!message.config || typeof message.config !== "object") {
      return;
    }

    const current = await this.readConfig();
    const patch = message.config as Record<string, unknown>;
    const next = {
      ...current,
      rangeMode: patch.rangeMode === "maxItems" ? "maxItems" : "recentHours",
      recentHours: positiveNumber(patch.recentHours, current.recentHours || 24),
      maxItems: positiveNumber(patch.maxItems, current.maxItems || 50),
      folders: parseFolders(patch.folders, current.folders || ["Inbox"]),
      bodyExcerptChars: positiveNumber(patch.bodyExcerptChars, current.bodyExcerptChars || 1200),
      outputLanguage: patch.outputLanguage === "en-US" ? "en-US" : "zh-CN",
      modelFamily: String(patch.modelFamily || current.modelFamily || "gpt-5.4").trim()
    };
    await this.writeConfig(next);
    await vscode.window.showInformationMessage("Email Analysis settings saved.");
  }

  private async getDashboardHtml(): Promise<string> {
    const state = await this.loadState();
    const digestMeta = state.digestMetadata || {};
    const modelInfo = (state as DashboardState & { modelInfo?: Record<string, unknown> }).modelInfo || {};
    const config = state.config as Record<string, unknown>;
    const locale = getLocaleFromConfig(config);
    const labels = getLabels(locale);
    const rows = CATEGORY_ORDER.map((category) => renderCategory(category, state.categories.find((entry) => entry.id === category)?.items || [], labels)).join("");
    const busyHtml = this.busy
      ? `<div class="busy"><div class="busy-row"><strong>${escapeHtml(this.busy.label)}</strong><span>${escapeHtml(this.busy.detail)}</span></div><div class="busy-bar"><span></span></div></div>`
      : "";

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    :root { color-scheme: light; }
    body { font-family: "Segoe UI", sans-serif; margin: 0; padding: 12px; color: #1b2a34; background: #f3f0ea; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    button { border: 0; border-radius: 8px; padding: 8px 12px; background: #0f4c5c; color: #fff; cursor: pointer; }
    button.secondary { background: #d8c3a5; color: #2f2a24; }
    button.ghost { background: #e9e1d4; color: #2f2a24; }
    .busy { background: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; border-left: 4px solid #0f4c5c; }
    .busy-row { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; }
    .busy-bar { height: 4px; overflow: hidden; border-radius: 999px; background: #e9e1d4; margin-top: 8px; }
    .busy-bar span { display: block; width: 45%; height: 100%; border-radius: 999px; background: #0f4c5c; animation: loading 1.2s ease-in-out infinite; }
    @keyframes loading { 0% { transform: translateX(-110%); } 100% { transform: translateX(230%); } }
    .settings { background: #fff; border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; }
    .settings summary { cursor: pointer; font-weight: 700; }
    .settings .settings-body { margin-top: 10px; }
    .help { color: #6d6d6d; font-size: 11px; line-height: 1.35; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #41515a; }
    input, select { border: 1px solid #d8c3a5; border-radius: 6px; padding: 6px 8px; background: #fffdf8; color: #1b2a34; }
    .meta { background: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
    .stat { background: #fff; padding: 10px; border-radius: 10px; }
    .stat .value { font-size: 22px; font-weight: 700; }
    details.category { margin-bottom: 12px; background: #fff; border-radius: 10px; padding: 8px 10px; }
    details.category summary { cursor: pointer; font-weight: 700; font-size: 16px; }
    details.category .category-body { margin-top: 8px; }
    .card { background: #fff; border-radius: 10px; padding: 12px; margin-bottom: 8px; }
    .header { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .title { font-weight: 700; }
    .badge { border-radius: 999px; padding: 2px 8px; font-size: 12px; background: #f5c16c; }
    .empty { color: #6d6d6d; font-style: italic; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .actions button { padding: 6px 10px; font-size: 12px; }
    pre { white-space: pre-wrap; background: #faf7f2; padding: 8px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="post('pullMail')">${escapeHtml(labels.toolbar.pullMail)}</button>
    <button onclick="post('sampleDigest')">${escapeHtml(labels.toolbar.sample)}</button>
    <button onclick="post('analyze')">${escapeHtml(labels.toolbar.analyze)}</button>
    <button onclick="post('refresh')">${escapeHtml(labels.toolbar.refresh)}</button>
    <button class="secondary" onclick="post('openDigest')">${escapeHtml(labels.toolbar.openDigest)}</button>
    <button class="secondary" onclick="post('openSummary')">${escapeHtml(labels.toolbar.openSummary)}</button>
    <button class="ghost" onclick="post('openSettings')">${escapeHtml(labels.toolbar.settingsFile)}</button>
  </div>
  ${busyHtml}
  <details class="settings">
    <summary>${escapeHtml(labels.settings.title)}</summary>
    <div class="settings-body">
      <div class="grid">
      <label>${escapeHtml(labels.settings.range)}
        <select id="rangeMode">
          <option value="recentHours" ${selected(config.rangeMode, "recentHours")}>${escapeHtml(labels.settings.recentHoursOption)}</option>
          <option value="maxItems" ${selected(config.rangeMode, "maxItems")}>${escapeHtml(labels.settings.maxItemsOption)}</option>
        </select>
      </label>
      <label>${escapeHtml(labels.settings.output)}
        <select id="outputLanguage">
          <option value="zh-CN" ${selected(config.outputLanguage, "zh-CN")}>${escapeHtml(labels.settings.zhOption)}</option>
          <option value="en-US" ${selected(config.outputLanguage, "en-US")}>${escapeHtml(labels.settings.enOption)}</option>
        </select>
      </label>
      <label>${escapeHtml(labels.settings.recentHours)}
        <input id="recentHours" type="number" min="1" value="${escapeAttr(String(config.recentHours || 24))}" />
      </label>
      <label>${escapeHtml(labels.settings.maxItems)}
        <input id="maxItems" type="number" min="1" value="${escapeAttr(String(config.maxItems || 50))}" />
      </label>
      <label>${escapeHtml(labels.settings.folders)}
        <input id="folders" value="${escapeAttr(Array.isArray(config.folders) ? config.folders.join(";") : "Inbox")}" />
      </label>
      <label>${escapeHtml(labels.settings.bodyChars)}
        <input id="bodyExcerptChars" type="number" min="100" value="${escapeAttr(String(config.bodyExcerptChars || 1200))}" />
        <span class="help">${escapeHtml(labels.settings.bodyCharsHelp)}</span>
      </label>
      <label>${escapeHtml(labels.settings.modelFamily)}
        <input id="modelFamily" value="${escapeAttr(String(config.modelFamily || "gpt-5.4"))}" />
      </label>
      </div>
      <div class="toolbar" style="margin: 10px 0 0">
        <button class="secondary" onclick="saveConfig()">${escapeHtml(labels.settings.save)}</button>
      </div>
    </div>
  </details>
  <div class="meta">
    <div><strong>${escapeHtml(labels.meta.range)}:</strong> ${escapeHtml(digestMeta.rangeMode || "-")} / ${escapeHtml(String(digestMeta.recentHours || "-"))}h</div>
    <div><strong>${escapeHtml(labels.meta.folders)}:</strong> ${escapeHtml((digestMeta.folders || []).join(", ") || "-")}</div>
    <div><strong>${escapeHtml(labels.meta.generated)}:</strong> ${escapeHtml(digestMeta.generatedAt || "-")}</div>
    <div><strong>${escapeHtml(labels.meta.requestedModel)}:</strong> ${escapeHtml(String(config.modelFamily || "gpt-5.4"))}</div>
    <div><strong>${escapeHtml(labels.meta.lastUsedModel)}:</strong> ${escapeHtml(formatModelInfo(modelInfo, labels))}</div>
  </div>
  <div class="stats">
    ${renderStat(labels.stats.mustHandle, state.overview.mustHandleToday)}
    ${renderStat(labels.stats.risk, state.overview.risks)}
    ${renderStat(labels.stats.waiting, state.overview.waitingForMe)}
    ${renderStat(labels.stats.notice, state.overview.notices)}
  </div>
  ${rows}
  <script>
    const vscode = acquireVsCodeApi();
    function post(type, extra) { vscode.postMessage(Object.assign({ type }, extra || {})); }
    function saveConfig() {
      post('saveConfig', {
        config: {
          rangeMode: document.getElementById('rangeMode').value,
          outputLanguage: document.getElementById('outputLanguage').value,
          recentHours: document.getElementById('recentHours').value,
          maxItems: document.getElementById('maxItems').value,
          folders: document.getElementById('folders').value,
          bodyExcerptChars: document.getElementById('bodyExcerptChars').value,
          modelFamily: document.getElementById('modelFamily').value
        }
      });
    }
  </script>
</body>
</html>`;
  }
}

class DashboardProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | null = null;

  public constructor(
    private readonly renderHtml: () => Promise<string>,
    private readonly onMessage: (message: unknown) => Promise<void>
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((message) => {
      void this.onMessage(message).catch((error: unknown) => {
        const messageText = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(messageText);
      });
    });
    return this.update();
  }

  public async update(): Promise<void> {
    if (!this.view) {
      return;
    }
    this.view.webview.html = await this.renderHtml();
  }
}

function renderStat(label: string, value: number | undefined): string {
  return `<div class="stat"><div>${escapeHtml(label)}</div><div class="value">${escapeHtml(String(value || 0))}</div></div>`;
}

function renderCategory(category: string, items: AnalysisResult["items"], labels: DashboardLabels): string {
  const cards = items.length ? items.map((item) => renderCard(item, labels)).join("") : `<div class="empty">${escapeHtml(labels.card.noItems)}</div>`;
  const open = category === "mustHandleToday" ? " open" : "";
  return `<details class="category"${open}><summary>${escapeHtml(labels.categories[category] || category)} (${items.length})</summary><div class="category-body">${cards}</div></details>`;
}

function renderCard(item: AnalysisResult["items"][number], labels: DashboardLabels): string {
  const draftReplyLiteral = toJsLiteral(item.draftReply || "");
  const mailIdLiteral = toJsLiteral(item.mailId);
  return `<article class="card">
    <div class="header">
      <div class="title">${escapeHtml(item.subject || item.mailId)}</div>
      <div class="badge">${escapeHtml(formatPriority(item.priority, labels))}</div>
    </div>
    <div><strong>${escapeHtml(labels.card.from)}:</strong> ${escapeHtml(item.sender || "-")}</div>
    <div><strong>${escapeHtml(labels.card.received)}:</strong> ${escapeHtml(item.receivedTime || "-")}</div>
    <div><strong>${escapeHtml(labels.card.summary)}:</strong> ${escapeHtml(item.summary || "-")}</div>
    <div><strong>${escapeHtml(labels.card.reason)}:</strong> ${escapeHtml(item.reason || "-")}</div>
    <div><strong>${escapeHtml(labels.card.suggestedAction)}:</strong> ${escapeHtml(item.suggestedAction || "-")}</div>
    <pre>${escapeHtml(item.draftReply || "")}</pre>
    <div class="actions">
      <button onclick="post('copyDraft', { draftReply: ${draftReplyLiteral} })">${escapeHtml(labels.card.copyDraft)}</button>
      <button class="secondary" onclick="post('ignore', { mailId: ${mailIdLiteral} })">${escapeHtml(labels.card.ignore)}</button>
    </div>
  </article>`;
}

async function openTextDocument(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc, { preview: false });
}

async function readResponseText(stream: AsyncIterable<unknown>): Promise<string> {
  let full = "";
  for await (const part of stream) {
    if (part && typeof part === "object" && "value" in (part as Record<string, unknown>) && typeof (part as Record<string, unknown>).value === "string") {
      full += String((part as Record<string, unknown>).value);
    } else {
      full += String(part);
    }
  }
  return full;
}

function runProcess(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(command, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `${command} exited with code ${String(code)}`));
      }
    });
  });
}

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function selected(current: unknown, expected: string): string {
  return String(current || "") === expected ? "selected" : "";
}

function getLocaleFromConfig(config: Record<string, unknown>): Locale {
  return config.outputLanguage === "en-US" ? "en-US" : "zh-CN";
}

function getLabels(locale: Locale): DashboardLabels {
  return LABELS[locale] || LABELS["zh-CN"];
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number(fallback);
}

function parseFolders(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  const parsed = String(value || "").split(";").map((item) => item.trim()).filter(Boolean);
  return parsed.length ? parsed : fallback;
}

function createAnalysisPrompt(template: string, digestText: string, outputLanguage: string): string {
  const languageInstruction = outputLanguage === "en-US"
    ? "Write summary, reason, and suggestedAction in English. Keep draftReply in English."
    : "Write summary, reason, and suggestedAction in Simplified Chinese. Keep original mail excerpts and draftReply in English.";
  return `${template}\n\nOutput language instruction:\n${languageInstruction}\n\n${digestText}`;
}

function formatModelInfo(modelInfo: Record<string, unknown>, labels: DashboardLabels): string {
  const actualFamily = String(modelInfo.actualFamily || "");
  const actualName = String(modelInfo.actualName || "");
  const actualVendor = String(modelInfo.actualVendor || "");
  const fallback = modelInfo.usedFallback === true ? labels.model.fallback : labels.model.preferred;
  if (!actualFamily && !actualName && !actualVendor) {
    return "-";
  }
  return [actualVendor, actualName || actualFamily, fallback].filter(Boolean).join(" / ");
}

function formatPriority(priority: string, labels: DashboardLabels): string {
  const normalized = String(priority || "").toLowerCase();
  if (labels === LABELS["zh-CN"]) {
    if (normalized === "high") {
      return "高";
    }
    if (normalized === "medium") {
      return "中";
    }
    if (normalized === "low") {
      return "低";
    }
  }
  return priority || "-";
}

function toJsLiteral(value: string): string {
  return JSON.stringify(String(value || ""))
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/'/g, "\\u0027");
}
