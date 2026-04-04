import type { LoteStatusEnum, TipoPastoEnum } from "@/lib/offline/types";
import { normalizeLookupValue } from "./animaisCsv";

export type StructureImportIssue = {
  lineNumber: number;
  field: string;
  message: string;
};

export type PastoImportRow = {
  lineNumber: number;
  nome: string;
  areaHa: number;
  capacidadeUa: number | null;
  tipoPasto: TipoPastoEnum;
  observacoes: string | null;
};

export type LoteImportRow = {
  lineNumber: number;
  nome: string;
  status: LoteStatusEnum;
  pastoNome: string | null;
  observacoes: string | null;
};

export type StructureImportParseResult<Row> = {
  delimiter: "," | ";" | "\t";
  headers: string[];
  rows: Row[];
  issues: StructureImportIssue[];
};

const PASTO_HEADER_ALIASES: Record<string, string[]> = {
  nome: ["nome", "pasto", "nome_pasto"],
  areaHa: ["area_ha", "area", "hectares", "ha"],
  capacidadeUa: ["capacidade_ua", "capacidade", "ua"],
  tipoPasto: ["tipo_pasto", "tipo", "pastagem"],
  observacoes: ["observacoes", "observacao", "obs", "descricao"],
};

const LOTE_HEADER_ALIASES: Record<string, string[]> = {
  nome: ["nome", "lote", "nome_lote"],
  status: ["status", "situacao"],
  pastoNome: ["pasto", "nome_pasto", "pasto_nome"],
  observacoes: ["observacoes", "observacao", "obs", "descricao"],
};

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeHeader(value: string) {
  return stripDiacritics(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function detectDelimiter(text: string): "," | ";" | "\t" {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) return ";";

  const candidates: Array<"," | ";" | "\t"> = [",", ";", "\t"];
  let best: "," | ";" | "\t" = ";";
  let bestCount = -1;

  for (const delimiter of candidates) {
    const count = firstLine.split(delimiter).length;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }

  return best;
}

function splitCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function findHeaderIndex(
  headers: string[],
  aliasesMap: Record<string, string[]>,
  field: string,
) {
  const aliases = aliasesMap[field] ?? [];
  return headers.findIndex((header) => aliases.includes(header));
}

function readCell(cells: string[], index: number) {
  if (index < 0 || index >= cells.length) return "";
  return cells[index]?.trim() ?? "";
}

function normalizePositiveNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeOptionalNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizeTipoPasto(value: string): TipoPastoEnum | null {
  const normalized = normalizeLookupValue(value).replace(/\s+/g, "_");

  if (["nativo", "cultivado", "integracao", "degradado"].includes(normalized)) {
    return normalized as TipoPastoEnum;
  }

  if (["ilpf", "ilp", "integrado"].includes(normalized)) {
    return "integracao";
  }

  return null;
}

function normalizeLoteStatus(value: string): LoteStatusEnum | null {
  const normalized = normalizeLookupValue(value);

  if (["ativo", "ativa"].includes(normalized)) return "ativo";
  if (["inativo", "inativa"].includes(normalized)) return "inativo";
  return null;
}

function buildEmptyResult<Row>(
  message: string,
): StructureImportParseResult<Row> {
  return {
    delimiter: ";",
    headers: [],
    rows: [],
    issues: [
      {
        lineNumber: 1,
        field: "arquivo",
        message,
      },
    ],
  };
}

export function parsePastoImportCsv(
  text: string,
): StructureImportParseResult<PastoImportRow> {
  const sanitizedText = text.replace(/^\uFEFF/, "").trim();
  if (!sanitizedText) {
    return buildEmptyResult("Arquivo vazio. Envie um CSV com cabecalho.");
  }

  const delimiter = detectDelimiter(sanitizedText);
  const lines = sanitizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);
  const issues: StructureImportIssue[] = [];

  const nomeIndex = findHeaderIndex(headers, PASTO_HEADER_ALIASES, "nome");
  const areaIndex = findHeaderIndex(headers, PASTO_HEADER_ALIASES, "areaHa");

  if (nomeIndex === -1) {
    issues.push({
      lineNumber: 1,
      field: "nome",
      message: "Cabecalho obrigatorio ausente: nome.",
    });
  }

  if (areaIndex === -1) {
    issues.push({
      lineNumber: 1,
      field: "area_ha",
      message: "Cabecalho obrigatorio ausente: area_ha.",
    });
  }

  if (issues.length > 0) {
    return { delimiter, headers, rows: [], issues };
  }

  const capacidadeIndex = findHeaderIndex(
    headers,
    PASTO_HEADER_ALIASES,
    "capacidadeUa",
  );
  const tipoIndex = findHeaderIndex(headers, PASTO_HEADER_ALIASES, "tipoPasto");
  const observacoesIndex = findHeaderIndex(
    headers,
    PASTO_HEADER_ALIASES,
    "observacoes",
  );

  const rows: PastoImportRow[] = [];
  const seenNames = new Map<string, number>();

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const lineNumber = lineIndex + 1;
    const cells = splitCsvLine(lines[lineIndex], delimiter);
    const nome = readCell(cells, nomeIndex);
    const areaValue = readCell(cells, areaIndex);
    const capacidadeValue = readCell(cells, capacidadeIndex);
    const tipoValue = readCell(cells, tipoIndex);
    const observacoes = readCell(cells, observacoesIndex);

    if (!nome) {
      issues.push({
        lineNumber,
        field: "nome",
        message: "Nome do pasto obrigatorio.",
      });
      continue;
    }

    const normalizedName = normalizeLookupValue(nome);
    const previousLine = seenNames.get(normalizedName);
    if (previousLine) {
      issues.push({
        lineNumber,
        field: "nome",
        message: `Nome duplicado na planilha. Ja informado na linha ${previousLine}.`,
      });
      continue;
    }

    const areaHa = normalizePositiveNumber(areaValue);
    if (!areaHa) {
      issues.push({
        lineNumber,
        field: "area_ha",
        message: "Area invalida. Use numero maior que zero.",
      });
      continue;
    }

    const capacidadeUa = normalizeOptionalNumber(capacidadeValue);
    if (capacidadeValue && capacidadeUa === null) {
      issues.push({
        lineNumber,
        field: "capacidade_ua",
        message: "Capacidade invalida. Use numero zero ou maior.",
      });
      continue;
    }

    const tipoPasto = tipoValue ? normalizeTipoPasto(tipoValue) : "nativo";
    if (tipoValue && !tipoPasto) {
      issues.push({
        lineNumber,
        field: "tipo_pasto",
        message:
          "Tipo de pasto invalido. Use nativo, cultivado, integracao ou degradado.",
      });
      continue;
    }

    seenNames.set(normalizedName, lineNumber);
    rows.push({
      lineNumber,
      nome,
      areaHa,
      capacidadeUa,
      tipoPasto,
      observacoes: observacoes || null,
    });
  }

  return { delimiter, headers, rows, issues };
}

export function parseLoteImportCsv(
  text: string,
): StructureImportParseResult<LoteImportRow> {
  const sanitizedText = text.replace(/^\uFEFF/, "").trim();
  if (!sanitizedText) {
    return buildEmptyResult("Arquivo vazio. Envie um CSV com cabecalho.");
  }

  const delimiter = detectDelimiter(sanitizedText);
  const lines = sanitizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);
  const issues: StructureImportIssue[] = [];

  const nomeIndex = findHeaderIndex(headers, LOTE_HEADER_ALIASES, "nome");
  if (nomeIndex === -1) {
    issues.push({
      lineNumber: 1,
      field: "nome",
      message: "Cabecalho obrigatorio ausente: nome.",
    });
  }

  if (issues.length > 0) {
    return { delimiter, headers, rows: [], issues };
  }

  const statusIndex = findHeaderIndex(headers, LOTE_HEADER_ALIASES, "status");
  const pastoIndex = findHeaderIndex(headers, LOTE_HEADER_ALIASES, "pastoNome");
  const observacoesIndex = findHeaderIndex(
    headers,
    LOTE_HEADER_ALIASES,
    "observacoes",
  );

  const rows: LoteImportRow[] = [];
  const seenNames = new Map<string, number>();

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const lineNumber = lineIndex + 1;
    const cells = splitCsvLine(lines[lineIndex], delimiter);
    const nome = readCell(cells, nomeIndex);
    const statusValue = readCell(cells, statusIndex);
    const pastoNome = readCell(cells, pastoIndex);
    const observacoes = readCell(cells, observacoesIndex);

    if (!nome) {
      issues.push({
        lineNumber,
        field: "nome",
        message: "Nome do lote obrigatorio.",
      });
      continue;
    }

    const normalizedName = normalizeLookupValue(nome);
    const previousLine = seenNames.get(normalizedName);
    if (previousLine) {
      issues.push({
        lineNumber,
        field: "nome",
        message: `Nome duplicado na planilha. Ja informado na linha ${previousLine}.`,
      });
      continue;
    }

    const status = statusValue ? normalizeLoteStatus(statusValue) : "ativo";
    if (statusValue && !status) {
      issues.push({
        lineNumber,
        field: "status",
        message: "Status invalido. Use ativo ou inativo.",
      });
      continue;
    }

    seenNames.set(normalizedName, lineNumber);
    rows.push({
      lineNumber,
      nome,
      status,
      pastoNome: pastoNome || null,
      observacoes: observacoes || null,
    });
  }

  return { delimiter, headers, rows, issues };
}
