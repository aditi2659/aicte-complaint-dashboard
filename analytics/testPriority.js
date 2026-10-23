const cases = require('./data/sampleCases.json');
const { buildPriorityList } = require('./priority');

const today = new Date('2026-10-23');

const list = buildPriorityList(cases, today);

list.forEach((c, i) => {
  console.log(`${i + 1}. ${c.complaint_id} | ${c.level} (${c.score}) | days left: ${c.days_left} | ${c.reasons.join(', ')}`);
});