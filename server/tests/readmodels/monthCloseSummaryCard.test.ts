/**
 * Month Close Summary Card Tests - 100% coverage
 *
 * Tests for read model projection, sorting, and batch operations
 */

import {
  projectMonthCloseSummaryCard,
  projectMonthCloseSummaryCards,
  sortSummaryCards,
  MonthCloseSource,
  MonthCloseContext,
  MonthCloseSummaryCard,
} from "../../../server/readmodels/monthCloseSummaryCard";
import { BusinessErrorCode } from "../../../server/logic/errors/businessErrors";

describe("projectMonthCloseSummaryCard", () => {
  const baseSource: MonthCloseSource = {
    id: "mc-2026-01",
    tenantId: "tenant-001",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    status: "DRAFT",
    bankTotal: 10000.0,
    invoiceTotal: 9500.0,
    diff: 500.0,
    openExceptionsCount: 3,
    highExceptionsCount: 1,
    currency: "EUR",
  };

  const baseContext: MonthCloseContext = {
    totalTransactions: 50,
    totalInvoices: 45,
    confirmedMatches: 40,
    proposedMatches: 5,
    rejectedMatches: 2,
    averageMatchScore: 85,
    lastActivityAt: "2026-01-25T14:30:00Z",
  };

  describe("happy path", () => {
    it("should project source to summary card", () => {
      const result = projectMonthCloseSummaryCard(baseSource, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe("mc-2026-01");
        expect(result.value.tenantId).toBe("tenant-001");
        expect(result.value.periodLabel).toBe("January 2026");
      }
    });

    it("should calculate financial amounts", () => {
      const result = projectMonthCloseSummaryCard(baseSource, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.bankTotal.cents).toBe(1000000);
        expect(result.value.invoiceTotal.cents).toBe(950000);
        expect(result.value.difference.cents).toBe(50000);
      }
    });

    it("should calculate counts", () => {
      const result = projectMonthCloseSummaryCard(baseSource, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.transactionCount).toBe(50);
        expect(result.value.invoiceCount).toBe(45);
        expect(result.value.matchedCount).toBe(40);
        expect(result.value.exceptionCount).toBe(3);
        expect(result.value.highPriorityExceptionCount).toBe(1);
      }
    });

    it("should calculate match percentage", () => {
      const result = projectMonthCloseSummaryCard(baseSource, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        // 40 matches * 2 / (50 + 45) = 84%
        expect(result.value.matchPercent).toBe(84);
      }
    });
  });

  describe("status variations", () => {
    it("should handle DRAFT status", () => {
      const source = { ...baseSource, status: "DRAFT" as const };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe("DRAFT");
        expect(result.value.statusLabel).toBe("Draft");
        expect(result.value.statusColor).toBe("gray");
      }
    });

    it("should handle IN_REVIEW status", () => {
      const source = { ...baseSource, status: "IN_REVIEW" as const };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe("IN_REVIEW");
        expect(result.value.statusLabel).toBe("In Review");
        expect(result.value.statusColor).toBe("yellow");
      }
    });

    it("should handle FINALIZED status", () => {
      const source = {
        ...baseSource,
        status: "FINALIZED" as const,
        finalizedAt: "2026-02-01T10:00:00Z",
      };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe("FINALIZED");
        expect(result.value.statusLabel).toBe("Finalized");
        expect(result.value.statusColor).toBe("green");
        expect(result.value.finalizedAt).toBe("2026-02-01T10:00:00Z");
      }
    });
  });

  describe("health status", () => {
    it("should be HEALTHY when no issues", () => {
      const source = {
        ...baseSource,
        openExceptionsCount: 0,
        highExceptionsCount: 0,
        diff: 0.5, // Within tolerance
      };
      const context = {
        ...baseContext,
        confirmedMatches: 45, // 90%+ match
      };
      const result = projectMonthCloseSummaryCard(source, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.healthStatus).toBe("HEALTHY");
        expect(result.value.healthLabel).toBe("Healthy");
        expect(result.value.healthColor).toBe("green");
      }
    });

    it("should be WARNING for high exceptions", () => {
      const source = {
        ...baseSource,
        highExceptionsCount: 2,
      };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.healthStatus).toBe("WARNING");
        expect(result.value.healthColor).toBe("yellow");
      }
    });

    it("should be CRITICAL for many high exceptions", () => {
      const source = {
        ...baseSource,
        highExceptionsCount: 10,
      };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.healthStatus).toBe("CRITICAL");
        expect(result.value.healthLabel).toBe("Critical Issues");
        expect(result.value.healthColor).toBe("red");
      }
    });

    it("should be CRITICAL for large difference", () => {
      const source = {
        ...baseSource,
        diff: 2000.0, // Large difference
      };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.healthStatus).toBe("CRITICAL");
      }
    });

    it("should be WARNING for low match percentage", () => {
      const source = { ...baseSource, openExceptionsCount: 5 };
      const context = { ...baseContext, confirmedMatches: 20 };
      const result = projectMonthCloseSummaryCard(source, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.healthStatus).toBe("WARNING");
      }
    });
  });

  describe("progress", () => {
    it("should be COMPLETE for FINALIZED", () => {
      const source = { ...baseSource, status: "FINALIZED" as const };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.progressStage).toBe("COMPLETE");
        expect(result.value.progressPercent).toBe(100);
      }
    });

    it("should be REVIEWING for IN_REVIEW", () => {
      const source = { ...baseSource, status: "IN_REVIEW" as const };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.progressStage).toBe("REVIEWING");
      }
    });

    it("should be NOT_STARTED for no items", () => {
      const source = { ...baseSource };
      const context = {
        ...baseContext,
        totalTransactions: 0,
        totalInvoices: 0,
        confirmedMatches: 0,
      };
      const result = projectMonthCloseSummaryCard(source, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.progressStage).toBe("NOT_STARTED");
      }
    });

    it("should be IMPORTING for no matches", () => {
      const source = { ...baseSource };
      const context = { ...baseContext, confirmedMatches: 0 };
      const result = projectMonthCloseSummaryCard(source, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.progressStage).toBe("IMPORTING");
      }
    });
  });

  describe("difference formatting", () => {
    it("should show 'Balanced' for zero diff", () => {
      const source = { ...baseSource, diff: 0 };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.differenceLabel).toBe("Balanced");
        expect(result.value.isBalanced).toBe(true);
        expect(result.value.differenceColor).toBe("green");
      }
    });

    it("should show positive diff as bank excess", () => {
      const source = { ...baseSource, diff: 50.0 };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.differenceLabel).toContain("bank excess");
      }
    });

    it("should show negative diff as invoice excess", () => {
      const source = { ...baseSource, diff: -50.0 };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.differenceLabel).toContain("invoice excess");
      }
    });

    it("should be green for small diff", () => {
      const source = { ...baseSource, diff: 0.5 };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.differenceColor).toBe("green");
      }
    });

    it("should be yellow for medium diff", () => {
      const source = { ...baseSource, diff: 50.0 };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.differenceColor).toBe("yellow");
      }
    });

    it("should be red for large diff", () => {
      const source = { ...baseSource, diff: 500.0 };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.differenceColor).toBe("red");
      }
    });
  });

  describe("actions", () => {
    it("should have import and review actions for DRAFT", () => {
      const source = { ...baseSource, status: "DRAFT" as const };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.actions.find((a) => a.action === "IMPORT_FILES")).toBeDefined();
        expect(result.value.actions.find((a) => a.action === "SUBMIT_REVIEW")).toBeDefined();
      }
    });

    it("should enable review action when match >= 50%", () => {
      const result = projectMonthCloseSummaryCard(baseSource, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        const reviewAction = result.value.actions.find((a) => a.action === "SUBMIT_REVIEW");
        expect(reviewAction?.enabled).toBe(true);
      }
    });

    it("should disable review action when match < 50%", () => {
      const context = { ...baseContext, confirmedMatches: 10 };
      const result = projectMonthCloseSummaryCard(baseSource, context);

      expect(result.success).toBe(true);
      if (result.success) {
        const reviewAction = result.value.actions.find((a) => a.action === "SUBMIT_REVIEW");
        expect(reviewAction?.enabled).toBe(false);
        expect(reviewAction?.tooltip).toContain("50%");
      }
    });

    it("should have finalize and resolve actions for IN_REVIEW", () => {
      const source = { ...baseSource, status: "IN_REVIEW" as const };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.actions.find((a) => a.action === "FINALIZE")).toBeDefined();
        expect(result.value.actions.find((a) => a.action === "RESOLVE_EXCEPTIONS")).toBeDefined();
        expect(result.value.actions.find((a) => a.action === "REVERT_DRAFT")).toBeDefined();
      }
    });

    it("should have export and view actions for FINALIZED", () => {
      const source = { ...baseSource, status: "FINALIZED" as const };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.actions.find((a) => a.action === "EXPORT_REPORT")).toBeDefined();
        expect(result.value.actions.find((a) => a.action === "VIEW_DETAILS")).toBeDefined();
      }
    });
  });

  describe("blocking issues", () => {
    it("should identify high priority exceptions", () => {
      const source = { ...baseSource, highExceptionsCount: 3 };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.hasBlockingIssues).toBe(true);
        expect(result.value.blockingIssues).toContain("3 high priority exception(s) require resolution");
      }
    });

    it("should identify large balance difference", () => {
      const source = { ...baseSource, diff: 200.0 };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.blockingIssues.some((i) => i.includes("difference"))).toBe(true);
      }
    });

    it("should identify low match rate for review", () => {
      const source = { ...baseSource, status: "IN_REVIEW" as const };
      const context = { ...baseContext, confirmedMatches: 20 };
      const result = projectMonthCloseSummaryCard(source, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.blockingIssues.some((i) => i.includes("90%"))).toBe(true);
      }
    });

    it("should have no blocking issues for FINALIZED", () => {
      const source = { ...baseSource, status: "FINALIZED" as const };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.blockingIssues).toHaveLength(0);
      }
    });
  });

  describe("transition flags", () => {
    it("should allow transition to review when match >= 50% and DRAFT", () => {
      const result = projectMonthCloseSummaryCard(baseSource, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.canTransitionToReview).toBe(true);
      }
    });

    it("should not allow transition to review for IN_REVIEW", () => {
      const source = { ...baseSource, status: "IN_REVIEW" as const };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.canTransitionToReview).toBe(false);
      }
    });

    it("should allow finalize when ready", () => {
      const source = {
        ...baseSource,
        status: "IN_REVIEW" as const,
        highExceptionsCount: 0,
        diff: 0.5,
      };
      const context = { ...baseContext, confirmedMatches: 45 };
      const result = projectMonthCloseSummaryCard(source, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.canFinalize).toBe(true);
      }
    });

    it("should not allow finalize with high exceptions", () => {
      const source = {
        ...baseSource,
        status: "IN_REVIEW" as const,
        highExceptionsCount: 1,
      };
      const context = { ...baseContext, confirmedMatches: 45 };
      const result = projectMonthCloseSummaryCard(source, context);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.canFinalize).toBe(false);
      }
    });
  });

  describe("validation errors", () => {
    it("should reject missing id", () => {
      const source = { ...baseSource, id: "" };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(BusinessErrorCode.MISSING_REQUIRED_FIELD);
      }
    });

    it("should reject missing tenantId", () => {
      const source = { ...baseSource, tenantId: "" };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(false);
    });

    it("should reject invalid period start date", () => {
      const source = { ...baseSource, periodStart: "invalid" };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(BusinessErrorCode.INVALID_DATE_FORMAT);
      }
    });

    it("should reject invalid period end date", () => {
      const source = { ...baseSource, periodEnd: "2026/01/31" };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(false);
    });
  });

  describe("optional fields", () => {
    it("should include notes when present", () => {
      const source = { ...baseSource, notes: "Test notes" };
      const result = projectMonthCloseSummaryCard(source, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.notes).toBe("Test notes");
      }
    });

    it("should include lastActivityAt when present", () => {
      const result = projectMonthCloseSummaryCard(baseSource, baseContext);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.lastActivityAt).toBe("2026-01-25T14:30:00Z");
      }
    });
  });
});

describe("projectMonthCloseSummaryCards", () => {
  it("should project multiple sources", () => {
    const sources = [
      {
        source: {
          id: "mc-001",
          tenantId: "tenant-001",
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
          status: "DRAFT" as const,
          bankTotal: 1000,
          invoiceTotal: 1000,
          diff: 0,
          openExceptionsCount: 0,
          highExceptionsCount: 0,
          currency: "EUR" as const,
        },
        context: {
          totalTransactions: 10,
          totalInvoices: 10,
          confirmedMatches: 10,
          proposedMatches: 0,
          rejectedMatches: 0,
          averageMatchScore: 90,
        },
      },
      {
        source: {
          id: "mc-002",
          tenantId: "tenant-001",
          periodStart: "2026-02-01",
          periodEnd: "2026-02-28",
          status: "IN_REVIEW" as const,
          bankTotal: 2000,
          invoiceTotal: 2000,
          diff: 0,
          openExceptionsCount: 0,
          highExceptionsCount: 0,
          currency: "EUR" as const,
        },
        context: {
          totalTransactions: 20,
          totalInvoices: 20,
          confirmedMatches: 20,
          proposedMatches: 0,
          rejectedMatches: 0,
          averageMatchScore: 95,
        },
      },
    ];

    const results = projectMonthCloseSummaryCards(sources);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });
});

describe("sortSummaryCards", () => {
  const cards: MonthCloseSummaryCard[] = [
    {
      id: "mc-001",
      tenantId: "tenant-001",
      periodLabel: "January 2026",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      status: "DRAFT",
      statusLabel: "Draft",
      statusColor: "gray",
      healthStatus: "WARNING",
      healthLabel: "Needs Attention",
      healthColor: "yellow",
      progressStage: "MATCHING",
      progressPercent: 50,
      progressLabel: "50% complete",
      bankTotal: { cents: 100000, currency: "EUR" },
      invoiceTotal: { cents: 100000, currency: "EUR" },
      difference: { cents: 0, currency: "EUR" },
      isBalanced: true,
      differenceLabel: "Balanced",
      differenceColor: "green",
      transactionCount: 10,
      invoiceCount: 10,
      matchedCount: 5,
      unmatchedCount: 5,
      exceptionCount: 2,
      highPriorityExceptionCount: 1,
      matchPercent: 50,
      completionPercent: 50,
      averageMatchScore: 80,
      dataQualityScore: 70,
      actions: [],
      canTransitionToReview: true,
      canFinalize: false,
      hasBlockingIssues: true,
      blockingIssues: ["Test issue"],
    },
    {
      id: "mc-002",
      tenantId: "tenant-001",
      periodLabel: "February 2026",
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
      status: "FINALIZED",
      statusLabel: "Finalized",
      statusColor: "green",
      healthStatus: "HEALTHY",
      healthLabel: "Healthy",
      healthColor: "green",
      progressStage: "COMPLETE",
      progressPercent: 100,
      progressLabel: "100% complete",
      bankTotal: { cents: 200000, currency: "EUR" },
      invoiceTotal: { cents: 200000, currency: "EUR" },
      difference: { cents: 0, currency: "EUR" },
      isBalanced: true,
      differenceLabel: "Balanced",
      differenceColor: "green",
      transactionCount: 20,
      invoiceCount: 20,
      matchedCount: 20,
      unmatchedCount: 0,
      exceptionCount: 0,
      highPriorityExceptionCount: 0,
      matchPercent: 100,
      completionPercent: 100,
      averageMatchScore: 95,
      dataQualityScore: 95,
      actions: [],
      canTransitionToReview: false,
      canFinalize: false,
      hasBlockingIssues: false,
      blockingIssues: [],
    },
  ];

  describe("sorting", () => {
    it("should sort by period ascending", () => {
      const sorted = sortSummaryCards(cards, {
        sortBy: "period",
        sortOrder: "asc",
      });

      expect(sorted[0].periodStart).toBe("2026-01-01");
      expect(sorted[1].periodStart).toBe("2026-02-01");
    });

    it("should sort by period descending", () => {
      const sorted = sortSummaryCards(cards, {
        sortBy: "period",
        sortOrder: "desc",
      });

      expect(sorted[0].periodStart).toBe("2026-02-01");
      expect(sorted[1].periodStart).toBe("2026-01-01");
    });

    it("should sort by status", () => {
      const sorted = sortSummaryCards(cards, {
        sortBy: "status",
        sortOrder: "asc",
      });

      expect(sorted[0].status).toBe("DRAFT");
      expect(sorted[1].status).toBe("FINALIZED");
    });

    it("should sort by health", () => {
      const sorted = sortSummaryCards(cards, {
        sortBy: "health",
        sortOrder: "asc",
      });

      // WARNING comes before HEALTHY (worse first)
      expect(sorted[0].healthStatus).toBe("WARNING");
      expect(sorted[1].healthStatus).toBe("HEALTHY");
    });

    it("should sort by match percent", () => {
      const sorted = sortSummaryCards(cards, {
        sortBy: "matchPercent",
        sortOrder: "desc",
      });

      expect(sorted[0].matchPercent).toBe(100);
      expect(sorted[1].matchPercent).toBe(50);
    });
  });

  describe("filtering", () => {
    it("should filter by status", () => {
      const sorted = sortSummaryCards(cards, {
        sortBy: "period",
        sortOrder: "asc",
        statusFilter: ["FINALIZED"],
      });

      expect(sorted).toHaveLength(1);
      expect(sorted[0].status).toBe("FINALIZED");
    });

    it("should filter by multiple statuses", () => {
      const sorted = sortSummaryCards(cards, {
        sortBy: "period",
        sortOrder: "asc",
        statusFilter: ["DRAFT", "IN_REVIEW"],
      });

      expect(sorted).toHaveLength(1);
      expect(sorted[0].status).toBe("DRAFT");
    });

    it("should return empty for no matching filter", () => {
      const sorted = sortSummaryCards(cards, {
        sortBy: "period",
        sortOrder: "asc",
        statusFilter: ["IN_REVIEW"],
      });

      expect(sorted).toHaveLength(0);
    });
  });
});
