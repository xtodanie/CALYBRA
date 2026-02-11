/**
 * Status Machine tests - validate transition rules and determinism
 * 
 * Tests assert TRUTH: given a status, assert which transitions are valid.
 * These tests verify the state machine contracts, not implementation details.
 */

import {
  // Status constants
  MONTH_CLOSE_STATUSES,
  FILE_ASSET_STATUSES,
  MATCH_STATUSES,
  PARSE_STATUSES,
  // Transitions
  MONTH_CLOSE_TRANSITIONS,
  FILE_ASSET_TRANSITIONS,
  MATCH_TRANSITIONS,
  PARSE_TRANSITIONS,
  // Typed helpers
  isMonthCloseTransitionValid,
  assertMonthCloseTransition,
  isMonthCloseTerminal,
  assertMonthCloseNotTerminal,
  isFileAssetTransitionValid,
  assertFileAssetTransition,
  isFileAssetTerminal,
  isMatchTransitionValid,
  assertMatchTransition,
  isMatchTerminal,
  assertMatchNotTerminal,
  isParseTransitionValid,
  assertParseTransition,
} from "../../state/statusMachine";

describe("Status Machine", () => {
  describe("MonthClose transitions", () => {
    it("DRAFT can transition to IN_REVIEW", () => {
      expect(isMonthCloseTransitionValid("DRAFT", "IN_REVIEW")).toBe(true);
    });

    it("DRAFT cannot transition to FINALIZED", () => {
      expect(isMonthCloseTransitionValid("DRAFT", "FINALIZED")).toBe(false);
    });

    it("IN_REVIEW can transition to DRAFT or FINALIZED", () => {
      expect(isMonthCloseTransitionValid("IN_REVIEW", "DRAFT")).toBe(true);
      expect(isMonthCloseTransitionValid("IN_REVIEW", "FINALIZED")).toBe(true);
    });

    it("FINALIZED is terminal", () => {
      expect(isMonthCloseTerminal("FINALIZED")).toBe(true);
      expect(MONTH_CLOSE_TRANSITIONS["FINALIZED"].length).toBe(0);
    });

    it("assertMonthCloseTransition throws for invalid", () => {
      expect(() => assertMonthCloseTransition("FINALIZED", "DRAFT")).toThrow();
    });

    it("assertMonthCloseTransition does not throw for valid", () => {
      expect(() => assertMonthCloseTransition("DRAFT", "IN_REVIEW")).not.toThrow();
    });

    it("assertMonthCloseNotTerminal throws for FINALIZED", () => {
      expect(() => assertMonthCloseNotTerminal("FINALIZED")).toThrow();
    });

    it("assertMonthCloseNotTerminal does not throw for DRAFT", () => {
      expect(() => assertMonthCloseNotTerminal("DRAFT")).not.toThrow();
    });
  });

  describe("FileAsset transitions", () => {
    it("PENDING_UPLOAD can transition to UPLOADED or DELETED", () => {
      expect(isFileAssetTransitionValid("PENDING_UPLOAD", "UPLOADED")).toBe(true);
      expect(isFileAssetTransitionValid("PENDING_UPLOAD", "DELETED")).toBe(true);
    });

    it("UPLOADED can transition to VERIFIED, REJECTED, or DELETED", () => {
      expect(isFileAssetTransitionValid("UPLOADED", "VERIFIED")).toBe(true);
      expect(isFileAssetTransitionValid("UPLOADED", "REJECTED")).toBe(true);
      expect(isFileAssetTransitionValid("UPLOADED", "DELETED")).toBe(true);
    });

    it("VERIFIED can only transition to DELETED", () => {
      expect(isFileAssetTransitionValid("VERIFIED", "DELETED")).toBe(true);
      expect(isFileAssetTransitionValid("VERIFIED", "UPLOADED")).toBe(false);
    });

    it("DELETED is terminal", () => {
      expect(isFileAssetTerminal("DELETED")).toBe(true);
      expect(FILE_ASSET_TRANSITIONS["DELETED"].length).toBe(0);
    });

    it("REJECTED can only transition to DELETED", () => {
      expect(isFileAssetTransitionValid("REJECTED", "DELETED")).toBe(true);
    });

    it("assertFileAssetTransition throws for invalid", () => {
      expect(() => assertFileAssetTransition("DELETED", "UPLOADED")).toThrow();
    });
  });

  describe("Match transitions", () => {
    it("PROPOSED can transition to CONFIRMED or REJECTED", () => {
      expect(isMatchTransitionValid("PROPOSED", "CONFIRMED")).toBe(true);
      expect(isMatchTransitionValid("PROPOSED", "REJECTED")).toBe(true);
    });

    it("CONFIRMED is terminal", () => {
      expect(isMatchTerminal("CONFIRMED")).toBe(true);
      expect(MATCH_TRANSITIONS["CONFIRMED"].length).toBe(0);
    });

    it("REJECTED is terminal", () => {
      expect(isMatchTerminal("REJECTED")).toBe(true);
      expect(MATCH_TRANSITIONS["REJECTED"].length).toBe(0);
    });

    it("assertMatchTransition throws for terminal to any", () => {
      expect(() => assertMatchTransition("CONFIRMED", "PROPOSED")).toThrow();
      expect(() => assertMatchTransition("REJECTED", "PROPOSED")).toThrow();
    });

    it("assertMatchNotTerminal throws for terminal states", () => {
      expect(() => assertMatchNotTerminal("CONFIRMED")).toThrow();
      expect(() => assertMatchNotTerminal("REJECTED")).toThrow();
    });
  });

  describe("Parse transitions", () => {
    it("PENDING can transition to PARSED or FAILED", () => {
      expect(isParseTransitionValid("PENDING", "PARSED")).toBe(true);
      expect(isParseTransitionValid("PENDING", "FAILED")).toBe(true);
    });

    it("PARSED is terminal", () => {
      expect(PARSE_TRANSITIONS["PARSED"].length).toBe(0);
    });

    it("FAILED can retry by transitioning to PENDING", () => {
      expect(isParseTransitionValid("FAILED", "PENDING")).toBe(true);
    });

    it("assertParseTransition throws for PARSED to any", () => {
      expect(() => assertParseTransition("PARSED", "PENDING")).toThrow();
    });
  });

  describe("transition determinism", () => {
    it("isMonthCloseTransitionValid is deterministic", () => {
      const results: boolean[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(isMonthCloseTransitionValid("DRAFT", "IN_REVIEW"));
      }
      expect(new Set(results).size).toBe(1);
    });

    it("isMatchTransitionValid is deterministic", () => {
      const results: boolean[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(isMatchTransitionValid("PROPOSED", "CONFIRMED"));
      }
      expect(new Set(results).size).toBe(1);
    });
  });

  describe("status constants", () => {
    it("MONTH_CLOSE_STATUSES contains all valid statuses", () => {
      expect(MONTH_CLOSE_STATUSES).toContain("DRAFT");
      expect(MONTH_CLOSE_STATUSES).toContain("IN_REVIEW");
      expect(MONTH_CLOSE_STATUSES).toContain("FINALIZED");
      expect(MONTH_CLOSE_STATUSES.length).toBe(3);
    });

    it("FILE_ASSET_STATUSES contains all valid statuses", () => {
      expect(FILE_ASSET_STATUSES).toContain("PENDING_UPLOAD");
      expect(FILE_ASSET_STATUSES).toContain("UPLOADED");
      expect(FILE_ASSET_STATUSES).toContain("VERIFIED");
      expect(FILE_ASSET_STATUSES).toContain("REJECTED");
      expect(FILE_ASSET_STATUSES).toContain("DELETED");
      expect(FILE_ASSET_STATUSES.length).toBe(5);
    });

    it("MATCH_STATUSES contains all valid statuses", () => {
      expect(MATCH_STATUSES).toContain("PROPOSED");
      expect(MATCH_STATUSES).toContain("CONFIRMED");
      expect(MATCH_STATUSES).toContain("REJECTED");
      expect(MATCH_STATUSES.length).toBe(3);
    });

    it("PARSE_STATUSES contains all valid statuses", () => {
      expect(PARSE_STATUSES).toContain("PENDING");
      expect(PARSE_STATUSES).toContain("PARSED");
      expect(PARSE_STATUSES).toContain("FAILED");
      expect(PARSE_STATUSES.length).toBe(3);
    });
  });
});