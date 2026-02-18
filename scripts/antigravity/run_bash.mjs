// scripts/antigravity/run_bash.mjs
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

function findBash() {
  if (process.platform !== "win32") return "bash";

  // Allow override
  if (process.env.BASH_PATH && existsSync(process.env.BASH_PATH)) {
    return process.env.BASH_PATH;
  }

  const candidates = [
    // Git for Windows (most common)
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "Git", "bin", "bash.exe") : null,
    process.env["ProgramFiles(x86)"] ? path.join(process.env["ProgramFiles(x86)"], "Git", "bin", "bash.exe") : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe") : null,

    // Some installs expose bash here
    "C:\\ProgramData\\chocolatey\\bin\\bash.exe",
  ].filter(Boolean);

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

const bash = findBash();
if (!bash) {
  console.error("ERROR: bash not found on Windows.");
  console.error("Install Git for Windows OR set BASH_PATH to bash.exe, e.g.:");
  console.error('  setx BASH_PATH "C:\\\\Program Files\\\\Git\\\\bin\\\\bash.exe"');
  process.exit(2);
}

const script = process.argv[2];
if (!script) {
  console.error("Usage: node scripts/antigravity/run_bash.mjs <script.sh>");
  process.exit(2);
}

// Normalize path for bash
const scriptPath = script.replaceAll("\\", "/");

// Execute in repo root
const child = spawn(bash, ["-lc", `./${scriptPath}`], {
  stdio: "inherit",
  cwd: process.cwd(),
});

child.on("exit", (code) => process.exit(code ?? 1));
