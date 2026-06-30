import { positiveNumber, parseFolders } from "./config-utils";

export interface MessageHandlerContext {
  log: (event: string, data: Record<string, unknown>) => Promise<void>;
  readLocale: () => Promise<string>;
  readConfig: () => Promise<Record<string, any>>;
  updateSettings: (next: Record<string, unknown>) => Promise<void>;
  refresh: () => Promise<void>;
  copyToClipboard: (text: string) => Promise<void>;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
  readIgnoredIds: () => Promise<string[]>;
  writeIgnoredIds: (ids: string[]) => Promise<void>;
  openMailInOutlook: (mailId: string) => Promise<void>;
  openGuide: () => Promise<void>;
  openDigest: () => Promise<void>;
  openSummary: () => Promise<void>;
  generateReports: () => Promise<void>;
  loadModels: () => Promise<void>;
  changeOutputLanguage: (locale: string) => Promise<void>;
  openDailyBrief: () => Promise<void>;
  openThreadReport: () => Promise<void>;
  openSingleMailReport: () => Promise<void>;
  pullMail: (forceSample: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  analyze: () => Promise<void>;
  analyzeAllAllowed: () => Promise<void>;
  analyzeSelected: (mailIds: string[]) => Promise<void>;
  analyzeThread: (threadId: string) => Promise<void>;
  openSettings: () => Promise<void>;
  openPromptConfig: () => Promise<void>;
  clearLocalCache: () => Promise<void>;
  openWorkbench: () => Promise<void>;
}

export async function handleWebviewMessage(ctx: MessageHandlerContext, message: unknown): Promise<void> {
  if (!message || typeof message !== "object") {
    return;
  }

  const typed = message as { type?: string; draftReply?: string; mailId?: string; mailIds?: string[]; threadId?: string; config?: unknown; silent?: boolean };
  await ctx.log("message:received", {
    type: typed.type || "",
    mailId: typed.mailId || "",
    mailIds: Array.isArray(typed.mailIds) ? typed.mailIds.length : 0,
    threadId: typed.threadId || ""
  });
  if (typed.type === "copyDraft") {
    const draftReply = String(typed.draftReply || "");
    if (!draftReply.trim()) {
      ctx.showWarning("No draft reply is available for this mail.");
      return;
    }
    await ctx.copyToClipboard(draftReply);
    ctx.showInfo("Draft reply copied.");
    return;
  }

  if (typed.type === "ignore") {
    const ignoredIds = await ctx.readIgnoredIds();
    if (typed.mailId && !ignoredIds.includes(typed.mailId)) {
      ignoredIds.push(typed.mailId);
      await ctx.writeIgnoredIds(ignoredIds);
    }
    await ctx.log("ignore:done", { mailId: typed.mailId || "", ignoredCount: ignoredIds.length });
    const locale = await ctx.readLocale();
    ctx.showInfo(locale === "zh-CN" ? "邮件已忽略。" : "Mail ignored.");
    await ctx.refresh();
    return;
  }

  if (typed.type === "unignore") {
    const ignoredIds = await ctx.readIgnoredIds();
    const updated = ignoredIds.filter((id) => id !== typed.mailId);
    await ctx.writeIgnoredIds(updated);
    await ctx.log("unignore:done", { mailId: typed.mailId || "", ignoredCount: updated.length });
    const locale = await ctx.readLocale();
    ctx.showInfo(locale === "zh-CN" ? "邮件已恢复。" : "Mail restored.");
    await ctx.refresh();
    return;
  }

  if (typed.type === "openInOutlook" && typed.mailId) {
    await ctx.openMailInOutlook(String(typed.mailId));
    return;
  }

  if (typed.type === "refresh") {
    await ctx.refresh();
    return;
  }

  if (typed.type === "openGuide") {
    await ctx.openGuide();
    return;
  }

  if (typed.type === "openWalkthrough") {
    await ctx.openGuide();
    return;
  }

  if (typed.type === "openDigest") {
    await ctx.openDigest();
    return;
  }

  if (typed.type === "openSummary") {
    await ctx.openSummary();
    return;
  }

  if (typed.type === "generateReports") {
    await ctx.generateReports();
    return;
  }

  if (typed.type === "loadModels") {
    await ctx.loadModels();
    return;
  }

  if (typed.type === "requestLanguageChange") {
    const requested = (typed.config && typeof typed.config === "object" && (typed.config as Record<string, unknown>).outputLanguage === "zh-CN") ? "zh-CN" : "en-US";
    await ctx.changeOutputLanguage(requested);
    return;
  }

  if (typed.type === "openDailyBrief") {
    await ctx.openDailyBrief();
    return;
  }

  if (typed.type === "openThreadReport") {
    await ctx.openThreadReport();
    return;
  }

  if (typed.type === "openSingleMailReport") {
    await ctx.openSingleMailReport();
    return;
  }

  if (typed.type === "pullMail") {
    await ctx.pullMail(false);
    return;
  }

  if (typed.type === "loadMore") {
    await ctx.loadMore();
    return;
  }

  if (typed.type === "sampleDigest") {
    await ctx.pullMail(true);
    return;
  }

  if (typed.type === "analyze") {
    await ctx.analyze();
    return;
  }

  if (typed.type === "analyzeAllAllowed") {
    await ctx.analyzeAllAllowed();
    return;
  }

  if (typed.type === "analyzeSelected") {
    await ctx.analyzeSelected(Array.isArray(typed.mailIds) ? typed.mailIds.map(String) : []);
    return;
  }

  if (typed.type === "analyzeThread" && typed.threadId) {
    await ctx.analyzeThread(String(typed.threadId));
    return;
  }

  if (typed.type === "openSettings") {
    await ctx.openSettings();
    return;
  }

  if (typed.type === "openPromptConfig") {
    await ctx.openPromptConfig();
    return;
  }

  if (typed.type === "clearLocalCache") {
    await ctx.clearLocalCache();
    return;
  }

  if (typed.type === "openWorkbench") {
    await ctx.openWorkbench();
    return;
  }

  if (typed.type === "saveConfig") {
    await saveConfigFromMessage(ctx, typed);
    await ctx.refresh();
  }
}

export async function saveConfigFromMessage(
  ctx: Pick<MessageHandlerContext, "readConfig" | "updateSettings" | "showInfo">,
  message: { config?: unknown; silent?: boolean }
): Promise<void> {
  if (!message.config || typeof message.config !== "object") {
    return;
  }

  const current = await ctx.readConfig();
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
  await ctx.updateSettings(next);
  if (!message.silent) {
    ctx.showInfo("Easy Mail settings saved to VS Code Settings.");
  }
}
