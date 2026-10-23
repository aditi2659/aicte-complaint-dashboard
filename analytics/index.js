// index.js
// One entry point for the whole analytics module.
// Member 2 (backend) calls these functions with a list of cases.

const { calculateRisk } = require('./riskScore');
const {
  findRepeatedCategories,
  findRisingCategories,
  findBusyRegions,
} = require('./patterns');
const { buildPriorityList } = require('./priority');
const { generateAlerts } = require('./alerts');

// Returns every open case with its risk score, level and reasons
function getRiskCases(cases, today = new Date()) {
  return cases
    .map((c) => ({ ...c, risk: calculateRisk(c, today) }))
    .filter((c) => c.risk.level !== 'Closed')
    .sort((a, b) => b.risk.score - a.risk.score);
}

// Returns all three pattern types together
function getPatterns(cases, today = new Date()) {
  return {
    repeatedCategories: findRepeatedCategories(cases, today),
    risingCategories: findRisingCategories(cases, today),
    busyRegions: findBusyRegions(cases, today),
  };
}

// Returns the "Needs Attention First" list
function getPriorityList(cases, today = new Date(), limit = 10) {
  return buildPriorityList(cases, today, limit);
}

// Returns all alerts
function getAlerts(cases, today = new Date()) {
  return generateAlerts(cases, today);
}

// Returns everything in one object (useful for the dashboard summary)
function getFullAnalytics(cases, today = new Date()) {
  return {
    riskCases: getRiskCases(cases, today),
    patterns: getPatterns(cases, today),
    priorityList: getPriorityList(cases, today),
    alerts: getAlerts(cases, today),
  };
}

module.exports = {
  getRiskCases,
  getPatterns,
  getPriorityList,
  getAlerts,
  getFullAnalytics,
};