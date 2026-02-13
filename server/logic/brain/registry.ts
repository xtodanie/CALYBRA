import {
  SkillInput,
  SkillName,
  SkillOutput,
  TenantSkillContext,
  validateSkillInput,
  validateSkillOutput,
  validateTenantSkillContext,
} from "./contracts";
import {
  negotiateSkillCapabilities,
  PluginProvenancePin,
  SignedSkillManifest,
  SkillCapabilityContract,
  verifyPluginProvenance,
} from "./core";

export interface SkillExecutionPrecheck {
  readonly id: string;
  run: (params: {
    readonly input: SkillInput;
    readonly context: TenantSkillContext;
  }) => { readonly ok: true } | { readonly ok: false; readonly reason: string };
}

export interface BrainSkill {
  readonly name: SkillName;
  readonly version: string;
  readonly capabilityContract?: SkillCapabilityContract;
  readonly manifest?: SignedSkillManifest;
  execute: (params: {
    readonly input: SkillInput;
    readonly context: TenantSkillContext;
  }) => SkillOutput;
}

export interface SkillRegistryRuntimeCapabilities {
  readonly runtimeVersion: string;
  readonly modelFamily: string;
  readonly availableTools: readonly string[];
}

export interface SkillRegistryOptions {
  readonly prechecks?: readonly SkillExecutionPrecheck[];
  readonly runtimeCapabilities?: SkillRegistryRuntimeCapabilities;
  readonly enforceCapabilityContracts?: boolean;
  readonly enforceProvenance?: boolean;
  readonly provenancePins?: readonly PluginProvenancePin[];
}

export type SkillExecutionResult =
  | { readonly ok: true; readonly value: SkillOutput }
  | {
      readonly ok: false;
      readonly code:
        | "INVALID_INPUT"
        | "INVALID_CONTEXT"
        | "SKILL_NOT_FOUND"
        | "CAPABILITY_DENIED"
        | "PROVENANCE_DENIED"
        | "PRECHECK_DENIED"
        | "INVALID_OUTPUT";
      readonly message: string;
    };

export interface SkillRegistry {
  register: (skill: BrainSkill) => void;
  execute: (params: {
    readonly input: SkillInput;
    readonly context: TenantSkillContext;
  }) => SkillExecutionResult;
  list: () => readonly { readonly name: SkillName; readonly version: string }[];
}

export function createSkillRegistry(
  options: SkillRegistryOptions = {}
): SkillRegistry {
  const prechecks = options.prechecks ?? defaultPrechecks;
  const runtimeCapabilities = options.runtimeCapabilities ?? {
    runtimeVersion: "1.0.0",
    modelFamily: "zerebrox-v1",
    availableTools: ["readmodels", "events"],
  };
  const pinBySkill = new Map<string, PluginProvenancePin>(
    (options.provenancePins ?? []).map((pin) => [pin.skill, pin])
  );
  const skills = new Map<SkillName, BrainSkill>();

  return {
    register(skill: BrainSkill): void {
      if (skills.has(skill.name)) {
        throw new Error(`Skill already registered: ${skill.name}`);
      }
      skills.set(skill.name, skill);
    },

    execute(params): SkillExecutionResult {
      const inputValidation = validateSkillInput(params.input);
      if (!inputValidation.valid) {
        return {
          ok: false,
          code: "INVALID_INPUT",
          message: inputValidation.errors.join("; "),
        };
      }

      const contextValidation = validateTenantSkillContext(params.context);
      if (!contextValidation.valid) {
        return {
          ok: false,
          code: "INVALID_CONTEXT",
          message: contextValidation.errors.join("; "),
        };
      }

      const skill = skills.get(params.input.skill);
      if (!skill) {
        return {
          ok: false,
          code: "SKILL_NOT_FOUND",
          message: `Skill is not registered: ${params.input.skill}`,
        };
      }

      const contract = skill.capabilityContract ?? skill.manifest?.payload.capabilities;
      if (options.enforceCapabilityContracts !== false && contract) {
        const negotiation = negotiateSkillCapabilities(contract, {
          runtimeVersion: runtimeCapabilities.runtimeVersion,
          modelFamily: runtimeCapabilities.modelFamily,
          availableTools: runtimeCapabilities.availableTools,
          skillVersion: skill.version,
        });
        if (!negotiation.allowed) {
          return {
            ok: false,
            code: "CAPABILITY_DENIED",
            message: `${negotiation.reasonCode}: ${negotiation.reasons.join("; ")}`,
          };
        }
      }

      if (options.enforceProvenance !== false && skill.manifest) {
        const provenance = verifyPluginProvenance(skill.manifest, pinBySkill.get(skill.name));
        if (!provenance.valid) {
          return {
            ok: false,
            code: "PROVENANCE_DENIED",
            message: provenance.reasonCode,
          };
        }
      }

      for (const precheck of prechecks) {
        const result = precheck.run({ input: params.input, context: params.context });
        if (!result.ok) {
          return {
            ok: false,
            code: "PRECHECK_DENIED",
            message: `${precheck.id}: ${result.reason}`,
          };
        }
      }

      const output = skill.execute({ input: params.input, context: params.context });
      const outputValidation = validateSkillOutput(output);
      if (!outputValidation.valid) {
        return {
          ok: false,
          code: "INVALID_OUTPUT",
          message: outputValidation.errors.join("; "),
        };
      }

      if (output.envelope.tenantId !== params.context.tenantId) {
        return {
          ok: false,
          code: "INVALID_OUTPUT",
          message: "output.envelope.tenantId must match context.tenantId",
        };
      }

      const hasCrossTenantMemoryWrite = output.memoryWrites.some(
        (entry) => entry.tenantId !== params.context.tenantId
      );
      if (hasCrossTenantMemoryWrite) {
        return {
          ok: false,
          code: "INVALID_OUTPUT",
          message: "all memory writes must be tenant-scoped to the execution context",
        };
      }

      return { ok: true, value: output };
    },

    list() {
      return Array.from(skills.values())
        .map((skill) => ({ name: skill.name, version: skill.version }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  };
}

const defaultPrechecks: readonly SkillExecutionPrecheck[] = [
  {
    id: "readonly-enforcement",
    run: ({ context }) => {
      if (!context.readOnly) {
        return { ok: false, reason: "context.readOnly must remain true" };
      }
      return { ok: true };
    },
  },
  {
    id: "policy-path-required",
    run: ({ context }) => {
      if (!context.policyPath.trim()) {
        return { ok: false, reason: "context.policyPath is required" };
      }
      return { ok: true };
    },
  },
  {
    id: "execution-window-order",
    run: ({ context }) => {
      const startsAt = Date.parse(context.executionWindow.startsAtIso);
      const endsAt = Date.parse(context.executionWindow.endsAtIso);
      if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
        return { ok: false, reason: "execution window must contain parseable ISO timestamps" };
      }
      if (startsAt > endsAt) {
        return { ok: false, reason: "execution window start must be <= end" };
      }
      return { ok: true };
    },
  },
];
