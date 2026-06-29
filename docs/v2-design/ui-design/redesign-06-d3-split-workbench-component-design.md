# Direction 3: Split Workbench Component Design

Generated: 2026-06-18
Scope: detailed component design and usage for the Direction 3 split-workbench concept.

## 1. Design intent

Direction 3 treats Easy Mail as a sustained VS Code workbench, not a single scrolling dashboard.

The core model is selection-based:

```text
Navigate -> Scan queue -> Select item -> Inspect detail -> Act -> Move to next item
```

This is closer to how VS Code itself handles Problems, Source Control, Search, Testing, and Extensions: the user does not read one huge page; the user navigates lists, selects an item, and works in a focused detail area.

## 2. Recommended container model

### Near-term implementation

Keep the current contributed view and implement the three-zone layout inside the existing Webview View.

```text
Activity Bar: Easy Mail
  -> View Container: Easy Mail
    -> Webview View: Split Workbench
```

This avoids a large extension architecture change and keeps implementation close to current `getDashboardHtml()` / webview message handling.

### Medium-term implementation

Move navigation/counts into a native Tree View, while keeping the workbench in a Webview View or Webview Panel.

```text
Activity Bar: Easy Mail
  -> View Container: Easy Mail
    -> Tree View: Queues / Views / Counts
    -> Webview View: Active Queue + Detail
```

### Long-term implementation

Open the full workbench in an editor-area Webview Panel when the user needs more space.

```text
Command: Easy Mail: Open Workbench
  -> Webview Panel
      Left rail: sections / queue counts
      Center pane: active queue
      Right pane: selected item detail
```

## 3. Overall layout anatomy

```text
┌──────────────────────────────────────────────────────────────┐
│ Sticky runtime bar                                            │
├───────────────┬────────────────────────┬─────────────────────┤
│ Left nav       │ Center queue            │ Right detail         │
│ sections       │ selected queue items    │ selected item data   │
│ counts         │ sorting/filtering       │ rationale/actions    │
│ utility links  │ compact scan rows       │ thread/report/draft  │
└───────────────┴────────────────────────┴─────────────────────┘
```

The page is no longer organized as stacked sections. It is organized as a workbench.

## 4. Component 1: Sticky runtime bar

### Purpose

The runtime bar answers three questions:

1. What is Easy Mail doing now?
2. Is there anything blocking analysis?
3. What are the safe global actions?

### Content

- Current state: `Idle`, `Fetching`, `Analyzing`, `Generating report`, `Needs Review`, `Error`.
- Last pull time.
- Active model family.
- Batch size / pending count.
- Small global actions.

### Recommended controls

Primary:

- `Fetch New`
- `Analyze Batch`

Secondary:

- `Refresh`
- `More History`
- `Reports`

Utility:

- `Settings`
- `Prompt Config`

### Usage rules

- Do not place every command in the runtime bar.
- Item-specific commands must move to the detail pane.
- The runtime bar should remain visible while scrolling.
- Errors or manual-confirm blockers should be shown as compact status chips, not full-width banners unless blocking the workflow.

## 5. Component 2: Left navigation rail

### Purpose

The left rail turns current statistics into navigation.

Instead of showing many equal stat cards, the user sees counts where they can act on them.

### Sections

Recommended primary sections:

1. `Needs Review`
2. `Pending`
3. `Must Handle`
4. `Waiting For Me`
5. `Follow Up`
6. `Notice`
7. `Threads`
8. `Reports`

Utility sections:

- `Settings File`
- `Prompt Config`
- `Open Digest`
- `Open Summary`
- `Clear Cache`

### Row anatomy

```text
[section label]          [count]
[optional sublabel / filter]
```

### States

- Active: stronger background and left accent.
- Attention: warm accent and count.
- Quiet: muted text.
- Disabled/empty: low contrast, still visible if useful.

### VS Code component mapping

Near term:

- Implement as webview left rail.

Medium term:

- Convert to native `Tree View` for better VS Code integration.
- Use `view/item/context` menus for section-level actions.

## 6. Component 3: Center active queue

### Purpose

The center pane is for scanning and selecting items. It should be dense, stable, and quick to process.

### Queue modes

The same pane can render different modes depending on the selected left-nav section:

- `Needs Review` queue
- `Pending` queue
- `Must Handle` queue
- `Threads` queue
- `Reports` list

### Row anatomy

```text
[priority rail] [checkbox/status] [subject/title]
                         [sender/participants · summary · time]
                         [chips: P0/P1, thread, risk, partial]
```

Right side optional:

- time
- small inline action
- selected indicator

### Row interaction

- Click row: select and open detail pane.
- Checkbox: select for batch analysis.
- Double-click or primary action: open source / digest / thread.
- Keyboard target: arrow up/down should map well if implemented later.

### Sorting recommendation

Default sorting by section:

- Needs Review: blocker severity, then received time.
- Pending: priority, then received time.
- Must Handle: urgency, then received time.
- Threads: need-reply/risk first, then last updated.
- Reports: generated time, then report type.

## 7. Component 4: Right detail pane

### Purpose

The right pane is the main reason to choose Direction 3.

It prevents every card from becoming huge. The queue stays scannable; detail lives only for the selected item.

### Detail modes

The right pane switches by selected item type.

#### Mail review mode

Use for pending mail, must-handle mail, waiting items, and manual confirmation.

Recommended blocks:

1. Header: subject, sender, time, priority.
2. Classification / review state.
3. Reasoning summary.
4. Security gate details if blocked or manual-confirm.
5. Suggested action.
6. Actions: Analyze, Confirm, Ignore, Open Digest, Generate Single Mail Report.

#### Thread mode

Use for thread items.

Recommended blocks:

1. Header: subject, participants, message count, last updated.
2. Thread summary.
3. Timeline preview.
4. Missing context / partial context warning.
5. Actions: Analyze Thread, Open Timeline, Generate Thread Report.

#### Report mode

Use for generated reports.

Recommended blocks:

1. Report type.
2. Generated time.
3. Source scope.
4. Summary preview.
5. Actions: Open Report, Regenerate, Export Markdown.

#### Settings mode

Use when a utility navigation item is selected.

Recommended blocks:

1. Current effective config.
2. Safe shortcuts for common settings.
3. Link to VS Code Settings.
4. Link to prompt config.

### Usage rules

- Put expensive or irreversible-looking actions in the right pane, not in every row.
- Use confirmation states here, not in popups unless truly needed.
- Keep long summaries and thread timelines out of the center queue.
- The right pane should always explain why an item is in the current queue.

## 8. Component 5: Detail action bar

### Purpose

The detail action bar contains actions that apply to the selected item.

### Example actions by mode

Mail item:

- `Analyze This Mail`
- `Confirm Analysis`
- `Ignore`
- `Open Digest`
- `Generate Mail Report`

Thread item:

- `Analyze Thread`
- `Open Timeline`
- `Generate Thread Report`

Report item:

- `Open Report`
- `Regenerate`
- `Export Markdown`

Settings item:

- `Open VS Code Settings`
- `Open Prompt Config`

### Usage rules

- Do not duplicate all global toolbar buttons here.
- The primary action should be visually strongest.
- Destructive or cleanup actions should be lower emphasis.

## 9. Component 6: Thread timeline detail

### Purpose

Thread timeline is too large for a card row. Direction 3 gives it a natural home in the right pane or a full Webview Panel.

### Timeline anatomy

```text
Thread header
Summary
Warning chips if partial context / manual review
Timeline item 1
Timeline item 2
Timeline item 3
Actions
```

### Recommended usage

- Show compact preview in the right pane.
- Open full timeline in a larger panel if the thread is long.
- Keep timeline events visually flat and compact.

## 10. Component 7: Reports and settings modes

### Reports mode

Reports should not compete with active review queues. They should appear as a navigation section and selected detail mode.

Report list belongs in center pane. Report preview/actions belong in right pane.

### Settings mode

Settings should not dominate the first screen.

The left rail can expose settings as utilities. The right pane can show current effective settings and shortcuts. VS Code Settings remains the source of truth.

## 11. Visual rules

- Use VS Code-like dark surfaces and thin borders.
- Keep the palette restrained.
- Use warm accent only for attention/manual-review states.
- Avoid cards with large shadows, gradients, marketing colors, or hero blocks.
- Favor dense rows over large decorative cards.
- Prefer fixed headers, clear columns, and stable scan paths.

## 12. Implementation recommendation

Suggested phased plan:

```text
Phase 1
  Implement D3 layout inside current Webview View.
  Keep all data and commands unchanged.
  Add selected item state in webview script.

Phase 2
  Extract dashboard rendering from extension.ts.
  Split render functions by pane:
    renderRuntimeBar()
    renderLeftRail()
    renderCenterQueue()
    renderRightDetail()

Phase 3
  Consider native Tree View for left navigation.
  Consider Webview Panel for full workbench mode.
```

## 13. Main tradeoffs

Advantages:

- Strongest long-term IA.
- Best for thread timelines and reports.
- Avoids huge mail cards.
- Makes selected-item actions clearer.
- Closer to VS Code workbench mental model.

Costs:

- More state management.
- More responsive layout work.
- Requires selected item routing.
- Eventually benefits from renderer extraction.
- Less trivial than simply restyling the current dashboard.
