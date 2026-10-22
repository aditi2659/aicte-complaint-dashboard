import { Router } from "express";
import * as authController from "../../controllers/authController.js";
import { authenticate } from "../../middleware/auth.js";

const router = Router();

// Public login endpoint
router.post("/login", authController.login);

// Protected user profile endpoint
router.get("/me", authenticate, authController.me);

export default router;
