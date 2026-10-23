const { calculateRisk } = require('./riskScore');
const { getFullAnalytics } = require('./index');

// A real afternoon time, like the live system will use
const today = new Date('2026-10-23T15:00:00Z');

const edgeCases = [
  {
    name: '1. No deadline',
    data: { complaint_id: 'E1', status: 'pending', due_date: null, last_action_date: '2026-10-20', transfer_count: 0, is_escalated: false },
  },
  {
    name: '2. No last action date',
    data: { complaint_id: 'E2', status: 'pending', due_date: '2026-10-30', last_action_date: null, transfer_count: 0, is_escalated: false },
  },
  {
    name: '3. Due today',
    data: { complaint_id: 'E3', status: 'pending', due_date: '2026-10-23', last_action_date: '2026-10-22', transfer_count: 0, is_escalated: false },
  },
  {
    name: '4. Brand new case',
    data: { complaint_id: 'E4', status: 'pending', due_date: '2026-12-01', last_action_date: '2026-10-23', transfer_count: 0, is_escalated: false },
  },
  {
    name: '5. Wrong date text',
    data: { complaint_id: 'E5', status: 'pending', due_date: 'not-a-date', last_action_date: '2026-10-22', transfer_count: 0, is_escalated: false },
  },
];

edgeCases.forEach((t) => {
  const r = calculateRisk(t.data, today);
  console.log(t.name, '→', r.score, r.level, '|', r.reasons.join(', ') || '(no reasons)');
});

// 6. Empty list
const empty = getFullAnalytics([], today);
console.log('6. Empty list → risk:', empty.riskCases.length, '| alerts:', empty.alerts.length, '| priority:', empty.priorityList.length);