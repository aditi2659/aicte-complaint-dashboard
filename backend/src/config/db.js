import pg from "pg";

const { Pool } = pg;

let pool = null;

/**
 * Parses connection options for PostgreSQL / Supabase.
 * Enforces SSL for Supabase or when SSL is explicitly required.
 */
function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    return null;
  }

  const isSupabase = connectionString.includes("supabase.co") || connectionString.includes("pooler.supabase.com");
  const isSslExplicit = process.env.DATABASE_SSL === "true" || connectionString.includes("sslmode=require");
  const isSslDisabled = process.env.DATABASE_SSL === "false" || connectionString.includes("sslmode=disable");

  const useSsl = !isSslDisabled && (isSupabase || isSslExplicit || process.env.NODE_ENV === "production");

  return {
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  };
}

/**
 * Returns the singleton PostgreSQL pool instance.
 * Initializes pool lazily if DATABASE_URL is present.
 */
export function getPool() {
  if (!pool) {
    const config = getPoolConfig();
    if (!config) {
      return null;
    }
    pool = new Pool(config);

    pool.on("error", (err) => {
      // Do not log connection strings or credentials
      console.error("Unexpected error on idle PostgreSQL client:", err.message);
    });
  }
  return pool;
}

/**
 * Helper to execute a parameterized SQL query using the connection pool.
 * @param {string} text - SQL query string
 * @param {Array} [params] - Query parameters
 */
export async function query(text, params) {
  const activePool = getPool();
  if (!activePool) {
    throw new Error("Database pool is not configured. Please set DATABASE_URL in backend/.env.");
  }
  return activePool.query(text, params);
}

/**
 * Safe database connectivity check for readiness and health checks.
 * Never exposes credentials, hosts, or sensitive internal errors to callers.
 *
 * @returns {Promise<{ connected: boolean, status: 'connected' | 'unconfigured' | 'disconnected', message?: string, timestamp?: string }>}
 */
export async function checkDbConnection() {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      connected: false,
      status: "unconfigured",
      message: "DATABASE_URL is not configured"
    };
  }

  const activePool = getPool();
  if (!activePool) {
    return {
      connected: false,
      status: "unconfigured",
      message: "DATABASE_URL is invalid or missing"
    };
  }

  try {
    const result = await activePool.query("SELECT 1 AS connected, NOW() AS server_time");
    return {
      connected: true,
      status: "connected",
      timestamp: result.rows[0]?.server_time?.toISOString?.() || new Date().toISOString()
    };
  } catch (error) {
    // Log safe error message to console without printing connection string or credentials
    console.error("Database connection check failed:", error.code || error.message);
    return {
      connected: false,
      status: "disconnected",
      message: "Database connection failed"
    };
  }
}
