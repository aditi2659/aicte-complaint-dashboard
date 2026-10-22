import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { checkDbConnection } from "./config/db.js";
import v1Router from "./routes/v1/index.js";
import { getLegacyComplaints } from "./services/complaintService.js";
import { getLegacyRelatedFeed } from "./services/overlapService.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// Load environment variables from backend/.env first, then root .env as fallback
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { getJwtSecret } from "./utils/token.js";

// Enforce strict JWT security configuration before starting the HTTP server
try {
  getJwtSecret();
} catch (err) {
  console.error("FATAL: Security configuration error on startup:", err.message);
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 4000;
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: frontendOrigin }));
app.use(express.json());

// Public health probes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "AICTE complaint dashboard API is running" });
});

// Dedicated database readiness endpoint
app.get("/api/health/db", async (_req, res) => {
  const dbStatus = await checkDbConnection();
  if (dbStatus.connected) {
    return res.status(200).json({
      status: "ok",
      database: dbStatus.status,
      timestamp: dbStatus.timestamp
    });
  }

  return res.status(503).json({
    status: dbStatus.status === "unconfigured" ? "degraded" : "down",
    database: dbStatus.status,
    message: dbStatus.message
  });
});

// Protected legacy complaints endpoint (Option A: requires valid JWT bearer token)
app.get("/api/complaints", authenticate, async (req, res, next) => {
  try {
    const result = await getLegacyComplaints(req.user);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Protected legacy related-complaints endpoint (Option A: requires valid JWT bearer token)
app.get("/api/complaints/related", authenticate, async (req, res, next) => {
  try {
    const result = await getLegacyRelatedFeed(req.user);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Mount Phase 3 & 4 v1 REST API
app.use("/api/v1", v1Router);

// Catch-all 404 for undefined routes
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

export { app, server };
export default app;
