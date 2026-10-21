# AICTE Complaint Monitoring Dashboard

Prototype dashboard for monitoring and tracking institution-related complaint cases across AICTE Bureaus/Cells.

## Project modules
- `frontend/` — React + Vite dashboard starter
- `backend/` — Node.js + Express API starter
- `features/complaint-matching/` — Cross-Bureau Complaint Intelligence
- `features/early-warning/` — Deadline and ageing alerts (starter)
- `features/complaint-summarization/` — Complaint summarization (starter)
- `database/` — PostgreSQL schema and synthetic seed data
- `docs/` — workflow and team guide

## Important
This prototype uses fictional sample data. It is not connected to AICTE's real systems and must not contain real complainant personal information.

## Requirements
- Node.js 18 or newer
- npm

## Run locally

### Backend
```bash
cd backend
npm install
npm run dev
```
API health endpoint: `http://localhost:4000/api/health`

### Frontend
In another terminal:
```bash
cd frontend
npm install
npm run dev
```

The frontend starter runs on the Vite URL shown in the terminal. The backend URL can be configured with `VITE_API_BASE_URL`; by default the UI uses `http://localhost:4000/api`.

### Complaint matching module
The matching logic uses Node's built-in modules and has no extra dependencies:
```bash
node features/complaint-matching/src/matcher.js
```

## Team workflow
Create a branch for your task, commit your changes, push the branch, and open a Pull Request. Avoid committing `.env` files, credentials, or real complaint data.
