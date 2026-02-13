"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptGovernanceRegistry = exports.AppendOnlyDecisionFeedbackLog = void 0;
exports.bindDecisionToTruth = bindDecisionToTruth;
exports.normalizeFeedbackEvent = normalizeFeedbackEvent;
exports.scoreTenantDecisionOutcomes = scoreTenantDecisionOutcomes;
exports.evaluateScoringThresholds = evaluateScoringThresholds;
exports.computeCoreMemoryProjection = computeCoreMemoryProjection;
exports.compileRuntimeContext = compileRuntimeContext;
exports.runTimerHeartbeat = runTimerHeartbeat;
exports.runAdaptationScheduler = runAdaptationScheduler;
exports.transitionAutopilotMode = transitionAutopilotMode;
exports.arbitrateCommand = arbitrateCommand;
exports.compareDualPathOutputs = compareDualPathOutputs;
exports.evaluateProtectionEnvelope = evaluateProtectionEnvelope;
exports.buildPolicyDeltaProposal = buildPolicyDeltaProposal;
exports.activatePolicyVersion = activatePolicyVersion;
exports.rollbackPolicyVersion = rollbackPolicyVersion;
exports.evaluateSchemaLockedAIResponse = evaluateSchemaLockedAIResponse;
exports.buildFlightRecorderEntry = buildFlightRecorderEntry;
exports.evaluateCanaryShadow = evaluateCanaryShadow;
const zod_1 = require("zod");
const AI_DECISION_SCHEMA = zod_1.z.object({
    action: zod_1.z.string().min(1),
    confidence: zod_1.z.number().min(0).max(1),
    rationaleCode: zod_1.z.string().min(1),
});
function assertIsoString(value, fieldName) {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
        throw new Error(`invalid ISO timestamp for ${fieldName}`);
    }
}
function round4(value) {
    return Number(value.toFixed(4));
}
function percentile(sorted, p) {
    var _a;
    if (sorted.length === 0) {
        return 0;
    }
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
    return (_a = sorted[idx]) !== null && _a !== void 0 ? _a : 0;
}
function estimateTokenSize(value) {
    const chars = JSON.stringify(value).length;
    return Math.ceil(chars / 4);
}
class AppendOnlyDecisionFeedbackLog {
    constructor() {
        this.decisions = [];
        this.truthLinks = [];
        this.feedbackEvents = [];
    }
    appendDecision(decision) {
        assertIsoString(decision.createdAtIso, "decision.createdAtIso");
        if (this.decisions.some((entry) => entry.decisionId === decision.decisionId)) {
            throw new Error(`decision already exists: ${decision.decisionId}`);
        }
        this.decisions.push(Object.freeze(Object.assign({}, decision)));
    }
    appendTruthLink(link) {
        assertIsoString(link.linkedAtIso, "truthLink.linkedAtIso");
        if (this.truthLinks.some((entry) => entry.linkId === link.linkId)) {
            throw new Error(`truth link already exists: ${link.linkId}`);
        }
        this.truthLinks.push(Object.freeze(Object.assign({}, link)));
    }
    appendFeedback(event) {
        assertIsoString(event.occurredAtIso, "feedback.occurredAtIso");
        if (this.feedbackEvents.some((entry) => entry.eventId === event.eventId)) {
            throw new Error(`feedback event already exists: ${event.eventId}`);
        }
        this.feedbackEvents.push(Object.freeze(Object.assign(Object.assign({}, event), { payload: Object.assign({}, event.payload) })));
    }
    listDecisions(tenantId) {
        return this.decisions.filter((entry) => entry.tenantId === tenantId);
    }
    listTruthLinks(tenantId) {
        return this.truthLinks.filter((entry) => entry.tenantId === tenantId);
    }
    listFeedback(tenantId) {
        return this.feedbackEvents.filter((entry) => entry.tenantId === tenantId);
    }
}
exports.AppendOnlyDecisionFeedbackLog = AppendOnlyDecisionFeedbackLog;
function bindDecisionToTruth(input) {
    assertIsoString(input.linkedAtIso, "linkedAtIso");
    if (input.decision.decisionId !== input.truth.decisionId) {
        throw new Error("decision/truth mismatch");
    }
    if (input.decision.tenantId !== input.truth.tenantId) {
        throw new Error("tenant mismatch while binding truth");
    }
    return Object.freeze({
        linkId: input.linkId,
        decisionId: input.decision.decisionId,
        truthEventId: input.truth.truthEventId,
        tenantId: input.decision.tenantId,
        status: input.truth.status,
        linkedAtIso: input.linkedAtIso,
    });
}
function normalizeFeedbackEvent(input) {
    assertIsoString(input.occurredAtIso, "feedback.occurredAtIso");
    return Object.freeze({
        eventId: input.eventId,
        tenantId: input.tenantId,
        source: input.source,
        actorType: input.actorType,
        actorId: input.actorId,
        occurredAtIso: input.occurredAtIso,
        monthKey: input.monthKey,
        decisionId: input.decisionId,
        payload: Object.assign({}, input.payload),
    });
}
function scoreTenantDecisionOutcomes(sample) {
    const precisionDen = sample.tp + sample.fp;
    const recallDen = sample.tp + sample.fn;
    const fprDen = sample.fp + sample.tn;
    const fnrDen = sample.fn + sample.tp;
    return {
        tenantId: sample.tenantId,
        monthKey: sample.monthKey,
        precision: round4(precisionDen === 0 ? 0 : sample.tp / precisionDen),
        recall: round4(recallDen === 0 ? 0 : sample.tp / recallDen),
        falsePositiveRate: round4(fprDen === 0 ? 0 : sample.fp / fprDen),
        falseNegativeRate: round4(fnrDen === 0 ? 0 : sample.fn / fnrDen),
        driftScore: round4(sample.driftScore),
        estimatedRoiDelta: round4(sample.roiDelta),
    };
}
function evaluateScoringThresholds(scorecard, thresholds) {
    const reasons = [];
    if (scorecard.precision < thresholds.minPrecision)
        reasons.push("precision below threshold");
    if (scorecard.recall < thresholds.minRecall)
        reasons.push("recall below threshold");
    if (scorecard.falsePositiveRate > thresholds.maxFalsePositiveRate)
        reasons.push("false positive rate above threshold");
    if (scorecard.falseNegativeRate > thresholds.maxFalseNegativeRate)
        reasons.push("false negative rate above threshold");
    if (scorecard.driftScore > thresholds.maxDriftScore)
        reasons.push("drift score above threshold");
    return { breached: reasons.length > 0, reasons };
}
function computeCoreMemoryProjection(input) {
    var _a;
    const costBaseline = Math.max(1, input.supplierCostPreviousCents);
    const reliabilityDen = Math.max(1, input.supplierTotalOrders);
    const exceptionBaseline = Math.max(1, input.previousExceptionsCount);
    const reconciliationDen = Math.max(1, input.totalTransactions);
    const lags = [...input.paymentLagDays].sort((a, b) => a - b);
    return {
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        supplierCostDrift: round4((input.supplierCostCurrentCents - input.supplierCostPreviousCents) / costBaseline),
        supplierReliabilityScore: round4(input.supplierFulfilledOrders / reliabilityDen),
        exceptionFrequencyTrend: round4((input.exceptionsCount - input.previousExceptionsCount) / exceptionBaseline),
        paymentLagDistribution: {
            p50: percentile(lags, 0.5),
            p90: percentile(lags, 0.9),
            max: (_a = lags[lags.length - 1]) !== null && _a !== void 0 ? _a : 0,
        },
        bankReconciliationStabilityScore: round4(input.reconciledTransactions / reconciliationDen),
    };
}
function compileRuntimeContext(input) {
    if (input.includeRawHistoricalData) {
        throw new Error("raw historical data injection is forbidden without explicit runtime contract");
    }
    const context = {
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        projection: input.projection,
        supplierReliabilityFlags: [...input.supplierReliabilityFlags],
        activePolicyVersion: input.activePolicyVersion,
        financialRiskEnvelope: {
            maxExposureCents: input.financialRiskEnvelope.maxExposureCents,
            maxRiskScore: input.financialRiskEnvelope.maxRiskScore,
        },
    };
    const tokenSize = estimateTokenSize(context);
    const truncated = tokenSize > input.tokenBudget;
    return {
        context,
        log: {
            tokenSize,
            dataOriginIds: [...input.dataOriginIds],
            truncated,
        },
    };
}
function runTimerHeartbeat(input) {
    if (!input.envelopeVerified) {
        return {
            heartbeatId: input.heartbeatId,
            tenantId: input.tenantId,
            escalateToAdaptationScheduler: true,
            reasons: ["envelope verification failed"],
        };
    }
    const reasons = [];
    if (input.driftScore > 0.3)
        reasons.push("drift threshold breached");
    if (input.riskExposureScore > 0.7)
        reasons.push("risk exposure breached");
    if (input.exceptionBacklog > 50)
        reasons.push("exception backlog breached");
    if (input.policyHealthScore < 0.6)
        reasons.push("policy health degraded");
    return {
        heartbeatId: input.heartbeatId,
        tenantId: input.tenantId,
        escalateToAdaptationScheduler: reasons.length > 0,
        reasons,
    };
}
function runAdaptationScheduler(input) {
    const moderateThreshold = input.tolerance * input.moderateMultiplier;
    if (input.driftScore < input.tolerance) {
        return {
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            tier: input.tier,
            gate: "observe",
            recommendedAction: "observe_only",
        };
    }
    if (input.driftScore < moderateThreshold) {
        return {
            tenantId: input.tenantId,
            monthKey: input.monthKey,
            tier: input.tier,
            gate: "propose",
            recommendedAction: "propose_policy_delta",
        };
    }
    return {
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        tier: input.tier,
        gate: "hold",
        recommendedAction: "escalate_hold_mode",
    };
}
const ALLOWED_MODE_TRANSITIONS = {
    Observe: ["Advise", "Hold"],
    Advise: ["Observe", "Constrained-Act", "Hold"],
    "Constrained-Act": ["Advise", "Hold", "Lockdown"],
    Hold: ["Observe", "Advise", "Lockdown"],
    Lockdown: ["Hold"],
};
function transitionAutopilotMode(input) {
    const allowed = ALLOWED_MODE_TRANSITIONS[input.currentMode].includes(input.targetMode);
    if (!allowed) {
        return {
            accepted: false,
            nextMode: input.currentMode,
            reason: "illegal mode transition",
            triggerCondition: input.triggerCondition,
        };
    }
    if (input.currentMode === "Observe" &&
        input.targetMode === "Constrained-Act" &&
        input.scoringStability < input.scoringStabilityThreshold) {
        return {
            accepted: false,
            nextMode: input.currentMode,
            reason: "stability threshold unmet for Observe -> Constrained-Act",
            triggerCondition: input.triggerCondition,
        };
    }
    return {
        accepted: true,
        nextMode: input.targetMode,
        reason: input.reason,
        triggerCondition: input.triggerCondition,
    };
}
function arbitrateCommand(input) {
    const policyAllowsDeterministic = input.hardPolicyAllowedActions.includes(input.deterministicAction);
    if (!policyAllowsDeterministic) {
        return {
            finalAction: "DENY",
            disagreementLogged: true,
            aiDiscarded: true,
            reason: "hard policy denied deterministic action",
        };
    }
    if (!input.hardPolicyAllowedActions.includes(input.aiRecommendedAction)) {
        return {
            finalAction: input.deterministicAction,
            disagreementLogged: true,
            aiDiscarded: true,
            reason: "hard policy denied ai action",
        };
    }
    if (input.aiRecommendedAction !== input.deterministicAction) {
        return {
            finalAction: input.deterministicAction,
            disagreementLogged: true,
            aiDiscarded: true,
            reason: "deterministic/hard-policy path wins on conflict",
        };
    }
    return {
        finalAction: input.deterministicAction,
        disagreementLogged: false,
        aiDiscarded: false,
        reason: "paths agree",
    };
}
function compareDualPathOutputs(input) {
    const delta = round4(Math.abs(input.deterministicScore - input.aiScore));
    const withinTolerance = delta <= input.tolerance;
    return {
        delta,
        withinTolerance,
        escalationRequired: !withinTolerance,
        classification: withinTolerance ? "minor_variance" : "human_review",
    };
}
function evaluateProtectionEnvelope(limits, input) {
    const reasons = [];
    if (input.requestedExposureCents > limits.financialExposureCapCents)
        reasons.push("financial exposure cap breached");
    if (input.confidenceScore < limits.minConfidence)
        reasons.push("confidence threshold breached");
    if (input.riskScore > limits.maxRiskScore)
        reasons.push("risk classification breached");
    if (input.requestedBlastRadius > limits.maxBlastRadius)
        reasons.push("blast radius cap breached");
    if (input.requestedScope !== limits.scopeRestriction)
        reasons.push("scope restriction breached");
    if (reasons.length === 0) {
        return {
            allowed: true,
            downgradedMode: input.currentMode,
            reasons: [],
        };
    }
    const downgradedMode = input.currentMode === "Lockdown" ? "Lockdown" : "Hold";
    return {
        allowed: false,
        downgradedMode,
        reasons,
    };
}
function buildPolicyDeltaProposal(input) {
    return {
        proposalId: `${input.tenantId}:${input.monthKey}:${input.pendingPolicyVersion}`,
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        pendingPolicyVersion: input.pendingPolicyVersion,
        detectedPattern: input.detectedPattern,
        impactSimulation: {
            estimatedRoiDelta: round4(input.estimatedRoiDelta),
            estimatedRiskDelta: round4(input.estimatedRiskDelta),
        },
        scoringJustification: input.scorecard,
        status: "PENDING_APPROVAL",
    };
}
function activatePolicyVersion(input) {
    assertIsoString(input.activatedAtIso, "activatedAtIso");
    const archived = Object.assign(Object.assign({}, input.activeVersion), { archived: true });
    const activated = {
        version: input.nextVersion,
        activatedAtIso: input.activatedAtIso,
        activatedBy: input.actorId,
        archived: false,
    };
    return {
        archived,
        activated,
        outcome: {
            activeVersion: activated.version,
            archivedVersion: archived.version,
            activationDelta: `${archived.version} -> ${activated.version}`,
        },
    };
}
function rollbackPolicyVersion(input) {
    return {
        activeVersion: Object.assign(Object.assign({}, input.targetVersion), { archived: false }),
        envelope: Object.assign({}, input.recalculatedEnvelope),
    };
}
class PromptGovernanceRegistry {
    constructor() {
        this.records = new Map();
    }
    register(record) {
        var _a;
        assertIsoString(record.expiryReviewDateIso, "expiryReviewDateIso");
        const versions = (_a = this.records.get(record.promptId)) !== null && _a !== void 0 ? _a : [];
        if (versions.some((entry) => entry.version === record.version)) {
            throw new Error(`prompt version already exists for ${record.promptId} v${record.version}`);
        }
        const next = [...versions, Object.freeze(Object.assign(Object.assign({}, record), { allowedScopes: [...record.allowedScopes] }))]
            .sort((left, right) => left.version - right.version);
        this.records.set(record.promptId, next);
    }
    latest(promptId) {
        const versions = this.records.get(promptId);
        if (!versions || versions.length === 0) {
            return undefined;
        }
        return versions[versions.length - 1];
    }
}
exports.PromptGovernanceRegistry = PromptGovernanceRegistry;
function evaluateSchemaLockedAIResponse(input) {
    const parsed = AI_DECISION_SCHEMA.safeParse(input.response);
    if (!parsed.success) {
        return {
            valid: false,
            fallbackDeterministicAction: input.deterministicFallbackAction,
            errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`),
        };
    }
    return {
        valid: true,
        parsed: parsed.data,
        errors: [],
    };
}
function buildFlightRecorderEntry(input) {
    const changes = [];
    if (input.previous) {
        if (input.previous.contextHash !== input.current.decision.contextHash)
            changes.push("contextHash");
        if (input.previous.policyVersion !== input.current.decision.policyVersion)
            changes.push("policyVersion");
        if (input.previous.deterministicAction !== input.current.deterministicAction)
            changes.push("deterministicAction");
        if (input.previous.aiAction !== input.current.aiAction)
            changes.push("aiAction");
    }
    return {
        decisionId: input.current.decision.decisionId,
        contextHash: input.current.decision.contextHash,
        policyVersion: input.current.decision.policyVersion,
        projection: input.current.projection,
        deterministicAction: input.current.deterministicAction,
        aiAction: input.current.aiAction,
        whyFired: input.current.whyFired,
        changedFromPrevious: changes,
    };
}
function evaluateCanaryShadow(input) {
    const precisionDrop = Math.max(0, -input.regressionPrecisionDelta);
    const recallDrop = Math.max(0, -input.regressionRecallDelta);
    const autoRollback = precisionDrop > input.maxAllowedPrecisionDrop ||
        recallDrop > input.maxAllowedRecallDrop;
    return {
        approvedForRollout: !autoRollback,
        autoRollback,
        regressionDelta: {
            precision: round4(input.regressionPrecisionDelta),
            recall: round4(input.regressionRecallDelta),
        },
        notificationMessage: autoRollback
            ? `Auto-rollback triggered for ${input.candidatePolicyVersion}; baseline=${input.baselinePolicyVersion}`
            : `Canary approved for ${input.candidatePolicyVersion}`,
    };
}
//# sourceMappingURL=zerebrox-control-plane.js.map