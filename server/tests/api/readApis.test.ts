/**
 * Read-Only API Callable Tests — SSI-0307
 *
 * Tests the read-only API callables exposed from calybra-database/src/readApis.ts.
 * These are unit tests validating the callable signatures and contract.
 * Full integration tests require emulator.
 */

import fs from "fs";
import path from "path";

// Root of repo (3 levels up: api -> tests -> server -> root)
const rootDir = path.resolve(__dirname, "..", "..", "..");

describe("Read-Only API Callables (Contract)", () => {
  // These tests validate the module exports and their types.
  // Full emulator integration tests are in tests/invariants/

  describe("Module Exports", () => {
    it("exports all 7 read-only callables", () => {
      // Validate that the module structure is correct by checking the source file exists
      const apiPath = path.join(rootDir, "calybra-database", "src", "readApis.ts");
      expect(fs.existsSync(apiPath)).toBe(true);

      const content = fs.readFileSync(apiPath, "utf-8");
      // Verify all 7 callables are defined
      expect(content).toContain("export const getVatSummary");
      expect(content).toContain("export const getMismatchSummary");
      expect(content).toContain("export const getMonthCloseTimeline");
      expect(content).toContain("export const getCloseFriction");
      expect(content).toContain("export const getAuditorReplay");
      expect(content).toContain("export const getExportArtifact");
      expect(content).toContain("export const listExportArtifacts");
    });

    it("all callables require authentication", () => {
      const apiPath = path.join(rootDir, "calybra-database", "src", "readApis.ts");
      const content = fs.readFileSync(apiPath, "utf-8");

      // Count assertAuth calls — should match number of callables
      const assertAuthCalls = (content.match(/assertAuth\(context\)/g) || []).length;
      expect(assertAuthCalls).toBe(7);
    });

    it("all callables validate monthKey format", () => {
      const apiPath = path.join(rootDir, "calybra-database", "src", "readApis.ts");
      const content = fs.readFileSync(apiPath, "utf-8");

      // Count validateMonthKey calls in callable bodies (includes function definition)
      const validateCalls = (content.match(/validateMonthKey\(/g) || []).length;
      // 7 callables + 1 function definition = 8
      expect(validateCalls).toBe(8);
    });

    it("all callables load user for tenant isolation", () => {
      const apiPath = path.join(rootDir, "calybra-database", "src", "readApis.ts");
      const content = fs.readFileSync(apiPath, "utf-8");

      const loadUserCalls = (content.match(/loadUser\(uid\)/g) || []).length;
      expect(loadUserCalls).toBe(7);
    });

    it("no callable performs writes", () => {
      const apiPath = path.join(rootDir, "calybra-database", "src", "readApis.ts");
      const content = fs.readFileSync(apiPath, "utf-8");

      // No set(), update(), create(), delete() calls
      expect(content).not.toContain(".set(");
      expect(content).not.toContain(".update(");
      expect(content).not.toContain(".create(");
      expect(content).not.toContain(".delete(");
      expect(content).not.toContain("FieldValue");
    });

    it("exports are wired in calybra-database index", () => {
      const indexPath = path.join(rootDir, "calybra-database", "src", "index.ts");
      const content = fs.readFileSync(indexPath, "utf-8");

      expect(content).toContain("getVatSummary");
      expect(content).toContain("getMismatchSummary");
      expect(content).toContain("getMonthCloseTimeline");
      expect(content).toContain("getCloseFriction");
      expect(content).toContain("getAuditorReplay");
      expect(content).toContain("getExportArtifact");
      expect(content).toContain("listExportArtifacts");
    });

    it("getAuditorReplay requires asOfDateKey in YYYY-MM-DD format", () => {
      const apiPath = path.join(rootDir, "calybra-database", "src", "readApis.ts");
      const content = fs.readFileSync(apiPath, "utf-8");

      // Validate asOfDateKey validation regex
      expect(content).toContain("asOfDateKey");
      expect(content).toContain("YYYY-MM-DD");
    });

    it("tenant mismatch check exists on all data-returning callables", () => {
      const apiPath = path.join(rootDir, "calybra-database", "src", "readApis.ts");
      const content = fs.readFileSync(apiPath, "utf-8");

      const tenantChecks = (content.match(/Tenant mismatch/g) || []).length;
      // 6 callables that return single docs have tenant check (listExportArtifacts returns collection)
      expect(tenantChecks).toBeGreaterThanOrEqual(6);
    });
  });
});
