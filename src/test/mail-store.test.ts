import test from "node:test";
import assert from "node:assert/strict";
import { emptyMailIndex, emptyMailStore, mergeDigestIntoIndex, mergeDigestIntoStore, pruneMailIndex, pruneMailStore } from "../lib/mail-store";

test("mergeDigestIntoStore adds new mail and skips duplicates by stable id", () => {
  const digest = {
    metadata: { generatedAt: "2026-06-16 10:00:00", rangeMode: "recentHours", recentHours: 24, maxItems: 2, folders: ["Inbox"] },
    items: [
      {
        mailId: "mail-001",
        internetMessageId: "<mail-001@example.com>",
        entryId: "entry-001",
        subject: "Contract approval needed",
        from: "Alice <alice@example.com>",
        receivedTime: "2026-06-16 09:00:00",
        folder: "Inbox",
        unread: "true",
        importance: "high",
        toMe: "true",
        ccMe: "false",
        bodyExcerpt: "Please approve the contract."
      }
    ]
  };

  const first = mergeDigestIntoStore(emptyMailStore(), digest);
  const second = mergeDigestIntoStore(first.store, digest);
  assert.equal(first.added, 1);
  assert.equal(second.added, 0);
  assert.equal(second.skipped, 1);
  assert.equal(second.store.items.length, 1);
  assert.equal(second.store.items[0].mailId, "internet:<mail-001@example.com>");
});

test("mergeDigestIntoStore skips ids already present in mail index", () => {
  const digest = {
    metadata: { generatedAt: "2026-06-16 10:00:00", rangeMode: "recentHours", recentHours: 24, maxItems: 1, folders: ["Inbox"] },
    items: [
      {
        mailId: "mail-001",
        internetMessageId: "<mail-001@example.com>",
        entryId: "entry-001",
        subject: "Contract approval needed",
        from: "Alice <alice@example.com>",
        receivedTime: "2026-06-16 09:00:00",
        folder: "Inbox",
        unread: "true",
        importance: "high",
        toMe: "true",
        ccMe: "false",
        bodyExcerpt: "Please approve the contract."
      }
    ]
  };
  const index = mergeDigestIntoIndex(emptyMailIndex(), digest);
  const merge = mergeDigestIntoStore(emptyMailStore(), digest, index.items.map((item) => item.mailId));
  assert.equal(merge.added, 0);
  assert.equal(merge.skipped, 1);
});

test("pruneMailStore removes items older than retention days", () => {
  const store = {
    generatedAt: "",
    lastPullAt: "",
    items: [
      {
        mailId: "mail-old",
        sourceMailId: "mail-old",
        internetMessageId: "",
        entryId: "",
        subject: "",
        from: "",
        receivedTime: "2026-05-01 09:00:00",
        folder: "Inbox",
        unread: "false",
        importance: "normal",
        toMe: "true",
        ccMe: "false",
        bodyExcerpt: "",
        pulledAt: ""
      },
      {
        mailId: "mail-new",
        sourceMailId: "mail-new",
        internetMessageId: "",
        entryId: "",
        subject: "",
        from: "",
        receivedTime: "2026-06-15 09:00:00",
        folder: "Inbox",
        unread: "false",
        importance: "normal",
        toMe: "true",
        ccMe: "false",
        bodyExcerpt: "",
        pulledAt: ""
      }
    ]
  };

  const pruned = pruneMailStore(store, 30, new Date("2026-06-16T00:00:00"));
  assert.deepEqual(pruned.items.map((item) => item.mailId), ["mail-new"]);
});

test("pruneMailIndex removes anchors older than retention days", () => {
  const index = {
    generatedAt: "",
    lastPullAt: "",
    items: [
      {
        mailId: "old",
        sourceMailId: "old",
        internetMessageId: "",
        entryId: "",
        receivedTime: "2026-06-01 09:00:00",
        folder: "Inbox",
        lastSeenAt: ""
      },
      {
        mailId: "new",
        sourceMailId: "new",
        internetMessageId: "",
        entryId: "",
        receivedTime: "2026-06-15 09:00:00",
        folder: "Inbox",
        lastSeenAt: ""
      }
    ]
  };
  const pruned = pruneMailIndex(index, 7, new Date("2026-06-16T00:00:00"));
  assert.deepEqual(pruned.items.map((item) => item.mailId), ["new"]);
});
