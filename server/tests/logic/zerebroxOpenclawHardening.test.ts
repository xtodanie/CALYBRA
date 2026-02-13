import crypto from "node:crypto";
import {
  createQuarantineEnvelope,
  evaluateExecutionBudget,
  evaluatePolicyShadowDecision,
  negotiateSkillCapabilities,
  replayQuarantinedEnvelope,
  signSkillManifest,
  summarizePolicyShadow,
  verifyPluginProvenance,
} from "../../../server/logic/brain";

describe("ZEREBROX OpenClaw-derived hardening", () => {
  it("evaluates capability contracts with deterministic reason codes", () => {
    const outcome = negotiateSkillCapabilities(
      {
        minRuntimeVersion: "1.2.0",
        requiredModelFamilies: ["zerebrox-v1"],
        requiredTools: ["readmodels"],
        supportedSkillMajorVersions: [1],
      },
      {
        runtimeVersion: "1.1.0",
        modelFamily: "zerebrox-v1",
        availableTools: ["readmodels"],
        skillVersion: "1.0.0",
      }
    );

    expect(outcome.allowed).toBe(false);
    expect(outcome.reasonCode).toBe("CAPABILITY_RUNTIME_VERSION_UNSUPPORTED");
  });

  it("trips execution circuit-breaker when token budget is exceeded", () => {
    const outcome = evaluateExecutionBudget(
      {
        maxTokens: 100,
        maxDurationMs: 200,
        maxCostMicros: 500,
      },
      {
        tokensUsed: 120,
        durationMs: 150,
        costMicros: 450,
      }
    );

    expect(outcome.allowed).toBe(false);
    expect(outcome.circuitBroken).toBe(true);
    expect(outcome.reasonCodes).toContain("BUDGET_TOKEN_EXCEEDED");
    expect(outcome.fallbackAction).toBe("RULE_ONLY_FALLBACK");
  });

  it("captures policy shadow false-block risk and summary metrics", () => {
    const first = evaluatePolicyShadowDecision({
      enabled: true,
      enforcedAllowed: true,
      candidateAllowed: false,
    });
    const second = evaluatePolicyShadowDecision({
      enabled: true,
      enforcedAllowed: false,
      candidateAllowed: false,
    });

    const summary = summarizePolicyShadow([first, second]);
    expect(first.classification).toBe("false_block_risk");
    expect(summary.sampleCount).toBe(2);
    expect(summary.falseBlockRiskCount).toBe(1);
    expect(summary.falseBlockRiskRate).toBe(0.5);
  });

  it("stores quarantined payloads and supports replay-safe recovery", () => {
    const envelope = createQuarantineEnvelope({
      quarantineId: "q-1",
      tenantId: "tenant-a",
      sourceType: "zerebrox.heartbeat",
      reasonCode: "SCHEMA_GATE_INVALID",
      payload: {
        tenantId: "tenant-a",
        monthKey: "2026-02",
      },
      createdAtIso: "2026-02-14T00:00:00Z",
    });

    const replayed = replayQuarantinedEnvelope({
      envelope,
      maxReplayAttempts: 3,
      validator: (payload) => payload["tenantId"] === "tenant-a",
    });

    expect(replayed.status).toBe("REPLAYED");
    expect(replayed.reasonCode).toBe("REPLAY_OK");
  });

  it("verifies signed manifest and rejects pin mismatch", () => {
    const keys = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privateKeyPem = keys.privateKey.export({ format: "pem", type: "pkcs1" }).toString();
    const publicKeyPem = keys.publicKey.export({ format: "pem", type: "pkcs1" }).toString();

    const manifest = signSkillManifest(
      {
        skill: "Finance",
        version: "1.0.0",
        featureFlag: "zerebrox.skill.finance.enabled",
        capabilities: {
          minRuntimeVersion: "1.0.0",
          requiredModelFamilies: ["zerebrox-v1"],
          requiredTools: ["readmodels"],
          supportedSkillMajorVersions: [1],
        },
      },
      privateKeyPem,
      publicKeyPem
    );

    const valid = verifyPluginProvenance(manifest, {
      skill: "Finance",
      expectedManifestHash: manifest.manifestHash,
    });
    const invalid = verifyPluginProvenance(manifest, {
      skill: "Finance",
      expectedManifestHash: `${manifest.manifestHash.slice(0, -1)}a`,
    });

    expect(valid.valid).toBe(true);
    expect(invalid.valid).toBe(false);
    expect(invalid.reasonCode).toBe("PROVENANCE_PIN_MISMATCH");
  });
});
