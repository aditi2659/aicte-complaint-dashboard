// riskScore.js
// Calculates how likely a case is to miss its deadline.

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Closed cases are never scored
const CLOSED_STATUSES = ['disposed'];

// Compares calendar days only, ignoring the time of day
function startOfDay(d) {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

function daysBetween(fromDate, toDate) {
  return Math.round((startOfDay(toDate) - startOfDay(fromDate)) / MS_PER_DAY);
}
function calculateRisk(caseData, today = new Date()) {
  // 1. Skip disposed cases
  if (CLOSED_STATUSES.includes(caseData.status)) {
    return { score: 0, level: 'Closed', reasons: ['Case is already disposed'] };
  }

  let score = 0;
  const reasons = [];

  // 2. Deadline rules
  if (caseData.due_date) {
    const daysLeft = daysBetween(today, new Date(caseData.due_date));

    if (daysLeft < 0) {
      score += 60;
      reasons.push(`Deadline crossed by ${Math.abs(daysLeft)} day(s)`);
    } else if (daysLeft <= 3) {
      score += 40;
      reasons.push(`Deadline in ${daysLeft} day(s)`);
    }
  } else {
    reasons.push('No deadline set');
  }

  // 3. No recent action
  if (caseData.last_action_date) {
    const idleDays = daysBetween(new Date(caseData.last_action_date), today);
    if (idleDays >= 7) {
      score += 20;
      reasons.push(`No action for ${idleDays} days`);
    }
  }

  // 4. Transfers
  if (caseData.transfer_count >= 2) {
    score += 15;
    reasons.push(`Transferred ${caseData.transfer_count} times`);
  }

  // 5. Escalation
  if (caseData.is_escalated) {
    score += 10;
    reasons.push('Case has been escalated');
  }
    // 5b. Strong overlap with a case in another Bureau/Cell
  // has_overlap comes from Member 3 (strong match only, not just same institution)
  if (caseData.has_overlap === true) {
    score += 10;
    reasons.push('Strong overlap with a case in another Bureau/Cell');
  }
  


  // 6. Cap at 100
  score = Math.min(score, 100);

  // 7. Level
  let level = 'Low';
  if (score >= 70) level = 'High';
  else if (score >= 40) level = 'Medium';

  return { score, level, reasons };
}

module.exports = { calculateRisk };