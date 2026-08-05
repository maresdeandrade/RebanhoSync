#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const APPLY_CONFIRMATION = "FIX_DOCS_ENCODING";
const DEFAULT_DIRECTORY = "docs";
const MAX_PASSES = 3;
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

// Somente sequências suficientemente específicas e inequívocas.
// Não adicionar substituições de um único caractere, como `À` ou `Â`.
const REPLACEMENTS = new Map([
  ["âœ…", "✅"],
  ["âœ¨", "✨"],
  ["âš ï¸", "⚠️"],
  ["âš ", "⚠"],
  ["âŒ", "❌"],
  ["â†’", "→"],
  ["â‰ ", "≠"],
  ["âˆˆ", "∈"],
  ["â€”", "—"],
  ["â€“", "–"],
  ["â€œ", "“"],
  ["â€", "”"],
  ["â€˜", "‘"],
  ["â€™", "’"],
  ["â€¦", "…"],
  ["Â ", "\u00a0"],
  ["Â­", ""],
  ["Ã§", "ç"],
  ["Ã£", "ã"],
  ["Ãµ", "õ"],
  ["Ã¡", "á"],
  ["Ã©", "é"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ãº", "ú"],
  ["Ã¢", "â"],
  ["Ãª", "ê"],
  ["Ã´", "ô"],
  ["Ã€", "À"],
  ["Ã", "Á"],
  ["Ã‰", "É"],
  ["Ã", "Í"],
  ["Ã“", "Ó"],
  ["Ãš", "Ú"],
  ["Ã‚", "Â"],
  ["ÃŠ", "Ê"],
  ["Ã”", "Ô"],
  ["Ã‡", "Ç"],
  ["Ãƒ", "Ã"],
  ["Ã•", "Õ"],
  ["Ã±", "ñ"],
  ["Ã‘", "Ñ"],
  ["Ã¼", "ü"],
  ["Ãœ", "Ü"],
]);

const SUSPICIOUS_PATTERN = /(?:Ã.|Â.|â(?:€|œ|š|†|‰|ˆ|)|\uFFFD)/gu;

function usage() {
  console.log(`Uso:
  node fix-docs-encoding.mjs [--root <diretório>] [--check]
  node fix-docs-encoding.mjs [--root <diretório>] --apply --confirm ${APPLY_CONFIRMATION}

Opções:
  --root <dir>       Raiz a examinar. Padrão: ./${DEFAULT_DIRECTORY}
  --check            Retorna código 1 se houver arquivos a corrigir ou suspeitas
  --apply            Grava correções inequívocas de forma atômica
  --confirm <texto>  Confirmação obrigatória para --apply
  --verbose          Lista também arquivos sem alteração
  --help             Mostra esta ajuda

O modo padrão é somente diagnóstico e não altera arquivos.`);
}

function parseArgs(argv) {
  const options = {
    apply: false,
    check: false,
    confirmation: "",
    root: DEFAULT_DIRECTORY,
    verbose: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--check") options.check = true;
    else if (argument === "--verbose") options.verbose = true;
    else if (argument === "--help" || argument === "-h") {
      usage();
      process.exit(0);
    } else if (argument === "--root" || argument === "--confirm") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Valor ausente para ${argument}.`);
      }
      if (argument === "--root") options.root = value;
      else options.confirmation = value;
      index += 1;
    } else {
      throw new Error(`Argumento desconhecido: ${argument}`);
    }
  }

  if (options.apply && options.check) {
    throw new Error("Use --apply ou --check, não ambos.");
  }
  if (options.apply && options.confirmation !== APPLY_CONFIRMATION) {
    throw new Error(
      `--apply exige --confirm ${APPLY_CONFIRMATION}. Nenhum arquivo foi alterado.`,
    );
  }
  if (!options.apply && options.confirmation) {
    throw new Error("--confirm só pode ser usado com --apply.");
  }

  return options;
}

function resolveRoot(rootArgument) {
  const absoluteRoot = path.resolve(process.cwd(), rootArgument);
  let stats;
  try {
    stats = fs.lstatSync(absoluteRoot);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Diretório não encontrado: ${absoluteRoot}`);
    }
    throw error;
  }

  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`A raiz deve ser um diretório real, não um symlink: ${absoluteRoot}`);
  }
  if (absoluteRoot === path.parse(absoluteRoot).root) {
    throw new Error("A raiz do sistema de arquivos não é permitida.");
  }

  return fs.realpathSync(absoluteRoot);
}

function listMarkdownFiles(root) {
  const files = [];

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) visit(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

const ORDERED_REPLACEMENTS = [...REPLACEMENTS.entries()].sort(
  ([left], [right]) => right.length - left.length,
);

function fixText(input) {
  let text = input;
  let replacementCount = 0;

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    let passCount = 0;
    for (const [broken, corrected] of ORDERED_REPLACEMENTS) {
      if (!text.includes(broken)) continue;
      const parts = text.split(broken);
      passCount += parts.length - 1;
      text = parts.join(corrected);
    }
    replacementCount += passCount;
    if (passCount === 0) break;
  }

  return { replacementCount, text };
}

function findSuspicious(text) {
  return [...new Set(text.match(SUSPICIOUS_PATTERN) ?? [])].sort();
}

function atomicWrite(filePath, content, mode) {
  const temporaryPath = `${filePath}.encoding-fix-${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, content, { encoding: "utf8", mode });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = resolveRoot(options.root);
  const files = listMarkdownFiles(root);
  const changed = [];
  const unresolved = [];

  for (const filePath of files) {
    const original = fs.readFileSync(filePath, "utf8");
    if (original.includes("\uFFFD")) {
      unresolved.push({ filePath, patterns: ["U+FFFD"] });
      continue;
    }

    const fixed = fixText(original);
    const suspicious = findSuspicious(fixed.text);
    if (suspicious.length > 0) unresolved.push({ filePath, patterns: suspicious });

    if (fixed.text !== original) {
      changed.push({ filePath, replacementCount: fixed.replacementCount });
      if (options.apply) {
        atomicWrite(filePath, fixed.text, fs.statSync(filePath).mode);
      }
      console.log(
        `${options.apply ? "CORRIGIDO" : "CORRIGIRIA"} ${path.relative(process.cwd(), filePath)} (${fixed.replacementCount} substituições)`,
      );
    } else if (options.verbose) {
      console.log(`OK ${path.relative(process.cwd(), filePath)}`);
    }
  }

  for (const item of unresolved) {
    console.warn(
      `REVISÃO MANUAL ${path.relative(process.cwd(), item.filePath)}: ${item.patterns.join(", ")}`,
    );
  }

  console.log(
    `Resumo: ${files.length} Markdown; ${changed.length} com correções inequívocas; ${unresolved.length} com suspeitas residuais; modo=${options.apply ? "apply" : options.check ? "check" : "dry-run"}.`,
  );

  if (options.check && (changed.length > 0 || unresolved.length > 0)) {
    process.exitCode = 1;
  } else if (unresolved.length > 0) {
    process.exitCode = 2;
  }
}

try {
  main();
} catch (error) {
  console.error(`Erro: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
