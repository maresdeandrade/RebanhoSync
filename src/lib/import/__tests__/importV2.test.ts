import { describe, expect, it } from "vitest";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import {
  IMPORT_V2_LIMITS,
  deterministicImportUuid,
  previewAnimalsImportV2,
  previewLotesImportV2,
  previewPastosImportV2,
} from "../importV2";

const animal = (input: Record<string, unknown>) =>
  ({
    id: "animal-id",
    fazenda_id: "farm-1",
    identificacao: "A-001",
    sexo: "M",
    rfid: null,
    deleted_at: null,
    ...input,
  }) as never;

const lote = (input: Record<string, unknown>) =>
  ({
    id: "lote-id",
    fazenda_id: "farm-1",
    nome: "Matrizes",
    deleted_at: null,
    ...input,
  }) as never;

const pasto = (input: Record<string, unknown>) =>
  ({
    id: "pasto-id",
    fazenda_id: "farm-1",
    nome: "Piquete 1",
    deleted_at: null,
    ...input,
  }) as never;

describe("Importação V2 — preview e contrato", () => {
  it("aceita template legado, usa contexto da fazenda e reutiliza o writer de animal", () => {
    const preview = previewAnimalsImportV2({
      entity: "animais",
      fazendaId: "farm-1",
      rawText: [
        "identificacao;sexo;lote;pai;mae;rfid",
        "A-002;F;Matrizes;A-001;M-001;RF-002",
      ].join("\n"),
      fileName: "animais.csv",
      existing: {
        animais: [
          animal({ id: "pai-id", identificacao: "A-001", sexo: "M" }),
          animal({ id: "mae-id", identificacao: "M-001", sexo: "F" }),
        ],
        lotes: [lote({ id: "lote-id", nome: "Matrizes" })],
      },
      lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    });

    expect(preview.sourceTemplateVersion).toBe("legacy-v1");
    expect(preview.summary).toMatchObject({
      total: 1,
      valid: 1,
      rejected: 0,
      conflicts: 0,
    });
    expect(preview.operations[0]?.record).toMatchObject({
      fazenda_id: "farm-1",
      pai_id: "pai-id",
      mae_id: "mae-id",
      lote_id: "lote-id",
    });
    expect(preview.operations[0]?.record.payload).toMatchObject({
      import_id: preview.importId,
      import_line: 2,
      import_entity: "animais",
    });
  });

  it("separa linha válida de linha inválida e fornece código por linha/campo", () => {
    const preview = previewAnimalsImportV2({
      entity: "animais",
      fazendaId: "farm-1",
      rawText: [
        "identificacao;sexo;lote",
        "A-002;F;Matrizes",
        "A-003;X;Matrizes",
      ].join("\n"),
      existing: { animais: [], lotes: [lote({})] },
      lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    });

    expect(preview.summary.valid).toBe(1);
    expect(preview.summary.rejected).toBe(1);
    expect(preview.lineResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lineNumber: 2, status: "valid" }),
        expect.objectContaining({
          lineNumber: 3,
          status: "rejected",
          issues: expect.arrayContaining([
            expect.objectContaining({
              field: "sexo",
              code: "FIELD_INVALID",
              severity: "error",
            }),
          ]),
        }),
      ]),
    );
  });

  it("explicita referências ausentes, conflito de RFID e duplicidade existente", () => {
    const preview = previewAnimalsImportV2({
      entity: "animais",
      fazendaId: "farm-1",
      rawText: [
        "identificacao;sexo;pai;rfid",
        "A-001;F;MISSING;RF-1",
        "A-002;F;;RF-1",
      ].join("\n"),
      existing: {
        animais: [animal({ identificacao: "A-001", rfid: "RF-OLD" })],
      },
      lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    });

    expect(preview.summary.rejected).toBe(2);
    expect(preview.lineResults.flatMap((line) => line.issues).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "IDENTITY_EXISTS",
        "REFERENCE_NOT_FOUND",
        "RFID_DUPLICATE_IN_FILE",
      ]),
    );
  });

  it("não usa registros de outra fazenda para resolver conflito ou referência", () => {
    const preview = previewLotesImportV2({
      entity: "lotes",
      fazendaId: "farm-1",
      rawText: [
        "nome;status;pasto;touro",
        "Matrizes;ativo;Piquete 1;T-001",
      ].join("\n"),
      existing: {
        lotes: [lote({ fazenda_id: "farm-2", nome: "Matrizes" })],
        pastos: [pasto({ fazenda_id: "farm-2", nome: "Piquete 1" })],
        animais: [animal({ fazenda_id: "farm-2", identificacao: "T-001" })],
      },
    });

    expect(preview.summary.valid).toBe(0);
    expect(preview.summary.rejected).toBe(1);
    expect(preview.lineResults[0]?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "REFERENCE_NOT_FOUND" }),
      ]),
    );
  });

  it("trata reimportação como conflito explícito e não como novo INSERT", () => {
    const preview = previewPastosImportV2({
      entity: "pastos",
      fazendaId: "farm-1",
      rawText: "nome;area_ha\nPiquete 1;10",
      existing: { pastos: [pasto({ nome: "Piquete 1" })] },
    });

    expect(preview.summary.conflicts).toBe(1);
    expect(preview.operations).toHaveLength(0);
    expect(preview.lineResults[0]).toMatchObject({ status: "conflict" });
  });

  it("rejeita template_version inválido e aceita apenas a versão V2 declarada", () => {
    const preview = previewPastosImportV2({
      entity: "pastos",
      fazendaId: "farm-1",
      rawText: [
        "nome;area_ha;schema_version;template_version",
        "Piquete 1;10;2;wrong-version",
      ].join("\n"),
      existing: { pastos: [] },
    });

    expect(preview.summary.rejected).toBeGreaterThan(0);
    expect(preview.lineResults.flatMap((line) => line.issues)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "TEMPLATE_VERSION_INVALID" }),
      ]),
    );
  });

  it("classifica schema e template inválidos como rejeições determinísticas sem operação", () => {
    const preview = previewAnimalsImportV2({
      entity: "animais",
      fazendaId: "farm-1",
      rawText: [
        "identificacao;sexo;schema_version;template_version",
        "A-002;F;99;template-corrompido",
      ].join("\n"),
      existing: { animais: [], lotes: [] },
      lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    });

    expect(preview.summary).toMatchObject({ valid: 0, retryable: 0 });
    expect(preview.operations).toHaveLength(0);
    expect(preview.chunks).toHaveLength(0);
    expect(preview.lineResults.flatMap((line) => line.issues)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SCHEMA_VERSION_UNSUPPORTED" }),
        expect.objectContaining({ code: "TEMPLATE_VERSION_INVALID" }),
      ]),
    );
  });

  it("rejeita cabeçalho malformado antes de gerar operação", () => {
    const preview = previewAnimalsImportV2({
      entity: "animais",
      fazendaId: "farm-1",
      rawText: [
        "identificacao;sexo;data\\_nascimento;**nome;schema\\_version;template_version",
        "A-002;F;2024-01-10;Estrela;2;import-v2",
      ].join("\n"),
      existing: { animais: [], lotes: [] },
      lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    });

    expect(preview.summary).toMatchObject({ valid: 0, retryable: 0 });
    expect(preview.operations).toHaveLength(0);
    expect(preview.chunks).toHaveLength(0);
    expect(preview.lineResults.flatMap((line) => line.issues)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "HEADER_INVALID",
          message: expect.stringContaining(
            'Coluna inválida "data\\_nascimento"',
          ),
        }),
        expect.objectContaining({
          code: "HEADER_INVALID",
          message: expect.stringContaining('Coluna inválida "**nome"'),
        }),
      ]),
    );
  });

  it("define identidade estável por contexto e divide volume em chunks determinísticos", () => {
    const rows = Array.from(
      { length: IMPORT_V2_LIMITS.chunkSize + 1 },
      (_, index) => `Pasto ${index + 1};10`,
    );
    const rawText = ["nome;area_ha", ...rows].join("\n");
    const first = previewPastosImportV2({
      entity: "pastos",
      fazendaId: "farm-1",
      rawText,
      importId: "import-fixed",
      existing: { pastos: [] },
    });
    const second = previewPastosImportV2({
      entity: "pastos",
      fazendaId: "farm-1",
      rawText,
      importId: "import-fixed",
      existing: { pastos: [] },
    });

    expect(first.summary.valid).toBe(IMPORT_V2_LIMITS.chunkSize + 1);
    expect(first.chunks).toHaveLength(2);
    expect(first.chunks.map((chunk) => chunk.chunkId)).toEqual(
      second.chunks.map((chunk) => chunk.chunkId),
    );
    expect(first.operations.map((operation) => operation.record.id)).toEqual(
      second.operations.map((operation) => operation.record.id),
    );
    expect(deterministicImportUuid("farm-1|pasto-1")).toBe(
      deterministicImportUuid("farm-1|pasto-1"),
    );
    expect(deterministicImportUuid("farm-1|pasto-1")).not.toBe(
      deterministicImportUuid("farm-2|pasto-1"),
    );
  });

  it("rejeita arquivos acima do limite de linhas", () => {
    const rows = Array.from(
      { length: IMPORT_V2_LIMITS.maxLines + 1 },
      (_, index) => `Pasto ${index + 1};10`,
    );
    const preview = previewPastosImportV2({
      entity: "pastos",
      fazendaId: "farm-1",
      rawText: ["nome;area_ha", ...rows].join("\n"),
      existing: { pastos: [] },
    });

    expect(preview.lineResults.flatMap((line) => line.issues)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ROW_LIMIT_EXCEEDED" }),
      ]),
    );
  });
});
