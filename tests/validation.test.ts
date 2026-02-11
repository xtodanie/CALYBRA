/**
 * @jest-environment node
 */
import { FieldValue } from "firebase-admin/firestore";
import {
  MonthCloseCreateSchema,
  MonthCloseUpdateSchema,
  FileAssetClientCreateSchema,
  JobServerCreateSchema,
} from "../calybra-database/src/models/schemas";

// Mock the server timestamp function to return a consistent value for tests
jest.mock("firebase-admin/firestore", () => ({
  ...jest.requireActual("firebase-admin/firestore"),
  FieldValue: {
    serverTimestamp: () => new Date("2024-01-01T00:00:00.000Z"),
  },
}));

describe("Calybra Schema Validators", () => {
  describe("MonthClose Schemas", () => {
    it("should PASS MonthCloseCreateSchema with valid data", () => {
      const validData = {
        periodStart: new Date("2024-05-01"),
        periodEnd: new Date("2024-05-31"),
      };
      expect(() => MonthCloseCreateSchema.parse(validData)).not.toThrow();
    });

    it("should FAIL MonthCloseCreateSchema with extra fields", () => {
      const invalidData = {
        periodStart: new Date("2024-05-01"),
        periodEnd: new Date("2024-05-31"),
        status: "DRAFT", // Extra field
      };
      expect(() => MonthCloseCreateSchema.parse(invalidData)).toThrow();
    });

    it("should PASS MonthCloseUpdateSchema with a valid status", () => {
      const validUpdate = { status: "FINALIZED" };
      expect(() => MonthCloseUpdateSchema.parse(validUpdate)).not.toThrow();
    });

    it("should FAIL MonthCloseUpdateSchema with an invalid enum value", () => {
      const invalidUpdate = { status: "INVALID_STATUS" };
      expect(() => MonthCloseUpdateSchema.parse(invalidUpdate)).toThrow(
        /Invalid enum value/
      );
    });
  });

  describe("FileAssetClientCreateSchema", () => {
    const validData = {
      monthCloseId: "mc_123",
      kind: "BANK_CSV",
      filename: "statement.csv",
      storagePath: "path/to/file.csv",
      status: "PENDING_UPLOAD",
      sha256: "hash123",
    };

    it("should PASS with a valid client payload", () => {
      expect(() => FileAssetClientCreateSchema.parse(validData)).not.toThrow();
    });

    it("should FAIL if a client attempts to create an EXPORT", () => {
      const invalidData = { ...validData, kind: "EXPORT" };
      expect(() => FileAssetClientCreateSchema.parse(invalidData)).toThrow();
    });

    it("should FAIL if a client includes a server-only field like parseStatus", () => {
      const invalidData = { ...validData, parseStatus: "PENDING" };
      expect(() => FileAssetClientCreateSchema.parse(invalidData)).toThrow();
    });
  });

  describe("JobServerCreateSchema", () => {
    it("should PASS with a valid server payload", () => {
      const validData = {
        monthCloseId: "mc_123",
        type: "PARSE_BANK_CSV",
        refFileId: "file_abc",
      };
      expect(() => JobServerCreateSchema.parse(validData)).not.toThrow();
    });

    it("should FAIL if required fields are missing", () => {
        const invalidData = {
            monthCloseId: "mc_123",
        };
        expect(() => JobServerCreateSchema.parse(invalidData)).toThrow();
    });
  });
});
