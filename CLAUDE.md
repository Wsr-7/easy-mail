# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Easy Mail is a VS Code extension that collects emails from classic Outlook via VBScript COM automation, analyzes them with GitHub Copilot (via the VS Code Language Model API), and displays results in a webview dashboard. It runs entirely locally — no cloud services beyond Copilot.

The data pipeline:

```
cscript.exe collect-outlook-mails.vbs → mail-digest.md → VS Code extension parses into mail-store.json → Copilot analyzes → analysis-result.json → Dashboard webview + reports
```

## Build & Test Commands

```bash
npm run compile          # Clean out/ then tsc
npm test                 # Compile + run all tests via node --test
npm run package:vsix     # Build .vsix to releases/
```

Run a single test after compiling:

```bash
node --test out/test/digest.test.js
```

Tests use Node.js built-in `node:test` and `node:assert/strict` — no external test framework. Each test file lives at `src/test/<module>.test.ts` mirroring `src/lib/<module>.ts`.

## Architecture

### Extension entry point

`src/extension.ts` — the monolithic `EasyMailApp` class owns all state: mail store, analysis results, thread store, classification cache, dashboard webview, and the LLM provider. It registers all VS Code commands (`easyMail.*`) and the webview view provider. This single file is ~2600 lines.

### LLM abstraction

`LlmProvider` interface (`src/lib/llm-provider.ts`) with a single implementation `CopilotProvider` (`src/lib/copilot-provider.ts`) that wraps `vscode.lm.selectChatModels()`. The provider is pluggable by interface but currently only targets GitHub Copilot models.

### Data stores (all JSON, persisted to `globalStorageUri/data/`)

- **MailStore** (`mail-store.ts`) — raw pulled emails with retention/pruning, dedup via InternetMessageId/EntryId/hash
- **MailIndex** (`mail-store.ts`) — lightweight dedup index with folder anchors for "load more" pagination
- **ThreadStore** (`thread-store.ts` + `thread-engine.ts`) — groups mails into conversation threads by conversationId or normalized subject
- **ClassificationCache** (`classification.ts`) — security classification levels (PUBLIC/INTERNAL/REGISTERED/HIGH REGISTERED)
- **AnalysisResult** (`analysis-schema.ts`) — structured Copilot output with categories, priorities, draft replies
- **ThreadAnalysisResult** (`thread-analysis-schema.ts`) — thread-level analysis results

### Security gate

`security-gate.ts` + `security-types.ts` — decides per-mail and per-thread whether to allow/block/require-manual-confirm for Copilot analysis based on classification level. Mails above the configured threshold are never sent to Copilot automatically.

### Prompt system

Prompts live in `prompts/` as markdown/JSON files:
- `base-system.md` — system prompt for single-mail analysis
- `output-schema.md` — JSON output schema instruction
- `thread-base-system.md` + `thread-analysis-prompt.md` + `thread-output-schema.md` — thread analysis
- `reply-draft-prompt.md` + `reply-template.md` — draft reply generation with template placeholders
- `prompt-config.default.json` — category definitions (user-customizable copy at globalStorageUri)

`prompt-config.ts` composes the final prompt from these parts. Categories are customizable via the prompt config JSON.

### Mail collection

`scripts/collect-outlook-mails.vbs` — VBScript that talks to Outlook COM. Called via `cscript.exe` from the extension. Accepts CLI args for range, folders, body truncation, sample mode, and "older-than" anchors for pagination. Outputs `mail-digest.md` in a structured markdown format parsed by `digest.ts`.

### Reports

Three report generators in `src/lib/`: `report-daily.ts`, `report-single-mail.ts`, `report-thread.ts` — produce markdown reports from analysis results.

### i18n

Dual-locale support (zh-CN / en-US) via a `LABELS` object in `extension.ts`. Analysis results carry a `language` field; switching locale can trigger LLM-based translation of existing results (`analysis-translation.ts`).

## Key Conventions

- All config is read from VS Code settings (`easyMail.*` namespace), merged with `default-config.json` defaults
- Analysis categories: `importantSender`, `mustHandleToday`, `risk`, `waitingForMe`, `followUp`, `notice`, `ignored`, `uncertain`
- Priorities: P0–P3
- Mail IDs use `InternetMessageId` or `EntryId` for dedup; hash fallback when both are missing
- The extension uses `vscode.ExtensionContext.globalStorageUri` for all persistent data — never writes to the workspace folder
- Dashboard is a webview (HTML generated in `getDashboardHtml()` inside extension.ts)
- The `--sample` flag generates fake mail data for demo/testing without Outlook
