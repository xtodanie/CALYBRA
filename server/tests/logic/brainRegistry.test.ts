import {
  BRAIN_SCHEMA_VERSION,
  defaultSkillProvenancePins,
  SkillInput,
  TenantSkillContext,
  createSkillRegistry,
  registerInitialBrainSkills,
} from "../../../server/logic/brain";

function createValidContext(): TenantSkillContext {
  return {
    schemaVersion: BRAIN_SCHEMA_VERSION,
    tenantId: "tenant-001",
    actorId: "system:heartbeat",
    readOnly: true,
    policyPath: "zbx.phase1.readonly",
    executionWindow: {
      startsAtIso: "2026-02-13T07:00:00Z",
      endsAtIso: "2026-02-13T23:00:00Z",
    },
  };
}

function createValidInput(skill: SkillInput["skill"] = "Finance"): SkillInput {
  return {
    schemaVersion: BRAIN_SCHEMA_VERSION,
    skill,
    contextHash: "ctx:tenant-001:2026-02-13:window-01",
    trigger: {
      schemaVersion: BRAIN_SCHEMA_VERSION,
      triggerId: "trg-001",
      triggerClass: "THRESHOLD_BREACH",
      source: "heartbeat",
      severity: "medium",
      occurredAt: "2026-02-13T08:00:00Z",
      evidenceRefs: ["ev:tx:1", "ev:inv:2"],
    },
    payload: {
      monthKey: "2026-02",
    },
  };
}

describe("Brain Skill Registry", () => {
  it("registers initial read-only skills", () => {
    const registry = createSkillRegistry();
    registerInitialBrainSkills(registry);

    expect(registry.list().map((entry) => entry.name)).toEqual([
      "Finance",
      "Inventory",
      "POS",
      "Supplier",
    ]);
  });

  it("rejects execution when tenant context is invalid", () => {
    const registry = createSkillRegistry();
    registerInitialBrainSkills(registry);

    const input = createValidInput("Finance");
    const invalidContext = {
      ...createValidContext(),
      tenantId: "",
    } as unknown as TenantSkillContext;

    const result = registry.execute({ input, context: invalidContext });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_CONTEXT");
    }
  });

  it("rejects execution when input is not schema-valid", () => {
    const registry = createSkillRegistry();
    registerInitialBrainSkills(registry);

    const invalidInput = {
      ...createValidInput("Finance"),
      schemaVersion: 99,
    } as unknown as SkillInput;

    const result = registry.execute({
      input: invalidInput,
      context: createValidContext(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_INPUT");
    }
  });

  it("executes Finance stub and emits memory write under tenant", () => {
    const registry = createSkillRegistry();
    registerInitialBrainSkills(registry);

    const result = registry.execute({
      input: createValidInput("Finance"),
      context: createValidContext(),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.envelope.skill).toBe("Finance");
      expect(result.value.envelope.tenantId).toBe("tenant-001");
      expect(result.value.memoryWrites).toHaveLength(1);
      expect(result.value.memoryWrites[0].tenantId).toBe("tenant-001");
      expect(result.value.memoryWrites[0].namespace).toBe("event-ledger");
    }
  });

  it("is deterministic for identical input/context", () => {
    const registry = createSkillRegistry();
    registerInitialBrainSkills(registry);

    const input = createValidInput("Supplier");
    const context = createValidContext();

    const first = registry.execute({ input, context });
    const second = registry.execute({ input, context });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value).toEqual(first.value);
    }
  });

  it("hard-denies execution when runtime capability contract is unmet", () => {
    const registry = createSkillRegistry({
      runtimeCapabilities: {
        runtimeVersion: "1.0.0",
        modelFamily: "zerebrox-v2",
        availableTools: ["readmodels", "events"],
      },
    });
    registerInitialBrainSkills(registry);

    const result = registry.execute({
      input: createValidInput("Finance"),
      context: createValidContext(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CAPABILITY_DENIED");
      expect(result.message).toContain("CAPABILITY_MODEL_UNSUPPORTED");
    }
  });

  it("hard-denies execution when manifest hash pin is mismatched", () => {
    const mismatchedPins = defaultSkillProvenancePins.map((pin) =>
      pin.skill === "Finance"
        ? { ...pin, expectedManifestHash: `${pin.expectedManifestHash.slice(0, -1)}x` }
        : pin
    );

    const registry = createSkillRegistry({
      provenancePins: mismatchedPins,
    });
    registerInitialBrainSkills(registry);

    const result = registry.execute({
      input: createValidInput("Finance"),
      context: createValidContext(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PROVENANCE_DENIED");
      expect(result.message).toBe("PROVENANCE_PIN_MISMATCH");
    }
  });
});
