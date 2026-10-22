import * as dashboardService from "../services/dashboardService.js";
import { sendSuccess } from "../utils/response.js";

/**
 * GET /api/v1/dashboard/summary
 */
export async function getSummary(req, res, next) {
  try {
    const summary = await dashboardService.getDashboardSummary(req.user);
    return sendSuccess(res, summary);
  } catch (error) {
    return next(error);
  }
}
