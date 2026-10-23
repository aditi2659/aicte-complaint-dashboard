// demo.js
// Prints 5 demo scenarios for the SIH presentation.

const cases = require('./data/sampleCases.json');
const { calculateRisk } = require('./riskScore');
const { getPatterns, getPriorityList, getAlerts } = require('./index');

const today = new Date('2026-10-23');
const line = '='.repeat(60);

function title(text) {
  console.log('\n' + line);
  console.log(text);
  console.log(line);
}

// Scenario 1: one high-risk case, with reasons
title('SCENARIO 1: Why is this case High risk?');
const c003 = cases.find((c) => c.complaint_id === 'C003');
const r1 = calculateRisk(c003, today);
console.log(`Case ${c003.complaint_id} → score ${r1.score}, level ${r1.level}`);
r1.reasons.forEach((r) => console.log('  - ' + r));
console.log('SAY: Every score comes with reasons, so officials can trust it.');

// Scenario 2: priority list
title('SCENARIO 2: Needs Attention First (top 3)');
getPriorityList(cases, today, 3).forEach((c, i) => {
  console.log(`${i + 1}. ${c.complaint_id} | ${c.level} (${c.score}) | days left: ${c.days_left}`);
});
console.log('SAY: Officials do not search through all cases. The most urgent ones come first.');

// Scenario 3: repeating pattern
title('SCENARIO 3: Repeating complaint pattern');
getPatterns(cases, today).repeatedCategories.forEach((p) => console.log(p.message));
console.log('SAY: The system spots repeating problems at one institution early.');

// Scenario 4: high severity alerts
title('SCENARIO 4: High severity alerts');
getAlerts(cases, today)
  .filter((a) => a.severity === 'High')
  .forEach((a) => console.log(`[${a.severity}] ${a.message}`));
console.log('SAY: Deadline and escalation alerts are created automatically.');

// Scenario 5: overlap raises the risk
title('SCENARIO 5: Overlap raises the risk');
const c002 = cases.find((c) => c.complaint_id === 'C002');
const before = calculateRisk(c002, today);
const after = calculateRisk({ ...c002, has_overlap: true }, today);
console.log(`Case ${c002.complaint_id} without overlap → ${before.score} (${before.level})`);
console.log(`Case ${c002.complaint_id} with overlap    → ${after.score} (${after.level})`);
console.log('SAY: When another Bureau is also handling a matching case, the risk goes up.');
console.log('     This uses Member 3\'s strong match only, not just the same institution.');