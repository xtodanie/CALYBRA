import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8080;

function getEmulatorHostPort() {
  const raw = process.env.FIRESTORE_EMULATOR_HOST;
  if (!raw) return { host: DEFAULT_HOST, port: DEFAULT_PORT };

  const [host, portRaw] = raw.split(":");
  const port = Number(portRaw);
  return {
    host: host || DEFAULT_HOST,
    port: Number.isFinite(port) ? port : DEFAULT_PORT,
  };
}

export async function initTestEnv(projectId: string) {
  const { host, port } = getEmulatorHostPort();
  return initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
}
