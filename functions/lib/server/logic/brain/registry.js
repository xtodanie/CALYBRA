"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSkillRegistry = createSkillRegistry;
const contracts_1 = require("./contracts");
function createSkillRegistry(prechecks = defaultPrechecks) {
    const skills = new Map();
    return {
        register(skill) {
            if (skills.has(skill.name)) {
                throw new Error(`Skill already registered: ${skill.name}`);
            }
            skills.set(skill.name, skill);
        },
        execute(params) {
            const inputValidation = (0, contracts_1.validateSkillInput)(params.input);
            if (!inputValidation.valid) {
                return {
                    ok: false,
                    code: "INVALID_INPUT",
                    message: inputValidation.errors.join("; "),
                };
            }
            const contextValidation = (0, contracts_1.validateTenantSkillContext)(params.context);
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
            const outputValidation = (0, contracts_1.validateSkillOutput)(output);
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
            const hasCrossTenantMemoryWrite = output.memoryWrites.some((entry) => entry.tenantId !== params.context.tenantId);
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
const defaultPrechecks = [
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
//# sourceMappingURL=registry.js.map