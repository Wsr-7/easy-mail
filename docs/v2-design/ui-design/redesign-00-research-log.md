# Easy Mail UI Redesign Research Log

Generated: 2026-06-18
Scope: VS Code plugin embedded product UI redesign for `F:\otherProjects\codex\easy-mail`.

## One-line design read

This is a VS Code plugin embedded UI redesign for high-frequency mail triage, security-aware analysis, and thread-based information work, not a website.

## Skill handling

The user requested `design-taste-frontend` and `minimalist-ui`.

- `minimalist-ui` is treated as the primary design rule: hierarchy by typography, spacing, grouping, borders, flatness, restraint, utilitarian calm, and high-frequency usability.
- `design-taste-frontend` is treated only as an anti-slop guardrail: avoid visual noise, generic card soup, weak hierarchy, decorative composition, and ungrounded mockup patterns.
- The requested skill names were not available in the advertised workspace skill list. The task-specific constraints supplied by the user are therefore used as the operative design contract.

## Inspected project sources

### Project root

Path inspected: `F:\otherProjects\codex\easy-mail`

Key files inspected:

- `README.md`
- `user guide.md`
- `package.json`
- `AGENTS.md`
- `src/extension.ts`
- `src/lib/dashboard-state.ts`
- `docs/v2-design/easy-mail-new-architecture-design.md`
- `docs/v2-design/easy-mail-repo-specific-implementation-plan.md`
- `docs/v2-design/ui-design/vscode-workbench-ui-components-overview.md`
- `docs/v2-design/ui-design/ui_now_1.png`
- `docs/v2-design/ui-design/ui_now_2.png`
- `docs/v2-design/ui-design/ui_now_3.png`
- `docs/v2-design/ui-design/ui_now_4.png`
- `docs/v2-design/ui-design/ui_now_5.png`

## Plugin product understanding

Easy Mail is a local, read-only VS Code extension prototype for classic Outlook on Windows. It uses this chain:

1. Classic Outlook mail source.
2. VBScript collection.
3. Local digest / store / index files.
4. VS Code extension dashboard.
5. GitHub Copilot analysis.
6. Local Dashboard and Markdown reports.

The product is not a general mail client and not a SaaS dashboard. Its value is local, controlled, security-aware mail intelligence inside the developer/editor workbench.

## Main functions inferred

### Collection and history loading

- Fetch new Outlook mail.
- Load older mail history using per-folder anchors.
- Generate sample digest when Outlook is unavailable.
- Maintain local dedupe index using `InternetMessageId`, `EntryId`, or fallback hash.

### Progressive analysis

- Imported mail enters `mail-store.json` as a short-term pending queue.
- `Analyze Next Batch` analyzes the next allowed batch.
- `Analyze Selected` analyzes selected mails, including manually confirmed items.
- `Analyze All Allowed` analyzes all mail that passes the security gate.

### Security and classification

- Classification levels: `PUBLIC`, `INTERNAL`, `REGISTERED`, `HIGH REGISTERED`.
- Security gate can allow automatic analysis, require manual confirmation, or block.
- Important senders / groups / keywords affect priority classification.
- Local cache can be cleared.

### Dashboard and reports

- Dashboard currently contains command toolbar, settings, metadata, stats, pending queue, blocked/manual-confirm queue, categorized analysis cards, and thread cards.
- Reports include summary, daily brief, single mail report, thread report, and later weekly pattern report.

### Thread direction

v2 design docs position Single Mail and Thread Mail as dual first-class capabilities:

- Single Mail Analysis gives breadth.
- Thread Analysis gives depth.
- Security Gate defines the boundary.
- Reports turn analysis into working artifacts.

## Major workflows

### First run / demo workflow

1. Open Easy Mail Dashboard from Activity Bar.
2. Configure range, folders, output language, model, and auto-analysis threshold.
3. Generate sample digest or fetch Outlook mail.
4. Review pending mail and current stats.
5. Analyze a batch or selected items.
6. Open summary / digest / reports.

### Daily high-frequency workflow

1. Open Dashboard.
2. See current processing state and last pull/import status.
3. Fetch new mail or load more history.
4. Inspect what needs attention first: manual confirmation, must-handle items, risk, need reply, waiting/follow-up.
5. Analyze allowed queue or selected sensitive items.
6. Copy draft reply / ignore noise / open report.

### Security review workflow

1. See blocked or manual-confirm items.
2. Check classification and gate reason.
3. Select items to analyze explicitly when appropriate.
4. Avoid automatic Copilot submission above configured threshold.

### Thread workflow

1. Open thread card from mail item or thread list.
2. Review participants, count, last time, content status, and security status.
3. Open timeline.
4. Analyze full thread when safe.
5. Generate thread report or draft reply.

## Main functional modules

- Command / action area.
- Runtime / busy / status area.
- Pull metadata area.
- Statistics overview.
- Settings / configuration shortcut.
- Pending mail queue.
- Manual confirmation / blocked queue.
- Must-handle / high-priority classified work.
- Lower-priority categories: follow-up, notice, uncertain, ignored.
- Threads panel.
- Reports / outputs.

## Current page intent

The current page is trying to be a compact control center for local Outlook mail triage:

- Pull or simulate mail.
- Configure the collection and model behavior.
- Show collection and analysis state.
- Let the user analyze mail progressively.
- Surface pending, blocked, categorized, and threaded items.
- Open generated artifacts.

The underlying intent is correct. The current implementation problem is that too many different responsibilities have similar visual weight.

## VS Code baseline extracted from local component overview

The baseline document emphasizes that extension UI should be grounded in VS Code workbench containers:

- Activity Bar / View Container gives the stable product entry.
- Webview View is appropriate for richer embedded side-panel UI.
- Webview Panel is appropriate for a main dashboard in the editor area.
- Status Bar is for lightweight persistent state, not dense control clusters.
- Commands and menus should be reused, contextual, and not shown everywhere at once.
- Settings should remain grounded in VS Code Settings; dashboard settings are a shortcut, not an independent settings system.

Design consequence: the redesign should feel like a disciplined workbench tool surface, with compact controls and operational clarity, not a freestanding web product.

## Current screenshot inspection

Screenshot files inspected:

| File | Size |
| --- | --- |
| `ui_now_1.png` | 1898 × 925 |
| `ui_now_2.png` | 1823 × 711 |
| `ui_now_3.png` | 1839 × 677 |
| `ui_now_4.png` | 1830 × 1079 |
| `ui_now_5.png` | 1843 × 872 |

Dominant sampled colors show a light beige/off-white page surface:

| File | Main sampled region | Center sampled region |
| --- | --- | --- |
| `ui_now_1.png` | `#F7F6F3` | `#FCFCFA` |
| `ui_now_2.png` | `#FEFDFC` | `#FDFCFB` |
| `ui_now_3.png` | `#FAFAF9` | `#FAFBFB` |
| `ui_now_4.png` | `#F8F9F8` | `#FDFDFC` |
| `ui_now_5.png` | `#FDFDFC` | `#FFFFFF` |

This confirms the current visual system is light/paper-like, not aligned with the requested dark-neutral embedded VS Code host context.

## Current implementation observations from `src/extension.ts`

The current dashboard is generated by `getDashboardHtml()` in `src/extension.ts`.

Observed structure:

1. Fixed help button and language toggle.
2. Top toolbar with three groups:
   - Fetch / More History / Sample / Analyze Next Batch / Analyze Selected / Analyze All Allowed / Refresh.
   - Open Summary / Generate Reports.
   - Settings File / Prompt Config / Clear Local Cache.
3. Collapsible settings panel.
4. Metadata strip.
5. Nine statistic buttons.
6. Pending panel.
7. Must Handle Today category.
8. Blocked/manual confirmation panel.
9. Remaining categories.
10. Threads panel.

Observed current CSS direction:

- `body` background: `#f3f0ea`.
- White cards and panels.
- Beige secondary buttons: `#d8c3a5`.
- Teal primary: `#0f4c5c`.
- Rounded cards and button groups.
- Light paper-like surface.
- Stats are equal-weight button cards.

## Design constraints preserved

- Preserve current functions.
- Preserve current information architecture at the meaning level.
- Do not remove configuration, reports, thread, pending, manual-confirm, ignored, or classification functions.
- Labels may be renamed when semantic clarity improves.
- Design must work with both Chinese and English labels.
- Prioritize current state and next action over passive forms.
- Configuration should stay quieter unless actively edited.
- Avoid hero, landing-page, portfolio, marketing dashboard, gradients, glass, purple AI style, decorative shadows, and generic admin-template cards.
