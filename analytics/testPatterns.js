const cases = require('./data/sampleCases.json');
const { findRepeatedCategories, findRisingCategories, findBusyRegions } = require('./patterns');

const today = new Date('2026-10-23');

console.log('--- Repeated categories ---');
console.log(findRepeatedCategories(cases, today));

console.log('--- Rising categories ---');
console.log(findRisingCategories(cases, today));

console.log('--- Busy regions ---');
console.log(findBusyRegions(cases, today));