import { Router } from "express";
import * as overlapController from "../../controllers/overlapController.js";
import { authorizeRoles } from "../../middleware/rbac.js";

const router = Router();

router.get("/", overlapController.list);

// Authorized staff roles for reviewing overlap suggestions
const reviewRoles = authorizeRoles("SUPER_ADMIN", "BUREAU_HEAD", "BUREAU_OFFICER", "GRIEVANCE_OFFICER");
router.patch("/:id/review", reviewRoles, overlapController.review);
router.post("/:id/review", reviewRoles, overlapController.review);
router.patch("/:id", reviewRoles, overlapController.review);

export default router;
