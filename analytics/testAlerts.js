const cases = require('./data/sampleCases.json');
const { generateAlerts } = require('./alerts');

const today = new Date('2026-10-23');

const alerts = generateAlerts(cases, today);

console.log(`Total alerts: ${alerts.length}`);
alerts.forEach((a) => {
  console.log(`[${a.severity}] ${a.type} | ${a.message}`);
});