"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateMemoryAcl = evaluateMemoryAcl;
const READ_ALLOWED_ROLES = new Set(["owner", "admin", "auditor", "controller", "service"]);
const APPEND_ALLOWED_ROLES = new Set(["service", "controller", "owner", "admin"]);
function evaluateMemoryAcl(request) {
    if (request.tenantId !== request.actorTenantId) {
        return { allowed: false, reason: "cross-tenant memory access denied" };
    }
    if (request.action === "read-artifact") {
        if (!READ_ALLOWED_ROLES.has(request.actorRole)) {
            return { allowed: false, reason: "role not allowed to read artifact" };
        }
        return { allowed: true, reason: "read allowed" };
    }
    if (request.action === "append-artifact" || request.action === "append-event") {
        if (!APPEND_ALLOWED_ROLES.has(request.actorRole)) {
            return { allowed: false, reason: "role not allowed to append artifact/event" };
        }
        return { allowed: true, reason: "append allowed" };
    }
    if (request.action === "snapshot-write") {
        if (request.actorRole !== "service" && request.actorRole !== "controller") {
            return { allowed: false, reason: "role not allowed to write snapshot" };
        }
        return { allowed: true, reason: "snapshot write allowed" };
    }
    return { allowed: false, reason: "unknown memory action" };
}
//# sourceMappingURL=memory-acl.js.map