import type { AnalysisResult } from "./analysis-schema";
import { classificationFor } from "./classification";
import { getLocaleFromConfig, mergeStringLists, parseFolders } from "./config-utils";
import { getLabels, buildCategoryLabels, type DashboardLabels } from "./dashboard-labels";
import { filterVisibleThreadsForDashboard, buildThreadLookup, compareTimelineMessagesForDisplay } from "./dashboard-state";
import { escapeHtml, escapeAttr } from "./html-utils";
import { selectConfiguredModel } from "./llm-provider";
import type { StoredMail } from "./mail-store";
import { normalizePromptConfig } from "./prompt-config";
import { normalizeClassificationCache } from "./classification";
import type { SecurityGateDecisionResult } from "./security-types";
import { emptyThreadStore, type ThreadStore } from "./thread-store";
import type { ThreadAnalysisResult } from "./thread-analysis-schema";
import { renderButtonSpinner, formatClassification, formatThreadSecurity, formatPriority, renderDraftBox, type DashboardRenderInput } from "./dashboard-render";

const QUEUE_ORDER = [
  "pending", "blocked",
  "mustHandleToday", "risk", "waitingForMe", "followUp",
  "importantSender", "notice", "threads", "ignored", "uncertain"
] as const;

function queueLabel(queueId: string, labels: DashboardLabels, categoryLabels: Record<string, string>): string {
  if (queueId === "pending") return labels.pending.title;
  if (queueId === "blocked") return labels.pending.blockedTitle;
  if (queueId === "threads") return labels.threads.title;
  return categoryLabels[queueId] || labels.categories[queueId] || queueId;
}

function ignoreOrRestore(queue: string, mailId: string, labels: DashboardLabels): string {
  if (queue === "ignored") {
    return `<button class="wb-btn ghost" data-action="unignore" data-mail-id="${escapeAttr(mailId)}">${escapeHtml(labels.card.restore)}</button>`;
  }
  return `<button class="wb-btn ghost" data-action="ignore" data-mail-id="${escapeAttr(mailId)}">${escapeHtml(labels.card.ignore)}</button>`;
}

function renderMailDetail(item: StoredMail, queue: string, labels: DashboardLabels, extra: string): string {
  return `<div class="wb-detail-card">
    <h3>${escapeHtml(item.subject || item.mailId)}</h3>
    <div class="wb-meta-grid">
      <div class="wb-field"><strong>${escapeHtml(labels.card.from)}:</strong> ${escapeHtml(item.from || "-")}</div>
      <div class="wb-field"><strong>${escapeHtml(labels.card.received)}:</strong> ${escapeHtml(item.receivedTime || "-")}</div>
      ${extra}
    </div>
    <div class="wb-body">${escapeHtml(item.bodyExcerpt || "")}</div>
    <div class="wb-actions">
      <button class="wb-btn" data-action="openInOutlook" data-mail-id="${escapeAttr(item.mailId)}">${escapeHtml(labels.card.openInOutlook)}</button>
      ${ignoreOrRestore(queue, item.mailId, labels)}
    </div>
  </div>`;
}

function renderAnalysisDetail(item: AnalysisResult["items"][number], queue: string, labels: DashboardLabels, threadId: string): string {
  const priority = formatPriority(item.priority, labels);
  const draftHtml = item.draftReply ? renderDraftBox(item.draftReply) : "";
  const threadLink = threadId
    ? `<div class="wb-field"><strong>${escapeHtml(labels.card.thread)}:</strong> <a href="#" onclick="filterQueue('threads');return false;">${escapeHtml(threadId)}</a></div>`
    : "";
  return `<div class="wb-detail-card">
    <div class="wb-detail-header">
      <h3>${escapeHtml(item.subject || item.mailId)}</h3>
      <span class="wb-priority">${escapeHtml(priority)}</span>
    </div>
    <div class="wb-meta-grid">
      <div class="wb-field"><strong>${escapeHtml(labels.card.from)}:</strong> ${escapeHtml(item.sender || "-")}</div>
      <div class="wb-field"><strong>${escapeHtml(labels.card.received)}:</strong> ${escapeHtml(item.receivedTime || "-")}</div>
    </div>
    <div class="wb-section">
      <div class="wb-field"><strong>${escapeHtml(labels.card.summary)}:</strong></div>
      <div class="wb-section-body">${escapeHtml(item.summary || "-")}</div>
    </div>
    <div class="wb-section">
      <div class="wb-field"><strong>${escapeHtml(labels.card.reason)}:</strong></div>
      <div class="wb-section-body">${escapeHtml(item.reason || "-")}</div>
    </div>
    <div class="wb-section">
      <div class="wb-field"><strong>${escapeHtml(labels.card.suggestedAction)}:</strong></div>
      <div class="wb-section-body">${escapeHtml(item.suggestedAction || "-")}</div>
    </div>
    ${threadLink}
    ${draftHtml}
    <div class="wb-actions">
      <button class="wb-btn" data-action="openInOutlook" data-mail-id="${escapeAttr(item.mailId)}">${escapeHtml(labels.card.openInOutlook)}</button>
      ${ignoreOrRestore(queue, item.mailId, labels)}
    </div>
  </div>`;
}

function renderThreadDetail(
  thread: ThreadStore["items"][number],
  labels: DashboardLabels,
  analysis: ThreadAnalysisResult["items"][number] | undefined,
  busyKind: string
): string {
  const timelineItems = [...(thread.timeline || [])].sort(compareTimelineMessagesForDisplay);
  const timeline = timelineItems.map((msg) =>
    `<div class="wb-tl-item">
      <div class="wb-tl-head">
        <strong>${escapeHtml(msg.from || msg.senderEmail || "")}</strong>
        <span class="wb-tl-time">${escapeHtml(msg.receivedTime || msg.sentTime || "")}</span>
      </div>
      <div class="wb-tl-body">${escapeHtml(msg.bodyDelta || msg.bodyPreview || "")}</div>
    </div>`
  ).join("");

  const analysisHtml = analysis ? `
    <div class="wb-thread-analysis">
      <h4>${escapeHtml(labels.threads.currentStatus)}</h4>
      <div class="wb-section-body">${escapeHtml(analysis.currentStatus || analysis.oneLineSummary || "-")}</div>
      ${analysis.actionItems.length ? `<h4>${escapeHtml(labels.threads.actionItems)}</h4><ul class="wb-ul">${analysis.actionItems.map((a) => `<li>${escapeHtml([a.owner, a.task, a.deadline].filter(Boolean).join(": "))}</li>`).join("")}</ul>` : ""}
      ${analysis.risks?.length ? `<h4>${escapeHtml(labels.threads.risks)}</h4><ul class="wb-ul">${analysis.risks.map((r) => `<li><span class="wb-risk-level">${escapeHtml(r.level)}</span> ${escapeHtml(r.description)}</li>`).join("")}</ul>` : ""}
      ${analysis.draftReply ? renderDraftBox(analysis.draftReply) : ""}
    </div>` : "";

  return `<div class="wb-detail-card">
    <h3>${escapeHtml(thread.subject || thread.threadId)}</h3>
    <div class="wb-meta-grid">
      <div class="wb-field"><strong>${escapeHtml(labels.threads.participants)}:</strong> ${escapeHtml(thread.participants.join(", ") || "-")}</div>
      <div class="wb-field"><strong>${escapeHtml(labels.threads.lastTime)}:</strong> ${escapeHtml(thread.lastTime || "-")}</div>
      <div class="wb-field"><strong>${escapeHtml(labels.threads.security)}:</strong> ${escapeHtml(formatThreadSecurity(thread.security))}</div>
    </div>
    <div class="wb-actions">
      <button class="wb-btn${busyKind === "analyzeThread" ? " is-busy" : ""}" data-action="analyzeThread" data-thread-id="${escapeAttr(thread.threadId)}"${busyKind ? " disabled" : ""}>${escapeHtml(labels.threads.analyzeThread)}${renderButtonSpinner(busyKind === "analyzeThread")}</button>
    </div>
    ${analysisHtml}
    ${timelineItems.length ? `<div class="wb-timeline-section"><h4>${escapeHtml(labels.threads.timeline)} (${timelineItems.length})</h4>${timeline}</div>` : ""}
  </div>`;
}

export function renderWorkbenchHtml(input: DashboardRenderInput): string {
  const { state, store, availableModels, busyKind, isBusy } = input;
  const config = state.config as Record<string, unknown>;
  const locale = getLocaleFromConfig(config);
  const labels = getLabels(locale);
  const promptConfig = input.promptConfig || normalizePromptConfig({});
  promptConfig.importantSenders = mergeStringLists(promptConfig.importantSenders, parseFolders(config.importantSenders, []));
  const categoryLabels = buildCategoryLabels(labels, promptConfig, locale);
  const threadStore = input.threadStore || emptyThreadStore();
  const visibleThreadStore = filterVisibleThreadsForDashboard(threadStore);
  const threadAnalysis = input.threadAnalysis || { generatedAt: "", overview: { totalThreads: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 }, items: [] };
  const threadByMailId = buildThreadLookup(visibleThreadStore);
  const queue = input.queue || { pending: [], blocked: [], analysed: [], allowed: [], ignoredPending: [] };
  const classifications = input.classifications || normalizeClassificationCache({});
  const securityDecisions = input.securityDecisions || new Map<string, SecurityGateDecisionResult>();
  const configuredModel = String(config.modelFamily || "");
  const canAnalyze = !!selectConfiguredModel(availableModels, configuredModel);
  const busyDisabled = isBusy ? " disabled" : "";
  const analysisDisabled = canAnalyze && !isBusy ? "" : " disabled";
  const analysisByThreadId = new Map((threadAnalysis.items || []).map((item) => [item.threadId, item]));

  const queueCounts: Record<string, number> = {};
  for (const cat of state.categories) { queueCounts[cat.id] = cat.items.length; }
  queueCounts["pending"] = queue.pending.length;
  queueCounts["blocked"] = queue.blocked.length;
  queueCounts["threads"] = visibleThreadStore.items.length;
  queueCounts["ignored"] = (queueCounts["ignored"] || 0) + (queue.ignoredPending?.length || 0);

  const activeQueues = QUEUE_ORDER.filter((q) => (queueCounts[q] || 0) > 0);
  const defaultQueue = activeQueues[0] || "pending";

  const queueTabs = QUEUE_ORDER.map((q) => {
    const count = queueCounts[q] || 0;
    if (count === 0) return "";
    return `<button class="wb-tab${q === defaultQueue ? " active" : ""}" data-queue-id="${escapeAttr(q)}" onclick="filterQueue('${escapeAttr(q)}')">${escapeHtml(queueLabel(q, labels, categoryLabels))} <span class="wb-tab-count">${count}</span></button>`;
  }).filter(Boolean).join("");

  const listData: string[] = [];
  const detailData: string[] = [];

  for (const item of queue.pending) {
    const classification = classificationFor(item.mailId, classifications);
    const extra = `<div class="wb-field"><strong>${escapeHtml(labels.pending.classification)}:</strong> ${escapeHtml(formatClassification(classification))}</div>`;
    listData.push(`<div class="wb-item" data-queue="pending" data-id="${escapeAttr(item.mailId)}" onclick="selectItem(this)">
      <div class="wb-item-subject">${escapeHtml(item.subject || item.mailId)}</div>
      <div class="wb-item-from">${escapeHtml(item.from || "")}</div>
    </div>`);
    detailData.push(`<div class="wb-reader" data-id="${escapeAttr(item.mailId)}">${renderMailDetail(item, "pending", labels, extra)}</div>`);
  }

  for (const item of queue.blocked) {
    const classification = classificationFor(item.mailId, classifications);
    const gateDecision = securityDecisions.get(item.mailId);
    const extra = `<div class="wb-field"><strong>${escapeHtml(labels.pending.classification)}:</strong> ${escapeHtml(formatClassification(classification))}</div>
      <div class="wb-field wb-warn"><strong>${escapeHtml(labels.pending.gateBlocked)}:</strong> ${escapeHtml(gateDecision?.reasons.join("; ") || "-")}</div>`;
    listData.push(`<div class="wb-item" data-queue="blocked" data-id="${escapeAttr(item.mailId)}" onclick="selectItem(this)">
      <div class="wb-item-subject">${escapeHtml(item.subject || item.mailId)}</div>
      <div class="wb-item-from">${escapeHtml(item.from || "")}</div>
    </div>`);
    detailData.push(`<div class="wb-reader" data-id="${escapeAttr(item.mailId)}">${renderMailDetail(item, "blocked", labels, extra)}</div>`);
  }

  for (const cat of state.categories) {
    for (const item of cat.items) {
      const threadId = threadByMailId.get(item.mailId) || "";
      listData.push(`<div class="wb-item" data-queue="${escapeAttr(cat.id)}" data-id="${escapeAttr(item.mailId)}" onclick="selectItem(this)">
        <div class="wb-item-subject">${escapeHtml(item.subject || item.mailId)}</div>
        <div class="wb-item-line2"><span class="wb-item-from">${escapeHtml(item.sender || "")}</span><span class="wb-item-badge">${escapeHtml(formatPriority(item.priority, labels))}</span></div>
      </div>`);
      detailData.push(`<div class="wb-reader" data-id="${escapeAttr(item.mailId)}">${renderAnalysisDetail(item, cat.id, labels, threadId)}</div>`);
    }
  }

  for (const item of (queue.ignoredPending || [])) {
    listData.push(`<div class="wb-item" data-queue="ignored" data-id="${escapeAttr(item.mailId)}" onclick="selectItem(this)">
      <div class="wb-item-subject">${escapeHtml(item.subject || item.mailId)}</div>
      <div class="wb-item-from">${escapeHtml(item.from || "")}</div>
    </div>`);
    detailData.push(`<div class="wb-reader" data-id="${escapeAttr(item.mailId)}">${renderMailDetail(item, "ignored", labels, "")}</div>`);
  }

  const sortedThreads = [...(visibleThreadStore.items || [])].sort((a, b) => String(b.lastTime || "").localeCompare(String(a.lastTime || "")));
  for (const thread of sortedThreads) {
    listData.push(`<div class="wb-item" data-queue="threads" data-id="${escapeAttr(thread.threadId)}" onclick="selectItem(this)">
      <div class="wb-item-subject">${escapeHtml(thread.subject || thread.threadId)}</div>
      <div class="wb-item-line2"><span class="wb-item-from">${escapeHtml(thread.participants.slice(0, 2).join(", "))}</span><span class="wb-item-badge">${thread.messageCount}</span></div>
    </div>`);
    detailData.push(`<div class="wb-reader" data-id="${escapeAttr(thread.threadId)}">${renderThreadDetail(thread, labels, analysisByThreadId.get(thread.threadId), busyKind)}</div>`);
  }

  const statusText = isBusy
    ? `<span class="wb-dot busy"></span> ${escapeHtml(busyKind)}`
    : `<span class="wb-dot idle"></span> Idle`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; }
  body {
    font-family: var(--vscode-font-family, "Segoe UI", sans-serif);
    font-size: var(--vscode-font-size, 13px);
    color: var(--vscode-editor-foreground, #ccc);
    background: var(--vscode-editor-background, #1e1e1e);
    display: flex; flex-direction: column;
  }
  button { font-family: inherit; font-size: inherit; cursor: pointer; border: none; }
  a { color: var(--vscode-textLink-foreground, #3794ff); text-decoration: none; }

  /* ── Top bar ── */
  .wb-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 12px; flex-shrink: 0;
    border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.2));
  }
  .wb-status { display: flex; align-items: center; gap: 5px; font-size: 11px; opacity: 0.6; }
  .wb-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
  .wb-dot.idle { background: var(--vscode-charts-green, #4ec9b0); }
  .wb-dot.busy { background: var(--vscode-charts-yellow, #cca700); animation: pulse 1.2s infinite; }
  @keyframes pulse { 50% { opacity: 0.4; } }
  .wb-spacer { flex: 1; }
  .wb-act {
    padding: 5px 14px; border-radius: 4px; font-size: 12px; font-weight: 500;
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #fff);
    border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
    display: inline-flex; align-items: center; gap: 5px;
    transition: background 0.15s, transform 0.1s;
  }
  .wb-act:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
  .wb-act:active:not(:disabled) { transform: scale(0.97); }
  .wb-act:disabled { opacity: 0.35; cursor: not-allowed; }
  .button-spinner { width: 10px; height: 10px; border: 2px solid var(--vscode-widget-border, rgba(128,128,128,0.3)); border-top-color: var(--vscode-foreground, #fff); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Two-column layout ── */
  .wb-cols { display: flex; flex: 1; overflow: hidden; }

  /* Left: tabs + list */
  .wb-left {
    width: 300px; min-width: 220px; flex-shrink: 0;
    display: flex; flex-direction: column;
    border-right: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.2));
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
  }
  .wb-tabs {
    display: flex; flex-wrap: wrap; gap: 2px;
    padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.15));
  }
  .wb-tab {
    padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;
    background: transparent;
    color: var(--vscode-sideBar-foreground, var(--vscode-foreground, #ccc));
    opacity: 0.6; white-space: nowrap; transition: background 0.15s, opacity 0.15s;
  }
  .wb-tab:hover { opacity: 1; background: var(--vscode-list-hoverBackground, var(--vscode-widget-border, rgba(128,128,128,0.15))); }
  .wb-tab.active {
    opacity: 1;
    background: var(--vscode-list-activeSelectionBackground, #094771);
    color: var(--vscode-list-activeSelectionForeground, #fff);
  }
  .wb-tab-count { font-size: 10px; opacity: 0.7; }
  .wb-items { flex: 1; overflow-y: auto; }
  .wb-item {
    padding: 8px 12px; cursor: pointer;
    border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.06));
  }
  .wb-item:hover { background: var(--vscode-list-hoverBackground, var(--vscode-list-hoverBackground, rgba(128,128,128,0.08))); }
  .wb-item.active { background: var(--vscode-list-activeSelectionBackground, #094771); color: var(--vscode-list-activeSelectionForeground, #fff); }
  .wb-item[hidden] { display: none; }
  .wb-item-subject { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wb-item-from { font-size: 11px; opacity: 0.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wb-item-line2 { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }
  .wb-item-badge { font-size: 10px; padding: 0 5px; border-radius: 6px; background: var(--vscode-badge-background, #4d4d4d); color: var(--vscode-badge-foreground, #fff); flex-shrink: 0; }
  .wb-empty { padding: 24px 12px; text-align: center; opacity: 0.4; font-size: 12px; }

  /* Right: reading pane */
  .wb-right { flex: 1; overflow-y: auto; }
  .wb-reader { display: none; }
  .wb-reader.active { display: block; }
  .wb-placeholder { display: flex; align-items: center; justify-content: center; height: 100%; opacity: 0.3; font-size: 14px; }

  /* Detail card styles */
  .wb-detail-card { padding: 24px 28px; max-width: 800px; }
  .wb-detail-card h3 { font-size: 17px; line-height: 1.4; margin-bottom: 4px; font-weight: 600; }
  .wb-detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
  .wb-detail-header h3 { flex: 1; }
  .wb-priority { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: var(--vscode-badge-background, #4d4d4d); color: var(--vscode-badge-foreground, #fff); white-space: nowrap; flex-shrink: 0; margin-top: 4px; }
  .wb-meta-grid { display: flex; flex-wrap: wrap; gap: 4px 20px; padding: 8px 0; border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.12)); margin-bottom: 12px; }
  .wb-field { font-size: 12px; line-height: 1.6; }
  .wb-warn { color: var(--vscode-errorForeground, #f48771); }
  .wb-section { margin-bottom: 12px; }
  .wb-section-body { font-size: 13px; line-height: 1.6; padding: 4px 0; opacity: 0.9; }
  .wb-body { font-size: 12px; line-height: 1.7; white-space: pre-wrap; padding: 12px 14px; margin: 8px 0; background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.08)); border-radius: 4px; border-left: 3px solid var(--vscode-focusBorder, #007fd4); max-height: 400px; overflow-y: auto; }
  .wb-actions { display: flex; gap: 8px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.12)); flex-wrap: wrap; }
  .wb-btn { padding: 5px 14px; border-radius: 4px; font-size: 12px; font-weight: 500; background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); display: inline-flex; align-items: center; gap: 6px; transition: background 0.15s, transform 0.1s; }
  .wb-btn:hover:not(:disabled) { background: var(--vscode-button-hoverBackground, #1177bb); }
  .wb-btn:active:not(:disabled) { transform: scale(0.97); }
  .wb-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .wb-btn.ghost { background: transparent; color: var(--vscode-button-secondaryForeground, #fff); border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15)); }
  .wb-btn.ghost:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
  .wb-btn.is-busy { gap: 6px; }

  /* Thread analysis */
  .wb-thread-analysis { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.12)); }
  .wb-thread-analysis h4 { font-size: 12px; font-weight: 600; margin: 12px 0 4px 0; opacity: 0.8; }
  .wb-thread-analysis h4:first-child { margin-top: 0; }
  .wb-ul { margin: 4px 0 4px 20px; font-size: 13px; }
  .wb-ul li { padding: 2px 0; line-height: 1.5; }
  .wb-risk-level { font-size: 10px; padding: 1px 5px; border-radius: 6px; background: var(--vscode-badge-background, #4d4d4d); color: var(--vscode-badge-foreground, #fff); text-transform: uppercase; margin-right: 4px; }

  /* Timeline */
  .wb-timeline-section { margin-top: 20px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.12)); }
  .wb-timeline-section > h4 { font-size: 13px; font-weight: 600; margin-bottom: 12px; opacity: 0.7; }
  .wb-tl-item { padding: 10px 0 10px 14px; border-left: 2px solid var(--vscode-panel-border, rgba(128,128,128,0.25)); margin-bottom: 2px; }
  .wb-tl-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .wb-tl-head strong { font-size: 12px; }
  .wb-tl-time { font-size: 11px; opacity: 0.5; }
  .wb-tl-body { font-size: 12px; line-height: 1.6; white-space: pre-wrap; opacity: 0.85; }

  /* Draft box */
  .draft-box { position: relative; margin-top: 8px; }
  .draft-box pre { margin: 0; padding: 10px 40px 10px 14px; font-size: 12px; white-space: pre-wrap; background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.08)); border-radius: 4px; line-height: 1.6; }
  .copy-icon-button { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; padding: 0; border-radius: 4px; background: var(--vscode-button-secondaryBackground, #3a3d41); color: var(--vscode-button-secondaryForeground, #fff); border: none; }
  .copy-icon { position: relative; display: inline-block; width: 12px; height: 14px; border: 1.5px solid currentColor; border-radius: 1px; box-sizing: border-box; }
  .copy-icon::before { content: ""; position: absolute; width: 12px; height: 14px; left: -5px; top: 3px; border: 1.5px solid currentColor; border-radius: 1px; background: var(--vscode-button-secondaryBackground, #3a3d41); box-sizing: border-box; }
</style>
</head>
<body>
  <div class="wb-bar">
    <div class="wb-status">${statusText}</div>
    <div class="wb-spacer"></div>
    <button class="wb-act${busyKind === "pullMail" ? " is-busy" : ""}" onclick="post('pullMail')"${busyDisabled}>${escapeHtml(labels.toolbar.pullMail)}${renderButtonSpinner(busyKind === "pullMail")}</button>
    <button class="wb-act${busyKind === "analyzeNext" ? " is-busy" : ""}" onclick="post('analyze')"${analysisDisabled}>${escapeHtml(locale === "zh-CN" ? "分析" : "Analyze")}${renderButtonSpinner(busyKind === "analyzeNext")}</button>
    <button class="wb-act" onclick="post('generateReports')"${busyDisabled}>${escapeHtml(labels.toolbar.generateReports)}</button>
    <button class="wb-act" onclick="post('refresh')"${busyDisabled}>↻</button>
  </div>

  <div class="wb-cols">
    <div class="wb-left">
      <div class="wb-tabs" id="tabs">${queueTabs}</div>
      <div class="wb-items" id="itemList">
        ${listData.join("")}
        <div class="wb-empty" id="listEmpty">${escapeHtml(labels.card.noItems)}</div>
      </div>
    </div>
    <div class="wb-right" id="reader">
      ${detailData.join("")}
      <div class="wb-placeholder" id="placeholder">${escapeHtml(locale === "zh-CN" ? "选择邮件以阅读详情" : "Select an item to read")}</div>
    </div>
  </div>

<script>
var vscode = acquireVsCodeApi();
var prev = vscode.getState() || {};
var currentQueue = prev.currentQueue || '${escapeAttr(defaultQueue)}';
var currentId = prev.currentId || '';

filterQueue(currentQueue, true);
if (currentId) showReader(currentId);

function post(type, extra) { vscode.postMessage(Object.assign({ type: type }, extra || {})); }

function filterQueue(queueId, init) {
  currentQueue = queueId;
  for (var t of document.querySelectorAll('.wb-tab')) t.classList.toggle('active', t.getAttribute('data-queue-id') === queueId);
  var first = null;
  for (var el of document.querySelectorAll('.wb-item')) {
    var show = el.getAttribute('data-queue') === queueId;
    el.hidden = !show;
    if (show && !first) first = el;
  }
  document.getElementById('listEmpty').hidden = !!first;
  if (!init) {
    currentId = '';
    hideReaders();
    if (first) selectItem(first);
    vscode.setState({ currentQueue: queueId, currentId: currentId });
  }
}

function selectItem(el) {
  for (var i of document.querySelectorAll('.wb-item')) i.classList.remove('active');
  el.classList.add('active');
  currentId = el.getAttribute('data-id');
  showReader(currentId);
  vscode.setState({ currentQueue: currentQueue, currentId: currentId });
}

function showReader(id) {
  hideReaders();
  for (var r of document.querySelectorAll('.wb-reader')) {
    if (r.getAttribute('data-id') === id) { r.classList.add('active'); document.getElementById('placeholder').hidden = true; return; }
  }
}

function hideReaders() {
  for (var r of document.querySelectorAll('.wb-reader')) r.classList.remove('active');
  document.getElementById('placeholder').hidden = false;
}

window.addEventListener('message', function(e) {
  var msg = e.data;
  if (msg && msg.type === 'focusItem' && msg.id) {
    var item = document.querySelector('.wb-item[data-id="' + msg.id + '"]');
    if (item) {
      var q = item.getAttribute('data-queue');
      if (q && q !== currentQueue) filterQueue(q, false);
      selectItem(item);
      item.scrollIntoView({ block: 'nearest' });
    }
  }
});

document.addEventListener('click', function(e) {
  var t = e.target && e.target.closest ? e.target.closest('button[data-action]') : null;
  if (!t) return;
  var a = t.getAttribute('data-action');
  if (a === 'copyDraft') post('copyDraft', { draftReply: t.getAttribute('data-draft-reply') || '' });
  if (a === 'ignore') post('ignore', { mailId: t.getAttribute('data-mail-id') || '' });
  if (a === 'unignore') post('unignore', { mailId: t.getAttribute('data-mail-id') || '' });
  if (a === 'openInOutlook') post('openInOutlook', { mailId: t.getAttribute('data-mail-id') || '' });
  if (a === 'analyzeThread') post('analyzeThread', { threadId: t.getAttribute('data-thread-id') || '' });
});
</script>
</body>
</html>`;
}
