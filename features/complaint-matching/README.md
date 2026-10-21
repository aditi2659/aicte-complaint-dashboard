# Cross-Bureau Complaint Intelligence

## What this module does
- Compares synthetic complaint records.
- Uses institution ID, category, and description-word overlap as simple signals.
- Returns a score and human-readable reasons.
- Restricts suggestions to cases submitted to different Bureaus/Cells.
- Marks every result for official review; it does not automatically merge or label complaints as duplicates.

## Run
From the repository root:
```bash
node features/complaint-matching/src/matcher.js
```

This is a transparent baseline, not a production-grade AI model. Scores are heuristic and should be tuned and evaluated with domain experts before real use.
