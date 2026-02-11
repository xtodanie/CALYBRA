/**
 * VAT Report CSV Export Tests - 100% coverage
 *
 * Tests for CSV generation, formatting, and validation
 */

import {
  generateVatReportCsv,
  generateVatSummaryCsv,
  extractModelo303Fields,
  VatReportInvoice,
  VatReportOptions,
  DEFAULT_VAT_REPORT_OPTIONS,
} from "../../../server/exports/vatReportCsv";
import { BusinessErrorCode } from "../../../server/logic/errors/businessErrors";

describe("generateVatReportCsv", () => {
  const baseInvoices: VatReportInvoice[] = [
    {
      invoiceId: "inv-001",
      invoiceNumber: "FA-001",
      supplierName: "Supplier A",
      issueDate: "2026-01-15",
      totalGrossCents: 12100, // 121.00 including 21% VAT
      vatRatePercent: 21,
      currency: "EUR",
    },
    {
      invoiceId: "inv-002",
      invoiceNumber: "FA-002",
      supplierName: "Supplier B",
      issueDate: "2026-01-10",
      totalGrossCents: 11000, // 110.00 including 10% VAT
      vatRatePercent: 10,
      currency: "EUR",
    },
    {
      invoiceId: "inv-003",
      invoiceNumber: "FA-003",
      supplierName: "Supplier C",
      issueDate: "2026-01-20",
      totalGrossCents: 24200, // 242.00 including 21% VAT
      vatRatePercent: 21,
      currency: "EUR",
    },
  ];

  const baseOptions: VatReportOptions = {
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    tenantId: "tenant-001",
    tenantName: "Test Company",
    currency: "EUR",
    locale: "en",
    delimiter: ",",
    decimalSeparator: ".",
    includeHeader: true,
    includeSummary: true,
    includeTotalsByRate: true,
  };

  const generatedAt = "2026-02-01T10:00:00Z";

  describe("happy path", () => {
    it("should generate CSV content", () => {
      const result = generateVatReportCsv(baseInvoices, baseOptions, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.csvContent).toBeDefined();
        expect(result.value.csvContent.length).toBeGreaterThan(0);
      }
    });

    it("should generate correct filename", () => {
      const result = generateVatReportCsv(baseInvoices, baseOptions, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.filename).toBe("vat_report_tenant-001_20260101_20260131.csv");
      }
    });

    it("should include metadata", () => {
      const result = generateVatReportCsv(baseInvoices, baseOptions, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.metadata.generatedAt).toBe(generatedAt);
        expect(result.value.metadata.periodStart).toBe("2026-01-01");
        expect(result.value.metadata.periodEnd).toBe("2026-01-31");
        expect(result.value.metadata.tenantId).toBe("tenant-001");
        expect(result.value.metadata.currency).toBe("EUR");
        expect(result.value.metadata.invoiceCount).toBe(3);
      }
    });

    it("should calculate line totals", () => {
      const result = generateVatReportCsv(baseInvoices, baseOptions, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.lines).toHaveLength(3);
        // Lines should be sorted by date, then invoice number
        expect(result.value.lines[0].invoiceNumber).toBe("FA-002"); // 2026-01-10
        expect(result.value.lines[1].invoiceNumber).toBe("FA-001"); // 2026-01-15
        expect(result.value.lines[2].invoiceNumber).toBe("FA-003"); // 2026-01-20
      }
    });

    it("should calculate totals by rate", () => {
      const result = generateVatReportCsv(baseInvoices, baseOptions, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.totalsByRate).toHaveLength(2);
        // Sorted by rate
        const rate10 = result.value.totalsByRate.find((t) => t.rate === 10);
        const rate21 = result.value.totalsByRate.find((t) => t.rate === 21);

        expect(rate10?.invoiceCount).toBe(1);
        expect(rate21?.invoiceCount).toBe(2);
      }
    });

    it("should calculate grand totals", () => {
      const result = generateVatReportCsv(baseInvoices, baseOptions, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        // Total gross: 121 + 110 + 242 = 473
        expect(result.value.grandTotals.grossAmount).toBe(473);
      }
    });
  });

  describe("date filtering", () => {
    it("should filter invoices within period", () => {
      const invoicesWithOutOfRange = [
        ...baseInvoices,
        {
          invoiceId: "inv-004",
          invoiceNumber: "FA-004",
          supplierName: "Supplier D",
          issueDate: "2025-12-15", // Before period
          totalGrossCents: 10000,
          vatRatePercent: 21,
          currency: "EUR" as const,
        },
        {
          invoiceId: "inv-005",
          invoiceNumber: "FA-005",
          supplierName: "Supplier E",
          issueDate: "2026-02-15", // After period
          totalGrossCents: 10000,
          vatRatePercent: 21,
          currency: "EUR" as const,
        },
      ];

      const result = generateVatReportCsv(invoicesWithOutOfRange, baseOptions, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.lines).toHaveLength(3);
      }
    });

    it("should filter by currency", () => {
      const mixedCurrency = [
        ...baseInvoices,
        {
          invoiceId: "inv-004",
          invoiceNumber: "FA-004",
          supplierName: "Supplier D",
          issueDate: "2026-01-15",
          totalGrossCents: 10000,
          vatRatePercent: 21,
          currency: "USD" as const, // Different currency
        },
      ];

      const result = generateVatReportCsv(mixedCurrency, baseOptions, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.lines).toHaveLength(3);
      }
    });
  });

  describe("CSV formatting", () => {
    it("should include header row when enabled", () => {
      const result = generateVatReportCsv(baseInvoices, baseOptions, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        const lines = result.value.csvContent.split("\n");
        expect(lines[0]).toContain("Invoice Number");
        expect(lines[0]).toContain("Supplier");
      }
    });

    it("should exclude header row when disabled", () => {
      const options = { ...baseOptions, includeHeader: false };
      const result = generateVatReportCsv(baseInvoices, options, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        const lines = result.value.csvContent.split("\n");
        // First line should be data, not header
        expect(lines[0]).not.toContain("Invoice Number");
      }
    });

    it("should use semicolon delimiter", () => {
      const options = { ...baseOptions, delimiter: ";" as const };
      const result = generateVatReportCsv(baseInvoices, options, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.csvContent).toContain(";");
        // Should not have comma as field separator
        const headerLine = result.value.csvContent.split("\n")[0];
        expect(headerLine.split(";").length).toBeGreaterThan(1);
      }
    });

    it("should use comma decimal separator", () => {
      const options = { ...baseOptions, decimalSeparator: "," as const, delimiter: ";" as const };
      const result = generateVatReportCsv(baseInvoices, options, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        // Amounts should use comma
        expect(result.value.csvContent).toMatch(/\d+,\d{2}/);
      }
    });

    it("should include summary section", () => {
      const result = generateVatReportCsv(baseInvoices, baseOptions, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.csvContent).toContain("VAT Summary");
        expect(result.value.csvContent).toContain("GRAND TOTAL");
      }
    });

    it("should exclude summary when disabled", () => {
      const options = { ...baseOptions, includeSummary: false };
      const result = generateVatReportCsv(baseInvoices, options, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.csvContent).not.toContain("GRAND TOTAL");
      }
    });

    it("should escape fields with delimiters", () => {
      const invoicesWithComma = [
        {
          invoiceId: "inv-001",
          invoiceNumber: "FA-001",
          supplierName: "Supplier, Inc.",
          issueDate: "2026-01-15",
          totalGrossCents: 12100,
          vatRatePercent: 21,
          currency: "EUR" as const,
        },
      ];

      const result = generateVatReportCsv(invoicesWithComma, baseOptions, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.csvContent).toContain('"Supplier, Inc."');
      }
    });

    it("should escape fields with quotes", () => {
      const invoicesWithQuotes = [
        {
          invoiceId: "inv-001",
          invoiceNumber: 'FA-"001"',
          supplierName: "Supplier",
          issueDate: "2026-01-15",
          totalGrossCents: 12100,
          vatRatePercent: 21,
          currency: "EUR" as const,
        },
      ];

      const result = generateVatReportCsv(invoicesWithQuotes, baseOptions, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        // Quotes should be doubled
        expect(result.value.csvContent).toContain('""001""');
      }
    });

    it("should sanitize newlines in fields", () => {
      const invoicesWithNewlines = [
        {
          invoiceId: "inv-001",
          invoiceNumber: "FA-001",
          supplierName: "Supplier\nName",
          issueDate: "2026-01-15",
          totalGrossCents: 12100,
          vatRatePercent: 21,
          currency: "EUR" as const,
        },
      ];

      const result = generateVatReportCsv(invoicesWithNewlines, baseOptions, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        // Newline in supplier name should be sanitized
        const lines = result.value.lines;
        expect(lines[0].supplierName).not.toContain("\n");
      }
    });
  });

  describe("locale support", () => {
    it("should use English labels", () => {
      const options = { ...baseOptions, locale: "en" as const };
      const result = generateVatReportCsv(baseInvoices, options, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.csvContent).toContain("Invoice Number");
        expect(result.value.csvContent).toContain("Supplier");
        expect(result.value.csvContent).toContain("GRAND TOTAL");
      }
    });

    it("should use Spanish labels", () => {
      const options = { ...baseOptions, locale: "es" as const };
      const result = generateVatReportCsv(baseInvoices, options, generatedAt);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.csvContent).toContain("Número de Factura");
        expect(result.value.csvContent).toContain("Proveedor");
        expect(result.value.csvContent).toContain("TOTAL GENERAL");
      }
    });
  });

  describe("validation errors", () => {
    it("should reject invalid period start date", () => {
      const options = { ...baseOptions, periodStart: "invalid" };
      const result = generateVatReportCsv(baseInvoices, options, generatedAt);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(BusinessErrorCode.INVALID_DATE_FORMAT);
      }
    });

    it("should reject invalid period end date", () => {
      const options = { ...baseOptions, periodEnd: "2026/01/31" };
      const result = generateVatReportCsv(baseInvoices, options, generatedAt);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(BusinessErrorCode.INVALID_DATE_FORMAT);
      }
    });

    it("should reject period start after end", () => {
      const options = { ...baseOptions, periodStart: "2026-02-01", periodEnd: "2026-01-31" };
      const result = generateVatReportCsv(baseInvoices, options, generatedAt);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(BusinessErrorCode.INVALID_PERIOD);
      }
    });

    it("should reject empty result (no invoices in period)", () => {
      const options = { ...baseOptions, periodStart: "2025-01-01", periodEnd: "2025-01-31" };
      const result = generateVatReportCsv(baseInvoices, options, generatedAt);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(BusinessErrorCode.NO_DATA_TO_EXPORT);
      }
    });
  });

  describe("determinism", () => {
    it("should produce same output for same inputs", () => {
      const result1 = generateVatReportCsv(baseInvoices, baseOptions, generatedAt);
      const result2 = generateVatReportCsv(baseInvoices, baseOptions, generatedAt);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.value.csvContent).toBe(result2.value.csvContent);
      }
    });

    it("should maintain stable sort order", () => {
      // Shuffle invoices
      const shuffled = [baseInvoices[2], baseInvoices[0], baseInvoices[1]];

      const result1 = generateVatReportCsv(baseInvoices, baseOptions, generatedAt);
      const result2 = generateVatReportCsv(shuffled, baseOptions, generatedAt);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        // Same output regardless of input order
        expect(result1.value.csvContent).toBe(result2.value.csvContent);
      }
    });
  });
});

describe("generateVatSummaryCsv", () => {
  const invoices: VatReportInvoice[] = [
    {
      invoiceId: "inv-001",
      invoiceNumber: "FA-001",
      supplierName: "Supplier A",
      issueDate: "2026-01-15",
      totalGrossCents: 12100,
      vatRatePercent: 21,
      currency: "EUR",
    },
    {
      invoiceId: "inv-002",
      invoiceNumber: "FA-002",
      supplierName: "Supplier B",
      issueDate: "2026-01-10",
      totalGrossCents: 11000,
      vatRatePercent: 10,
      currency: "EUR",
    },
  ];

  const options: VatReportOptions = {
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    tenantId: "tenant-001",
    currency: "EUR",
    locale: "en",
    delimiter: ",",
    decimalSeparator: ".",
    includeHeader: true,
    includeSummary: true,
    includeTotalsByRate: true,
  };

  it("should generate summary-only CSV", () => {
    const result = generateVatSummaryCsv(invoices, options, "2026-02-01T10:00:00Z");

    expect(result.success).toBe(true);
    if (result.success) {
      // Should have header + rates + total
      const lines = result.value.split("\n");
      expect(lines.length).toBe(4); // Header, 10%, 21%, Grand Total
    }
  });

  it("should propagate validation errors", () => {
    const badOptions = { ...options, periodStart: "invalid" };
    const result = generateVatSummaryCsv(invoices, badOptions, "2026-02-01T10:00:00Z");

    expect(result.success).toBe(false);
  });
});

describe("extractModelo303Fields", () => {
  it("should extract fields for Spanish VAT rates", () => {
    const totalsByRate = [
      { rate: 4, invoiceCount: 5, netAmount: 1000, vatAmount: 40, grossAmount: 1040 },
      { rate: 10, invoiceCount: 10, netAmount: 2000, vatAmount: 200, grossAmount: 2200 },
      { rate: 21, invoiceCount: 20, netAmount: 5000, vatAmount: 1050, grossAmount: 6050 },
    ];

    const fields = extractModelo303Fields(totalsByRate);

    expect(fields.base4).toBe(1000);
    expect(fields.cuota4).toBe(40);
    expect(fields.base10).toBe(2000);
    expect(fields.cuota10).toBe(200);
    expect(fields.base21).toBe(5000);
    expect(fields.cuota21).toBe(1050);
    expect(fields.totalBase).toBe(8000);
    expect(fields.totalCuota).toBe(1290);
  });

  it("should handle missing rates", () => {
    const totalsByRate = [
      { rate: 21, invoiceCount: 10, netAmount: 5000, vatAmount: 1050, grossAmount: 6050 },
    ];

    const fields = extractModelo303Fields(totalsByRate);

    expect(fields.base4).toBe(0);
    expect(fields.cuota4).toBe(0);
    expect(fields.base10).toBe(0);
    expect(fields.cuota10).toBe(0);
    expect(fields.base21).toBe(5000);
    expect(fields.cuota21).toBe(1050);
  });

  it("should handle empty input", () => {
    const fields = extractModelo303Fields([]);

    expect(fields.base21).toBe(0);
    expect(fields.cuota21).toBe(0);
    expect(fields.totalBase).toBe(0);
    expect(fields.totalCuota).toBe(0);
  });

  it("should round totals correctly", () => {
    const totalsByRate = [
      { rate: 21, invoiceCount: 1, netAmount: 100.005, vatAmount: 21.001, grossAmount: 121.006 },
      { rate: 10, invoiceCount: 1, netAmount: 100.004, vatAmount: 10.002, grossAmount: 110.006 },
    ];

    const fields = extractModelo303Fields(totalsByRate);

    // Totals should be rounded to 2 decimals
    expect(fields.totalBase).toBe(200.01);
    expect(fields.totalCuota).toBe(31);
  });
});

describe("DEFAULT_VAT_REPORT_OPTIONS", () => {
  it("should have sensible defaults", () => {
    expect(DEFAULT_VAT_REPORT_OPTIONS.locale).toBe("en");
    expect(DEFAULT_VAT_REPORT_OPTIONS.delimiter).toBe(",");
    expect(DEFAULT_VAT_REPORT_OPTIONS.decimalSeparator).toBe(".");
    expect(DEFAULT_VAT_REPORT_OPTIONS.includeHeader).toBe(true);
    expect(DEFAULT_VAT_REPORT_OPTIONS.includeSummary).toBe(true);
    expect(DEFAULT_VAT_REPORT_OPTIONS.includeTotalsByRate).toBe(true);
  });
});

describe("edge cases", () => {
  it("should handle invoice at period boundary start", () => {
    const invoices: VatReportInvoice[] = [
      {
        invoiceId: "inv-001",
        invoiceNumber: "FA-001",
        supplierName: "Supplier",
        issueDate: "2026-01-01", // Exactly at start
        totalGrossCents: 12100,
        vatRatePercent: 21,
        currency: "EUR",
      },
    ];

    const options: VatReportOptions = {
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      tenantId: "tenant-001",
      currency: "EUR",
      locale: "en",
      delimiter: ",",
      decimalSeparator: ".",
      includeHeader: true,
      includeSummary: true,
      includeTotalsByRate: true,
    };

    const result = generateVatReportCsv(invoices, options, "2026-02-01T10:00:00Z");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.lines).toHaveLength(1);
    }
  });

  it("should handle invoice at period boundary end", () => {
    const invoices: VatReportInvoice[] = [
      {
        invoiceId: "inv-001",
        invoiceNumber: "FA-001",
        supplierName: "Supplier",
        issueDate: "2026-01-31", // Exactly at end
        totalGrossCents: 12100,
        vatRatePercent: 21,
        currency: "EUR",
      },
    ];

    const options: VatReportOptions = {
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      tenantId: "tenant-001",
      currency: "EUR",
      locale: "en",
      delimiter: ",",
      decimalSeparator: ".",
      includeHeader: true,
      includeSummary: true,
      includeTotalsByRate: true,
    };

    const result = generateVatReportCsv(invoices, options, "2026-02-01T10:00:00Z");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.lines).toHaveLength(1);
    }
  });

  it("should handle zero VAT rate", () => {
    const invoices: VatReportInvoice[] = [
      {
        invoiceId: "inv-001",
        invoiceNumber: "FA-001",
        supplierName: "Supplier",
        issueDate: "2026-01-15",
        totalGrossCents: 10000,
        vatRatePercent: 0, // Exempt
        currency: "EUR",
      },
    ];

    const options: VatReportOptions = {
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      tenantId: "tenant-001",
      currency: "EUR",
      locale: "en",
      delimiter: ",",
      decimalSeparator: ".",
      includeHeader: true,
      includeSummary: true,
      includeTotalsByRate: true,
    };

    const result = generateVatReportCsv(invoices, options, "2026-02-01T10:00:00Z");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.lines[0].vatRate).toBe(0);
      expect(result.value.lines[0].vatAmount).toBe(0);
      expect(result.value.lines[0].netAmount).toBe(100); // Net = Gross when VAT = 0
    }
  });
});
