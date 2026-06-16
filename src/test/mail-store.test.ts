import test from "node:test";
import assert from "node:assert/strict";
import { mergeDigestIntoStore, emptyMailStore } from "../lib/mail-store";

test("mergeDigestIntoStore adds new mail and skips duplicates by stable id", () => {
  const digest = {
    metadata: { generatedAt: "2026-06-16 10:00:00", rangeMode: "recentHours", recentHours: 24, maxItems: 2, folders: ["Inbox"] },
    items: [
      {
        mailId: "mail-001",
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
  assert.match(second.store.items[0].mailId, /^mail-[a-f0-9]{16}$/);
});
