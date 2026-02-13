import crypto from "node:crypto";
import { canonicalJson, stableSha256Hex } from "./hash";

export interface IdentityBindingPayload {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorRole: string;
  readonly nonce: string;
  readonly issuedAt: string;
}

export function identityPayloadDigest(payload: IdentityBindingPayload): string {
  return stableSha256Hex(payload);
}

export function verifyIdentityBinding(params: {
  readonly payload: IdentityBindingPayload;
  readonly signatureBase64: string;
  readonly publicKeyPem: string;
}): boolean {
  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(canonicalJson(params.payload));
    verifier.end();
    return verifier.verify(params.publicKeyPem, Buffer.from(params.signatureBase64, "base64"));
  } catch {
    return false;
  }
}
