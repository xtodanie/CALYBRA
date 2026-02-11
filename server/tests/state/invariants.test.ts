/**
 * Business invariants tests
 * 
 * Tests assert TRUTH: given fixed inputs, assert deterministic outputs.
 * No implementation details, no mock verification.
 */

import {
  canFinalizeMonthClose,
  canModifyMonthClose,
  canModifyFileAsset,
  canVerifyFileAsset,
  canModifyMatch,
  canConfirmMatch,
  validateMatchReferences,
  validateMonthClosePeriod,
} from "../../state/invariants";

describe("Business Invariants", () => {
  describe("canFinalizeMonthClose", () => {
    it("allows finalization when IN_REVIEW with no exceptions", () => {
      const result = canFinalizeMonthClose("IN_REVIEW", 0, 0);
      expect(result.valid).toBe(true);
    });

    it("blocks finalization from DRAFT status", () => {
      const result = canFinalizeMonthClose("DRAFT", 0, 0);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-MC-001");
      }
    });

    it("blocks finalization with open exceptions", () => {
      const result = canFinalizeMonthClose("IN_REVIEW", 5, 0);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-MC-002");
        expect(result.message).toContain("5 open exceptions");
      }
    });

    it("blocks finalization with high-priority exceptions", () => {
      const result = canFinalizeMonthClose("IN_REVIEW", 0, 3);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-MC-003");
        expect(result.message).toContain("3 high-priority");
      }
    });
  });

  describe("canModifyMonthClose", () => {
    it("allows modification when DRAFT", () => {
      const result = canModifyMonthClose("DRAFT");
      expect(result.valid).toBe(true);
    });

    it("allows modification when IN_REVIEW", () => {
      const result = canModifyMonthClose("IN_REVIEW");
      expect(result.valid).toBe(true);
    });

    it("blocks modification when FINALIZED", () => {
      const result = canModifyMonthClose("FINALIZED");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-MC-004");
      }
    });
  });

  describe("validateMonthClosePeriod", () => {
    it("allows non-overlapping periods", () => {
      const existing = [
        { start: "2024-01-01", end: "2024-01-31" },
        { start: "2024-02-01", end: "2024-02-29" },
      ];
      const result = validateMonthClosePeriod("2024-03-01", "2024-03-31", existing);
      expect(result.valid).toBe(true);
    });

    it("blocks overlapping periods", () => {
      const existing = [
        { start: "2024-01-01", end: "2024-01-31" },
      ];
      const result = validateMonthClosePeriod("2024-01-15", "2024-02-15", existing);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-MC-005");
      }
    });
  });

  describe("canModifyFileAsset", () => {
    it("allows modification when PENDING_UPLOAD", () => {
      expect(canModifyFileAsset("PENDING_UPLOAD").valid).toBe(true);
    });

    it("allows modification when UPLOADED", () => {
      expect(canModifyFileAsset("UPLOADED").valid).toBe(true);
    });

    it("allows modification when VERIFIED", () => {
      expect(canModifyFileAsset("VERIFIED").valid).toBe(true);
    });

    it("blocks modification when DELETED", () => {
      const result = canModifyFileAsset("DELETED");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-FA-001");
      }
    });
  });

  describe("canVerifyFileAsset", () => {
    it("allows verification when UPLOADED and PARSED", () => {
      const result = canVerifyFileAsset("UPLOADED", "PARSED");
      expect(result.valid).toBe(true);
    });

    it("blocks verification when not UPLOADED", () => {
      const result = canVerifyFileAsset("PENDING_UPLOAD", "PARSED");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-FA-002");
      }
    });

    it("blocks verification when not PARSED", () => {
      const result = canVerifyFileAsset("UPLOADED", "PENDING");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-FA-003");
      }
    });
  });

  describe("canModifyMatch", () => {
    it("allows modification when PROPOSED", () => {
      const result = canModifyMatch("PROPOSED");
      expect(result.valid).toBe(true);
    });

    it("blocks modification when CONFIRMED", () => {
      const result = canModifyMatch("CONFIRMED");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-MA-001");
      }
    });

    it("blocks modification when REJECTED", () => {
      const result = canModifyMatch("REJECTED");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-MA-001");
      }
    });
  });

  describe("validateMatchReferences", () => {
    it("validates when both arrays have entries", () => {
      const result = validateMatchReferences(["tx-1"], ["inv-1"]);
      expect(result.valid).toBe(true);
    });

    it("rejects empty bankTxIds", () => {
      const result = validateMatchReferences([], ["inv-1"]);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-MA-002");
      }
    });

    it("rejects empty invoiceIds", () => {
      const result = validateMatchReferences(["tx-1"], []);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-MA-003");
      }
    });
  });

  describe("canConfirmMatch", () => {
    const emptySet = new Set<string>();

    it("allows confirmation when PROPOSED and no conflicts", () => {
      const result = canConfirmMatch("PROPOSED", ["tx-1"], ["inv-1"], emptySet, emptySet);
      expect(result.valid).toBe(true);
    });

    it("blocks confirmation when not PROPOSED", () => {
      const result = canConfirmMatch("CONFIRMED", ["tx-1"], ["inv-1"], emptySet, emptySet);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-MA-004");
      }
    });

    it("blocks confirmation when transaction already matched", () => {
      const alreadyMatchedTx = new Set(["tx-1"]);
      const result = canConfirmMatch("PROPOSED", ["tx-1"], ["inv-1"], alreadyMatchedTx, emptySet);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-MA-005");
      }
    });

    it("blocks confirmation when invoice already matched", () => {
      const alreadyMatchedInv = new Set(["inv-1"]);
      const result = canConfirmMatch("PROPOSED", ["tx-1"], ["inv-1"], emptySet, alreadyMatchedInv);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.code).toBe("INV-MA-006");
      }
    });
  });

  describe("determinism", () => {
    it("canFinalizeMonthClose is deterministic", () => {
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(canFinalizeMonthClose("IN_REVIEW", 3, 1));
      }

      for (let i = 1; i < results.length; i++) {
        expect(results[i].valid).toBe(results[0].valid);
        const curr = results[i];
        const first = results[0];
        if (!curr.valid && !first.valid) {
          expect(curr.code).toBe(first.code);
        }
      }
    });

    it("canConfirmMatch is deterministic", () => {
      const matchedTx = new Set(["tx-2"]);
      const matchedInv = new Set<string>();
      const results = [];
      
      for (let i = 0; i < 5; i++) {
        results.push(canConfirmMatch("PROPOSED", ["tx-1"], ["inv-1"], matchedTx, matchedInv));
      }

      for (let i = 1; i < results.length; i++) {
        expect(results[i].valid).toBe(results[0].valid);
      }
    });
  });
});
