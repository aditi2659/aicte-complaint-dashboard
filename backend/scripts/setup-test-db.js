/**
 * Dedicated Test Database Setup Routine
 *
 * Enforces test database isolation, applies migrations, seeds baseline fixtures,
 * bootstraps demo authentication accounts, and guarantees clean initial state.
 *
 * Safety rules:
 * - Strictly verifies TEST_DATABASE_URL before performing any database operations.
 * - Refuses to touch DATABASE_URL or unverified databases.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");

// Force test environment
process.env.NODE_ENV = "test";

dotenv.config({ path: path.join(backendRoot, ".env") });
dotenv.config({ path: path.resolve(backendRoot, "../.env") });

import { assertIsolatedTestDatabase, getPool, closePool } from "../src/config/db.js";
import { runMigrations } from "./migrate.js";
import { runSeed } from "./seed.js";
import { bootstrapAuth } from "./bootstrap-auth.js";

export async function setupTestDatabase() {
  console.log("=== Initializing AICTE Isolated Test Database ===\n");

  const testDbUrl = process.env.TEST_DATABASE_URL;
  const sharedDbUrl = process.env.DATABASE_URL;

  // 1. Strictly verify database isolation
  try {
    assertIsolatedTestDatabase(testDbUrl, sharedDbUrl);
    console.log("[PASS] Test database isolation verified (TEST_DATABASE_URL is isolated).");
  } catch (err) {
    console.error("\n[ABORTED] Test Database Isolation Check Failed:");
    console.error(err.message);
    process.exit(1);
  }

  // 1b. Ensure Supabase compatibility roles exist on local PostgreSQL
  const preClient = await getPool().connect();
  try {
    await preClient.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
      END
      $$;
    `);
  } finally {
    preClient.release();
  }

  // 2. Run schema migrations against test database
  console.log("\n--- Step 1: Applying Schema Migrations ---");
  await runMigrations();

  // 3. Seed baseline synthetic records
  console.log("\n--- Step 2: Seeding Baseline Fixtures ---");
  await runSeed();

  // 4. Bootstrap authentication test accounts
  console.log("\n--- Step 3: Bootstrapping Demo Accounts ---");
  await bootstrapAuth();

  // 5. Enforce baseline starting state for overlap review and complaint statuses
  console.log("\n--- Step 4: Normalizing Baseline Starting States ---");
  const pool = getPool();
  if (!pool) {
    throw new Error("Could not acquire test database pool.");
  }

  const client = await pool.connect();
  try {
    // Reset overlap links to canonical Suggested state
    await client.query(`
      UPDATE complaint_links
      SET review_status = 'Suggested',
          reviewed_by = NULL,
          reviewed_at = NULL,
          review_notes = NULL
      WHERE complaint_id_a IN ('CMP-1001', 'CMP-1003');
    `);

    // Reset baseline complaint statuses
    await client.query(`
      UPDATE complaints
      SET status = CASE
        WHEN complaint_id = 'CMP-1001' THEN 'Under Review'
        WHEN complaint_id = 'CMP-1002' THEN 'Open'
        WHEN complaint_id = 'CMP-1003' THEN 'Open'
        WHEN complaint_id = 'CMP-1004' THEN 'Assigned'
        WHEN complaint_id = 'CMP-1005' THEN 'Under Review'
        ELSE status
      END,
      is_escalated = FALSE
      WHERE complaint_id IN ('CMP-1001', 'CMP-1002', 'CMP-1003', 'CMP-1004', 'CMP-1005');
    `);

    // Reset transfers
    await client.query(`DELETE FROM complaint_transfers;`);

    console.log("[PASS] Baseline overlap and complaint starting states established.");
  } finally {
    client.release();
    await closePool();
  }

  console.log("\n========================================================");
  console.log("Isolated test database setup completed successfully!");
  console.log("========================================================\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setupTestDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test Database Setup Failed:", err.message);
      process.exit(1);
    });
}
