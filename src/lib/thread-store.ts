import type { ThreadMessage, ThreadRecord, ThreadSecuritySummary, ThreadStore } from "./thread-schema";

export type { ThreadContentStatus, ThreadMessage, ThreadRecord, ThreadSecuritySummary, ThreadStore } from "./thread-schema";

export function emptyThreadStore(): ThreadStore {
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    lastBuiltAt: "",
    items: []
  };
}

export function normalizeThreadStore(input: unknown): ThreadStore {
  const base = isObject(input) ? input : {};
  const items = Array.isArray(base.items)
    ? base.items.map(normalizeThreadRecord).filter(Boolean) as ThreadRecord[]
    : [];
  return {
    generatedAt: String(base.generatedAt || new Date().toISOString()),
    lastBuiltAt: String(base.lastBuiltAt || ""),
    items
  };
}

export function pruneThreadStore(store: ThreadStore, retentionDays: number, now: Date = new Date()): ThreadStore {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return store;
  }
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return {
    ...store,
    items: store.items.filter((item) => {
      const last = parseDate(item.lastTime) || latestTimelineTime(item.timeline);
      return !Number.isFinite(last) || last >= cutoff;
    })
  };
}

function normalizeThreadRecord(input: unknown): ThreadRecord | null {
  if (!isObject(input)) {
    return null;
  }
  const threadId = String(input.threadId || "");
  if (!threadId) {
    return null;
  }
  const timeline = Array.isArray(input.timeline)
    ? input.timeline.map(normalizeThreadMessage).filter(Boolean) as ThreadMessage[]
    : [];
  const messageCount = positiveNumber(input.messageCount, timeline.length);
  return {
    threadId,
    conversationId: String(input.conversationId || ""),
    normalizedSubject: String(input.normalizedSubject || normalizeSubjectValue(String(input.subject || ""))),
    subject: String(input.subject || ""),
    participants: stringArray(input.participants),
    folders: stringArray(input.folders),
    startTime: String(input.startTime || firstTimelineTime(timeline)),
    lastTime: String(input.lastTime || lastTimelineTime(timeline)),
    messageCount,
    unreadCount: positiveNumber(input.unreadCount, 0),
    hasAttachments: Boolean(input.hasAttachments),
    sourceMailIds: stringArray(input.sourceMailIds),
    timeline,
    contentStatus: normalizeContentStatus(input.contentStatus, timeline),
    security: normalizeSecurity(input.security)
  };
}

function normalizeThreadMessage(input: unknown): ThreadMessage | null {
  if (!isObject(input)) {
    return null;
  }
  const mailId = String(input.mailId || "");
  if (!mailId) {
    return null;
  }
  const bodyPreview = String(input.bodyPreview || input.bodyDelta || input.bodyClean || "");
  return {
    mailId,
    internetMessageId: String(input.internetMessageId || ""),
    entryId: String(input.entryId || ""),
    conversationId: String(input.conversationId || ""),
    conversationIndex: String(input.conversationIndex || ""),
    subject: String(input.subject || ""),
    from: String(input.from || ""),
    senderName: String(input.senderName || ""),
    senderEmail: String(input.senderEmail || ""),
    receivedTime: String(input.receivedTime || ""),
    sentTime: String(input.sentTime || ""),
    folder: String(input.folder || ""),
    bodyPreview,
    bodyClean: String(input.bodyClean || bodyPreview),
    bodyDelta: String(input.bodyDelta || bodyPreview),
    bodyHash: String(input.bodyHash || ""),
    isDuplicateBody: Boolean(input.isDuplicateBody),
    contentAvailable: Boolean(input.contentAvailable || bodyPreview),
    attachmentCount: positiveNumber(input.attachmentCount, 0),
    attachmentNames: stringArray(input.attachmentNames)
  };
}

function normalizeSecurity(input: unknown): ThreadSecuritySummary | undefined {
  if (!isObject(input)) {
    return undefined;
  }
  return {
    totalMessages: positiveNumber(input.totalMessages, 0),
    allowedMessages: positiveNumber(input.allowedMessages, 0),
    manualConfirmMessages: positiveNumber(input.manualConfirmMessages, 0),
    blockedMessages: positiveNumber(input.blockedMessages, 0),
    highestClassificationLevel: positiveNumber(input.highestClassificationLevel, 0),
    partialContext: Boolean(input.partialContext),
    reasons: stringArray(input.reasons)
  };
}

function normalizeContentStatus(input: unknown, timeline: ThreadMessage[]): "available" | "partial" | "metadataOnly" {
  if (input === "available" || input === "partial" || input === "metadataOnly") {
    return input;
  }
  const available = timeline.filter((item) => item.contentAvailable).length;
  if (available === 0) {
    return "metadataOnly";
  }
  return available === timeline.length ? "available" : "partial";
}

function firstTimelineTime(timeline: ThreadMessage[]): string {
  return timeline[0]?.receivedTime || timeline[0]?.sentTime || "";
}

function lastTimelineTime(timeline: ThreadMessage[]): string {
  const last = timeline[timeline.length - 1];
  return last?.receivedTime || last?.sentTime || "";
}

function latestTimelineTime(timeline: ThreadMessage[]): number {
  let latest = NaN;
  for (const item of timeline) {
    const value = parseDate(item.receivedTime) || parseDate(item.sentTime);
    if (!Number.isFinite(value)) {
      continue;
    }
    if (!Number.isFinite(latest) || value > latest) {
      latest = value;
    }
  }
  return latest;
}

function stringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function positiveNumber(input: unknown, fallback: number): number {
  const value = Number(input);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeSubjectValue(value: string): string {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function parseDate(value: string): number {
  const parsed = Date.parse(String(value || "").replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}
