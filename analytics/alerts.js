// alerts.js
// Generates alerts for open cases.

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const CLOSED_STATUSES = ['disposed'];
function startOfDay(d) {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

function daysBetween(fromDate, toDate) {
  return Math.round((startOfDay(toDate) - startOfDay(fromDate)) / MS_PER_DAY);
}

function generateAlerts(cases, today = new Date()) {
  const alerts = [];

  cases.forEach((c) => {
    // Skip disposed cases
    if (CLOSED_STATUSES.includes(c.status)) return;

    const base = {
      complaint_id: c.complaint_id,
      institution_id: c.institution_id,
      bureau: c.bureau,
      created_at: today.toISOString(),
      seen: false,
    };

    // 1. Deadline alerts
    if (c.due_date) {
      const daysLeft = daysBetween(today, c.due_date);

      if (daysLeft < 0) {
        alerts.push({
          ...base,
          type: 'deadline_crossed',
          severity: 'High',
          message: `${c.complaint_id}: deadline crossed by ${Math.abs(daysLeft)} day(s)`,
        });
      } else if (daysLeft <= 3) {
        alerts.push({
          ...base,
          type: 'deadline_approaching',
          severity: 'Medium',
          message: `${c.complaint_id}: deadline in ${daysLeft} day(s)`,
        });
      }
    }

    // 2. Pending reminder (no recent action)
    if (c.last_action_date) {
     const idleDays = daysBetween(c.last_action_date, today);
      if (idleDays >= 7) {
        alerts.push({
          ...base,
          type: 'pending_reminder',
          severity: 'Medium',
          message: `${c.complaint_id}: no action for ${idleDays} days`,
        });
      }
    }

    // 3. Escalation alert
    if (c.is_escalated) {
      alerts.push({
        ...base,
        type: 'escalation',
        severity: 'High',
        message: `${c.complaint_id}: case has been escalated`,
      });
    }
  });

  // High severity first
  const order = { High: 0, Medium: 1 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

module.exports = { generateAlerts };