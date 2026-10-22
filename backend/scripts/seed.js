import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(backendRoot, ".env") });
dotenv.config({ path: path.resolve(backendRoot, "../.env") });

const { getPool } = await import("../src/config/db.js");

export async function runSeed() {
  const pool = getPool();
  if (!pool) {
    throw new Error("Cannot run seed: DATABASE_URL is not configured.");
  }

  const client = await pool.connect();

  try {
    const seedFile = path.resolve(backendRoot, "../database/seeds/001_seed_synthetic_data.sql");
    if (!fs.existsSync(seedFile)) {
      throw new Error(`Seed file not found at: ${seedFile}`);
    }

    console.log("Executing synthetic seed data script...");
    const content = fs.readFileSync(seedFile, "utf8");

    // The seed file contains its own BEGIN ... COMMIT block with collision safeguards
    await client.query(content);

    // Verify row counts safely
    const instCount = await client.query("SELECT COUNT(*) FROM institutions;");
    const cmpCount = await client.query("SELECT COUNT(*) FROM complaints;");
    const linkCount = await client.query("SELECT COUNT(*) FROM complaint_links;");
    const actCount = await client.query("SELECT COUNT(*) FROM complaint_actions;");

    console.log("Synthetic seed execution completed successfully:");
    console.log(`- Institutions in database:     ${instCount.rows[0].count}`);
    console.log(`- Complaints in database:       ${cmpCount.rows[0].count}`);
    console.log(`- Overlap links in database:    ${linkCount.rows[0].count}`);
    console.log(`- Audit actions in database:    ${actCount.rows[0].count}`);
  } catch (err) {
    console.error("Seed Execution Failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

// Allow direct CLI invocation
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
