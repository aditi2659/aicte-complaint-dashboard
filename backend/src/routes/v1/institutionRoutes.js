import { Router } from "express";
import * as institutionController from "../../controllers/institutionController.js";

const router = Router();

router.get("/", institutionController.list);
router.get("/:id", institutionController.getById);
router.get("/:id/complaints", institutionController.getComplaints);

export default router;
