# Easy Mail Three Design Directions

Generated: 2026-06-18
Scope: concept directions only. No implementation code yet.

## Shared constraints for all directions

- This is a VS Code plugin embedded product UI redesign, not a landing page.
- Preserve current functions and meaning-level information architecture.
- Keep the product realistic for a VS Code Webview / Webview Panel surface.
- Use restrained dark-neutral palette.
- Use flat surfaces, borders, spacing, density, and typography instead of decoration.
- Do not use AI purple, glassmorphism, large gradients, thick shadows, or hero-style composition.
- Make runtime/task clarity more important than aesthetics.
- Work in Chinese and English labels.

---

# Direction 1: Operations Console

## One-line positioning

A compact command-and-status console that makes “what is running, what needs attention, and what to do next” visible in the first screen.

## Layout logic

Top area becomes a two-tier operations header:

1. Left: product context and runtime state.
2. Center: next recommended action and primary commands.
3. Right: compact secondary actions and utility overflow.

Below the header:

1. Primary attention strip: Needs Confirm, Must Handle, Risk, Pending Allowed.
2. Work queues: Manual Confirmation, Must Handle, Pending Mail.
3. Secondary panels: other categories, threads, reports, settings.

The page still preserves the current modules, but the first fold is optimized for daily operation.

## Visual language

- Dark workbench-neutral base.
- Ultra-flat panels.
- Thin borders.
- Dense command buttons.
- One cool semantic accent for active/primary actions.
- Amber only for attention-required state.
- No card showmanship.

## Action grouping strategy

Primary actions:

- Fetch New.
- Analyze Next Batch.

Contextual actions:

- Analyze Selected appears near selected queue or as disabled compact action with count.
- Analyze All Allowed appears as a secondary batch action.

Secondary actions:

- More History.
- Refresh.
- Open Summary.
- Generate Reports.

Utility actions:

- Settings File.
- Prompt Config.
- Clear Local Cache.
- Load Models.

Clear Local Cache is separated visually as a quiet danger/maintenance action, not placed beside primary work actions.

## State emphasis strategy

Runtime status is the hero of the plugin, but not a website hero:

- Current state: Idle / Fetching / Analyzing / Reports.
- Last pull/import.
- Model availability.
- Security gate mode.
- Next action recommendation.

The busy state is centralized instead of hidden inside individual buttons.

## Statistics treatment

Stats are split into two tiers:

Primary operational counters:

- Needs Confirm.
- Must Handle.
- Risk.
- Pending Allowed.

Secondary counters:

- Pulled.
- Analysed.
- Threads.
- Notice.
- Waiting.

Primary stats use larger text and sit as a compact top strip. Secondary stats become smaller inline counters or subdued chips.

## Task list treatment

Queues use dense list rows, not equal decorative cards:

- Left status rail: priority/security.
- Center: subject + sender + one-line summary.
- Right: time + primary action.
- Expand disclosure for reasons, draft, thread link, security decision.

Manual-confirm and must-handle queues are denser and open by default. Notice and ignored are quieter and collapsed.

## Why it fits VS Code better

This direction resembles a disciplined workbench control panel. It reduces website-like vertical storytelling and aligns with how developers expect tools inside VS Code to behave: compact, status-aware, command-driven, and frequently usable.

---

# Direction 2: Review Queues

## One-line positioning

A queue-first review surface where mail, thread, and security items are treated as triage lanes with different urgency levels.

## Layout logic

The primary structure becomes queue lanes:

1. Attention Required.
2. Ready to Analyze.
3. In Review / Recently Analyzed.
4. Threads Needing Context.
5. Quiet Reference / Reports / Settings.

A narrow top command bar remains, but the page is led by the work queues. This direction is better if the user spends most time deciding which item to act on rather than tuning settings.

## Visual language

- Dark neutral base.
- Row-based queue surfaces.
- Minimal badges.
- Dense separators.
- Sparse accent only on lane headers and selected action.
- Stronger typographic hierarchy than card hierarchy.

## Action grouping strategy

Actions move closer to their queue context:

- Fetch New remains global.
- Analyze Next Batch lives in Ready to Analyze.
- Analyze Selected lives inside selected queue toolbar.
- Manual-confirm action lives inside Attention Required.
- Thread Analyze lives inside thread row.
- Reports live in a quiet output strip.

Global toolbar becomes smaller because the queues themselves own the relevant actions.

## State emphasis strategy

State is embedded in lane headers:

- Attention Required shows blocked/manual-confirm counts.
- Ready to Analyze shows allowed pending count and batch size.
- Threads shows partial context / risk state.
- A small runtime strip shows current task and last update.

This makes “what needs attention” more prominent than passive system metadata.

## Statistics treatment

Statistics become lane counters and compact chips rather than standalone cards:

- Lane title: `Attention Required · 6`.
- Sub-counters: `Manual 4`, `Blocked 2`, `Risk 1`.
- Secondary metrics appear in a compact telemetry row.

## Task list treatment

Task lists are the main UI:

- Row density is higher.
- Items align into columns: status, subject, source, classification, time, action.
- Security reason appears as a second row only when needed.
- Thread items use the same row skeleton with participants/message count replacing sender.
- High-priority items are not bigger; they are better ordered and more actionable.

## Why it fits VS Code better

VS Code already uses queue/list mental models in Problems, Source Control, Testing, and Search. This direction borrows that workbench rhythm without copying any single native UI exactly.

---

# Direction 3: Split Workbench

## One-line positioning

A split-pane workbench layout that keeps navigation, operational state, and item detail separate for sustained review sessions.

## Layout logic

The dashboard becomes a three-zone embedded workbench:

1. Left rail: sections / filters / counts.
2. Center pane: active queue or thread list.
3. Right pane: selected item detail, security decision, draft, timeline, or report actions.

The first screen still shows current status and next action, but repeated work happens through selection and detail inspection rather than scrolling through long cards.

## Visual language

- Dark neutral base.
- Flat panes divided by borders.
- Very restrained active selection state.
- Command bar is compact and sticky.
- Right pane uses document-like rhythm but dark-neutral, not paper beige.

## Action grouping strategy

Global actions stay in a compact top strip:

- Fetch New.
- Analyze Next Batch.
- Refresh.

Pane-specific actions appear where they belong:

- Queue toolbar: Analyze Selected, Analyze All Allowed.
- Detail pane: Copy Draft, Ignore, Open Thread, Analyze Thread, Generate Report.
- Settings and prompts live in left rail / lower utility group.

## State emphasis strategy

Status is always visible as a small sticky runtime header:

- Current task.
- Last pull/import.
- Model and security mode.
- Selected item count.

The selected item detail area shows safety and next action with higher clarity than the list.

## Statistics treatment

Stats become navigation counts:

- Attention Required.
- Pending.
- Must Handle.
- Risk.
- Waiting.
- Threads.
- Reports.

A small telemetry strip handles Pulled / Analysed / Notice. This avoids turning all stats into equal cards.

## Task list treatment

Task list is compact and persistent:

- Rows in center pane.
- Selection opens details on the right.
- Details show full reason, draft, thread timeline, and report actions.
- Thread timeline is readable without expanding the whole page.

## Why it fits VS Code better

The split-pane model matches editor/workbench habits: tree/list on the side, selected content in the editor/detail pane, commands near context. It is especially suitable if Easy Mail grows into a sustained local intelligence workbench rather than a one-screen control panel.

---

# Recommendation

For near-term implementation with strict scope control, Direction 1 is the safest first redesign because it preserves the current single-scroll Dashboard structure while fixing hierarchy and action grouping.

Direction 2 is the strongest if daily triage queue throughput is the main product behavior.

Direction 3 is the most scalable but implies a larger interaction model change and should be deferred until after the rendering code is split out of `extension.ts`.
