# Easy Mail Current UI Diagnosis

Generated: 2026-06-18
Scope: current Dashboard UI shown in `ui_now_*.png` and implemented in `src/extension.ts#getDashboardHtml()`.

## Design read

This is a VS Code plugin embedded UI for high-frequency mail triage and security-aware analysis. The redesign must improve operational clarity without turning it into a website.

## Core diagnosis

The current UI contains the right functions but gives too many functions the same visual importance. It behaves like a working proof-of-concept control page, not yet like a durable embedded product surface.

## Grouping problems

### Current state

The current page groups by implementation convenience:

- Toolbar group 1: pull, history, sample, analyze next, analyze selected, analyze all, refresh.
- Toolbar group 2: open summary, generate reports.
- Toolbar group 3: settings file, prompt config, clear cache.
- Collapsed settings panel.
- Metadata strip.
- Equal stats grid.
- Pending, must-handle, blocked, all other categories, threads.

### Problem

The user has to mentally separate these responsibilities:

- Primary operations.
- Secondary file/report actions.
- Runtime status.
- Safety review.
- Configuration.
- Passive stats.
- Actionable work queues.

But the UI does not separate them strongly enough. Toolbar buttons, stat cards, details panels, mail cards, and thread cards all occupy a similar visual layer.

### Redesign implication

The first screen should be organized as:

1. Current status and next action.
2. Primary operation cluster.
3. Attention queues.
4. Supporting stats.
5. Quiet configuration and report affordances.

## Hierarchy problems

### Current state

- The toolbar appears first and dominates the top of the page.
- Settings appears before status and statistics.
- Metadata appears before work queues.
- Stats are equal cards, with no clear primary versus secondary metrics.
- `Pending`, `Must Handle`, `Blocked`, `Risk`, `Waiting`, `Notice`, and `Threads` are all visually similar.

### Problem

For a daily-use mail triage tool, the most important questions are:

- Is anything running?
- What finished?
- What requires my attention?
- What should I do next?

The current top region answers “what buttons exist” before answering those operational questions.

### Redesign implication

The status block should be promoted above passive configuration. The UI should expose:

- Last pull/import/analyze state.
- Pending allowed count.
- Manual-confirm / blocked count.
- Next recommended action.
- Active task progress if busy.

## Action overload problems

### Current state

Top toolbar contains many buttons at similar size and contrast:

- Fetch New
- More History
- Sample
- Analyze Next Batch
- Analyze Selected
- Analyze All Allowed
- Refresh
- Open Summary
- Generate Reports
- Settings File
- Prompt Config
- Clear Local Cache

### Problem

The toolbar asks users to choose among implementation commands before showing workflow priority. Repeated-use actions and occasional actions are visually mixed.

### Redesign implication

Actions should be grouped by frequency and risk:

- Primary: Fetch New, Analyze Next Batch.
- Contextual primary: Analyze Selected only when selections exist or pending queue is in focus.
- Secondary: More History, Refresh.
- Output: Open Summary, Generate Reports.
- Utilities: Settings File, Prompt Config.
- Destructive/risky utility: Clear Local Cache should be quiet and visually separated.

## State visibility problems

### Current state

Busy state is currently represented by disabled buttons and inline spinners on specific buttons. Runtime metadata is shown in a metadata strip.

### Problem

Button-level spinners do not create a single reliable operational read. The user still has to scan the toolbar and metadata to understand whether the system is fetching, loading, analyzing, generating reports, or idle.

### Redesign implication

Add a dedicated runtime/status area:

- Idle / Fetching / Loading history / Analyzing / Generating reports / Loading models.
- Last pull and last import.
- Model status.
- Security gate mode.
- One next action.

This area should sit near the top and use subdued but unmistakable semantic accent.

## Statistics weighting problems

### Current state

The UI displays nine equal statistic buttons:

- Pulled
- Pending
- Analysed
- Needs Confirm
- Must Handle
- Risk
- Waiting
- Notice
- Threads

### Problem

Equal stats flatten operational meaning. `Needs Confirm`, `Must Handle`, and `Risk` should have higher priority than `Pulled`, `Analysed`, `Notice`, or total `Threads`.

### Redesign implication

Use a tiered statistics system:

- Primary operational stats: Needs Confirm, Must Handle, Pending Allowed, Risk.
- Secondary throughput stats: Pulled, Analysed, Threads, Notice, Waiting.
- Stats should remain clickable but not all use equal card size.

## Task list readability problems

### Current state

Mail cards contain subject, from, received time, classification, security reason, thread link, draft, and actions. Thread cards contain subject, participants, message count, last time, folders, content status, security, actions, analysis details, and timeline.

### Problem

Cards are information-rich but low-density scanning is weak:

- Labels and values are not aligned into fast-scan rows.
- Priority, category, and security state are not consistently placed.
- The card title and next action are not always the strongest anchors.
- Details panels can become a long vertical page.
- High-priority work does not feel more actionable than passive categories.

### Redesign implication

Cards should become compact work items:

- Left: priority/status rail or badge stack.
- Center: subject, sender/participants, one-line summary, reason.
- Right: time, category, primary action.
- Secondary details hidden behind disclosure.
- High-priority queues use denser rows and stronger text weight.
- Notice/ignored queues use lower contrast and collapsed defaults.

## VS Code dark host mismatch

### Current state

Current screenshots and CSS show a light paper-like UI:

- Main surfaces around `#F7F6F3` to `#FFFFFF`.
- Beige secondary controls.
- White cards.
- Rounded card style.

### Problem

This visual system clashes with a dark VS Code host environment and reads as a standalone web page or light note app. The user explicitly requested a subdued dark-neutral product palette, ultra-flat surfaces, minimal shadows, and sparse semantic accent.

### Redesign implication

Use VS Code-compatible dark neutrals:

- Base: near `#1E1E1E` / `#181A1F`.
- Panel: `#20242A` / `#242932`.
- Border: `#30363D` / `#3A4048`.
- Text primary: soft light gray.
- Text secondary: muted gray.
- Accent: single restrained blue/cyan or amber only for state and action.
- No glass, no purple AI, no large gradients, no thick shadows.

## Summary of what must change

1. Replace flat command row with role-based command area.
2. Promote runtime/status and next action above settings.
3. Make attention-required queues more prominent than passive configuration.
4. Split statistics into operational and secondary tiers.
5. Redesign task cards for scanning density and action clarity.
6. Make configuration quiet and collapsible.
7. Ground visual language in dark VS Code host patterns.
8. Preserve current functions and meaning-level IA.
