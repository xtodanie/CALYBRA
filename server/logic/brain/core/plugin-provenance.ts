import crypto from "node:crypto";
import { canonicalJson, stableSha256Hex } from "./hash";
import { SkillCapabilityContract } from "./capability-contract";

export interface SkillManifestPayload {
  readonly skill: string;
  readonly version: string;
  readonly featureFlag: string;
  readonly capabilities: SkillCapabilityContract;
}

export interface SignedSkillManifest {
  readonly payload: SkillManifestPayload;
  readonly manifestHash: string;
  readonly signatureBase64: string;
  readonly publicKeyPem: string;
}

export interface PluginProvenancePin {
  readonly skill: string;
  readonly expectedManifestHash: string;
}

export interface PluginProvenanceOutcome {
  readonly valid: boolean;
  readonly reasonCode:
    | "PROVENANCE_OK"
    | "PROVENANCE_SIGNATURE_INVALID"
    | "PROVENANCE_HASH_MISMATCH"
    | "PROVENANCE_PIN_MISMATCH";
}

export function computeManifestHash(payload: SkillManifestPayload): string {
  return stableSha256Hex(payload);
}

export function signSkillManifest(
  payload: SkillManifestPayload,
  privateKeyPem: string,
  publicKeyPem: string
): SignedSkillManifest {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(canonicalJson(payload));
  signer.end();
  const signatureBase64 = signer.sign(privateKeyPem).toString("base64");

  return {
    payload,
    manifestHash: computeManifestHash(payload),
    signatureBase64,
    publicKeyPem,
  };
}

export function verifyPluginProvenance(
  manifest: SignedSkillManifest,
  pin?: PluginProvenancePin
): PluginProvenanceOutcome {
  const computedHash = computeManifestHash(manifest.payload);
  if (computedHash !== manifest.manifestHash) {
    return {
      valid: false,
      reasonCode: "PROVENANCE_HASH_MISMATCH",
    };
  }

  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(canonicalJson(manifest.payload));
    verifier.end();
    const signatureValid = verifier.verify(
      manifest.publicKeyPem,
      Buffer.from(manifest.signatureBase64, "base64")
    );
    if (!signatureValid) {
      return {
        valid: false,
        reasonCode: "PROVENANCE_SIGNATURE_INVALID",
      };
    }
  } catch {
    return {
      valid: false,
      reasonCode: "PROVENANCE_SIGNATURE_INVALID",
    };
  }

  if (pin && pin.expectedManifestHash !== manifest.manifestHash) {
    return {
      valid: false,
      reasonCode: "PROVENANCE_PIN_MISMATCH",
    };
  }

  return {
    valid: true,
    reasonCode: "PROVENANCE_OK",
  };
}
