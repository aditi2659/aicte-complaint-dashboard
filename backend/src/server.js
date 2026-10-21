import express from "express";
import cors from "cors";
import complaints from "./data/complaints.js";

const app = express();
const port = process.env.PORT || 4000;
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: frontendOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "AICTE complaint dashboard API is running" });
});

app.get("/api/complaints", (_req, res) => {
  res.json({ count: complaints.length, data: complaints });
});

app.get("/api/complaints/related", async (req, res) => {
  const { findRelatedComplaints } = await import("../../features/complaint-matching/src/matcher.js");
  const results = findRelatedComplaints(complaints);
  res.json({ count: results.length, data: results });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
