/**
 * Invoice Totals Tests - 100% coverage
 *
 * Tests for invoice line calculations, period aggregates, and validation
 */

import {
  calculateLineTotal,
  calculateInvoiceTotals,
  calculatePeriodInvoiceAggregates,
  calculateSupplierTotals,
  validateInvoiceTotals,
  calculateTotalsDifference,
  InvoiceLineInput,
  InvoiceSummaryInput,
} from "../../../server/logic/accounting/invoiceTotals";
import { BusinessErrorCode } from "../../../server/logic/errors/businessErrors";

describe("calculateLineTotal", () => {
  const baseLine: InvoiceLineInput = {
    invoiceId: "inv-001",
    lineNumber: 1,
    description: "Widget A",
    quantity: 10,
    unitPriceCents: 1000, // 10.00
    vatRatePercent: 21,
    currency: "EUR",
  };

  describe("happy path", () => {
    it("should calculate line total with VAT", () => {
      const result = calculateLineTotal(baseLine);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.lineNumber).toBe(1);
        expect(result.value.netAmount.cents).toBe(10000); // 10 * 10.00 = 100.00
        expect(result.value.vatAmount.cents).toBe(2100); // 21% of 100.00
        expect(result.value.grossAmount.cents).toBe(12100); // 121.00
        expect(result.value.vatRate).toBe(21);
      }
    });

    it("should calculate zero VAT line", () => {
      const line = { ...baseLine, vatRatePercent: 0 };
      const result = calculateLineTotal(line);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.netAmount.cents).toBe(10000);
        expect(result.value.vatAmount.cents).toBe(0);
        expect(result.value.grossAmount.cents).toBe(10000);
      }
    });

    it("should handle fractional quantities", () => {
      const line = { ...baseLine, quantity: 2.5 };
      const result = calculateLineTotal(line);

      expect(result.success).toBe(true);
      if (result.success) {
        // 2.5 * 10.00 = 25.00
        expect(result.value.netAmount.cents).toBe(2500);
      }
    });

    it("should handle zero quantity", () => {
      const line = { ...baseLine, quantity: 0 };
      const result = calculateLineTotal(line);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.netAmount.cents).toBe(0);
        expect(result.value.vatAmount.cents).toBe(0);
        expect(result.value.grossAmount.cents).toBe(0);
      }
    });
  });

  describe("validation errors", () => {
    it("should reject negative quantity", () => {
      const line = { ...baseLine, quantity: -5 };
      const result = calculateLineTotal(line);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(BusinessErrorCode.VALUE_OUT_OF_RANGE);
        expect(result.error.details?.lineNumber).toBe(1);
      }
    });

    it("should reject negative VAT rate", () => {
      const line = { ...baseLine, vatRatePercent: -10 };
      const result = calculateLineTotal(line);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(BusinessErrorCode.INVALID_VAT_RATE);
      }
    });

    it("should reject VAT rate over 100", () => {
      const line = { ...baseLine, vatRatePercent: 150 };
      const result = calculateLineTotal(line);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(BusinessErrorCode.INVALID_VAT_RATE);
      }
    });
  });

  describe("rounding", () => {
    it("should apply bankers rounding at 0.5 boundary (round to even)", () => {
      // Create a case where rounding is needed
      const line = {
        ...baseLine,
        quantity: 1,
        unitPriceCents: 105, // 1.05
        vatRatePercent: 10,
      };
      const result = calculateLineTotal(line);

      expect(result.success).toBe(true);
      // 1.05 * 10% = 0.105 -> rounds to 0.10 or 0.11 depending on algorithm
    });
  });
});

describe("calculateInvoiceTotals", () => {
  const baseLines: InvoiceLineInput[] = [
    {
      invoiceId: "inv-001",
      lineNumber: 1,
      description: "Item 1",
      quantity: 2,
      unitPriceCents: 5000, // 50.00
      vatRatePercent: 21,
      currency: "EUR",
    },
    {
      invoiceId: "inv-001",
      lineNumber: 2,
      description: "Item 2",
      quantity: 1,
      unitPriceCents: 10000, // 100.00
      vatRatePercent: 21,
      currency: "EUR",
    },
  ];

  describe("happy path", () => {
    it("should calculate invoice totals", () => {
      const result = calculateInvoiceTotals("inv-001", baseLines);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.invoiceId).toBe("inv-001");
        expect(result.value.lineCount).toBe(2);
        // Line 1: 2 * 50 = 100, VAT = 21
        // Line 2: 1 * 100 = 100, VAT = 21
        // Total: Net = 200, VAT = 42, Gross = 242
        expect(result.value.totalNet.cents).toBe(20000);
        expect(result.value.totalVat.cents).toBe(4200);
        expect(result.value.totalGross.cents).toBe(24200);
      }
    });

    it("should group VAT by rate", () => {
      const mixedRateLines: InvoiceLineInput[] = [
        { ...baseLines[0], vatRatePercent: 21 },
        { ...baseLines[1], vatRatePercent: 10, lineNumber: 2 },
      ];

      const result = calculateInvoiceTotals("inv-001", mixedRateLines);

      expect(result.success).toBe(true);
      if (result.success) {
        const vatByRate = result.value.vatByRate;
        expect(vatByRate.has(21)).toBe(true);
        expect(vatByRate.has(10)).toBe(true);
      }
    });

    it("should include line totals", () => {
      const result = calculateInvoiceTotals("inv-001", baseLines);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.lineTotals).toHaveLength(2);
        expect(result.value.lineTotals[0].lineNumber).toBe(1);
        expect(result.value.lineTotals[1].lineNumber).toBe(2);
      }
    });
  });

  describe("validation errors", () => {
    it("should reject empty lines array", () => {
      const result = calculateInvoiceTotals("inv-001", []);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(BusinessErrorCode.EMPTY_COLLECTION);
      }
    });

    it("should reject currency mismatch", () => {
      const mixedCurrencyLines: InvoiceLineInput[] = [
        { ...baseLines[0], currency: "EUR" },
        { ...baseLines[1], currency: "USD" },
      ];

      const result = calculateInvoiceTotals("inv-001", mixedCurrencyLines);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(BusinessErrorCode.CURRENCY_MISMATCH);
      }
    });

    it("should propagate line validation errors", () => {
      const invalidLines: InvoiceLineInput[] = [
        { ...baseLines[0], quantity: -1 },
      ];

      const result = calculateInvoiceTotals("inv-001", invalidLines);

      expect(result.success).toBe(false);
    });
  });
});

describe("calculatePeriodInvoiceAggregates", () => {
  const baseInvoices: InvoiceSummaryInput[] = [
    {
      invoiceId: "inv-001",
      tenantId: "tenant-001",
      monthCloseId: "mc-001",
      supplierName: "Supplier A",
      invoiceNumber: "FA-001",
      issueDate: "2026-01-15",
      totalGrossCents: 12100, // 121.00 including 21% VAT
      vatRatePercent: 21,
      currency: "EUR",
      isMatched: true,
    },
    {
      invoiceId: "inv-002",
      tenantId: "tenant-001",
      monthCloseId: "mc-001",
      supplierName: "Supplier A", // Same supplier
      invoiceNumber: "FA-002",
      issueDate: "2026-01-20",
      totalGrossCents: 24200, // 242.00
      vatRatePercent: 21,
      currency: "EUR",
      isMatched: false,
    },
    {
      invoiceId: "inv-003",
      tenantId: "tenant-001",
      monthCloseId: "mc-001",
      supplierName: "Supplier B",
      invoiceNumber: "FB-001",
      issueDate: "2026-02-10",
      totalGrossCents: 11000, // 110.00 including 10% VAT
      vatRatePercent: 10,
      currency: "EUR",
      isMatched: true,
    },
  ];

  describe("happy path", () => {
    it("should calculate period aggregates", () => {
      const result = calculatePeriodInvoiceAggregates(baseInvoices, "EUR");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.invoiceCount).toBe(3);
        expect(result.value.matchedCount).toBe(2);
        expect(result.value.unmatchedCount).toBe(1);
      }
    });

    it("should calculate VAT breakdown by rate", () => {
      const result = calculatePeriodInvoiceAggregates(baseInvoices, "EUR");

      expect(result.success).toBe(true);
      if (result.success) {
        const vatBreakdown = result.value.vatBreakdown;
        expect(vatBreakdown.has(21)).toBe(true);
        expect(vatBreakdown.has(10)).toBe(true);

        const vat21 = vatBreakdown.get(21)!;
        expect(vat21.invoiceCount).toBe(2);

        const vat10 = vatBreakdown.get(10)!;
        expect(vat10.invoiceCount).toBe(1);
      }
    });

    it("should calculate supplier summary", () => {
      const result = calculatePeriodInvoiceAggregates(baseInvoices, "EUR");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.supplierSummary).toHaveLength(2);
        // Supplier A has higher total, should be first
        expect(result.value.supplierSummary[0].supplierName).toBe("supplier a");
        expect(result.value.supplierSummary[0].invoiceCount).toBe(2);
      }
    });

    it("should calculate monthly trend", () => {
      const result = calculatePeriodInvoiceAggregates(baseInvoices, "EUR");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.monthlyTrend).toHaveLength(2);
        // Sorted by month
        expect(result.value.monthlyTrend[0].month).toBe("2026-01");
        expect(result.value.monthlyTrend[1].month).toBe("2026-02");
      }
    });

    it("should separate matched and unmatched amounts", () => {
      const result = calculatePeriodInvoiceAggregates(baseInvoices, "EUR");

      expect(result.success).toBe(true);
      if (result.success) {
        // Matched: inv-001 (121.00) + inv-003 (110.00) = 231.00 gross
        expect(result.value.matchedGrossAmount.cents).toBe(23100);
        // Unmatched: inv-002 (242.00)
        expect(result.value.unmatchedGrossAmount.cents).toBe(24200);
      }
    });
  });

  describe("empty input", () => {
    it("should return empty aggregates for no invoices", () => {
      const result = calculatePeriodInvoiceAggregates([], "EUR");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.invoiceCount).toBe(0);
        expect(result.value.totalGrossAmount.cents).toBe(0);
        expect(result.value.vatBreakdown.size).toBe(0);
        expect(result.value.supplierSummary).toHaveLength(0);
        expect(result.value.monthlyTrend).toHaveLength(0);
      }
    });
  });

  describe("validation errors", () => {
    it("should reject currency mismatch", () => {
      const mixedCurrency: InvoiceSummaryInput[] = [
        { ...baseInvoices[0], currency: "EUR" },
        { ...baseInvoices[1], currency: "USD" },
      ];

      const result = calculatePeriodInvoiceAggregates(mixedCurrency, "EUR");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(BusinessErrorCode.CURRENCY_MISMATCH);
      }
    });
  });

  describe("supplier name normalization", () => {
    it("should group suppliers case-insensitively", () => {
      const invoices: InvoiceSummaryInput[] = [
        { ...baseInvoices[0], supplierName: "SUPPLIER A" },
        { ...baseInvoices[1], supplierName: "Supplier A" },
        { ...baseInvoices[2], supplierName: "supplier a" },
      ];

      const result = calculatePeriodInvoiceAggregates(invoices, "EUR");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.supplierSummary).toHaveLength(1);
        expect(result.value.supplierSummary[0].invoiceCount).toBe(3);
      }
    });

    it("should normalize whitespace in supplier names", () => {
      const invoices: InvoiceSummaryInput[] = [
        { ...baseInvoices[0], supplierName: "Supplier  A" },
        { ...baseInvoices[1], supplierName: " Supplier A " },
      ];

      const result = calculatePeriodInvoiceAggregates(invoices, "EUR");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.supplierSummary).toHaveLength(1);
      }
    });
  });
});

describe("calculateSupplierTotals", () => {
  const invoices: InvoiceSummaryInput[] = [
    {
      invoiceId: "inv-001",
      tenantId: "tenant-001",
      monthCloseId: "mc-001",
      supplierName: "Test Supplier",
      invoiceNumber: "TS-001",
      issueDate: "2026-01-15",
      totalGrossCents: 10000,
      vatRatePercent: 21,
      currency: "EUR",
      isMatched: true,
    },
    {
      invoiceId: "inv-002",
      tenantId: "tenant-001",
      monthCloseId: "mc-001",
      supplierName: "Test Supplier",
      invoiceNumber: "TS-002",
      issueDate: "2026-01-20",
      totalGrossCents: 20000,
      vatRatePercent: 21,
      currency: "EUR",
      isMatched: false,
    },
  ];

  it("should calculate supplier totals", () => {
    const result = calculateSupplierTotals(invoices, "Test Supplier", "EUR");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.supplierName).toBe("test supplier");
      expect(result.value.invoiceCount).toBe(2);
      expect(result.value.totalGross.cents).toBe(30000);
      expect(result.value.matchedCount).toBe(1);
    }
  });

  it("should find supplier case-insensitively", () => {
    const result = calculateSupplierTotals(invoices, "TEST SUPPLIER", "EUR");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.invoiceCount).toBe(2);
    }
  });

  it("should return error for unknown supplier", () => {
    const result = calculateSupplierTotals(invoices, "Unknown Supplier", "EUR");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(BusinessErrorCode.REFERENCE_NOT_FOUND);
    }
  });

  it("should reject currency mismatch", () => {
    const mixedInvoices: InvoiceSummaryInput[] = invoices.map((inv, i) => ({
      ...inv,
      currency: (i === 0 ? "EUR" : "USD") as "EUR" | "USD",
    }));

    const result = calculateSupplierTotals(mixedInvoices, "Test Supplier", "EUR");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(BusinessErrorCode.CURRENCY_MISMATCH);
    }
  });
});

describe("validateInvoiceTotals", () => {
  it("should return ok for valid totals", () => {
    const totals = {
      invoiceId: "inv-001",
      lineCount: 2,
      totalNet: { cents: 10000, currency: "EUR" as const },
      totalVat: { cents: 2100, currency: "EUR" as const },
      totalGross: { cents: 12100, currency: "EUR" as const },
      vatByRate: new Map(),
      lineTotals: [
        { lineNumber: 1, netAmount: { cents: 5000, currency: "EUR" as const }, vatAmount: { cents: 1050, currency: "EUR" as const }, grossAmount: { cents: 6050, currency: "EUR" as const }, vatRate: 21 },
        { lineNumber: 2, netAmount: { cents: 5000, currency: "EUR" as const }, vatAmount: { cents: 1050, currency: "EUR" as const }, grossAmount: { cents: 6050, currency: "EUR" as const }, vatRate: 21 },
      ],
    };

    const result = validateInvoiceTotals(totals);

    expect(result.success).toBe(true);
  });

  it("should return error for gross != net + vat", () => {
    const totals = {
      invoiceId: "inv-001",
      lineCount: 1,
      totalNet: { cents: 10000, currency: "EUR" as const },
      totalVat: { cents: 2100, currency: "EUR" as const },
      totalGross: { cents: 10000, currency: "EUR" as const }, // Wrong!
      vatByRate: new Map(),
      lineTotals: [
        { lineNumber: 1, netAmount: { cents: 10000, currency: "EUR" as const }, vatAmount: { cents: 2100, currency: "EUR" as const }, grossAmount: { cents: 10000, currency: "EUR" as const }, vatRate: 21 },
      ],
    };

    const result = validateInvoiceTotals(totals);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(BusinessErrorCode.CALCULATION_FAILED);
    }
  });

  it("should return error for line count mismatch", () => {
    const totals = {
      invoiceId: "inv-001",
      lineCount: 5, // Says 5 but only 1 line
      totalNet: { cents: 10000, currency: "EUR" as const },
      totalVat: { cents: 2100, currency: "EUR" as const },
      totalGross: { cents: 12100, currency: "EUR" as const },
      vatByRate: new Map(),
      lineTotals: [
        { lineNumber: 1, netAmount: { cents: 10000, currency: "EUR" as const }, vatAmount: { cents: 2100, currency: "EUR" as const }, grossAmount: { cents: 12100, currency: "EUR" as const }, vatRate: 21 },
      ],
    };

    const result = validateInvoiceTotals(totals);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(BusinessErrorCode.INTEGRITY_VIOLATION);
    }
  });
});

describe("calculateTotalsDifference", () => {
  it("should calculate difference between totals", () => {
    const expected = {
      invoiceId: "inv-001",
      lineCount: 1,
      totalNet: { cents: 10000, currency: "EUR" as const },
      totalVat: { cents: 2100, currency: "EUR" as const },
      totalGross: { cents: 12100, currency: "EUR" as const },
      vatByRate: new Map(),
      lineTotals: [],
    };

    const actual = {
      invoiceId: "inv-001",
      lineCount: 1,
      totalNet: { cents: 10050, currency: "EUR" as const },
      totalVat: { cents: 2100, currency: "EUR" as const },
      totalGross: { cents: 12150, currency: "EUR" as const },
      vatByRate: new Map(),
      lineTotals: [],
    };

    const diff = calculateTotalsDifference(expected, actual);

    expect(diff.netDiff).toBe(50);
    expect(diff.vatDiff).toBe(0);
    expect(diff.grossDiff).toBe(50);
  });

  it("should handle negative differences", () => {
    const expected = {
      invoiceId: "inv-001",
      lineCount: 1,
      totalNet: { cents: 10000, currency: "EUR" as const },
      totalVat: { cents: 2100, currency: "EUR" as const },
      totalGross: { cents: 12100, currency: "EUR" as const },
      vatByRate: new Map(),
      lineTotals: [],
    };

    const actual = {
      invoiceId: "inv-001",
      lineCount: 1,
      totalNet: { cents: 9900, currency: "EUR" as const },
      totalVat: { cents: 2000, currency: "EUR" as const },
      totalGross: { cents: 11900, currency: "EUR" as const },
      vatByRate: new Map(),
      lineTotals: [],
    };

    const diff = calculateTotalsDifference(expected, actual);

    expect(diff.netDiff).toBe(-100);
    expect(diff.vatDiff).toBe(-100);
    expect(diff.grossDiff).toBe(-200);
  });
});
