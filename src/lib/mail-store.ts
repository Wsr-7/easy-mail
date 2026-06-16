import * as crypto from "node:crypto";
import type { DigestData, DigestItem } from "./digest";

export interface StoredMail {
  mailId: string;
  sourceMailId: string;
  internetMessageId: string;
  entryId: string;
  subject: string;
  from: string;
  receivedTime: string;
  folder: string;
  unread: string;
  importance: string;
  toMe: string;
  ccMe: string;
  bodyExcerpt: string;
  pulledAt: string;
}

export interface MailStore {
  generatedAt: string;
  lastPullAt: string;
  items: StoredMail[];
}

export interface MailIndexItem {
  mailId: string;
  sourceMailId: string;
  internetMessageId: string;
  entryId: string;
  receivedTime: string;
  folder: string;
  lastSeenAt: string;
}

export interface MailIndex {
  generatedAt: string;
  lastPullAt: string;
  items: MailIndexItem[];
}

export interface MailStoreMergeResult {
  store: MailStore;
  added: number;
  skipped: number;
}

export function emptyMailStore(): MailStore {
  return {
    generatedAt: new Date().toISOString(),
    lastPullAt: "",
    items: []
  };
}

export function normalizeMailStore(input: unknown): MailStore {
  const base = isObject(input) ? input : {};
  const items = Array.isArray(base.items) ? base.items.map(normalizeStoredMail).filter(Boolean) as StoredMail[] : [];
  return {
    generatedAt: String(base.generatedAt || new Date().toISOString()),
    lastPullAt: String(base.lastPullAt || ""),
    items
  };
}

export function emptyMailIndex(): MailIndex {
  return {
    generatedAt: new Date().toISOString(),
    lastPullAt: "",
    items: []
  };
}

export function normalizeMailIndex(input: unknown): MailIndex {
  const base = isObject(input) ? input : {};
  const items = Array.isArray(base.items) ? base.items.map(normalizeMailIndexItem).filter(Boolean) as MailIndexItem[] : [];
  return {
    generatedAt: String(base.generatedAt || new Date().toISOString()),
    lastPullAt: String(base.lastPullAt || ""),
    items
  };
}

export function mergeDigestIntoStore(store: MailStore, digest: DigestData, knownMailIds: string[] = []): MailStoreMergeResult {
  const existing = new Set([...store.items.map((item) => item.mailId), ...knownMailIds]);
  const nextItems = [...store.items];
  let added = 0;
  let skipped = 0;
  const pulledAt = digest.metadata.generatedAt || new Date().toISOString();

  for (const digestItem of digest.items) {
    const mail = digestItemToStoredMail(digestItem, pulledAt);
    if (existing.has(mail.mailId)) {
      skipped += 1;
      continue;
    }
    existing.add(mail.mailId);
    nextItems.push(mail);
    added += 1;
  }

  nextItems.sort(compareStoredMail);
  return {
    store: {
      ...store,
      lastPullAt: pulledAt,
      items: nextItems
    },
    added,
    skipped
  };
}

export function mergeDigestIntoIndex(index: MailIndex, digest: DigestData): MailIndex {
  const byId = new Map(index.items.map((item) => [item.mailId, item]));
  const seenAt = digest.metadata.generatedAt || new Date().toISOString();
  for (const digestItem of digest.items) {
    const mail = digestItemToStoredMail(digestItem, seenAt);
    byId.set(mail.mailId, {
      mailId: mail.mailId,
      sourceMailId: mail.sourceMailId,
      internetMessageId: mail.internetMessageId,
      entryId: mail.entryId,
      receivedTime: mail.receivedTime,
      folder: mail.folder,
      lastSeenAt: seenAt
    });
  }
  return {
    ...index,
    lastPullAt: seenAt,
    items: [...byId.values()].sort(compareMailIndexItems)
  };
}

export function digestItemToStoredMail(item: DigestItem, pulledAt: string): StoredMail {
  return {
    mailId: stableMailId(item),
    sourceMailId: item.mailId,
    internetMessageId: item.internetMessageId,
    entryId: item.entryId,
    subject: item.subject,
    from: item.from,
    receivedTime: item.receivedTime,
    folder: item.folder,
    unread: item.unread,
    importance: item.importance,
    toMe: item.toMe,
    ccMe: item.ccMe,
    bodyExcerpt: item.bodyExcerpt,
    pulledAt
  };
}

export function stableMailId(item: DigestItem): string {
  if (item.internetMessageId.trim()) {
    return `internet:${item.internetMessageId.trim()}`;
  }
  if (item.entryId.trim()) {
    return `entry:${item.entryId.trim()}`;
  }
  const source = [
    item.folder,
    item.receivedTime,
    item.from,
    item.subject,
    item.bodyExcerpt
  ].join("\n");
  return `mail-${crypto.createHash("sha256").update(source).digest("hex").slice(0, 16)}`;
}

export function pruneMailStore(store: MailStore, retentionDays: number, now: Date = new Date()): MailStore {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return store;
  }
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return {
    ...store,
    items: store.items.filter((item) => {
      const received = Date.parse(String(item.receivedTime || "").replace(" ", "T"));
      return !Number.isFinite(received) || received >= cutoff;
    })
  };
}

export function pruneMailIndex(index: MailIndex, retentionDays: number, now: Date = new Date()): MailIndex {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return index;
  }
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return {
    ...index,
    items: index.items.filter((item) => {
      const received = Date.parse(String(item.receivedTime || "").replace(" ", "T"));
      return !Number.isFinite(received) || received >= cutoff;
    })
  };
}

export function removeStoredMailByIds(store: MailStore, mailIds: string[]): MailStore {
  const remove = new Set(mailIds);
  return {
    ...store,
    items: store.items.filter((item) => !remove.has(item.mailId))
  };
}

export function buildBatchDigestMarkdown(items: StoredMail[]): string {
  const lines: string[] = ["# Outlook Mail Digest", ""];
  lines.push(`GeneratedAt: ${new Date().toISOString()}`);
  lines.push("RangeMode: batch");
  lines.push("RecentHours: 0");
  lines.push(`MaxItems: ${items.length}`);
  lines.push("Folders:");
  for (const folder of unique(items.map((item) => item.folder).filter(Boolean))) {
    lines.push(`- ${folder}`);
  }
  lines.push("");
  lines.push("---");

  for (const item of items) {
    lines.push("");
    lines.push(`## Mail: ${item.mailId}`);
    lines.push("");
    lines.push(`Subject: ${item.subject}`);
    lines.push(`From: ${item.from}`);
    lines.push(`ReceivedTime: ${item.receivedTime}`);
    lines.push(`Folder: ${item.folder}`);
    lines.push(`Unread: ${item.unread}`);
    lines.push(`Importance: ${item.importance}`);
    lines.push(`ToMe: ${item.toMe}`);
    lines.push(`CcMe: ${item.ccMe}`);
    lines.push("");
    lines.push("BodyExcerpt:");
    lines.push(item.bodyExcerpt);
    lines.push("");
    lines.push("---");
  }

  return lines.join("\n");
}

function normalizeStoredMail(input: unknown): StoredMail | null {
  if (!isObject(input)) {
    return null;
  }
  const mailId = String(input.mailId || "");
  if (!mailId) {
    return null;
  }
  return {
    mailId,
    sourceMailId: String(input.sourceMailId || ""),
    internetMessageId: String(input.internetMessageId || ""),
    entryId: String(input.entryId || ""),
    subject: String(input.subject || ""),
    from: String(input.from || ""),
    receivedTime: String(input.receivedTime || ""),
    folder: String(input.folder || ""),
    unread: String(input.unread || ""),
    importance: String(input.importance || ""),
    toMe: String(input.toMe || ""),
    ccMe: String(input.ccMe || ""),
    bodyExcerpt: String(input.bodyExcerpt || ""),
    pulledAt: String(input.pulledAt || "")
  };
}

function normalizeMailIndexItem(input: unknown): MailIndexItem | null {
  if (!isObject(input)) {
    return null;
  }
  const mailId = String(input.mailId || "");
  if (!mailId) {
    return null;
  }
  return {
    mailId,
    sourceMailId: String(input.sourceMailId || ""),
    internetMessageId: String(input.internetMessageId || ""),
    entryId: String(input.entryId || ""),
    receivedTime: String(input.receivedTime || ""),
    folder: String(input.folder || ""),
    lastSeenAt: String(input.lastSeenAt || "")
  };
}

function compareStoredMail(a: StoredMail, b: StoredMail): number {
  return String(b.receivedTime || "").localeCompare(String(a.receivedTime || ""));
}

function compareMailIndexItems(a: MailIndexItem, b: MailIndexItem): number {
  return String(b.receivedTime || "").localeCompare(String(a.receivedTime || ""));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}
