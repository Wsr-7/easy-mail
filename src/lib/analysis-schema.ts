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

export type Category = string;
export type Priority = "P0" | "P1" | "P2" | "P3";

export interface AnalysisSource {
  mailId?: string;
  internetMessageId?: string;
  entryId?: string;
  folder?: string;
}

export interface AnalysisEvidence {
  sourceMailId: string;
  quote: string;
  reason: string;
}

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
  source?: AnalysisSource;
  evidence?: AnalysisEvidence[];
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

export function parseAnalysisJson(raw: string, allowedCategories?: string[]): AnalysisResult {
  const cleaned = stripCodeFence(String(raw || "").trim());
  const parsed = JSON.parse(cleaned);
  return normalizeAnalysis(parsed, allowedCategories);
}

export function stripCodeFence(value: string): string {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

export function normalizeAnalysis(input: unknown, allowedCategories?: string[]): AnalysisResult {
  const analysis = isObject(input) ? input : {};
  const allowed = new Set(allowedCategories && allowedCategories.length ? allowedCategories : [...VALID_CATEGORIES]);
  const items = Array.isArray((analysis as Record<string, unknown>).items)
    ? ((analysis as Record<string, unknown>).items as unknown[]).map((item, index) => normalizeItem(item, index, allowed))
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

function normalizeItem(item: unknown, index: number, allowedCategories: Set<string>): AnalysisItem {
  const base = isObject(item) ? item : {};
  const category = allowedCategories.has((base as Record<string, unknown>).category as Category)
    ? ((base as Record<string, unknown>).category as Category)
    : "uncertain";
  const priority = VALID_PRIORITIES.has((base as Record<string, unknown>).priority as Priority)
    ? ((base as Record<string, unknown>).priority as Priority)
    : "P2";

  const normalized: AnalysisItem = {
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

  const source = normalizeSource((base as Record<string, unknown>).source);
  if (source) {
    normalized.source = source;
  }

  const evidence = normalizeEvidence((base as Record<string, unknown>).evidence);
  if (evidence.length) {
    normalized.evidence = evidence;
  }

  return normalized;
}

function normalizeSource(source: unknown): AnalysisSource | undefined {
  if (!isObject(source)) {
    return undefined;
  }

  const normalized: AnalysisSource = {};
  for (const key of ["mailId", "internetMessageId", "entryId", "folder"] as const) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value)) {
      normalized[key] = String(value);
    }
  }

  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeEvidence(evidence: unknown): AnalysisEvidence[] {
  if (!Array.isArray(evidence)) {
    return [];
  }

  return evidence
    .filter(isObject)
    .map((item) => ({
      sourceMailId: String(item.sourceMailId || ""),
      quote: String(item.quote || ""),
      reason: String(item.reason || "")
    }))
    .filter((item) => item.sourceMailId || item.quote || item.reason);
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
    counts[item.category] = (counts[item.category] || 0) + 1;
  }
  return counts;
}

function numberOr(value: unknown, fallback: number): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}
