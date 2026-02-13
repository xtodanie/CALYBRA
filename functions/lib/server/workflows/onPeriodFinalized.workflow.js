"use strict";
/**
 * Period Finalized Workflow
 * Orchestration layer. Calls logic + persistence.
 * Idempotent with job records.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onPeriodFinalizedWorkflow = onPeriodFinalizedWorkflow;
const crypto_1 = __importDefault(require("crypto"));
const read_1 = require("../persistence/read");
const write_1 = require("../persistence/write");
const counterfactualClose_1 = require("../logic/counterfactual/counterfactualClose");
const ledgerSnapshot_1 = require("../logic/counterfactual/ledgerSnapshot");
const closeFrictionIndex_1 = require("../logic/metrics/closeFrictionIndex");
const vatSummary_1 = require("../logic/accounting/vatSummary");
const mismatchDetector_1 = require("../logic/accounting/mismatchDetector");
const monthCloseTimeline_1 = require("../readmodels/monthCloseTimeline");
const closeFriction_1 = require("../readmodels/closeFriction");
const vatSummary_2 = require("../readmodels/vatSummary");
const mismatchSummary_1 = require("../readmodels/mismatchSummary");
const auditorReplay_1 = require("../readmodels/auditorReplay");
const ledgerCsv_1 = require("../exports/ledgerCsv");
const summaryPdf_1 = require("../exports/summaryPdf");
const month_1 = require("../domain/dates/month");
const events_1 = require("../domain/events");
const brain_1 = require("../logic/brain");
const brainReplay_workflow_1 = require("./brainReplay.workflow");
const DEFAULT_AS_OF_DAYS = [5, 10, 20];
async function onPeriodFinalizedWorkflow(db, input) {
    var _a, _b, _c, _d, _e, _f;
    const ctx = { actorId: input.actorId, now: input.now };
    const period = await (0, read_1.readPeriod)(db, input.tenantId, input.monthKey);
    if (!period || period.status !== "FINALIZED") {
        return {
            success: false,
            code: "PERIOD_NOT_FINALIZED",
            message: "Period is not finalized or does not exist",
        };
    }
    const asOfDays = (_b = (_a = period.closeConfig) === null || _a === void 0 ? void 0 : _a.asOfDays) !== null && _b !== void 0 ? _b : DEFAULT_AS_OF_DAYS;
    const month = (0, month_1.parseMonth)(input.monthKey);
    const periodStart = (0, month_1.getMonthStart)(month);
    const periodEnd = (0, month_1.getMonthEnd)(month);
    const finalizedAt = (_c = period.finalizedAt) !== null && _c !== void 0 ? _c : input.now;
    const finalAsOfDate = timestampToDateKey(finalizedAt);
    const events = await (0, read_1.readEventsByMonth)(db, input.tenantId, input.monthKey);
    const typedEvents = events.map((event) => event);
    const periodLockHash = computePeriodLockHash({
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        periodEnd,
        asOfDays,
        events: typedEvents,
    });
    await (0, write_1.upsertPeriod)(db, ctx, {
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        status: "FINALIZED",
        finalizedAt,
        closeConfig: { asOfDays },
        periodLockHash,
    });
    const jobId = `periodFinalized:${input.tenantId}:${input.monthKey}:${periodLockHash}`;
    const existingJob = await (0, read_1.readJob)(db, jobId);
    if (existingJob && existingJob.status === "COMPLETED") {
        return {
            success: true,
            jobId,
            periodLockHash,
            exports: {
                ledgerCsv: `tenants/${input.tenantId}/exports/${input.monthKey}/artifacts/ledgerCsv`,
                summaryPdf: `tenants/${input.tenantId}/exports/${input.monthKey}/artifacts/summaryPdf`,
            },
        };
    }
    if (existingJob && existingJob.status === "RUNNING") {
        return {
            success: false,
            code: "JOB_IN_PROGRESS",
            message: "Period finalization job is already running",
        };
    }
    if (!existingJob) {
        await (0, write_1.createJob)(db, ctx, {
            id: jobId,
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            action: "periodFinalized",
            periodLockHash,
            status: "RUNNING",
        });
    }
    try {
        const timeline = (0, counterfactualClose_1.computeCounterfactualTimeline)({
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            periodStart,
            periodEnd,
            currency: input.currency,
            asOfDays,
            finalAsOfDate,
            events: typedEvents,
        });
        const dayForLateArrival = (_d = input.dayForLateArrival) !== null && _d !== void 0 ? _d : (asOfDays.length > 0 ? asOfDays[asOfDays.length - 1] : 5);
        const closeFriction = (0, closeFrictionIndex_1.computeCloseFrictionIndex)({
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            periodEnd,
            asOfDays,
            dayForLateArrival,
            events: typedEvents,
            timeline: timeline.entries,
        });
        const finalEvents = (0, events_1.sortEvents)(typedEvents);
        const finalSnapshot = (0, ledgerSnapshot_1.buildLedgerSnapshot)(finalEvents);
        const vatSummary = (0, vatSummary_1.computeVatSummary)(finalSnapshot.invoices.map((invoice) => ({
            invoiceId: invoice.invoiceId,
            totalGrossCents: invoice.totalGrossCents,
            vatRatePercent: invoice.vatRatePercent,
            currency: input.currency,
            direction: invoice.direction,
        })), input.currency);
        const mismatchSummary = (0, mismatchDetector_1.detectMismatches)(finalSnapshot.bankTx.map((tx) => {
            var _a;
            return ({
                txId: tx.txId,
                bookingDate: (_a = tx.bookingDate) !== null && _a !== void 0 ? _a : periodEnd,
                amountCents: tx.amountCents,
                currency: input.currency,
            });
        }), finalSnapshot.invoices.map((invoice) => {
            var _a;
            return ({
                invoiceId: invoice.invoiceId,
                issueDate: (_a = invoice.issueDate) !== null && _a !== void 0 ? _a : periodEnd,
                totalGrossCents: invoice.totalGrossCents,
                currency: input.currency,
            });
        }), finalSnapshot.matches.map((match) => ({
            matchId: match.matchId,
            status: match.status,
            bankTxIds: match.bankTxIds,
            invoiceIds: match.invoiceIds,
        })), input.currency);
        const generatedAtIso = input.now.toDate().toISOString();
        const timelineReadmodel = (0, monthCloseTimeline_1.buildMonthCloseTimelineReadModel)({
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            periodEnd,
            asOfDays: timeline.asOfDays,
            entries: timeline.entries,
            insights: timeline.insights,
            generatedAt: generatedAtIso,
            periodLockHash,
        });
        const closeFrictionReadmodel = (0, closeFriction_1.buildCloseFrictionReadModel)({
            result: closeFriction,
            periodEnd,
            dayForLateArrival,
            generatedAt: generatedAtIso,
            periodLockHash,
        });
        const vatSummaryReadmodel = (0, vatSummary_2.buildVatSummaryReadModel)({
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            summary: vatSummary,
            generatedAt: generatedAtIso,
            periodLockHash,
        });
        const mismatchReadmodel = (0, mismatchSummary_1.buildMismatchSummaryReadModel)({
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            summary: mismatchSummary,
            generatedAt: generatedAtIso,
            periodLockHash,
        });
        await (0, write_1.writeReadmodel)(db, input.tenantId, "monthCloseTimeline", input.monthKey, timelineReadmodel);
        await (0, write_1.writeReadmodel)(db, input.tenantId, "closeFriction", input.monthKey, closeFrictionReadmodel);
        await (0, write_1.writeReadmodel)(db, input.tenantId, "vatSummary", input.monthKey, vatSummaryReadmodel);
        await (0, write_1.writeReadmodel)(db, input.tenantId, "mismatchSummary", input.monthKey, mismatchReadmodel);
        const actorRole = resolveActorRole(input.actorId);
        const aclRead = (0, brain_1.evaluateMemoryAcl)({
            tenantId: input.tenantId,
            actorTenantId: input.tenantId,
            actorRole,
            action: "read-artifact",
        });
        if (!aclRead.allowed) {
            throw new Error(`memory ACL read denied: ${aclRead.reason}`);
        }
        const existingBrainArtifacts = await (0, read_1.readBrainArtifactsByMonth)(db, input.tenantId, input.monthKey);
        const priorEventLog = findLatestArtifactByType(existingBrainArtifacts, "event_log");
        const priorEvents = extractPriorEvents(priorEventLog);
        const priorSnapshots = extractPriorSnapshots(existingBrainArtifacts);
        const brainOutcome = (0, brainReplay_workflow_1.runBrainReplayWorkflow)({
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorRole,
            policyPath: "brain/read-only/period-finalize",
            traceId: `period-finalized:${input.monthKey}:${periodLockHash.slice(0, 12)}`,
            requestId: `brain:${input.tenantId}:${input.monthKey}:${periodLockHash.slice(0, 16)}`,
            timestamp: generatedAtIso,
            routerInput: {
                monthKey: input.monthKey,
                periodLockHash,
                openMismatchCount: mismatchSummary.bankTxWithoutInvoice.length +
                    mismatchSummary.invoiceMatchedWithoutBankTx.length +
                    mismatchSummary.partialPayments.length +
                    mismatchSummary.overpayments.length,
                closeFrictionIndex: closeFriction.closeFrictionScore / 100,
            },
            aiResponse: {
                tenantId: input.tenantId,
                contextHash: periodLockHash,
                model: "gpt-5.3-codex",
                generatedAt: generatedAtIso,
                suggestions: [
                    {
                        suggestionId: `s:${periodLockHash.slice(0, 12)}`,
                        code: closeFriction.closeFrictionScore < 50 ? "ESCALATE_CLOSE_FRICTION" : "OBSERVE_CLOSE_FRICTION",
                        summary: closeFriction.closeFrictionScore < 50
                            ? "Escalate high close friction for manual review"
                            : "Observe close friction trend and continue monitoring",
                        confidence: closeFriction.closeFrictionScore < 50 ? 0.88 : 0.74,
                        evidenceRefs: [periodLockHash],
                    },
                ],
                mutationIntent: "none",
                allowedActions: ["suggest", "explain", "escalate"],
            },
            reflectionIndicators: {
                anomalyRate: Math.min(1, mismatchSummary.bankTxWithoutInvoice.length / 10),
                efficiencyDelta: 1 - Math.min(1, closeFriction.closeFrictionScore / 100),
                behaviorShift: Math.min(1, mismatchSummary.partialPayments.length / 10),
            },
            snapshotPolicy: {
                interval: 2,
                maxRetained: 50,
            },
            priorEvents,
            priorSnapshots,
        });
        const healthIndex = (0, brain_1.computeIntelligenceHealthIndex)({
            predictionAccuracy: Math.max(0, 1 - Math.min(1, closeFriction.closeFrictionScore / 100)),
            roiDelta: Math.max(-1, Math.min(1, timeline.entries.length / 10)),
            driftRate: Math.min(1, mismatchSummary.overpayments.length / 10),
            falsePositiveRate: Math.min(1, mismatchSummary.partialPayments.length / 10),
            autonomyStability: brainOutcome.gate.accepted ? 0.9 : 0.4,
        });
        const artifacts = buildBrainArtifacts({
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            generatedAt: generatedAtIso,
            periodLockHash,
            brainOutcome,
            healthIndex,
        });
        const aclAppend = (0, brain_1.evaluateMemoryAcl)({
            tenantId: input.tenantId,
            actorTenantId: input.tenantId,
            actorRole,
            action: "append-artifact",
        });
        if (!aclAppend.allowed) {
            throw new Error(`memory ACL append denied: ${aclAppend.reason}`);
        }
        for (const artifact of artifacts) {
            const validation = (0, brain_1.validateBrainReplayArtifact)(artifact);
            if (!validation.valid) {
                throw new Error(`invalid brain artifact ${artifact.artifactId}: ${validation.errors.join("; ")}`);
            }
            await (0, write_1.appendBrainArtifact)(db, input.tenantId, artifact.artifactId, artifact);
        }
        emitDeterministicTelemetry({
            event: "brain_replay_executed",
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            periodLockHash,
            replayHash: brainOutcome.replay.replayHash,
            gateAccepted: brainOutcome.gate.accepted,
            healthIndex,
            artifactCount: artifacts.length,
            generatedAt: generatedAtIso,
        });
        await writeAuditorReplaySnapshots({
            db,
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            entries: timeline.entries,
            periodLockHash,
            generatedAt: generatedAtIso,
            events: typedEvents,
        });
        const exports = await writeExports({
            db,
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            periodLockHash,
            generatedAt: generatedAtIso,
            timelineEntries: timeline.entries,
            insights: timeline.insights,
            mismatchSummary,
            finalSnapshot,
            currency: input.currency,
            netVatCents: vatSummary.netVatCents,
        });
        await (0, write_1.updateJob)(db, ctx, jobId, {
            status: "COMPLETED",
            outputsRefs: exports,
        });
        logInfo({
            request_id: jobId,
            entity_id: input.tenantId,
            monthKey: input.monthKey,
            action: "periodFinalized",
            duration_ms: 0,
            outcome: "success",
            idempotency_key: jobId,
        });
        return {
            success: true,
            jobId,
            periodLockHash,
            exports: {
                ledgerCsv: (_e = exports.ledgerCsv) !== null && _e !== void 0 ? _e : "",
                summaryPdf: (_f = exports.summaryPdf) !== null && _f !== void 0 ? _f : "",
            },
        };
    }
    catch (error) {
        await (0, write_1.updateJob)(db, ctx, jobId, {
            status: "FAILED",
            errorCode: "PERIOD_FINALIZE_FAILED",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
        logInfo({
            request_id: jobId,
            entity_id: input.tenantId,
            monthKey: input.monthKey,
            action: "periodFinalized",
            duration_ms: 0,
            outcome: "error",
            error_code: "PERIOD_FINALIZE_FAILED",
            error_message: error instanceof Error ? error.message : "Unknown error",
            idempotency_key: jobId,
        });
        return {
            success: false,
            code: "PERIOD_FINALIZE_FAILED",
            message: "Failed to finalize period",
        };
    }
}
function resolveActorRole(actorId) {
    if (actorId === "system") {
        return "service";
    }
    return "controller";
}
function findLatestArtifactByType(artifacts, type) {
    const filtered = artifacts.filter((artifact) => artifact["type"] === type);
    return filtered[filtered.length - 1];
}
function extractPriorEvents(artifact) {
    if (!artifact)
        return [];
    const payload = artifact["payload"];
    if (!payload || typeof payload !== "object")
        return [];
    const events = payload["events"];
    return Array.isArray(events) ? events : [];
}
function extractPriorSnapshots(artifacts) {
    const snapshots = [];
    for (const artifact of artifacts) {
        if (artifact["type"] !== "snapshot")
            continue;
        const payload = artifact["payload"];
        if (!payload || typeof payload !== "object")
            continue;
        const snapshot = payload["snapshot"];
        if (!snapshot || typeof snapshot !== "object")
            continue;
        snapshots.push(snapshot);
    }
    return snapshots.sort((left, right) => left.atTimestamp.localeCompare(right.atTimestamp));
}
function buildBrainArtifacts(input) {
    const artifacts = [];
    const pushArtifact = (type, payload) => {
        const sanitizedPayload = sanitizeForFirestore(payload);
        const hash = (0, brain_1.stableSha256Hex)({
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            type,
            payload: sanitizedPayload,
            periodLockHash: input.periodLockHash,
        });
        artifacts.push({
            artifactId: `brain:${input.monthKey}:${type}:${hash.slice(0, 16)}`,
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            type,
            generatedAt: input.generatedAt,
            hash,
            schemaVersion: 1,
            payload: sanitizedPayload,
        });
    };
    pushArtifact("decision", {
        accepted: input.brainOutcome.accepted,
        intent: input.brainOutcome.intent,
        replayHash: input.brainOutcome.replay.replayHash,
    });
    pushArtifact("escalation", {
        escalationTriggered: !input.brainOutcome.gate.accepted || input.healthIndex < 0.5,
        reasons: input.brainOutcome.gate.reasons,
    });
    pushArtifact("health", {
        healthIndex: input.healthIndex,
        eventsApplied: input.brainOutcome.replay.eventsApplied,
    });
    pushArtifact("context_window", {
        contextWindow: input.brainOutcome.contextWindow,
    });
    pushArtifact("gate_audit", {
        accepted: input.brainOutcome.gate.accepted,
        reasons: input.brainOutcome.gate.reasons,
    });
    pushArtifact("event_log", {
        events: input.brainOutcome.events,
        replayHash: input.brainOutcome.replay.replayHash,
    });
    if (input.brainOutcome.snapshot) {
        pushArtifact("snapshot", {
            snapshot: input.brainOutcome.snapshot,
            retainedSnapshots: input.brainOutcome.snapshots,
        });
    }
    return artifacts;
}
function sanitizeForFirestore(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => sanitizeForFirestore(entry));
    }
    if (!value || typeof value !== "object") {
        return value;
    }
    const record = value;
    const out = {};
    for (const [key, entry] of Object.entries(record)) {
        if (entry === undefined) {
            continue;
        }
        out[key] = sanitizeForFirestore(entry);
    }
    return out;
}
function emitDeterministicTelemetry(payload) {
    try {
        console.log(JSON.stringify(Object.assign({ telemetry: "brain" }, payload)));
    }
    catch (_a) {
        // non-blocking telemetry bridge
    }
}
async function writeAuditorReplaySnapshots(input) {
    for (const entry of input.entries) {
        const cutoff = entry.asOfDate;
        const snapshotEvents = input.events.filter((event) => event.occurredAt.slice(0, 10) <= cutoff);
        const snapshot = (0, ledgerSnapshot_1.buildLedgerSnapshot)(snapshotEvents);
        const readmodel = (0, auditorReplay_1.buildAuditorReplaySnapshot)({
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            asOfDateKey: cutoff,
            bankTx: snapshot.bankTx,
            invoices: snapshot.invoices,
            matches: snapshot.matches,
            adjustments: snapshot.adjustments,
            generatedAt: input.generatedAt,
            periodLockHash: input.periodLockHash,
        });
        await (0, write_1.writeAuditorReplaySnapshot)(input.db, input.tenantId, input.monthKey, cutoff, readmodel);
    }
}
async function writeExports(input) {
    var _a, _b, _c, _d;
    const outputs = {};
    const existingLedger = await (0, read_1.readExportArtifact)(input.db, input.tenantId, input.monthKey, "ledgerCsv");
    const existingLedgerHash = existingLedger && typeof existingLedger.periodLockHash === "string"
        ? existingLedger.periodLockHash
        : null;
    if (!existingLedger || existingLedgerHash !== input.periodLockHash) {
        const ledgerResult = (0, ledgerCsv_1.generateLedgerCsv)({
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            currency: input.currency,
            bankTx: input.finalSnapshot.bankTx.map((tx) => {
                var _a, _b;
                return ({
                    txId: tx.txId,
                    bookingDate: (_a = tx.bookingDate) !== null && _a !== void 0 ? _a : input.monthKey + "-01",
                    amountCents: tx.amountCents,
                    currency: input.currency,
                    descriptionRaw: (_b = tx.descriptionRaw) !== null && _b !== void 0 ? _b : "",
                });
            }),
            invoices: input.finalSnapshot.invoices.map((inv) => {
                var _a, _b, _c;
                return ({
                    invoiceId: inv.invoiceId,
                    issueDate: (_a = inv.issueDate) !== null && _a !== void 0 ? _a : input.monthKey + "-01",
                    invoiceNumber: (_b = inv.invoiceNumber) !== null && _b !== void 0 ? _b : inv.invoiceId,
                    supplierNameRaw: (_c = inv.supplierNameRaw) !== null && _c !== void 0 ? _c : "",
                    totalGrossCents: inv.totalGrossCents,
                    currency: input.currency,
                });
            }),
            matches: input.finalSnapshot.matches.map((match) => ({
                matchId: match.matchId,
                status: match.status,
                bankTxIds: match.bankTxIds,
                invoiceIds: match.invoiceIds,
            })),
            generatedAt: input.generatedAt,
        });
        if (!ledgerResult.success) {
            throw new Error(ledgerResult.error.message);
        }
        const contentHash = hashContent(ledgerResult.value.csvContent);
        await (0, write_1.writeExportArtifact)(input.db, input.tenantId, input.monthKey, "ledgerCsv", {
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            periodLockHash: input.periodLockHash,
            contentHash,
            contentType: "text/csv",
            filename: ledgerResult.value.filename,
            content: ledgerResult.value.csvContent,
            generatedAt: input.generatedAt,
            schemaVersion: 1,
        });
    }
    const existingPdf = await (0, read_1.readExportArtifact)(input.db, input.tenantId, input.monthKey, "summaryPdf");
    const existingPdfHash = existingPdf && typeof existingPdf.periodLockHash === "string"
        ? existingPdf.periodLockHash
        : null;
    if (!existingPdf || existingPdfHash !== input.periodLockHash) {
        const finalEntry = input.timelineEntries[input.timelineEntries.length - 1];
        const summaryResult = (0, summaryPdf_1.generateSummaryPdf)({
            tenantId: input.tenantId,
            tenantName: input.tenantId,
            monthKey: input.monthKey,
            currency: input.currency,
            revenueCents: (_a = finalEntry === null || finalEntry === void 0 ? void 0 : finalEntry.revenueCents) !== null && _a !== void 0 ? _a : 0,
            expenseCents: (_b = finalEntry === null || finalEntry === void 0 ? void 0 : finalEntry.expenseCents) !== null && _b !== void 0 ? _b : 0,
            vatCents: (_c = finalEntry === null || finalEntry === void 0 ? void 0 : finalEntry.vatCents) !== null && _c !== void 0 ? _c : 0,
            netVatCents: input.netVatCents,
            unmatchedCount: (_d = finalEntry === null || finalEntry === void 0 ? void 0 : finalEntry.unmatchedTotalCount) !== null && _d !== void 0 ? _d : 0,
            mismatchBankTxCount: input.mismatchSummary.bankTxWithoutInvoice.length,
            mismatchInvoiceCount: input.mismatchSummary.invoiceMatchedWithoutBankTx.length +
                input.mismatchSummary.partialPayments.length +
                input.mismatchSummary.overpayments.length,
            finalAccuracyStatement: safeInsight(input.insights, 0),
            varianceResolvedStatement: safeInsight(input.insights, 1),
            generatedAt: input.generatedAt,
        });
        if (!summaryResult.success) {
            throw new Error(summaryResult.error.message);
        }
        const contentHash = hashContent(summaryResult.value.content);
        await (0, write_1.writeExportArtifact)(input.db, input.tenantId, input.monthKey, "summaryPdf", {
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            periodLockHash: input.periodLockHash,
            contentHash,
            contentType: "application/pdf",
            filename: summaryResult.value.filename,
            contentBase64: Buffer.from(summaryResult.value.content).toString("base64"),
            generatedAt: input.generatedAt,
            schemaVersion: 1,
        });
    }
    outputs.ledgerCsv = `tenants/${input.tenantId}/exports/${input.monthKey}/artifacts/ledgerCsv`;
    outputs.summaryPdf = `tenants/${input.tenantId}/exports/${input.monthKey}/artifacts/summaryPdf`;
    return outputs;
}
function safeInsight(insights, index) {
    if (insights[index])
        return insights[index];
    return index === 0
        ? "Final accuracy was reached on Day 0."
        : "100% of variance resolved in the last 0 days.";
}
function computePeriodLockHash(input) {
    const payload = {
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        periodEnd: input.periodEnd,
        asOfDays: [...input.asOfDays].sort((a, b) => a - b),
        events: (0, events_1.sortEvents)(input.events).map((event) => ({
            id: event.id,
            type: event.type,
            occurredAt: event.occurredAt,
            recordedAt: event.recordedAt,
            monthKey: event.monthKey,
            deterministicId: event.deterministicId,
            payload: event.payload,
        })),
    };
    const serialized = stableStringify(payload);
    return crypto_1.default.createHash("sha256").update(serialized).digest("hex");
}
function stableStringify(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
        .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
        .join(",")}}`;
}
function timestampToDateKey(timestamp) {
    return timestamp.toDate().toISOString().slice(0, 10);
}
function hashContent(content) {
    if (typeof content === "string") {
        return crypto_1.default.createHash("sha256").update(content).digest("hex");
    }
    return crypto_1.default.createHash("sha256").update(Buffer.from(content)).digest("hex");
}
function logInfo(payload) {
    console.log(JSON.stringify(payload));
}
//# sourceMappingURL=onPeriodFinalized.workflow.js.map