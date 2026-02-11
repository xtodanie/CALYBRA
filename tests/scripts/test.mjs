import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function run(cmd) {
  const result = spawnSync(cmd, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function getFunctionsSources() {
  const firebaseConfig = readJson("firebase.json");
  const functions = firebaseConfig.functions;
  if (!functions) return [];
  if (Array.isArray(functions)) {
    return functions.map((fn) => fn.source).filter(Boolean);
  }
  if (typeof functions === "object" && functions.source) {
    return [functions.source];
  }
  return [];
}

function runPackageScripts(dir) {
  const pkgPath = `${dir}/package.json`;
  if (!existsSync(pkgPath)) return;
  const nodeModulesPath = `${dir}/node_modules`;
  if (!existsSync(nodeModulesPath)) {
    run(`npm --prefix "${dir}" install`);
  }
  const pkg = readJson(pkgPath);
  const scripts = pkg.scripts || {};

  if (scripts.build) {
    run(`npm --prefix "${dir}" run build`);
  }
  if (scripts.test) {
    run(`npm --prefix "${dir}" run test`);
  }
}

run("npm run lint");
run("npm run typecheck");
run("firebase emulators:exec --only firestore \"npm test\"");

const sources = getFunctionsSources();
for (const source of sources) {
  runPackageScripts(source);
}
