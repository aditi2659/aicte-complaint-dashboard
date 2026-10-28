import pg from "pg";

const { Pool } = pg;

let pool = null;

/**
 * Verifies that the provided test database connection string is strictly isolated
 * from the development or production shared database.
 *
 * @param {string} testUrl - Connection string configured for tests
 * @param {string} [sharedUrl] - Shared DATABASE_URL to verify against
 * @throws {Error} if isolation verification fails
 */
export function assertIsolatedTestDatabase(testUrl, sharedUrl = process.env.DATABASE_URL) {
  if (!testUrl || typeof testUrl !== "string" || !testUrl.trim()) {
    throw new Error(
      "FATAL: Isolated test database is not configured.\n" +
      "TEST_DATABASE_URL must be set in backend/.env to run tests.\n" +
      "Falling back to shared DATABASE_URL is strictly prohibited to prevent data corruption or loss."
    );
  }

  const cleanTestUrl = testUrl.trim();
  const cleanSharedUrl = sharedUrl?.trim();

  if (cleanSharedUrl && cleanTestUrl === cleanSharedUrl) {
    throw new Error(
      "FATAL: Safety violation: TEST_DATABASE_URL matches DATABASE_URL exactly.\n" +
      "Tests cannot run against the shared development or production database.\n" +
      "Please configure a dedicated, isolated test database in TEST_DATABASE_URL."
    );
  }

  // Prevent accidental Supabase/production target unless explicitly named with _test suffix
  const isSupabase = cleanTestUrl.includes("supabase.co") || cleanTestUrl.includes("pooler.supabase.com");
  if (isSupabase) {
    const hasTestDatabaseName = cleanTestUrl.includes("_test");
    if (!hasTestDatabaseName) {
      throw new Error(
        "FATAL: Safety violation: TEST_DATABASE_URL points to a remote Supabase instance without a '_test' database suffix.\n" +
        "Tests must run against a dedicated, isolated local PostgreSQL instance or dedicated test database."
      );
    }
  }
}

/**
 * Parses connection options for PostgreSQL / Supabase.
 * Enforces SSL for Supabase or when SSL is explicitly required.
 * When NODE_ENV === 'test', strictly uses and verifies TEST_DATABASE_URL.
 */
function getPoolConfig() {
  const isTest = process.env.NODE_ENV === "test";
  let connectionString;

  if (isTest) {
    const testUrl = process.env.TEST_DATABASE_URL?.trim();
    assertIsolatedTestDatabase(testUrl, process.env.DATABASE_URL);
    connectionString = testUrl;
  } else {
    connectionString = process.env.DATABASE_URL?.trim();
  }

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
 * Initializes pool lazily if connection string is configured.
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
 * Closes the active pool instance, if any, and resets the singleton.
 */
export async function closePool() {
  if (pool) {
    const active = pool;
    pool = null;
    await active.end();
  }
}

/**
 * Helper to execute a parameterized SQL query using the connection pool.
 * @param {string} text - SQL query string
 * @param {Array} [params] - Query parameters
 */
export async function query(text, params) {
  const activePool = getPool();
  if (!activePool) {
    const envVar = process.env.NODE_ENV === "test" ? "TEST_DATABASE_URL" : "DATABASE_URL";
    throw new Error(`Database pool is not configured. Please set ${envVar} in backend/.env.`);
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
