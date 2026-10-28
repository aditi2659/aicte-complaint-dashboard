import { Router } from "express";
import * as auditController from "../../controllers/auditController.js";

const router = Router();

router.get("/", auditController.list);

export default router;
