import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_FILE_PATTERN = /(?:^|\/)(?:[^/]+\.)?(?:test|spec)\.[cm]?[jt]sx?$/;

function normalizeFiles(files) {
  return [...new Set(files.map((file) => file.trim().replaceAll("\\", "/")).filter(Boolean))];
}

function isDocsFile(file) {
  return file.startsWith("docs/") || file.endsWith(".md") || path.posix.basename(file) === "AGENTS.md";
}

/**
 * TEST_ONLY significa "teste que pode ser direcionado ao Vitest".
 *
 * Playwright vive em e2e/** e usa runner próprio, portanto não deve entrar
 * automaticamente na seleção incremental do Vitest.
 */
function isTestFile(file) {
  if (file.startsWith("e2e/")) return false;

  return (
    file.startsWith("tests/") ||
    file.includes("/__tests__/") ||
    TEST_FILE_PATTERN.test(file)
  );
}

function isFullFile(file) {
  return (
    file.startsWith("supabase/") ||
    file.startsWith("src/lib/offline/") ||
    file.startsWith("src/lib/auth/") ||
    /^src\/hooks\/useAuth\.[^/]+$/.test(file) ||
    file.startsWith("src/lib/events/") ||
    file.startsWith("src/lib/comercial/") ||
    file.startsWith("src/lib/sanitario/") ||
    file.startsWith("src/lib/reproduction/") ||
    file.startsWith("src/lib/finance/") ||
    file === "src/lib/supabase.ts" ||
    file === "src/lib/env.ts" ||
    file.startsWith("scripts/ci/") ||
    file.startsWith(".github/workflows/") ||
    file === ".env.example" ||
    file === "package.json" ||
    file === "pnpm-lock.yaml"
  );
}

function hasOnlyTestExecutableFiles(files) {
  const executableFiles = files.filter((file) => !isDocsFile(file));

  return executableFiles.length > 0 && executableFiles.every(isTestFile);
}

export function classifyPrScope(files, known = true) {
  const normalized = normalizeFiles(files);

  if (!known || normalized.length === 0) return "FULL";

  if (normalized.every(isDocsFile)) return "DOCS";

  // Importante: testes puros dentro de diretórios críticos continuam sendo
  // TEST_ONLY. Um PR misto runtime + testes continuará caindo em FULL abaixo.
  if (hasOnlyTestExecutableFiles(normalized)) return "TEST_ONLY";

  if (normalized.some(isFullFile)) return "FULL";

  return "APP";
}

export function classifyDeltaScope(files, known = true) {
  const normalized = normalizeFiles(files);

  if (!known || normalized.length === 0) return "UNKNOWN";

  if (normalized.every(isDocsFile)) return "DOCS_ONLY";

  if (hasOnlyTestExecutableFiles(normalized)) return "TEST_ONLY";

  if (normalized.some(isFullFile)) return "FULL";

  return "APP";
}

export function deriveExecution({ prScope, deltaScope, finalGate = false }) {
  if (finalGate) {
    return {
      needsApp: true,
      needsSupabase: true,
      needsBuild: true,
      runGlobalTests: true,
      fullFinalRequired: true,
    };
  }

  const fullFinalRequired = prScope === "FULL";
  const effectiveScope = deltaScope === "UNKNOWN" ? prScope : deltaScope;

  return {
    needsApp: !["DOCS", "DOCS_ONLY"].includes(effectiveScope),
    needsSupabase: effectiveScope === "FULL",
    needsBuild: ["APP", "FULL"].includes(effectiveScope),
    runGlobalTests: !["DOCS", "DOCS_ONLY", "TEST_ONLY"].includes(effectiveScope),
    fullFinalRequired,
  };
}

function testDirectoryTarget(file) {
  const segments = file.split("/");
  const testsIndex = segments.indexOf("__tests__");

  if (testsIndex >= 0) {
    return segments.slice(0, testsIndex + 1).join("/");
  }

  if (segments[0] === "tests") {
    return segments.slice(0, Math.min(2, segments.length - 1)).join("/");
  }

  return null;
}

export function selectTestTargets(files) {
  const targets = [];

  for (const file of normalizeFiles(files).filter((item) => !isDocsFile(item))) {
    // Não enviar Playwright/e2e para o runner Vitest.
    if (isTestFile(file) && TEST_FILE_PATTERN.test(file)) {
      targets.push(file);
      continue;
    }

    if (!isTestFile(file)) continue;

    const directory = testDirectoryTarget(file);

    if (directory) {
      targets.push(directory);
    }
  }

  return [...new Set(targets)];
}

function readFileList(file) {
  if (!file || !fs.existsSync(file)) return [];

  return fs.readFileSync(file, "utf8").split(/\r?\n/);
}

function parseArgs(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.replace(/^--/, "");

    if (!key || args[index + 1] === undefined) {
      throw new Error(`Invalid argument: ${args[index] ?? ""}`);
    }

    options[key] = args[index + 1];
  }

  return options;
}

function toBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;

  throw new Error(`Expected true or false, received: ${value}`);
}

function runCli(args) {
  const [command, ...rest] = args;

  if (command === "test-targets") {
    const [file] = rest;

    for (const target of selectTestTargets(readFileList(file))) {
      console.log(target);
    }

    return;
  }

  if (command !== "classify") {
    throw new Error("Expected command: classify or test-targets");
  }

  const options = parseArgs(rest);
  const finalGate = toBoolean(options["final-gate"], false);

  const prScope = finalGate
    ? "FULL"
    : classifyPrScope(readFileList(options["pr-files"]), toBoolean(options["pr-known"], false));

  const deltaScope = finalGate
    ? "FULL"
    : classifyDeltaScope(
        readFileList(options["delta-files"]),
        toBoolean(options["delta-known"], false),
      );

  const execution = deriveExecution({
    prScope,
    deltaScope,
    finalGate,
  });

  const outputs = {
    pr_scope: prScope,
    delta_scope: deltaScope,
    needs_app: execution.needsApp,
    needs_supabase: execution.needsSupabase,
    needs_build: execution.needsBuild,
    run_global_tests: execution.runGlobalTests,
    full_final_required: execution.fullFinalRequired,
    final_gate: finalGate,
  };

  for (const [key, value] of Object.entries(outputs)) {
    console.log(`${key}=${value}`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}