import * as institutionService from "../services/institutionService.js";
import { parsePagination, buildMeta } from "../utils/pagination.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * GET /api/v1/institutions
 */
export async function list(req, res, next) {
  try {
    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return sendError(res, "INVALID_PAGINATION", pagination.error, 400);
    }

    const filters = {
      state: req.query.state ? String(req.query.state).trim() : undefined,
      approval_status: req.query.approval_status ? String(req.query.approval_status).trim() : undefined,
      search: req.query.search ? String(req.query.search).trim() : undefined
    };

    const { institutions, total } = await institutionService.listInstitutions(filters, pagination);
    const meta = buildMeta(total, pagination.page, pagination.limit);

    return sendSuccess(res, institutions, meta);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/institutions/:id
 */
export async function getById(req, res, next) {
  try {
    const id = req.params.id?.trim();
    if (!id) {
      return sendError(res, "INVALID_INPUT", "Institution ID is required", 400);
    }

    const institution = await institutionService.getInstitutionById(id);
    if (!institution) {
      return sendError(res, "INSTITUTION_NOT_FOUND", `Institution '${id}' was not found`, 404);
    }

    return sendSuccess(res, institution);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/institutions/:id/complaints
 */
export async function getComplaints(req, res, next) {
  try {
    const id = req.params.id?.trim();
    if (!id) {
      return sendError(res, "INVALID_INPUT", "Institution ID is required", 400);
    }

    const pagination = parsePagination(req.query);
    if (pagination.error) {
      return sendError(res, "INVALID_PAGINATION", pagination.error, 400);
    }

    const filters = {
      status: req.query.status ? String(req.query.status).trim() : undefined,
      priority: req.query.priority ? String(req.query.priority).trim() : undefined,
      bureau: req.query.bureau ? String(req.query.bureau).trim() : undefined
    };

    const result = await institutionService.getInstitutionComplaints(id, filters, pagination, req.user);
    if (!result) {
      return sendError(res, "INSTITUTION_NOT_FOUND", `Institution '${id}' was not found`, 404);
    }

    const meta = buildMeta(result.total, pagination.page, pagination.limit);
    return sendSuccess(res, {
      institution: result.institution,
      complaints: result.complaints
    }, meta);
  } catch (error) {
    return next(error);
  }
}
