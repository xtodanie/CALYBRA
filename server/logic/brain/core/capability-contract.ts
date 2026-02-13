export interface SkillCapabilityContract {
  readonly minRuntimeVersion: string;
  readonly requiredModelFamilies: readonly string[];
  readonly requiredTools: readonly string[];
  readonly supportedSkillMajorVersions: readonly number[];
}

export interface RuntimeCapabilityContext {
  readonly runtimeVersion: string;
  readonly modelFamily: string;
  readonly availableTools: readonly string[];
  readonly skillVersion: string;
}

export interface CapabilityNegotiationOutcome {
  readonly allowed: boolean;
  readonly reasonCode:
    | "CAPABILITY_OK"
    | "CAPABILITY_RUNTIME_VERSION_UNSUPPORTED"
    | "CAPABILITY_MODEL_UNSUPPORTED"
    | "CAPABILITY_TOOL_MISSING"
    | "CAPABILITY_SKILL_VERSION_UNSUPPORTED";
  readonly reasons: readonly string[];
}

function parseSemverMajor(version: string): number {
  const [major] = version.trim().split(".");
  const parsed = Number.parseInt(major ?? "", 10);
  return Number.isFinite(parsed) ? parsed : -1;
}

function parseSemver(version: string): { major: number; minor: number; patch: number } {
  const parts = version.trim().split(".");
  const major = Number.parseInt(parts[0] ?? "", 10);
  const minor = Number.parseInt(parts[1] ?? "0", 10);
  const patch = Number.parseInt(parts[2] ?? "0", 10);
  return {
    major: Number.isFinite(major) ? major : -1,
    minor: Number.isFinite(minor) ? minor : -1,
    patch: Number.isFinite(patch) ? patch : -1,
  };
}

function isRuntimeAtLeast(actual: string, minRequired: string): boolean {
  const left = parseSemver(actual);
  const right = parseSemver(minRequired);
  if (left.major !== right.major) {
    return left.major > right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor > right.minor;
  }
  return left.patch >= right.patch;
}

export function negotiateSkillCapabilities(
  contract: SkillCapabilityContract,
  runtime: RuntimeCapabilityContext
): CapabilityNegotiationOutcome {
  const missingTools = contract.requiredTools.filter((tool) => !runtime.availableTools.includes(tool));
  const reasons: string[] = [];

  if (!isRuntimeAtLeast(runtime.runtimeVersion, contract.minRuntimeVersion)) {
    reasons.push(`runtime ${runtime.runtimeVersion} is below minimum ${contract.minRuntimeVersion}`);
    return {
      allowed: false,
      reasonCode: "CAPABILITY_RUNTIME_VERSION_UNSUPPORTED",
      reasons,
    };
  }

  if (!contract.requiredModelFamilies.includes(runtime.modelFamily)) {
    reasons.push(`model family ${runtime.modelFamily} is not allowed by contract`);
    return {
      allowed: false,
      reasonCode: "CAPABILITY_MODEL_UNSUPPORTED",
      reasons,
    };
  }

  if (missingTools.length > 0) {
    reasons.push(`missing required tools: ${missingTools.join(",")}`);
    return {
      allowed: false,
      reasonCode: "CAPABILITY_TOOL_MISSING",
      reasons,
    };
  }

  const skillMajorVersion = parseSemverMajor(runtime.skillVersion);
  if (!contract.supportedSkillMajorVersions.includes(skillMajorVersion)) {
    reasons.push(`skill major version ${skillMajorVersion} is not supported`);
    return {
      allowed: false,
      reasonCode: "CAPABILITY_SKILL_VERSION_UNSUPPORTED",
      reasons,
    };
  }

  return {
    allowed: true,
    reasonCode: "CAPABILITY_OK",
    reasons: [],
  };
}
