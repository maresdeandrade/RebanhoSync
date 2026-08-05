// Safe cross-platform launcher for repository-owned Bash scripts.
import { existsSync, realpathSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = realpathSync(path.resolve(scriptDir, "..", ".."));

if (!existsSync(path.join(repoRoot, "package.json")) || !existsSync(path.join(repoRoot, ".git"))) {
  console.error("ERROR: launcher is not located under scripts/antigravity in a repository root.");
  process.exit(2);
}

function findBash() {
  const override = process.env.BASH_PATH?.trim();
  if (override) {
    if (!existsSync(override) || !statSync(override).isFile()) {
      throw new Error(`BASH_PATH does not point to a file: ${override}`);
    }
    return override;
  }

  if (process.platform !== "win32") return "bash";

  const candidates = [
    process.env.ProgramFiles
      ? path.join(process.env.ProgramFiles, "Git", "bin", "bash.exe")
      : null,
    process.env["ProgramFiles(x86)"]
      ? path.join(process.env["ProgramFiles(x86)"], "Git", "bin", "bash.exe")
      : null,
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe")
      : null,
    "C:\\ProgramData\\chocolatey\\bin\\bash.exe",
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function usage() {
  console.error(
    "Usage: node scripts/antigravity/run_bash.mjs <repository-script.sh> [script arguments...]",
  );
}

const [scriptArg, ...scriptArgs] = process.argv.slice(2);
if (!scriptArg) {
  usage();
  process.exit(2);
}

const requestedPath = path.resolve(repoRoot, scriptArg);
let scriptPath;
try {
  scriptPath = realpathSync(requestedPath);
} catch {
  console.error(`ERROR: script not found: ${scriptArg}`);
  process.exit(2);
}

const relativePath = path.relative(repoRoot, scriptPath);
if (
  relativePath === "" ||
  relativePath.startsWith(`..${path.sep}`) ||
  path.isAbsolute(relativePath)
) {
  console.error("ERROR: script must resolve to a file inside the repository.");
  process.exit(2);
}

if (!scriptPath.endsWith(".sh") || !statSync(scriptPath).isFile()) {
  console.error("ERROR: target must be a regular .sh file.");
  process.exit(2);
}

let bash;
try {
  bash = findBash();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(2);
}

if (!bash) {
  console.error("ERROR: bash not found on Windows.");
  console.error("Install Git for Windows or set BASH_PATH to bash.exe.");
  process.exit(2);
}

const child = spawn(bash, [scriptPath, ...scriptArgs], {
  stdio: "inherit",
  cwd: repoRoot,
  env: process.env,
  shell: false,
});

child.once("error", (error) => {
  console.error(`ERROR: could not start bash: ${error.message}`);
  process.exit(2);
});

child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`ERROR: bash terminated by signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
