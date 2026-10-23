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


## Output Contract

The matcher exposes two main functions:

- `findRelatedComplaints(complaints)` returns potential cross-bureau complaint matches.
- `addOverlapFlags(complaints, matches)` returns complaint records with overlap information.

### Match result

Each match includes:

- `caseA` and `caseB`: the two complaint records being compared.
- `score`: a heuristic match score between 0 and 1, not a probability.
- `reasons`: explanations for why the pair was flagged.
- `requiresOfficialReview`: indicates that an official must review the result.

### Per-complaint overlap fields

Each complaint returned by `addOverlapFlags()` includes:

- `has_overlap`: `true` if at least one qualifying match was found; otherwise `false`.
- `matched_case_ids`: an array of IDs for the complaints matched to this complaint.

### Integration with Predictive Analytics

The Predictive Analytics + Early Warning module may use `has_overlap` as an input to its risk-scoring rules.

The matching module identifies potential overlaps; it does not confirm duplicate complaints or assign risk scores. Officials must review flagged matches.

### Current limitations

- Matching currently requires the same institution ID.
- Matching is based on category and description-word similarity.
- Match scores and thresholds are heuristic and require further evaluation.
- Sample data is fictional and must not contain real complainant personal information.
