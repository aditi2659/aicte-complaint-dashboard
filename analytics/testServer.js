const express = require('express');
const cases = require('./data/sampleCases.json');
const createAnalyticsRouter = require('./routes');

const app = express();

// Fake getCases: returns the sample file instead of the database
app.use('/analytics', createAnalyticsRouter(async () => cases));

app.listen(3001, () => {
  console.log('Test server running on http://localhost:3001');
});