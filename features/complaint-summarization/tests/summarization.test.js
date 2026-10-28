import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { summarizeComplaint } from '../src/summarizer.js';
import { PROVISIONAL_CATEGORIES, validateModelOutput, validateOutput } from '../src/outputValidator.js';

const syntheticComplaint = 'Students report that the library computers are unavailable and the internet access is unreliable during exams.';

async function summarizeWithTestId(description, options = {}) {
  return summarizeComplaint(description, { complaint_id: 'CMP-TEST', ...options });
}

async function withGoogleGenAI(callback, { withKey = true } = {}) {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalProvider = process.env.SUMMARIZATION_PROVIDER;
  if (withKey) process.env.GEMINI_API_KEY = 'test-key-not-a-real-credential';
  else delete process.env.GEMINI_API_KEY;
  process.env.SUMMARIZATION_PROVIDER = 'google_genai';
  try {
    return await callback();
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalProvider === undefined) delete process.env.SUMMARIZATION_PROVIDER;
    else process.env.SUMMARIZATION_PROVIDER = originalProvider;
  }
}

async function withLocalProvider(callback) {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalProvider = process.env.SUMMARIZATION_PROVIDER;
  delete process.env.GEMINI_API_KEY;
  process.env.SUMMARIZATION_PROVIDER = 'local';
  try {
    return await callback();
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalProvider === undefined) delete process.env.SUMMARIZATION_PROVIDER;
    else process.env.SUMMARIZATION_PROVIDER = originalProvider;
  }
}

function mockedGoogleGenAIClient(response) {
  const calls = [];
  const client = {
    models: {
      generateContent: async (request) => {
        calls.push(request);
        if (response instanceof Error) throw response;
        return { text: typeof response === 'string' ? response : JSON.stringify(response) };
      }
    }
  };
  return { calls, client };
}

test('local summarization returns only the agreed response envelope and field types', async () => {
  const result = await withLocalProvider(() => summarizeComplaint(syntheticComplaint, { complaint_id: 'CMP-1001' }));

  assert.deepEqual(Object.keys(result).sort(), ['data', 'success']);
  assert.equal(result.success, true);
  assert.deepEqual(Object.keys(result.data).sort(), [
    'complaint_id',
    'key_issues',
    'requires_human_review',
    'suggested_category',
    'suggested_category_id',
    'summary'
  ]);
  assert.equal(result.data.complaint_id, 'CMP-1001');
  assert.equal(typeof result.data.summary, 'string');
  assert.ok(result.data.summary.length > 0);
  assert.ok(Array.isArray(result.data.key_issues));
  assert.ok(result.data.key_issues.length >= 1 && result.data.key_issues.length <= 5);
  assert.ok(result.data.key_issues.every((issue) => typeof issue === 'string' && issue.trim().length > 0));
  assert.ok(PROVISIONAL_CATEGORIES.includes(result.data.suggested_category));
  assert.equal(result.data.suggested_category_id, null);
  assert.equal(typeof result.data.requires_human_review, 'boolean');
  assert.equal(validateOutput(result).ok, true);
});

test('grounded key issues are extracted and stay close to the complaint wording', async () => {
  const result = await summarizeWithTestId('Students are not receiving hall tickets on time and the exam timetable is inconsistent.');

  assert.ok(result.data.key_issues.some((issue) => /hall tickets|exam timetable/i.test(issue)));
  assert.ok(result.data.summary.includes('hall tickets') || result.data.summary.includes('exam timetable'));
});

test('SUMMARIZATION_PROVIDER=local uses local classification without calling the SDK', async () => {
  let callCount = 0;
  await withLocalProvider(async () => {
    const result = await summarizeWithTestId('The course fee portal is not working and students cannot pay the tuition fee.', {
      googleGenAIClient: { models: { generateContent: async () => { callCount += 1; } } }
    });
    assert.equal(result.success, true);
    assert.equal(result.data.suggested_category, 'Fees and Financial Issues');
    assert.equal(callCount, 0);
  });
});

test('SUMMARIZATION_PROVIDER selects Google GenAI and calls the fixed model through the SDK', async () => {
  await withGoogleGenAI(async () => {
    const { calls, client } = mockedGoogleGenAIClient({
      summary: 'Students report unavailable library computers and unreliable internet during examinations.',
      key_issues: ['Library computers are unavailable.', 'Internet access is unreliable during exams.'],
      suggested_category: 'Infrastructure and Facilities'
    });
    const statuses = [];
    const result = await summarizeComplaint(syntheticComplaint, {
      complaint_id: 'CMP-1002',
      googleGenAIClient: client,
      onProviderStatus: (status) => statuses.push(status)
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, 'gemini-2.5-flash');
    assert.equal(calls[0].config.responseMimeType, 'application/json');
    assert.deepEqual(calls[0].config.responseJsonSchema.required, ['summary', 'key_issues', 'suggested_category']);
    assert.equal(result.success, true);
    assert.equal(result.data.complaint_id, 'CMP-1002');
    assert.equal(result.data.suggested_category, 'Infrastructure and Facilities');
    assert.equal(result.data.suggested_category_id, null);
    assert.equal(validateOutput(result).ok, true);
    assert.deepEqual(statuses, [{ provider: 'google_genai', provider_status: 'success' }]);
  });
});

test('Google GenAI API errors expose safe status/message diagnostics without key or complaint', async () => {
  await withGoogleGenAI(async () => {
    const statuses = [];
    const apiError = new Error(JSON.stringify({
      error: {
        code: 400,
        message: 'Invalid field complaint SECRET_TEXT test-key-not-a-real-credential',
        status: 'INVALID_ARGUMENT'
      }
    }));
    apiError.status = 400;
    const { client } = mockedGoogleGenAIClient(apiError);
    await assert.rejects(() => summarizeComplaint('SECRET_TEXT', {
      complaint_id: 'CMP-TEST',
      googleGenAIClient: client,
      onProviderStatus: (status) => statuses.push(status)
    }), (error) => {
      assert.equal(error.message, 'Google GenAI request failed (api_http_400): Invalid field complaint [COMPLAINT REDACTED] [REDACTED].');
      assert.equal(error.message.includes('test-key-not-a-real-credential'), false);
      assert.equal(error.message.includes('SECRET_TEXT'), false);
      return true;
    });

    assert.equal(statuses[0].provider, 'google_genai');
    assert.equal(statuses[0].provider_status, 'failure');
    assert.equal(statuses[0].reason, 'api_http_400');
    assert.equal(statuses[0].error_status, 400);
    assert.equal(statuses[0].error_message.includes('SECRET_TEXT'), false);
    assert.equal(statuses[0].error_message.includes('test-key-not-a-real-credential'), false);
    assert.equal(JSON.stringify(statuses).includes('test-key-not-a-real-credential'), false);
  });
});

test('malformed SDK response and malformed JSON return sanitized errors', async () => {
  await withGoogleGenAI(async () => {
    const { client: emptyClient } = mockedGoogleGenAIClient('');
    await assert.rejects(() => summarizeWithTestId(syntheticComplaint, { googleGenAIClient: emptyClient }), /Google GenAI request failed \(empty_response\)/);

    const { client: invalidJsonClient } = mockedGoogleGenAIClient('{not json');
    await assert.rejects(() => summarizeWithTestId(syntheticComplaint, { googleGenAIClient: invalidJsonClient }), /Google GenAI request failed \(invalid_json\)/);
  });
});

test('network failures and SDK timeouts return clear sanitized errors', async (t) => {
  await withGoogleGenAI(async () => {
    const { client: networkClient } = mockedGoogleGenAIClient(new Error('network disconnected'));
    await assert.rejects(() => summarizeWithTestId(syntheticComplaint, { googleGenAIClient: networkClient }), /provider_request_failed/);

    const client = { models: { generateContent: () => new Promise(() => {}) } };
    await assert.rejects(() => summarizeWithTestId(syntheticComplaint, {
      googleGenAIClient: client,
      timeoutMs: 5
    }), /Google GenAI request failed \(timeout\)/);
  });
  t.diagnostic('All Google GenAI requests use injected SDK-shaped clients; no network or complaint records are used.');
});

test('invalid model output is rejected by the validator and does not fall back', async () => {
  await withGoogleGenAI(async () => {
    const invalidModelOutput = { summary: '', key_issues: [''], suggested_category: 'Not a proposed category' };
    assert.equal(validateModelOutput(invalidModelOutput).ok, false);
    const { client } = mockedGoogleGenAIClient(invalidModelOutput);
    await assert.rejects(() => summarizeWithTestId(syntheticComplaint, { googleGenAIClient: client }), /malformed summarization result/);
  });
});

test('Google GenAI selection without an API key returns a clear error without calling SDK', async () => {
  let callCount = 0;
  await withGoogleGenAI(async () => {
    await assert.rejects(() => summarizeWithTestId(syntheticComplaint, {
      googleGenAIClient: { models: { generateContent: async () => { callCount += 1; } } }
    }), /GEMINI_API_KEY is not configured/);
    assert.equal(callCount, 0);
  }, { withKey: false });
});

test('test fixtures are synthetic and local provider requires no API key or internet', async () => {
  await withLocalProvider(async () => {
    const result = await summarizeWithTestId('A synthetic student report describes a broken classroom projector.');
    assert.equal(result.success, true);
    assert.equal(result.data.suggested_category, 'Infrastructure and Facilities');
  });
});

test('synthetic examples match the exact local response contract', async () => {
  await withLocalProvider(async () => {
    const examples = JSON.parse(await readFile(new URL('../examples/sampleComplaints.json', import.meta.url), 'utf8'));
    for (const example of examples) {
      const result = await summarizeComplaint(example.input.description, {
        complaint_id: example.input.complaint_id
      });
      assert.deepEqual(result, example.expectedResponse);
    }
  });
});

test('complaint IDs are required from the caller and preserved', async () => {
  const withId = await summarizeComplaint(syntheticComplaint, { complaint_id: 'CMP-1003' });
  assert.equal(withId.data.complaint_id, 'CMP-1003');
  await assert.rejects(() => summarizeComplaint(syntheticComplaint), /caller-supplied string/);
});

test('provider failures do not expose internal metadata in the public response', async () => {
  await withGoogleGenAI(async () => {
    const { client } = mockedGoogleGenAIClient(new Error('simulated failure with test-key-not-a-real-credential'));
    await assert.rejects(() => summarizeWithTestId('The placement office has not shared internship offers.', {
      googleGenAIClient: client
    }), /provider_request_failed/);
  });
});

test('public response rejects invalid category IDs and field shapes', () => {
  const invalid = {
    success: true,
    data: {
      complaint_id: 'CMP-1',
      summary: 'Synthetic summary.',
      key_issues: ['Synthetic issue.'],
      suggested_category: 'Other',
      suggested_category_id: 'invented-id',
      requires_human_review: false
    }
  };
  assert.equal(validateOutput(invalid).ok, false);
});

test('malformed Google GenAI JSON returns a sanitized error', async () => {
  await withGoogleGenAI(async () => {
    const { client } = mockedGoogleGenAIClient('{not valid json');
    await assert.rejects(() => summarizeWithTestId(syntheticComplaint, {
      googleGenAIClient: client
    }), /Google GenAI request failed \(invalid_json\)/);
  });
});
