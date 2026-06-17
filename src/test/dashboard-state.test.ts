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

test("buildDashboardState can carry thread store without changing mail categories", () => {
  const state = buildDashboardState(
    {},
    { metadata: { generatedAt: "", rangeMode: "", recentHours: 24, maxItems: 50, folders: ["Inbox"] }, items: [] },
    {
      generatedAt: "2026-06-16T10:35:00+08:00",
      overview: { totalMails: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 },
      items: []
    },
    [],
    undefined,
    {
      generatedAt: "2026-06-16T10:36:00+08:00",
      lastBuiltAt: "2026-06-16T10:36:00+08:00",
      items: [
        {
          threadId: "conversation:conv-1",
          conversationId: "conv-1",
          normalizedSubject: "project",
          subject: "Project",
          participants: ["Alice"],
          folders: ["Inbox"],
          startTime: "2026-06-16 09:00:00",
          lastTime: "2026-06-16 10:00:00",
          messageCount: 2,
          unreadCount: 1,
          hasAttachments: false,
          sourceMailIds: ["mail-1", "mail-2"],
          timeline: [],
          contentStatus: "available"
        }
      ]
    }
  );

  assert.equal(state.threadStore?.items.length, 1);
  assert.ok(state.categories.find((entry) => entry.id === "mustHandleToday"));
});
