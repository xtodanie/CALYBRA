"use strict";
/**
 * Persistence - Read Operations
 * IO layer. All Firestore reads live here.
 *
 * INVARIANT: This module is the ONLY place that reads from Firestore
 * INVARIANT: Returns typed domain objects, never raw Firestore data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.readMonthClose = readMonthClose;
exports.readMonthCloses = readMonthCloses;
exports.readFileAsset = readFileAsset;
exports.readFileAssetsByMonthClose = readFileAssetsByMonthClose;
exports.readBankTx = readBankTx;
exports.readBankTxByMonthClose = readBankTxByMonthClose;
exports.readInvoice = readInvoice;
exports.readInvoicesByMonthClose = readInvoicesByMonthClose;
exports.readMatch = readMatch;
exports.readMatchesByMonthClose = readMatchesByMonthClose;
exports.readEventsByMonth = readEventsByMonth;
exports.readPeriod = readPeriod;
exports.readJob = readJob;
exports.readExportArtifact = readExportArtifact;
exports.readBrainArtifactsByMonth = readBrainArtifactsByMonth;
exports.readConfirmedMatches = readConfirmedMatches;
exports.readUser = readUser;
exports.findBankTxByFingerprint = findBankTxByFingerprint;
exports.readTenantIds = readTenantIds;
exports.readReadmodelSnapshot = readReadmodelSnapshot;
exports.readReadmodelItem = readReadmodelItem;
// ============================================================================
// READ OPERATIONS
// ============================================================================
/**
 * Reads a MonthClose by ID
 */
async function readMonthClose(db, tenantId, monthCloseId) {
    const doc = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("monthCloses")
        .doc(monthCloseId)
        .get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}
/**
 * Reads all MonthCloses for a tenant
 */
async function readMonthCloses(db, tenantId) {
    const snapshot = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("monthCloses")
        .get();
    return snapshot.docs.map((doc) => doc.data());
}
/**
 * Reads a FileAsset by ID
 */
async function readFileAsset(db, tenantId, fileAssetId) {
    const doc = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("fileAssets")
        .doc(fileAssetId)
        .get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}
/**
 * Reads all FileAssets for a MonthClose
 */
async function readFileAssetsByMonthClose(db, tenantId, monthCloseId) {
    const snapshot = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("fileAssets")
        .where("monthCloseId", "==", monthCloseId)
        .get();
    return snapshot.docs.map((doc) => doc.data());
}
/**
 * Reads a BankTx by ID
 */
async function readBankTx(db, tenantId, bankTxId) {
    const doc = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("bankTx")
        .doc(bankTxId)
        .get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}
/**
 * Reads all BankTx for a MonthClose
 */
async function readBankTxByMonthClose(db, tenantId, monthCloseId) {
    const snapshot = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("bankTx")
        .where("monthCloseId", "==", monthCloseId)
        .get();
    return snapshot.docs.map((doc) => doc.data());
}
/**
 * Reads an Invoice by ID
 */
async function readInvoice(db, tenantId, invoiceId) {
    const doc = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("invoices")
        .doc(invoiceId)
        .get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}
/**
 * Reads all Invoices for a MonthClose
 */
async function readInvoicesByMonthClose(db, tenantId, monthCloseId) {
    const snapshot = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("invoices")
        .where("monthCloseId", "==", monthCloseId)
        .get();
    return snapshot.docs.map((doc) => doc.data());
}
/**
 * Reads a Match by ID
 */
async function readMatch(db, tenantId, matchId) {
    const doc = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("matches")
        .doc(matchId)
        .get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}
/**
 * Reads all Matches for a MonthClose
 */
async function readMatchesByMonthClose(db, tenantId, monthCloseId) {
    const snapshot = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("matches")
        .where("monthCloseId", "==", monthCloseId)
        .get();
    return snapshot.docs.map((doc) => doc.data());
}
/**
 * Reads events by monthKey
 */
async function readEventsByMonth(db, tenantId, monthKey) {
    const snapshot = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("events")
        .where("monthKey", "==", monthKey)
        .get();
    return snapshot.docs.map((doc) => doc.data());
}
/**
 * Reads a period by monthKey
 */
async function readPeriod(db, tenantId, monthKey) {
    const doc = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("periods")
        .doc(monthKey)
        .get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}
/**
 * Reads a job record by ID
 */
async function readJob(db, jobId) {
    const doc = await db.collection("jobs").doc(jobId).get();
    if (!doc.exists)
        return null;
    return doc.data();
}
/**
 * Reads an export artifact
 */
async function readExportArtifact(db, tenantId, monthKey, artifactId) {
    const doc = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("exports")
        .doc(monthKey)
        .collection("artifacts")
        .doc(artifactId)
        .get();
    if (!doc.exists)
        return null;
    return doc.data();
}
/**
 * Reads persisted brain artifacts for a month
 */
async function readBrainArtifactsByMonth(db, tenantId, monthKey) {
    const snapshot = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("readmodels")
        .doc("brainArtifacts")
        .collection("items")
        .get();
    return snapshot.docs
        .map((doc) => doc.data())
        .filter((item) => item["monthKey"] === monthKey)
        .sort((left, right) => {
        const leftAt = typeof left["generatedAt"] === "string" ? left["generatedAt"] : "";
        const rightAt = typeof right["generatedAt"] === "string" ? right["generatedAt"] : "";
        return leftAt.localeCompare(rightAt);
    });
}
/**
 * Reads confirmed Matches for a MonthClose (for exclusion checks)
 */
async function readConfirmedMatches(db, tenantId, monthCloseId) {
    const snapshot = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("matches")
        .where("monthCloseId", "==", monthCloseId)
        .where("status", "==", "CONFIRMED")
        .get();
    return snapshot.docs.map((doc) => doc.data());
}
/**
 * Reads a User by UID
 */
async function readUser(db, uid) {
    const doc = await db.collection("users").doc(uid).get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}
/**
 * Checks if a BankTx with the same fingerprint already exists
 */
async function findBankTxByFingerprint(db, tenantId, monthCloseId, fingerprint) {
    const snapshot = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("bankTx")
        .where("monthCloseId", "==", monthCloseId)
        .where("fingerprint", "==", fingerprint)
        .limit(1)
        .get();
    if (snapshot.empty) {
        return null;
    }
    return snapshot.docs[0].data();
}
/**
 * Lists all tenant IDs
 */
async function readTenantIds(db) {
    const snapshot = await db.collection("tenants").get();
    return snapshot.docs.map((doc) => doc.id).sort((a, b) => a.localeCompare(b));
}
/**
 * Reads a readmodel snapshot at: tenants/{tenantId}/readmodels/{modelName}/{docId}/snapshot
 */
async function readReadmodelSnapshot(db, tenantId, modelName, docId) {
    const doc = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("readmodels")
        .doc(modelName)
        .collection(docId)
        .doc("snapshot")
        .get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}
/**
 * Reads a readmodel item at: tenants/{tenantId}/readmodels/{modelName}/items/{itemId}
 */
async function readReadmodelItem(db, tenantId, modelName, itemId) {
    const doc = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("readmodels")
        .doc(modelName)
        .collection("items")
        .doc(itemId)
        .get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}
//# sourceMappingURL=read.js.map