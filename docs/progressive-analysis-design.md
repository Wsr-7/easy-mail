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

Each pulled mail gets a stable id from Outlook-native fields first:

```text
1. InternetMessageID
2. EntryID
3. sha256(folder + receivedTime + from + subject + bodyExcerpt) fallback
```

The hash fallback is only used when Outlook does not expose either native id.

`mail-store.json` is a local JSON document, not SQLite. The current POC keeps this format because it is easy to inspect, easy to delete, and sufficient for a personal local cache. SQLite should be considered later if mailbox volume becomes large enough to require indexed queries.

Retention policy:

- `mailRetentionDays` prunes old local store items after pull.
- `Clear Local Cache` deletes the local store, classification cache, and analysis result.
- Original Outlook mail is never deleted by this tool.

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

- `0` PUBLIC
- `1` INTERNAL
- `2` REGISTERED
- `3` HIGH REGISTERED

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

The default category list includes `importantSender`. The dashboard setting `importantSenders` and `prompt-config.json` can list watched senders, managers, executives, or mail groups. The composed prompt instructs Copilot to prefer `importantSender` when sender, recipient group, subject, or body contains those values.

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
