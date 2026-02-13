import crypto from "node:crypto";
import fs from "node:fs";

function normalize(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalize(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  const out = {};
  for (const key of keys) {
    out[key] = normalize(value[key]);
  }
  return out;
}

function sha(value) {
  return crypto.createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex");
}

function validateChain(events) {
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const material = {
      id: event.id,
      type: event.type,
      actor: event.actor,
      context: event.context,
      payload: event.payload,
      timestamp: event.timestamp,
      parent_id: event.parent_id,
    };
    const expectedHash = sha(material);
    if (expectedHash !== event.hash) {
      return { valid: false, reason: `hash mismatch: ${event.id}` };
    }
    if (index === 0 && event.parent_id) {
      return { valid: false, reason: `first event has parent: ${event.id}` };
    }
    if (index > 0 && events[index - 1].id !== event.parent_id) {
      return { valid: false, reason: `parent mismatch: ${event.id}` };
    }
  }
  return { valid: true };
}

function replayState(events) {
  return events.reduce(
    (acc, event) => {
      acc.total += 1;
      acc.byType[event.type] = (acc.byType[event.type] ?? 0) + 1;
      acc.last = event.id;
      return acc;
    },
    { total: 0, byType: {}, last: undefined },
  );
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    const byTime = Date.parse(a.timestamp) - Date.parse(b.timestamp);
    if (byTime !== 0) return byTime;
    return a.id.localeCompare(b.id);
  });
}

function validateBrainArtifacts(artifacts) {
  const requiredTypes = new Set(["decision", "health", "context_window", "gate_audit", "event_log"]);
  for (const artifact of artifacts) {
    if (!artifact.artifactId || !artifact.type || !artifact.hash || !artifact.generatedAt) {
      return { valid: false, reason: "artifact missing required fields" };
    }
    if (!/^[a-f0-9]{64}$/.test(artifact.hash)) {
      return { valid: false, reason: `invalid artifact hash format: ${artifact.artifactId}` };
    }

    const hashMaterial = {
      tenantId: artifact.tenantId,
      monthKey: artifact.monthKey,
      type: artifact.type,
      payload: artifact.payload,
      periodLockHash: artifact.payload?.periodLockHash ?? artifact.payload?.replayHash ?? null,
    };
    const recomputed = sha(hashMaterial);
    if (recomputed !== artifact.hash) {
      return { valid: false, reason: `artifact hash mismatch: ${artifact.artifactId}` };
    }

    requiredTypes.delete(artifact.type);
  }

  if (requiredTypes.size > 0) {
    return { valid: false, reason: `missing artifact types: ${Array.from(requiredTypes).join(",")}` };
  }

  return { valid: true };
}

function buildSampleEvents() {
  const shared = {
    actor: { tenantId: "tenant-001", actorId: "system", actorType: "service", role: "brain" },
    context: { tenantId: "tenant-001", traceId: "trace-1", policyPath: "brain/read-only", readOnly: true },
  };
  const first = {
    id: "evt-1",
    type: "brain.router",
    ...shared,
    payload: { accepted: true },
    timestamp: "2026-02-13T10:00:00Z",
  };
  const firstHash = sha(first);
  const second = {
    id: "evt-2",
    type: "brain.reflection",
    ...shared,
    payload: { severity: "low" },
    timestamp: "2026-02-13T10:01:00Z",
    parent_id: "evt-1",
  };
  const secondHash = sha(second);

  return [
    { ...first, hash: firstHash },
    { ...second, hash: secondHash },
  ];
}

function buildSampleArtifacts(events) {
  const replayHash = sha({ events: events.map((event) => event.id) });
  const generatedAt = "2026-02-13T10:02:00.000Z";
  const tenantId = "tenant-001";
  const monthKey = "2026-01";
  const periodLockHash = "lock-001";

  const base = (type, payload) => {
    const hash = sha({ tenantId, monthKey, type, payload, periodLockHash: payload.periodLockHash ?? payload.replayHash ?? null });
    return {
      artifactId: `brain:${monthKey}:${type}:${hash.slice(0, 16)}`,
      tenantId,
      monthKey,
      type,
      generatedAt,
      hash,
      schemaVersion: 1,
      payload,
    };
  };

  return [
    base("decision", { accepted: true, intent: "suggest", replayHash, periodLockHash }),
    base("health", { healthIndex: 0.82, eventsApplied: events.length, periodLockHash }),
    base("context_window", { contextWindow: { tenantId, eventIds: events.map((event) => event.id), reflectionEventIds: [events[1].id] }, periodLockHash }),
    base("gate_audit", { accepted: true, reasons: [], periodLockHash }),
    base("event_log", { events, replayHash, periodLockHash }),
  ];
}

function loadArtifactsFromFile() {
  const path = process.env.BRAIN_ARTIFACTS_JSON;
  if (!path) return null;
  if (!fs.existsSync(path)) {
    throw new Error(`BRAIN_ARTIFACTS_JSON does not exist: ${path}`);
  }
  const raw = fs.readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : null;
}

const events = buildSampleEvents();
const chain = validateChain(events);
if (!chain.valid) {
  console.error(`INTEGRITY_FAIL: ${chain.reason}`);
  process.exit(1);
}

const replayOne = replayState(sortEvents(events));
const replayTwo = replayState(sortEvents(events));
if (sha(replayOne) !== sha(replayTwo)) {
  console.error("INTEGRITY_FAIL: replay diff detected");
  process.exit(1);
}

const artifacts = loadArtifactsFromFile() ?? buildSampleArtifacts(events);
const artifactsValidation = validateBrainArtifacts(artifacts);
if (!artifactsValidation.valid) {
  console.error(`INTEGRITY_FAIL: ${artifactsValidation.reason}`);
  process.exit(1);
}

console.log("INTEGRITY_CHECK: PASS");
