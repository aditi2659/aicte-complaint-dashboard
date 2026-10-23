// priority.js
// Builds the "Needs Attention First" list.

const { calculateRisk } = require('./riskScore');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function buildPriorityList(cases, today = new Date(), limit = 10) {
  return cases
    .map((c) => {
      const risk = calculateRisk(c, today);
      const startOfDay = (d) => {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
};
const daysLeft = c.due_date
  ? Math.round((startOfDay(c.due_date) - startOfDay(today)) / MS_PER_DAY)
  : null;

      return {
        complaint_id: c.complaint_id,
        institution_id: c.institution_id,
        bureau: c.bureau,
        status: c.status,
        is_escalated: c.is_escalated,
        days_left: daysLeft,
        score: risk.score,
        level: risk.level,
        reasons: risk.reasons,
      };
    })
    // 1. Remove closed cases
    .filter((c) => c.level !== 'Closed')
    // 2. Sort: highest score first, then fewest days left, then escalated first
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      const aDays = a.days_left === null ? Infinity : a.days_left;
      const bDays = b.days_left === null ? Infinity : b.days_left;
      if (aDays !== bDays) return aDays - bDays;

      return Number(b.is_escalated) - Number(a.is_escalated);
    })
    // 3. Keep only the top N
    .slice(0, limit);
}

module.exports = { buildPriorityList };