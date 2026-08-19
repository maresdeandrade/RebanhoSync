import type { FarmLifecycleConfig } from "@/lib/farms/lifecycleConfig";
import { buildAnimalRegistrationRecord } from "@/lib/animals/registration";
import {
  normalizeAnimalIdentifier,
  normalizeLookupValue,
  parseAnimalImportCsv,
  type AnimalImportIssue,
  type AnimalImportRow,
} from "./animaisCsv";
import {
  parseLoteImportCsv,
  parsePastoImportCsv,
  type LoteImportRow,
  type PastoImportRow,
  type StructureImportIssue,
} from "./estruturasCsv";
import {
  buildLoteRegistrationRecord,
  buildPastoRegistrationRecord,
} from "@/lib/structures/registration";
import type { Animal, Lote, OperationInput, Pasto } from "@/lib/offline/types";

export const IMPORT_V2_SCHEMA_VERSION = 2 as const;
export const IMPORT_V2_TEMPLATE_VERSION = "import-v2" as const;
export const IMPORT_V2_LEGACY_TEMPLATE_VERSION = "legacy-v1" as const;

export const IMPORT_V2_LIMITS = {
  maxLines: 5_000,
  maxBytes: 2_000_000,
  chunkSize: 100,
} as const;

export type ImportEntity = "pastos" | "lotes" | "animais";
export type ImportLineStatus =
  | "valid"
  | "imported"
  | "rejected"
  | "conflict"
  | "skipped"
  | "retryable";
export type ImportIssueSeverity = "error" | "warning";

export type ImportV2Issue = {
  lineNumber: number;
  field: string;
  code: string;
  message: string;
  severity: ImportIssueSeverity;
};

export type ImportV2LineResult = {
  lineNumber: number;
  identity: string | null;
  status: ImportLineStatus;
  issues: ImportV2Issue[];
  warnings: ImportV2Issue[];
  operation?: OperationInput;
};

export type ImportV2ChunkPlan = {
  chunkId: string;
  index: number;
  lineNumbers: number[];
  operations: OperationInput[];
};

export type ImportV2Preview = {
  importId: string;
  fazendaId: string;
  entity: ImportEntity;
  schemaVersion: typeof IMPORT_V2_SCHEMA_VERSION;
  templateVersion: typeof IMPORT_V2_TEMPLATE_VERSION;
  sourceTemplateVersion: string;
  importFingerprint: string;
  fileName: string;
  totalLines: number;
  lineResults: ImportV2LineResult[];
  operations: OperationInput[];
  chunks: ImportV2ChunkPlan[];
  summary: {
    total: number;
    valid: number;
    rejected: number;
    warnings: number;
    conflicts: number;
    retryable: number;
    imported: number;
    skipped: number;
  };
};

export type ImportV2ExistingData = {
  pastos: readonly Pasto[];
  lotes: readonly Lote[];
  animais: readonly Animal[];
};

type ImportV2BaseInput = {
  fazendaId: string;
  rawText: string;
  fileName?: string | null;
  importId?: string;
  existing?: Partial<ImportV2ExistingData>;
};

export type AnimalImportV2Input = ImportV2BaseInput & {
  entity: "animais";
  lifecycleConfig: FarmLifecycleConfig;
};

export type PastoImportV2Input = ImportV2BaseInput & { entity: "pastos" };
export type LoteImportV2Input = ImportV2BaseInput & { entity: "lotes" };

export type ImportPersistItemResult = {
  lineNumber: number;
  status: Extract<
    ImportLineStatus,
    "imported" | "rejected" | "conflict" | "skipped" | "retryable"
  >;
  message?: string;
};

export type ImportPersistResult = {
  importId: string;
  chunks: Array<{
    chunkId: string;
    status: "imported" | "skipped" | "retryable";
    lineNumbers: number[];
  }>;
  items: ImportPersistItemResult[];
  summary: ImportV2Preview["summary"];
};

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function hash32(value: string, seed: number) {
  let hash = 2_166_136_261 ^ seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function toHex(value: number) {
  return value.toString(16).padStart(8, "0");
}

export function deterministicImportUuid(identity: string) {
  const hex = [0, 1, 2, 3]
    .map((seed) => toHex(hash32(identity, seed * 97_531)))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export function calculateImportFingerprint(
  fazendaId: string,
  entity: ImportEntity,
  rawText: string,
) {
  return toHex(hash32(`${fazendaId}|${entity}|${rawText}`, 31_337));
}

function issueFromParser(
  issue: AnimalImportIssue | StructureImportIssue,
): ImportV2Issue {
  const code =
    issue.field === "arquivo"
      ? "FILE_EMPTY"
      : issue.message.toLowerCase().includes("duplicad")
        ? "DUPLICATE_IN_FILE"
        : issue.field === "identificacao"
          ? "IDENTIFIER_INVALID"
          : "FIELD_INVALID";
  return {
    ...issue,
    code,
    severity: "error",
  };
}

function parseVersionContract(rawText: string, delimiter: "," | ";" | "\t") {
  const lines = rawText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headers = (lines[0] ?? "")
    .split(delimiter)
    .map(normalizeHeader);
  const schemaIndex = headers.indexOf("schema_version");
  const templateIndex = headers.indexOf("template_version");

  if (schemaIndex === -1 && templateIndex === -1) {
    return {
      sourceTemplateVersion: IMPORT_V2_LEGACY_TEMPLATE_VERSION,
      issues: [] as ImportV2Issue[],
    };
  }

  if (schemaIndex === -1 || templateIndex === -1) {
    return {
      sourceTemplateVersion: "invalid",
      issues: [
        {
          lineNumber: 1,
          field: "template_version",
          code: "VERSION_HEADERS_INCOMPLETE",
          message:
            "schema_version e template_version devem ser informados juntos.",
          severity: "error" as const,
        },
      ],
    };
  }

  const versionIssues: ImportV2Issue[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const cells = lines[index]!.split(delimiter).map((cell) => cell.trim());
    const schemaVersion = cells[schemaIndex] ?? "";
    const templateVersion = cells[templateIndex] ?? "";
    const lineNumber = index + 1;

    if (schemaVersion !== String(IMPORT_V2_SCHEMA_VERSION)) {
      versionIssues.push({
        lineNumber,
        field: "schema_version",
        code: "SCHEMA_VERSION_UNSUPPORTED",
        message: `schema_version inválido. Use ${IMPORT_V2_SCHEMA_VERSION}.`,
        severity: "error",
      });
    }
    if (templateVersion !== IMPORT_V2_TEMPLATE_VERSION) {
      versionIssues.push({
        lineNumber,
        field: "template_version",
        code: "TEMPLATE_VERSION_INVALID",
        message: `template_version inválido. Use ${IMPORT_V2_TEMPLATE_VERSION}.`,
        severity: "error",
      });
    }
  }

  return {
    sourceTemplateVersion: IMPORT_V2_TEMPLATE_VERSION,
    issues: versionIssues,
  };
}

function validateFileLimits(
  rawText: string,
  lineCount: number,
): ImportV2Issue[] {
  const bytes = new TextEncoder().encode(rawText).byteLength;
  const issues: ImportV2Issue[] = [];
  if (bytes > IMPORT_V2_LIMITS.maxBytes) {
    issues.push({
      lineNumber: 1,
      field: "arquivo",
      code: "FILE_TOO_LARGE",
      message: `Arquivo excede o limite de ${IMPORT_V2_LIMITS.maxBytes} bytes.`,
      severity: "error",
    });
  }
  if (lineCount > IMPORT_V2_LIMITS.maxLines) {
    issues.push({
      lineNumber: 1,
      field: "arquivo",
      code: "ROW_LIMIT_EXCEEDED",
      message: `Arquivo excede o limite de ${IMPORT_V2_LIMITS.maxLines} linhas.`,
      severity: "error",
    });
  }
  return issues;
}

function makePayload(input: {
  base: ImportV2BaseInput;
  entity: ImportEntity;
  sourceTemplateVersion: string;
  lineNumber: number;
  identity: string;
  importFingerprint: string;
}) {
  return {
    import_id: input.base.importId,
    import_fingerprint: input.importFingerprint,
    import_schema_version: IMPORT_V2_SCHEMA_VERSION,
    import_template_version: input.sourceTemplateVersion,
    import_entity: input.entity,
    import_source: input.base.fileName ?? "csv",
    import_line: input.lineNumber,
    import_identity: input.identity,
  };
}

function createBase(input: ImportV2BaseInput, entity: ImportEntity) {
  const parsed =
    entity === "animais"
      ? parseAnimalImportCsv(input.rawText)
      : entity === "pastos"
        ? parsePastoImportCsv(input.rawText)
        : parseLoteImportCsv(input.rawText);
  const sourceVersion = parseVersionContract(input.rawText, parsed.delimiter);
  const rawDataLines = input.rawText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
  const totalLines = Math.max(0, rawDataLines - 1);
  const issues = [
    ...validateFileLimits(input.rawText, totalLines),
    ...sourceVersion.issues,
    ...parsed.issues.map(issueFromParser),
  ];
  return {
    parsed,
    sourceTemplateVersion: sourceVersion.sourceTemplateVersion,
    totalLines,
    issues,
    importId: input.importId ?? crypto.randomUUID(),
    importFingerprint: calculateImportFingerprint(
      input.fazendaId,
      entity,
      input.rawText,
    ),
  };
}

function warning(
  lineNumber: number,
  field: string,
  code: string,
  message: string,
): ImportV2Issue {
  return { lineNumber, field, code, message, severity: "warning" };
}

function error(
  lineNumber: number,
  field: string,
  code: string,
  message: string,
): ImportV2Issue {
  return { lineNumber, field, code, message, severity: "error" };
}

function createLineResult(input: {
  lineNumber: number;
  identity: string | null;
  issues?: ImportV2Issue[];
  warnings?: ImportV2Issue[];
  operation?: OperationInput;
}): ImportV2LineResult {
  const issues = input.issues ?? [];
  return {
    lineNumber: input.lineNumber,
    identity: input.identity,
    status: issues.length > 0 ? "rejected" : "valid",
    issues,
    warnings: input.warnings ?? [],
    operation: issues.length === 0 ? input.operation : undefined,
  };
}

function conflictLineResult(input: {
  lineNumber: number;
  identity: string;
  issue: ImportV2Issue;
  warnings?: ImportV2Issue[];
}): ImportV2LineResult {
  return {
    lineNumber: input.lineNumber,
    identity: input.identity,
    status: "conflict",
    issues: [input.issue],
    warnings: input.warnings ?? [],
  };
}

function finalizePreview(input: {
  base: ReturnType<typeof createBase>;
  source: ImportV2BaseInput;
  entity: ImportEntity;
  lineResults: ImportV2LineResult[];
}): ImportV2Preview {
  const fatalFileIssue = input.base.issues.find((issue) =>
    [
      "FILE_EMPTY",
      "FILE_TOO_LARGE",
      "ROW_LIMIT_EXCEEDED",
      "VERSION_HEADERS_INCOMPLETE",
      "SCHEMA_VERSION_UNSUPPORTED",
      "TEMPLATE_VERSION_INVALID",
    ].includes(issue.code),
  );
  const effectiveLineResults = fatalFileIssue
    ? input.lineResults.map((line) =>
        line.status === "valid"
          ? {
              ...line,
              status: "rejected" as const,
              issues: [fatalFileIssue],
              operation: undefined,
            }
          : line,
      )
    : input.lineResults;
  const operationResults = effectiveLineResults.filter(
    (line) => line.status === "valid" && line.operation,
  );
  const operations = operationResults.map((line) => line.operation!);
  const chunks: ImportV2ChunkPlan[] = [];
  for (
    let offset = 0;
    offset < operations.length;
    offset += IMPORT_V2_LIMITS.chunkSize
  ) {
    const chunkOperations = operations.slice(
      offset,
      offset + IMPORT_V2_LIMITS.chunkSize,
    );
    const index = chunks.length;
    chunks.push({
      chunkId: `${input.base.importId}:chunk:${index + 1}`,
      index,
      lineNumbers: chunkOperations.map(
        (operation) => operation.record.payload.import_line,
      ),
      operations: chunkOperations,
    });
  }

  const summary = {
    total: input.base.totalLines,
    valid: effectiveLineResults.filter((line) => line.status === "valid").length,
    rejected: effectiveLineResults.filter((line) => line.status === "rejected").length,
    warnings: effectiveLineResults.reduce(
      (count, line) => count + line.warnings.length,
      0,
    ),
    conflicts: effectiveLineResults.filter((line) => line.status === "conflict")
      .length,
    retryable: 0,
    imported: 0,
    skipped: 0,
  };

  return {
    importId: input.base.importId,
    fazendaId: input.source.fazendaId,
    entity: input.entity,
    schemaVersion: IMPORT_V2_SCHEMA_VERSION,
    templateVersion: IMPORT_V2_TEMPLATE_VERSION,
    sourceTemplateVersion: input.base.sourceTemplateVersion,
    importFingerprint: input.base.importFingerprint,
    fileName: input.source.fileName ?? "csv",
    totalLines: input.base.totalLines,
    lineResults: effectiveLineResults.sort(
      (left, right) => left.lineNumber - right.lineNumber,
    ),
    operations,
    chunks,
    summary,
  };
}

function activeRecords<T extends { fazenda_id: string; deleted_at: string | null }>(
  records: readonly T[] | undefined,
  fazendaId: string,
) {
  return (records ?? []).filter(
    (record) => record.fazenda_id === fazendaId && !record.deleted_at,
  );
}

function animalIdentityId(fazendaId: string, identity: string) {
  return deterministicImportUuid(`animal|${fazendaId}|${identity}`);
}

function pastoIdentityId(fazendaId: string, identity: string) {
  return deterministicImportUuid(`pasto|${fazendaId}|${identity}`);
}

function loteIdentityId(fazendaId: string, identity: string) {
  return deterministicImportUuid(`lote|${fazendaId}|${identity}`);
}

export function previewAnimalsImportV2(input: AnimalImportV2Input): ImportV2Preview {
  const base = createBase(input, "animais");
  const existingAnimals = activeRecords(input.existing?.animais, input.fazendaId);
  const existingLotes = activeRecords(input.existing?.lotes, input.fazendaId);
  const existingByIdentifier = new Map(
    existingAnimals.map((animal) => [
      normalizeAnimalIdentifier(animal.identificacao),
      animal,
    ]),
  );
  const existingByRfid = new Map(
    existingAnimals
      .filter((animal) => animal.rfid)
      .map((animal) => [normalizeLookupValue(animal.rfid!), animal]),
  );
  const loteByName = new Map(
    existingLotes.map((lote) => [normalizeLookupValue(lote.nome), lote]),
  );
  const rowsByIdentifier = new Map(
    (base.parsed.rows as AnimalImportRow[]).map((row) => [
      normalizeAnimalIdentifier(row.identificacao),
      row,
    ]),
  );
  const seenRfid = new Map<string, number>();
  const lineResults: ImportV2LineResult[] = base.issues.map((issue) => ({
    lineNumber: issue.lineNumber,
    identity: null,
    status: "rejected",
    issues: [issue],
    warnings: [],
  }));

  for (const row of base.parsed.rows as AnimalImportRow[]) {
    const identity = normalizeAnimalIdentifier(row.identificacao);
    const rowIssues: ImportV2Issue[] = [];
    const warnings: ImportV2Issue[] = [];
    const existing = existingByIdentifier.get(identity);
    if (existing) {
      rowIssues.push(
        error(
          row.lineNumber,
          "identificacao",
          "IDENTITY_EXISTS",
          `Identificação "${row.identificacao}" já existe na fazenda ativa.`,
        ),
      );
    }

    const normalizedRfid = row.rfid ? normalizeLookupValue(row.rfid) : null;
    if (normalizedRfid) {
      const previousLine = seenRfid.get(normalizedRfid);
      if (previousLine) {
        rowIssues.push(
          error(
            row.lineNumber,
            "rfid",
            "RFID_DUPLICATE_IN_FILE",
            `RFID duplicado na planilha; já informado na linha ${previousLine}.`,
          ),
        );
      } else {
        seenRfid.set(normalizedRfid, row.lineNumber);
      }
      const rfidOwner = existingByRfid.get(normalizedRfid);
      if (rfidOwner && rfidOwner.identificacao !== row.identificacao) {
        rowIssues.push(
          error(
            row.lineNumber,
            "rfid",
            "RFID_CONFLICT",
            `RFID já pertence ao animal ${rfidOwner.identificacao}.`,
          ),
        );
      }
    }

    let loteId: string | null = null;
    if (row.loteNome) {
      const lote = loteByName.get(normalizeLookupValue(row.loteNome));
      if (!lote) {
        rowIssues.push(
          error(
            row.lineNumber,
            "lote",
            "REFERENCE_NOT_FOUND",
            `Lote "${row.loteNome}" não encontrado na fazenda ativa.`,
          ),
        );
      } else {
        loteId = lote.id;
      }
    } else {
      warnings.push(
        warning(
          row.lineNumber,
          "lote",
          "OPTIONAL_REFERENCE_MISSING",
          "Animal será importado sem lote.",
        ),
      );
    }

    const resolveParent = (tag: string | null, expectedSex: "M" | "F", field: string) => {
      if (!tag) return null;
      const normalized = normalizeAnimalIdentifier(tag);
      const existingParent = existingByIdentifier.get(normalized);
      const importedParent = rowsByIdentifier.get(normalized);
      const parentId = existingParent?.id ?? animalIdentityId(input.fazendaId, normalized);
      const parentSex = existingParent?.sexo ?? importedParent?.sexo;
      if (!existingParent && !importedParent) {
        rowIssues.push(
          error(
            row.lineNumber,
            field,
            "REFERENCE_NOT_FOUND",
            `Animal de referência "${tag}" não encontrado na fazenda ativa ou na planilha.`,
          ),
        );
        return null;
      }
      if (parentSex !== expectedSex) {
        rowIssues.push(
          error(
            row.lineNumber,
            field,
            "REFERENCE_SEX_MISMATCH",
            `A referência "${tag}" não possui sexo compatível com ${field}.`,
          ),
        );
        return null;
      }
      return parentId;
    };

    const paiId = resolveParent(row.paiTag, "M", "pai");
    const maeId = resolveParent(row.maeTag, "F", "mae");
    if (!row.especie) {
      warnings.push(
        warning(
          row.lineNumber,
          "especie",
          "OPTIONAL_FIELD_MISSING",
          "Espécie não informada; o cadastro poderá ser complementado depois.",
        ),
      );
    }
    if (!row.origem) {
      warnings.push(
        warning(
          row.lineNumber,
          "origem",
          "OPTIONAL_FIELD_MISSING",
          "Origem não informada.",
        ),
      );
    }

    const payload = makePayload({
      base: { ...input, importId: base.importId },
      entity: "animais",
      sourceTemplateVersion: base.sourceTemplateVersion,
      lineNumber: row.lineNumber,
      identity,
      importFingerprint: base.importFingerprint,
    });
    let operation: OperationInput | undefined;
    if (rowIssues.length === 0) {
      const record = buildAnimalRegistrationRecord({
        fazendaId: input.fazendaId,
        lifecycleConfig: input.lifecycleConfig,
        recordedAt: new Date().toISOString(),
        origem: row.origem,
        draft: {
          id: animalIdentityId(input.fazendaId, identity),
          identificacao: row.identificacao,
          sexo: row.sexo,
          especie: row.especie,
          raca: row.raca as never,
          dataNascimento: row.dataNascimento,
          dataEntrada: row.dataEntrada,
          loteId,
          nome: row.nome,
          rfid: row.rfid,
          paiId,
          maeId,
          payload,
        },
      });
      operation = { table: "animais", action: "INSERT", record };
    }

    lineResults.push(
      rowIssues.length > 0
        ? {
            lineNumber: row.lineNumber,
            identity,
            status: "rejected",
            issues: rowIssues,
            warnings,
          }
        : createLineResult({
            lineNumber: row.lineNumber,
            identity,
            warnings,
            operation,
          }),
    );
  }

  return finalizePreview({
    base,
    source: input,
    entity: "animais",
    lineResults,
  });
}

export function previewPastosImportV2(input: PastoImportV2Input): ImportV2Preview {
  const base = createBase(input, "pastos");
  const existingNames = new Map(
    activeRecords(input.existing?.pastos, input.fazendaId).map((pasto) => [
      normalizeLookupValue(pasto.nome),
      pasto,
    ]),
  );
  const lineResults: ImportV2LineResult[] = base.issues.map((issue) => ({
    lineNumber: issue.lineNumber,
    identity: null,
    status: "rejected",
    issues: [issue],
    warnings: [],
  }));

  for (const row of base.parsed.rows as PastoImportRow[]) {
    const identity = normalizeLookupValue(row.nome);
    const existing = existingNames.get(identity);
    const warnings: ImportV2Issue[] = [];
    if (existing) {
      lineResults.push(
        conflictLineResult({
          lineNumber: row.lineNumber,
          identity,
          issue: error(
            row.lineNumber,
            "nome",
            "IDENTITY_EXISTS",
            `Pasto "${row.nome}" já existe na fazenda ativa.`,
          ),
        }),
      );
      continue;
    }
    if (row.capacidadeUa == null) {
      warnings.push(
        warning(
          row.lineNumber,
          "capacidade_ua",
          "OPTIONAL_FIELD_MISSING",
          "Capacidade UA não informada.",
        ),
      );
    }
    const record = buildPastoRegistrationRecord({
      fazendaId: input.fazendaId,
      recordedAt: new Date().toISOString(),
      draft: {
        id: pastoIdentityId(input.fazendaId, identity),
        nome: row.nome,
        areaHa: row.areaHa,
        capacidadeUa: row.capacidadeUa,
        tipoPasto: row.tipoPasto,
        tipoArea: row.tipoArea,
        forrageiraNome: row.forrageiraNome,
        forrageiraGenero: row.forrageiraGenero,
        forrageiraCultivar: row.forrageiraCultivar,
        alturaEntrada: row.alturaEntrada,
        alturaSaida: row.alturaSaida,
        capacidadeUaAlvo: row.capacidadeUaAlvo,
        observacoes: row.observacoes,
        payload: makePayload({
          base: { ...input, importId: base.importId },
          entity: "pastos",
          sourceTemplateVersion: base.sourceTemplateVersion,
          lineNumber: row.lineNumber,
          identity,
          importFingerprint: base.importFingerprint,
        }),
      },
    });
    lineResults.push(
      createLineResult({
        lineNumber: row.lineNumber,
        identity,
        warnings,
        operation: { table: "pastos", action: "INSERT", record },
      }),
    );
  }

  return finalizePreview({
    base,
    source: input,
    entity: "pastos",
    lineResults,
  });
}

export function previewLotesImportV2(input: LoteImportV2Input): ImportV2Preview {
  const base = createBase(input, "lotes");
  const existingLotes = activeRecords(input.existing?.lotes, input.fazendaId);
  const existingPastos = activeRecords(input.existing?.pastos, input.fazendaId);
  const existingAnimals = activeRecords(input.existing?.animais, input.fazendaId);
  const existingNames = new Map(
    existingLotes.map((lote) => [normalizeLookupValue(lote.nome), lote]),
  );
  const pastoByName = new Map(
    existingPastos.map((pasto) => [normalizeLookupValue(pasto.nome), pasto]),
  );
  const animalByIdentifier = new Map(
    existingAnimals
      .filter((animal) => typeof animal.identificacao === "string")
      .map((animal) => [
        normalizeAnimalIdentifier(animal.identificacao),
        animal,
      ]),
  );
  const lineResults: ImportV2LineResult[] = base.issues.map((issue) => ({
    lineNumber: issue.lineNumber,
    identity: null,
    status: "rejected",
    issues: [issue],
    warnings: [],
  }));

  for (const row of base.parsed.rows as LoteImportRow[]) {
    const identity = normalizeLookupValue(row.nome);
    const rowIssues: ImportV2Issue[] = [];
    const warnings: ImportV2Issue[] = [];
    if (existingNames.has(identity)) {
      rowIssues.push(
        error(
          row.lineNumber,
          "nome",
          "IDENTITY_EXISTS",
          `Lote "${row.nome}" já existe na fazenda ativa.`,
        ),
      );
    }
    let pastoId: string | null = null;
    if (row.pastoNome) {
      const pasto = pastoByName.get(normalizeLookupValue(row.pastoNome));
      if (!pasto) {
        rowIssues.push(
          error(
            row.lineNumber,
            "pasto",
            "REFERENCE_NOT_FOUND",
            `Pasto "${row.pastoNome}" nao encontrado na fazenda ativa.`,
          ),
        );
      } else {
        pastoId = pasto.id;
      }
    } else {
      warnings.push(
        warning(
          row.lineNumber,
          "pasto",
          "OPTIONAL_REFERENCE_MISSING",
          "Lote será importado sem pasto.",
        ),
      );
    }
    let touroId: string | null = null;
    if (row.touroTag) {
      const touro = animalByIdentifier.get(
        normalizeAnimalIdentifier(row.touroTag),
      );
      if (!touro) {
        rowIssues.push(
          error(
            row.lineNumber,
            "touro",
            "REFERENCE_NOT_FOUND",
            `Reprodutor "${row.touroTag}" não encontrado na fazenda ativa.`,
          ),
        );
      } else if (touro.sexo !== "M") {
        rowIssues.push(
          error(
            row.lineNumber,
            "touro",
            "REFERENCE_SEX_MISMATCH",
            `Animal "${row.touroTag}" não é macho e não pode ser touro do lote.`,
          ),
        );
      } else {
        touroId = touro.id;
      }
    }
    if (rowIssues.length > 0) {
      lineResults.push({
        lineNumber: row.lineNumber,
        identity,
        status: "rejected",
        issues: rowIssues,
        warnings,
      });
      continue;
    }
    const record = buildLoteRegistrationRecord({
      fazendaId: input.fazendaId,
      recordedAt: new Date().toISOString(),
      draft: {
        id: loteIdentityId(input.fazendaId, identity),
        nome: row.nome,
        status: row.status,
        pastoId,
        touroId,
        observacoes: row.observacoes,
        payload: makePayload({
          base: { ...input, importId: base.importId },
          entity: "lotes",
          sourceTemplateVersion: base.sourceTemplateVersion,
          lineNumber: row.lineNumber,
          identity,
          importFingerprint: base.importFingerprint,
        }),
      },
    });
    lineResults.push(
      createLineResult({
        lineNumber: row.lineNumber,
        identity,
        warnings,
        operation: { table: "lotes", action: "INSERT", record },
      }),
    );
  }

  return finalizePreview({
    base,
    source: input,
    entity: "lotes",
    lineResults,
  });
}
