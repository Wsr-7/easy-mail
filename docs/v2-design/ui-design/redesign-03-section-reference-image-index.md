# Easy Mail Section-Level Reference Image Index

Generated: 2026-06-18
Scope: VS Code plugin embedded UI redesign references. These are cropped section-level SVG references, not full-page website mockups and not implementation code.

## Required output order coverage

### Step 1. One-line Design Read

Stored in:

- `redesign-00-research-log.md`

One-line read:

> This is a VS Code plugin embedded UI redesign for high-frequency mail triage, security-aware analysis, and thread-based information work, not a website.

### Step 2. Research Summary

Stored in:

- `redesign-00-research-log.md`

Coverage:

- What the plugin does.
- Major workflows.
- Main functional modules.
- What the current page is trying to accomplish.
- VS Code workbench baseline.
- Current screenshot dimensions and sampled color evidence.
- Current `extension.ts#getDashboardHtml()` structure.

### Step 3. Current UI Diagnosis

Stored in:

- `redesign-01-current-ui-diagnosis.md`

Coverage:

- Grouping.
- Hierarchy.
- Action overload.
- State visibility.
- Statistics weighting.
- Task list readability.
- VS Code dark host mismatch.

### Step 4. Three Design Directions

Stored in:

- `redesign-02-three-design-directions.md`

Directions:

1. `Operations Console`
2. `Review Queues`
3. `Split Workbench`

Each direction includes:

- Direction name.
- One-line positioning.
- Layout logic.
- Visual language.
- Action grouping strategy.
- State emphasis strategy.
- Statistics treatment.
- Task list treatment.
- Why it fits VS Code better.

### Step 5. Section-Level Reference Images

Stored as SVG files in the same directory.

All references are intentionally section-level fragments: command area, runtime area, statistics, settings, pending queue, high-priority queue, and manual-review / attention-required area.

---

## Direction 1: Operations Console

Positioning: compact command-and-status console focused on current state, next action, and attention queues.

| Functional area | File |
| --- | --- |
| Top action / command area | `redesign-d1-top-actions.svg` |
| Runtime / processing status area | `redesign-d1-runtime-status.svg` |
| Statistics overview area | `redesign-d1-statistics-overview.svg` |
| Configuration / settings area | `redesign-d1-configuration-settings.svg` |
| Unresolved / unprocessed mail queue | `redesign-d1-unprocessed-mail-queue.svg` |
| High-priority action queue | `redesign-d1-high-priority-action-queue.svg` |
| User-attention-required area | `redesign-d1-user-attention-required.svg` |

## Direction 2: Review Queues

Positioning: queue-first review surface where actions live close to lane context.

| Functional area | File |
| --- | --- |
| Top action / command area | `redesign-d2-top-actions.svg` |
| Runtime / processing status area | `redesign-d2-runtime-status.svg` |
| Statistics overview area | `redesign-d2-statistics-overview.svg` |
| Configuration / settings area | `redesign-d2-configuration-settings.svg` |
| Unresolved / unprocessed mail queue | `redesign-d2-unprocessed-mail-queue.svg` |
| High-priority action queue | `redesign-d2-high-priority-action-queue.svg` |
| User-attention-required area | `redesign-d2-user-attention-required.svg` |

## Direction 3: Split Workbench

Positioning: split-pane workbench surface for sustained review sessions.

| Functional area | File |
| --- | --- |
| Top action / command area | `redesign-d3-top-actions.svg` |
| Runtime / processing status area | `redesign-d3-runtime-status.svg` |
| Statistics overview area | `redesign-d3-statistics-overview.svg` |
| Configuration / settings area | `redesign-d3-configuration-settings.svg` |
| Unresolved / unprocessed mail queue | `redesign-d3-unprocessed-mail-queue.svg` |
| High-priority action queue | `redesign-d3-high-priority-action-queue.svg` |
| User-attention-required area | `redesign-d3-user-attention-required.svg` |

---

## Recommended next design decision

Use Direction 1 as the near-term redesign path because it preserves the current single-dashboard implementation model while fixing hierarchy, status visibility, action grouping, and dark-host fit.

Use Direction 2 if daily queue throughput becomes the primary product behavior.

Use Direction 3 after the Dashboard renderer is split out of `extension.ts`, because it implies a larger interaction model.

## Implementation guardrail for later phases

Do not implement yet from these reference images alone. Before coding, convert the chosen direction into a scoped component and state mapping plan:

1. Map current functions to redesigned regions.
2. Define visible / collapsed defaults.
3. Define button enabled / disabled / busy states.
4. Define queue sort and density rules.
5. Define bilingual label length limits.
6. Define token-free CSS variables grounded in VS Code dark theme tokens.
7. Only then modify `src/extension.ts` or extract `dashboard-renderer.ts`.
