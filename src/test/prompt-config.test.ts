import test from "node:test";
import assert from "node:assert/strict";
import { composeAnalysisPrompt, normalizePromptConfig } from "../lib/prompt-config";

test("composeAnalysisPrompt includes custom categories and language instruction", () => {
  const config = normalizePromptConfig({
    categories: [
      { id: "vipCustomer", labelZh: "VIP 客户", labelEn: "VIP Customer", description: "Important customer mail" }
    ],
    replyDraftInstruction: "Keep replies short."
  });
  const prompt = composeAnalysisPrompt({
    basePrompt: "Base",
    outputSchemaPrompt: "Schema",
    digestText: "Digest",
    outputLanguage: "zh-CN",
    promptConfig: config
  });
  assert.match(prompt, /vipCustomer/);
  assert.match(prompt, /Keep replies short/);
  assert.match(prompt, /Simplified Chinese/);
});
