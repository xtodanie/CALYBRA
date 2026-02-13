"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runZerebroxControlPlaneHeartbeatWorkflow = runZerebroxControlPlaneHeartbeatWorkflow;
exports.approveZerebroxPolicyProposalWorkflow = approveZerebroxPolicyProposalWorkflow;
const read_1 = require("../persistence/read");
const write_1 = require("../persistence/write");
const brain_1 = require("../logic/brain");
function latestArtifactByType(artifacts, type) {
    const candidates = artifacts.filter((artifact) => artifact["type"] === type);
    return candidates[candidates.length - 1];
}
function asRecord(value) {
    return value && typeof value === "object" ? value : {};
}
function toDecisionRecord(params) {
    const replayHash = typeof params.decisionPayload["replayHash"] === "string"
        ? params.decisionPayload["replayHash"]
        : `ctx:${params.monthKey}`;
    const accepted = params.decisionPayload["accepted"] === true;
    return {
        decisionId: `decision:${params.monthKey}:${replayHash.slice(0, 12)}`,
        tenantId: params.tenantId,
        monthKey: params.monthKey,
        policyVersion: params.policyVersion,
        contextHash: replayHash,
        confidenceScore: accepted ? 0.86 : 0.52,
        financialImpactEstimate: accepted ? 1200 : -300,
        createdAtIso: params.generatedAtIso,
    };
}
function buildRecorderSnapshot(input) {
    const decisionArtifact = latestArtifactByType(input.artifacts, "decision");
    const healthArtifact = latestArtifactByType(input.artifacts, "health");
    const gateArtifact = latestArtifactByType(input.artifacts, "gate_audit");
    const decisionPayload = asRecord(decisionArtifact === null || decisionArtifact === void 0 ? void 0 : decisionArtifact["payload"]);
    const healthPayload = asRecord(healthArtifact === null || healthArtifact === void 0 ? void 0 : healthArtifact["payload"]);
    const gatePayload = asRecord(gateArtifact === null || gateArtifact === void 0 ? void 0 : gateArtifact["payload"]);
    const eventsApplied = typeof healthPayload["eventsApplied"] === "number"
        ? healthPayload["eventsApplied"]
        : 0;
    const healthIndex = typeof healthPayload["healthIndex"] === "number"
        ? healthPayload["healthIndex"]
        : 0.5;
    const projection = (0, brain_1.computeCoreMemoryProjection)({
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        supplierCostCurrentCents: 100000 + eventsApplied * 100,
        supplierCostPreviousCents: 100000,
        supplierFulfilledOrders: Math.max(1, Math.round(90 + healthIndex * 10)),
        supplierTotalOrders: 100,
        exceptionsCount: Math.max(0, Math.round((1 - healthIndex) * 20)),
        previousExceptionsCount: 8,
        paymentLagDays: [1, 2, 3, 4, 7],
        reconciledTransactions: Math.round(80 + healthIndex * 20),
        totalTransactions: 100,
    });
    const decision = toDecisionRecord({
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        policyVersion: input.policyVersion,
        generatedAtIso: input.nowIso,
        decisionPayload,
    });
    const deterministicAction = decisionPayload["accepted"] === true ? "APPLY_POLICY_RECOMMENDATION" : "HOLD_POLICY";
    const aiAction = gatePayload["accepted"] === true ? deterministicAction : "RULE_ONLY_FALLBACK";
    const recorder = (0, brain_1.buildFlightRecorderEntry)({
        current: {
            decision,
            projection,
            deterministicAction,
            aiAction,
            whyFired: gatePayload["accepted"] === true ? "gate accepted" : "gate denied",
        },
        previous: input.previous
            ? {
                contextHash: input.previous.contextHash,
                policyVersion: input.previous.policyVersion,
                deterministicAction: input.previous.deterministicAction,
                aiAction: input.previous.aiAction,
            }
            : undefined,
    });
    return { recorder, projection };
}
async function runZerebroxControlPlaneHeartbeatWorkflow(db, input) {
    const nowIso = input.now.toDate().toISOString();
    const heartbeatId = `hb:${input.tenantId}:${input.monthKey}:${input.now.toMillis()}`;
    const artifacts = await (0, read_1.readBrainArtifactsByMonth)(db, input.tenantId, input.monthKey);
    const activePolicyDoc = await (0, read_1.readReadmodelItem)(db, input.tenantId, "policyVersions", "active");
    const policyVersion = typeof (activePolicyDoc === null || activePolicyDoc === void 0 ? void 0 : activePolicyDoc["activeVersion"]) === "string"
        ? activePolicyDoc["activeVersion"]
        : "pv-1";
    const recorderSnapshot = await (0, read_1.readReadmodelSnapshot)(db, input.tenantId, "flightRecorder", input.monthKey);
    const previousTimeline = Array.isArray(recorderSnapshot === null || recorderSnapshot === void 0 ? void 0 : recorderSnapshot["timeline"]) ? recorderSnapshot === null || recorderSnapshot === void 0 ? void 0 : recorderSnapshot["timeline"] : [];
    const previousEntry = previousTimeline.length > 0 ? previousTimeline[previousTimeline.length - 1] : undefined;
    const { recorder, projection } = buildRecorderSnapshot({
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        nowIso,
        policyVersion,
        previous: previousEntry,
        artifacts,
    });
    const compiled = (0, brain_1.compileRuntimeContext)({
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        projection,
        supplierReliabilityFlags: [`reliability:${projection.supplierReliabilityScore}`],
        activePolicyVersion: policyVersion,
        financialRiskEnvelope: { maxExposureCents: 250000, maxRiskScore: 0.7 },
        dataOriginIds: [`brainArtifacts:${input.monthKey}`, `policyVersion:${policyVersion}`],
        tokenBudget: 1200,
    });
    const scorecard = (0, brain_1.scoreTenantDecisionOutcomes)({
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        tp: 8,
        fp: 2,
        tn: 12,
        fn: 3,
        driftScore: Math.max(0, projection.exceptionFrequencyTrend),
        roiDelta: recorder.projection.supplierReliabilityScore - recorder.projection.supplierCostDrift,
    });
    const scoringAlert = (0, brain_1.evaluateScoringThresholds)(scorecard, {
        minPrecision: 0.7,
        minRecall: 0.65,
        maxFalsePositiveRate: 0.25,
        maxFalseNegativeRate: 0.35,
        maxDriftScore: 0.3,
    });
    const compare = (0, brain_1.compareDualPathOutputs)({
        deterministicScore: Math.max(0, 1 - projection.supplierCostDrift),
        aiScore: recorder.aiAction === "RULE_ONLY_FALLBACK" ? 0.4 : 0.8,
        tolerance: 0.15,
    });
    const schemaGate = (0, brain_1.evaluateSchemaLockedAIResponse)({
        response: {
            action: recorder.aiAction,
            confidence: recorder.deterministicAction === recorder.aiAction ? 0.8 : 0.45,
            rationaleCode: "runtime-heartbeat",
        },
        deterministicFallbackAction: "RULE_ONLY_FALLBACK",
    });
    const heartbeat = (0, brain_1.runTimerHeartbeat)({
        tenantId: input.tenantId,
        heartbeatId,
        driftScore: scorecard.driftScore,
        riskExposureScore: Math.max(0, 1 - projection.bankReconciliationStabilityScore),
        exceptionBacklog: Math.round(Math.max(0, projection.exceptionFrequencyTrend) * 100),
        policyHealthScore: scorecard.precision,
        envelopeVerified: schemaGate.valid,
    });
    const adaptation = (0, brain_1.runAdaptationScheduler)({
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        tier: input.tier,
        driftScore: Math.max(scorecard.driftScore, compare.delta),
        tolerance: 0.2,
        moderateMultiplier: 1.75,
    });
    const currentModeDoc = await (0, read_1.readReadmodelItem)(db, input.tenantId, "autopilotMode", "active");
    const currentMode = typeof (currentModeDoc === null || currentModeDoc === void 0 ? void 0 : currentModeDoc["mode"]) === "string"
        ? currentModeDoc["mode"]
        : "Observe";
    const modeTarget = adaptation.gate === "hold"
        ? "Hold"
        : adaptation.gate === "propose"
            ? "Advise"
            : "Observe";
    const modeTransition = (0, brain_1.transitionAutopilotMode)({
        currentMode,
        targetMode: modeTarget,
        scoringStability: scorecard.precision,
        scoringStabilityThreshold: 0.75,
        reason: `adaptation:${adaptation.gate}`,
        triggerCondition: heartbeat.reasons.join("|") || "nominal",
    });
    const envelope = (0, brain_1.evaluateProtectionEnvelope)({
        financialExposureCapCents: 250000,
        minConfidence: 0.6,
        maxRiskScore: 0.7,
        maxBlastRadius: 2,
        scopeRestriction: "month-level",
    }, {
        requestedExposureCents: Math.max(0, Math.round(Math.abs(recorder.projection.supplierCostDrift) * 100000)),
        confidenceScore: recorder.projection.supplierReliabilityScore,
        riskScore: Math.max(0, 1 - recorder.projection.bankReconciliationStabilityScore),
        requestedBlastRadius: compare.classification === "human_review" ? 2 : 1,
        requestedScope: "month-level",
        currentMode: modeTransition.accepted ? modeTransition.nextMode : currentMode,
    });
    const arbiter = (0, brain_1.arbitrateCommand)({
        deterministicAction: recorder.deterministicAction,
        aiRecommendedAction: recorder.aiAction,
        hardPolicyAllowedActions: envelope.allowed ? [recorder.deterministicAction, recorder.aiAction] : ["DENY"],
    });
    const effectiveMode = envelope.allowed
        ? (modeTransition.accepted ? modeTransition.nextMode : currentMode)
        : envelope.downgradedMode;
    await (0, write_1.mergeReadmodelDoc)(db, input.tenantId, "autopilotMode", "active", {
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        mode: effectiveMode,
        reason: modeTransition.reason,
        triggerCondition: modeTransition.triggerCondition,
        updatedAt: nowIso,
        schemaVersion: 1,
    });
    if (adaptation.recommendedAction === "propose_policy_delta") {
        const proposal = (0, brain_1.buildPolicyDeltaProposal)({
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            pendingPolicyVersion: `${policyVersion}.next`,
            detectedPattern: scoringAlert.breached ? "threshold_breach" : "soft_drift",
            estimatedRoiDelta: scorecard.estimatedRoiDelta,
            estimatedRiskDelta: scorecard.falsePositiveRate,
            scorecard,
        });
        await (0, write_1.writeReadmodelDoc)(db, input.tenantId, "policyProposals", proposal.proposalId, Object.assign(Object.assign({}, proposal), { createdAt: nowIso, createdBy: input.actorId, approvalStatus: "PENDING_APPROVAL", schemaVersion: 1 }));
    }
    const feedback = (0, brain_1.normalizeFeedbackEvent)({
        eventId: `${heartbeatId}:feedback`,
        tenantId: input.tenantId,
        source: adaptation.gate === "hold" ? "exception_resolution" : "bank_reconciliation",
        actorType: "system",
        actorId: input.actorId,
        occurredAtIso: nowIso,
        monthKey: input.monthKey,
        decisionId: recorder.decisionId,
        payload: {
            adaptationGate: adaptation.gate,
            escalated: heartbeat.escalateToAdaptationScheduler,
        },
    });
    const truthLink = (0, brain_1.bindDecisionToTruth)({
        decision: {
            decisionId: recorder.decisionId,
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            policyVersion,
            contextHash: recorder.contextHash,
            confidenceScore: recorder.projection.supplierReliabilityScore,
            financialImpactEstimate: recorder.projection.supplierCostDrift * 100000,
            createdAtIso: nowIso,
        },
        truth: {
            truthEventId: `${heartbeatId}:truth`,
            decisionId: recorder.decisionId,
            tenantId: input.tenantId,
            status: adaptation.gate === "hold" ? "overridden" : "confirmed_correct",
            observedAtIso: nowIso,
            actorId: input.actorId,
        },
        linkId: `${heartbeatId}:link`,
        linkedAtIso: nowIso,
    });
    await (0, write_1.createEvent)(db, { actorId: input.actorId, now: input.now }, {
        id: `${heartbeatId}:decision`,
        tenantId: input.tenantId,
        type: "zerebrox.decision",
        occurredAt: nowIso,
        recordedAt: nowIso,
        monthKey: input.monthKey,
        deterministicId: recorder.decisionId,
        payload: {
            decision_id: recorder.decisionId,
            policy_version: policyVersion,
            context_hash: recorder.contextHash,
            confidence_score: recorder.projection.supplierReliabilityScore,
            financial_impact_estimate: recorder.projection.supplierCostDrift,
            deterministic_action: recorder.deterministicAction,
            ai_action: recorder.aiAction,
            final_action: arbiter.finalAction,
            effective_mode: effectiveMode,
        },
    });
    await (0, write_1.createEvent)(db, { actorId: input.actorId, now: input.now }, {
        id: `${heartbeatId}:truth`,
        tenantId: input.tenantId,
        type: "zerebrox.truth_link",
        occurredAt: nowIso,
        recordedAt: nowIso,
        monthKey: input.monthKey,
        deterministicId: truthLink.linkId,
        payload: {
            decision_id: truthLink.decisionId,
            truth_event_id: truthLink.truthEventId,
            status: truthLink.status,
            linked_at: truthLink.linkedAtIso,
        },
    });
    await (0, write_1.createEvent)(db, { actorId: input.actorId, now: input.now }, {
        id: `${heartbeatId}:feedback`,
        tenantId: input.tenantId,
        type: "zerebrox.feedback",
        occurredAt: feedback.occurredAtIso,
        recordedAt: nowIso,
        monthKey: input.monthKey,
        deterministicId: feedback.eventId,
        payload: feedback.payload,
    });
    const nextTimeline = [...previousTimeline, recorder].slice(-100);
    await (0, write_1.writeReadmodel)(db, input.tenantId, "flightRecorder", input.monthKey, {
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        activePolicyVersion: policyVersion,
        contextLog: compiled.log,
        heartbeat,
        adaptation,
        scoringAlert,
        envelope,
        arbiter,
        modeTransition,
        effectiveMode,
        dualPathComparison: compare,
        timeline: nextTimeline,
        generatedAt: nowIso,
        schemaVersion: 1,
    });
    await (0, write_1.mergeReadmodelDoc)(db, input.tenantId, "controlPlaneRuns", `${input.monthKey}:${input.tier}`, {
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        tier: input.tier,
        heartbeatId,
        escalated: heartbeat.escalateToAdaptationScheduler,
        adaptationGate: adaptation.gate,
        updatedAt: nowIso,
        schemaVersion: 1,
    });
    return {
        success: true,
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        heartbeatId,
        escalated: heartbeat.escalateToAdaptationScheduler,
        adaptationGate: adaptation.gate,
        recorderPath: `tenants/${input.tenantId}/readmodels/flightRecorder/${input.monthKey}/snapshot`,
    };
}
async function approveZerebroxPolicyProposalWorkflow(db, input) {
    const proposal = await (0, read_1.readReadmodelItem)(db, input.tenantId, "policyProposals", input.proposalId);
    if (!proposal) {
        throw new Error("policy proposal not found");
    }
    const canary = (0, brain_1.evaluateCanaryShadow)({
        candidatePolicyVersion: input.candidatePolicyVersion,
        baselinePolicyVersion: input.baselinePolicyVersion,
        regressionPrecisionDelta: input.regressionPrecisionDelta,
        regressionRecallDelta: input.regressionRecallDelta,
        maxAllowedPrecisionDrop: 0.03,
        maxAllowedRecallDrop: 0.03,
    });
    if (canary.autoRollback) {
        await (0, write_1.mergeReadmodelDoc)(db, input.tenantId, "policyProposals", input.proposalId, {
            approvalStatus: "REJECTED_BY_CANARY",
            updatedAt: input.now.toDate().toISOString(),
            canary,
            schemaVersion: 1,
        });
        return {
            activatedVersion: input.baselinePolicyVersion,
            rolledBack: true,
        };
    }
    const activation = (0, brain_1.activatePolicyVersion)({
        activeVersion: {
            version: input.baselinePolicyVersion,
            activatedAtIso: input.now.toDate().toISOString(),
            activatedBy: input.actorId,
            archived: false,
        },
        nextVersion: input.candidatePolicyVersion,
        actorId: input.actorId,
        activatedAtIso: input.now.toDate().toISOString(),
    });
    await (0, write_1.writeReadmodelDoc)(db, input.tenantId, "policyVersions", "active", {
        tenantId: input.tenantId,
        activeVersion: activation.activated.version,
        archivedVersion: activation.archived.version,
        activationDelta: activation.outcome.activationDelta,
        activatedBy: input.actorId,
        activatedAt: input.now.toDate().toISOString(),
        schemaVersion: 1,
    });
    await (0, write_1.mergeReadmodelDoc)(db, input.tenantId, "policyProposals", input.proposalId, {
        approvalStatus: "APPROVED",
        activatedVersion: activation.activated.version,
        updatedAt: input.now.toDate().toISOString(),
        canary,
        schemaVersion: 1,
    });
    return {
        activatedVersion: activation.activated.version,
        rolledBack: false,
    };
}
//# sourceMappingURL=zerebroxControlPlane.workflow.js.map