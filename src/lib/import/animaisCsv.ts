import type { OrigemEnum, SexoEnum } from "@/lib/offline/types";

export type AnimalImportRow = {
  lineNumber: number;
  identificacao: string;
  sexo: SexoEnum;
  loteNome: string | null;
  nome: string | null;
  dataNascimento: string | null;
  dataEntrada: string | null;
  origem: OrigemEnum | null;
  raca: string | null;
  rfid: string | null;
};

export type AnimalImportIssue = {
  lineNumber: number;
  field: string;
  message: string;
};

export type AnimalImportParseResult = {
  delimiter: "," | ";" | "\t";
  headers: string[];
  rows: AnimalImportRow[];
  issues: AnimalImportIssue[];
};

const HEADER_ALIASES: Record<string, string[]> = {
  identificacao: ["identificacao", "identificacao_animal", "brinco", "tag", "codigo"],
  sexo: ["sexo"],
  loteNome: ["lote", "lote_nome", "nome_lote"],
  nome: ["nome"],
  dataNascimento: ["data_nascimento", "nascimento"],
  dataEntrada: ["data_entrada", "entrada"],
  origem: ["origem"],
  raca: ["raca"],
  rfid: ["rfid"],
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

export function normalizeLookupValue(value: string) {
  return stripDiacritics(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeAnimalIdentifier(value: string) {
  return normalizeLookupValue(value).replace(/\s+/g, "");
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

function findHeaderIndex(headers: string[], field: keyof typeof HEADER_ALIASES) {
  const aliases = HEADER_ALIASES[field];
  return headers.findIndex((header) => aliases.includes(header));
}

function normalizeSexo(value: string): SexoEnum | null {
  const normalized = normalizeLookupValue(value);

  if (["m", "macho", "male"].includes(normalized)) return "M";
  if (["f", "femea", "female"].includes(normalized)) return "F";
  return null;
}

function normalizeOrigem(value: string): OrigemEnum | null {
  const normalized = normalizeLookupValue(value).replace(/\s+/g, "_");

  if (
    normalized === "nascimento" ||
    normalized === "compra" ||
    normalized === "doacao" ||
    normalized === "arrendamento" ||
    normalized === "sociedade"
  ) {
    return normalized;
  }

  return null;
}

function normalizeDate(value: string) {
  const normalized = value.trim();

  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const slashMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }

  const dashMatch = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashMatch) {
    const [, day, month, year] = dashMatch;
    return `${year}-${month}-${day}`;
  }

  return null;
}

function readCell(cells: string[], index: number) {
  if (index < 0 || index >= cells.length) return "";
  return cells[index]?.trim() ?? "";
}

export function parseAnimalImportCsv(text: string): AnimalImportParseResult {
  const issues: AnimalImportIssue[] = [];
  const sanitizedText = text.replace(/^\uFEFF/, "").trim();

  if (!sanitizedText) {
    return {
      delimiter: ";",
      headers: [],
      rows: [],
      issues: [
        {
          lineNumber: 1,
          field: "arquivo",
          message: "Arquivo vazio. Envie um CSV com cabecalho.",
        },
      ],
    };
  }

  const delimiter = detectDelimiter(sanitizedText);
  const lines = sanitizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);
  const identificacaoIndex = findHeaderIndex(headers, "identificacao");
  const sexoIndex = findHeaderIndex(headers, "sexo");

  if (identificacaoIndex === -1) {
    issues.push({
      lineNumber: 1,
      field: "identificacao",
      message: "Cabecalho obrigatorio ausente: identificacao.",
    });
  }

  if (sexoIndex === -1) {
    issues.push({
      lineNumber: 1,
      field: "sexo",
      message: "Cabecalho obrigatorio ausente: sexo.",
    });
  }

  if (issues.length > 0) {
    return { delimiter, headers, rows: [], issues };
  }

  const loteIndex = findHeaderIndex(headers, "loteNome");
  const nomeIndex = findHeaderIndex(headers, "nome");
  const dataNascimentoIndex = findHeaderIndex(headers, "dataNascimento");
  const dataEntradaIndex = findHeaderIndex(headers, "dataEntrada");
  const origemIndex = findHeaderIndex(headers, "origem");
  const racaIndex = findHeaderIndex(headers, "raca");
  const rfidIndex = findHeaderIndex(headers, "rfid");

  const rows: AnimalImportRow[] = [];
  const seenIdentifiers = new Map<string, number>();

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = splitCsvLine(lines[lineIndex], delimiter);
    const lineNumber = lineIndex + 1;
    const identificacao = readCell(cells, identificacaoIndex);
    const sexoValue = readCell(cells, sexoIndex);
    const loteNome = readCell(cells, loteIndex);
    const nome = readCell(cells, nomeIndex);
    const dataNascimentoValue = readCell(cells, dataNascimentoIndex);
    const dataEntradaValue = readCell(cells, dataEntradaIndex);
    const origemValue = readCell(cells, origemIndex);
    const raca = readCell(cells, racaIndex);
    const rfid = readCell(cells, rfidIndex);

    if (!identificacao) {
      issues.push({
        lineNumber,
        field: "identificacao",
        message: "Identificacao obrigatoria.",
      });
      continue;
    }

    const sexo = normalizeSexo(sexoValue);
    if (!sexo) {
      issues.push({
        lineNumber,
        field: "sexo",
        message: "Sexo invalido. Use M, F, macho ou femea.",
      });
      continue;
    }

    const dataNascimento = normalizeDate(dataNascimentoValue);
    if (dataNascimentoValue && !dataNascimento) {
      issues.push({
        lineNumber,
        field: "data_nascimento",
        message: "Data de nascimento invalida. Use YYYY-MM-DD ou DD/MM/YYYY.",
      });
      continue;
    }

    const dataEntrada = normalizeDate(dataEntradaValue);
    if (dataEntradaValue && !dataEntrada) {
      issues.push({
        lineNumber,
        field: "data_entrada",
        message: "Data de entrada invalida. Use YYYY-MM-DD ou DD/MM/YYYY.",
      });
      continue;
    }

    const origem = origemValue ? normalizeOrigem(origemValue) : null;
    if (origemValue && !origem) {
      issues.push({
        lineNumber,
        field: "origem",
        message:
          "Origem invalida. Use nascimento, compra, doacao, arrendamento ou sociedade.",
      });
      continue;
    }

    const duplicateKey = normalizeAnimalIdentifier(identificacao);
    const previousLine = seenIdentifiers.get(duplicateKey);
    if (previousLine) {
      issues.push({
        lineNumber,
        field: "identificacao",
        message: `Identificacao duplicada na planilha. Ja informada na linha ${previousLine}.`,
      });
      continue;
    }

    seenIdentifiers.set(duplicateKey, lineNumber);
    rows.push({
      lineNumber,
      identificacao,
      sexo,
      loteNome: loteNome || null,
      nome: nome || null,
      dataNascimento,
      dataEntrada,
      origem,
      raca: raca || null,
      rfid: rfid || null,
    });
  }

  return { delimiter, headers, rows, issues };
}
