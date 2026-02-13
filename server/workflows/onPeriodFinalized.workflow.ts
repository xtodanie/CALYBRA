/**
 * Period Finalized Workflow
 * Orchestration layer. Calls logic + persistence.
 * Idempotent with job records.
 */

import { Firestore, Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";
import {
  readEventsByMonth,
  readBrainArtifactsByMonth,
  readJob,
  readPeriod,
  readExportArtifact,
} from "../persistence/read";
import {
  appendBrainArtifact,
  createJob,
  updateJob,
  upsertPeriod,
  writeReadmodel,
  writeAuditorReplaySnapshot,
  writeExportArtifact,
} from "../persistence/write";
import {
  computeCounterfactualTimeline,
  CounterfactualTimelineEntry,
} from "../logic/counterfactual/counterfactualClose";
import { buildLedgerSnapshot } from "../logic/counterfactual/ledgerSnapshot";
import { computeCloseFrictionIndex } from "../logic/metrics/closeFrictionIndex";
import { computeVatSummary } from "../logic/accounting/vatSummary";
import { detectMismatches } from "../logic/accounting/mismatchDetector";
import {
  buildMonthCloseTimelineReadModel,
} from "../readmodels/monthCloseTimeline";
import { buildCloseFrictionReadModel } from "../readmodels/closeFriction";
import { buildVatSummaryReadModel } from "../readmodels/vatSummary";
import { buildMismatchSummaryReadModel } from "../readmodels/mismatchSummary";
import { buildAuditorReplaySnapshot } from "../readmodels/auditorReplay";
import { generateLedgerCsv } from "../exports/ledgerCsv";
import { generateSummaryPdf } from "../exports/summaryPdf";
import { parseMonth, getMonthStart, getMonthEnd } from "../domain/dates/month";
import { CurrencyCode } from "../domain/money";
import { Event, sortEvents } from "../domain/events";
import { WriteContext } from "../persistence/write";
import {
  BrainReplayArtifact,
  BrainSnapshot,
  CanonicalEventEnvelope,
  computeIntelligenceHealthIndex,
  evaluateMemoryAcl,
  stableSha256Hex,
  validateBrainReplayArtifact,
} from "../logic/brain";
import { BrainReplayState, runBrainReplayWorkflow } from "./brainReplay.workflow";

export interface PeriodFinalizedInput {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly actorId: string;
  readonly now: Timestamp;
  readonly currency: CurrencyCode;
  readonly dayForLateArrival?: number;
}

export interface PeriodFinalizedResult {
  readonly success: true;
  readonly jobId: string;
  readonly periodLockHash: string;
  readonly exports: {
    readonly ledgerCsv: string;
    readonly summaryPdf: string;
  };
}

export interface PeriodFinalizedError {
  readonly success: false;
  readonly code: string;
  readonly message: string;
}

export type PeriodFinalizedOutcome = PeriodFinalizedResult | PeriodFinalizedError;

const DEFAULT_AS_OF_DAYS = [5, 10, 20];

export async function onPeriodFinalizedWorkflow(
  db: Firestore,
  input: PeriodFinalizedInput
): Promise<PeriodFinalizedOutcome> {
  const ctx: WriteContext = { actorId: input.actorId, now: input.now };
  const period = await readPeriod(db, input.tenantId, input.monthKey);

  if (!period || period.status !== "FINALIZED") {
    return {
      success: false,
      code: "PERIOD_NOT_FINALIZED",
      message: "Period is not finalized or does not exist",
    };
  }

  const asOfDays = period.closeConfig?.asOfDays ?? DEFAULT_AS_OF_DAYS;
  const month = parseMonth(input.monthKey);
  const periodStart = getMonthStart(month);
  const periodEnd = getMonthEnd(month);
  const finalizedAt = period.finalizedAt ?? input.now;
  const finalAsOfDate = timestampToDateKey(finalizedAt);

  const events = await readEventsByMonth(db, input.tenantId, input.monthKey);
  const typedEvents = events.map((event) => event as unknown as Event);
  const periodLockHash = computePeriodLockHash({
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    periodEnd,
    asOfDays,
    events: typedEvents,
  });

  await upsertPeriod(db, ctx, {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    status: "FINALIZED",
    finalizedAt,
    closeConfig: { asOfDays },
    periodLockHash,
  });

  const jobId = `periodFinalized:${input.tenantId}:${input.monthKey}:${periodLockHash}`;
  const existingJob = await readJob(db, jobId);
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
    await createJob(db, ctx, {
      id: jobId,
      tenantId: input.tenantId,
      monthKey: input.monthKey,
      action: "periodFinalized",
      periodLockHash,
      status: "RUNNING",
    });
  }

  try {
    const timeline = computeCounterfactualTimeline({
      tenantId: input.tenantId,
      monthKey: input.monthKey,
      periodStart,
      periodEnd,
      currency: input.currency,
      asOfDays,
      finalAsOfDate,
      events: typedEvents,
    });

    const dayForLateArrival =
      input.dayForLateArrival ?? (asOfDays.length > 0 ? asOfDays[asOfDays.length - 1] : 5);

    const closeFriction = computeCloseFrictionIndex({
      tenantId: input.tenantId,
      monthKey: input.monthKey,
      periodEnd,
      asOfDays,
      dayForLateArrival,
      events: typedEvents,
      timeline: timeline.entries,
    });

    const finalEvents = sortEvents(typedEvents);
    const finalSnapshot = buildLedgerSnapshot(finalEvents);

    const vatSummary = computeVatSummary(
      finalSnapshot.invoices.map((invoice) => ({
        invoiceId: invoice.invoiceId,
        totalGrossCents: invoice.totalGrossCents,
        vatRatePercent: invoice.vatRatePercent,
        currency: input.currency,
        direction: invoice.direction,
      })),
      input.currency
    );

    const mismatchSummary = detectMismatches(
      finalSnapshot.bankTx.map((tx) => ({
        txId: tx.txId,
        bookingDate: tx.bookingDate ?? periodEnd,
        amountCents: tx.amountCents,
        currency: input.currency,
      })),
      finalSnapshot.invoices.map((invoice) => ({
        invoiceId: invoice.invoiceId,
        issueDate: invoice.issueDate ?? periodEnd,
        totalGrossCents: invoice.totalGrossCents,
        currency: input.currency,
      })),
      finalSnapshot.matches.map((match) => ({
        matchId: match.matchId,
        status: match.status,
        bankTxIds: match.bankTxIds,
        invoiceIds: match.invoiceIds,
      })),
      input.currency
    );

    const generatedAtIso = input.now.toDate().toISOString();

    const timelineReadmodel = buildMonthCloseTimelineReadModel({
      tenantId: input.tenantId,
      monthKey: input.monthKey,
      periodEnd,
      asOfDays: timeline.asOfDays,
      entries: timeline.entries,
      insights: timeline.insights,
      generatedAt: generatedAtIso,
      periodLockHash,
    });

    const closeFrictionReadmodel = buildCloseFrictionReadModel({
      result: closeFriction,
      periodEnd,
      dayForLateArrival,
      generatedAt: generatedAtIso,
      periodLockHash,
    });

    const vatSummaryReadmodel = buildVatSummaryReadModel({
      tenantId: input.tenantId,
      monthKey: input.monthKey,
      summary: vatSummary,
      generatedAt: generatedAtIso,
      periodLockHash,
    });

    const mismatchReadmodel = buildMismatchSummaryReadModel({
      tenantId: input.tenantId,
      monthKey: input.monthKey,
      summary: mismatchSummary,
      generatedAt: generatedAtIso,
      periodLockHash,
    });

    await writeReadmodel(db, input.tenantId, "monthCloseTimeline", input.monthKey, timelineReadmodel);
    await writeReadmodel(db, input.tenantId, "closeFriction", input.monthKey, closeFrictionReadmodel);
    await writeReadmodel(db, input.tenantId, "vatSummary", input.monthKey, vatSummaryReadmodel);
    await writeReadmodel(db, input.tenantId, "mismatchSummary", input.monthKey, mismatchReadmodel);

    const actorRole = resolveActorRole(input.actorId);
    const aclRead = evaluateMemoryAcl({
      tenantId: input.tenantId,
      actorTenantId: input.tenantId,
      actorRole,
      action: "read-artifact",
    });
    if (!aclRead.allowed) {
      throw new Error(`memory ACL read denied: ${aclRead.reason}`);
    }

    const existingBrainArtifacts = await readBrainArtifactsByMonth(db, input.tenantId, input.monthKey);
    const priorEventLog = findLatestArtifactByType(existingBrainArtifacts, "event_log");
    const priorEvents = extractPriorEvents(priorEventLog);
    const priorSnapshots = extractPriorSnapshots(existingBrainArtifacts);

    const brainOutcome = runBrainReplayWorkflow({
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
        openMismatchCount:
          mismatchSummary.bankTxWithoutInvoice.length +
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

    const healthIndex = computeIntelligenceHealthIndex({
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

    const aclAppend = evaluateMemoryAcl({
      tenantId: input.tenantId,
      actorTenantId: input.tenantId,
      actorRole,
      action: "append-artifact",
    });
    if (!aclAppend.allowed) {
      throw new Error(`memory ACL append denied: ${aclAppend.reason}`);
    }

    for (const artifact of artifacts) {
      const validation = validateBrainReplayArtifact(artifact);
      if (!validation.valid) {
        throw new Error(`invalid brain artifact ${artifact.artifactId}: ${validation.errors.join("; ")}`);
      }
      await appendBrainArtifact(db, input.tenantId, artifact.artifactId, artifact);
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

    await updateJob(db, ctx, jobId, {
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
        ledgerCsv: exports.ledgerCsv ?? "",
        summaryPdf: exports.summaryPdf ?? "",
      },
    };
  } catch (error) {
    await updateJob(db, ctx, jobId, {
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

function resolveActorRole(actorId: string): string {
  if (actorId === "system") {
    return "service";
  }
  return "controller";
}

function findLatestArtifactByType(
  artifacts: readonly Record<string, unknown>[],
  type: string,
): Record<string, unknown> | undefined {
  const filtered = artifacts.filter((artifact) => artifact["type"] === type);
  return filtered[filtered.length - 1];
}

function extractPriorEvents(artifact?: Record<string, unknown>): readonly CanonicalEventEnvelope[] {
  if (!artifact) return [];
  const payload = artifact["payload"];
  if (!payload || typeof payload !== "object") return [];
  const events = (payload as Record<string, unknown>)["events"];
  return Array.isArray(events) ? (events as CanonicalEventEnvelope[]) : [];
}

function extractPriorSnapshots(
  artifacts: readonly Record<string, unknown>[],
): readonly BrainSnapshot<BrainReplayState>[] {
  const snapshots: BrainSnapshot<BrainReplayState>[] = [];
  for (const artifact of artifacts) {
    if (artifact["type"] !== "snapshot") continue;
    const payload = artifact["payload"];
    if (!payload || typeof payload !== "object") continue;
    const snapshot = (payload as Record<string, unknown>)["snapshot"];
    if (!snapshot || typeof snapshot !== "object") continue;
    snapshots.push(snapshot as BrainSnapshot<BrainReplayState>);
  }
  return snapshots.sort((left, right) => left.atTimestamp.localeCompare(right.atTimestamp));
}

function buildBrainArtifacts(input: {
  tenantId: string;
  monthKey: string;
  generatedAt: string;
  periodLockHash: string;
  brainOutcome: ReturnType<typeof runBrainReplayWorkflow>;
  healthIndex: number;
}): BrainReplayArtifact[] {
  const artifacts: BrainReplayArtifact[] = [];

  const pushArtifact = (
    type: BrainReplayArtifact["type"],
    payload: Record<string, unknown>,
  ) => {
    const sanitizedPayload = sanitizeForFirestore(payload) as Record<string, unknown>;
    const hash = stableSha256Hex({
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

function sanitizeForFirestore(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForFirestore(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (entry === undefined) {
      continue;
    }
    out[key] = sanitizeForFirestore(entry);
  }
  return out;
}

function emitDeterministicTelemetry(payload: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify({ telemetry: "brain", ...payload }));
  } catch {
    // non-blocking telemetry bridge
  }
}

async function writeAuditorReplaySnapshots(input: {
  db: Firestore;
  tenantId: string;
  monthKey: string;
  entries: readonly CounterfactualTimelineEntry[];
  periodLockHash: string;
  generatedAt: string;
  events: readonly Event[];
}): Promise<void> {
  for (const entry of input.entries) {
    const cutoff = entry.asOfDate;
    const snapshotEvents = input.events.filter(
      (event) => event.occurredAt.slice(0, 10) <= cutoff
    );
    const snapshot = buildLedgerSnapshot(snapshotEvents);
    const readmodel = buildAuditorReplaySnapshot({
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

    await writeAuditorReplaySnapshot(
      input.db,
      input.tenantId,
      input.monthKey,
      cutoff,
      readmodel
    );
  }
}

async function writeExports(input: {
  db: Firestore;
  tenantId: string;
  monthKey: string;
  periodLockHash: string;
  generatedAt: string;
  timelineEntries: readonly CounterfactualTimelineEntry[];
  insights: readonly string[];
  mismatchSummary: {
    bankTxWithoutInvoice: readonly string[];
    invoiceMatchedWithoutBankTx: readonly string[];
    partialPayments: readonly string[];
    overpayments: readonly string[];
  };
  finalSnapshot: ReturnType<typeof buildLedgerSnapshot>;
  currency: CurrencyCode;
  netVatCents: number;
}): Promise<Record<string, string>> {
  const outputs: Record<string, string> = {};

  const existingLedger = await readExportArtifact(
    input.db,
    input.tenantId,
    input.monthKey,
    "ledgerCsv"
  );
  const existingLedgerHash =
    existingLedger && typeof (existingLedger as Record<string, unknown>).periodLockHash === "string"
      ? ((existingLedger as Record<string, unknown>).periodLockHash as string)
      : null;
  if (!existingLedger || existingLedgerHash !== input.periodLockHash) {
    const ledgerResult = generateLedgerCsv({
      tenantId: input.tenantId,
      monthKey: input.monthKey,
      currency: input.currency,
      bankTx: input.finalSnapshot.bankTx.map((tx) => ({
        txId: tx.txId,
        bookingDate: tx.bookingDate ?? input.monthKey + "-01",
        amountCents: tx.amountCents,
        currency: input.currency,
        descriptionRaw: tx.descriptionRaw ?? "",
      })),
      invoices: input.finalSnapshot.invoices.map((inv) => ({
        invoiceId: inv.invoiceId,
        issueDate: inv.issueDate ?? input.monthKey + "-01",
        invoiceNumber: inv.invoiceNumber ?? inv.invoiceId,
        supplierNameRaw: inv.supplierNameRaw ?? "",
        totalGrossCents: inv.totalGrossCents,
        currency: input.currency,
      })),
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
    await writeExportArtifact(input.db, input.tenantId, input.monthKey, "ledgerCsv", {
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

  const existingPdf = await readExportArtifact(
    input.db,
    input.tenantId,
    input.monthKey,
    "summaryPdf"
  );
  const existingPdfHash =
    existingPdf && typeof (existingPdf as Record<string, unknown>).periodLockHash === "string"
      ? ((existingPdf as Record<string, unknown>).periodLockHash as string)
      : null;
  if (!existingPdf || existingPdfHash !== input.periodLockHash) {
    const finalEntry = input.timelineEntries[input.timelineEntries.length - 1];
    const summaryResult = generateSummaryPdf({
      tenantId: input.tenantId,
      tenantName: input.tenantId,
      monthKey: input.monthKey,
      currency: input.currency,
      revenueCents: finalEntry?.revenueCents ?? 0,
      expenseCents: finalEntry?.expenseCents ?? 0,
      vatCents: finalEntry?.vatCents ?? 0,
      netVatCents: input.netVatCents,
      unmatchedCount: finalEntry?.unmatchedTotalCount ?? 0,
      mismatchBankTxCount: input.mismatchSummary.bankTxWithoutInvoice.length,
      mismatchInvoiceCount:
        input.mismatchSummary.invoiceMatchedWithoutBankTx.length +
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
    await writeExportArtifact(input.db, input.tenantId, input.monthKey, "summaryPdf", {
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

function safeInsight(insights: readonly string[], index: number): string {
  if (insights[index]) return insights[index];
  return index === 0
    ? "Final accuracy was reached on Day 0."
    : "100% of variance resolved in the last 0 days.";
}

function computePeriodLockHash(input: {
  tenantId: string;
  monthKey: string;
  periodEnd: string;
  asOfDays: readonly number[];
  events: readonly Event[];
}): string {
  const payload = {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    periodEnd: input.periodEnd,
    asOfDays: [...input.asOfDays].sort((a, b) => a - b),
    events: sortEvents(input.events).map((event) => ({
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
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    .join(",")}}`;
}

function timestampToDateKey(timestamp: Timestamp): string {
  return timestamp.toDate().toISOString().slice(0, 10);
}

function hashContent(content: string | Uint8Array): string {
  if (typeof content === "string") {
    return crypto.createHash("sha256").update(content).digest("hex");
  }
  return crypto.createHash("sha256").update(Buffer.from(content)).digest("hex");
}

function logInfo(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload));
}
