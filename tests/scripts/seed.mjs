import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { Timestamp } from "firebase/firestore";

function readJsonSync(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function getProjectId() {
  const firebaseRc = readJsonSync(".firebaserc");
  return firebaseRc.projects?.default || "demo-calybra";
}

function getEmulatorHostPort() {
  const config = readJsonSync("firebase.json");
  const host = config.emulators?.firestore?.host || "127.0.0.1";
  const port = config.emulators?.firestore?.port || 8085;
  return { host, port };
}

function isLocalHost(host) {
  return host === "127.0.0.1" || host === "localhost";
}

async function loadSeedFile(fileName) {
  const filePath = path.join(process.cwd(), "seed", fileName);
  if (!existsSync(filePath)) return [];
  const data = await readFile(filePath, "utf8");
  return JSON.parse(data);
}

const projectId = getProjectId();
const { host, port } = getEmulatorHostPort();

if (!isLocalHost(host)) {
  console.error("Refusing to seed: Firestore host is not local.");
  process.exit(1);
}

const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { host, port },
});

if (process.argv.includes("--reset")) {
  await testEnv.clearFirestore();
}

const topCollections = ["tenants", "users"];
const tenantCollections = [
  "monthCloses",
  "invoices",
  "bankTx",
  "matches",
  "fileAssets",
];

const timestampKeys = new Set([
  "createdAt",
  "updatedAt",
  "periodStart",
  "periodEnd",
  "confirmedAt",
  "finalizedAt",
  "parsedAt",
]);

function normalizeTimestamps(input) {
  if (!input || typeof input !== "object") return input;
  const output = Array.isArray(input) ? [] : {};
  for (const [key, value] of Object.entries(input)) {
    if (timestampKeys.has(key) && typeof value === "string") {
      output[key] = Timestamp.fromDate(new Date(value));
    } else if (Array.isArray(value)) {
      output[key] = value.map((item) => normalizeTimestamps(item));
    } else if (value && typeof value === "object") {
      output[key] = normalizeTimestamps(value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

await testEnv.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();
  for (const collection of topCollections) {
    const docs = await loadSeedFile(`${collection}.json`);
    for (const doc of docs) {
      const id = doc.id;
      if (!id) continue;
      await db.collection(collection).doc(id).set(normalizeTimestamps({ ...doc, id }));
    }
  }

  for (const collection of tenantCollections) {
    const docs = await loadSeedFile(`${collection}.json`);
    for (const doc of docs) {
      const id = doc.id;
      const tenantId = doc.tenantId;
      if (!id || !tenantId) continue;
      await db
        .collection("tenants")
        .doc(tenantId)
        .collection(collection)
        .doc(id)
        .set(normalizeTimestamps({ ...doc, id }));
    }
  }
});

await testEnv.cleanup();
console.log("Seed complete.");
