import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboardState } from "../lib/dashboard-state";

test("buildDashboardState filters ignored ids and groups categories", () => {
  const state = buildDashboardState(
    {},
    { metadata: { generatedAt: "", rangeMode: "", recentHours: 24, maxItems: 50, folders: ["Inbox"] }, items: [] },
    {
      generatedAt: "2026-06-16T10:35:00+08:00",
      overview: { totalMails: 2, mustHandleToday: 1, risks: 0, waitingForMe: 0, notices: 1 },
      items: [
        {
          mailId: "mail-001",
          category: "mustHandleToday",
          priority: "P0",
          subject: "",
          sender: "",
          receivedTime: "2026-06-16 09:00:00",
          summary: "",
          reason: "",
          suggestedAction: "",
          draftReply: "",
          confidence: 0,
          needsOriginalMailCheck: false
        },
        {
          mailId: "mail-002",
          category: "notice",
          priority: "P3",
          subject: "",
          sender: "",
          receivedTime: "2026-06-16 08:00:00",
          summary: "",
          reason: "",
          suggestedAction: "",
          draftReply: "",
          confidence: 0,
          needsOriginalMailCheck: false
        }
      ]
    },
    ["mail-002"]
  );

  const mustDo = state.categories.find((entry) => entry.id === "mustHandleToday");
  const notice = state.categories.find((entry) => entry.id === "notice");
  assert.equal(mustDo?.items.length, 1);
  assert.equal(notice?.items.length, 0);
});

