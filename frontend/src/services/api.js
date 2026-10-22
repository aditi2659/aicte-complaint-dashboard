/**
 * Frontend Authenticated API Service
 * Centralized fetch client for AICTE Complaint Monitoring Dashboard.
 *
 * Handles:
 * - Bearer token management in sessionStorage
 * - Dynamic base URL from VITE_API_BASE_URL
 * - Automated 401 session expiration handling
 * - Clean response parsing and error surfacing
 * - Zero logging of sensitive credentials, tokens, or hashes
 */

const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "http://localhost:4000/api";

const TOKEN_KEY = "aicte_auth_token";
const USER_KEY = "aicte_auth_user";

// Event listener callback for 401 session expiration
let onUnauthorizedCallback = null;

export function setUnauthorizedHandler(callback) {
  onUnauthorizedCallback = callback;
}

export function getStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeSession(token, user) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (_) {}
}

export function clearSession() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch (_) {}
}

/**
 * Core HTTP Request Wrapper
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };

  const token = getStoredToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (netErr) {
    throw new Error("Unable to connect to the backend server. Please verify the API is running.");
  }

  let data;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  // Handle 401 Unauthorized across all endpoints
  if (response.status === 401) {
    clearSession();
    if (typeof onUnauthorizedCallback === "function") {
      onUnauthorizedCallback();
    }
    const message = data?.error?.message || "Session expired or invalid credentials. Please log in again.";
    const error = new Error(message);
    error.code = data?.error?.code || "UNAUTHORIZED";
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.code = data?.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    error.details = data?.error?.details || null;
    throw error;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Authentication Endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/auth/login
 */
export async function login(email, password) {
  const payload = await request("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  if (payload?.success && payload?.data?.token) {
    storeSession(payload.data.token, payload.data.user);
    return payload.data;
  }

  throw new Error("Invalid response format received from authentication server.");
}

/**
 * GET /api/v1/auth/me
 */
export async function getCurrentUser() {
  const payload = await request("/v1/auth/me");
  if (payload?.success && payload?.data) {
    return payload.data;
  }
  return null;
}

/**
 * Public Server Health Check
 */
export async function checkHealth() {
  return request("/health");
}

// ---------------------------------------------------------------------------
// Core Data Endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/dashboard/summary
 */
export async function getDashboardSummary() {
  const payload = await request("/v1/dashboard/summary");
  return payload?.data || null;
}

/**
 * GET /api/v1/complaints
 */
export async function getComplaints(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.priority) query.set("priority", params.priority);
  if (params.bureau) query.set("bureau", params.bureau);
  if (params.page) query.set("page", params.page);
  if (params.limit) query.set("limit", params.limit);

  const queryString = query.toString();
  const endpoint = `/v1/complaints${queryString ? `?${queryString}` : ""}`;
  const payload = await request(endpoint);
  return {
    complaints: payload?.data || [],
    meta: payload?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 }
  };
}

/**
 * GET /api/v1/complaints/:id
 */
export async function getComplaintById(complaintId) {
  const payload = await request(`/v1/complaints/${encodeURIComponent(complaintId)}`);
  return payload?.data || null;
}

/**
 * GET /api/v1/institutions
 */
export async function getInstitutions(params = {}) {
  const query = new URLSearchParams();
  if (params.state) query.set("state", params.state);
  if (params.type) query.set("type", params.type);
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", params.page);
  if (params.limit) query.set("limit", params.limit);

  const queryString = query.toString();
  const endpoint = `/v1/institutions${queryString ? `?${queryString}` : ""}`;
  const payload = await request(endpoint);
  return {
    institutions: payload?.data || [],
    meta: payload?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 }
  };
}

/**
 * GET /api/v1/overlaps
 */
export async function getOverlaps(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page);
  if (params.limit) query.set("limit", params.limit);

  const queryString = query.toString();
  const endpoint = `/v1/overlaps${queryString ? `?${queryString}` : ""}`;
  const payload = await request(endpoint);
  return {
    overlaps: payload?.data || [],
    meta: payload?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 }
  };
}
