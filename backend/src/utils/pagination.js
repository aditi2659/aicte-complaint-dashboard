/**
 * Pagination Parsing and Metadata Helpers
 */

export function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
  let page = 1;
  let limit = defaultLimit;

  if (query.page !== undefined) {
    const parsedPage = Number(query.page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return { error: "Query parameter 'page' must be a positive integer greater than or equal to 1" };
    }
    page = parsedPage;
  }

  if (query.limit !== undefined) {
    const parsedLimit = Number(query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      return { error: "Query parameter 'limit' must be a positive integer greater than or equal to 1" };
    }
    if (parsedLimit > maxLimit) {
      return { error: `Query parameter 'limit' cannot exceed maximum allowed limit of ${maxLimit}` };
    }
    limit = parsedLimit;
  }

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function buildMeta(total, page, limit) {
  const totalNum = Number(total) || 0;
  return {
    total: totalNum,
    page,
    limit,
    totalPages: Math.ceil(totalNum / limit) || 1
  };
}
