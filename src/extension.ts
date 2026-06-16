import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import * as cp from "node:child_process";
import { parseDigest, type DigestData } from "./lib/digest";
import { normalizeAnalysis, parseAnalysisJson, type AnalysisResult } from "./lib/analysis-schema";
import { buildSummaryMarkdown } from "./lib/summary";
import { buildDashboardState, CATEGORY_ORDER, type DashboardState } from "./lib/dashboard-state";

const CATEGORY_TITLES: Record<string, string> = {
  mustHandleToday: "Must Handle Today",
  risk: "Risk",
  waitingForMe: "Waiting For Me",
  followUp: "Follow-up",
  notice: "Notice",
  ignored: "Ignored",
  uncertain: "Uncertain"
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

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.dashboardProvider = new DashboardProvider(() => this.getDashboardHtml(), (message) => this.handleMessage(message));
  }

  public async initialize(): Promise<void> {
    await fs.promises.mkdir(this.getDataDir(), { recursive: true });
    await this.ensureConfig();
    await this.refresh();
  }

  public async pullMail(forceSample: boolean): Promise<void> {
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

    const prompt = `${promptTemplate}\n\n${digestText}`;
    const response = await models[0].sendRequest(
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
    return buildDashboardState(config, digest, analysis, ignoredIds);
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!message || typeof message !== "object") {
      return;
    }

    const typed = message as { type?: string; draftReply?: string; mailId?: string };
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
    }
  }

  private async getDashboardHtml(): Promise<string> {
    const state = await this.loadState();
    const rows = CATEGORY_ORDER.map((category) => renderCategory(category, state.categories.find((entry) => entry.id === category)?.items || [])).join("");
    const digestMeta = state.digestMetadata || {};

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
    .meta { background: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
    .stat { background: #fff; padding: 10px; border-radius: 10px; }
    .stat .value { font-size: 22px; font-weight: 700; }
    .category { margin-bottom: 16px; }
    .category h2 { font-size: 16px; margin: 0 0 8px; }
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
    <button onclick="post('refresh')">Refresh</button>
    <button class="secondary" onclick="post('openDigest')">Open Digest</button>
    <button class="secondary" onclick="post('openSummary')">Open Summary</button>
  </div>
  <div class="meta">
    <div><strong>Range:</strong> ${escapeHtml(digestMeta.rangeMode || "-")} / ${escapeHtml(String(digestMeta.recentHours || "-"))}h</div>
    <div><strong>Folders:</strong> ${escapeHtml((digestMeta.folders || []).join(", ") || "-")}</div>
    <div><strong>Generated:</strong> ${escapeHtml(digestMeta.generatedAt || "-")}</div>
  </div>
  <div class="stats">
    ${renderStat("Must Handle", state.overview.mustHandleToday)}
    ${renderStat("Risk", state.overview.risks)}
    ${renderStat("Waiting", state.overview.waitingForMe)}
    ${renderStat("Notice", state.overview.notices)}
  </div>
  ${rows}
  <script>
    const vscode = acquireVsCodeApi();
    function post(type, extra) { vscode.postMessage(Object.assign({ type }, extra || {})); }
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
      void this.onMessage(message);
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

function renderCategory(category: string, items: AnalysisResult["items"]): string {
  const cards = items.length ? items.map(renderCard).join("") : `<div class="empty">No items</div>`;
  return `<section class="category"><h2>${escapeHtml(CATEGORY_TITLES[category] || category)}</h2>${cards}</section>`;
}

function renderCard(item: AnalysisResult["items"][number]): string {
  const draftReplyLiteral = toJsLiteral(item.draftReply || "");
  const mailIdLiteral = toJsLiteral(item.mailId);
  return `<article class="card">
    <div class="header">
      <div class="title">${escapeHtml(item.subject || item.mailId)}</div>
      <div class="badge">${escapeHtml(item.priority)}</div>
    </div>
    <div><strong>From:</strong> ${escapeHtml(item.sender || "-")}</div>
    <div><strong>Received:</strong> ${escapeHtml(item.receivedTime || "-")}</div>
    <div><strong>Summary:</strong> ${escapeHtml(item.summary || "-")}</div>
    <div><strong>Reason:</strong> ${escapeHtml(item.reason || "-")}</div>
    <div><strong>Suggested Action:</strong> ${escapeHtml(item.suggestedAction || "-")}</div>
    <pre>${escapeHtml(item.draftReply || "")}</pre>
    <div class="actions">
      <button onclick="post('copyDraft', { draftReply: ${draftReplyLiteral} })">Copy Draft</button>
      <button class="secondary" onclick="post('ignore', { mailId: ${mailIdLiteral} })">Ignore</button>
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

function toJsLiteral(value: string): string {
  return JSON.stringify(String(value || ""))
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/'/g, "\\u0027");
}
