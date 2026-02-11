/**
 * Bank Transaction Extraction tests - validate determinism
 */

import {
  extractBankTransactions,
  BankTxLine,
} from "../../logic/parsing/extractBankTx";

describe("extractBankTransactions", () => {
  describe("CSV parsing", () => {
    it("parses standard CSV with header", () => {
      const csv = `Date,Description,Amount
2024-01-15,Payment to vendor,-500.00
2024-01-16,Customer payment,1200.50
2024-01-17,Bank fee,-25.00`;

      const result = extractBankTransactions(csv);

      expect(result.length).toBe(3);
      expect(result[0].bookingDate).toBe("2024-01-15");
      expect(result[0].amount).toBe(-500);
      expect(result[0].description).toBe("Payment to vendor");
    });

    it("handles semicolon delimiter", () => {
      const csv = `Date;Description;Amount
2024-01-15;Payment;-100.00`;

      const result = extractBankTransactions(csv);
      expect(result.length).toBe(1);
      expect(result[0].amount).toBe(-100);
    });

    it("handles quoted fields", () => {
      const csv = `Date,Description,Amount
2024-01-15,"Payment, with comma",-100.00`;

      const result = extractBankTransactions(csv);
      expect(result[0].description).toBe("Payment, with comma");
    });

    it("handles European number format", () => {
      const csv = `Date;Description;Amount
2024-01-15;Payment;-1.234,56`;

      const result = extractBankTransactions(csv);
      expect(result[0].amount).toBe(-1234.56);
    });
  });

  describe("date parsing", () => {
    it("parses YYYY-MM-DD format", () => {
      const csv = `Date,Description,Amount
2024-01-15,Test,-100`;

      const result = extractBankTransactions(csv);
      expect(result[0].bookingDate).toBe("2024-01-15");
    });

    it("parses DD-MM-YYYY format", () => {
      const csv = `Date,Description,Amount
15-01-2024,Test,-100`;

      const result = extractBankTransactions(csv);
      expect(result[0].bookingDate).toBe("2024-01-15");
    });

    it("parses DD.MM.YYYY format (German)", () => {
      const csv = `Date,Description,Amount
15.01.2024,Test,-100`;

      const result = extractBankTransactions(csv);
      expect(result[0].bookingDate).toBe("2024-01-15");
    });
  });

  describe("amount parsing", () => {
    it("parses positive amounts", () => {
      const csv = `Date,Description,Amount
2024-01-15,Credit,500.00`;

      const result = extractBankTransactions(csv);
      expect(result[0].amount).toBe(500);
    });

    it("parses negative amounts with minus sign", () => {
      const csv = `Date,Description,Amount
2024-01-15,Debit,-500.00`;

      const result = extractBankTransactions(csv);
      expect(result[0].amount).toBe(-500);
    });

    it("parses amounts with parentheses as negative", () => {
      const csv = `Date,Description,Amount
2024-01-15,Debit,(500.00)`;

      const result = extractBankTransactions(csv);
      expect(result[0].amount).toBe(-500);
    });

    it("handles currency symbols", () => {
      const csv = `Date,Description,Amount
2024-01-15,Payment,€500.00`;

      const result = extractBankTransactions(csv);
      expect(result[0].amount).toBe(500);
    });
  });

  describe("column detection", () => {
    it("detects various column names for date", () => {
      const headers = ["Booking Date", "fecha", "Datum", "Value Date"];
      for (const header of headers) {
        const csv = `${header},Description,Amount
2024-01-15,Test,-100`;

        const result = extractBankTransactions(csv);
        expect(result.length).toBe(1);
      }
    });

    it("detects counterparty column when present", () => {
      const csv = `Date,Description,Amount,Counterparty
2024-01-15,Test,-100,ACME Corp`;

      const result = extractBankTransactions(csv);
      expect(result[0].counterparty).toBe("ACME Corp");
    });

    it("detects reference column when present", () => {
      const csv = `Date,Description,Amount,Reference
2024-01-15,Test,-100,REF123`;

      const result = extractBankTransactions(csv);
      expect(result[0].reference).toBe("REF123");
    });
  });

  describe("error handling", () => {
    it("throws for empty content", () => {
      expect(() => extractBankTransactions("")).toThrow();
    });

    it("throws for header only", () => {
      expect(() => extractBankTransactions("Date,Description,Amount")).toThrow();
    });

    it("throws when required columns missing", () => {
      const csv = `Name,Value
Test,100`;

      expect(() => extractBankTransactions(csv)).toThrow();
    });

    it("skips malformed rows", () => {
      const csv = `Date,Description,Amount
2024-01-15,Good row,-100
invalid,data
2024-01-16,Another good row,-200`;

      const result = extractBankTransactions(csv);
      expect(result.length).toBe(2);
    });
  });

  describe("determinism", () => {
    it("produces identical results for identical input", () => {
      const csv = `Date,Description,Amount,Counterparty
2024-01-15,Wire transfer,-5000.00,ACME Corp
2024-01-16,Customer payment,7500.50,XYZ Ltd
2024-01-17,Service fee,-25.00,Bank`;

      const results: BankTxLine[][] = [];
      for (let i = 0; i < 5; i++) {
        results.push(extractBankTransactions(csv));
      }

      // All results should have same structure
      for (let i = 1; i < results.length; i++) {
        expect(results[i].length).toBe(results[0].length);
        for (let j = 0; j < results[0].length; j++) {
          expect(results[i][j].amount).toBe(results[0][j].amount);
          expect(results[i][j].bookingDate).toBe(results[0][j].bookingDate);
          expect(results[i][j].description).toBe(results[0][j].description);
        }
      }
    });
  });
});
