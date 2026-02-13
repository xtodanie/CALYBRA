import crypto from "node:crypto";
import {
  BRAIN_SCHEMA_VERSION,
  DecisionEnvelope,
  MemoryWrite,
  SkillInput,
  SkillName,
  SkillOutput,
  TenantSkillContext,
} from "./contracts";
import { SkillCapabilityContract, signSkillManifest } from "./core";
import { BrainSkill, SkillRegistry } from "./registry";

function createReadOnlyStubSkill(skillName: SkillName, decisionCode: string): BrainSkill {
  const capabilityContract: SkillCapabilityContract = {
    minRuntimeVersion: "1.0.0",
    requiredModelFamilies: ["zerebrox-v1"],
    requiredTools: ["readmodels", "events"],
    supportedSkillMajorVersions: [1],
  };

  const manifest = signSkillManifest(
    {
      skill: skillName,
      version: "1.0.0",
      featureFlag: `zerebrox.skill.${skillName.toLowerCase()}.enabled`,
      capabilities: capabilityContract,
    },
    INTERNAL_SKILL_PRIVATE_KEY_PEM,
    INTERNAL_SKILL_PUBLIC_KEY_PEM
  );

  return {
    name: skillName,
    version: "1.0.0",
    capabilityContract,
    manifest,
    execute: ({ input, context }: { readonly input: SkillInput; readonly context: TenantSkillContext }) => {
      const envelope: DecisionEnvelope = {
        schemaVersion: BRAIN_SCHEMA_VERSION,
        envelopeId: `env:${skillName}:${input.trigger.triggerId}`,
        tenantId: context.tenantId,
        skill: skillName,
        contextHash: input.contextHash,
        deterministicFallbackUsed: true,
        decisions: [
          {
            code: decisionCode,
            summary: `${skillName} read-only analysis stub executed`,
            confidence: 0,
            policyPath: context.policyPath,
            evidenceRefs: input.trigger.evidenceRefs,
          },
        ],
      };

      const memoryWrite: MemoryWrite = {
        schemaVersion: BRAIN_SCHEMA_VERSION,
        tenantId: context.tenantId,
        namespace: "event-ledger",
        entityId: `${skillName.toLowerCase()}-stub:${input.trigger.triggerId}`,
        value: `${skillName} stub completed with deterministic fallback`,
        contextHash: input.contextHash,
        evidenceRefs: input.trigger.evidenceRefs,
        atIso: input.trigger.occurredAt,
      };

      const output: SkillOutput = {
        schemaVersion: BRAIN_SCHEMA_VERSION,
        envelope,
        memoryWrites: [memoryWrite],
      };

      return output;
    },
  };
}

const internalSigningKeys = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const INTERNAL_SKILL_PRIVATE_KEY_PEM = internalSigningKeys.privateKey.export({
  format: "pem",
  type: "pkcs1",
}).toString();

const INTERNAL_SKILL_PUBLIC_KEY_PEM = internalSigningKeys.publicKey.export({
  format: "pem",
  type: "pkcs1",
}).toString();

export const financeSkill = createReadOnlyStubSkill("Finance", "FINANCE_READ_ONLY_STUB");
export const inventorySkill = createReadOnlyStubSkill(
  "Inventory",
  "INVENTORY_READ_ONLY_STUB"
);
export const posSkill = createReadOnlyStubSkill("POS", "POS_READ_ONLY_STUB");
export const supplierSkill = createReadOnlyStubSkill("Supplier", "SUPPLIER_READ_ONLY_STUB");

export const defaultSkillProvenancePins = [financeSkill, inventorySkill, posSkill, supplierSkill]
  .map((skill) => {
    if (!skill.manifest) {
      throw new Error(`manifest missing for skill ${skill.name}`);
    }
    return {
      skill: skill.name,
      expectedManifestHash: skill.manifest.manifestHash,
    };
  })
  .sort((left, right) => left.skill.localeCompare(right.skill));

export function registerInitialBrainSkills(registry: SkillRegistry): void {
  registry.register(financeSkill);
  registry.register(inventorySkill);
  registry.register(posSkill);
  registry.register(supplierSkill);
}
