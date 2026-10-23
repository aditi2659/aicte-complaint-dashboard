// patterns.js
// Finds repeating complaint patterns.

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Finds the same category repeated for the same institution
// within the last `windowDays` days.
function findRepeatedCategories(cases, today = new Date(), windowDays = 90, minCount = 3) {
  const groups = {};

  cases.forEach((c) => {
    const ageDays = Math.floor((today - new Date(c.created_at)) / MS_PER_DAY);
    if (ageDays > windowDays) return; // too old, skip

    const key = `${c.institution_id}|${c.category}`;
    if (!groups[key]) {
      groups[key] = {
        institution_id: c.institution_id,
        category: c.category,
        region: c.region,
        count: 0,
        complaint_ids: [],
      };
    }
    groups[key].count += 1;
    groups[key].complaint_ids.push(c.complaint_id);
  });

  return Object.values(groups)
    .filter((g) => g.count >= minCount)
    .map((g) => ({
      ...g,
      message: `${g.institution_id}: ${g.count} "${g.category}" complaints in the last ${windowDays} days, pattern detected`,
    }))
    .sort((a, b) => b.count - a.count);
}

// Finds categories with more complaints in the last 30 days
// than in the 30 days before that.
function findRisingCategories(cases, today = new Date()) {
  const counts = {};

  cases.forEach((c) => {
    const ageDays = Math.floor((today - new Date(c.created_at)) / MS_PER_DAY);
    if (ageDays < 0 || ageDays > 60) return;

    if (!counts[c.category]) counts[c.category] = { recent: 0, previous: 0 };
    if (ageDays <= 30) counts[c.category].recent += 1;
    else counts[c.category].previous += 1;
  });

  return Object.entries(counts)
    .filter(([, v]) => v.recent > v.previous)
    .map(([category, v]) => ({
      category,
      recent: v.recent,
      previous: v.previous,
      message: `"${category}" complaints rising: ${v.recent} in the last 30 days vs ${v.previous} in the 30 days before`,
    }))
    .sort((a, b) => (b.recent - b.previous) - (a.recent - a.previous));
}

// Finds regions with the most complaints in the last `windowDays` days.
function findBusyRegions(cases, today = new Date(), windowDays = 30) {
  const counts = {};

  cases.forEach((c) => {
    const ageDays = Math.floor((today - new Date(c.created_at)) / MS_PER_DAY);
    if (ageDays < 0 || ageDays > windowDays) return;
    counts[c.region] = (counts[c.region] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([region, count]) => ({
      region,
      count,
      message: `${region} region: ${count} ${count === 1 ? 'complaint' : 'complaints'} in the last ${windowDays} days`,
    }))
    .sort((a, b) => b.count - a.count);
}

module.exports = { findRepeatedCategories, findRisingCategories, findBusyRegions };