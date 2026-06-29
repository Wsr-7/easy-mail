# Easy Mail Full-Panorama SVG References

Generated: 2026-06-18
Scope: complete panoramic SVG references for the three redesign directions.

These files are intentionally different from the earlier section-level references. The goal is to show information architecture and spatial model differences at a full-layout level.

## Files

| Direction | File | Architecture shown |
| --- | --- | --- |
| Direction 1: Operations Console | `redesign-panorama-d1-operations-console.svg` | Single-scroll embedded dashboard: status first, primary actions, tiered stats, then work queues. |
| Direction 2: Review Queues | `redesign-panorama-d2-review-queues.svg` | Lane-based queue board: attention, ready-to-analyze, analysed, and thread lanes. Actions live near lanes. |
| Direction 3: Split Workbench | `redesign-panorama-d3-split-workbench.svg` | Three-zone workbench: left navigation/counts, center queue, right selected item detail. |

## What each panorama is meant to prove

### Direction 1: Operations Console

This layout is closest to the current implementation model. It keeps a single dashboard page, but changes the top of the UI from a flat command row into a state-driven operations console.

Key architectural traits:

- One main webview dashboard.
- Runtime state and next action are first.
- Statistics are tiered, not equal.
- Manual review and must-handle work are above passive categories.
- Settings and reports are quieter.

Recommended implementation component:

```text
Activity Bar
  -> View Container
    -> Webview View dashboard
```

### Direction 2: Review Queues

This layout treats Easy Mail as a queue-processing tool. It is horizontally organized by workflow state instead of vertically organized by page sections.

Key architectural traits:

- Queue lanes are the primary structure.
- Attention Required, Ready to Analyze, Recently Analysed, and Threads are peers.
- Actions move into the lanes.
- Global toolbar is intentionally small.
- Lane headers carry the main counters.

Recommended implementation component:

```text
Activity Bar
  -> View Container
    -> Webview View queue board
    -> optional Tree View for folders / queue filters later
```

### Direction 3: Split Workbench

This layout treats Easy Mail as a sustained workbench. It is selection-based: users scan a queue, select an item, then inspect detail and take action in the right pane.

Key architectural traits:

- Left rail: navigation and counts.
- Center pane: active queue.
- Right pane: detail, rationale, thread context, suggested action.
- Long details no longer stretch each row.
- Better suited for future thread timeline and report workflows.

Recommended implementation component:

```text
Activity Bar
  -> View Container
    -> Tree View or webview left rail
    -> Webview Panel or richer Webview View workbench
```

## Recommendation

Use these panoramas to decide product direction before implementation.

Near-term safest choice:

```text
Direction 1: Operations Console
```

Best triage throughput choice:

```text
Direction 2: Review Queues
```

Best long-term workbench choice:

```text
Direction 3: Split Workbench
```

The three panoramas should make the IA difference visible even if the underlying palette and restraint remain consistent.
