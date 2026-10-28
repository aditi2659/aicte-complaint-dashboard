import test from 'node:test';
import assert from 'node:assert/strict';

import { suggestCategory } from '../src/categoryClassifier.js';
import { PROVISIONAL_CATEGORIES, validateOutput } from '../src/outputValidator.js';

test('clear infrastructure complaints are classified deterministically', () => {
  const result = suggestCategory(
    'The classroom has no ventilation and the water supply is broken for several weeks.',
    'The complaint reports repeated infrastructure problems affecting classroom conditions.',
    ['No water supply in the classroom', 'Poor ventilation and unsafe conditions']
  );

  assert.equal(result.suggested_category, 'Infrastructure and Facilities');
  assert.equal(result.category_review_required, false);
});

test('clear admissions complaints are classified deterministically', () => {
  const result = suggestCategory(
    'Students were denied admission because the merit list was released late and seats were filled without transparency.',
    'The complaint alleges irregular admission procedures and seat allocation issues.',
    ['Admissions were delayed', 'Seat allocation was unfair']
  );

  assert.equal(result.suggested_category, 'Admissions and Enrollment');
  assert.equal(result.category_review_required, false);
});

test('ambiguous or insufficient descriptions require review', () => {
  const result = suggestCategory(
    'There are serious concerns.',
    'The complaint describes a problem without enough detail to determine the exact cause.',
    ['General concern']
  );

  assert.equal(result.suggested_category, 'Other');
  assert.equal(result.category_review_required, true);
});

test('the classifier only suggests one of the proposed categories', () => {
  const result = suggestCategory('The classroom water supply and computers are unavailable.', '', []);
  assert.ok(PROVISIONAL_CATEGORIES.includes(result.suggested_category));
});

test('output validation rejects invalid categories, empty summaries, and invalid issue arrays', () => {
  const invalid = {
    success: true,
    data: {
      complaint_id: 'CMP-TEST',
      summary: '',
      key_issues: [],
      suggested_category: 'Invalid Category',
      suggested_category_id: null,
      requires_human_review: 'yes'
    }
  };

  const result = validateOutput(invalid);
  assert.equal(result.ok, false);
  assert.match(result.error, /summary|key_issues|category|review/i);
});
