"use strict";
/**
 * Persistence - Write Operations
 * IO layer. All Firestore writes live here.
 *
 * INVARIANT: This module is the ONLY place that writes to Firestore
 * INVARIANT: All writes use server timestamps for consistency
 * INVARIANT: All writes include actor ID for audit trail
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMonthClose = createMonthClose;
exports.updateMonthClose = updateMonthClose;
exports.createFileAsset = createFileAsset;
exports.updateFileAsset = updateFileAsset;
exports.createBankTx = createBankTx;
exports.createBankTxBatch = createBankTxBatch;
exports.createInvoice = createInvoice;
exports.createInvoiceBatch = createInvoiceBatch;
exports.createMatch = createMatch;
exports.createMatchBatch = createMatchBatch;
exports.updateMatch = updateMatch;
exports.createEvent = createEvent;
exports.upsertPeriod = upsertPeriod;
exports.writeReadmodel = writeReadmodel;
exports.writeReadmodelDoc = writeReadmodelDoc;
exports.mergeReadmodelDoc = mergeReadmodelDoc;
exports.appendBrainArtifact = appendBrainArtifact;
exports.writeAuditorReplaySnapshot = writeAuditorReplaySnapshot;
exports.writeExportArtifact = writeExportArtifact;
exports.createJob = createJob;
exports.updateJob = updateJob;
async function createMonthClose(db, ctx, input) {
    const doc = Object.assign(Object.assign({}, input), { createdBy: ctx.actorId, createdAt: ctx.now, updatedAt: ctx.now, updatedBy: ctx.actorId, schemaVersion: 1 });
    await db
        .collection("tenants")
        .doc(input.tenantId)
        .collection("monthCloses")
        .doc(input.id)
        .set(doc);
}
async function updateMonthClose(db, ctx, tenantId, monthCloseId, input) {
    const updates = Object.assign(Object.assign({}, input), { updatedAt: ctx.now, updatedBy: ctx.actorId });
    // Remove undefined values
    for (const key of Object.keys(updates)) {
        if (updates[key] === undefined) {
            delete updates[key];
        }
    }
    await db
        .collection("tenants")
        .doc(tenantId)
        .collection("monthCloses")
        .doc(monthCloseId)
        .update(updates);
}
async function createFileAsset(db, ctx, input) {
    const doc = Object.assign(Object.assign({}, input), { createdAt: ctx.now, updatedAt: ctx.now, schemaVersion: 1 });
    await db
        .collection("tenants")
        .doc(input.tenantId)
        .collection("fileAssets")
        .doc(input.id)
        .set(doc);
}
async function updateFileAsset(db, ctx, tenantId, fileAssetId, input) {
    const updates = Object.assign(Object.assign({}, input), { updatedAt: ctx.now });
    // Remove undefined values
    for (const key of Object.keys(updates)) {
        if (updates[key] === undefined) {
            delete updates[key];
        }
    }
    await db
        .collection("tenants")
        .doc(tenantId)
        .collection("fileAssets")
        .doc(fileAssetId)
        .update(updates);
}
async function createBankTx(db, ctx, input) {
    const doc = Object.assign(Object.assign({}, input), { createdAt: ctx.now, updatedAt: ctx.now, createdBy: ctx.actorId, updatedBy: ctx.actorId, schemaVersion: 1 });
    await db
        .collection("tenants")
        .doc(input.tenantId)
        .collection("bankTx")
        .doc(input.id)
        .set(doc);
}
async function createBankTxBatch(db, ctx, items) {
    const batch = db.batch();
    for (const input of items) {
        const doc = Object.assign(Object.assign({}, input), { createdAt: ctx.now, updatedAt: ctx.now, createdBy: ctx.actorId, updatedBy: ctx.actorId, schemaVersion: 1 });
        const ref = db
            .collection("tenants")
            .doc(input.tenantId)
            .collection("bankTx")
            .doc(input.id);
        batch.set(ref, doc);
    }
    await batch.commit();
}
async function createInvoice(db, ctx, input) {
    const doc = Object.assign(Object.assign({}, input), { createdAt: ctx.now, updatedAt: ctx.now, createdBy: ctx.actorId, updatedBy: ctx.actorId, schemaVersion: 1 });
    await db
        .collection("tenants")
        .doc(input.tenantId)
        .collection("invoices")
        .doc(input.id)
        .set(doc);
}
async function createInvoiceBatch(db, ctx, items) {
    const batch = db.batch();
    for (const input of items) {
        const doc = Object.assign(Object.assign({}, input), { createdAt: ctx.now, updatedAt: ctx.now, createdBy: ctx.actorId, updatedBy: ctx.actorId, schemaVersion: 1 });
        const ref = db
            .collection("tenants")
            .doc(input.tenantId)
            .collection("invoices")
            .doc(input.id);
        batch.set(ref, doc);
    }
    await batch.commit();
}
async function createMatch(db, ctx, input) {
    const doc = Object.assign(Object.assign({}, input), { createdAt: ctx.now, updatedAt: ctx.now, createdBy: ctx.actorId, updatedBy: ctx.actorId, schemaVersion: 1 });
    await db
        .collection("tenants")
        .doc(input.tenantId)
        .collection("matches")
        .doc(input.id)
        .set(doc);
}
async function createMatchBatch(db, ctx, items) {
    const batch = db.batch();
    for (const input of items) {
        const doc = Object.assign(Object.assign({}, input), { createdAt: ctx.now, updatedAt: ctx.now, createdBy: ctx.actorId, updatedBy: ctx.actorId, schemaVersion: 1 });
        const ref = db
            .collection("tenants")
            .doc(input.tenantId)
            .collection("matches")
            .doc(input.id);
        batch.set(ref, doc);
    }
    await batch.commit();
}
async function updateMatch(db, ctx, tenantId, matchId, input) {
    const updates = Object.assign(Object.assign({}, input), { updatedAt: ctx.now, updatedBy: ctx.actorId });
    // Remove undefined values
    for (const key of Object.keys(updates)) {
        if (updates[key] === undefined) {
            delete updates[key];
        }
    }
    await db
        .collection("tenants")
        .doc(tenantId)
        .collection("matches")
        .doc(matchId)
        .update(updates);
}
async function createEvent(db, ctx, input) {
    const doc = Object.assign(Object.assign({}, input), { schemaVersion: 1, createdAt: ctx.now, createdBy: ctx.actorId, updatedAt: ctx.now, updatedBy: ctx.actorId });
    await db
        .collection("tenants")
        .doc(input.tenantId)
        .collection("events")
        .doc(input.id)
        .create(doc);
}
async function upsertPeriod(db, ctx, input) {
    const doc = {
        id: input.monthKey,
        tenantId: input.tenantId,
        status: input.status,
        finalizedAt: input.finalizedAt,
        closeConfig: input.closeConfig,
        periodLockHash: input.periodLockHash,
        createdAt: ctx.now,
        createdBy: ctx.actorId,
        updatedAt: ctx.now,
        updatedBy: ctx.actorId,
        schemaVersion: 1,
    };
    await db
        .collection("tenants")
        .doc(input.tenantId)
        .collection("periods")
        .doc(input.monthKey)
        .set(doc, { merge: true });
}
// ============================================================================
// READMODEL WRITES
// ============================================================================
async function writeReadmodel(db, tenantId, modelName, docId, data) {
    await db
        .collection("tenants")
        .doc(tenantId)
        .collection("readmodels")
        .doc(modelName)
        .collection(docId)
        .doc("snapshot")
        .set(data);
}
async function writeReadmodelDoc(db, tenantId, modelName, docId, data) {
    await db
        .collection("tenants")
        .doc(tenantId)
        .collection("readmodels")
        .doc(modelName)
        .collection("items")
        .doc(docId)
        .set(data);
}
async function mergeReadmodelDoc(db, tenantId, modelName, docId, data) {
    await db
        .collection("tenants")
        .doc(tenantId)
        .collection("readmodels")
        .doc(modelName)
        .collection("items")
        .doc(docId)
        .set(data, { merge: true });
}
async function appendBrainArtifact(db, tenantId, artifactId, data) {
    const ref = db
        .collection("tenants")
        .doc(tenantId)
        .collection("readmodels")
        .doc("brainArtifacts")
        .collection("items")
        .doc(artifactId);
    const existing = await ref.get();
    if (existing.exists) {
        return { created: false };
    }
    await ref.create(data);
    return { created: true };
}
async function writeAuditorReplaySnapshot(db, tenantId, monthKey, asOfDateKey, data) {
    await db
        .collection("tenants")
        .doc(tenantId)
        .collection("readmodels")
        .doc("auditorReplay")
        .collection(monthKey)
        .doc(asOfDateKey)
        .set(data);
}
// ============================================================================
// EXPORT WRITES
// ============================================================================
async function writeExportArtifact(db, tenantId, monthKey, artifactId, data) {
    await db
        .collection("tenants")
        .doc(tenantId)
        .collection("exports")
        .doc(monthKey)
        .collection("artifacts")
        .doc(artifactId)
        .set(data);
}
async function createJob(db, ctx, input) {
    const doc = {
        id: input.id,
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        action: input.action,
        status: input.status,
        periodLockHash: input.periodLockHash,
        startedAt: ctx.now,
        completedAt: input.status === "COMPLETED" ? ctx.now : undefined,
        outputsRefs: input.outputsRefs,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        schemaVersion: 1,
    };
    for (const key of Object.keys(doc)) {
        if (doc[key] === undefined) {
            delete doc[key];
        }
    }
    await db.collection("jobs").doc(input.id).set(doc);
}
async function updateJob(db, ctx, jobId, input) {
    const updates = Object.assign(Object.assign({}, input), { completedAt: input.status === "COMPLETED" ? ctx.now : undefined, updatedAt: ctx.now });
    for (const key of Object.keys(updates)) {
        if (updates[key] === undefined) {
            delete updates[key];
        }
    }
    await db.collection("jobs").doc(jobId).update(updates);
}
//# sourceMappingURL=write.js.map