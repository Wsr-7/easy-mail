import test from "node:test";
import assert from "node:assert/strict";
import { redactText } from "../lib/redaction";
import type { RedactionPolicy } from "../lib/redaction";

const basePolicy: RedactionPolicy = {
  enabled: true,
  redactEmail: false,
  redactPhone: false,
  redactUrl: false,
  redactIp: false,
  redactToken: false,
  redactMoney: false,
  redactIdLike: false,
  customPatterns: []
};

test("redactText replaces email addresses without exposing original values in findings", () => {
  const result = redactText("Contact alice@example.com and bob@example.org.", {
    ...basePolicy,
    redactEmail: true
  });

  assert.equal(result.text, "Contact [EMAIL_1] and [EMAIL_2].");
  assert.equal(result.stats.totalReplacements, 2);
  assert.equal(result.stats.byType.email, 2);
  assert.deepEqual(result.findings, [{ type: "email", replacement: "[EMAIL_1]", count: 2 }]);
  assert.equal(JSON.stringify(result.findings).includes("alice@example.com"), false);
});

test("redactText replaces URLs", () => {
  const result = redactText("Open https://example.com/path?token=abc for details.", {
    ...basePolicy,
    redactUrl: true
  });

  assert.equal(result.text, "Open [URL_1] for details.");
  assert.equal(result.stats.byType.url, 1);
});

test("redactText replaces token assignments", () => {
  const result = redactText("Use access_token=abc123 and password: hunter2.", {
    ...basePolicy,
    redactToken: true
  });

  assert.equal(result.text, "Use [SECRET_1] and [SECRET_2].");
  assert.equal(result.stats.byType.secret, 2);
});

test("redactText replaces IPv4 addresses", () => {
  const result = redactText("Server 10.20.30.40 failed, 999.20.30.40 did not match.", {
    ...basePolicy,
    redactIp: true
  });

  assert.equal(result.text, "Server [IP_1] failed, 999.20.30.40 did not match.");
  assert.equal(result.stats.byType.ip, 1);
});

test("redactText replaces money amounts", () => {
  const result = redactText("Budget is USD 12,500.00 plus $300.", {
    ...basePolicy,
    redactMoney: true
  });

  assert.equal(result.text, "Budget is [MONEY_1] plus [MONEY_2].");
  assert.equal(result.stats.byType.money, 2);
});

test("redactText replaces phone numbers", () => {
  const result = redactText("Call +1 (415) 555-0100 or 021-55556666.", {
    ...basePolicy,
    redactPhone: true
  });

  assert.equal(result.text, "Call [PHONE_1] or [PHONE_2].");
  assert.equal(result.stats.byType.phone, 2);
});

test("redactText returns input unchanged when policy is disabled", () => {
  const text = "alice@example.com has access_token=abc123.";
  const result = redactText(text, {
    ...basePolicy,
    enabled: false,
    redactEmail: true,
    redactToken: true
  });

  assert.equal(result.text, text);
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.stats, { totalReplacements: 0, byType: {} });
});

test("redactText applies custom patterns", () => {
  const result = redactText("Project Phoenix and Project Atlas are confidential.", {
    ...basePolicy,
    customPatterns: [
      {
        id: "projectName",
        pattern: "Project\\s+[A-Z][a-z]+",
        replacement: "[PROJECT]"
      }
    ]
  });

  assert.equal(result.text, "[PROJECT] and [PROJECT] are confidential.");
  assert.equal(result.stats.byType.projectName, 2);
  assert.deepEqual(result.findings, [{ type: "projectName", replacement: "[PROJECT]", count: 2 }]);
});
