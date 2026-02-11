import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";

export async function initTestEnv(projectId: string) {
  return initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
}
