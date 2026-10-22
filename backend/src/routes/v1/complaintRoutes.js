import { Router } from "express";
import * as complaintController from "../../controllers/complaintController.js";
import * as overlapController from "../../controllers/overlapController.js";

const router = Router();

router.get("/", complaintController.list);
router.get("/:id", complaintController.getById);
router.get("/:id/related", overlapController.getRelatedForComplaint);

export default router;
