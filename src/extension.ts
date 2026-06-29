import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import * as cp from "node:child_process";
import { parseDigest, type DigestData } from "./lib/digest";
import { normalizeAnalysis, parseAnalysisJson, stripCodeFence, type AnalysisResult } from "./lib/analysis-schema";
import { buildQueueState, classificationFor, ensureClassifications, normalizeClassificationCache, type ClassificationCache, type MailClassification } from "./lib/classification";
import { buildSummaryMarkdown } from "./lib/summary";
import { buildDashboardState, CATEGORY_ORDER, type DashboardState } from "./lib/dashboard-state";
import { allowedCategoryIds, composeAnalysisPrompt, normalizePromptConfig, type PromptConfig } from "./lib/prompt-config";
import { buildBatchDigestMarkdown, emptyMailIndex, emptyMailStore, folderOldestReceivedTimes, mergeDigestIntoIndex, mergeDigestIntoStore, normalizeMailIndex, normalizeMailStore, pruneMailIndex, pruneMailStore, removeStoredMailByIds, type MailIndex, type MailStore, type StoredMail } from "./lib/mail-store";
import { buildThreadStore } from "./lib/thread-engine";
import { emptyThreadStore, mergeThreadStores, normalizeThreadStore, pruneThreadStore, type ThreadStore } from "./lib/thread-store";
import { redactText, type RedactionPolicy } from "./lib/redaction";
import { buildMailGateDecision, buildThreadGateDecision } from "./lib/security-gate";
import type { SecurityGateDecisionResult, SecurityGateSettings } from "./lib/security-types";
import { buildThreadAnalysisPrompt } from "./lib/thread-prompt-builder";
import { normalizeThreadAnalysis, parseThreadAnalysisJson, type ThreadAnalysisResult } from "./lib/thread-analysis-schema";
import { buildDailyBrief } from "./lib/report-daily";
import { buildSingleMailReport } from "./lib/report-single-mail";
import { buildThreadReport } from "./lib/report-thread";
import { CopilotProvider } from "./lib/copilot-provider";
import { formatModelLabel, isSelectedModel, modelKey, normalizeAvailableModel, selectConfiguredModel, type AvailableModel, type LlmProvider } from "./lib/llm-provider";
import { renderEasyMailGuideHtml } from "./lib/guide-webview";
import { applyReplyTemplateToAnalysis, LEGACY_REPLY_TEMPLATE_FILE_NAME, REPLY_TEMPLATE_FILE_NAME, validateReplyTemplate } from "./lib/reply-template";
import { applyAnalysisTranslation, buildAnalysisTranslationPrompt } from "./lib/analysis-translation";

type Locale = "zh-CN" | "en-US";

type BusyState = {
  label: string;
  detail: string;
  startedAt: string;
  kind: string;
};

type SecurityDecisionMap = Map<string, SecurityGateDecisionResult>;

type DashboardLabels = {
  toolbar: Record<"pullMail" | "loadMore" | "sample" | "analyze" | "analyzeSelected" | "analyzeAllAllowed" | "refresh" | "openDigest" | "openSummary" | "generateReports" | "openDailyBrief" | "openThreadReport" | "openSingleMailReport" | "settingsFile" | "promptConfig" | "clearStore" | "loadModels", string>;
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
    noModel: string;
    modelsNotLoaded: string;
    batchSize: string;
    autoAnalyze: string;
    maxClassification: string;
    classificationPublic: string;
    classificationInternal: string;
    classificationRegistered: string;
    classificationHighRegistered: string;
    storeRetentionDays: string;
    indexRetentionDays: string;
    analysisRetentionDays: string;
    importantSenders: string;
    save: string;
    autoSaveNote: string;
    recentHoursOption: string;
    maxItemsOption: string;
    zhOption: string;
    enOption: string;
  };
  meta: Record<"range" | "folders" | "generated" | "requestedModel" | "lastUsedModel" | "lastPull" | "lastImport", string>;
  stats: Record<"pulled" | "pending" | "analysed" | "blocked" | "mustHandle" | "risk" | "waiting" | "notice" | "threads", string>;
  categories: Record<string, string>;
  card: Record<"from" | "received" | "summary" | "reason" | "suggestedAction" | "copyDraft" | "ignore" | "openInOutlook" | "noItems" | "thread", string>;
  pending: Record<"title" | "blockedTitle" | "classification" | "autoAllowed" | "manualRequired" | "gateBlocked" | "securityReason" | "select", string>;
  threads: Record<"title" | "participants" | "messages" | "lastTime" | "folders" | "contentStatus" | "security" | "analysis" | "analyzeThread" | "currentStatus" | "actionItems" | "risks" | "draftReply" | "timeline" | "attachments" | "mailIds", string>;
  progress: Record<"pullMail" | "loadMore" | "sampleDigest" | "analyze" | "reports" | "loadModels" | "translate", string> & { detail: string };
  model: Record<"fallback" | "preferred", string>;
};

const LABELS: Record<Locale, DashboardLabels> = {
  "zh-CN": {
    toolbar: {
      pullMail: "获取新邮件",
      loadMore: "更多历史",
      sample: "示例数据",
      analyze: "分析下一批",
      analyzeSelected: "分析选中",
      analyzeAllAllowed: "分析全部允许项",
      refresh: "刷新",
      openDigest: "打开邮件摘要",
      openSummary: "打开分析总结",
      generateReports: "生成报告",
      openDailyBrief: "打开日报",
      openThreadReport: "打开线程报告",
      openSingleMailReport: "打开单封报告",
      settingsFile: "配置文件",
      promptConfig: "Prompt 分类配置",
      clearStore: "清理本地缓存",
      loadModels: "加载模型"
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
      modelFamily: "分析模型",
      noModel: "没有可用模型",
      modelsNotLoaded: "请先加载模型",
      batchSize: "每批分析数量",
      autoAnalyze: "允许自动分析",
      maxClassification: "自动分析最高密级",
      classificationPublic: "PUBLIC",
      classificationInternal: "INTERNAL",
      classificationRegistered: "REGISTERED",
      classificationHighRegistered: "HIGH REGISTERED",
      storeRetentionDays: "原文缓存保留天数",
      indexRetentionDays: "去重索引保留天数",
      analysisRetentionDays: "分析摘要保留天数",
      importantSenders: "重点发件人/邮件组（用 ; 分隔）",
      save: "保存设置",
      autoSaveNote: "修改后会自动保存到 VS Code Settings",
      recentHoursOption: "最近小时数",
      maxItemsOption: "最多邮件数",
      zhOption: "简体中文",
      enOption: "English"
    },
    meta: {
      range: "范围",
      folders: "文件夹",
      generated: "生成时间",
      requestedModel: "请求模型",
      lastUsedModel: "上次使用模型",
      lastPull: "上次拉取",
      lastImport: "上次导入"
    },
    stats: {
      pulled: "已拉取",
      pending: "未分析",
      analysed: "已分析",
      blocked: "需确认",
      mustHandle: "必须处理",
      risk: "风险",
      waiting: "等待回复",
      notice: "通知",
      threads: "邮件线程"
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
      openInOutlook: "在 Outlook 打开",
      noItems: "暂无邮件",
      thread: "线程"
    },
    pending: {
      title: "未分析邮件",
      blockedTitle: "需手动确认",
      classification: "密级",
      autoAllowed: "允许自动分析",
      manualRequired: "需要手动确认",
      gateBlocked: "安全阻断",
      securityReason: "安全原因",
      select: "选择"
    },
    threads: {
      title: "邮件线程",
      participants: "参与人",
      messages: "消息数",
      lastTime: "最后时间",
      folders: "文件夹",
      contentStatus: "内容状态",
      security: "安全状态",
      analysis: "线程分析",
      analyzeThread: "分析整个线程",
      currentStatus: "当前状态",
      actionItems: "待办",
      risks: "风险",
      draftReply: "回复草稿",
      timeline: "时间线",
      attachments: "附件",
      mailIds: "邮件 ID"
    },
    progress: {
      pullMail: "正在获取新邮件",
      loadMore: "正在加载历史邮件",
      sampleDigest: "正在生成示例数据",
      analyze: "正在调用 Copilot 分析",
      reports: "正在生成报告",
      loadModels: "正在加载 Copilot 模型",
      translate: "正在翻译已有分析",
      detail: "任务进行中，请稍候..."
    },
    model: {
      fallback: "回退模型",
      preferred: "首选模型"
    }
  },
  "en-US": {
    toolbar: {
      pullMail: "Fetch New",
      loadMore: "More History",
      sample: "Sample",
      analyze: "Analyze Next Batch",
      analyzeSelected: "Analyze Selected",
      analyzeAllAllowed: "Analyze All Allowed",
      refresh: "Refresh",
      openDigest: "Open Digest",
      openSummary: "Open Summary",
      generateReports: "Generate Reports",
      openDailyBrief: "Open Daily Brief",
      openThreadReport: "Open Thread Report",
      openSingleMailReport: "Open Mail Report",
      settingsFile: "Settings File",
      promptConfig: "Prompt Config",
      clearStore: "Clear Local Cache",
      loadModels: "Load Models"
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
      modelFamily: "Analysis Model",
      noModel: "No available model",
      modelsNotLoaded: "Load models first",
      batchSize: "Batch Size",
      autoAnalyze: "Allow Auto Analysis",
      maxClassification: "Max Auto Classification",
      classificationPublic: "PUBLIC",
      classificationInternal: "INTERNAL",
      classificationRegistered: "REGISTERED",
      classificationHighRegistered: "HIGH REGISTERED",
      storeRetentionDays: "Raw Cache Retention Days",
      indexRetentionDays: "Index Retention Days",
      analysisRetentionDays: "Summary Retention Days",
      importantSenders: "Important senders/groups (; separated)",
      save: "Save Settings",
      autoSaveNote: "Changes are saved automatically to VS Code Settings",
      recentHoursOption: "Recent Hours",
      maxItemsOption: "Max Items",
      zhOption: "简体中文",
      enOption: "English"
    },
    meta: {
      range: "Range",
      folders: "Folders",
      generated: "Generated",
      requestedModel: "Requested model",
      lastUsedModel: "Last used model",
      lastPull: "Last pull",
      lastImport: "Last import"
    },
    stats: {
      pulled: "Pulled",
      pending: "Pending",
      analysed: "Analysed",
      blocked: "Needs Confirm",
      mustHandle: "Must Handle",
      risk: "Risk",
      waiting: "Waiting",
      notice: "Notice",
      threads: "Threads"
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
      openInOutlook: "Open in Outlook",
      noItems: "No items",
      thread: "Thread"
    },
    pending: {
      title: "Pending Mail",
      blockedTitle: "Manual Confirmation Required",
      classification: "Classification",
      autoAllowed: "Auto allowed",
      manualRequired: "Manual confirmation required",
      gateBlocked: "Blocked by security gate",
      securityReason: "Security reason",
      select: "Select"
    },
    threads: {
      title: "Threads",
      participants: "Participants",
      messages: "Messages",
      lastTime: "Last Time",
      folders: "Folders",
      contentStatus: "Content Status",
      security: "Security",
      analysis: "Thread Analysis",
      analyzeThread: "Analyze Full Thread",
      currentStatus: "Current Status",
      actionItems: "Action Items",
      risks: "Risks",
      draftReply: "Draft Reply",
      timeline: "Timeline",
      attachments: "Attachments",
      mailIds: "Mail IDs"
    },
    progress: {
      pullMail: "Fetching new mail",
      loadMore: "Loading mail history",
      sampleDigest: "Generating sample digest",
      analyze: "Analyzing with Copilot",
      reports: "Generating reports",
      loadModels: "Loading Copilot models",
      translate: "Translating existing analysis",
      detail: "Task is running. Please wait..."
    },
    model: {
      fallback: "fallback",
      preferred: "preferred"
    }
  }
};

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const app = new EasyMailApp(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("easyMail.dashboard", app.dashboardProvider),
    vscode.commands.registerCommand("easyMail.pullMail", () => app.pullMail(false)),
    vscode.commands.registerCommand("easyMail.loadMore", () => app.loadMore()),
    vscode.commands.registerCommand("easyMail.generateSampleDigest", () => app.pullMail(true)),
    vscode.commands.registerCommand("easyMail.analyze", () => app.analyze()),
    vscode.commands.registerCommand("easyMail.analyzeThread", async () => {
      const threadId = await vscode.window.showInputBox({ prompt: "Thread ID to analyze" });
      if (threadId) {
        await app.analyzeThread(threadId);
      }
    }),
    vscode.commands.registerCommand("easyMail.analyzeAllAllowed", () => app.analyzeAllAllowed()),
    vscode.commands.registerCommand("easyMail.refreshDashboard", () => app.refresh()),
    vscode.commands.registerCommand("easyMail.openDigest", () => app.openDigest()),
    vscode.commands.registerCommand("easyMail.openSummary", () => app.openSummary()),
    vscode.commands.registerCommand("easyMail.generateReports", () => app.generateReports()),
    vscode.commands.registerCommand("easyMail.loadModels", () => app.loadModels()),
    vscode.commands.registerCommand("easyMail.openDailyBrief", () => app.openDailyBrief()),
    vscode.commands.registerCommand("easyMail.openThreadReport", () => app.openThreadReport()),
    vscode.commands.registerCommand("easyMail.openSingleMailReport", () => app.openSingleMailReport()),
    vscode.commands.registerCommand("easyMail.openSettings", () => app.openSettings()),
    vscode.commands.registerCommand("easyMail.openPromptConfig", () => app.openPromptConfig()),
    vscode.commands.registerCommand("easyMail.openReplyTemplate", () => app.openReplyTemplate()),
    vscode.commands.registerCommand("easyMail.openGuide", () => app.openGuide()),
    vscode.commands.registerCommand("easyMail.clearLocalCache", () => app.clearLocalCache())
  );

  await app.initialize();
}

export function deactivate(): void {}

class EasyMailApp {
  public readonly dashboardProvider: DashboardProvider;
  private readonly llmProvider: LlmProvider;
  private busy: BusyState | null = null;
  private logFilePath = "";
  private availableModelsCache: AvailableModel[] | null = null;
  private availableModelsPending: Promise<AvailableModel[]> | null = null;
  private guidePanel: vscode.WebviewPanel | null = null;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.llmProvider = new CopilotProvider();
    this.dashboardProvider = new DashboardProvider(() => this.getDashboardHtml(), (message) => this.handleMessage(message));
  }

  public async initialize(): Promise<void> {
    await fs.promises.mkdir(this.getDataDir(), { recursive: true });
    await this.initializeLogger();
    await this.ensureConfig();
    await this.log("initialize", { extensionPath: this.context.extensionPath, dataDir: this.getDataDir() });
    this.context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("easyMail")) {
        void this.log("settings:changed", {});
        void this.refresh();
      }
    }));
    await this.refresh();
    await this.maybeOpenGuide();
  }

  private async maybeOpenGuide(): Promise<void> {
    const key = "easyMail.guideShown.0.1.0";
    if (this.context.globalState.get<boolean>(key)) {
      return;
    }
    await this.context.globalState.update(key, true);
    await this.openGuide();
  }

  public async openWalkthrough(): Promise<void> {
    const walkthroughId = `${this.context.extension.id}#easyMail.gettingStarted`;
    await vscode.commands.executeCommand("workbench.action.openWalkthrough", walkthroughId, false)
      .then(
        () => this.log("walkthrough:opened", { walkthroughId }),
        (error: unknown) => this.log("walkthrough:error", { walkthroughId, error: formatError(error) })
      );
    await this.openGuide();
  }

  public async openGuide(): Promise<void> {
    if (this.guidePanel) {
      this.guidePanel.reveal(vscode.ViewColumn.One);
      this.guidePanel.webview.html = await this.getGuideHtml();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "easyMail.guide",
      "Easy Mail - User Guide",
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    this.guidePanel = panel;
    panel.iconPath = vscode.Uri.file(path.join(this.context.extensionPath, "media", "icon.png"));
    panel.webview.onDidReceiveMessage((message) => {
      void this.handleGuideMessage(message);
    });
    panel.onDidDispose(() => {
      this.guidePanel = null;
    });
    panel.webview.html = await this.getGuideHtml();
    await this.log("guide:opened", {});
  }

  private async getGuideHtml(): Promise<string> {
    const state = await this.loadState();
    const locale = getLocaleFromConfig(state.config as Record<string, unknown>);
    const store = (state as DashboardState & { store?: MailStore }).store || emptyMailStore();
    const queue = (state as DashboardState & { queue?: ReturnType<typeof buildQueueState> }).queue || { pending: [], blocked: [], analysed: [], allowed: [] };
    const threadStore = (state as DashboardState & { threadStore?: ThreadStore }).threadStore || emptyThreadStore();
    const visibleThreadStore = filterVisibleThreadsForDashboard(threadStore);
    return renderEasyMailGuideHtml({
      locale,
      version: String(this.context.extension.packageJSON?.version || "0.1.0"),
      stats: {
        pulled: store.items.length,
        pending: queue.pending.length,
        analysed: state.overview.totalMails,
        threads: visibleThreadStore.items.length
      }
    });
  }

  private async handleGuideMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== "object") {
      return;
    }
    const typed = message as { type?: string; action?: string };
    if (typed.type !== "guideAction") {
      return;
    }
    await this.log("guide:action", { action: typed.action || "" });
    if (typed.action === "openDashboard") {
      await vscode.commands.executeCommand("workbench.view.extension.easyMail");
      await vscode.commands.executeCommand("easyMail.dashboard.focus");
      return;
    }
    if (typed.action === "pullMail") {
      await this.pullMail(false);
      return;
    }
    if (typed.action === "sampleDigest") {
      await this.pullMail(true);
      return;
    }
    if (typed.action === "loadModels") {
      await this.loadModels();
      if (this.guidePanel) {
        this.guidePanel.webview.html = await this.getGuideHtml();
      }
      return;
    }
    if (typed.action === "openSettings") {
      await this.openSettings();
      return;
    }
    if (typed.action === "openPromptConfig") {
      await this.openPromptConfig();
      return;
    }
    if (typed.action === "openReplyTemplate") {
      await this.openReplyTemplate();
    }
  }

  public async pullMail(forceSample: boolean): Promise<void> {
    const locale = await this.readLocale();
    const labels = getLabels(locale);
    await this.runWithBusy(
      forceSample ? labels.progress.sampleDigest : labels.progress.pullMail,
      labels.progress.detail,
      forceSample ? "sample" : "pullMail",
      async () => await this.pullMailCore(forceSample),
      (result) => `Email digest generated. Added ${result.added}, skipped ${result.skipped}.`
    );
  }

  public async loadMore(): Promise<void> {
    const locale = await this.readLocale();
    const labels = getLabels(locale);
    await this.runWithBusy(
      labels.progress.loadMore,
      labels.progress.detail,
      "loadMore",
      async () => await this.pullMailCore(false, true),
      (result) => `Email digest generated. Added ${result.added}, skipped ${result.skipped}.`
    );
  }

  private async pullMailCore(forceSample: boolean, loadMore = false): Promise<{ added: number; skipped: number }> {
    const config = await this.readConfig();
    await fs.promises.mkdir(this.getDataDir(), { recursive: true });
    if (forceSample) {
      await this.resetSampleState();
    }
    const scriptPath = await this.findCollectorScript();
    const args = ["//nologo", scriptPath];
    const maxItems = Number(config.maxItems || 50);
    const recentHours = Number(config.recentHours || 24);
    const rangeMode = String(config.rangeMode || "recentHours");
    const folders = Array.isArray(config.folders) ? config.folders.map(String) : ["Inbox"];
    const currentIndex = pruneMailIndex(await this.readMailIndex(), Number(config.mailIndexRetentionDays || 7));
    args.push("--max-items", String(maxItems));
    args.push("--recent-hours", String(loadMore || rangeMode === "maxItems" ? 0 : recentHours));
    args.push("--folders", folders.join(";"));
    args.push("--body-chars", String(config.bodyExcerptChars || 1500));
    args.push("--output", this.getDigestPath());
    if (loadMore) {
      const anchors = folderOldestReceivedTimes(currentIndex, folders);
      const olderThanMap = serializeFolderDateMap(anchors);
      if (!olderThanMap) {
        throw new Error("No folder anchors exist yet. Run Pull Mail before Load More.");
      }
      args.push("--older-than-map", olderThanMap);
    }
    if (forceSample || config.sampleMode) {
      args.push("--sample");
    }

    await this.log("pullMail:start", { forceSample, loadMore, maxItems, recentHours, rangeMode, folders });
    await runProcess("cscript.exe", args, 30000, (event, data) => void this.log(`process:${event}`, data));
    const digest = parseDigest(await fs.promises.readFile(this.getDigestPath(), "utf8"));
    const merge = mergeDigestIntoStore(await this.readMailStore(), digest, currentIndex.items.map((item) => item.mailId));
    const nextIndex = pruneMailIndex(mergeDigestIntoIndex(currentIndex, digest), Number(config.mailIndexRetentionDays || 7));
    const prunedStore = pruneMailStore(merge.store, Number(config.mailStoreRetentionDays || 1));
    await this.writeMailStore(prunedStore);
    await this.writeMailIndex(nextIndex);
    const builtThreadStore = buildThreadStore(prunedStore.items);
    const nextThreadStore = pruneThreadStore(
      mergeThreadStores(await this.readThreadStore(), builtThreadStore),
      Number(config.mailStoreRetentionDays || 1)
    );
    await this.writeThreadStore(nextThreadStore);
    const classificationCache = ensureClassifications(prunedStore.items, await this.readClassificationCache());
    await this.writeClassificationCache(classificationCache);
    await this.log("pullMail:done", {
      digestItems: digest.items.length,
      added: merge.added,
      skipped: merge.skipped,
      storeItems: prunedStore.items.length,
      indexItems: nextIndex.items.length,
      threads: nextThreadStore.items.length
    });
    return { added: merge.added, skipped: merge.skipped };
  }

  public async analyze(): Promise<void> {
    const locale = await this.readLocale();
    const labels = getLabels(locale);
    await this.runWithBusy(
      labels.progress.analyze,
      labels.progress.detail,
      "analyzeNext",
      async () => await this.analyzeBatchCore(),
      (result) => `Easy Mail analysis completed for ${result.batchSize} mail(s).`
    );
  }

  public async analyzeAllAllowed(): Promise<void> {
    const locale = await this.readLocale();
    const labels = getLabels(locale);
    await this.runWithBusy(
      labels.progress.analyze,
      labels.progress.detail,
      "analyzeAll",
      async () => await this.analyzeBatchCore("allAllowed"),
      (result) => `Easy Mail analysis completed for ${result.batchSize} mail(s).`
    );
  }

  private async analyzeSelected(mailIds: string[]): Promise<void> {
    const locale = await this.readLocale();
    const labels = getLabels(locale);
    await this.runWithBusy(
      labels.progress.analyze,
      labels.progress.detail,
      "analyzeSelected",
      async () => await this.analyzeBatchCore(mailIds),
      (result) => `Easy Mail analysis completed for ${result.batchSize} mail(s).`
    );
  }

  private async analyzeBatchCore(selection?: "allAllowed" | string[]): Promise<{ batchSize: number }> {
    const config = await this.readConfig();
    await this.importDigestIfStoreMissing();
    const store = await this.readMailStore();
    const index = pruneMailIndex(await this.readMailIndex(), Number(config.mailIndexRetentionDays || 7));
    await this.writeMailIndex(index);
    if (!store.items.length) {
      await this.log("analyze:noStoreItems", { indexItems: index.items.length });
      throw new Error("No pulled mail exists. Run Pull Mail first.");
    }
    const classificationCache = ensureClassifications(store.items, await this.readClassificationCache());
    await this.writeClassificationCache(classificationCache);
    const currentAnalysis = await this.readAnalysisResult();
    const ignoredIds = await this.readIgnoredIds();
    const securitySettings = buildSecuritySettings(config);
    const securityDecisions = buildMailSecurityDecisionMap(store.items, classificationCache, securitySettings);
    const queue = buildQueueState(
      store.items,
      currentAnalysis,
      ignoredIds,
      classificationCache,
      config.autoAnalyzeEnabled !== false,
      Number(config.autoAnalyzeMaxClassificationLevel || 2)
    );
    const batchSize = Number(config.analysisBatchSize || 5);
    const requestedBatch = Array.isArray(selection)
      ? store.items.filter((item) => selection.includes(item.mailId) && !ignoredIds.includes(item.mailId))
      : selection === "allAllowed"
        ? queue.allowed
        : queue.allowed.slice(0, batchSize);
    const batch = requestedBatch.filter((item) => canAnalyzeMail(item, securityDecisions, Array.isArray(selection)));
    if (!batch.length) {
      await this.log("analyze:noBatch", {
        pending: queue.pending.length,
        allowed: queue.allowed.length,
        blocked: queue.blocked.length,
        requested: requestedBatch.length,
        securityBlocked: requestedBatch.filter((item) => securityDecisions.get(item.mailId)?.decision === "block").length
      });
      throw new Error("No mail is available for analysis. Check pending mail or security gates.");
    }

    const promptConfig = await this.readPromptConfig();
    promptConfig.importantSenders = mergeStringLists(promptConfig.importantSenders, parseFolders(config.importantSenders, []));
    const redacted = redactStoredMails(batch, buildDefaultRedactionPolicy());
    const digestText = buildBatchDigestMarkdown(redacted.items);
    const basePrompt = await fs.promises.readFile(path.join(this.context.extensionPath, "prompts", "base-system.md"), "utf8");
    const outputSchemaPrompt = await fs.promises.readFile(path.join(this.context.extensionPath, "prompts", "output-schema.md"), "utf8");
    const replyDraftPrompt = await fs.promises.readFile(path.join(this.context.extensionPath, "prompts", "reply-draft-prompt.md"), "utf8");
    const replyTemplate = await this.readReplyTemplate();
    const configuredModel = typeof config.modelFamily === "string" ? config.modelFamily.trim() : "gpt-5.4";
    await this.log("analyze:start", {
      selection: Array.isArray(selection) ? "selected" : selection || "nextBatch",
      requestedBatchSize: requestedBatch.length,
      batchSize: batch.length,
      redactionReplacements: redacted.totalReplacements,
      configuredModel
    });
    const prompt = composeAnalysisPrompt({
      basePrompt,
      outputSchemaPrompt,
      replyDraftPrompt,
      replyTemplate,
      digestText,
      outputLanguage: String(config.outputLanguage || "en-US"),
      promptConfig
    });
    const { raw } = await this.sendPrompt(prompt, configuredModel, "analyze");
    await this.log("analyze:response", { rawLength: raw.length });
    const analysis = parseAnalysisJson(raw, allowedCategoryIds(promptConfig));

    const normalized = applyReplyTemplateToAnalysis(
      normalizeAnalysis(analysis, allowedCategoryIds(promptConfig)),
      replyTemplate
    );
    normalized.language = getLocaleFromConfig(config);
    const merged = pruneAnalysisResult(
      mergeAnalysisResults(currentAnalysis, normalized, allowedCategoryIds(promptConfig)),
      Number(config.analysisRetentionDays || 7),
      allowedCategoryIds(promptConfig)
    );
    const summaryLabels = buildCategoryLabels(getLabels(getLocaleFromConfig(config)), promptConfig, getLocaleFromConfig(config));
    await fs.promises.writeFile(this.getAnalysisPath(), `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    await fs.promises.writeFile(this.getSummaryPath(), buildSummaryMarkdown(merged, summaryLabels), "utf8");
    await this.writeMailStore(removeStoredMailByIds(await this.readMailStore(), batch.map((item) => item.mailId)));
    await this.log("analyze:done", { batchSize: batch.length, mergedItems: merged.items.length });
    return { batchSize: batch.length };
  }

  public async analyzeThread(threadId: string): Promise<void> {
    const locale = await this.readLocale();
    const labels = getLabels(locale);
    await this.runWithBusy(
      labels.progress.analyze,
      labels.progress.detail,
      "analyzeThread",
      async () => await this.analyzeThreadCore(threadId),
      (result) => `Thread analysis completed for ${result.subject}.`
    );
  }

  private async analyzeThreadCore(threadId: string): Promise<{ subject: string }> {
    const config = await this.readConfig();
    const threadStore = await this.readThreadStore();
    const thread = threadStore.items.find((item) => item.threadId === threadId);
    if (!thread) {
      throw new Error("Thread not found. Refresh or pull mail first.");
    }
    if ((thread.security?.blockedMessages || 0) > 0) {
      await this.log("threadAnalyze:block", { threadId, reasons: thread.security?.reasons || [] });
      throw new Error("Thread has blocked messages and cannot be analyzed.");
    }
    const gate = buildThreadGateDecision(thread, ensureClassifications(await this.readMailStore().then((store) => store.items), await this.readClassificationCache()).items, buildSecuritySettings(config));
    if (gate.decision === "block") {
      await this.log("threadAnalyze:block", { threadId, reasons: gate.reasons });
      throw new Error("Thread is blocked by the security gate.");
    }

    const redactedThread = redactThreadForPrompt(thread, buildDefaultRedactionPolicy());
    const basePrompt = await fs.promises.readFile(path.join(this.context.extensionPath, "prompts", "thread-base-system.md"), "utf8");
    const analysisPrompt = await fs.promises.readFile(path.join(this.context.extensionPath, "prompts", "thread-analysis-prompt.md"), "utf8");
    const outputSchemaPrompt = await fs.promises.readFile(path.join(this.context.extensionPath, "prompts", "thread-output-schema.md"), "utf8");
    const prompt = buildThreadAnalysisPrompt({
      basePrompt,
      analysisPrompt,
      outputSchemaPrompt,
      outputLanguage: String(config.outputLanguage || "en-US"),
      thread: redactedThread
    });
    const configuredModel = typeof config.modelFamily === "string" ? config.modelFamily.trim() : "gpt-5.4";
    await this.log("threadAnalyze:start", { threadId, configuredModel, partialContext: gate.partialContext });
    const { raw } = await this.sendPrompt(prompt, configuredModel, "threadAnalyze");
    const parsed = parseThreadAnalysisJson(raw, allowedCategoryIds(await this.readPromptConfig()));
    parsed.language = getLocaleFromConfig(config);
    const current = await this.readThreadAnalysisResult();
    const merged = mergeThreadAnalysisResults(current, parsed, allowedCategoryIds(await this.readPromptConfig()));
    await this.writeThreadAnalysisResult(merged);
    await this.log("threadAnalyze:done", { threadId, mergedItems: merged.items.length });
    return { subject: thread.subject || thread.threadId };
  }

  private async sendPrompt(prompt: string, configuredModel: string, eventPrefix: string): Promise<{ raw: string }> {
    const models = await this.readCachedAvailableModels();
    const selectedModel = selectConfiguredModel(models, configuredModel);
    await this.log(`${eventPrefix}:models`, {
      availableCount: models.length,
      selected: selectedModel ? { id: selectedModel.id, family: selectedModel.family, name: selectedModel.name, vendor: selectedModel.vendor } : null
    });
    if (!selectedModel) {
      throw new Error("Load GitHub Copilot models first, then select a model before analyzing.");
    }
    const response = await this.llmProvider.sendPrompt(prompt, { modelFamily: configuredModel });

    await this.writeModelInfo({
      requestedFamily: configuredModel || "auto",
      usedFallback: response.usedFallback,
      actualFamily: response.model.family,
      actualId: response.model.id,
      actualName: response.model.name,
      actualVendor: response.model.vendor,
      analyzedAt: new Date().toISOString()
    });

    return {
      raw: response.rawText
    };
  }

  private async runWithBusy<T>(
    label: string,
    detail: string,
    kind: string,
    task: () => Promise<T>,
    completionMessage?: (result: T) => string
  ): Promise<T> {
    if (this.busy) {
      throw new Error(`Another Easy Mail task is already running: ${this.busy.label}`);
    }
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    await this.log("busy:start", { label });
    this.busy = { label, detail, startedAt, kind };
    await this.refresh();
    try {
      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: label, cancellable: false },
        async (progress) => {
          progress.report({ message: detail });
          return await task();
        }
      );
      const elapsedMs = Date.now() - startedAtMs;
      if (completionMessage) {
        void vscode.window.showInformationMessage(`${completionMessage(result)} Time: ${formatElapsedSeconds(elapsedMs)}.`);
      }
      await this.log("busy:success", { label, elapsedMs });
      return result;
    } catch (error) {
      await this.log("busy:error", { label, error: formatError(error) });
      throw error;
    } finally {
      this.busy = null;
      await this.refresh();
      await this.log("busy:end", { label, elapsedMs: Date.now() - startedAtMs });
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

  public async generateReports(): Promise<void> {
    const locale = await this.readLocale();
    const labels = getLabels(locale);
    await this.runWithBusy(
      labels.progress.reports,
      labels.progress.detail,
      "reports",
      async () => await this.generateReportsCore(),
      () => "Easy Mail reports generated."
    );
  }

  public async loadModels(): Promise<void> {
    const locale = await this.readLocale();
    const labels = getLabels(locale);
    await this.runWithBusy(
      labels.progress.loadModels,
      labels.progress.detail,
      "loadModels",
      async () => await this.loadAvailableModels(),
      () => "Easy Mail Copilot models loaded."
    );
  }

  public async changeOutputLanguage(nextLocale: Locale): Promise<void> {
    const config = await this.readConfig();
    const currentLocale = getLocaleFromConfig(config);
    if (nextLocale === currentLocale) {
      await this.refresh();
      return;
    }

    const mail = await this.readAnalysisResult();
    const threads = await this.readThreadAnalysisResult();
    const mailLanguage = mail.language || currentLocale;
    const threadLanguage = threads.language || currentLocale;
    const needsTranslation = (mail.items.length > 0 && mailLanguage !== nextLocale)
      || (threads.items.length > 0 && threadLanguage !== nextLocale);

    if (!needsTranslation) {
      await this.updateSettings({ ...config, outputLanguage: nextLocale });
      await this.refresh();
      return;
    }

    const labels = getLabels(currentLocale);
    const translateLabel = currentLocale === "zh-CN" ? "翻译已有分析" : "Translate existing analysis";
    const switchOnlyLabel = currentLocale === "zh-CN" ? "只切换界面" : "Switch UI only";
    const message = currentLocale === "zh-CN"
      ? "已有分析结果的语言和目标语言不同。翻译只会处理摘要、原因、建议动作、线程状态等展示字段，不会重新分类，也不会翻译回复草稿。"
      : "Existing analysis results use a different language. Translation only updates display fields such as summaries, reasons, suggested actions, and thread status. It does not reclassify mails or translate draft replies.";
    const choice = await vscode.window.showWarningMessage(message, { modal: true }, translateLabel, switchOnlyLabel);
    if (!choice) {
      await this.refresh();
      return;
    }

    await this.updateSettings({ ...config, outputLanguage: nextLocale });
    if (choice === translateLabel) {
      await this.runWithBusy(
        labels.progress.translate,
        labels.progress.detail,
        "translate",
        async () => await this.translateExistingAnalysis(nextLocale),
        (result) => `Easy Mail translated ${result.mailItems} mail analysis item(s) and ${result.threadItems} thread analysis item(s).`
      );
    } else {
      await this.refresh();
    }
  }

  public async openDailyBrief(): Promise<void> {
    await this.ensureReportsExist();
    await openTextDocument(this.getDailyBriefPath());
  }

  public async openThreadReport(): Promise<void> {
    await this.ensureReportsExist();
    await openTextDocument(this.getThreadReportPath());
  }

  public async openSingleMailReport(): Promise<void> {
    await this.ensureReportsExist();
    await openTextDocument(this.getSingleMailReportPath());
  }

  public async openSettings(): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:Wsr-7.easy-mail");
  }

  public async openPromptConfig(): Promise<void> {
    await openTextDocument(this.getPromptConfigPath());
  }

  public async openReplyTemplate(): Promise<void> {
    await this.ensureConfig();
    await openTextDocument(this.getReplyTemplatePath());
  }

  public async openMailInOutlook(mailId: string): Promise<void> {
    const target = await this.findOutlookOpenTarget(mailId);
    if (!target?.entryId) {
      await vscode.window.showWarningMessage("Easy Mail cannot open this mail in Outlook because its EntryID is no longer available in the local index.");
      return;
    }

    const scriptPath = await this.findScript("open-outlook-mail.vbs");
    const args = ["//nologo", scriptPath, "--entry-id", target.entryId];
    if (target.storeId) {
      args.push("--store-id", target.storeId);
    }
    await runProcess("cscript.exe", args, 30000, (event, data) => {
      void this.log(`openOutlook:${event}`, data);
    });
    void vscode.window.showInformationMessage("Opened mail in Outlook.");
  }

  public async clearLocalCache(): Promise<void> {
    await this.writeMailStore(emptyMailStore());
    await this.writeMailIndex(emptyMailIndex());
    await this.writeThreadStore(emptyThreadStore());
    await this.writeClassificationCache(normalizeClassificationCache({}));
    await fs.promises.writeFile(this.getAnalysisPath(), `${JSON.stringify({ generatedAt: "", overview: { totalMails: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 }, items: [] }, null, 2)}\n`, "utf8");
    await this.writeThreadAnalysisResult({ generatedAt: "", overview: { totalThreads: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 }, items: [] });
    await deleteFileIfExists(this.getDailyBriefPath());
    await deleteFileIfExists(this.getThreadReportPath());
    await deleteFileIfExists(this.getSingleMailReportPath());
    await this.refresh();
    await vscode.window.showInformationMessage("Local email cache cleared.");
  }

  private async resetSampleState(): Promise<void> {
    await this.writeMailStore(emptyMailStore());
    await this.writeMailIndex(emptyMailIndex());
    await this.writeThreadStore(emptyThreadStore());
    await this.writeClassificationCache(normalizeClassificationCache({}));
    await this.writeIgnoredIds([]);
    await fs.promises.writeFile(this.getAnalysisPath(), `${JSON.stringify({ generatedAt: "", overview: { totalMails: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 }, items: [] }, null, 2)}\n`, "utf8");
    await this.writeThreadAnalysisResult({ generatedAt: "", overview: { totalThreads: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 }, items: [] });
    await this.log("sample:reset", {});
  }

  private async generateReportsCore(): Promise<void> {
    await fs.promises.mkdir(this.getDataDir(), { recursive: true });
    const mailResult = await this.readAnalysisResult();
    const threadResult = await this.readThreadAnalysisResult();
    const dateLabel = new Date().toISOString().slice(0, 10);
    await fs.promises.writeFile(this.getDailyBriefPath(), buildDailyBrief(mailResult, threadResult, dateLabel), "utf8");
    await fs.promises.writeFile(this.getThreadReportPath(), buildThreadReport(threadResult), "utf8");
    await fs.promises.writeFile(this.getSingleMailReportPath(), buildSingleMailReport(mailResult), "utf8");
    await this.log("reports:generated", {
      mailItems: mailResult.items.length,
      threadItems: threadResult.items.length
    });
  }

  private async translateExistingAnalysis(targetLocale: Locale): Promise<{ mailItems: number; threadItems: number }> {
    const config = await this.readConfig();
    const promptConfig = await this.readPromptConfig();
    const mail = await this.readAnalysisResult();
    const threads = await this.readThreadAnalysisResult();
    if (!mail.items.length && !threads.items.length) {
      return { mailItems: 0, threadItems: 0 };
    }

    const configuredModel = typeof config.modelFamily === "string" ? config.modelFamily.trim() : "gpt-5.4";
    const prompt = buildAnalysisTranslationPrompt({ mail, threads, targetLanguage: targetLocale });
    const { raw } = await this.sendPrompt(prompt, configuredModel, "translate");
    const translated = applyAnalysisTranslation({
      mail,
      threads,
      translated: JSON.parse(stripCodeFence(raw.trim())),
      targetLanguage: targetLocale
    });
    const mailResult = normalizeAnalysis(translated.mail, allowedCategoryIds(promptConfig));
    const threadResult = normalizeThreadAnalysis(translated.threads, allowedCategoryIds(promptConfig));
    const summaryLabels = buildCategoryLabels(getLabels(targetLocale), promptConfig, targetLocale);
    await fs.promises.writeFile(this.getAnalysisPath(), `${JSON.stringify(mailResult, null, 2)}\n`, "utf8");
    await fs.promises.writeFile(this.getSummaryPath(), buildSummaryMarkdown(mailResult, summaryLabels), "utf8");
    await this.writeThreadAnalysisResult(threadResult);
    await this.log("translate:done", {
      targetLocale,
      mailItems: mailResult.items.length,
      threadItems: threadResult.items.length
    });
    return { mailItems: mailResult.items.length, threadItems: threadResult.items.length };
  }

  private async ensureReportsExist(): Promise<void> {
    if (
      fs.existsSync(this.getDailyBriefPath())
      && fs.existsSync(this.getThreadReportPath())
      && fs.existsSync(this.getSingleMailReportPath())
    ) {
      return;
    }
    await this.generateReportsCore();
  }

  private getDataDir(): string {
    return path.join(this.context.globalStorageUri.fsPath, "data");
  }

  private getConfigPath(): string {
    return path.join(this.context.globalStorageUri.fsPath, "easy-mail.config.json");
  }

  private getDigestPath(): string {
    return path.join(this.getDataDir(), "mail-digest.md");
  }

  private getAnalysisPath(): string {
    return path.join(this.getDataDir(), "analysis-result.json");
  }

  private getThreadAnalysisPath(): string {
    return path.join(this.getDataDir(), "thread-analysis-result.json");
  }

  private getSummaryPath(): string {
    return path.join(this.getDataDir(), "mail-summary.md");
  }

  private getDailyBriefPath(): string {
    return path.join(this.getDataDir(), "daily-brief.md");
  }

  private getThreadReportPath(): string {
    return path.join(this.getDataDir(), "thread-report.md");
  }

  private getSingleMailReportPath(): string {
    return path.join(this.getDataDir(), "single-mail-report.md");
  }

  private getIgnoredPath(): string {
    return path.join(this.getDataDir(), "ignored.json");
  }

  private getModelInfoPath(): string {
    return path.join(this.getDataDir(), "model-info.json");
  }

  private getAvailableModelsPath(): string {
    return path.join(this.getDataDir(), "available-models.json");
  }

  private getMailStorePath(): string {
    return path.join(this.getDataDir(), "mail-store.json");
  }

  private getMailIndexPath(): string {
    return path.join(this.getDataDir(), "mail-index.json");
  }

  private getThreadStorePath(): string {
    return path.join(this.getDataDir(), "thread-store.json");
  }

  private getClassificationCachePath(): string {
    return path.join(this.getDataDir(), "classification-cache.json");
  }

  private getPromptConfigPath(): string {
    return path.join(this.context.globalStorageUri.fsPath, "prompt-config.json");
  }

  private getReplyTemplatePath(): string {
    return path.join(this.context.globalStorageUri.fsPath, REPLY_TEMPLATE_FILE_NAME);
  }

  private getLegacyReplyTemplatePath(): string {
    return path.join(this.context.globalStorageUri.fsPath, LEGACY_REPLY_TEMPLATE_FILE_NAME);
  }

  private async ensureConfig(): Promise<void> {
    await fs.promises.mkdir(this.context.globalStorageUri.fsPath, { recursive: true });
    if (!fs.existsSync(this.getConfigPath())) {
      const defaults = path.join(this.context.extensionPath, "default-config.json");
      await fs.promises.copyFile(defaults, this.getConfigPath());
    }
    if (!fs.existsSync(this.getPromptConfigPath())) {
      const defaults = path.join(this.context.extensionPath, "prompts", "prompt-config.default.json");
      await fs.promises.copyFile(defaults, this.getPromptConfigPath());
    }
    if (!fs.existsSync(this.getReplyTemplatePath())) {
      if (fs.existsSync(this.getLegacyReplyTemplatePath())) {
        await fs.promises.copyFile(this.getLegacyReplyTemplatePath(), this.getReplyTemplatePath());
      } else {
        const defaults = path.join(this.context.extensionPath, "prompts", REPLY_TEMPLATE_FILE_NAME);
        await fs.promises.copyFile(defaults, this.getReplyTemplatePath());
      }
    }
  }

  private async readReplyTemplate(): Promise<string> {
    await this.ensureConfig();
    const template = await fs.promises.readFile(this.getReplyTemplatePath(), "utf8");
    const missing = validateReplyTemplate(template);
    if (missing.length) {
      await this.log("replyTemplate:missingPlaceholders", { missing });
      throw new Error(`Reply template is missing required placeholder(s): ${missing.map((key) => `{{${key}}}`).join(", ")}`);
    }
    return template;
  }

  private async readConfig(): Promise<Record<string, any>> {
    await this.ensureConfig();
    const defaults = JSON.parse(await fs.promises.readFile(path.join(this.context.extensionPath, "default-config.json"), "utf8"));
    const settings = vscode.workspace.getConfiguration("easyMail");
    return {
      ...defaults,
      rangeMode: settings.get("rangeMode", defaults.rangeMode),
      recentHours: settings.get("recentHours", defaults.recentHours),
      maxItems: settings.get("maxItems", defaults.maxItems),
      folders: settings.get("folders", defaults.folders),
      bodyExcerptChars: settings.get("bodyExcerptChars", defaults.bodyExcerptChars),
      sampleMode: settings.get("sampleMode", defaults.sampleMode),
      modelFamily: settings.get("modelFamily", defaults.modelFamily),
      outputLanguage: settings.get("outputLanguage", defaults.outputLanguage || "en-US"),
      analysisBatchSize: settings.get("analysisBatchSize", defaults.analysisBatchSize),
      autoAnalyzeEnabled: settings.get("autoAnalyzeEnabled", defaults.autoAnalyzeEnabled),
      autoAnalyzeMaxClassificationLevel: settings.get("autoAnalyzeMaxClassificationLevel", defaults.autoAnalyzeMaxClassificationLevel),
      mailStoreRetentionDays: settings.get("mailStoreRetentionDays", defaults.mailStoreRetentionDays),
      mailIndexRetentionDays: settings.get("mailIndexRetentionDays", defaults.mailIndexRetentionDays),
      analysisRetentionDays: settings.get("analysisRetentionDays", defaults.analysisRetentionDays),
      importantSenders: settings.get("importantSenders", defaults.importantSenders)
    };
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

  private async updateSettings(values: Record<string, unknown>): Promise<void> {
    const settings = vscode.workspace.getConfiguration("easyMail");
    for (const [key, value] of Object.entries(values)) {
      await settings.update(key, value, vscode.ConfigurationTarget.Global);
    }
  }

  private async initializeLogger(): Promise<void> {
    const logDir = path.join(this.context.globalStorageUri.fsPath, "logs");
    await fs.promises.mkdir(logDir, { recursive: true });
    this.logFilePath = path.join(logDir, "easy-mail.log");
    await this.log("logger:ready", { logFilePath: this.logFilePath });
  }

  private async log(event: string, data: Record<string, unknown>): Promise<void> {
    if (!this.logFilePath) {
      return;
    }
    const entry = {
      ts: new Date().toISOString(),
      event,
      ...data
    };
    await fs.promises.appendFile(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf8").catch(() => undefined);
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

  private async readCachedAvailableModels(): Promise<AvailableModel[]> {
    if (this.availableModelsCache) {
      return this.availableModelsCache;
    }
    if (!fs.existsSync(this.getAvailableModelsPath())) {
      return [];
    }
    try {
      const raw = JSON.parse(await fs.promises.readFile(this.getAvailableModelsPath(), "utf8"));
      const items = Array.isArray(raw.items)
        ? raw.items.map(normalizeAvailableModel).filter((item: AvailableModel) => item.id || item.family || item.name)
        : [];
      this.availableModelsCache = items;
      return items;
    } catch (error) {
      await this.log("models:cacheReadError", { error: formatError(error) });
      return [];
    }
  }

  private async loadAvailableModels(): Promise<void> {
    const pending = this.availableModelsPending || this.llmProvider.listModels()
      .then(async (items) => {
        this.availableModelsCache = items;
        await fs.promises.writeFile(this.getAvailableModelsPath(), `${JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2)}\n`, "utf8");
        await this.log("models:loaded", { count: items.length });
        return items;
      })
      .catch(async (error) => {
        await this.log("models:error", { error: formatError(error) });
        throw error;
      })
      .finally(() => {
        this.availableModelsPending = null;
      });
    this.availableModelsPending = pending;
    await pending;
  }

  private async readAnalysisResult(): Promise<AnalysisResult> {
    if (!fs.existsSync(this.getAnalysisPath())) {
      return { generatedAt: "", overview: { totalMails: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 }, items: [] };
    }
    try {
      const config = await this.readConfig();
      const promptConfig = await this.readPromptConfig();
      return pruneAnalysisResult(
        normalizeAnalysis(JSON.parse(await fs.promises.readFile(this.getAnalysisPath(), "utf8")), allowedCategoryIds(promptConfig)),
        Number(config.analysisRetentionDays || 7),
        allowedCategoryIds(promptConfig)
      );
    } catch {
      return { generatedAt: "", overview: { totalMails: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 }, items: [] };
    }
  }

  private async readThreadAnalysisResult(): Promise<ThreadAnalysisResult> {
    if (!fs.existsSync(this.getThreadAnalysisPath())) {
      return { generatedAt: "", overview: { totalThreads: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 }, items: [] };
    }
    try {
      const promptConfig = await this.readPromptConfig();
      return normalizeThreadAnalysis(
        JSON.parse(await fs.promises.readFile(this.getThreadAnalysisPath(), "utf8")),
        allowedCategoryIds(promptConfig)
      );
    } catch {
      return { generatedAt: "", overview: { totalThreads: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 }, items: [] };
    }
  }

  private async writeThreadAnalysisResult(result: ThreadAnalysisResult): Promise<void> {
    await fs.promises.writeFile(this.getThreadAnalysisPath(), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  private async readMailStore(): Promise<MailStore> {
    if (!fs.existsSync(this.getMailStorePath())) {
      return emptyMailStore();
    }
    try {
      return normalizeMailStore(JSON.parse(await fs.promises.readFile(this.getMailStorePath(), "utf8")));
    } catch {
      return emptyMailStore();
    }
  }

  private async writeMailStore(store: MailStore): Promise<void> {
    await fs.promises.writeFile(this.getMailStorePath(), `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }

  private async readMailIndex(): Promise<MailIndex> {
    if (!fs.existsSync(this.getMailIndexPath())) {
      return emptyMailIndex();
    }
    try {
      return normalizeMailIndex(JSON.parse(await fs.promises.readFile(this.getMailIndexPath(), "utf8")));
    } catch {
      return emptyMailIndex();
    }
  }

  private async writeMailIndex(index: MailIndex): Promise<void> {
    await fs.promises.writeFile(this.getMailIndexPath(), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  }

  private async readThreadStore(): Promise<ThreadStore> {
    if (!fs.existsSync(this.getThreadStorePath())) {
      return emptyThreadStore();
    }
    try {
      return normalizeThreadStore(JSON.parse(await fs.promises.readFile(this.getThreadStorePath(), "utf8")));
    } catch {
      return emptyThreadStore();
    }
  }

  private async writeThreadStore(store: ThreadStore): Promise<void> {
    await fs.promises.writeFile(this.getThreadStorePath(), `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }

  private async readClassificationCache(): Promise<ClassificationCache> {
    if (!fs.existsSync(this.getClassificationCachePath())) {
      return normalizeClassificationCache({});
    }
    try {
      return normalizeClassificationCache(JSON.parse(await fs.promises.readFile(this.getClassificationCachePath(), "utf8")));
    } catch {
      return normalizeClassificationCache({});
    }
  }

  private async writeClassificationCache(cache: ClassificationCache): Promise<void> {
    await fs.promises.writeFile(this.getClassificationCachePath(), `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  }

  private async readPromptConfig(): Promise<PromptConfig> {
    await this.ensureConfig();
    try {
      return normalizePromptConfig(JSON.parse(await fs.promises.readFile(this.getPromptConfigPath(), "utf8")));
    } catch {
      return normalizePromptConfig({});
    }
  }

  private async importDigestIfStoreMissing(): Promise<void> {
    const store = await this.readMailStore();
    if (store.items.length || !fs.existsSync(this.getDigestPath())) {
      return;
    }
    const digest = parseDigest(await fs.promises.readFile(this.getDigestPath(), "utf8"));
    const merge = mergeDigestIntoStore(store, digest);
    await this.writeMailStore(merge.store);
    await this.writeThreadStore(mergeThreadStores(await this.readThreadStore(), buildThreadStore(merge.store.items)));
    await this.writeClassificationCache(ensureClassifications(merge.store.items, await this.readClassificationCache()));
  }

  private async findCollectorScript(): Promise<string> {
    return await this.findScript("collect-outlook-mails.vbs");
  }

  private async findScript(scriptName: string): Promise<string> {
    const candidate = path.join(this.context.extensionPath, "scripts", scriptName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    throw new Error(`${scriptName} not found in extension package.`);
  }

  private async findOutlookOpenTarget(mailId: string): Promise<{ entryId: string; storeId: string } | null> {
    const targetId = String(mailId || "");
    if (!targetId) {
      return null;
    }

    const index = await this.readMailIndex();
    const indexItem = index.items.find((item) => item.mailId === targetId || item.sourceMailId === targetId);
    if (indexItem?.entryId) {
      return { entryId: indexItem.entryId, storeId: String(indexItem.storeId || "") };
    }

    const store = await this.readMailStore();
    const storedMail = store.items.find((item) => item.mailId === targetId || item.sourceMailId === targetId);
    if (storedMail?.entryId) {
      return { entryId: storedMail.entryId, storeId: String(storedMail.storeId || "") };
    }

    const analysis = await this.readAnalysisResult();
    const analysisItem = analysis.items.find((item) => item.mailId === targetId || item.source?.mailId === targetId);
    if (analysisItem?.source?.entryId) {
      return { entryId: analysisItem.source.entryId, storeId: "" };
    }

    return null;
  }

  private async loadState(): Promise<DashboardState> {
    const config = await this.readConfig();
    const digest: DigestData = fs.existsSync(this.getDigestPath())
      ? parseDigest(await fs.promises.readFile(this.getDigestPath(), "utf8"))
      : { metadata: { generatedAt: "", rangeMode: "", recentHours: 0, maxItems: 0, folders: [] }, items: [] };
    const promptConfig = await this.readPromptConfig();
    const analysis = await this.readAnalysisResult();
    const threadAnalysis = await this.readThreadAnalysisResult();
    const ignoredIds = await this.readIgnoredIds();
    const store = await this.readMailStore();
    const index = pruneMailIndex(await this.readMailIndex(), Number(config.mailIndexRetentionDays || 7));
    await this.writeMailIndex(index);
    const threadStore = pruneThreadStore(await this.readThreadStore(), Number(config.mailStoreRetentionDays || 1));
    const classifications = ensureClassifications(store.items, await this.readClassificationCache());
    await this.writeClassificationCache(classifications);
    const securitySettings = buildSecuritySettings(config);
    const securityDecisions = buildMailSecurityDecisionMap(store.items, classifications, securitySettings);
    const securedThreadStore: ThreadStore = {
      ...threadStore,
      items: threadStore.items.map((thread) => ({
        ...thread,
        security: buildThreadGateDecision(thread, classifications.items, securitySettings).summary
      }))
    };
    await this.writeThreadStore(securedThreadStore);
    const queue = buildQueueState(
      store.items,
      analysis,
      ignoredIds,
      classifications,
      config.autoAnalyzeEnabled !== false,
      Number(config.autoAnalyzeMaxClassificationLevel || 2)
    );
    const state = buildDashboardState(config, digest, analysis, ignoredIds, allowedCategoryIds(promptConfig), securedThreadStore) as DashboardState & {
      modelInfo?: Record<string, unknown>;
      store?: MailStore;
      index?: MailIndex;
      queue?: ReturnType<typeof buildQueueState>;
      classifications?: ClassificationCache;
      securityDecisions?: SecurityDecisionMap;
      promptConfig?: PromptConfig;
      threadStore?: ThreadStore;
      threadAnalysis?: ThreadAnalysisResult;
    };
    state.modelInfo = await this.readModelInfo();
    state.store = store;
    state.index = index;
    state.queue = queue;
    state.classifications = classifications;
    state.securityDecisions = securityDecisions;
    state.promptConfig = promptConfig;
    state.threadStore = securedThreadStore;
    state.threadAnalysis = threadAnalysis;
    return state;
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== "object") {
      return;
    }

    const typed = message as { type?: string; draftReply?: string; mailId?: string; mailIds?: string[]; threadId?: string; config?: unknown; silent?: boolean };
    await this.log("message:received", {
      type: typed.type || "",
      mailId: typed.mailId || "",
      mailIds: Array.isArray(typed.mailIds) ? typed.mailIds.length : 0,
      threadId: typed.threadId || ""
    });
    if (typed.type === "copyDraft") {
      const draftReply = String(typed.draftReply || "");
      if (!draftReply.trim()) {
        void vscode.window.showWarningMessage("No draft reply is available for this mail.");
        return;
      }
      await vscode.env.clipboard.writeText(draftReply);
      void vscode.window.showInformationMessage("Draft reply copied.");
      return;
    }

    if (typed.type === "ignore") {
      const ignoredIds = await this.readIgnoredIds();
      if (typed.mailId && !ignoredIds.includes(typed.mailId)) {
        ignoredIds.push(typed.mailId);
        await this.writeIgnoredIds(ignoredIds);
      }
      await this.log("ignore:done", { mailId: typed.mailId || "", ignoredCount: ignoredIds.length });
      const locale = await this.readLocale();
      void vscode.window.showInformationMessage(locale === "zh-CN" ? "邮件已忽略。" : "Mail ignored.");
      await this.refresh();
      return;
    }

    if (typed.type === "openInOutlook" && typed.mailId) {
      await this.openMailInOutlook(String(typed.mailId));
      return;
    }

    if (typed.type === "refresh") {
      await this.refresh();
      return;
    }

    if (typed.type === "openGuide") {
      await this.openGuide();
      return;
    }

    if (typed.type === "openWalkthrough") {
      await this.openGuide();
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

    if (typed.type === "generateReports") {
      await this.generateReports();
      return;
    }

    if (typed.type === "loadModels") {
      await this.loadModels();
      return;
    }

    if (typed.type === "requestLanguageChange") {
      const requested = (typed.config && typeof typed.config === "object" && (typed.config as Record<string, unknown>).outputLanguage === "zh-CN") ? "zh-CN" : "en-US";
      await this.changeOutputLanguage(requested);
      return;
    }

    if (typed.type === "openDailyBrief") {
      await this.openDailyBrief();
      return;
    }

    if (typed.type === "openThreadReport") {
      await this.openThreadReport();
      return;
    }

    if (typed.type === "openSingleMailReport") {
      await this.openSingleMailReport();
      return;
    }

    if (typed.type === "pullMail") {
      await this.pullMail(false);
      return;
    }

    if (typed.type === "loadMore") {
      await this.loadMore();
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

    if (typed.type === "analyzeAllAllowed") {
      await this.analyzeAllAllowed();
      return;
    }

    if (typed.type === "analyzeSelected") {
      await this.analyzeSelected(Array.isArray(typed.mailIds) ? typed.mailIds.map(String) : []);
      return;
    }

    if (typed.type === "analyzeThread" && typed.threadId) {
      await this.analyzeThread(String(typed.threadId));
      return;
    }

    if (typed.type === "openSettings") {
      await this.openSettings();
      return;
    }

    if (typed.type === "openPromptConfig") {
      await this.openPromptConfig();
      return;
    }

    if (typed.type === "clearLocalCache") {
      await this.clearLocalCache();
      return;
    }

    if (typed.type === "saveConfig") {
      await this.saveConfigFromMessage(typed);
      await this.refresh();
    }
  }

  private async saveConfigFromMessage(message: { config?: unknown; silent?: boolean }): Promise<void> {
    if (!message.config || typeof message.config !== "object") {
      return;
    }

    const current = await this.readConfig();
    const patch = message.config as Record<string, unknown>;
    const next = {
      rangeMode: Object.prototype.hasOwnProperty.call(patch, "rangeMode") ? (patch.rangeMode === "maxItems" ? "maxItems" : "recentHours") : current.rangeMode,
      recentHours: Object.prototype.hasOwnProperty.call(patch, "recentHours") ? positiveNumber(patch.recentHours, current.recentHours || 24) : current.recentHours,
      maxItems: Object.prototype.hasOwnProperty.call(patch, "maxItems") ? positiveNumber(patch.maxItems, current.maxItems || 50) : current.maxItems,
      folders: Object.prototype.hasOwnProperty.call(patch, "folders") ? parseFolders(patch.folders, current.folders || ["Inbox"]) : current.folders,
      bodyExcerptChars: Object.prototype.hasOwnProperty.call(patch, "bodyExcerptChars") ? positiveNumber(patch.bodyExcerptChars, current.bodyExcerptChars || 1500) : current.bodyExcerptChars,
      outputLanguage: Object.prototype.hasOwnProperty.call(patch, "outputLanguage") ? (patch.outputLanguage === "zh-CN" ? "zh-CN" : "en-US") : current.outputLanguage,
      modelFamily: Object.prototype.hasOwnProperty.call(patch, "modelFamily") ? String(patch.modelFamily || current.modelFamily || "gpt-5.4").trim() : current.modelFamily,
      analysisBatchSize: Object.prototype.hasOwnProperty.call(patch, "analysisBatchSize") ? positiveNumber(patch.analysisBatchSize, current.analysisBatchSize || 5) : current.analysisBatchSize,
      autoAnalyzeEnabled: Object.prototype.hasOwnProperty.call(patch, "autoAnalyzeEnabled") ? (patch.autoAnalyzeEnabled === true || patch.autoAnalyzeEnabled === "true") : current.autoAnalyzeEnabled,
      autoAnalyzeMaxClassificationLevel: Object.prototype.hasOwnProperty.call(patch, "autoAnalyzeMaxClassificationLevel") ? positiveNumber(patch.autoAnalyzeMaxClassificationLevel, current.autoAnalyzeMaxClassificationLevel || 2) : current.autoAnalyzeMaxClassificationLevel,
      mailStoreRetentionDays: Object.prototype.hasOwnProperty.call(patch, "mailStoreRetentionDays") ? positiveNumber(patch.mailStoreRetentionDays, current.mailStoreRetentionDays || 1) : current.mailStoreRetentionDays,
      mailIndexRetentionDays: Object.prototype.hasOwnProperty.call(patch, "mailIndexRetentionDays") ? positiveNumber(patch.mailIndexRetentionDays, current.mailIndexRetentionDays || 7) : current.mailIndexRetentionDays,
      analysisRetentionDays: Object.prototype.hasOwnProperty.call(patch, "analysisRetentionDays") ? positiveNumber(patch.analysisRetentionDays, current.analysisRetentionDays || 7) : current.analysisRetentionDays,
      importantSenders: Object.prototype.hasOwnProperty.call(patch, "importantSenders") ? parseFolders(patch.importantSenders, current.importantSenders || []) : current.importantSenders
    };
    await this.updateSettings(next);
    if (!message.silent) {
      await vscode.window.showInformationMessage("Easy Mail settings saved to VS Code Settings.");
    }
  }

  private async getDashboardHtml(): Promise<string> {
    const state = await this.loadState();
    const digestMeta = state.digestMetadata || {};
    const modelInfo = (state as DashboardState & { modelInfo?: Record<string, unknown> }).modelInfo || {};
    const config = state.config as Record<string, unknown>;
    const extendedState = state as DashboardState & {
      store?: MailStore;
      index?: MailIndex;
      queue?: ReturnType<typeof buildQueueState>;
      classifications?: ClassificationCache;
      securityDecisions?: SecurityDecisionMap;
      promptConfig?: PromptConfig;
      threadStore?: ThreadStore;
      threadAnalysis?: ThreadAnalysisResult;
    };
    const locale = getLocaleFromConfig(config);
    const labels = getLabels(locale);
    const promptConfig = extendedState.promptConfig || normalizePromptConfig({});
    promptConfig.importantSenders = mergeStringLists(promptConfig.importantSenders, parseFolders(config.importantSenders, []));
    const categoryLabels = buildCategoryLabels(labels, promptConfig, locale);
    const threadStore = extendedState.threadStore || emptyThreadStore();
    const visibleThreadStore = filterVisibleThreadsForDashboard(threadStore);
    const threadAnalysis = extendedState.threadAnalysis || { generatedAt: "", overview: { totalThreads: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 }, items: [] };
    const threadByMailId = buildThreadLookup(visibleThreadStore);
    const categoryHtml = new Map(state.categories.map((entry) => [entry.id, renderCategory(entry.id, entry.items, labels, categoryLabels, threadByMailId)]));
    const mustHandleHtml = categoryHtml.get("mustHandleToday") || "";
    const analysedTargetId = domIdForCategory(state.categories.find((entry) => entry.id !== "ignored" && entry.items.length > 0)?.id || "mustHandleToday");
    const rows = state.categories
      .filter((entry) => entry.id !== "mustHandleToday")
      .map((entry) => categoryHtml.get(entry.id) || "")
      .join("");
    const store = extendedState.store || emptyMailStore();
    const index = extendedState.index || emptyMailIndex();
    const queue = extendedState.queue || { pending: [], blocked: [], analysed: [], allowed: [] };
    const classifications = extendedState.classifications || normalizeClassificationCache({});
    const securityDecisions = extendedState.securityDecisions || new Map<string, SecurityGateDecisionResult>();
    const availableModels = await this.readCachedAvailableModels();
    const configuredModel = String(config.modelFamily || "");
    const canAnalyze = !!selectConfiguredModel(availableModels, configuredModel);
    const busyDisabled = this.busy ? " disabled" : "";
    const analysisDisabled = canAnalyze && !this.busy ? "" : " disabled";
    const activeBusyKind = this.busy?.kind || "";
    const pullMailBusy = activeBusyKind === "pullMail";
    const loadMoreBusy = activeBusyKind === "loadMore";
    const sampleBusy = activeBusyKind === "sample";
    const analyzeNextBusy = activeBusyKind === "analyzeNext";
    const analyzeSelectedBusy = activeBusyKind === "analyzeSelected";
    const analyzeAllBusy = activeBusyKind === "analyzeAll";
    const reportsBusy = activeBusyKind === "reports";
    const modelOptions = renderModelOptions(availableModels, configuredModel, labels);
    const analyzeNextLabel = formatAnalyzeNextLabel(labels, config);
    const pendingHtml = renderPendingPanel("pending-panel", labels.pending.title, queue.pending, classifications, labels, queue.allowed, false, threadByMailId, securityDecisions);
    const blockedHtml = renderPendingPanel("blocked-panel", labels.pending.blockedTitle, queue.blocked, classifications, labels, [], true, threadByMailId, securityDecisions);
    const threadsHtml = renderThreadsPanel(visibleThreadStore, labels, threadAnalysis, activeBusyKind);
    const configuredFolders = Array.isArray(config.folders) ? config.folders.map(String) : ["Inbox"];
    const hasHistoryAnchors = Object.keys(folderOldestReceivedTimes(index, configuredFolders)).length > 0;
    const loadMoreDisabled = hasHistoryAnchors ? "" : " disabled";
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    :root { color-scheme: light; }
    body { font-family: "Segoe UI", sans-serif; margin: 0; padding: 56px 12px 12px; color: #1b2a34; background: #f3f0ea; }
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; align-items: center; }
    .toolbar-group { display: flex; gap: 8px; flex-wrap: wrap; padding: 4px; border-radius: 10px; background: rgba(255, 255, 255, 0.55); }
    button { border: 0; border-radius: 8px; padding: 8px 12px; background: #0f4c5c; color: #fff; cursor: pointer; }
    button:disabled { opacity: 0.48; cursor: not-allowed; }
    button.secondary { background: #d8c3a5; color: #2f2a24; }
    button.ghost { background: #e9e1d4; color: #2f2a24; }
    .language-toggle { position: fixed; top: 12px; right: 12px; z-index: 10; display: inline-flex; align-items: center; gap: 8px; min-width: 122px; background: #fffdf8; color: #132a35; border: 1px solid #d8c3a5; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10); font-weight: 700; }
    .help-toggle { position: fixed; top: 12px; right: 146px; z-index: 10; width: 34px; height: 34px; padding: 0; border-radius: 50%; background: #fffdf8; color: #132a35; border: 1px solid #d8c3a5; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10); font-weight: 800; }
    .globe-icon { position: relative; display: inline-block; width: 18px; height: 18px; border: 2px solid currentColor; border-radius: 50%; box-sizing: border-box; }
    .globe-icon::before { content: ""; position: absolute; top: -2px; bottom: -2px; left: 50%; width: 6px; transform: translateX(-50%); border-left: 1px solid currentColor; border-right: 1px solid currentColor; border-radius: 50%; }
    .globe-icon::after { content: ""; position: absolute; left: -2px; right: -2px; top: 50%; border-top: 1px solid currentColor; transform: translateY(-50%); }
    .chevron { width: 7px; height: 7px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg) translateY(-2px); }
    button.is-busy { display: inline-flex; align-items: center; gap: 8px; }
    .button-spinner { width: 12px; height: 12px; border: 2px solid rgba(255, 255, 255, 0.42); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .settings { background: #fff; border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; }
    .settings summary { cursor: pointer; font-weight: 700; }
    .settings .settings-body { margin-top: 10px; }
    .help { color: #6d6d6d; font-size: 11px; line-height: 1.35; }
    .autosave-note { color: #41515a; font-size: 12px; margin-top: 10px; padding: 8px 10px; border-radius: 8px; background: #faf7f2; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #41515a; }
    .field-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .inline-action { padding: 3px 8px; border-radius: 6px; font-size: 11px; line-height: 1.2; white-space: nowrap; }
    input, select { border: 1px solid #d8c3a5; border-radius: 6px; padding: 6px 8px; background: #fffdf8; color: #1b2a34; }
    .meta { background: #fff; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; border-left: 5px solid #0f4c5c; box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05); }
    .meta-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
    .meta-item { min-width: 0; }
    .meta-label { display: block; color: #5c6870; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .meta-value { display: block; color: #132a35; font-size: 15px; font-weight: 700; overflow-wrap: anywhere; margin-top: 2px; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
    .stat { background: #fff; color: #132a35; padding: 10px; border-radius: 10px; text-align: left; min-height: 72px; display: flex; flex-direction: column; justify-content: center; }
    .stat:hover { outline: 2px solid #d8c3a5; }
    .stat .value { font-size: 22px; font-weight: 700; }
    details.category { margin-bottom: 12px; background: #fff; border-radius: 10px; padding: 8px 10px; }
    details.category:focus { outline: 2px solid #0f4c5c; outline-offset: 2px; }
    details.category summary { cursor: pointer; font-weight: 700; font-size: 16px; }
    details.category .category-body { margin-top: 8px; }
    .card { background: #fff; border-radius: 10px; padding: 12px; margin-bottom: 8px; }
    .header { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .title { font-weight: 700; }
    .badge { border-radius: 999px; padding: 2px 8px; font-size: 12px; background: #f5c16c; }
    .empty { color: #6d6d6d; font-style: italic; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .actions button { padding: 6px 10px; font-size: 12px; }
    .select-row { display: flex; flex-direction: row; align-items: center; gap: 6px; }
    .draft-box { position: relative; margin-top: 8px; }
    .draft-box pre { margin: 0; padding-right: 44px; }
    .copy-icon-button { position: absolute; top: 7px; right: 7px; width: 28px; height: 28px; padding: 0; border-radius: 6px; background: rgba(255, 253, 248, 0.94); color: #132a35; border: 1px solid #d8c3a5; }
    .copy-icon { position: relative; display: inline-block; width: 15px; height: 18px; border: 2px solid currentColor; border-radius: 2px; background: rgba(255, 253, 248, 0.94); box-sizing: border-box; }
    .copy-icon::before { content: ""; position: absolute; width: 15px; height: 18px; left: -7px; top: 4px; border: 2px solid currentColor; border-radius: 2px; background: rgba(255, 253, 248, 0.94); box-sizing: border-box; }
    .copy-icon::after { content: ""; position: absolute; right: -2px; top: -2px; width: 7px; height: 7px; background: rgba(255, 253, 248, 0.94); border-left: 2px solid currentColor; border-bottom: 2px solid currentColor; }
    .timeline { display: grid; gap: 8px; margin-top: 8px; }
    .timeline-item { border-left: 3px solid #d8c3a5; padding-left: 10px; }
    .muted { color: #6d6d6d; font-size: 12px; }
    pre { white-space: pre-wrap; background: #faf7f2; padding: 8px; border-radius: 8px; }
  </style>
</head>
<body>
  <button class="help-toggle" type="button" title="Open Easy Mail guide" aria-label="Open Easy Mail guide" onclick="post('openGuide')">?</button>
  <button class="language-toggle" id="outputLanguage" type="button" value="${escapeAttr(locale)}" onclick="toggleLanguage()"><span class="globe-icon" aria-hidden="true"></span><span class="language-label">${escapeHtml(locale === "en-US" ? labels.settings.enOption : labels.settings.zhOption)}</span><span class="chevron" aria-hidden="true"></span></button>
  <div class="toolbar">
    <div class="toolbar-group">
      <button class="${pullMailBusy ? "is-busy" : ""}" onclick="post('pullMail')"${busyDisabled}>${escapeHtml(labels.toolbar.pullMail)}${renderButtonSpinner(pullMailBusy)}</button>
      <button class="${loadMoreBusy ? "is-busy" : ""}" onclick="post('loadMore')"${loadMoreDisabled || busyDisabled}>${escapeHtml(labels.toolbar.loadMore)}${renderButtonSpinner(loadMoreBusy)}</button>
      <button class="${sampleBusy ? "is-busy" : ""}" onclick="post('sampleDigest')"${busyDisabled}>${escapeHtml(labels.toolbar.sample)}${renderButtonSpinner(sampleBusy)}</button>
      <button class="${analyzeNextBusy ? "is-busy" : ""}" onclick="post('analyze')"${analysisDisabled}>${escapeHtml(analyzeNextLabel)}${renderButtonSpinner(analyzeNextBusy)}</button>
      <button class="${analyzeSelectedBusy ? "is-busy" : ""}" onclick="analyzeSelected()"${analysisDisabled}>${escapeHtml(labels.toolbar.analyzeSelected)}${renderButtonSpinner(analyzeSelectedBusy)}</button>
      <button class="${analyzeAllBusy ? "is-busy" : ""}" onclick="post('analyzeAllAllowed')"${analysisDisabled}>${escapeHtml(labels.toolbar.analyzeAllAllowed)}${renderButtonSpinner(analyzeAllBusy)}</button>
      <button onclick="post('refresh')"${busyDisabled}>${escapeHtml(labels.toolbar.refresh)}</button>
    </div>
    <div class="toolbar-group">
      <button class="secondary" onclick="post('openSummary')">${escapeHtml(labels.toolbar.openSummary)}</button>
      <button class="secondary ${reportsBusy ? "is-busy" : ""}" onclick="post('generateReports')"${busyDisabled}>${escapeHtml(labels.toolbar.generateReports)}${renderButtonSpinner(reportsBusy)}</button>
    </div>
    <div class="toolbar-group">
      <button class="ghost" onclick="post('openSettings')">${escapeHtml(labels.toolbar.settingsFile)}</button>
      <button class="ghost" onclick="post('openPromptConfig')">${escapeHtml(labels.toolbar.promptConfig)}</button>
      <button class="ghost" onclick="post('clearLocalCache')"${busyDisabled}>${escapeHtml(labels.toolbar.clearStore)}</button>
    </div>
  </div>
  <details class="settings" id="settingsPanel">
    <summary>${escapeHtml(labels.settings.title)}</summary>
    <div class="settings-body">
      <div class="grid">
      <label>${escapeHtml(labels.settings.range)}
        <select id="rangeMode">
          <option value="recentHours" ${selected(config.rangeMode, "recentHours")}>${escapeHtml(labels.settings.recentHoursOption)}</option>
          <option value="maxItems" ${selected(config.rangeMode, "maxItems")}>${escapeHtml(labels.settings.maxItemsOption)}</option>
        </select>
      </label>
      ${renderRangeValueControl(config, labels)}
      <label>${escapeHtml(labels.settings.folders)}
        <input id="folders" value="${escapeAttr(Array.isArray(config.folders) ? config.folders.join(";") : "Inbox")}" />
      </label>
      <label><span class="field-title">${escapeHtml(labels.settings.modelFamily)} <button class="inline-action" type="button" onclick="post('loadModels')"${busyDisabled}>${escapeHtml(labels.toolbar.loadModels)}</button></span>
        <select id="modelFamily">
          ${modelOptions}
        </select>
      </label>
      <label>${escapeHtml(labels.settings.autoAnalyze)}
        <select id="autoAnalyzeEnabled">
          <option value="true" ${selected(config.autoAnalyzeEnabled, true)}>${escapeHtml(labels.pending.autoAllowed)}</option>
          <option value="false" ${selected(config.autoAnalyzeEnabled, false)}>${escapeHtml(labels.pending.manualRequired)}</option>
        </select>
      </label>
      <label>${escapeHtml(labels.settings.maxClassification)}
        <select id="autoAnalyzeMaxClassificationLevel">
          ${renderClassificationOptions(Number(config.autoAnalyzeMaxClassificationLevel ?? 2), labels)}
        </select>
      </label>
      </div>
      <div class="autosave-note">${escapeHtml(labels.settings.autoSaveNote)}</div>
    </div>
  </details>
  <div class="meta">
    <div class="meta-grid">
      <div class="meta-item"><span class="meta-label">${escapeHtml(labels.meta.range)}</span><span class="meta-value">${escapeHtml(formatRangeMeta(digestMeta, labels))}</span></div>
      <div class="meta-item"><span class="meta-label">${escapeHtml(labels.meta.folders)}</span><span class="meta-value">${escapeHtml((digestMeta.folders || []).join(", ") || "-")}</span></div>
      <div class="meta-item"><span class="meta-label">${escapeHtml(labels.meta.generated)}</span><span class="meta-value">${escapeHtml(digestMeta.generatedAt || "-")}</span></div>
      <div class="meta-item"><span class="meta-label">${escapeHtml(labels.meta.lastPull)}</span><span class="meta-value">${escapeHtml(store.lastPullAt || "-")}</span></div>
      <div class="meta-item"><span class="meta-label">${escapeHtml(labels.meta.requestedModel)}</span><span class="meta-value">${escapeHtml(formatSelectedModel(config.modelFamily, availableModels))}</span></div>
    </div>
  </div>
  <div class="stats">
    ${renderStat(labels.stats.pulled, index.items.length, "pending-panel")}
    ${renderStat(labels.stats.pending, queue.pending.length, "pending-panel")}
    ${renderStat(labels.stats.analysed, state.overview.totalMails, analysedTargetId)}
    ${renderStat(labels.stats.blocked, queue.blocked.length, "blocked-panel")}
    ${renderStat(labels.stats.mustHandle, state.overview.mustHandleToday, domIdForCategory("mustHandleToday"))}
    ${renderStat(labels.stats.risk, state.overview.risks, domIdForCategory("risk"))}
    ${renderStat(labels.stats.waiting, state.overview.waitingForMe, domIdForCategory("waitingForMe"))}
    ${renderStat(labels.stats.notice, state.overview.notices, domIdForCategory("notice"))}
    ${renderStat(labels.stats.threads, visibleThreadStore.items.length, "threads-panel")}
  </div>
  ${pendingHtml}
  ${mustHandleHtml}
  ${blockedHtml}
  ${rows}
  ${threadsHtml}
  <script>
    const vscode = acquireVsCodeApi();
    const previousState = vscode.getState() || {};
    const settingsPanel = document.getElementById('settingsPanel');
    if (previousState.settingsOpen) {
      settingsPanel.open = true;
    }
    if (Array.isArray(previousState.openPanels)) {
      for (const panelId of previousState.openPanels) {
        const panel = document.getElementById(panelId);
        if (panel && panel.tagName === 'DETAILS') {
          panel.open = true;
        }
      }
    }
    settingsPanel.addEventListener('toggle', () => {
      vscode.setState(Object.assign({}, vscode.getState() || {}, { settingsOpen: settingsPanel.open }));
    });
    for (const panel of document.querySelectorAll('details.category')) {
      panel.addEventListener('toggle', () => {
        const openPanels = Array.from(document.querySelectorAll('details.category[open]')).map((item) => item.id).filter(Boolean);
        vscode.setState(Object.assign({}, vscode.getState() || {}, { openPanels }));
      });
    }
    const configControlIds = ['rangeMode', 'rangeValue', 'folders', 'modelFamily', 'autoAnalyzeEnabled', 'autoAnalyzeMaxClassificationLevel'];
    const autoSaveConfig = debounce(() => saveConfig(true, false), 450);
    for (const id of configControlIds) {
      const control = document.getElementById(id);
      if (!control) {
        continue;
      }
      control.addEventListener('change', autoSaveConfig);
      if (control.tagName === 'INPUT') {
        control.addEventListener('input', autoSaveConfig);
      }
    }
    document.addEventListener('click', (event) => {
      const target = event.target && event.target.closest ? event.target.closest('button[data-action]') : null;
      if (!target) {
        return;
      }
      const action = target.getAttribute('data-action');
      if (action === 'copyDraft') {
        post('copyDraft', { draftReply: target.getAttribute('data-draft-reply') || '' });
      }
      if (action === 'ignore') {
        ignoreMail(target.getAttribute('data-mail-id') || '');
      }
      if (action === 'openInOutlook') {
        post('openInOutlook', { mailId: target.getAttribute('data-mail-id') || '' });
      }
      if (action === 'analyzeThread') {
        post('analyzeThread', { threadId: target.getAttribute('data-thread-id') || '' });
      }
      if (action === 'jumpPanel') {
        jumpToPanel(target.getAttribute('data-target-id') || '');
      }
    });
    function post(type, extra) { vscode.postMessage(Object.assign({ type }, extra || {})); }
    function saveConfig(keepSettingsOpen, silent) {
      const rangeMode = document.getElementById('rangeMode').value;
      const rangeValue = document.getElementById('rangeValue');
      vscode.setState(Object.assign({}, vscode.getState() || {}, { settingsOpen: keepSettingsOpen !== false }));
      post('saveConfig', {
        silent: silent === true,
        config: {
          rangeMode,
          outputLanguage: document.getElementById('outputLanguage').value,
          recentHours: rangeMode === 'recentHours' ? rangeValue.value : undefined,
          maxItems: rangeMode === 'maxItems' ? rangeValue.value : undefined,
          folders: document.getElementById('folders').value,
          modelFamily: document.getElementById('modelFamily').value,
          autoAnalyzeEnabled: document.getElementById('autoAnalyzeEnabled').value,
          autoAnalyzeMaxClassificationLevel: document.getElementById('autoAnalyzeMaxClassificationLevel').value
        }
      });
    }
    function toggleLanguage() {
      vscode.setState(Object.assign({}, vscode.getState() || {}, { settingsOpen: true }));
      const button = document.getElementById('outputLanguage');
      const next = button.value === 'en-US' ? 'zh-CN' : 'en-US';
      button.value = next;
      const label = button.querySelector('.language-label');
      if (label) {
        label.textContent = next === 'en-US' ? 'English' : '简体中文';
      }
      post('requestLanguageChange', { config: { outputLanguage: next } });
    }
    function debounce(fn, wait) {
      let timer;
      return () => {
        clearTimeout(timer);
        timer = setTimeout(fn, wait);
      };
    }
    function jumpToPanel(targetId, smooth) {
      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }
      if (target.tagName === 'DETAILS') {
        target.open = true;
      }
      target.scrollIntoView({ behavior: smooth === false ? 'auto' : 'smooth', block: 'start' });
      if (typeof target.focus === 'function') {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    }
    function ignoreMail(mailId) {
      post('ignore', { mailId });
    }
    function analyzeSelected() {
      const checked = Array.from(document.querySelectorAll('input[data-mail-id]:checked')).map((input) => input.getAttribute('data-mail-id'));
      post('analyzeSelected', { mailIds: checked });
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

function renderStat(label: string, value: number | undefined, targetId: string): string {
  return `<button class="stat" data-action="jumpPanel" data-target-id="${escapeAttr(targetId)}"><span>${escapeHtml(label)}</span><span class="value">${escapeHtml(String(value || 0))}</span></button>`;
}

function renderButtonSpinner(active: boolean): string {
  return active ? `<span class="button-spinner" aria-hidden="true"></span>` : "";
}

function renderCategory(
  category: string,
  items: AnalysisResult["items"],
  labels: DashboardLabels,
  categoryLabels: Record<string, string>,
  threadByMailId: Map<string, string>
): string {
  const cards = items.length ? items.map((item) => renderCard(item, labels, threadByMailId, category === "ignored")).join("") : `<div class="empty">${escapeHtml(labels.card.noItems)}</div>`;
  return `<details class="category" id="${escapeAttr(domIdForCategory(category))}"><summary>${escapeHtml(categoryLabels[category] || labels.categories[category] || category)} (${items.length})</summary><div class="category-body">${cards}</div></details>`;
}

function renderPendingPanel(
  panelId: string,
  title: string,
  items: StoredMail[],
  classifications: ClassificationCache,
  labels: DashboardLabels,
  allowedItems: StoredMail[],
  blocked: boolean,
  threadByMailId: Map<string, string>,
  securityDecisions: SecurityDecisionMap
): string {
  const allowed = new Set(allowedItems.map((item) => item.mailId));
  const cards = items.length ? items.map((item) => {
    const classification = classificationFor(item.mailId, classifications);
    const gateDecision = securityDecisions.get(item.mailId);
    const status = formatGateStatus(gateDecision, blocked || !allowed.has(item.mailId), labels);
    const showStatus = blocked || !allowed.has(item.mailId) || gateDecision?.decision === "manual_confirm" || gateDecision?.decision === "block";
    const statusBadge = showStatus ? `<div class="badge">${escapeHtml(status)}</div>` : "";
    const reason = gateDecision?.reasons.length
      ? `<div><strong>${escapeHtml(labels.pending.securityReason)}:</strong> ${escapeHtml(gateDecision.reasons.join("; "))}</div>`
      : "";
    const threadId = threadByMailId.get(item.mailId) || "";
    const threadHtml = threadId
      ? `<div><strong>${escapeHtml(labels.card.thread)}:</strong> <a href="#${escapeAttr(domIdForThread(threadId))}">${escapeHtml(threadId)}</a></div>`
      : "";
    return `<article class="card pending-card" id="${escapeAttr(domIdForMail(item.mailId))}">
      <div class="header">
        <label class="select-row"><input type="checkbox" data-mail-id="${escapeAttr(item.mailId)}" /> ${escapeHtml(labels.pending.select)}</label>
        ${statusBadge}
      </div>
      <div class="title">${escapeHtml(item.subject || item.mailId)}</div>
      <div><strong>${escapeHtml(labels.card.from)}:</strong> ${escapeHtml(item.from || "-")}</div>
      <div><strong>${escapeHtml(labels.card.received)}:</strong> ${escapeHtml(item.receivedTime || "-")}</div>
      <div><strong>${escapeHtml(labels.pending.classification)}:</strong> ${escapeHtml(formatClassification(classification))}</div>
      ${reason}
      ${threadHtml}
    </article>`;
  }).join("") : `<div class="empty">${escapeHtml(labels.card.noItems)}</div>`;
  return `<details class="category" id="${escapeAttr(panelId)}"><summary>${escapeHtml(title)} (${items.length})</summary><div class="category-body">${cards}</div></details>`;
}

function renderThreadsPanel(threadStore: ThreadStore, labels: DashboardLabels, threadAnalysis: ThreadAnalysisResult, busyKind: string): string {
  const threads = [...(threadStore.items || [])].sort((a, b) => String(b.lastTime || "").localeCompare(String(a.lastTime || "")));
  const analysisByThreadId = new Map((threadAnalysis.items || []).map((item) => [item.threadId, item]));
  const cards = threads.length
    ? threads.map((thread) => renderThreadCard(thread, labels, analysisByThreadId.get(thread.threadId), busyKind)).join("")
    : `<div class="empty">${escapeHtml(labels.card.noItems)}</div>`;
  return `<details class="category" id="threads-panel"><summary>${escapeHtml(labels.threads.title)} (${threads.length})</summary><div class="category-body">${cards}</div></details>`;
}

function renderThreadCard(thread: ThreadStore["items"][number], labels: DashboardLabels, analysis: ThreadAnalysisResult["items"][number] | undefined, busyKind: string): string {
  const timelineItems = [...(thread.timeline || [])].sort(compareTimelineMessagesForDisplay);
  const timeline = timelineItems.length
    ? timelineItems.map((message) => {
      const attachments = message.attachmentNames.length
        ? `${message.attachmentCount}: ${message.attachmentNames.join(", ")}`
        : String(message.attachmentCount || 0);
      return `<div class="timeline-item" id="${escapeAttr(domIdForThreadMessage(thread.threadId, message.mailId))}">
        <div><strong>${escapeHtml(message.subject || message.mailId)}</strong></div>
        <div class="muted">${escapeHtml(message.receivedTime || message.sentTime || "-")} · ${escapeHtml(message.from || message.senderEmail || "-")}</div>
        <div class="muted">${escapeHtml(labels.threads.attachments)}: ${escapeHtml(attachments)}</div>
        <div class="muted">${escapeHtml(labels.threads.mailIds)}: <a href="#${escapeAttr(domIdForMail(message.mailId))}">${escapeHtml(message.mailId)}</a></div>
        <pre>${escapeHtml(message.bodyDelta || message.bodyPreview || "")}</pre>
      </div>`;
    }).join("")
    : `<div class="empty">${escapeHtml(labels.card.noItems)}</div>`;
  return `<article class="card" id="${escapeAttr(domIdForThread(thread.threadId))}">
    <div class="header">
      <div class="title">${escapeHtml(thread.subject || thread.threadId)}</div>
      <div class="badge">${escapeHtml(`${labels.threads.messages}: ${String(thread.messageCount)}`)}</div>
    </div>
    <div><strong>${escapeHtml(labels.threads.participants)}:</strong> ${escapeHtml(thread.participants.join(", ") || "-")}</div>
    <div><strong>${escapeHtml(labels.threads.lastTime)}:</strong> ${escapeHtml(thread.lastTime || "-")}</div>
    <div><strong>${escapeHtml(labels.threads.folders)}:</strong> ${escapeHtml(thread.folders.join(", ") || "-")}</div>
    <div><strong>${escapeHtml(labels.threads.contentStatus)}:</strong> ${escapeHtml(thread.contentStatus || "-")}</div>
    <div><strong>${escapeHtml(labels.threads.security)}:</strong> ${escapeHtml(formatThreadSecurity(thread.security))}</div>
    <div class="actions"><button class="secondary ${busyKind === "analyzeThread" ? "is-busy" : ""}" data-action="analyzeThread" data-thread-id="${escapeAttr(thread.threadId)}"${busyKind ? " disabled" : ""}>${escapeHtml(labels.threads.analyzeThread)}${renderButtonSpinner(busyKind === "analyzeThread")}</button></div>
    <details>
      <summary>${escapeHtml(labels.threads.timeline)} (${timelineItems.length})</summary>
      <div class="timeline">${timeline}</div>
    </details>
    ${renderThreadAnalysisSummary(analysis, labels)}
  </article>`;
}

function filterVisibleThreadsForDashboard(threadStore: ThreadStore): ThreadStore {
  return {
    ...threadStore,
    items: (threadStore.items || []).filter((thread) => Number(thread.messageCount || thread.timeline?.length || 0) > 1)
  };
}

function buildThreadLookup(threadStore: ThreadStore): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const thread of threadStore.items || []) {
    for (const mailId of thread.sourceMailIds || []) {
      lookup.set(mailId, thread.threadId);
    }
    for (const message of thread.timeline || []) {
      lookup.set(message.mailId, thread.threadId);
    }
  }
  return lookup;
}

function renderThreadAnalysisSummary(analysis: ThreadAnalysisResult["items"][number] | undefined, labels: DashboardLabels): string {
  if (!analysis) {
    return "";
  }
  const actionItems = analysis.actionItems.length
    ? `<ul>${analysis.actionItems.map((item) => `<li>${escapeHtml([item.owner, item.task, item.deadline].filter(Boolean).join(": ") || "-")}</li>`).join("")}</ul>`
    : `<div class="empty">${escapeHtml(labels.card.noItems)}</div>`;
  const risks = analysis.risks.length
    ? `<ul>${analysis.risks.map((risk) => `<li>${escapeHtml(`${risk.level}: ${risk.description}`)}</li>`).join("")}</ul>`
    : `<div class="empty">${escapeHtml(labels.card.noItems)}</div>`;
  const draft = analysis.draftReply ? renderDraftBox(analysis.draftReply) : "";
  return `<details open>
    <summary>${escapeHtml(labels.threads.analysis)} (${escapeHtml(analysis.priority)} / ${escapeHtml(analysis.category)})</summary>
    <div class="timeline">
      <div><strong>${escapeHtml(labels.threads.currentStatus)}:</strong> ${escapeHtml(analysis.currentStatus || analysis.oneLineSummary || "-")}</div>
      <div><strong>${escapeHtml(labels.threads.actionItems)}:</strong>${actionItems}</div>
      <div><strong>${escapeHtml(labels.threads.risks)}:</strong>${risks}</div>
      ${draft ? `<div><strong>${escapeHtml(labels.threads.draftReply)}:</strong>${draft}</div>` : ""}
    </div>
  </details>`;
}

function renderModelOptions(
  models: AvailableModel[],
  selectedValue: string,
  labels: DashboardLabels
): string {
  if (!models.length) {
    return `<option value="">${escapeHtml(labels.settings.modelsNotLoaded)}</option>`;
  }
  const uniqueModels = [...new Map(models.map((model) => [modelKey(model), model])).values()];
  const options = uniqueModels.map((model) => {
    const value = model.id || model.family;
    return `<option value="${escapeAttr(value)}" ${isSelectedModel(model, selectedValue) ? "selected" : ""}>${escapeHtml(formatModelLabel(model))}</option>`;
  });
  if (!selectedValue || !uniqueModels.some((model) => isSelectedModel(model, selectedValue))) {
    options.unshift(`<option value="" selected>${escapeHtml(labels.settings.noModel)}</option>`);
  }
  return options.join("");
}

function formatAnalyzeNextLabel(labels: DashboardLabels, config: Record<string, unknown>): string {
  const batchSize = positiveNumber(config.analysisBatchSize, 5);
  return `${labels.toolbar.analyze} (${String(batchSize)})`;
}

function renderRangeValueControl(config: Record<string, unknown>, labels: DashboardLabels): string {
  const rangeMode = config.rangeMode === "maxItems" ? "maxItems" : "recentHours";
  const label = rangeMode === "maxItems" ? labels.settings.maxItems : labels.settings.recentHours;
  const value = rangeMode === "maxItems" ? String(config.maxItems || 50) : String(config.recentHours || 24);
  return `<label>${escapeHtml(label)}
        <input id="rangeValue" type="number" min="1" value="${escapeAttr(value)}" />
      </label>`;
}

function formatRangeMeta(metadata: { rangeMode?: unknown; recentHours?: unknown; maxItems?: unknown }, labels: DashboardLabels): string {
  const mode = String(metadata.rangeMode || "");
  if (mode.toLowerCase() === "maxitems") {
    return `${labels.settings.maxItemsOption} / ${String(metadata.maxItems || "-")}`;
  }
  if (mode.toLowerCase() === "recenthours") {
    return `${labels.settings.recentHoursOption} / ${String(metadata.recentHours || "-")}h`;
  }
  return "-";
}

function formatSelectedModel(selectedValue: unknown, models: AvailableModel[]): string {
  const selected = String(selectedValue || "");
  const model = selectConfiguredModel(models, selected) as AvailableModel | undefined;
  return model ? formatModelLabel(model) : selected || "-";
}

function renderClassificationOptions(selectedLevel: number, labels: DashboardLabels): string {
  const options = [
    [0, labels.settings.classificationPublic],
    [1, labels.settings.classificationInternal],
    [2, labels.settings.classificationRegistered],
    [3, labels.settings.classificationHighRegistered]
  ] as const;
  return options.map(([level, label]) => {
    return `<option value="${level}" ${selected(selectedLevel, level)}>${escapeHtml(label)}</option>`;
  }).join("");
}

function renderDraftBox(draftReply: string): string {
  const draft = String(draftReply || "");
  if (!draft.trim()) {
    return "";
  }
  return `<div class="draft-box"><pre>${escapeHtml(draft)}</pre><button class="copy-icon-button" data-action="copyDraft" data-draft-reply="${escapeAttr(draft)}" title="Copy draft" aria-label="Copy draft"><span class="copy-icon" aria-hidden="true"></span></button></div>`;
}

function renderCard(item: AnalysisResult["items"][number], labels: DashboardLabels, threadByMailId: Map<string, string>, isIgnored = false): string {
  const threadId = threadByMailId.get(item.mailId) || "";
  const threadHtml = threadId
    ? `<div><strong>${escapeHtml(labels.card.thread)}:</strong> <a href="#${escapeAttr(domIdForThread(threadId))}">${escapeHtml(threadId)}</a></div>`
    : "";
  const draftReply = String(item.draftReply || "");
  const draftHtml = draftReply.trim() ? renderDraftBox(draftReply) : "";
  const ignoreButton = isIgnored
    ? ""
    : `<button class="secondary" data-action="ignore" data-mail-id="${escapeAttr(item.mailId)}">${escapeHtml(labels.card.ignore)}</button>`;
  const openButton = `<button class="secondary" data-action="openInOutlook" data-mail-id="${escapeAttr(item.mailId)}">${escapeHtml(labels.card.openInOutlook)}</button>`;
  return `<article class="card" id="${escapeAttr(domIdForMail(item.mailId))}">
    <div class="header">
      <div class="title">${escapeHtml(item.subject || item.mailId)}</div>
      <div class="badge">${escapeHtml(formatPriority(item.priority, labels))}</div>
    </div>
    <div><strong>${escapeHtml(labels.card.from)}:</strong> ${escapeHtml(item.sender || "-")}</div>
    <div><strong>${escapeHtml(labels.card.received)}:</strong> ${escapeHtml(item.receivedTime || "-")}</div>
    <div><strong>${escapeHtml(labels.card.summary)}:</strong> ${escapeHtml(item.summary || "-")}</div>
    <div><strong>${escapeHtml(labels.card.reason)}:</strong> ${escapeHtml(item.reason || "-")}</div>
    <div><strong>${escapeHtml(labels.card.suggestedAction)}:</strong> ${escapeHtml(item.suggestedAction || "-")}</div>
    ${threadHtml}
    ${draftHtml}
    <div class="actions">
      ${openButton}
      ${ignoreButton}
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

function runProcess(
  command: string,
  args: string[],
  timeoutMs = 30000,
  onEvent?: (event: string, data: Record<string, unknown>) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    onEvent?.("start", { command, args: sanitizeProcessArgs(args), timeoutMs });
    const child = cp.spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      onEvent?.("timeout", { command, elapsedMs: Date.now() - startedAt, stdoutLength: stdout.length, stderrLength: stderr.length });
      reject(new Error(`${command} timed out after ${String(timeoutMs)}ms. ${stderr || stdout}`.trim()));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      onEvent?.("error", { command, elapsedMs: Date.now() - startedAt, error: formatError(error), stdoutLength: stdout.length, stderrLength: stderr.length });
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      onEvent?.("close", { command, code, elapsedMs: Date.now() - startedAt, stdoutLength: stdout.length, stderrLength: stderr.length });
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || stdout || `${command} exited with code ${String(code)}`));
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

function domIdForMail(mailId: string): string {
  return `mail-${safeDomId(mailId)}`;
}

function domIdForThread(threadId: string): string {
  return `thread-${safeDomId(threadId)}`;
}

function domIdForThreadMessage(threadId: string, mailId: string): string {
  return `thread-message-${safeDomId(threadId)}-${safeDomId(mailId)}`;
}

function domIdForCategory(category: string): string {
  return `category-${safeDomId(category)}`;
}

function safeDomId(value: string): string {
  return String(value || "").replace(/[^A-Za-z0-9_-]/g, "-");
}

function selected(current: unknown, expected: unknown): string {
  return String(current ?? "") === String(expected) ? "selected" : "";
}

function serializeFolderDateMap(values: Record<string, string>): string {
  return Object.entries(values)
    .filter(([, value]) => value)
    .map(([folder, value]) => `${folder.replace(/[=;]/g, " ").trim()}=${value.replace(/;/g, " ").trim()}`)
    .join(";");
}

function getLocaleFromConfig(config: Record<string, unknown>): Locale {
  return config.outputLanguage === "zh-CN" ? "zh-CN" : "en-US";
}

function getLabels(locale: Locale): DashboardLabels {
  return LABELS[locale] || LABELS["zh-CN"];
}

function buildCategoryLabels(labels: DashboardLabels, promptConfig: PromptConfig, locale: Locale): Record<string, string> {
  const result: Record<string, string> = { ...labels.categories };
  for (const category of promptConfig.categories) {
    result[category.id] = locale === "en-US" ? category.labelEn : category.labelZh;
  }
  return result;
}

function formatClassification(classification: ReturnType<typeof classificationFor>): string {
  if (!classification) {
    return "-";
  }
  return `${classification.label} (${classification.level})`;
}

function formatGateStatus(decision: SecurityGateDecisionResult | undefined, fallbackManual: boolean, labels: DashboardLabels): string {
  if (decision?.decision === "block") {
    return labels.pending.gateBlocked;
  }
  if (decision?.decision === "manual_confirm" || fallbackManual) {
    return labels.pending.manualRequired;
  }
  return labels.pending.autoAllowed;
}

function formatThreadSecurity(security: ThreadStore["items"][number]["security"]): string {
  if (!security) {
    return "-";
  }
  return [
    `allow ${security.allowedMessages}`,
    `manual ${security.manualConfirmMessages}`,
    `block ${security.blockedMessages}`,
    security.partialContext ? "partial" : ""
  ].filter(Boolean).join(" / ");
}

function compareTimelineMessagesForDisplay(a: ThreadStore["items"][number]["timeline"][number], b: ThreadStore["items"][number]["timeline"][number]): number {
  const byTime = String(a.receivedTime || a.sentTime || "").localeCompare(String(b.receivedTime || b.sentTime || ""));
  if (byTime !== 0) {
    return byTime;
  }
  if (a.conversationIndex && b.conversationIndex && a.conversationIndex !== b.conversationIndex) {
    return a.conversationIndex.localeCompare(b.conversationIndex);
  }
  return a.mailId.localeCompare(b.mailId);
}

function mergeAnalysisResults(current: AnalysisResult, next: AnalysisResult, allowedCategories?: string[]): AnalysisResult {
  const byId = new Map<string, AnalysisResult["items"][number]>();
  for (const item of current.items || []) {
    byId.set(item.mailId, item);
  }
  for (const item of next.items || []) {
    byId.set(item.mailId, item);
  }
  const items = [...byId.values()];
  return normalizeAnalysis({
    generatedAt: new Date().toISOString(),
    language: next.language || current.language || "",
    overview: {},
    items
  }, allowedCategories);
}

function pruneAnalysisResult(analysis: AnalysisResult, retentionDays: number, allowedCategories?: string[], now: Date = new Date()): AnalysisResult {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return analysis;
  }
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return normalizeAnalysis({
    ...analysis,
    items: analysis.items.filter((item) => {
      const received = Date.parse(String(item.receivedTime || "").replace(" ", "T"));
      return !Number.isFinite(received) || received >= cutoff;
    })
  }, allowedCategories);
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

function mergeStringLists(a: string[], b: string[]): string[] {
  return [...new Set([...(a || []), ...(b || [])].map(String).map((item) => item.trim()).filter(Boolean))];
}

function buildSecuritySettings(config: Record<string, unknown>): SecurityGateSettings {
  return {
    enabled: true,
    autoAnalyzeEnabled: config.autoAnalyzeEnabled !== false,
    maxAutoClassificationLevel: Number(config.autoAnalyzeMaxClassificationLevel || 2),
    maxManualClassificationLevel: 2,
    hardBlockKeywords: ["password", "api_key", "access_token", "auth_token"],
    manualConfirmKeywords: []
  };
}

function buildDefaultRedactionPolicy(): RedactionPolicy {
  return {
    enabled: true,
    redactEmail: true,
    redactPhone: true,
    redactUrl: true,
    redactIp: true,
    redactToken: true,
    redactMoney: true,
    redactIdLike: true,
    customPatterns: []
  };
}

function buildMailSecurityDecisionMap(
  mails: StoredMail[],
  classifications: ClassificationCache,
  settings: SecurityGateSettings
): SecurityDecisionMap {
  const decisions: SecurityDecisionMap = new Map();
  for (const mail of mails) {
    decisions.set(mail.mailId, buildMailGateDecision(mail, classificationFor(mail.mailId, classifications) || fallbackClassification(mail.mailId), settings));
  }
  return decisions;
}

function canAnalyzeMail(mail: StoredMail, decisions: SecurityDecisionMap, explicitSelection: boolean): boolean {
  const decision = decisions.get(mail.mailId);
  if (!decision) {
    return true;
  }
  if (decision.decision === "block") {
    return false;
  }
  return explicitSelection || decision.decision === "allow";
}

function redactStoredMails(items: StoredMail[], policy: RedactionPolicy): { items: StoredMail[]; totalReplacements: number } {
  let totalReplacements = 0;
  return {
    items: items.map((item) => {
      const subject = redactText(item.subject, policy);
      const from = redactText(item.from, policy);
      const bodyExcerpt = redactText(item.bodyExcerpt, policy);
      totalReplacements += subject.stats.totalReplacements + from.stats.totalReplacements + bodyExcerpt.stats.totalReplacements;
      return {
        ...item,
        subject: subject.text,
        from: from.text,
        bodyExcerpt: bodyExcerpt.text
      };
    }),
    totalReplacements
  };
}

function redactThreadForPrompt(thread: ThreadStore["items"][number], policy: RedactionPolicy): ThreadStore["items"][number] {
  return {
    ...thread,
    subject: redactText(thread.subject, policy).text,
    participants: thread.participants.map((participant) => redactText(participant, policy).text),
    timeline: thread.timeline.map((message) => ({
      ...message,
      subject: redactText(message.subject, policy).text,
      from: redactText(message.from, policy).text,
      senderName: redactText(message.senderName, policy).text,
      senderEmail: redactText(message.senderEmail, policy).text,
      bodyPreview: redactText(message.bodyPreview, policy).text,
      bodyClean: redactText(message.bodyClean, policy).text,
      bodyDelta: redactText(message.bodyDelta, policy).text,
      attachmentNames: message.attachmentNames.map((name) => redactText(name, policy).text)
    }))
  };
}

function fallbackClassification(mailId: string): MailClassification {
  return {
    mailId,
    level: 1,
    label: "INTERNAL",
    source: "security-gate",
    reason: "Missing classification defaulted to INTERNAL.",
    updatedAt: new Date().toISOString()
  };
}

function mergeThreadAnalysisResults(current: ThreadAnalysisResult, next: ThreadAnalysisResult, allowedCategories?: string[]): ThreadAnalysisResult {
  const byId = new Map<string, ThreadAnalysisResult["items"][number]>();
  for (const item of current.items || []) {
    byId.set(item.threadId, item);
  }
  for (const item of next.items || []) {
    byId.set(item.threadId, item);
  }
  return normalizeThreadAnalysis({
    generatedAt: new Date().toISOString(),
    language: next.language || current.language || "",
    overview: {},
    items: [...byId.values()]
  }, allowedCategories);
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

function formatElapsedSeconds(elapsedMs: number): string {
  const seconds = Math.max(0, elapsedMs) / 1000;
  return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

async function deleteFileIfExists(filePath: string): Promise<void> {
  await fs.promises.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });
}

function sanitizeProcessArgs(args: string[]): string[] {
  return args.map((arg) => {
    if (arg.length > 180) {
      return `${arg.slice(0, 180)}...`;
    }
    return arg;
  });
}
