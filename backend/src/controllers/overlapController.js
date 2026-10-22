import * as overlapService from "../services/overlapService.js";
import { parsePagination, buildMeta } from "../utils/pagination.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * GET /api/v1/overlaps
 */
export async function list(req, res, next) {
  try {
    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return sendError(res, "INVALID_PAGINATION", pagination.error, 400);
    }

    if (req.query.min_score !== undefined) {
      const score = Number(req.query.min_score);
      if (Number.isNaN(score) || score < 0 || score > 1) {
        return sendError(res, "INVALID_FILTER", "Filter 'min_score' must be a number between 0.0 and 1.0", 400);
      }
    }

    const filters = {
      review_status: req.query.review_status ? String(req.query.review_status).trim() : undefined,
      min_score: req.query.min_score !== undefined ? Number(req.query.min_score) : undefined
    };

    const { overlaps, total } = await overlapService.listOverlaps(filters, pagination, req.user);
    const meta = buildMeta(total, pagination.page, pagination.limit);

    return sendSuccess(res, overlaps, meta);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/complaints/:id/related
 */
export async function getRelatedForComplaint(req, res, next) {
  try {
    const complaintId = req.params.id?.trim();
    if (!complaintId) {
      return sendError(res, "INVALID_INPUT", "Complaint ID is required", 400);
    }

    const result = await overlapService.getRelatedByComplaintId(complaintId, req.user);
    if (!result) {
      return sendError(res, "COMPLAINT_NOT_FOUND", `Complaint '${complaintId}' was not found`, 404);
    }

    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
}
