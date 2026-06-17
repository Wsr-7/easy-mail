Return exactly one JSON object with this shape:

```json
{
  "generatedAt": "ISO timestamp",
  "overview": {
    "totalThreads": 1,
    "mustHandleToday": 0,
    "risks": 0,
    "waitingForMe": 0,
    "notices": 0
  },
  "items": [
    {
      "threadId": "thread id from input",
      "category": "mustHandleToday | importantSender | risk | waitingForMe | followUp | notice | ignored | uncertain",
      "priority": "P0 | P1 | P2 | P3",
      "subject": "thread subject",
      "participants": ["visible participant"],
      "lastTime": "last visible message time",
      "oneLineSummary": "one sentence summary",
      "currentStatus": "current thread status",
      "keyDecisions": ["decision with source evidence"],
      "openQuestions": ["question still open"],
      "actionItems": [
        {
          "owner": "owner if visible",
          "task": "task",
          "deadline": "deadline if visible",
          "sourceMailId": "mail id",
          "sourceTime": "message time"
        }
      ],
      "waitingOn": ["person or team if visible"],
      "risks": [
        {
          "level": "low | medium | high",
          "description": "risk",
          "sourceMailId": "mail id"
        }
      ],
      "needMyReply": false,
      "suggestedAction": "recommended next action",
      "draftReply": "plain text draft reply or empty string",
      "confidence": 0.0,
      "evidence": [
        {
          "sourceMailId": "mail id",
          "quote": "short quote from visible timeline",
          "reason": "why this evidence matters"
        }
      ],
      "needsOriginalMailCheck": false,
      "partialContext": false
    }
  ]
}
```
