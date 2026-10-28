import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import express, { Router } from "express";
import { getCasesForUser } from "../../services/analyticsService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const analyticsRoutesPath = path.resolve(__dirname, "../../../../analytics/routes.js");
const analyticsDir = path.dirname(analyticsRoutesPath);

// Scoped CommonJS require rooted in the analytics module directory
const analyticsRequire = createRequire(path.join(analyticsDir, "package.json"));

// Scoped resolver that supplies the backend's express instance without global monkey-patching
const scopedRequire = (id) => {
  if (id === "express") {
    return express;
  }
  return analyticsRequire(id);
};

// Compile and execute analytics/routes.js in its CJS module scope
const routesCode = fs.readFileSync(analyticsRoutesPath, "utf8");
const compiledModuleWrapper = vm.compileFunction(
  routesCode,
  ["exports", "require", "module", "__filename", "__dirname"],
  { filename: analyticsRoutesPath }
);

const analyticsModule = { exports: {} };
compiledModuleWrapper(
  analyticsModule.exports,
  scopedRequire,
  analyticsModule,
  analyticsRoutesPath,
  analyticsDir
);

const createAnalyticsRouter = analyticsModule.exports;

const router = Router();

/**
 * Mount the analytics router supplying a user-scoped getCases callback
 * that enforces database-level bureau authorization for the requesting user.
 */
router.use((req, res, next) => {
  const userScopedAnalyticsRouter = createAnalyticsRouter(() => getCasesForUser(req.user));
  return userScopedAnalyticsRouter(req, res, next);
});

export default router;
