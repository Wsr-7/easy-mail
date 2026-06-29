# D3 Split Workbench Detail Image Index

Generated: 2026-06-18
Scope: additional component-level and workflow-level SVG references for Direction 3.

## Design document

- `redesign-06-d3-split-workbench-component-design.md`

This document describes the detailed design and usage of each component in Direction 3:

- Sticky runtime bar
- Left navigation rail
- Center active queue
- Right selected detail pane
- Detail action bar
- Thread timeline detail
- Reports mode
- Settings / utility mode
- Workflow state behavior
- Implementation phases

## Detail SVG files

| File | What it shows |
| --- | --- |
| `redesign-d3-detail-01-workbench-anatomy.svg` | Full anatomy of the three-zone workbench. |
| `redesign-d3-detail-02-left-navigation-rail.svg` | Left rail behavior: counts become navigation. |
| `redesign-d3-detail-03-center-active-queue.svg` | Center queue row structure, selection, and batch behavior. |
| `redesign-d3-detail-04-right-detail-review-mode.svg` | Right detail pane for selected mail / review mode. |
| `redesign-d3-detail-05-thread-timeline-mode.svg` | Thread queue and selected thread timeline preview. |
| `redesign-d3-detail-06-report-mode.svg` | Report list and report preview/detail mode. |
| `redesign-d3-detail-07-settings-mode.svg` | Settings / utility mode without making settings dominate the dashboard. |
| `redesign-d3-detail-08-workflow-state-map.svg` | Workflow state map across fetch, review, analyze, triage, thread/report work. |

## How to read these images

Direction 3 should be judged by architecture more than skin:

```text
Left = navigation and counts
Center = active queue scan
Right = selected item detail and actions
Top = runtime state and global actions
```

The strongest reason to choose Direction 3 is that it separates scanning from reasoning. The user can process many items without every row becoming a large card.

## Implementation implications

Minimum implementation:

```text
Use current Webview View.
Add selected item state in webview script.
Render three panes inside getDashboardHtml() or a new renderer module.
Keep all current commands and message handlers.
```

Better implementation:

```text
Extract renderer functions:
  renderRuntimeBar()
  renderLeftRail()
  renderCenterQueue()
  renderRightDetail()
```

Later implementation:

```text
Use native Tree View for left navigation.
Use Webview Panel for large thread timeline and workbench views.
```
