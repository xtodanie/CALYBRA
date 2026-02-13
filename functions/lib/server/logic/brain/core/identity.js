"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.identityPayloadDigest = identityPayloadDigest;
exports.verifyIdentityBinding = verifyIdentityBinding;
const node_crypto_1 = __importDefault(require("node:crypto"));
const hash_1 = require("./hash");
function identityPayloadDigest(payload) {
    return (0, hash_1.stableSha256Hex)(payload);
}
function verifyIdentityBinding(params) {
    try {
        const verifier = node_crypto_1.default.createVerify("RSA-SHA256");
        verifier.update((0, hash_1.canonicalJson)(params.payload));
        verifier.end();
        return verifier.verify(params.publicKeyPem, Buffer.from(params.signatureBase64, "base64"));
    }
    catch (_a) {
        return false;
    }
}
//# sourceMappingURL=identity.js.map