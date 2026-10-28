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

/**
 * PATCH /api/v1/overlaps/:id/review
 * POST /api/v1/overlaps/:id/review
 * PATCH /api/v1/overlaps/:id
 */
export async function review(req, res, next) {
  try {
    const rawId = req.params.id?.trim();
    const linkId = parseInt(rawId, 10);
    if (!rawId || Number.isNaN(linkId) || linkId <= 0) {
      return sendError(res, "INVALID_INPUT", "A valid numeric overlap link ID is required", 400);
    }

    const { review_status, review_notes, notes } = req.body || {};
    const normalizedStatus = review_status ? String(review_status).trim() : undefined;

    if (!normalizedStatus || (normalizedStatus !== "Confirmed" && normalizedStatus !== "Dismissed")) {
      return sendError(
        res,
        "INVALID_INPUT",
        "Field 'review_status' must be either 'Confirmed' or 'Dismissed'",
        400
      );
    }

    const reviewNotes = (review_notes !== undefined ? review_notes : notes)
      ? String(review_notes !== undefined ? review_notes : notes).trim()
      : null;

    const result = await overlapService.reviewOverlap(
      linkId,
      { review_status: normalizedStatus, review_notes: reviewNotes },
      req.user
    );

    return sendSuccess(res, result);
  } catch (error) {
    if (error.code === "OVERLAP_NOT_FOUND") {
      return sendError(res, error.code, error.message, 404);
    }
    if (error.code === "INVALID_STATUS_TRANSITION") {
      return sendError(res, error.code, error.message, 409);
    }
    if (error.code === "FORBIDDEN_BUREAU_ACCESS") {
      return sendError(res, error.code, error.message, 403);
    }
    if (error.code === "AUDITOR_READ_ONLY") {
      return sendError(res, error.code, error.message, 403);
    }
    if (error.code === "INVALID_INPUT") {
      return sendError(res, error.code, error.message, 400);
    }
    return next(error);
  }
}
