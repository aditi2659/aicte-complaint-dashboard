# Smart Complaint Summarization

## Purpose and boundaries

This standalone JavaScript module validates complaint text, summarizes it, extracts grounded key issues, and suggests a provisional category. It does not use Express, connect to a database, store complaint records, approve categories, or change complaint status. The backend integration layer is expected to fetch the complaint and pass its description and caller-owned metadata to this module.

Only files in this directory are part of this implementation. Backend routes, database schemas, frontend code, and other feature directories are intentionally untouched. The endpoint `POST /api/v1/complaints/:id/summarize` is not implemented here.

## Structure

- `src/index.js`: public module exports
- `src/validateInput.js`: complaint description validation
- `src/summarizer.js`: local summarization, opt-in Gemini request, and fallback orchestration
- `src/categoryClassifier.js`: deterministic provisional category classifier
- `src/outputValidator.js`: public response and model response validation
- `.env.example`: local environment template; copy to `.env` and add a real key locally
- `scripts/live-check.js`: opt-in live request using synthetic complaint text only
- `tests/`: Node.js built-in `node:test` suites; all provider requests are mocked
- `examples/sampleComplaints.json`: synthetic examples and expected contract fields
- `package.json`: ES module configuration and test script

## Requirements and tests

Use Node.js 20 or later. The official `@google/genai` SDK is installed only for this feature package; no backend dependency is assumed.

From this directory:

```bash
npm test
```

All unit tests mock the SDK client. They do not require network access, a real API key, paid Gemini access, or real complaint records.

## Google GenAI setup and live verification

The provider identifier is `google_genai`, and the model is fixed as `gemini-2.5-flash`. It is not silently changed to another model. The API key is read only from `GEMINI_API_KEY`.

From this directory, install the module dependency and prepare a local environment file:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` locally and replace the placeholder with your key. Do not commit `.env` or paste a real key into source files. The template is:

```dotenv
GEMINI_API_KEY=your_api_key_here
SUMMARIZATION_PROVIDER=google_genai
```

Run the opt-in live verification command:

```powershell
npm run verify:gemini
```

This command loads `.env` using Node.js `--env-file` and sends only the synthetic complaint in `scripts/live-check.js`. It requires an internet connection and a valid key. A successful mocked test does not constitute live API verification; only running this command and observing `Provider status: google_genai/success` demonstrates a live request succeeded.

To select local processing, set `SUMMARIZATION_PROVIDER=local` in the process environment or `.env`; no Google request will be made. Explicit selection of `google_genai` without a key, or any provider/API/response failure, throws a clear sanitized error. It never silently falls back to local summarization.

## Public API and input

The public operation remains `summarizeComplaint(description, options)`. It validates the description itself, so callers may pass the original untrimmed string. The caller must pass its existing complaint ID in `options.complaint_id`; the module rejects a missing or invalid ID rather than inventing one.

```js
import { summarizeComplaint } from './features/complaint-summarization/src/index.js';

const result = await summarizeComplaint(
  'Students report that library computers are unavailable during examinations.',
  { complaint_id: 'CMP-1001' }
);
```

Input validation rejects missing, non-string, empty, whitespace-only, and over-10,000-character descriptions. Trimming is used for processing; the caller's original string is not mutated.

## Agreed response contract

Successful output contains exactly the following fields. `complaint_id` comes from the caller, and `suggested_category_id` remains `null` until the team supplies a reliable mapping to an approved category ID.

```json
{
  "success": true,
  "data": {
    "complaint_id": "CMP-1001",
    "summary": "Students report that library computers are unavailable during examinations.",
    "key_issues": ["Library computers are unavailable during examinations."],
    "suggested_category": "Infrastructure and Facilities",
    "suggested_category_id": null,
    "requires_human_review": true
  }
}
```

`key_issues` contains 1 to 5 non-empty strings. The summary should be concise, neutral, and faithful to the source. `requires_human_review` is true for uncertain categories and every local result. Provider diagnostics are not added to the response; callers may optionally supply `onProviderStatus(status)` for internal status reporting. Its safe metadata includes only provider (`google_genai` or `local`), status (`success` or `failure`), and a non-sensitive reason code.

## Provisional categories

The classifier uses these 11 project-proposed category names. They are not verified or approved AICTE taxonomy:

1. Approval, Affiliation and Accreditation
2. Admissions and Enrollment
3. Infrastructure and Facilities
4. Faculty and Staff
5. Academic and Curriculum
6. Fees and Financial Issues
7. Examinations, Certificates and Documentation
8. Placements and Career Services
9. Regulatory Compliance
10. Faculty Development and Training
11. Other

Classification is deterministic keyword matching. `Other` is used when no reasonable match exists. Ambiguous, insufficient, or low-confidence matches require human review. Suggestions never approve a category or change complaint status. No category IDs are generated.

## Local fallback

When `SUMMARIZATION_PROVIDER=local`, the module extracts up to five source sentences, uses them as a concise extractive summary, classifies locally, and flags the result for human review. This local provider is deterministic, transparent, and not AI-generated. It is not equivalent to an LLM: it may not resolve context or distinguish related issues well. Human review remains necessary before relying on its summary or category.

## Optional Gemini provider and privacy

The official `@google/genai` SDK is called only when `SUMMARIZATION_PROVIDER=google_genai` and `GEMINI_API_KEY` is configured. The model is explicitly set to `gemini-2.5-flash`; it is not substituted. The API key is read exclusively from `GEMINI_API_KEY`. Gemini rejects request deadlines under 10 seconds, so the SDK deadline is clamped to at least 10 seconds and defaults to 30 seconds. An optional positive `timeoutMs` sets the caller-side timeout guard. Tests inject a mock SDK client; production constructs the real SDK client and never substitutes test responses.

Gemini use sends complaint text to Google for external processing. Do not enable it for real complaint data until the team explicitly approves the privacy, consent, retention, and compliance approach. The default is local-only; having an API key alone never sends complaint data. Never commit the key.

HTTP/API errors (including rate limits), timeouts, network failures, invalid JSON, empty or malformed payloads, and invalid model output throw sanitized errors when Google is selected. Provider status can be observed through `onProviderStatus`; error reasons do not contain the key or complaint text. The model returns summary, key issues, and a proposed category; the module validates the category against the provisional list and sets human review when the model and deterministic baseline conflict or confidence is low.

## Future backend integration

Backend work is deliberately deferred. A future integration should authenticate and authorize access to the complaint, fetch its description and ID, explicitly decide whether external processing is permitted, invoke this module with caller-owned `complaint_id`, and return or persist the result under the agreed API contract. Any persistence, status transitions, category-ID mappings, auditing, or endpoint implementation require separate team decisions and must not be inferred by this module.
