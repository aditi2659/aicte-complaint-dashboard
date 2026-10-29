import { Router } from "express";
import * as authController from "../../controllers/authController.js";
import { authenticate } from "../../middleware/auth.js";
import { authorizeRoles } from "../../middleware/rbac.js";

const router = Router();

// Public auth endpoints
router.post("/login", authController.login);
router.post("/setup-password", authController.setupPassword);
router.post("/request-setup", authController.requestSetup);

// Protected user profile endpoint
router.get("/me", authenticate, authController.me);

// Protected administrative user provisioning (SUPER_ADMIN only)
router.post(
  "/admin/users",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  authController.adminCreateUser
);
router.post(
  "/admin/generate-setup-token",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  authController.adminGenerateSetupToken
);

export default router;
