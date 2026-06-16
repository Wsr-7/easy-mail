import test from "node:test";
import assert from "node:assert/strict";
import { parseAnalysisJson } from "../lib/analysis-schema";

test("parseAnalysisJson accepts fenced JSON and normalizes overview", () => {
  const analysis = parseAnalysisJson(`\`\`\`json
{
  "generatedAt": "2026-06-16T10:35:00+08:00",
  "items": [
    {
      "mailId": "mail-001",
      "category": "mustHandleToday",
      "priority": "P0",
      "subject": "Contract approval needed",
      "sender": "Alice",
      "receivedTime": "2026-06-16 09:12:00",
      "summary": "Approval needed today.",
      "reason": "Contains a deadline.",
      "suggestedAction": "Reply today.",
      "draftReply": "I will reply today."
    }
  ]
}
\`\`\``);

  assert.equal(analysis.items.length, 1);
  assert.equal(analysis.overview.mustHandleToday, 1);
  assert.equal(analysis.items[0].priority, "P0");
});

