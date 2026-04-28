import { describe, expect, it } from "vitest";
import type {
  Animal,
  ProdutoVeterinarioCatalogEntry,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import { EMPTY_REGULATORY_OPERATIONAL_READ_MODEL } from "@/lib/sanitario/compliance/regulatoryReadModel";
import {
  DEFAULT_TRANSIT_CHECKLIST_DRAFT,
  type TransitChecklistDraft,
} from "@/lib/sanitario/compliance/transit";
import { resolveRegistrarSanitaryPackage } from "@/lib/sanitario/models/registrarPackage";

const product = (
  id: string,
  nome: string,
  categoria: string | null = "vacina",
): ProdutoVeterinarioCatalogEntry => ({
  id,
  nome,
  categoria,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const animal = (
  overrides: Partial<Pick<Animal, "id" | "identificacao" | "sexo" | "data_nascimento" | "payload">> = {},
): Animal =>
  ({
    id: overrides.id ?? "animal-1",
    fazenda_id: "farm-1",
    identificacao: overrides.identificacao ?? "BR-001",
    sexo: overrides.sexo ?? "F",
    status: "ativo",
    lote_id: "lote-1",
    data_nascimento: overrides.data_nascimento ?? "2025-01-01",
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    origem: null,
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: overrides.payload ?? {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-01-01T00:00:00.000Z",
    server_received_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  }) as Animal;

const protocol = (
  overrides: Partial<ProtocoloSanitario> = {},
): ProtocoloSanitario =>
  ({
    id: overrides.id ?? "protocolo-1",
    fazenda_id: "farm-1",
    nome: "Protocolo 1",
    descricao: null,
    ativo: true,
    payload: overrides.payload ?? {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-01-01T00:00:00.000Z",
    server_received_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  }) as ProtocoloSanitario;

const protocolItem = (
  overrides: Partial<ProtocoloSanitarioItem> = {},
): ProtocoloSanitarioItem =>
  ({
    id: overrides.id ?? "item-1",
    fazenda_id: "farm-1",
    protocolo_id: overrides.protocolo_id ?? "protocolo-1",
    protocol_item_id: "canonical-item-1",
    version: 1,
    tipo: overrides.tipo ?? "vacinacao",
    produto: overrides.produto ?? "Vacina Protocolo",
    intervalo_dias: 365,
    dose_num: overrides.dose_num ?? 1,
    gera_agenda: true,
    dedup_template: null,
    payload: overrides.payload ?? {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-01-01T00:00:00.000Z",
    server_received_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  }) as ProtocoloSanitarioItem;

const baseInput = () => ({
  tipoManejo: "sanitario",
  financeiroNatureza: "compra" as const,
  regulatorySurfaceConfig: null,
  regulatoryReadModel: EMPTY_REGULATORY_OPERATIONAL_READ_MODEL,
  animaisNoLote: [] as Animal[],
  selectedAnimaisDetalhes: [animal()],
  protocolos: [protocol()],
  protocoloItens: [protocolItem()],
  protocoloItemId: "item-1",
  sanitarioData: {
    tipo: "vacinacao" as const,
    produto: "Vacina Digitada",
  },
  selectedVeterinaryProductId: null,
  veterinaryProducts: [product("prod-1", "Vacina Protocolo")],
  transitChecklist: DEFAULT_TRANSIT_CHECKLIST_DRAFT,
  asOfDate: "2026-04-27",
});

describe("resolveRegistrarSanitaryPackage", () => {
  it("manejo nao sanitario retorna pacote neutro", () => {
    const result = resolveRegistrarSanitaryPackage({
      ...baseInput(),
      tipoManejo: "pesagem",
    });

    expect(result.isSanitary).toBe(false);
    expect(result.sanitaryProductName).toBe("");
    expect(result.sanitaryProductMetadata).toEqual({});
    expect(result.protocolEligibilityIssues).toEqual([]);
  });

  it("sanitario com item de protocolo retorna pacote completo", () => {
    const result = resolveRegistrarSanitaryPackage(baseInput());

    expect(result.isSanitary).toBe(true);
    expect(result.protocoloItem?.id).toBe("item-1");
    expect(result.sanitaryProductName).toBe("Vacina Digitada");
    expect(result.sanitaryProductMetadata).toMatchObject({
      protocolo_item_id: "item-1",
      protocolo_id: "protocolo-1",
    });
    expect(result.selectedProtocoloItemEvaluation?.item.id).toBe("item-1");
  });

  it("sanitario manual sem protocolo retorna fallback seguro", () => {
    const result = resolveRegistrarSanitaryPackage({
      ...baseInput(),
      protocolos: [],
      protocoloItens: [],
      protocoloItemId: null,
      sanitarioData: {
        tipo: "medicamento",
        produto: "Produto livre",
      },
    });

    expect(result.protocoloItem).toBeNull();
    expect(result.sanitaryProductName).toBe("Produto livre");
    expect(result.sanitaryProductMetadata).toMatchObject({
      produto_origem: "texto_livre",
    });
  });

  it("produto digitado prevalece quando ha item de protocolo", () => {
    const result = resolveRegistrarSanitaryPackage({
      ...baseInput(),
      sanitarioData: {
        tipo: "vacinacao",
        produto: "Nome digitado",
      },
    });

    expect(result.sanitaryProductName).toBe("Nome digitado");
  });

  it("produto catalogado selecionado eh preservado", () => {
    const result = resolveRegistrarSanitaryPackage({
      ...baseInput(),
      selectedVeterinaryProductId: "prod-1",
    });

    expect(result.selectedVeterinaryProductSelection).toMatchObject({
      id: "prod-1",
      nome: "Vacina Protocolo",
      origem: "catalogo",
    });
    expect(result.sanitaryProductMetadata).toMatchObject({
      produto_veterinario_id: "prod-1",
      produto_nome_catalogo: "Vacina Protocolo",
    });
  });

  it("protocolo inelegivel retorna issue", () => {
    const result = resolveRegistrarSanitaryPackage({
      ...baseInput(),
      selectedAnimaisDetalhes: [animal({ sexo: "M" })],
      protocoloItens: [
        protocolItem({
          payload: {
            sexo_alvo: "F",
          },
        }),
      ],
    });

    expect(result.protocolEligibilityIssues).toEqual([
      "O item de protocolo escolhido nao atende todos os animais selecionados.",
    ]);
    expect(result.selectedProtocolPrimaryReason).toContain("exclusivo para femeas");
  });

  it("compliance/read model eh preservado", () => {
    const result = resolveRegistrarSanitaryPackage({
      ...baseInput(),
      tipoManejo: "nutricao",
      regulatoryReadModel: {
        ...EMPTY_REGULATORY_OPERATIONAL_READ_MODEL,
        flows: {
          ...EMPTY_REGULATORY_OPERATIONAL_READ_MODEL.flows,
          nutrition: {
            ...EMPTY_REGULATORY_OPERATIONAL_READ_MODEL.flows.nutrition,
            blockers: [{ message: "Feed-ban ativo." }],
          },
        },
      },
    });

    expect(result.nutritionComplianceGuards.blockers).toEqual([
      { message: "Feed-ban ativo." },
    ]);
    expect(result.complianceFlowIssues).toEqual(["Feed-ban ativo."]);
  });

  it("checklist/transito eh preservado", () => {
    const transitChecklist: TransitChecklistDraft = {
      ...DEFAULT_TRANSIT_CHECKLIST_DRAFT,
      enabled: true,
      purpose: "venda",
      gtaChecked: false,
    };
    const result = resolveRegistrarSanitaryPackage({
      ...baseInput(),
      tipoManejo: "financeiro",
      financeiroNatureza: "venda",
      transitChecklist,
    });

    expect(result.showsTransitChecklist).toBe(true);
    expect(result.transitChecklistIssues).toEqual([
      "Conclua o checklist de GTA/e-GTA antes de liberar o transito externo.",
    ]);
  });

  it("entrada incompleta nao lanca excecao", () => {
    const result = resolveRegistrarSanitaryPackage({
      tipoManejo: null,
      financeiroNatureza: "compra",
      regulatorySurfaceConfig: null,
      regulatoryReadModel: EMPTY_REGULATORY_OPERATIONAL_READ_MODEL,
      selectedAnimaisDetalhes: [],
      sanitarioData: {
        tipo: "vacinacao",
        produto: "",
      },
      transitChecklist: DEFAULT_TRANSIT_CHECKLIST_DRAFT,
      asOfDate: "2026-04-27",
    });

    expect(result.isSanitary).toBe(false);
    expect(result.sanitatioProductMissing).toBe(true);
    expect(result.protocoloItensEvaluated).toEqual([]);
  });
});
