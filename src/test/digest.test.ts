import test from "node:test";
import assert from "node:assert/strict";
import { parseDigest } from "../lib/digest";

test("parseDigest extracts metadata and mail items", () => {
  const result = parseDigest(`# Outlook Mail Digest

GeneratedAt: 2026-06-16 10:30:00
RangeMode: RecentHours
RecentHours: 24
MaxItems: 50
Folders:
- Inbox
- Inbox/Customer

---

## Mail: mail-001

Subject: Contract approval needed
InternetMessageId: <mail-001@example.com>
EntryId: entry-001
From: Alice <alice@example.com>
ReceivedTime: 2026-06-16 09:12:00
Folder: Inbox/Customer
Unread: true
Importance: high
ToMe: true
CcMe: false

BodyExcerpt:
Please review and approve the contract.

---`);

  assert.equal(result.metadata.recentHours, 24);
  assert.deepEqual(result.metadata.folders, ["Inbox", "Inbox/Customer"]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].mailId, "mail-001");
  assert.equal(result.items[0].internetMessageId, "<mail-001@example.com>");
  assert.equal(result.items[0].entryId, "entry-001");
  assert.equal(result.items[0].subject, "Contract approval needed");
});
