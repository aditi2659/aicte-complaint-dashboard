// checkData.js
// Checks that real data matches what the analytics module expects.

const raw = require('./data/realCases.json');

// Works with a plain array, or an object that wraps the array (for example { meta, cases })
const cases = Array.isArray(raw)
  ? raw
  : Object.values(raw).find((v) => Array.isArray(v));

if (!cases) {
  console.log('Could not find a list of cases in realCases.json');
  process.exit(1);
}

const { getFullAnalytics } = require('./index');

const REQUIRED = [
  'complaint_id', 'institution_id', 'region', 'category',
  'created_at', 'due_date', 'last_action_date',
  'status', 'bureau', 'transfer_count', 'is_escalated',
];

console.log(`Total cases loaded: ${cases.length}`);

const missing = REQUIRED.filter((f) => !(f in cases[0]));
console.log('Missing fields:', missing.length ? missing.join(', ') : 'none');

console.log('Status values:', [...new Set(cases.map((c) => c.status))].join(', '));
console.log('Bureau values:', [...new Set(cases.map((c) => c.bureau))].join(', '));

let badDates = 0;
cases.forEach((c) => {
  ['created_at', 'due_date', 'last_action_date'].forEach((f) => {
    if (c[f] && isNaN(new Date(c[f]))) badDates += 1;
  });
});
console.log('Invalid dates:', badDates);

console.log('Cases with no due_date:', cases.filter((c) => !c.due_date).length);
console.log('Cases with no last_action_date:', cases.filter((c) => !c.last_action_date).length);
console.log('Cases with has_overlap = true:', cases.filter((c) => c.has_overlap === true).length);

const result = getFullAnalytics(cases, new Date());
console.log('--- Module results ---');
console.log('Risk cases:', result.riskCases.length);
console.log('High risk:', result.riskCases.filter((c) => c.risk.level === 'High').length);
console.log('Repeated categories:', result.patterns.repeatedCategories.length);
console.log('Rising categories:', result.patterns.risingCategories.length);
console.log('Busy regions:', result.patterns.busyRegions.length);
console.log('Alerts:', result.alerts.length);

console.log('--- Priority list ---');
result.priorityList.forEach((c, i) => {
  console.log(`${i + 1}. ${c.complaint_id} | ${c.level} (${c.score}) | days left: ${c.days_left} | ${c.reasons.join(', ')}`);
});