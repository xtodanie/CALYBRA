"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierSkill = exports.posSkill = exports.inventorySkill = exports.financeSkill = void 0;
exports.registerInitialBrainSkills = registerInitialBrainSkills;
const contracts_1 = require("./contracts");
function createReadOnlyStubSkill(skillName, decisionCode) {
    return {
        name: skillName,
        version: "1.0.0",
        execute: ({ input, context }) => {
            const envelope = {
                schemaVersion: contracts_1.BRAIN_SCHEMA_VERSION,
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
            const memoryWrite = {
                schemaVersion: contracts_1.BRAIN_SCHEMA_VERSION,
                tenantId: context.tenantId,
                namespace: "event-ledger",
                entityId: `${skillName.toLowerCase()}-stub:${input.trigger.triggerId}`,
                value: `${skillName} stub completed with deterministic fallback`,
                contextHash: input.contextHash,
                evidenceRefs: input.trigger.evidenceRefs,
                atIso: input.trigger.occurredAt,
            };
            const output = {
                schemaVersion: contracts_1.BRAIN_SCHEMA_VERSION,
                envelope,
                memoryWrites: [memoryWrite],
            };
            return output;
        },
    };
}
exports.financeSkill = createReadOnlyStubSkill("Finance", "FINANCE_READ_ONLY_STUB");
exports.inventorySkill = createReadOnlyStubSkill("Inventory", "INVENTORY_READ_ONLY_STUB");
exports.posSkill = createReadOnlyStubSkill("POS", "POS_READ_ONLY_STUB");
exports.supplierSkill = createReadOnlyStubSkill("Supplier", "SUPPLIER_READ_ONLY_STUB");
function registerInitialBrainSkills(registry) {
    registry.register(exports.financeSkill);
    registry.register(exports.inventorySkill);
    registry.register(exports.posSkill);
    registry.register(exports.supplierSkill);
}
//# sourceMappingURL=skills.js.map