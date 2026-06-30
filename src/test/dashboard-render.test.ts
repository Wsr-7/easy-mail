import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderStat,
  renderButtonSpinner,
  renderDraftBox,
  formatClassification,
  formatGateStatus,
  formatThreadSecurity,
  formatModelInfo,
  formatPriority,
  formatAnalyzeNextLabel,
  formatRangeMeta,
  formatSelectedModel,
  renderRangeValueControl,
  renderClassificationOptions,
  renderModelOptions,
} from "../lib/dashboard-render";
import { LABELS, getLabels } from "../lib/dashboard-labels";

const zhLabels = getLabels("zh-CN");
const enLabels = getLabels("en-US");

describe("renderStat", () => {
  it("renders a stat button with label and value", () => {
    const html = renderStat("Pulled", 42, "pending-panel");
    assert.ok(html.includes("Pulled"));
    assert.ok(html.includes("42"));
    assert.ok(html.includes('data-target-id="pending-panel"'));
  });

  it("defaults to 0 for undefined value", () => {
    const html = renderStat("Count", undefined, "target");
    assert.ok(html.includes("0"));
  });
});

describe("renderButtonSpinner", () => {
  it("returns spinner when active", () => {
    assert.ok(renderButtonSpinner(true).includes("button-spinner"));
  });

  it("returns empty when inactive", () => {
    assert.equal(renderButtonSpinner(false), "");
  });
});

describe("renderDraftBox", () => {
  it("renders draft with copy button", () => {
    const html = renderDraftBox("Hello draft");
    assert.ok(html.includes("Hello draft"));
    assert.ok(html.includes("copyDraft"));
  });

  it("returns empty for blank draft", () => {
    assert.equal(renderDraftBox("  "), "");
  });
});

describe("formatClassification", () => {
  it("formats classification with label and level", () => {
    assert.equal(formatClassification({ label: "INTERNAL", level: 1 }), "INTERNAL (1)");
  });

  it("returns dash for undefined", () => {
    assert.equal(formatClassification(undefined), "-");
  });
});

describe("formatGateStatus", () => {
  it("returns blocked label for block decision", () => {
    const result = formatGateStatus({ decision: "block", reasons: [] } as any, false, enLabels);
    assert.equal(result, enLabels.pending.gateBlocked);
  });

  it("returns manual required for manual_confirm", () => {
    const result = formatGateStatus({ decision: "manual_confirm", reasons: [] } as any, false, enLabels);
    assert.equal(result, enLabels.pending.manualRequired);
  });

  it("returns auto allowed when neither blocked nor manual", () => {
    const result = formatGateStatus(undefined, false, enLabels);
    assert.equal(result, enLabels.pending.autoAllowed);
  });
});

describe("formatThreadSecurity", () => {
  it("formats security summary", () => {
    const result = formatThreadSecurity({
      totalMessages: 4,
      allowedMessages: 3,
      manualConfirmMessages: 1,
      blockedMessages: 0,
      highestClassificationLevel: 1,
      partialContext: true,
      reasons: [],
    });
    assert.ok(result.includes("allow 3"));
    assert.ok(result.includes("manual 1"));
    assert.ok(result.includes("partial"));
    assert.ok(result.includes("block 0"));
  });

  it("returns dash for undefined", () => {
    assert.equal(formatThreadSecurity(undefined), "-");
  });
});

describe("formatModelInfo", () => {
  it("formats model info with vendor and name", () => {
    const result = formatModelInfo({ actualVendor: "OpenAI", actualName: "gpt-4o", usedFallback: false }, enLabels);
    assert.ok(result.includes("OpenAI"));
    assert.ok(result.includes("gpt-4o"));
  });

  it("returns dash when all fields empty", () => {
    assert.equal(formatModelInfo({}, enLabels), "-");
  });
});

describe("formatPriority", () => {
  it("translates high to Chinese for zh-CN labels", () => {
    assert.equal(formatPriority("high", zhLabels), "高");
  });

  it("translates medium to Chinese for zh-CN labels", () => {
    assert.equal(formatPriority("medium", zhLabels), "中");
  });

  it("passes through for en-US labels", () => {
    assert.equal(formatPriority("high", enLabels), "high");
  });

  it("returns dash for empty", () => {
    assert.equal(formatPriority("", enLabels), "-");
  });
});

describe("formatAnalyzeNextLabel", () => {
  it("includes batch size from config", () => {
    const result = formatAnalyzeNextLabel(enLabels, { analysisBatchSize: 10 });
    assert.ok(result.includes("10"));
  });
});

describe("formatRangeMeta", () => {
  it("formats maxItems mode", () => {
    const result = formatRangeMeta({ rangeMode: "maxItems", maxItems: 50 }, enLabels);
    assert.ok(result.includes("50"));
  });

  it("formats recentHours mode", () => {
    const result = formatRangeMeta({ rangeMode: "recentHours", recentHours: 24 }, enLabels);
    assert.ok(result.includes("24"));
    assert.ok(result.includes("h"));
  });

  it("returns dash for unknown mode", () => {
    assert.equal(formatRangeMeta({}, enLabels), "-");
  });
});

describe("formatSelectedModel", () => {
  it("returns dash when no model selected", () => {
    assert.equal(formatSelectedModel("", []), "-");
  });

  it("returns value as-is when no matching model found", () => {
    assert.equal(formatSelectedModel("unknown-model", []), "unknown-model");
  });
});

describe("renderRangeValueControl", () => {
  it("renders recentHours control by default", () => {
    const html = renderRangeValueControl({ recentHours: 24 }, enLabels);
    assert.ok(html.includes("rangeValue"));
    assert.ok(html.includes("24"));
  });
});

describe("renderClassificationOptions", () => {
  it("renders 4 classification options", () => {
    const html = renderClassificationOptions(2, enLabels);
    assert.ok(html.includes("PUBLIC"));
    assert.ok(html.includes("selected"));
  });
});

describe("renderModelOptions", () => {
  it("returns not-loaded message when empty", () => {
    const html = renderModelOptions([], "", enLabels);
    assert.ok(html.includes(enLabels.settings.modelsNotLoaded));
  });
});
