import type { AnalysisResult } from "./analysis-schema";
import type { DigestData } from "./digest";
import type { ThreadStore } from "./thread-store";

export const CATEGORY_ORDER = [
  "mustHandleToday",
  "importantSender",
  "risk",
  "waitingForMe",
  "followUp",
  "notice",
  "uncertain",
  "ignored"
] as const;

const PRIORITY_ORDER: Record<string, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3
};

export interface DashboardCategory {
  id: string;
  items: AnalysisResult["items"];
}

export interface DashboardState {
  config: Record<string, unknown>;
  digestMetadata: DigestData["metadata"];
  overview: AnalysisResult["overview"];
  categories: DashboardCategory[];
  threadStore?: ThreadStore;
}

export function buildDashboardState(
  config: Record<string, unknown>,
  digest: DigestData,
  analysis: AnalysisResult,
  ignoredIds: string[],
  categoryOrder: readonly string[] = CATEGORY_ORDER,
  threadStore?: ThreadStore
): DashboardState {
  const ignored = new Set(ignoredIds || []);
  const allItems = (analysis?.items || []).sort(compareItems);
  const items = allItems.filter((item) => !ignored.has(item.mailId));
  const ignoredItems = allItems.filter((item) => ignored.has(item.mailId));

  const dynamicCategories = unique([...categoryOrder, ...items.map((item) => item.category), "ignored"]);
  const categories = dynamicCategories.map((category) => ({
    id: category,
    items: category === "ignored"
      ? ignoredItems
      : items.filter((item) => item.category === category)
  }));

  return {
    config,
    digestMetadata: digest?.metadata || { generatedAt: "", rangeMode: "", recentHours: 0, maxItems: 0, folders: [] },
    overview: buildOverview(items),
    categories,
    threadStore
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function compareItems(a: AnalysisResult["items"][number], b: AnalysisResult["items"][number]): number {
  const byPriority = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
  if (byPriority !== 0) {
    return byPriority;
  }
  return String(b.receivedTime || "").localeCompare(String(a.receivedTime || ""));
}

function buildOverview(items: AnalysisResult["items"]): AnalysisResult["overview"] {
  return {
    totalMails: items.length,
    mustHandleToday: items.filter((item) => item.category === "mustHandleToday").length,
    risks: items.filter((item) => item.category === "risk").length,
    waitingForMe: items.filter((item) => item.category === "waitingForMe").length,
    notices: items.filter((item) => item.category === "notice").length
  };
}
