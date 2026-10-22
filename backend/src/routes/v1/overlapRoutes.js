import { Router } from "express";
import * as overlapController from "../../controllers/overlapController.js";

const router = Router();

router.get("/", overlapController.list);

export default router;
