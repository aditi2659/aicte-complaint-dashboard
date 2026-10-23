const { calculateRisk } = require('./riskScore');

const today = new Date('2026-10-23');

const base = {
  complaint_id: 'O1',
  status: 'pending',
  due_date: '2026-10-25',
  last_action_date: '2026-10-22',
  transfer_count: 0,
  is_escalated: false,
};

const without = calculateRisk(base, today);
const withOverlap = calculateRisk({ ...base, has_overlap: true }, today);

console.log('Without overlap:', without.score, without.level);
console.log('With overlap:', withOverlap.score, withOverlap.level, '|', withOverlap.reasons.join(', '));