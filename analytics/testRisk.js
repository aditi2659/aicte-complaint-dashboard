const cases = require('./data/sampleCases.json');
const { calculateRisk } = require('./riskScore');

const today = new Date('2026-10-23'); // fixed date so results stay the same

cases.forEach((c) => {
  const result = calculateRisk(c, today);
  console.log(c.complaint_id, '→', result.score, result.level, '|', result.reasons.join(', '));
});