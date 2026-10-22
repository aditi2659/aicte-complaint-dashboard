import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(backendRoot, ".env") });
dotenv.config({ path: path.resolve(backendRoot, "../.env") });

const { getPool } = await import("../src/config/db.js");

// Consistent 64-bit integer lock key derived from hash
const LOCK_KEY_INT = 782194821;

/**
 * Validates expected schema structure and constraints after migrations run.
 */
async function verifySchema(client) {
  console.log("Running post-migration structural verification...");

  // 1. Verify tables
  const expectedTables = [
    "schema_migrations",
    "institutions",
    "users",
    "complaints",
    "complaint_links",
    "complaint_transfers",
    "complaint_actions"
  ];

  const tableRes = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
  );
  const foundTables = new Set(tableRes.rows.map((r) => r.table_name));
  for (const t of expectedTables) {
    if (!foundTables.has(t)) {
      throw new Error(`Verification Failure: Required table "${t}" was not found in schema public.`);
    }
  }

  // 2. Verify analytics view
  const viewRes = await client.query(
    "SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'complaint_analytics_view';"
  );
  if (viewRes.rows.length === 0) {
    throw new Error('Verification Failure: Required view "complaint_analytics_view" was not found.');
  }

  // 3. Verify analytics view columns (exactly 11 required columns)
  const expectedViewColumns = [
    "complaint_id",
    "institution_id",
    "region",
    "category",
    "created_at",
    "due_date",
    "last_action_date",
    "status",
    "bureau",
    "transfer_count",
    "is_escalated"
  ];
  const colRes = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'complaint_analytics_view';"
  );
  const foundColumns = new Set(colRes.rows.map((r) => r.column_name));
  for (const col of expectedViewColumns) {
    if (!foundColumns.has(col)) {
      throw new Error(`Verification Failure: View column "${col}" is missing in complaint_analytics_view.`);
    }
  }

  // 4. Verify explicit constraint definitions
  const constraintRes = await client.query(
    `SELECT conname, pg_get_constraintdef(oid) AS condef
     FROM pg_constraint
     WHERE connamespace = 'public'::regnamespace;`
  );
  const constraints = new Map(constraintRes.rows.map((r) => [r.conname, r.condef]));

  const criticalChecks = [
    {
      name: "chk_complaint_links_canonical_pair",
      substr: "complaint_id_a < complaint_id_b",
      description: "Canonical ordering check"
    },
    {
      name: "chk_complaints_status",
      substr: "Under Review",
      description: "Complaint status check"
    },
    {
      name: "fk_complaints_institution",
      substr: "REFERENCES institutions(id)",
      description: "Institution foreign key"
    },
    {
      name: "uq_actions_idempotency_key",
      substr: "UNIQUE (idempotency_key)",
      description: "Audit action idempotency key"
    }
  ];

  for (const check of criticalChecks) {
    if (!constraints.has(check.name)) {
      throw new Error(`Verification Failure: Expected constraint "${check.name}" was not found.`);
    }
    const def = constraints.get(check.name);
    if (!def.includes(check.substr)) {
      throw new Error(
        `Verification Failure: Constraint "${check.name}" does not match expected definition. Found: ${def}`
      );
    }
  }

  console.log("Schema structural verification succeeded: all tables, views, columns, and constraints verified.");
}

/**
 * Master migration execution routine.
 */
export async function runMigrations() {
  const pool = getPool();
  if (!pool) {
    throw new Error("Cannot run migrations: DATABASE_URL is not configured.");
  }

  const client = await pool.connect();
  let lockAcquired = false;

  try {
    // 1. Acquire dedicated session-level advisory lock
    const lockRes = await client.query("SELECT pg_try_advisory_lock($1) AS locked;", [LOCK_KEY_INT]);
    lockAcquired = lockRes.rows[0]?.locked === true;

    if (!lockAcquired) {
      console.error("Migration Aborted: Another migration process currently holds the advisory lock.");
      process.exitCode = 1;
      return;
    }

    console.log("Advisory session lock acquired. Checking migration history...");

    // 2. Ensure schema_migrations exists (atomic setup)
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        execution_time_ms INTEGER NOT NULL
      );
    `);

    // 3. Read applied migrations
    const historyRes = await client.query(
      "SELECT version, name, checksum FROM schema_migrations ORDER BY version ASC;"
    );
    const appliedMigrations = new Map(
      historyRes.rows.map((r) => [r.version, { name: r.name, checksum: r.checksum }])
    );

    // 4. Scan disk migrations
    const migrationsDir = path.resolve(backendRoot, "../database/migrations");
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at: ${migrationsDir}`);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const diskVersions = new Set();

    for (const file of files) {
      const match = file.match(/^(\d+[\w-]*)\.sql$/);
      const version = match ? match[1] : file.replace(".sql", "");
      diskVersions.add(version);

      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, "utf8");
      const checksum = crypto.createHash("sha256").update(content, "utf8").digest("hex");

      if (appliedMigrations.has(version)) {
        const recorded = appliedMigrations.get(version);
        if (recorded.checksum !== checksum) {
          throw new Error(
            `FATAL: Migration "${file}" (version ${version}) has been modified after being applied!\n` +
            `Recorded Checksum:  ${recorded.checksum}\n` +
            `Calculated Checksum: ${checksum}\n` +
            `Aborting to prevent untracked schema drift.`
          );
        }
        console.log(`- Migration ${file} is up to date (checksum verified).`);
      } else {
        console.log(`Applying migration ${file}...`);
        const startTime = Date.now();

        // Runner owns transaction boundary
        await client.query("BEGIN;");
        try {
          await client.query(content);
          const elapsed = Date.now() - startTime;
          await client.query(
            `INSERT INTO schema_migrations (version, name, checksum, applied_at, execution_time_ms)
             VALUES ($1, $2, $3, NOW(), $4);`,
            [version, file, checksum, elapsed]
          );
          await client.query("COMMIT;");
          console.log(`+ Migration ${file} successfully applied in ${elapsed}ms.`);
        } catch (migErr) {
          await client.query("ROLLBACK;");
          console.error(`Migration ${file} failed:`, migErr.message);
          throw migErr;
        }
      }
    }

    // 5. Detect missing historical files
    for (const [appVer, meta] of appliedMigrations.entries()) {
      if (!diskVersions.has(appVer)) {
        console.warn(`WARNING: Migration version ${appVer} (${meta.name}) is recorded in DB but missing from disk!`);
      }
    }

    // 6. Post-migration structural schema verification
    await verifySchema(client);
    console.log("All migrations applied and verified successfully.");
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock($1);", [LOCK_KEY_INT]);
      console.log("Advisory session lock released.");
    }
    client.release();
  }
}

// Allow direct CLI invocation
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration Runner Error:", err.message);
      process.exit(1);
    });
}
