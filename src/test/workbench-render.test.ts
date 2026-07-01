import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderWorkbenchHtml } from "../lib/workbench-render";
import { normalizeClassificationCache } from "../lib/classification";
import { normalizePromptConfig } from "../lib/prompt-config";
import { emptyMailStore, emptyMailIndex, type StoredMail } from "../lib/mail-store";
import { emptyThreadStore } from "../lib/thread-store";
import type { StoredMeeting as StoredMeetingItem } from "../lib/meeting-store";
import type { DashboardRenderInput } from "../lib/dashboard-render";
import type { DashboardState } from "../lib/dashboard-state";
import type { AnalysisItem } from "../lib/analysis-schema";

function stubMail(overrides?: Partial<StoredMail>): StoredMail {
  return {
    mailId: "m1", sourceMailId: "", internetMessageId: "", entryId: "", subject: "Test",
    from: "test@test.com", receivedTime: "2024-01-01", folder: "Inbox",
    unread: "True", importance: "Normal", toMe: "True", ccMe: "False",
    bodyExcerpt: "", pulledAt: "2024-01-01",
    ...overrides
  };
}

function stubAnalysisItem(overrides?: Partial<AnalysisItem>): AnalysisItem {
  return {
    mailId: "a1", category: "mustHandleToday", priority: "P0", subject: "Urgent",
    sender: "ceo@test.com", receivedTime: "2024-01-01", summary: "Do this",
    reason: "CEO", suggestedAction: "Reply", draftReply: "", confidence: 0.9,
    needsOriginalMailCheck: false,
    ...overrides
  };
}

function stubState(configOverrides?: Record<string, unknown>, categories?: DashboardState["categories"]): DashboardState {
  return {
    config: { rangeMode: "recentHours", recentHours: 24, outputLanguage: "en-US", ...configOverrides },
    digestMetadata: { generatedAt: "", rangeMode: "", recentHours: 0, maxItems: 0, folders: [] },
    overview: { totalMails: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 },
    categories: categories || []
  };
}

function stubInput(overrides?: Partial<DashboardRenderInput>): DashboardRenderInput {
  return {
    state: stubState(),
    store: emptyMailStore(),
    index: emptyMailIndex(),
    queue: { pending: [], blocked: [], analysed: [], allowed: [], ignoredPending: [] },
    classifications: normalizeClassificationCache({}),
    securityDecisions: new Map(),
    promptConfig: normalizePromptConfig({}),
    threadStore: emptyThreadStore(),
    threadAnalysis: { generatedAt: "", overview: { totalThreads: 0, mustHandleToday: 0, risks: 0, waitingForMe: 0, notices: 0 }, items: [] },
    availableModels: [],
    busyKind: "",
    isBusy: false,
    ...overrides
  };
}

describe("renderWorkbenchHtml", () => {
  it("returns valid HTML document", () => {
    const html = renderWorkbenchHtml(stubInput());
    assert.ok(html.includes("<!doctype html>"));
    assert.ok(html.includes("</html>"));
  });

  it("renders two-column layout", () => {
    const html = renderWorkbenchHtml(stubInput());
    assert.ok(html.includes("wb-cols"));
    assert.ok(html.includes("wb-left"));
    assert.ok(html.includes("wb-right"));
    assert.ok(html.includes("wb-tabs"));
  });

  it("does not render top bar action buttons (actions live in sidebar)", () => {
    const html = renderWorkbenchHtml(stubInput());
    assert.ok(!html.includes("wb-bar"), "workbench should not have top action bar");
    assert.ok(!html.includes("post('pullMail')"), "workbench should not have pullMail button");
    assert.ok(!html.includes("post('analyze')"), "workbench should not have analyze button");
  });

  it("renders queue tabs for non-empty queues", () => {
    const input = stubInput({
      queue: { pending: [stubMail()], blocked: [], analysed: [], allowed: [], ignoredPending: [] }
    });
    const html = renderWorkbenchHtml(input);
    assert.ok(html.includes('data-queue-id="pending"'));
    assert.ok(html.includes("filterQueue"));
  });

  it("renders list items for pending mails", () => {
    const input = stubInput({
      queue: { pending: [stubMail({ mailId: "m1", subject: "Hello" })], blocked: [], analysed: [], allowed: [], ignoredPending: [] }
    });
    const html = renderWorkbenchHtml(input);
    assert.ok(html.includes('data-queue="pending"'));
    assert.ok(html.includes("Hello"));
  });

  it("renders detail panels for analysis items", () => {
    const input = stubInput({
      state: stubState({}, [
        { id: "mustHandleToday", items: [stubAnalysisItem({ subject: "Urgent task" })] }
      ])
    });
    const html = renderWorkbenchHtml(input);
    assert.ok(html.includes("wb-detail-card"));
    assert.ok(html.includes("Urgent task"));
  });

  it("renders thread items", () => {
    const input = stubInput({
      threadStore: {
        generatedAt: "", lastBuiltAt: "",
        items: [{
          threadId: "t1", conversationId: "c1", normalizedSubject: "thread",
          subject: "Thread Subject",
          participants: ["alice@test.com"],
          folders: ["Inbox"], startTime: "2024-01-01", lastTime: "2024-01-02",
          messageCount: 2, unreadCount: 0, hasAttachments: false,
          sourceMailIds: ["m1", "m2"], timeline: [],
          contentStatus: "available",
          security: { totalMessages: 2, allowedMessages: 2, manualConfirmMessages: 0, blockedMessages: 0, highestClassificationLevel: 0, partialContext: false, reasons: [] }
        }]
      }
    });
    const html = renderWorkbenchHtml(input);
    assert.ok(html.includes('data-queue="threads"'));
    assert.ok(html.includes("Thread Subject"));
  });

  it("includes client-side selection JavaScript", () => {
    const html = renderWorkbenchHtml(stubInput());
    assert.ok(html.includes("filterQueue"));
    assert.ok(html.includes("selectItem"));
    assert.ok(html.includes("showReader"));
  });

  it("still renders thread analyze button with busy state", () => {
    const html = renderWorkbenchHtml(stubInput({ isBusy: true, busyKind: "analyzeThread" }));
    assert.ok(!html.includes("wb-bar"), "no top bar even when busy");
  });

  it("renders placeholder for reading pane", () => {
    const html = renderWorkbenchHtml(stubInput());
    assert.ok(html.includes("wb-placeholder"));
  });

  it("shows restore button for ignored items instead of ignore", () => {
    const input = stubInput({
      state: stubState({}, [
        { id: "ignored", items: [stubAnalysisItem({ mailId: "ig1", subject: "Ignored mail" })] }
      ])
    });
    const html = renderWorkbenchHtml(input);
    assert.ok(html.includes('data-action="unignore"'));
    assert.ok(html.includes("Restore"));
    assert.ok(!html.includes('data-action="ignore" data-mail-id="ig1"'));
  });

  it("renders meeting items in meetings queue", () => {
    const mtg: StoredMeetingItem = {
      meetingId: "mtg-1", entryId: "e-mtg-1", subject: "Standup", organizer: "Alice",
      start: "2026-07-01 09:00", end: "2026-07-01 09:30", location: "Room A",
      isAllDay: false, isRecurring: false, requiredAttendees: "bob@test.com",
      optionalAttendees: "", responseStatus: "notResponded", meetingSource: "calendar",
      importance: "Normal", bodyExcerpt: "", pulledAt: "2026-07-01"
    };
    const input = stubInput({ meetingStore: { generatedAt: "", lastPullAt: "", items: [mtg] } });
    const html = renderWorkbenchHtml(input);
    assert.ok(html.includes('data-queue="meetings"'));
    assert.ok(html.includes("Standup"));
    assert.ok(html.includes("Alice"));
    assert.ok(html.includes("openMeetingInOutlook"));
    assert.ok(html.includes("wb-mtg-notResponded"));
  });
});
