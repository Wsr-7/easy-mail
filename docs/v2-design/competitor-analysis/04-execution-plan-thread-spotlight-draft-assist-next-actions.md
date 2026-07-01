# Easy Mail Execution Plan: Thread Spotlight, Draft Assist, Next Actions

Created: 2026-07-01  
Status: Draft for implementation  

---

## 0. Multi-Agent Collaboration Rules

This file is designed to be passed between multiple coding agents. Every agent must keep it current. If you are not Claude, read AGENTS.md first instead of CLAUDE.md.

### 0.1 Status Markers

Use these markers in task lists:

```text
[ ] Not started
[~] In progress
[X] Done
[!] Blocked
[-] Skipped / intentionally deferred
```

Rules:

- Do not mark a step `[X]` until its acceptance criteria are satisfied.
- If a step is partially complete, leave it `[~]` and write a handover note.
- If a step is blocked, mark `[!]`, explain the blocker, and state the next recommended action.
- If a step is intentionally deferred, mark `[-]` and explain why.

### 0.2 Required Agent Start Procedure

Before making code changes, every agent must:

- [ ] Read this file completely.
- [ ] Read the latest entry in `## 9. Handover Log`.
- [ ] Check `git status --short`.
- [ ] Inspect relevant files before editing.
- [ ] Claim exactly one step or sub-step by changing its status to `[~]`.
- [ ] For any non-trivial step, add a short pre-work checkpoint to `## 9. Handover Log` before editing code.
- [ ] Add an entry to `## 8. Current Snapshot Updates` if the snapshot is stale.

### 0.3 Required Agent Finish Procedure

Before handing off, every agent must:

- [ ] Update the status marker of each touched step.
- [ ] Fill the step-level `Completion Notes`.
- [ ] Record files changed.
- [ ] Record tests run and results.
- [ ] Record known gaps or risks.
- [ ] Add a new entry to `## 9. Handover Log`.
- [ ] If the agent is near model/tool/time limit, stop implementation work and update this plan before continuing.
- [ ] Leave the repo in a readable state.

### 0.4 Handover Note Format

Use this format after each completed or blocked step:

```md
#### Handover - <YYYY-MM-DD HH:mm> - <Agent Name or ID>

Status: Done / In progress / Blocked / Deferred

Changed:
- ...

Validated:
- ...

Known issues:
- ...

Last safe stopping point:
- ...

Uncommitted changes / dirty files:
- ...

Next recommended step:
- ...
```

### 0.5 Do Not Do Without Explicit Decision

Do not add these in the MVP unless the plan is updated first:

- Auto-send email.
- Silent write-back to Outlook without a user click.
- Persistent draft variant store.
- Style preset management UI.
- Shortcut buttons for draft tone/length.
- Per-Spotlight-item source jump logic.
- Multiple Outlook windows opened from one Spotlight click.
- Outlook task creation.
- System reminder creation.
- Multi-device sync.

### 0.6 Limit-Aware Checkpoint Protocol

Agents may hit model, tool, or time limits before finishing a step. To reduce handoff loss, every agent must prefer small checkpoints over long uninterrupted work.

Before a non-trivial step:

- Add a short `Starting <step>` handover entry before editing code.
- State the exact step claimed, intended files, and first validation target.
- Keep the step status `[~]` while work is ongoing.

During implementation:

- Work in small, reviewable slices.
- After each meaningful slice, update the step `Completion Notes` or append a brief handover note.
- If a slice changes behavior, record the files changed and the validation still needed.
- Do not wait until the whole milestone is done to update this plan.

When limit/budget feels low:

- Stop coding immediately.
- Do not start a new file or a new refactor.
- Update the current step status as `[~]` or `[!]`.
- Add a handover entry with:
  - what was completed;
  - what was changed;
  - what was not tested;
  - the last safe stopping point;
  - the next exact command or file to inspect.

If an agent is interrupted before updating this plan:

- The next agent must treat all `[~]` steps as potentially stale.
- Run `git status --short` first.
- Inspect `git diff` for tracked files and list untracked files.
- Compare changed files against the claimed step.
- Reconstruct progress from code/tests, then add a recovery handover entry before continuing.
- Do not assume a `[~]` step is safe to continue until the dirty working tree is understood.

Recovery handover format:

```md
#### Handover - <YYYY-MM-DD HH:mm> - <Agent Name or ID> - Recovery

Status: Recovered interrupted work

Observed dirty state:
- ...

Likely completed:
- ...

Unverified or risky:
- ...

Action taken:
- continued / reverted / paused / marked blocked

Next recommended step:
- ...
```

### 0.7 Git Checkpoint Protocol

Use Git as a recovery and traceability layer, but do not let Git operations hide uncertainty.

Default policy:

- Local commits are expected after each completed, coherent, reviewable step.
- If an agent decides not to commit a completed step, it must record the reason in the handover.
- Push is **not** allowed by default.
- Push only when the user explicitly requests it or the project/branch policy says to push.
- Never force-push, rebase shared history, amend another agent's commit, or rewrite history unless explicitly instructed.

Before any commit:

- Run `git status --short`.
- Review the diff for files touched by the current step.
- Stage only files intentionally changed for the current step.
- Do not stage unrelated user changes, unrelated untracked files, screenshots, build artifacts, logs, or local environment files.
- If unrelated dirty files exist, mention them in the handover and leave them unstaged.

When to commit:

- Commit after a step is `[X]` and its acceptance criteria are satisfied.
- Commit after a meaningful sub-step if it is coherent, compiles or is otherwise safe to hand off, and the handover explains remaining work.
- If near a limit and changes are coherent but not fully validated, a local WIP commit is allowed with a clear `wip:` prefix and explicit unverified notes in the handover.
- If changes are experimental, broken, or hard to explain, do not commit them. Record the dirty state and mark the step `[~]` or `[!]`.

Suggested commit message format:

```text
<step-id>: <short outcome>

Examples:
A2: add Workbench thread spotlight
B2: make draft reply editable
C2: add Outlook compose script
wip B5: draft polish prompt wiring, tests pending
```

After commit:

- Record the commit hash in the step `Completion Notes` and `## 9. Handover Log`.
- Record validation status: `compile pass`, `tests pass`, `targeted tests pass`, or `not run` with reason.
- Leave the working tree clean for files owned by the completed step, unless the handover explicitly explains remaining dirty files.

Push policy:

- Do not push by default.
- Before pushing, confirm the target branch and remote.
- Do not push WIP commits unless explicitly requested.
- Do not push if unrelated user changes are staged or included.
- If push is requested, record remote, branch, commit hash, and result in the handover.

Recovery rules for existing commits:

- If taking over after another agent, inspect recent commits with `git log --oneline -5`.
- Match commit messages to step IDs.
- If a commit exists but the plan was not updated, update the plan with a recovery handover before continuing.
- Do not revert another agent's commit unless the reason is clear and recorded.

---

## Context References

This file is the implementation source of truth. Normal coding agents do not need to read the references below unless they are changing product scope, resolving ambiguity, or doing a design review.

- `docs/v2-design/competitor-analysis/03-gap-and-feature-plan.md` explains the earlier broader feature plan.
- The follow-up product discussion narrowed that plan into this execution scope: editable Draft Assist, no Thread Spotlight source jumps, Outlook Reply/Reply All/Forward compose windows, no style shortcuts/presets, and `Next Actions` naming.

---

## 1. Final Product Decisions

This plan intentionally narrows the original competitor-inspired feature plan into small, testable implementation slices.

### 1.1 Thread Spotlight

Decision:

- Build a small, stable Thread Spotlight UI/report enhancement.
- Show existing thread analysis fields more clearly.
- Do **not** add per-item source jumps in the MVP.
- Keep source verification through the existing thread timeline and existing `Open in Outlook` behavior for each original email.

Rationale:

- Some conclusions can be supported by multiple emails.
- Per-decision source jump creates product ambiguity: which email to open, whether to open multiple emails, how to rank sources, and how to handle weak evidence.
- The MVP should focus on making the thread state readable, not building a full evidence navigation system.

MVP mental model:

```text
Spotlight = read the conclusion.
Timeline = inspect original emails.
Open in Outlook = verify in the real mailbox.
```

---

### 1.2 Draft Assist

Decision:

- Replace the read-only draft area with an editable draft area.
- The draft area starts with the AI-generated `draftReply` when available.
- User can edit it or write their own reply directly.
- `Polish` and `Refine` always use the associated mail/thread context and the existing analysis result.
- No checkbox or mode selector for context usage.
- No shortcut buttons in the first version.
- Use a light hint only:

```text
Not satisfied? Draft your own reply, then refine or polish it.
```

Behavior:

- `Polish`: improve the current draft text while preserving intent.
- `Refine`: rewrite the current draft text according to the user instruction.
- `Copy`: copy the current editable draft text.
- `Open Reply`: open Outlook Reply compose window and prefill current draft body.
- `Open Reply All`: open Outlook Reply All compose window and prefill current draft body.
- `Open Forward`: open Outlook Forward compose window and prefill current draft body.

Safety boundary:

- Easy Mail must never auto-send.
- Easy Mail may open Outlook compose/reply/forward windows only after an explicit user click.
- Outlook should handle recipients, `Re:` / `FW:` subject, thread metadata, signature, and quoted history.
- The user makes the final send decision in Outlook.

---

### 1.3 Tone / Style

Decision:

- Do not build a style preset system now.
- Do not add shortcut buttons now.
- Use one default style in prompts:

```text
concise, professional, internal workplace tone
```

Rationale:

- Current target use case is mostly internal company email.
- A custom instruction field is enough for the first version.
- Extra shortcuts/presets add UI noise and decision overhead.

---

### 1.4 Next Actions

Decision:

- Rename the proposed `Local Follow-up / Action Queue` to `Next Actions`.
- Keep existing `followUp` category as a mail/thread classification.
- `Next Actions` is a concrete task queue extracted from analyzed mails/threads.

Difference:

```text
followUp category = this mail/thread belongs to a follow-up bucket.
Next Actions = concrete tasks extracted from mail/thread analysis.
```

MVP order:

- Do not implement Next Actions before Thread Spotlight is stable.
- The first useful source is `ThreadAnalysisItem.actionItems`.
- Later sources may include `AnalysisItem.suggestedAction` and `ThreadAnalysisItem.suggestedAction`.

---

## 2. Current Snapshot

Last updated: 2026-07-01 initial plan

Current known state:

- `StoredMail` contains `entryId` and optional `storeId`.
- `scripts/open-outlook-mail.vbs` can open an Outlook item using `entryId` / `storeId`.
- Existing thread analysis schema already contains many Spotlight fields:
  - `currentStatus`
  - `keyDecisions`
  - `openQuestions`
  - `actionItems`
  - `waitingOn`
  - `risks`
  - `needMyReply`
  - `suggestedAction`
  - `draftReply`
  - `evidence`
  - `partialContext`
- Current Workbench/Dashboard display does not fully surface all of these fields.
- Current draft UI is mostly read-only/copy-oriented.
- Existing `followUp` is a category, not a task queue.

Open implementation questions:

- Need to verify current timeline `Open in Outlook` behavior before changing Thread Spotlight.
- Need to verify how classic Outlook handles signature and quoted history when setting `reply.HTMLBody` after `Display`.
- Need to decide whether Draft Assist first lives only in Workbench, or both Dashboard and Workbench.

---

## 3. Recommended Implementation Order

### Milestone A: Thread Spotlight MVP

Goal:

- Make thread analysis output immediately useful without changing model calls or schema.
- Show existing fields clearly.
- Do not add source jump complexity.

Status: [ ] Not started

Steps:

- [ ] A1. Inspect current thread rendering paths.
- [ ] A2. Add `Thread Spotlight` section to Workbench thread detail.
- [ ] A3. Expand Dashboard thread summary to show key fields where space allows.
- [ ] A4. Update thread report rendering.
- [ ] A5. Add or update tests.
- [ ] A6. Run validation.

Acceptance goal:

- A user can open a thread and quickly see status, decisions, questions, actions, waiting-on, risks, need-my-reply, and suggested action.
- No new model call is required.
- No new source jump UI is added.
- Existing timeline `Open in Outlook` remains the way to verify original emails.

---

### Milestone B: Draft Assist MVP

Goal:

- Turn draft reply from a static generated result into an editable, polishable, refinable working draft.

Status: [ ] Not started

Steps:

- [ ] B1. Inspect current draft rendering and copy behavior.
- [ ] B2. Make draft area editable in the target UI surface.
- [ ] B3. Add light hint text.
- [ ] B4. Add instruction input.
- [ ] B5. Add `Polish` action.
- [ ] B6. Add `Refine` action.
- [ ] B7. Store temporary working draft state in extension host memory.
- [ ] B8. Keep `Copy` using current editable draft text.
- [ ] B9. Add or update tests.
- [ ] B10. Run validation.

Acceptance goal:

- User can edit the generated draft directly.
- User can replace it with their own draft.
- `Polish` improves the current text without changing intent.
- `Refine` uses the custom instruction.
- Both actions use associated mail/thread context and analysis result.
- Draft state is temporary and not persisted to disk.

---

### Milestone C: Open Outlook Compose Window

Goal:

- Let users move from Easy Mail draft to Outlook compose window without copy/paste.

Status: [ ] Not started

Steps:

- [ ] C1. Inspect existing `open-outlook-mail.vbs` and message-handler open behavior.
- [ ] C2. Add a new script for Outlook compose actions.
- [ ] C3. Support `reply` mode.
- [ ] C4. Support `replyAll` mode.
- [ ] C5. Support `forward` mode.
- [ ] C6. Insert current draft body at the top of the Outlook compose body.
- [ ] C7. Preserve Outlook-managed recipients, subject, signature, and quoted history as much as possible.
- [ ] C8. Add UI buttons: `Open Reply`, `Open Reply All`, `Open Forward`.
- [ ] C9. Add or update tests for command construction and message handling.
- [ ] C10. Manually validate in classic Outlook if available.

Acceptance goal:

- Explicit user click opens Outlook compose window.
- Draft body is prefilled.
- No email is sent automatically.
- Reply/Reply All/Forward use Outlook's native behavior for recipients, subject, and quoted history.
- If Outlook compose prefill fails, user receives a clear error and can still use `Copy`.

---

### Milestone D: Next Actions MVP

Goal:

- Convert structured action items into a local task-like queue without confusing it with the existing `followUp` category.

Status: [ ] Not started

Steps:

- [ ] D1. Inspect current category and thread action item usage.
- [ ] D2. Define `NextActionItem` local type.
- [ ] D3. Define dedupe key.
- [ ] D4. Create local store only if needed for MVP.
- [ ] D5. Extract from `ThreadAnalysisItem.actionItems` first.
- [ ] D6. Add UI surface named `Next Actions`.
- [ ] D7. Add basic statuses: `open`, `done`, `ignored`.
- [ ] D8. Add source open behavior by reusing existing mail/thread open behavior, not new source logic.
- [ ] D9. Add or update tests.
- [ ] D10. Run validation.

Acceptance goal:

- User can see concrete tasks under `Next Actions`.
- Existing `followUp` category remains unchanged.
- No Outlook task is created.
- No system reminder is created.
- No duplicate action item is created from the same source/task pair.

---

## 4. Detailed Step Plan

## A. Thread Spotlight MVP

### A1. Inspect current thread rendering paths

Status: [X] Done

Likely files:

- `src/lib/workbench-render.ts`
- `src/lib/dashboard-render.ts`
- `src/lib/report-thread.ts`
- `src/lib/thread-analysis-schema.ts`
- Existing related tests

Tasks:

- [ ] Find where thread analysis is rendered in Workbench.
- [ ] Find where thread summary is rendered in Dashboard.
- [ ] Find where thread report is rendered.
- [ ] Confirm current timeline `Open in Outlook` behavior.
- [ ] Confirm available labels/i18n helpers.

Acceptance criteria:

- Agent can state exactly which functions need changes.
- Agent can confirm whether timeline already supports opening individual mails in Outlook.

Completion Notes:

- Status: Done
- Files inspected:
  - `src/lib/workbench-render.ts`
  - `src/lib/dashboard-render.ts`
  - `src/lib/report-thread.ts`
  - `src/lib/thread-analysis-schema.ts`
  - `src/lib/dashboard-labels.ts`
  - `src/lib/message-handler.ts`
  - `src/extension.ts`
  - `scripts/open-outlook-mail.vbs`
  - `src/test/workbench-render.test.ts`
  - `src/test/dashboard-render.test.ts`
  - `src/test/report-thread.test.ts`
  - `src/test/message-handler.test.ts`
- Findings:
  - Workbench thread analysis is rendered in `renderThreadDetail` in `src/lib/workbench-render.ts`. It currently shows `currentStatus`, `actionItems`, `risks`, and `draftReply`; A2 should add the compact `Thread Spotlight` section there.
  - Dashboard thread summary is rendered through `renderThreadsPanel` -> `renderThreadCard` -> `renderThreadAnalysisSummary` in `src/lib/dashboard-render.ts`. It currently shows `currentStatus`, full `actionItems`, full `risks`, and `draftReply`; A3 should keep this truncated and scannable.
  - Thread report rendering is `buildThreadReport` in `src/lib/report-thread.ts`. It already renders most existing thread fields, but A4 should align the structure with the Spotlight shape and omit empty sections.
  - Available thread schema fields are already present in `ThreadAnalysisItem`; no schema or prompt change is needed for Milestone A.
  - Label helpers are `DashboardLabels`, `LABELS`, and `getLabels` in `src/lib/dashboard-labels.ts`. New UI labels are needed for `Thread Spotlight`, `keyDecisions`, `openQuestions`, `waitingOn`, `needMyReply`, `partialContext`, and possibly thread-level `suggestedAction`.
  - Workbench timeline already supports opening individual timeline mails: each timeline message with `mailId` renders a `data-action="openInOutlook"` button. The message handler dispatches to `openMailInOutlook(mailId)`, which resolves `entryId`/`storeId` through mail index/store/analysis source and calls `scripts/open-outlook-mail.vbs`.
  - Dashboard timeline currently shows mail ID anchors only, not direct Outlook buttons.
- Tests run: Not run; A1 was inspection/documentation only.
- Commit: `a8427e7ddfc2f94dfad4a5571114f1d16a493c58`
- Handover: See `Handover - 2026-07-02 01:03 - Codex`.

---

### A2. Add Thread Spotlight to Workbench thread detail

Status: [X] Done

Goal:

- Add a compact section near the top of thread detail.

Display fields:

- `currentStatus`
- `keyDecisions`
- `openQuestions`
- `actionItems`
- `waitingOn`
- `risks`
- `needMyReply`
- `suggestedAction`
- `partialContext` warning if present

Do not add:

- Per-item source chips.
- Multi-source selection.
- New schema.
- New model prompt.

Acceptance criteria:

- Spotlight appears only when thread analysis exists.
- Empty sections are hidden.
- Partial context/security warning is visible when applicable.
- Existing timeline remains available below.

Completion Notes:

- Status: Done
- Files changed:
  - `src/lib/workbench-render.ts`
  - `src/lib/dashboard-labels.ts`
  - `src/test/workbench-render.test.ts`
- Visual/HTML behavior:
  - Workbench thread detail now renders a `Thread Spotlight` section only when thread analysis exists.
  - Spotlight shows `currentStatus`, `keyDecisions`, `openQuestions`, `actionItems`, `waitingOn`, `risks`, `needMyReply`, `suggestedAction`, `draftReply`, and a partial-context warning when present.
  - Empty list sections are hidden.
  - Timeline remains below Spotlight and keeps the existing per-mail `openInOutlook` button behavior.
  - No per-item source chips, multi-source selection, schema change, or prompt change was added.
- Tests run:
  - `npm run compile`: pass
  - `npm test -- --test-name-pattern=renderWorkbenchHtml`: pass, 218 tests reported passing
- Commit: `ec4071a757c4e3d386bd080c216da263b5f0c2a6`
- Handover: See `Handover - 2026-07-02 00:53 - Codex`.

---

### A3. Expand Dashboard thread summary carefully

Status: [X] Done

Goal:

- Surface the most important thread fields without making cards too noisy.

Recommended Dashboard fields:

- `currentStatus`
- `needMyReply`
- Top action items
- Top risks
- Maybe first 1-2 open questions if concise

Avoid:

- Full long decision lists.
- Evidence/source logic.
- Large duplicated content already visible in Workbench.

Acceptance criteria:

- Dashboard remains scannable.
- Long lists are truncated.
- Workbench remains the full detail view.

Completion Notes:

- Status: Done
- Files changed:
  - `src/lib/dashboard-render.ts` — `renderThreadAnalysisSummary` expanded with `needMyReply`, `openQuestions`, truncation to 2 items per list with overflow indicator, empty sections hidden
  - `src/test/dashboard-render.test.ts` — added 10 tests for `renderThreadAnalysisSummary`
- Truncation behavior: actionItems, risks, openQuestions each capped at 2 items; overflow shows `(+N)` count
- Tests run:
  - `npm run compile`: pass
  - `npm test -- --test-name-pattern=renderThreadAnalysisSummary`: pass, 228 tests total
- Commit: (pending)
- Handover: See `Handover - 2026-07-02 - Claude Opus`

---

### A4. Update thread report rendering

Status: [ ] Not started

Goal:

- Make generated thread report reflect the same Spotlight structure.

Acceptance criteria:

- Report includes the same major sections as Workbench Spotlight.
- Report does not introduce source jump links that do not exist.
- Empty sections are omitted.

Completion Notes:

- Status:
- Files changed:
- Tests run:
- Handover:

---

### A5. Add or update tests

Status: [ ] Not started

Recommended tests:

- Workbench renders decisions/questions/waitingOn.
- Dashboard truncates long lists.
- Thread report omits empty sections.
- Partial context warning appears.

Acceptance criteria:

- Tests fail before implementation if possible.
- Tests pass after implementation.

Completion Notes:

- Status:
- Tests added/changed:
- Handover:

---

### A6. Run validation

Status: [ ] Not started

Commands:

```powershell
npm run compile
npm test
```

If full `npm test` is too slow or blocked, run targeted tests and record the limitation.

Acceptance criteria:

- Compile passes.
- Relevant tests pass.
- Any skipped/full-suite limitation is recorded.

Completion Notes:

- Status:
- Commands run:
- Results:
- Handover:

---

## B. Draft Assist MVP

### B1. Inspect current draft rendering and copy behavior

Status: [ ] Not started

Likely files:

- `src/lib/dashboard-render.ts`
- `src/lib/workbench-render.ts`
- `src/lib/message-handler.ts`
- `src/lib/app-analysis.ts`
- Prompt builder files under `src/lib` or `prompts/`
- Existing draft/copy tests

Tasks:

- [ ] Find `renderDraftBox` or equivalent.
- [ ] Find `copyDraft` message handler.
- [ ] Identify how webview sends actions to extension host.
- [ ] Identify where source mail/thread context can be retrieved for refine/polish.
- [ ] Identify existing redaction/security gate flow to reuse.

Acceptance criteria:

- Agent can state exact data path for current draft text from UI to extension host.
- Agent can state exact context source for mail and thread refine/polish.

Completion Notes:

- Status:
- Files inspected:
- Findings:
- Handover:

---

### B2. Make draft area editable

Status: [ ] Not started

Goal:

- Replace read-only `<pre>` style draft display with editable text area while preserving existing draft text.

Requirements:

- Default content = current `draftReply`.
- User can fully replace the text.
- UI should not imply the draft is already saved to Outlook.
- Keep `Copy` behavior.

Acceptance criteria:

- User can edit draft text in UI.
- Edited text is used by subsequent actions.
- Existing copy behavior still works, now using current text area value.

Completion Notes:

- Status:
- Files changed:
- UX notes:
- Tests run:
- Handover:

---

### B3. Add light hint text

Status: [ ] Not started

Text:

```text
Not satisfied? Draft your own reply, then refine or polish it.
```

Requirements:

- Keep it subtle.
- Do not make it a large banner.
- Avoid extra explanation.

Acceptance criteria:

- Hint appears near draft area.
- Hint does not dominate the UI.

Completion Notes:

- Status:
- Files changed:
- Handover:

---

### B4. Add instruction input

Status: [ ] Not started

Goal:

- Add a simple optional instruction field for `Refine`.

Suggested placeholder:

```text
Optional instruction, e.g. make it shorter or ask them to confirm the deadline
```

Requirements:

- No shortcut buttons.
- No style selector.
- No context checkbox.

Acceptance criteria:

- User can enter custom instruction.
- `Refine` reads the instruction.
- `Polish` can run without instruction.

Completion Notes:

- Status:
- Files changed:
- Handover:

---

### B5. Add Polish action

Status: [ ] Not started

Goal:

- Improve current draft text without changing user intent.

Prompt requirements:

- Use associated mail/thread context and existing analysis result.
- Preserve factual claims unless context supports a correction.
- Keep default style: concise, professional, internal workplace tone.
- Output English plain text for the reply body.

Acceptance criteria:

- Empty draft gives clear error.
- Polish returns a replacement draft text.
- User can review before copying/opening Outlook.
- Security gate/redaction path is reused.

Completion Notes:

- Status:
- Files changed:
- Prompt behavior:
- Tests run:
- Handover:

---

### B6. Add Refine action

Status: [ ] Not started

Goal:

- Rewrite current draft according to user instruction.

Prompt requirements:

- Use current editable draft text.
- Use custom instruction.
- Use associated mail/thread context and analysis result.
- Keep default style unless user instruction overrides it.
- Output English plain text for the reply body.

Acceptance criteria:

- Empty draft gives clear error.
- Empty instruction gives clear error or suggests using `Polish`.
- Refine returns a replacement draft text.
- Result is reviewable before copying/opening Outlook.
- Security gate/redaction path is reused.

Completion Notes:

- Status:
- Files changed:
- Prompt behavior:
- Tests run:
- Handover:

---

### B7. Store temporary working draft state in extension host memory

Status: [ ] Not started

Goal:

- Keep working draft state stable during a session without writing to disk.

Recommended structure:

```ts
Map<string, WorkingDraftState>
```

Suggested key:

```text
mail:<mailId>
thread:<threadId>
```

Clear rules:

- VS Code reload / extension host restart clears it naturally.
- `Clear Local Cache` clears it.
- Re-analysis of the same mail/thread clears or refreshes it.
- Maximum one working draft per mail/thread for MVP.

Acceptance criteria:

- Current working draft survives light webview refresh if feasible.
- Current working draft is not written to disk.
- Clear cache removes it.

Completion Notes:

- Status:
- Files changed:
- State behavior:
- Tests run:
- Handover:

---

### B8. Keep Copy using current editable text

Status: [ ] Not started

Goal:

- Copy must use what the user sees now, not the original generated draft.

Acceptance criteria:

- If user edits text and clicks Copy, copied content matches current edited text.
- If Polish/Refine updates text and user clicks Copy, copied content matches the updated result.

Completion Notes:

- Status:
- Files changed:
- Tests run:
- Handover:

---

### B9. Add or update tests

Status: [ ] Not started

Recommended tests:

- Editable draft value is used for copy.
- Polish message includes current draft text.
- Refine message includes current draft text and instruction.
- Empty draft error.
- Empty refine instruction behavior.
- Temporary state clear behavior if implemented separately.

Acceptance criteria:

- Tests cover both mail and thread draft surfaces if both are implemented.
- If only one surface is implemented in the MVP, document the limitation.

Completion Notes:

- Status:
- Tests added/changed:
- Handover:

---

### B10. Run validation

Status: [ ] Not started

Commands:

```powershell
npm run compile
npm test
```

Acceptance criteria:

- Compile passes.
- Relevant tests pass.
- Any skipped/full-suite limitation is recorded.

Completion Notes:

- Status:
- Commands run:
- Results:
- Handover:

---

## C. Open Outlook Compose Window

### C1. Inspect existing Outlook open behavior

Status: [ ] Not started

Likely files:

- `scripts/open-outlook-mail.vbs`
- `src/lib/message-handler.ts`
- Script invocation helpers
- Tests around Outlook open commands

Tasks:

- [ ] Confirm how `entryId` and `storeId` are passed today.
- [ ] Confirm how command failures are surfaced to user.
- [ ] Confirm whether current script execution supports passing a body file path safely.

Acceptance criteria:

- Agent can state exact implementation path for new compose script.

Completion Notes:

- Status:
- Files inspected:
- Findings:
- Handover:

---

### C2. Add Outlook compose script

Status: [ ] Not started

Recommended script:

```text
scripts/compose-outlook-mail.vbs
```

Recommended arguments:

```text
--entry-id <entry-id>
--store-id <store-id optional>
--mode reply|replyAll|forward
--body-file <path>
```

Behavior:

- Use `Outlook.Application`.
- Use `GetNamespace("MAPI")`.
- Use `GetItemFromID(entryId, storeId?)`.
- Use native Outlook method:
  - `item.Reply`
  - `item.ReplyAll`
  - `item.Forward`
- Call `Display`.
- Insert draft body at top.
- Do not call `Send`.

Acceptance criteria:

- Script validates required args.
- Script rejects unsupported mode.
- Script does not send.
- Script produces clear stderr on failure.

Completion Notes:

- Status:
- Files changed:
- Handover:

---

### C3. Support Reply mode

Status: [ ] Not started

Acceptance criteria:

- Opens native Outlook reply compose window.
- Draft appears at top of body.
- Outlook manages recipient and subject.
- No send is triggered.

Completion Notes:

- Status:
- Validation:
- Handover:

---

### C4. Support Reply All mode

Status: [ ] Not started

Acceptance criteria:

- Opens native Outlook reply-all compose window.
- Draft appears at top of body.
- Outlook manages recipients and subject.
- No send is triggered.

Completion Notes:

- Status:
- Validation:
- Handover:

---

### C5. Support Forward mode

Status: [ ] Not started

Acceptance criteria:

- Opens native Outlook forward compose window.
- Draft appears at top of body.
- Outlook manages `FW:` subject and quoted original content.
- Recipient can remain empty for user to fill.
- No send is triggered.

Completion Notes:

- Status:
- Validation:
- Handover:

---

### C6. Insert current draft body safely

Status: [ ] Not started

Preferred approach:

- Write current draft body to a temporary UTF-8 file from extension host.
- Pass file path to VBS script.
- Script reads file.
- Script converts text to safe HTML if using `HTMLBody`.
- `Display` first, then prepend draft to existing `HTMLBody` so Outlook signature/quoted history has a chance to exist.

Acceptance criteria:

- Newlines are preserved reasonably.
- HTML special characters are escaped.
- Existing quoted history is not intentionally removed.
- If body insert fails, compose window behavior is predictable and error is shown.

Completion Notes:

- Status:
- Files changed:
- Validation:
- Handover:

---

### C7. Preserve Outlook-managed fields as much as possible

Status: [ ] Not started

Requirements:

- Do not manually set subject for Reply/Reply All/Forward unless absolutely required.
- Do not manually construct quoted original message.
- Do not manually set reply recipients.
- Do not attach files automatically.

Acceptance criteria:

- Implementation uses native Outlook compose methods.
- Manual testing records observed behavior for subject, recipients, signature, quoted history.

Completion Notes:

- Status:
- Observed Outlook behavior:
- Handover:

---

### C8. Add UI buttons

Status: [ ] Not started

Buttons:

- `Open Reply`
- `Open Reply All`
- `Open Forward`

Requirements:

- Use current editable draft text.
- Disable or show clear error if no source `entryId` exists.
- Keep `Copy` as fallback.

Acceptance criteria:

- Buttons are visible near draft actions.
- Buttons trigger explicit user-initiated compose behavior.
- Errors are user-readable.

Completion Notes:

- Status:
- Files changed:
- Handover:

---

### C9. Add or update tests

Status: [ ] Not started

Recommended tests:

- Correct script args for reply/replyAll/forward.
- Current editable draft is passed, not original draft.
- Empty draft handling.
- Missing entryId handling.
- Unsupported mode handling at helper level if applicable.

Acceptance criteria:

- Tests cover command construction and error paths.
- Actual Outlook COM behavior may remain manual validation.

Completion Notes:

- Status:
- Tests added/changed:
- Handover:

---

### C10. Manual Outlook validation

Status: [ ] Not started

Manual test matrix:

- [ ] Reply to a normal email.
- [ ] Reply All to a multi-recipient email.
- [ ] Forward a normal email.
- [ ] Draft with multiple paragraphs.
- [ ] Draft with special characters such as `<`, `>`, `&`.
- [ ] Email with existing signature behavior.
- [ ] Email with long quoted history.

Acceptance criteria:

- No email sends automatically.
- Compose windows open correctly.
- Draft appears in expected position.
- User can still edit before sending.

Completion Notes:

- Status:
- Environment:
- Results:
- Known issues:
- Handover:

---

## D. Next Actions MVP

### D1. Inspect current category and action item usage

Status: [ ] Not started

Likely files:

- `src/lib/analysis-schema.ts`
- `src/lib/thread-analysis-schema.ts`
- `src/lib/dashboard-render.ts`
- `src/lib/workbench-render.ts`
- Store/cache files

Acceptance criteria:

- Agent can state how `followUp` category is currently represented.
- Agent can state where `ThreadAnalysisItem.actionItems` are rendered today.

Completion Notes:

- Status:
- Files inspected:
- Findings:
- Handover:

---

### D2. Define NextActionItem type

Status: [ ] Not started

Suggested shape:

```ts
interface NextActionItem {
  id: string;
  sourceType: "mail" | "thread";
  sourceId: string;
  sourceMailId?: string;
  sourceTime?: string;
  owner?: string;
  task: string;
  deadline?: string;
  status: "open" | "done" | "ignored";
  createdAt: string;
  updatedAt: string;
}
```

Acceptance criteria:

- Type name uses `NextAction`, not `FollowUpQueue`.
- It does not replace or rename `followUp` category.

Completion Notes:

- Status:
- Files changed:
- Handover:

---

### D3. Define dedupe key

Status: [ ] Not started

Recommended key:

```text
sourceType + sourceId + sourceMailId + normalizedTask
```

Acceptance criteria:

- Same action from the same source is not duplicated.
- Similar actions from different threads can still exist.

Completion Notes:

- Status:
- Dedupe behavior:
- Tests run:
- Handover:

---

### D4. Decide whether MVP needs a local store

Status: [ ] Not started

Options:

1. Derived-only view from current thread analysis results.
2. Persistent local `next-actions.json` with status.

Recommendation:

- If MVP needs `done` / `ignored`, use a small local store.
- If only display is needed, derive from analysis results first.

Acceptance criteria:

- Decision is recorded before implementation.
- If store is added, retention/clear behavior is defined.

Completion Notes:

- Status:
- Decision:
- Handover:

---

### D5. Extract from ThreadAnalysisItem.actionItems first

Status: [ ] Not started

Acceptance criteria:

- Only thread action items are included initially.
- Single-mail `suggestedAction` is deferred unless explicitly added later.
- Extraction keeps owner/task/deadline/source fields.

Completion Notes:

- Status:
- Files changed:
- Tests run:
- Handover:

---

### D6. Add `Next Actions` UI surface

Status: [ ] Not started

Possible locations:

- Dashboard summary panel.
- Workbench side panel.
- Daily Brief section later.

Acceptance criteria:

- UI is named `Next Actions`.
- UI does not use `Follow-up Queue` naming.
- Each action shows task, owner if any, deadline if any, and source thread/mail label.

Completion Notes:

- Status:
- Files changed:
- Handover:

---

### D7. Add basic statuses

Status: [ ] Not started

Statuses:

- `open`
- `done`
- `ignored`

Acceptance criteria:

- User can mark an action done.
- User can ignore an action.
- Status persists if a store is implemented.
- Ignored/done actions are not mixed with open actions by default.

Completion Notes:

- Status:
- Files changed:
- Tests run:
- Handover:

---

### D8. Reuse existing source open behavior

Status: [ ] Not started

Requirement:

- Do not build new multi-source logic.
- Reuse existing mail/thread open behavior where possible.

Acceptance criteria:

- User can navigate to related thread/mail if source exists.
- No multi-source decision UI is introduced.

Completion Notes:

- Status:
- Files changed:
- Handover:

---

### D9. Add or update tests

Status: [ ] Not started

Recommended tests:

- Extract action items.
- Dedupe repeated action item.
- Mark done.
- Ignore.
- `followUp` category remains unaffected.

Acceptance criteria:

- Tests pass.
- No category naming regression.

Completion Notes:

- Status:
- Tests added/changed:
- Handover:

---

### D10. Run validation

Status: [ ] Not started

Commands:

```powershell
npm run compile
npm test
```

Acceptance criteria:

- Compile passes.
- Relevant tests pass.
- Any skipped/full-suite limitation is recorded.

Completion Notes:

- Status:
- Commands run:
- Results:
- Handover:

---

## 5. Cross-Milestone Acceptance Checklist

Do not consider the overall plan complete until these are true:

- [ ] Thread Spotlight makes existing thread fields visible and scannable.
- [ ] Thread Spotlight does not add source-jump complexity.
- [ ] Timeline still supports opening original mails in Outlook.
- [ ] Draft area is editable.
- [ ] User can write their own draft and polish/refine it.
- [ ] Polish/Refine use associated context and analysis result.
- [ ] No style preset system is added.
- [ ] No shortcut buttons are added.
- [ ] Outlook Reply/Reply All/Forward windows can be opened by explicit click.
- [ ] Draft body is prefilled in Outlook compose window.
- [ ] Easy Mail never auto-sends.
- [ ] Next Actions does not conflict with `followUp` category.
- [ ] All new behavior has tests or documented manual validation.

---

## 6. Testing Strategy

### 6.1 Automated Tests

Prefer small tests around pure functions and message handling.

Suggested areas:

- Render functions:
  - Thread Spotlight sections.
  - Empty section omission.
  - Draft editable UI controls.
- Message handling:
  - Polish/refine request shape.
  - Copy current draft text.
  - Outlook compose command args.
- Prompt builders:
  - Polish prompt includes current draft/context.
  - Refine prompt includes current draft/context/instruction.
- Next Actions:
  - Extraction.
  - Dedupe.
  - Status changes.

### 6.2 Manual Tests

Required for Outlook COM behavior:

- Open Reply window.
- Open Reply All window.
- Open Forward window.
- Verify no auto-send.
- Verify signature/quoted history behavior.
- Verify special character escaping.

### 6.3 Validation Command Record

Each agent should record exact commands run:

```md
Commands run:
- npm run compile: pass/fail
- npm test: pass/fail/not run, why
- targeted test command: pass/fail
```

---

## 7. Self-Adversarial Review

This section should be updated after each milestone.

### 7.1 Critique: Thread Spotlight may duplicate existing UI

Risk:

- If the Dashboard/Workbench already shows some fields, Spotlight may duplicate content.

Mitigation:

- Keep Spotlight compact.
- Hide empty fields.
- Use Workbench as full detail view and Dashboard as scan view.

Pre-merge challenge question:

- Does this make the thread easier to understand in 10 seconds, or did we just add more text?

---

### 7.2 Critique: Removing source jumps may reduce trust

Risk:

- User may want evidence for each conclusion.

Mitigation:

- Do not fake precision.
- Keep timeline and `Open in Outlook` available.
- Consider source schema later only if the need is proven.

Pre-merge challenge question:

- Can the user still verify original emails without us adding ambiguous multi-source logic?

---

### 7.3 Critique: Editable draft may imply persistence

Risk:

- User may think edited draft is saved permanently or written to Outlook.

Mitigation:

- Keep UI wording clear.
- Do not silently persist.
- Keep `Copy` and `Open Outlook` explicit.

Pre-merge challenge question:

- Is it clear that this is a local working draft, not an Outlook draft or sent email?

---

### 7.4 Critique: Polish may alter meaning

Risk:

- A polish action could subtly change user intent.

Mitigation:

- Prompt must explicitly preserve intent.
- Tests should check prompt wording.
- User always reviews result before sending.

Pre-merge challenge question:

- Does Polish behave like language cleanup rather than content strategy change?

---

### 7.5 Critique: Refine may over-follow vague instructions

Risk:

- A vague instruction like `make it better` may produce an unwanted rewrite.

Mitigation:

- Keep output reviewable.
- Never send automatically.
- Consider a clear error only for empty instruction, not vague instruction.

Pre-merge challenge question:

- Can the user recover easily if the refined draft is bad?

---

### 7.6 Critique: Outlook compose body insertion may break signature or quoted history

Risk:

- Setting `Body` or `HTMLBody` incorrectly may remove Outlook signature or original quoted content.

Mitigation:

- Use native `Reply` / `ReplyAll` / `Forward`.
- Call `Display` first.
- Prepend safe HTML to existing `HTMLBody`.
- Manually test classic Outlook.
- Keep `Copy` fallback.

Pre-merge challenge question:

- Did we test the actual Outlook version this project targets?

---

### 7.7 Critique: Forward mode may need recipients

Risk:

- Forward opens with empty `To`, which may look incomplete.

Mitigation:

- That is expected native Outlook behavior.
- User chooses recipient in Outlook.
- Easy Mail should not guess recipient.

Pre-merge challenge question:

- Are we avoiding recipient automation and keeping user control?

---

### 7.8 Critique: Next Actions may duplicate `followUp`

Risk:

- User may not understand why there is both `followUp` and `Next Actions`.

Mitigation:

- Use clear naming.
- Keep `followUp` as category.
- Explain through UI by showing concrete task fields in `Next Actions`.

Pre-merge challenge question:

- Is every Next Action a concrete task, not just another mail category?

---

### 7.9 Critique: Scope creep

Risk:

- Draft Assist can easily grow into templates, style presets, saved drafts, auto-send, CRM, or workflow automation.

Mitigation:

- Follow `## 1.5 Do Not Do Without Explicit Decision`.
- Keep MVP minimal.

Pre-merge challenge question:

- Did this implementation add any feature explicitly excluded from the MVP?

---

## 8. Current Snapshot Updates

Append updates here when a coding agent starts or completes meaningful work.

### Snapshot - 2026-07-02 - A3 Dashboard Summary

Status:

- `A3. Expand Dashboard thread summary carefully` completed.

Current recommendation:

1. Continue with `A4. Update thread report rendering`.
2. Align thread report sections with Spotlight/Dashboard fields.
3. Then `A5` tests and `A6` validation to close Milestone A.

Known caution:

- Dashboard now hides empty sections; any test relying on "noItems" placeholder for action/risk lists in thread summary will need updating.

---

### Snapshot - 2026-07-02 - A2 Workbench Spotlight

Status:

- `A2. Add Thread Spotlight to Workbench thread detail` completed.

Current recommendation:

1. Continue with `A3. Expand Dashboard thread summary carefully`.
2. Reuse the same labels added for A2.
3. Keep Dashboard output short and truncated; Workbench is now the full detail view.

Known caution:

- `npm install` was needed because local `node_modules/.bin/tsc.cmd` was missing before validation.
- `node_modules` is local dependency state and was not staged.

---

### Snapshot - 2026-07-02 - A1 Inspection

Status:

- `A1. Inspect current thread rendering paths` completed.

Current recommendation:

1. Continue with `A2. Add Thread Spotlight to Workbench thread detail`.
2. Keep Workbench as the full detail surface; Dashboard should remain a truncated scan view in A3.
3. Do not add per-item Spotlight source jumps. Workbench timeline already has per-mail `openInOutlook` buttons.

Known caution:

- Dashboard timeline currently links mail IDs to in-page mail anchors, not direct Outlook open buttons.
- `findOutlookOpenTarget` opens by `mailId` through mail index/store/analysis source; it does not read `ThreadMessage.entryId` directly.

---

### Snapshot - 2026-07-01 - Initial Plan

Status:

- No implementation started from this execution plan yet.

Current recommendation:

1. Start with Milestone A: Thread Spotlight MVP.
2. Then Milestone B: Draft Assist MVP.
3. Then Milestone C: Outlook compose windows.
4. Then Milestone D: Next Actions.

Known caution:

- Keep Thread Spotlight source behavior simple.
- Keep Draft Assist UI minimal.
- Do not add style presets or shortcut buttons.

---

## 9. Handover Log

#### Handover - 2026-07-02 - Claude Opus

Status: Done

Changed:
- Expanded `renderThreadAnalysisSummary` in `src/lib/dashboard-render.ts`:
  - Added `needMyReply` indicator (shown only when true)
  - Added `openQuestions` section (truncated to 2)
  - Truncated `actionItems` and `risks` to 2 items each with `(+N)` overflow
  - Empty sections are now hidden instead of showing "no items"
- Added 10 tests in `src/test/dashboard-render.test.ts` covering all new behaviors

Validated:
- `npm run compile`: pass
- `npm test -- --test-name-pattern=renderThreadAnalysisSummary`: pass, 228 tests total, 0 fail

Known issues:
- None

Last safe stopping point:
- A3 is complete. Dashboard shows truncated scan view; Workbench has full Spotlight detail.

Uncommitted changes / dirty files:
- `src/lib/dashboard-render.ts`
- `src/test/dashboard-render.test.ts`
- `docs/v2-design/competitor-analysis/04-execution-plan-thread-spotlight-draft-assist-next-actions.md`

Next recommended step:
- Start `A4. Update thread report rendering` — align `buildThreadReport` in `src/lib/report-thread.ts` with Spotlight structure, omit empty sections.

---

#### Handover - 2026-07-02 00:53 - Codex

Status: Done

Changed:
- Added Workbench `Thread Spotlight` rendering in `src/lib/workbench-render.ts`.
- Added thread labels for Spotlight fields in `src/lib/dashboard-labels.ts`.
- Added Workbench render coverage for Spotlight fields, empty section omission, partial-context warning, and existing timeline Outlook open button.
- Commit: `ec4071a757c4e3d386bd080c216da263b5f0c2a6`

Validated:
- `npm run compile`: pass
- `npm test -- --test-name-pattern=renderWorkbenchHtml`: pass, 218 tests reported passing

Known issues:
- Local dependencies were missing at first, so `npm install` was run before validation.
- No manual visual check was run because the project rules disable visual collaboration/browser workflows.

Last safe stopping point:
- A2 is complete and validated. Workbench shows full Spotlight detail; Dashboard has not been expanded yet.

Uncommitted changes / dirty files:
- `docs/v2-design/competitor-analysis/04-execution-plan-thread-spotlight-draft-assist-next-actions.md`
- `src/lib/workbench-render.ts`
- `src/lib/dashboard-labels.ts`
- `src/test/workbench-render.test.ts`

Next recommended step:
- Start `A3. Expand Dashboard thread summary carefully` by claiming only A3, then update `renderThreadAnalysisSummary` with truncated scan-view fields and tests.

---

#### Handover - 2026-07-02 00:50 - Codex

Status: In progress

Changed:
- Claimed `A2. Add Thread Spotlight to Workbench thread detail`.

Validated:
- Ran `git status --short`: no dirty files reported before claiming A2.
- Read latest handover and A2 acceptance criteria.

Known issues:
- No A2 source code changed yet in this checkpoint.

Last safe stopping point:
- Before Workbench Spotlight implementation.

Uncommitted changes / dirty files:
- `docs/v2-design/competitor-analysis/04-execution-plan-thread-spotlight-draft-assist-next-actions.md` updated to claim A2.

Next recommended step:
- Edit `src/lib/workbench-render.ts` and `src/lib/dashboard-labels.ts`, then update targeted Workbench render tests.

---

#### Handover - 2026-07-02 01:03 - Codex

Status: Done

Changed:
- Completed `A1. Inspect current thread rendering paths`.
- Updated A1 Completion Notes and Current Snapshot Updates with rendering path findings.
- Commit: `a8427e7ddfc2f94dfad4a5571114f1d16a493c58`

Validated:
- Inspected Workbench, Dashboard, report, schema, labels, message handler, extension Outlook open path, VBS open script, and related tests.
- Tests not run; A1 did not change source behavior.

Known issues:
- Dashboard timeline has mail ID anchors but no direct Outlook open button.
- Workbench timeline opens through `mailId` lookup in mail index/store/analysis source; `ThreadMessage.entryId` is not used directly by `openMailInOutlook`.

Last safe stopping point:
- A1 is complete. No product code has been changed.

Uncommitted changes / dirty files:
- `docs/v2-design/competitor-analysis/04-execution-plan-thread-spotlight-draft-assist-next-actions.md` updated for A1.

Next recommended step:
- Start `A2. Add Thread Spotlight to Workbench thread detail` by claiming only A2, adding a pre-work checkpoint, then editing `src/lib/workbench-render.ts`, `src/lib/dashboard-labels.ts`, and targeted tests.

---

#### Handover - 2026-07-02 00:44 - Codex

Status: In progress

Changed:
- Claimed `A1. Inspect current thread rendering paths`.

Validated:
- Read this execution plan and latest handover.
- Ran `git status --short`: no dirty files reported.

Known issues:
- No source files inspected yet in this handover entry.

Last safe stopping point:
- Before code inspection for A1.

Uncommitted changes / dirty files:
- `docs/v2-design/competitor-analysis/04-execution-plan-thread-spotlight-draft-assist-next-actions.md` updated to claim A1.

Next recommended step:
- Inspect Workbench, Dashboard, report, schema, tests, and Outlook open timeline behavior for A1.

---

### Handover - 2026-07-01 - Planning Agent

Status: Plan updated with Git checkpoint protocol

Changed:

- Added `0.7 Git Checkpoint Protocol`.
- Clarified local commit vs push policy.
- Added commit timing rules, WIP commit rules, commit message format, push policy, and commit recovery rules.

Validated:

- Plan now expects local commits for coherent completed steps.
- Plan forbids default push unless explicitly requested or required by project policy.

Known issues:

- This was a documentation-only update.
- No code implementation has started yet.

Last safe stopping point:

- Start `A1. Inspect current thread rendering paths` when implementation begins.

Uncommitted changes / dirty files:

- This plan file has been edited.
- The broader `docs/v2-design/competitor-analysis/` directory is still untracked unless committed later.

Next recommended step:

- Commit the planning docs if the user wants a local checkpoint before implementation.

---

### Handover - 2026-07-01 - Planning Agent

Status: Plan created

Changed:

- Added `04-execution-plan-thread-spotlight-draft-assist-next-actions.md`.
- Converted product discussion into an execution-oriented plan.
- Added multi-agent status rules and handover templates.
- Added step-by-step milestones with acceptance criteria.
- Added self-adversarial review section.

Validated:

- Plan reflects latest agreed product decisions:
  - Thread Spotlight without source jumps.
  - Editable Draft Assist with Polish/Refine.
  - Reply/Reply All/Forward Outlook compose support.
  - No style shortcuts/presets in MVP.
  - Next Actions separate from `followUp` category.

Known issues:

- No code has been changed yet.
- No tests have been run for implementation.
- Outlook compose behavior still needs manual validation later.

Next recommended step:

- Start `A1. Inspect current thread rendering paths`.
