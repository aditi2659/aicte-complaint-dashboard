import { Router } from "express";
import authRoutes from "./authRoutes.js";
import institutionRoutes from "./institutionRoutes.js";
import complaintRoutes from "./complaintRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import overlapRoutes from "./overlapRoutes.js";
import analyticsRoutes from "./analyticsRoutes.js";
import { authenticate } from "../../middleware/auth.js";
import { enforceAuditorReadOnly } from "../../middleware/rbac.js";

const router = Router();

// Public auth endpoints (/login) and self-profile (/me)
router.use("/auth", authRoutes);

// Protected data endpoints: require valid JWT and enforce auditor read-only guard
router.use("/institutions", authenticate, enforceAuditorReadOnly, institutionRoutes);
router.use("/complaints", authenticate, enforceAuditorReadOnly, complaintRoutes);
router.use("/dashboard", authenticate, enforceAuditorReadOnly, dashboardRoutes);
router.use("/overlaps", authenticate, enforceAuditorReadOnly, overlapRoutes);
router.use("/analytics", authenticate, enforceAuditorReadOnly, analyticsRoutes);

export default router;
