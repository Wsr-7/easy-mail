# Easy Mail Redesign VS Code Component Usage Map

Generated: 2026-06-18
Scope: clarify how `vscode-workbench-ui-components-overview.md` informed the redesign, and map the three directions to concrete VS Code plugin UI components.

## 1. What the VS Code component document did

`vscode-workbench-ui-components-overview.md` was used as the product-container baseline, not as a visual style guide.

Its main role was to prevent the redesign from drifting into a generic website/dashboard pattern. It clarified that Easy Mail should be designed inside the VS Code workbench model:

- `Activity Bar` and `View Container` are the stable product entry.
- `Webview View` is suitable for richer embedded dashboard UI inside the contributed view.
- `Webview Panel` is suitable for a larger editor-area dashboard if the product needs more space.
- `Tree View` is suitable for native-feeling lists, folders, queues, and navigation.
- `Status Bar Item` is suitable for lightweight persistent state, not dense controls.
- `Output Channel` is suitable for logs and task diagnostics.
- `Quick Pick` is suitable for lightweight model/folder/action selection.
- `Commands` and `Menus` should back toolbar buttons, context actions, and command palette entries.
- `Configuration` should remain grounded in VS Code Settings; the dashboard settings area should be a shortcut, not a separate source of truth.
- `Notifications` should be reserved for task completion, warnings, and errors, not high-frequency progress spam.

## 2. Honest gap in the current three-direction document

The current direction document, `redesign-02-three-design-directions.md`, does describe:

- layout logic,
- visual language,
- action grouping,
- state emphasis,
- statistics treatment,
- task list treatment,
- why each direction fits VS Code better.

However, it does not yet explicitly say, direction by direction, which VS Code components should be used and how.

The generated SVGs are section-level webview references. They are useful for visual and hierarchy direction, but they are not a full component architecture plan.

This file fills that gap.

## 3. Shared component baseline for all directions

These choices should remain stable regardless of visual direction.

| Need | Recommended VS Code component | How to use it |
| --- | --- | --- |
| Stable product entry | `Activity Bar` + `View Container` | Keep `easyMail` as a dedicated Activity Bar entry. |
| Current embedded dashboard | `Webview View` | Keep current `easyMail.dashboard` as the near-term embedded surface. |
| Commands | `commands` + `menus` | All buttons should call existing commands or message handlers backed by commands. |
| Configuration | `contributes.configuration` + VS Code Settings | VS Code Settings stays the source of truth; dashboard settings remain shortcut controls. |
| Lightweight persistent state | `Status Bar Item` | Optional: show `Easy Mail: Idle`, `Analyzing`, or `Needs Review 6`. Do not put many controls here. |
| Logs and diagnostics | `Output Channel` | Use for pull/analyze/report logs, model fallback, and security gate decisions. |
| Model or folder selection | `Quick Pick` | Use for optional advanced selection, especially when dashboard controls become too dense. |
| Completion / error feedback | `Notifications` | Use only for task completed, failed, blocked, or requires manual action. |
| Item-specific actions | `Context Menus` / in-webview row actions | Keep item actions near mail/thread rows; if later using `Tree View`, add `view/item/context`. |

## 4. Direction 1: Operations Console component strategy

### Best container

Near term:

```text
Activity Bar
  -> View Container: Easy Mail
    -> Webview View: Dashboard
```

Optional later:

```text
Command: Easy Mail: Open Dashboard
  -> Webview Panel in Editor Area
```

### Component use

| Functional area | Component choice | Usage recommendation |
| --- | --- | --- |
| Top action / command area | `Webview View` HTML buttons backed by `commands` | Keep compact in the webview. Primary actions: Fetch New and Analyze Next Batch. Secondary actions grouped separately. |
| Runtime / processing status | `Webview View` status block + optional `Status Bar Item` | Webview shows detailed state. Status Bar only mirrors a short state such as `Easy Mail: Needs Review 6`. |
| Statistics | `Webview View` clickable counters | Use stats as navigation buttons inside webview. Do not use separate native views yet. |
| Settings | `Webview View` collapsed shortcut + `contributes.configuration` | Keep only common fields in dashboard; open full VS Code Settings for advanced fields. |
| Pending queue | `Webview View` dense rows | Preserve current mail queue, but render as dense work items instead of big equal cards. |
| High-priority queue | `Webview View` open-by-default section | Keep `Must Handle` and risk/need-reply items above passive categories. |
| Manual confirmation | `Webview View` attention section + `Notifications` on block | Show gate reason inline. Notify only when a new blocked/manual-confirm state occurs after a task. |
| Logs | `Output Channel` | Keep task and security logs outside the main UI. |

### Why this is the safest implementation path

Direction 1 does not require a new native `Tree View` or new `Webview Panel`. It can be implemented by restructuring the current `getDashboardHtml()` output and CSS. It fits the current codebase and avoids large architecture churn.

## 5. Direction 2: Review Queues component strategy

### Best container

Recommended medium-term structure:

```text
Activity Bar
  -> View Container: Easy Mail
    -> Webview View: Review Queues
    -> Tree View: Mail Folders or Queue Filters (optional)
```

Optional if queue volume grows:

```text
Tree View for queues + Webview Panel for selected queue detail
```

### Component use

| Functional area | Component choice | Usage recommendation |
| --- | --- | --- |
| Top action / command area | `View Actions` + compact webview command bar | Global actions stay minimal: Fetch, History, Refresh. Queue-level actions move into lanes. |
| Runtime / processing status | `Webview View` lane header state + optional `Status Bar Item` | Show state at the lane level: Attention Required, Ready to Analyze, Threads. |
| Statistics | Lane counters inside `Webview View` | Counters attach to lanes, not standalone stat cards. |
| Settings | Collapsed `Webview View` row + VS Code Settings | Keep configuration quieter; expose it as filter/preferences rather than a big form. |
| Pending queue | `Webview View` queue lane | Main body uses compact rows with context actions. |
| High-priority queue | `Webview View` priority lane | Treat must-handle/risk/need-reply as a lane, not just another category panel. |
| Manual confirmation | `Webview View` security lane | Manual-confirm and blocked items become a dedicated lane. |
| Item-specific actions | In-row webview actions; later `Context Menus` if moved to `Tree View` | Actions should be near the item: Analyze, Review, Open Thread, Generate Report. |
| Folder/model selection | `Quick Pick` | Use Quick Pick for lower-frequency selection flows to reduce persistent UI density. |

### When to choose this direction

Choose Direction 2 if the product should feel like a mail triage board where the user mostly processes queues. It gives better throughput than Direction 1, but it changes the IA more noticeably.

## 6. Direction 3: Split Workbench component strategy

### Best container

Recommended later structure:

```text
Activity Bar
  -> View Container: Easy Mail
    -> Tree View: Navigation / queue counts
    -> Webview View or Webview Panel: Queue + Detail Workbench
```

For a full editor-area experience:

```text
Command: Easy Mail: Open Workbench
  -> Webview Panel
      Left rail: sections / counts
      Center pane: active queue
      Right pane: selected detail
```

### Component use

| Functional area | Component choice | Usage recommendation |
| --- | --- | --- |
| Top action / command area | `Webview Panel` or `Webview View` sticky command strip | Keep only global actions at top. Detail actions move to the selected item pane. |
| Runtime / processing status | Sticky webview status header + optional `Status Bar Item` | Always visible across pane changes. |
| Statistics | `Tree View` navigation counts or webview left rail | Counts become navigation, not separate cards. |
| Settings | Left rail utility group + VS Code Settings | Settings and Prompt Config become utility entries, not first-screen content. |
| Pending queue | Center pane in `Webview Panel` / `Webview View` | Dense list rows. Selection opens detail pane. |
| High-priority queue | Center pane + right detail pane | The queue remains compact; full reason, draft, and actions live in detail. |
| Manual confirmation | Center pane + right review pane | Review reason, classification, and confirmation action stay together in detail. |
| Thread timeline | Right detail pane or separate `Webview Panel` | Better for long timelines than expanding large cards inline. |
| Context actions | In-detail actions + optional `Context Menus` | Copy Draft, Ignore, Analyze Thread, Generate Report belong in the selected detail context. |

### When to choose this direction

Choose Direction 3 when Easy Mail becomes a sustained workbench, not just a compact dashboard. It is the most scalable, but it should wait until dashboard rendering is extracted from `extension.ts` and state routing is cleaner.

## 7. Recommended final component plan

For the next implementation phase, use this plan:

```text
Phase 1: Direction 1 in current Webview View
  - No new native component required.
  - Rework layout, CSS, grouping, and section ordering.
  - Add optional Status Bar Item only if current runtime state needs persistent visibility.

Phase 2: Direction 2 improvements
  - Convert categories into queue lanes.
  - Consider Quick Pick for model/folder selection.
  - Consider Output Channel improvements for diagnostics.

Phase 3: Direction 3 workbench
  - Extract dashboard renderer.
  - Consider Tree View for navigation/counts.
  - Consider Webview Panel for large split-pane workbench.
```

## 8. Design guardrails from the component baseline

- Do not turn the dashboard into a landing page because VS Code already provides the product shell.
- Do not duplicate VS Code Settings as a separate settings system.
- Do not put every command in the first row.
- Do not use Status Bar for multiple controls.
- Do not use Notifications for routine progress updates.
- Do not force Tree View if current webview rows are enough.
- Do not open a Webview Panel by default unless the user explicitly asks for a larger workbench experience.
- Keep all actions command-backed so the Command Palette remains useful.
