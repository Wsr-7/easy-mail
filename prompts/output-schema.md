Allowed priorities:
- P0
- P1
- P2
- P3

Required top-level fields:
- generatedAt
- overview
- items

Required overview fields:
- totalMails
- mustHandleToday
- risks
- waitingForMe
- notices

Required item fields:
- mailId
- category
- priority
- subject
- sender
- receivedTime
- summary
- reason
- suggestedAction
- draftReply
- confidence
- needsOriginalMailCheck

Optional item fields:
- source
- evidence

Optional source fields:
- mailId
- internetMessageId
- entryId
- folder

Optional evidence item fields:
- sourceMailId
- quote
- reason

Use `evidence` only for short mail-body excerpts or metadata that directly support the classification, priority, or suggested action. Do not invent quotes. If evidence is uncertain, omit it and set `needsOriginalMailCheck` to `true`.

If there is not enough evidence to judge a mail, set `needsOriginalMailCheck` to `true` and put it into `uncertain` or a conservative category.

Return valid JSON only.
