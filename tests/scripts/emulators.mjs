import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const firebaseRc = JSON.parse(readFileSync(".firebaserc", "utf8"));
const projectId = firebaseRc.projects?.default;

const cmd = projectId
  ? `firebase emulators:start --only auth,firestore,storage --project ${projectId}`
  : "firebase emulators:start --only auth,firestore,storage";

const result = spawnSync(cmd, { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
