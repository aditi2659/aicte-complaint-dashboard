const cases = require('./data/sampleCases.json');
const { getFullAnalytics } = require('./index');

const today = new Date('2026-10-23');

const result = getFullAnalytics(cases, today);

console.log('Risk cases:', result.riskCases.length);
console.log('Repeated categories:', result.patterns.repeatedCategories.length);
console.log('Rising categories:', result.patterns.risingCategories.length);
console.log('Busy regions:', result.patterns.busyRegions.length);
console.log('Priority list:', result.priorityList.length);
console.log('Alerts:', result.alerts.length);