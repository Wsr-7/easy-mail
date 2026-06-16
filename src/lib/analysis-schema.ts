export const VALID_CATEGORIES = new Set([
  "mustHandleToday",
  "risk",
  "waitingForMe",
  "followUp",
  "notice",
  "ignored",
  "uncertain"
] as const);

export const VALID_PRIORITIES = new Set(["P0", "P1", "P2", "P3"] as const);

export type Category = "mustHandleToday" | "risk" | "waitingForMe" | "followUp" | "notice" | "ignored" | "uncertain";
export type Priority = "P0" | "P1" | "P2" | "P3";

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

export interface AnalysisOverview {
  totalMails: number;
  mustHandleToday: number;
  risks: number;
  waitingForMe: number;
  notices: number;
}

export interface AnalysisResult {
  generatedAt: string;
  overview: AnalysisOverview;
  items: AnalysisItem[];
}

export function parseAnalysisJson(raw: string): AnalysisResult {
  const cleaned = stripCodeFence(String(raw || "").trim());
  const parsed = JSON.parse(cleaned);
  return normalizeAnalysis(parsed);
}

export function stripCodeFence(value: string): string {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

export function normalizeAnalysis(input: unknown): AnalysisResult {
  const analysis = isObject(input) ? input : {};
  const items = Array.isArray((analysis as Record<string, unknown>).items)
    ? ((analysis as Record<string, unknown>).items as unknown[]).map(normalizeItem)
    : [];

  return {
    generatedAt: String((analysis as Record<string, unknown>).generatedAt || new Date().toISOString()),
    overview: normalizeOverview((analysis as Record<string, unknown>).overview, items),
    items
  };
}

function normalizeOverview(overview: unknown, items: AnalysisItem[]): AnalysisOverview {
  const base = isObject(overview) ? overview : {};
  const grouped = groupCounts(items);
  return {
    totalMails: numberOr((base as Record<string, unknown>).totalMails, items.length),
    mustHandleToday: numberOr((base as Record<string, unknown>).mustHandleToday, grouped.mustHandleToday),
    risks: numberOr((base as Record<string, unknown>).risks, grouped.risk),
    waitingForMe: numberOr((base as Record<string, unknown>).waitingForMe, grouped.waitingForMe),
    notices: numberOr((base as Record<string, unknown>).notices, grouped.notice)
  };
}

function normalizeItem(item: unknown, index: number): AnalysisItem {
  const base = isObject(item) ? item : {};
  const category = VALID_CATEGORIES.has((base as Record<string, unknown>).category as Category)
    ? ((base as Record<string, unknown>).category as Category)
    : "uncertain";
  const priority = VALID_PRIORITIES.has((base as Record<string, unknown>).priority as Priority)
    ? ((base as Record<string, unknown>).priority as Priority)
    : "P2";

  return {
    mailId: String((base as Record<string, unknown>).mailId || `mail-${String(index + 1).padStart(3, "0")}`),
    category,
    priority,
    subject: String((base as Record<string, unknown>).subject || ""),
    sender: String((base as Record<string, unknown>).sender || ""),
    receivedTime: String((base as Record<string, unknown>).receivedTime || ""),
    summary: String((base as Record<string, unknown>).summary || ""),
    reason: String((base as Record<string, unknown>).reason || ""),
    suggestedAction: String((base as Record<string, unknown>).suggestedAction || ""),
    draftReply: String((base as Record<string, unknown>).draftReply || ""),
    confidence: typeof (base as Record<string, unknown>).confidence === "number" ? ((base as Record<string, unknown>).confidence as number) : 0,
    needsOriginalMailCheck: Boolean((base as Record<string, unknown>).needsOriginalMailCheck)
  };
}

function groupCounts(items: AnalysisItem[]): Record<Category, number> {
  const counts: Record<Category, number> = {
    mustHandleToday: 0,
    risk: 0,
    waitingForMe: 0,
    followUp: 0,
    notice: 0,
    ignored: 0,
    uncertain: 0
  };
  for (const item of items) {
    counts[item.category] += 1;
  }
  return counts;
}

function numberOr(value: unknown, fallback: number): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

