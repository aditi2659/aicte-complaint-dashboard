# Analytics Module (Predictive Analytics + Early Warning)

Rule-based risk scoring, pattern detection, priority list and alerts for complaint cases.
The module does not touch the database. It takes a list of cases and returns results.

## Input fields (one object per case)

complaint_id, institution_id, region, category, created_at, due_date,
last_action_date, status, bureau, transfer_count, is_escalated,
has_overlap (optional, from Member 3, strong match only)

These match the columns of `complaint_analytics_view`.

## Risk score rules (0 to 100)

| Condition | Points |
|---|---|
| Deadline already crossed | +60 |
| Deadline in 3 days or less | +40 |
| No action for 7+ days | +20 |
| Transferred 2+ times | +15 |
| Case escalated | +10 |
| Strong overlap with another Bureau/Cell | +10 |

Levels: 0 to 39 Low, 40 to 69 Medium, 70 to 100 High.
Disposed cases are skipped (level "Closed"). Every score comes with its reasons.

## Patterns

- Repeated category: same institution + same category, 3+ cases in 90 days
- Rising categories: more cases in the last 30 days than the 30 days before
- Busy regions: complaint count per region in the last 30 days

## Alerts

deadline_crossed, deadline_approaching (3 days or less), pending_reminder (7+ days idle), escalation

## Endpoints

| Endpoint | Returns |
|---|---|
| GET /analytics/risk-cases | Open cases with score, level, reasons |
| GET /analytics/patterns | Repeated categories, rising categories, busy regions |
| GET /analytics/priority-list?limit=10 | "Needs Attention First" list |
| GET /analytics/alerts | All current alerts |

All responses look like `{ "success": true, "data": ... }`.

## How to plug into the backend (Member 2)

```javascript
const createAnalyticsRouter = require('./analytics/routes');

// getCases reads rows from complaint_analytics_view and returns an array
app.use('/analytics', createAnalyticsRouter(getCases));
```

## Tests

node testRisk.js, testPatterns.js, testPriority.js, testAlerts.js,
testIndex.js, testEdgeCases.js, testOverlap.js (all use data/sampleCases.json)
