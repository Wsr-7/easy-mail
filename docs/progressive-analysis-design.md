# Progressive Mail Analysis Design

## Goal

Move from one-shot digest analysis to a local queue-based workflow:

- Pull mail into a durable local store without duplicating already pulled mail.
- Show pulled-but-unanalysed mail in the dashboard.
- Analyse only allowed mails in small batches.
- Let users manually analyse selected mails.
- Gate automatic analysis by local classification level.
- Make category definitions and prompt pieces user-customisable.

## Data Model

The extension keeps the existing `mail-digest.md` for compatibility, then imports it into:

- `data/mail-store.json`: durable pulled mail records.
- `data/analysis-result.json`: analysed records returned by Copilot.
- `data/classification-cache.json`: local classification per mail.
- `data/prompt-config.json`: user-customisable category and prompt configuration.

Each pulled mail gets a stable id computed from source fields when Outlook does not expose a stable id in the digest:

```text
sha256(folder + receivedTime + from + subject + bodyExcerpt)
```

This is good enough for the current VBS output and can later be replaced by `InternetMessageID` / `EntryID` when the collector exports them.

## Workflow

`Pull Mail` keeps running the VBS collector, parses the generated digest, merges new records into `mail-store.json`, and skips existing stable ids.

`Analyze Next Batch` selects pending mails where:

- the mail is not already analysed,
- the mail is not ignored,
- auto analysis is enabled,
- classification level is less than or equal to the configured maximum.

`Analyze Selected` ignores auto gating only after explicit user action. It still records the classification and reason in local state.

## Classification

The first implementation supports deterministic default classification plus a future script hook.

Default classification levels:

- `0` Public
- `1` Internal
- `2` Confidential
- `3` Restricted
- `4` Highly Restricted

The dashboard shows:

- auto allowed
- blocked by classification
- manual confirmation needed

The custom classification script location is reserved as `scripts/classify-mail.sample.js`. The runtime config can point to another command later.

## Prompt Composition

The extension composes Copilot prompts from:

- `prompts/base-system.md`
- `prompts/categories.default.json`
- `prompts/output-schema.md`
- `prompts/reply-draft.md`
- language instruction
- current batch mail content

Users can edit the copied `prompt-config.json` in global storage to add or change categories. The extension validates only that categories have an `id`; unknown category ids from the model are normalised to `uncertain`.

## Dashboard

The dashboard adds:

- pulled count
- pending count
- analysed count
- blocked count
- pending mail panel
- blocked/manual confirmation panel
- analysed category panels

Buttons:

- Pull Mail
- Analyze Next Batch
- Analyze Selected
- Analyze All Allowed

## Verification

The implementation must keep existing tests passing and add tests for:

- mail store merge and de-duplication
- pending/blocked queue calculation
- prompt composition with custom categories
