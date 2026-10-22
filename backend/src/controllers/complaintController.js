import * as complaintService from "../services/complaintService.js";
import { parsePagination, buildMeta } from "../utils/pagination.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * GET /api/v1/complaints
 */
export async function list(req, res, next) {
  try {
    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return sendError(res, "INVALID_PAGINATION", pagination.error, 400);
    }

    if (req.query.is_escalated !== undefined) {
      const isEsc = String(req.query.is_escalated).toLowerCase();
      if (isEsc !== "true" && isEsc !== "false") {
        return sendError(res, "INVALID_FILTER", "Filter 'is_escalated' must be 'true' or 'false'", 400);
      }
    }

    const filters = {
      status: req.query.status ? String(req.query.status).trim() : undefined,
      priority: req.query.priority ? String(req.query.priority).trim() : undefined,
      bureau: req.query.bureau ? String(req.query.bureau).trim() : undefined,
      institution_id: req.query.institution_id ? String(req.query.institution_id).trim() : undefined,
      is_escalated: req.query.is_escalated !== undefined ? req.query.is_escalated === "true" : undefined,
      search: req.query.search ? String(req.query.search).trim() : undefined
    };

    const { complaints, total } = await complaintService.listComplaints(filters, pagination, req.user);
    const meta = buildMeta(total, pagination.page, pagination.limit);

    return sendSuccess(res, complaints, meta);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/complaints/:id
 */
export async function getById(req, res, next) {
  try {
    const id = req.params.id?.trim();
    if (!id) {
      return sendError(res, "INVALID_INPUT", "Complaint ID is required", 400);
    }

    const complaint = await complaintService.getComplaintById(id, req.user);
    if (!complaint) {
      return sendError(res, "COMPLAINT_NOT_FOUND", `Complaint '${id}' was not found`, 404);
    }

    return sendSuccess(res, complaint);
  } catch (error) {
    return next(error);
  }
}
