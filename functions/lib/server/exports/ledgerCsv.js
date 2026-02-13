"use strict";
/**
 * Ledger CSV Export - deterministic CSV generator
 * Pure logic. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLedgerCsv = generateLedgerCsv;
const normalizeError_1 = require("../logic/errors/normalizeError");
const businessErrors_1 = require("../logic/errors/businessErrors");
function generateLedgerCsv(input) {
    if (!input.tenantId || !input.monthKey) {
        return (0, normalizeError_1.err)((0, businessErrors_1.createBusinessError)(businessErrors_1.BusinessErrorCode.MISSING_REQUIRED_FIELD, {
            message: "tenantId and monthKey are required",
        }));
    }
    const confirmedMatches = input.matches.filter((match) => match.status === "CONFIRMED");
    const bankTxToInvoices = buildBankTxMatchIndex(confirmedMatches);
    const invoiceToBankTx = buildInvoiceMatchIndex(confirmedMatches);
    const bankRows = [...input.bankTx]
        .filter((tx) => tx.currency === input.currency)
        .sort((a, b) => {
        const dateCompare = a.bookingDate.localeCompare(b.bookingDate);
        if (dateCompare !== 0)
            return dateCompare;
        return a.txId.localeCompare(b.txId);
    })
        .map((tx) => {
        var _a, _b;
        return ({
            recordType: "BANK_TX",
            recordId: tx.txId,
            date: tx.bookingDate,
            description: (_a = tx.descriptionRaw) !== null && _a !== void 0 ? _a : "",
            amountCents: tx.amountCents,
            currency: tx.currency,
            matchedIds: ((_b = bankTxToInvoices.get(tx.txId)) !== null && _b !== void 0 ? _b : []).join("|"),
        });
    });
    const invoiceRows = [...input.invoices]
        .filter((inv) => inv.currency === input.currency)
        .sort((a, b) => {
        const dateCompare = a.issueDate.localeCompare(b.issueDate);
        if (dateCompare !== 0)
            return dateCompare;
        return a.invoiceId.localeCompare(b.invoiceId);
    })
        .map((inv) => {
        var _a;
        return ({
            recordType: "INVOICE",
            recordId: inv.invoiceId,
            date: inv.issueDate,
            description: `${inv.supplierNameRaw} ${inv.invoiceNumber}`.trim(),
            amountCents: inv.totalGrossCents,
            currency: inv.currency,
            matchedIds: ((_a = invoiceToBankTx.get(inv.invoiceId)) !== null && _a !== void 0 ? _a : []).join("|"),
        });
    });
    const rows = [...bankRows, ...invoiceRows];
    if (rows.length === 0) {
        return (0, normalizeError_1.err)((0, businessErrors_1.createBusinessError)(businessErrors_1.BusinessErrorCode.NO_DATA_TO_EXPORT, {
            message: "No ledger rows available for export",
        }));
    }
    const header = [
        "recordType",
        "recordId",
        "date",
        "description",
        "amountCents",
        "currency",
        "matchedIds",
    ];
    const csvLines = [header.map(escapeCsv).join(",")];
    for (const row of rows) {
        csvLines.push([
            row.recordType,
            row.recordId,
            row.date,
            row.description,
            row.amountCents.toString(),
            row.currency,
            row.matchedIds,
        ]
            .map(escapeCsv)
            .join(","));
    }
    const filename = `ledger_${input.monthKey}_${input.tenantId}.csv`;
    return (0, normalizeError_1.ok)({
        filename,
        csvContent: csvLines.join("\n"),
        rowCount: rows.length,
    });
}
function buildBankTxMatchIndex(matches) {
    var _a;
    const map = new Map();
    for (const match of matches) {
        for (const txId of match.bankTxIds) {
            const current = (_a = map.get(txId)) !== null && _a !== void 0 ? _a : [];
            map.set(txId, [...current, ...match.invoiceIds].sort());
        }
    }
    return map;
}
function buildInvoiceMatchIndex(matches) {
    var _a;
    const map = new Map();
    for (const match of matches) {
        for (const invoiceId of match.invoiceIds) {
            const current = (_a = map.get(invoiceId)) !== null && _a !== void 0 ? _a : [];
            map.set(invoiceId, [...current, ...match.bankTxIds].sort());
        }
    }
    return map;
}
function escapeCsv(value) {
    if (value.includes(",") || value.includes("\n") || value.includes("\"")) {
        return `"${value.replace(/\"/g, '""')}"`;
    }
    return value;
}
//# sourceMappingURL=ledgerCsv.js.map