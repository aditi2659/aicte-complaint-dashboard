import test from 'node:test';
import assert from 'node:assert/strict';

import { validateComplaint } from '../src/validateInput.js';

test('valid complaint input is accepted and trimmed', () => {
  const result = validateComplaint('  Students are not receiving hall tickets.  ');

  assert.equal(result.ok, true);
  assert.equal(result.value, 'Students are not receiving hall tickets.');
});

test('empty, whitespace-only, missing, and non-string input are rejected', () => {
  assert.deepEqual(validateComplaint(''), { ok: false, error: 'Complaint description is required.' });
  assert.deepEqual(validateComplaint('   '), { ok: false, error: 'Complaint description is required.' });
  assert.deepEqual(validateComplaint(), { ok: false, error: 'Complaint description must be a non-empty string.' });
  assert.deepEqual(validateComplaint(null), { ok: false, error: 'Complaint description must be a non-empty string.' });
  assert.deepEqual(validateComplaint(123), { ok: false, error: 'Complaint description must be a non-empty string.' });
});

test('complaints longer than 10,000 characters are rejected', () => {
  const longText = 'A'.repeat(10001);
  const result = validateComplaint(longText);

  assert.equal(result.ok, false);
  assert.match(result.error, /10,000 characters/i);
});

test('the original caller input is preserved', () => {
  const original = '  Lab equipment is missing.  ';
  const clone = original.slice();

  const result = validateComplaint(original);

  assert.equal(original, clone);
  assert.equal(result.value, 'Lab equipment is missing.');
});
