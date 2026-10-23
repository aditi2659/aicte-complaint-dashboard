
// routes.js
// Express router for the analytics module.
// Member 2 plugs this in with: app.use('/analytics', require('./analytics/routes')(getCases));
//
// getCases is an async function written by Member 2.
// It reads rows from complaint_analytics_view and returns them as an array.

const express = require('express');
const {
  getRiskCases,
  getPatterns,
  getPriorityList,
  getAlerts,
} = require('./index');

module.exports = function createAnalyticsRouter(getCases) {
  const router = express.Router();

  // Helper: loads cases, runs the handler, handles errors
  const handle = (fn) => async (req, res) => {
    try {
      const cases = await getCases();
      const data = fn(cases, new Date(), req);
      res.json({ success: true, data });
    } catch (err) {
      console.error('Analytics error:', err.message);
      res.status(500).json({ success: false, error: 'Analytics failed' });
    }
  };

  router.get('/risk-cases', handle((cases, today) => getRiskCases(cases, today)));
  router.get('/patterns', handle((cases, today) => getPatterns(cases, today)));
  router.get(
    '/priority-list',
    handle((cases, today, req) => getPriorityList(cases, today, Number(req.query.limit) || 10))
  );
  router.get('/alerts', handle((cases, today) => getAlerts(cases, today)));

  return router;
};