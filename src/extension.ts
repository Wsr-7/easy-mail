import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import * as cp from "node:child_process";
import { parseDigest, type DigestData } from "./lib/digest";
import { normalizeAnalysis, parseAnalysisJson, type AnalysisResult } from "./lib/analysis-schema";
import { buildQueueState, classificationFor, ensureClassifications, normalizeClassificationCache, type ClassificationCache } from "./lib/classification";
import { buildSummaryMarkdown } from "./lib/summary";
import { buildDashboardState, CATEGORY_ORDER, type DashboardState } from "./lib/dashboard-state";
import { allowedCategoryIds, composeAnalysisPrompt, normalizePromptConfig, type PromptConfig } from "./lib/prompt-config";
import { buildBatchDigestMarkdown, emptyMailIndex, emptyMailStore, mergeDigestIntoIndex, mergeDigestIntoStore, normalizeMailIndex, normalizeMailStore, pruneMailIndex, pruneMailStore, removeStoredMailByIds, type MailIndex, type MailStore, type StoredMail } from "./lib/mail-store";

type Locale = "zh-CN" | "en-US";

type BusyState = {
  label: string;
  detail: string;
  startedAt: string;
};

type DashboardLabels = {
  toolbar: Record<"pullMail" | "sample" | "analyze" | "analyzeSelected" | "analyzeAllAllowed" | "refresh" | "openDigest" | "openSummary" | "settingsFile" | "promptConfig" | "clearStore", string>;
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
    batchSize: string;
    autoAnalyze: string;
    maxClassification: string;
    storeRetentionDays: string;
    indexRetentionDays: string;
    analysisRetentionDays: string;
    importantSenders: string;
    save: string;
    recentHoursOption: string;
    maxItemsOption: string;
    zhOption: string;
    enOption: string;
  };
  meta: Record<"range" | "folders" | "generated" | "requestedModel" | "lastUsedModel" | "lastPull" | "lastImport", string>;
  stats: Record<"pulled" | "pending" | "analysed" | "blocked" | "mustHandle" | "risk" | "waiting" | "notice", string>;
  categories: Record<string, string>;
  card: Record<"from" | "received" | "summary" | "reason" | "suggestedAction" | "copyDraft" | "ignore" | "noItems", string>;
  pending: Record<"title" | "blockedTitle" | "classification" | "autoAllowed" | "manualRequired" | "select", string>;
  progress: Record<"pullMail" | "sampleDigest" | "analyze", string> & { detail: string };
  model: Record<"fallback" | "preferred", string>;
};

const LABELS: Record<Locale, DashboardLabels> = {
  "zh-CN": {
    toolbar: {
      pullMail: "拉取邮件",
      sample: "示例数据",
      analyze: "分析下一批",
      analyzeSelected: "分析选中",
      analyzeAllAllowed: "分析全部允许项",
      refresh: "刷新",
      openDigest: "打开邮件摘要",
      openSummary: "打开分析总结",
      settingsFile: "配置文件",
      promptConfig: "Prompt 分类配置",
      clearStore: "清理本地缓存"
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
      batchSize: "每批分析数量",
      autoAnalyze: "允许自动分析",
      maxClassification: "自动分析最高密级",
      storeRetentionDays: "原文缓存保留天数",
      indexRetentionDays: "去重索引保留天数",
      analysisRetentionDays: "分析摘要保留天数",
      importantSenders: "重点发件人/邮件组（用 ; 分隔）",
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
    pending: {
      title: "未分析邮件",
      blockedTitle: "需手动确认",
      classification: "密级",
      autoAllowed: "允许自动分析",
      manualRequired: "需要手动确认",
      select: "选择"
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
      analyze: "Analyze Next Batch",
      analyzeSelected: "Analyze Selected",
      analyzeAllAllowed: "Analyze All Allowed",
      refresh: "Refresh",
      openDigest: "Open Digest",
      openSummary: "Open Summary",
      settingsFile: "Settings File",
      promptConfig: "Prompt Config",
      clearStore: "Clear Local Cache"
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
      batchSize: "Batch Size",
      autoAnalyze: "Allow Auto Analysis",
      maxClassification: "Max Auto Classification",
      storeRetentionDays: "Raw Cache Retention Days",
      indexRetentionDays: "Index Retention Days",
      analysisRetentionDays: "Summary Retention Days",
      importantSenders: "Important senders/groups (; separated)",
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
    pending: {
      title: "Pending Mail",
      blockedTitle: "Manual Confirmation Required",
      classification: "Classification",
      autoAllowed: "Auto allowed",
      manualRequired: "Manual confirmation required",
      select: "Select"
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
    vscode.commands.registerCommand("emailAnalysis.analyzeAllAllowed", () => app.analyzeAllAllowed()),
    vscode.commands.registerCommand("emailAnalysis.refreshDashboard", () => app.refresh()),
    vscode.commands.registerCommand("emailAnalysis.openDigest", () => app.openDigest()),
    vscode.commands.registerCommand("emailAnalysis.openSummary", () => app.openSummary()),
    vscode.commands.registerCommand("emailAnalysis.openSettings", () => app.openSettings()),
    vscode.commands.registerCommand("emailAnalysis.openPromptConfig", () => app.openPromptConfig()),
    vscode.commands.registerCommand("emailAnalysis.clearLocalCache", () => app.clearLocalCache())
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
    const digest = parseDigest(await fs.promises.readFile(this.getDigestPath(), "utf8"));
    const currentIndex = pruneMailIndex(await this.readMailIndex(), Number(config.mailIndexRetentionDays || 7));
    const merge = mergeDigestIntoStore(await this.readMailStore(), digest, currentIndex.items.map((item) => item.mailId));
    const nextIndex = pruneMailIndex(mergeDigestIntoIndex(currentIndex, digest), Number(config.mailIndexRetentionDays || 7));
    const prunedStore = pruneMailStore(merge.store, Number(config.mailStoreRetentionDays || 1));
    await this.writeMailStore(prunedStore);
    await this.writeMailIndex(nextIndex);
    const classificationCache = ensureClassifications(prunedStore.items, await this.readClassificationCache());
    await this.writeClassificationCache(classificationCache);
    await this.refresh();
    await vscode.window.showInformationMessage(`Email digest generated. Added ${merge.added}, skipped ${merge.skipped}.`);
  }

  public async analyze(): Promise<void> {
    const locale = await this.readLocale();
    const labels = getLabels(locale);
    await this.runWithBusy(labels.progress.analyze, labels.progress.detail, async () => {
      await this.analyzeBatchCore();
    });
  }

  public async analyzeAllAllowed(): Promise<void> {
    const locale = await this.readLocale();
    const labels = getLabels(locale);
    await this.runWithBusy(labels.progress.analyze, labels.progress.detail, async () => {
      await this.analyzeBatchCore("allAllowed");
    });
  }

  private async analyzeSelected(mailIds: string[]): Promise<void> {
    const locale = await this.readLocale();
    const labels = getLabels(locale);
    await this.runWithBusy(labels.progress.analyze, labels.progress.detail, async () => {
      await this.analyzeBatchCore(mailIds);
    });
  }

  private async analyzeBatchCore(selection?: "allAllowed" | string[]): Promise<void> {
    const config = await this.readConfig();
    await this.importDigestIfStoreMissing();
    const store = await this.readMailStore();
    const index = pruneMailIndex(await this.readMailIndex(), Number(config.mailIndexRetentionDays || 7));
    await this.writeMailIndex(index);
    if (!store.items.length) {
      throw new Error("No pulled mail exists. Run Pull Mail first.");
    }
    const classificationCache = ensureClassifications(store.items, await this.readClassificationCache());
    await this.writeClassificationCache(classificationCache);
    const currentAnalysis = await this.readAnalysisResult();
    const ignoredIds = await this.readIgnoredIds();
    const queue = buildQueueState(
      store.items,
      currentAnalysis,
      ignoredIds,
      classificationCache,
      config.autoAnalyzeEnabled !== false,
      Number(config.autoAnalyzeMaxClassificationLevel || 2)
    );
    const batchSize = Number(config.analysisBatchSize || 5);
    const batch = Array.isArray(selection)
      ? store.items.filter((item) => selection.includes(item.mailId) && !ignoredIds.includes(item.mailId))
      : selection === "allAllowed"
        ? queue.allowed
        : queue.allowed.slice(0, batchSize);
    if (!batch.length) {
      throw new Error("No mail is available for analysis. Check pending mail or classification gates.");
    }

    const promptConfig = await this.readPromptConfig();
    promptConfig.importantSenders = mergeStringLists(promptConfig.importantSenders, parseFolders(config.importantSenders, []));
    const digestText = buildBatchDigestMarkdown(batch);
    const basePrompt = await fs.promises.readFile(path.join(this.context.extensionPath, "prompts", "base-system.md"), "utf8");
    const outputSchemaPrompt = await fs.promises.readFile(path.join(this.context.extensionPath, "prompts", "output-schema.md"), "utf8");
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

    const prompt = composeAnalysisPrompt({
      basePrompt,
      outputSchemaPrompt,
      digestText,
      outputLanguage: String(config.outputLanguage || "zh-CN"),
      promptConfig
    });
    const response = await selectedModel.sendRequest(
      [vscode.LanguageModelChatMessage.User(prompt)],
      {},
      new vscode.CancellationTokenSource().token
    );
    const raw = await readResponseText(response.text);
    const analysis = parseAnalysisJson(raw, allowedCategoryIds(promptConfig));

    const normalized = normalizeAnalysis(analysis, allowedCategoryIds(promptConfig));
    const merged = pruneAnalysisResult(
      mergeAnalysisResults(currentAnalysis, normalized, allowedCategoryIds(promptConfig)),
      Number(config.analysisRetentionDays || 7),
      allowedCategoryIds(promptConfig)
    );
    const summaryLabels = buildCategoryLabels(getLabels(getLocaleFromConfig(config)), promptConfig, getLocaleFromConfig(config));
    await fs.promises.writeFile(this.getAnalysisPath(), `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    await fs.promises.writeFile(this.getSummaryPath(), buildSummaryMarkdown(merged, summaryLabels), "utf8");
    await this.writeMailStore(removeStoredMailByIds(await this.readMailStore(), batch.map((item) => item.mailId)));
    await this.refresh();
    await vscode.window.showInformationMessage(`Email analysis completed for ${batch.length} mail(s).`);
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

  public async openPromptConfig(): Promise<void> {
    await openTextDocument(this.getPromptConfigPath());
  }

  public async clearLocalCache(): Promise<void> {
    await this.writeMailStore(emptyMailStore());
    await this.writeMailIndex(emptyMailIndex());
    await this.writeClassificationCache(normalizeClassificationCache({}));
    await fs.promises.writeFile(this.getAnalysisPath(), `${JSON.stringify({ generatedAt: "", overview: { totalMails: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 }, items: [] }, null, 2)}\n`, "utf8");
    await this.refresh();
    await vscode.window.showInformationMessage("Local email cache cleared.");
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

  private getMailStorePath(): string {
    return path.join(this.getDataDir(), "mail-store.json");
  }

  private getMailIndexPath(): string {
    return path.join(this.getDataDir(), "mail-index.json");
  }

  private getClassificationCachePath(): string {
    return path.join(this.getDataDir(), "classification-cache.json");
  }

  private getPromptConfigPath(): string {
    return path.join(this.context.globalStorageUri.fsPath, "prompt-config.json");
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
    await this.writeClassificationCache(ensureClassifications(merge.store.items, await this.readClassificationCache()));
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
    const promptConfig = await this.readPromptConfig();
    const analysis = await this.readAnalysisResult();
    const ignoredIds = await this.readIgnoredIds();
    const store = await this.readMailStore();
    const index = pruneMailIndex(await this.readMailIndex(), Number(config.mailIndexRetentionDays || 7));
    await this.writeMailIndex(index);
    const classifications = ensureClassifications(store.items, await this.readClassificationCache());
    await this.writeClassificationCache(classifications);
    const queue = buildQueueState(
      store.items,
      analysis,
      ignoredIds,
      classifications,
      config.autoAnalyzeEnabled !== false,
      Number(config.autoAnalyzeMaxClassificationLevel || 2)
    );
    const state = buildDashboardState(config, digest, analysis, ignoredIds, allowedCategoryIds(promptConfig)) as DashboardState & {
      modelInfo?: Record<string, unknown>;
      store?: MailStore;
      index?: MailIndex;
      queue?: ReturnType<typeof buildQueueState>;
      classifications?: ClassificationCache;
      promptConfig?: PromptConfig;
    };
    state.modelInfo = await this.readModelInfo();
    state.store = store;
    state.index = index;
    state.queue = queue;
    state.classifications = classifications;
    state.promptConfig = promptConfig;
    return state;
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== "object") {
      return;
    }

    const typed = message as { type?: string; draftReply?: string; mailId?: string; mailIds?: string[]; config?: unknown };
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

    if (typed.type === "analyzeAllAllowed") {
      await this.analyzeAllAllowed();
      return;
    }

    if (typed.type === "analyzeSelected") {
      await this.analyzeSelected(Array.isArray(typed.mailIds) ? typed.mailIds.map(String) : []);
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
      modelFamily: String(patch.modelFamily || current.modelFamily || "gpt-5.4").trim(),
      analysisBatchSize: positiveNumber(patch.analysisBatchSize, current.analysisBatchSize || 5),
      autoAnalyzeEnabled: patch.autoAnalyzeEnabled === true || patch.autoAnalyzeEnabled === "true",
      autoAnalyzeMaxClassificationLevel: positiveNumber(patch.autoAnalyzeMaxClassificationLevel, current.autoAnalyzeMaxClassificationLevel || 2),
      mailStoreRetentionDays: positiveNumber(patch.mailStoreRetentionDays, current.mailStoreRetentionDays || 1),
      mailIndexRetentionDays: positiveNumber(patch.mailIndexRetentionDays, current.mailIndexRetentionDays || 7),
      analysisRetentionDays: positiveNumber(patch.analysisRetentionDays, current.analysisRetentionDays || 7),
      importantSenders: parseFolders(patch.importantSenders, current.importantSenders || [])
    };
    await this.writeConfig(next);
    await vscode.window.showInformationMessage("Email Analysis settings saved.");
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
      promptConfig?: PromptConfig;
    };
    const locale = getLocaleFromConfig(config);
    const labels = getLabels(locale);
    const promptConfig = extendedState.promptConfig || normalizePromptConfig({});
    promptConfig.importantSenders = mergeStringLists(promptConfig.importantSenders, parseFolders(config.importantSenders, []));
    const categoryLabels = buildCategoryLabels(labels, promptConfig, locale);
    const rows = state.categories.map((entry) => renderCategory(entry.id, entry.items, labels, categoryLabels)).join("");
    const store = extendedState.store || emptyMailStore();
    const index = extendedState.index || emptyMailIndex();
    const queue = extendedState.queue || { pending: [], blocked: [], analysed: [], allowed: [] };
    const classifications = extendedState.classifications || normalizeClassificationCache({});
    const pendingHtml = renderPendingPanel(labels.pending.title, queue.pending, classifications, labels, queue.allowed, false);
    const blockedHtml = renderPendingPanel(labels.pending.blockedTitle, queue.blocked, classifications, labels, [], true);
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
    <button onclick="analyzeSelected()">${escapeHtml(labels.toolbar.analyzeSelected)}</button>
    <button onclick="post('analyzeAllAllowed')">${escapeHtml(labels.toolbar.analyzeAllAllowed)}</button>
    <button onclick="post('refresh')">${escapeHtml(labels.toolbar.refresh)}</button>
    <button class="secondary" onclick="post('openDigest')">${escapeHtml(labels.toolbar.openDigest)}</button>
    <button class="secondary" onclick="post('openSummary')">${escapeHtml(labels.toolbar.openSummary)}</button>
    <button class="ghost" onclick="post('openSettings')">${escapeHtml(labels.toolbar.settingsFile)}</button>
    <button class="ghost" onclick="post('openPromptConfig')">${escapeHtml(labels.toolbar.promptConfig)}</button>
    <button class="ghost" onclick="post('clearLocalCache')">${escapeHtml(labels.toolbar.clearStore)}</button>
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
      <label>${escapeHtml(labels.settings.batchSize)}
        <input id="analysisBatchSize" type="number" min="1" value="${escapeAttr(String(config.analysisBatchSize || 5))}" />
      </label>
      <label>${escapeHtml(labels.settings.maxClassification)}
        <input id="autoAnalyzeMaxClassificationLevel" type="number" min="0" max="3" value="${escapeAttr(String(config.autoAnalyzeMaxClassificationLevel || 2))}" />
      </label>
      <label>${escapeHtml(labels.settings.storeRetentionDays)}
        <input id="mailStoreRetentionDays" type="number" min="1" value="${escapeAttr(String(config.mailStoreRetentionDays || 1))}" />
      </label>
      <label>${escapeHtml(labels.settings.indexRetentionDays)}
        <input id="mailIndexRetentionDays" type="number" min="1" value="${escapeAttr(String(config.mailIndexRetentionDays || 7))}" />
      </label>
      <label>${escapeHtml(labels.settings.analysisRetentionDays)}
        <input id="analysisRetentionDays" type="number" min="1" value="${escapeAttr(String(config.analysisRetentionDays || 7))}" />
      </label>
      <label>${escapeHtml(labels.settings.importantSenders)}
        <input id="importantSenders" value="${escapeAttr(Array.isArray(config.importantSenders) ? config.importantSenders.join(";") : "")}" />
      </label>
      <label>${escapeHtml(labels.settings.autoAnalyze)}
        <select id="autoAnalyzeEnabled">
          <option value="true" ${selected(config.autoAnalyzeEnabled, true)}>${escapeHtml(labels.pending.autoAllowed)}</option>
          <option value="false" ${selected(config.autoAnalyzeEnabled, false)}>${escapeHtml(labels.pending.manualRequired)}</option>
        </select>
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
    <div><strong>${escapeHtml(labels.meta.lastPull)}:</strong> ${escapeHtml(store.lastPullAt || "-")}</div>
    <div><strong>${escapeHtml(labels.meta.requestedModel)}:</strong> ${escapeHtml(String(config.modelFamily || "gpt-5.4"))}</div>
    <div><strong>${escapeHtml(labels.meta.lastUsedModel)}:</strong> ${escapeHtml(formatModelInfo(modelInfo, labels))}</div>
  </div>
  <div class="stats">
    ${renderStat(labels.stats.pulled, index.items.length)}
    ${renderStat(labels.stats.pending, queue.pending.length)}
    ${renderStat(labels.stats.analysed, queue.analysed.length)}
    ${renderStat(labels.stats.blocked, queue.blocked.length)}
    ${renderStat(labels.stats.mustHandle, state.overview.mustHandleToday)}
    ${renderStat(labels.stats.risk, state.overview.risks)}
    ${renderStat(labels.stats.waiting, state.overview.waitingForMe)}
    ${renderStat(labels.stats.notice, state.overview.notices)}
  </div>
  ${pendingHtml}
  ${blockedHtml}
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
          modelFamily: document.getElementById('modelFamily').value,
          analysisBatchSize: document.getElementById('analysisBatchSize').value,
          autoAnalyzeEnabled: document.getElementById('autoAnalyzeEnabled').value,
          autoAnalyzeMaxClassificationLevel: document.getElementById('autoAnalyzeMaxClassificationLevel').value,
          mailStoreRetentionDays: document.getElementById('mailStoreRetentionDays').value,
          mailIndexRetentionDays: document.getElementById('mailIndexRetentionDays').value,
          analysisRetentionDays: document.getElementById('analysisRetentionDays').value,
          importantSenders: document.getElementById('importantSenders').value
        }
      });
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

function renderStat(label: string, value: number | undefined): string {
  return `<div class="stat"><div>${escapeHtml(label)}</div><div class="value">${escapeHtml(String(value || 0))}</div></div>`;
}

function renderCategory(category: string, items: AnalysisResult["items"], labels: DashboardLabels, categoryLabels: Record<string, string>): string {
  const cards = items.length ? items.map((item) => renderCard(item, labels)).join("") : `<div class="empty">${escapeHtml(labels.card.noItems)}</div>`;
  const open = category === "mustHandleToday" ? " open" : "";
  return `<details class="category"${open}><summary>${escapeHtml(categoryLabels[category] || labels.categories[category] || category)} (${items.length})</summary><div class="category-body">${cards}</div></details>`;
}

function renderPendingPanel(
  title: string,
  items: StoredMail[],
  classifications: ClassificationCache,
  labels: DashboardLabels,
  allowedItems: StoredMail[],
  blocked: boolean
): string {
  const allowed = new Set(allowedItems.map((item) => item.mailId));
  const cards = items.length ? items.map((item) => {
    const classification = classificationFor(item.mailId, classifications);
    const status = blocked || !allowed.has(item.mailId) ? labels.pending.manualRequired : labels.pending.autoAllowed;
    return `<article class="card pending-card">
      <div class="header">
        <label class="select-row"><input type="checkbox" data-mail-id="${escapeAttr(item.mailId)}" /> ${escapeHtml(labels.pending.select)}</label>
        <div class="badge">${escapeHtml(status)}</div>
      </div>
      <div class="title">${escapeHtml(item.subject || item.mailId)}</div>
      <div><strong>${escapeHtml(labels.card.from)}:</strong> ${escapeHtml(item.from || "-")}</div>
      <div><strong>${escapeHtml(labels.card.received)}:</strong> ${escapeHtml(item.receivedTime || "-")}</div>
      <div><strong>${escapeHtml(labels.pending.classification)}:</strong> ${escapeHtml(formatClassification(classification))}</div>
    </article>`;
  }).join("") : `<div class="empty">${escapeHtml(labels.card.noItems)}</div>`;
  return `<details class="category"${blocked ? "" : " open"}><summary>${escapeHtml(title)} (${items.length})</summary><div class="category-body">${cards}</div></details>`;
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

function runProcess(command: string, args: string[], timeoutMs = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
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
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
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

function selected(current: unknown, expected: unknown): string {
  return String(current ?? "") === String(expected) ? "selected" : "";
}

function getLocaleFromConfig(config: Record<string, unknown>): Locale {
  return config.outputLanguage === "en-US" ? "en-US" : "zh-CN";
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
