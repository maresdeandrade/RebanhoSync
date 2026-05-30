import { describe, expect, it } from "vitest";
import type { ProtocoloSanitario } from "@/lib/offline/types";
import {
  buildSanitaryFamilyCoverageIndex,
  findSanitaryFamilyConflict,
  resolveEffectiveProtocolsByFamily,
  resolveProtocolPrecedence,
  resolveActivationState,
} from "@/lib/sanitario/engine/protocolLayers";

const buildProtocol = (
  id: string,
  payload: Record<string, unknown>,
  overrides?: Partial<ProtocoloSanitario>,
): ProtocoloSanitario => ({
  id,
  fazenda_id: "farm-1",
  nome: id,
  descricao: null,
  ativo: true,
  payload,
  client_id: "client-1",
  client_op_id: `${id}-op`,
  client_tx_id: null,
  client_recorded_at: "2026-04-12T12:00:00.000Z",
  server_received_at: "2026-04-12T12:00:00.000Z",
  created_at: "2026-04-12T12:00:00.000Z",
  updated_at: "2026-04-12T12:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

describe("Regressao - Risco A: Protocolo Ativo/Inativo e Familia Protocolar", () => {
  it("REGRESSÃO FASE 1A: buildSanitaryFamilyCoverageIndex IGNORA CORRETAMENTE ativo=false (não considera como cobertura ativa)", () => {
    const protocols = [
      buildProtocol("p-inativo", { origem: "customizado_fazenda", family_code: "brucelose" }, { ativo: false }),
    ];
    const index = buildSanitaryFamilyCoverageIndex(protocols);
    expect(index.has("brucelose")).toBe(false);
  });

  it("REGRESSÃO FASE 1A: buildSanitaryFamilyCoverageIndex considera deleted_at=not_null como deletado (ignora)", () => {
    const protocols = [
      buildProtocol("p-deletado", { origem: "customizado_fazenda", family_code: "brucelose" }, { deleted_at: "2026-04-12T12:00:00.000Z" }),
    ];
    const index = buildSanitaryFamilyCoverageIndex(protocols);
    expect(index.has("brucelose")).toBe(false);
  });

  it("REGRESSÃO FASE 1A: findSanitaryFamilyConflict IGNORA CORRETAMENTE ativo=false (protocolo inativo não bloqueia a mesma familia)", () => {
    const protocols = [
      buildProtocol("p-inativo", { origem: "customizado_fazenda", family_code: "brucelose" }, { ativo: false }),
    ];
    const conflict = findSanitaryFamilyConflict({
      protocols,
      candidateFamilyCode: "brucelose",
      candidateLayer: "custom",
    });
    expect(conflict).toBeNull();
  });

  it("REGRESSÃO FASE 1A: resolveEffectiveProtocolsByFamily IGNORA protocolos inativos no calculo de efetivos (e eles não vencem precedencia)", () => {
    const protocols = [
      buildProtocol("p-official-inativo", { origem: "catalogo_oficial", family_code: "brucelose" }, { ativo: false }),
      buildProtocol("p-custom-ativo", { origem: "customizado_fazenda", family_code: "brucelose", operational_complement: true }),
    ];
    const { effective } = resolveEffectiveProtocolsByFamily(protocols);
    // O oficial inativo foi ignorado, então o custom ativo vence
    expect(effective.get("brucelose")).toBe("p-custom-ativo");
  });
});

describe("Caracterizacao - Risco B: Resolucao de Protocolo Efetivo por Familia", () => {
  it("CONFIRMADO: official sempre vence standard", () => {
    const protocols = [
      buildProtocol("official", { origem: "catalogo_oficial", family_code: "brucelose" }),
      buildProtocol("standard", { origem: "template_padrao", family_code: "brucelose" }),
    ];
    const { winnerId } = resolveProtocolPrecedence(protocols, "brucelose");
    expect(winnerId).toBe("official");
  });

  it("CONFIRMADO: official sempre vence custom (mesmo custom sendo complemento operacional)", () => {
    const protocols = [
      buildProtocol("official", { origem: "catalogo_oficial", family_code: "brucelose" }),
      buildProtocol("custom-complement", { origem: "customizado_fazenda", family_code: "brucelose", operational_complement: true }),
    ];
    const { winnerId } = resolveProtocolPrecedence(protocols, "brucelose");
    expect(winnerId).toBe("official");
  });

  it("CONFIRMADO: custom com operational_complement=true coexiste com official? NAO, ele eh considerado perdedor e fica ocultado (superseded)", () => {
    const protocols = [
      buildProtocol("official", { origem: "catalogo_oficial", family_code: "brucelose" }),
      buildProtocol("custom-complement", { origem: "customizado_fazenda", family_code: "brucelose", operational_complement: true }),
    ];
    const { effective, metadata } = resolveEffectiveProtocolsByFamily(protocols);
    expect(effective.get("brucelose")).toBe("official");
    expect(metadata.get("custom-complement")?.hiddenFromPrimaryList).toBe(true);
    expect(metadata.get("custom-complement")?.activationState).toBe("superseded_legacy");
  });

  it("CONFIRMADO: standard/legacy nao deve duplicar familia oficial ativa (eh superseded)", () => {
    const protocols = [
      buildProtocol("official", { origem: "catalogo_oficial", family_code: "brucelose" }),
      buildProtocol("standard", { origem: "template_padrao", family_code: "brucelose" }),
    ];
    const { effective, metadata } = resolveEffectiveProtocolsByFamily(protocols);
    expect(effective.get("brucelose")).toBe("official");
    expect(metadata.get("standard")?.hiddenFromPrimaryList).toBe(true);
  });

  it("CONFIRMADO: empate entre dois protocolos da mesma camada/familia eh determinado lexicograficamente por ID", () => {
    const protocols = [
      buildProtocol("z-last-id", { origem: "template_padrao", family_code: "brucelose" }),
      buildProtocol("a-first-id", { origem: "template_padrao", family_code: "brucelose" }),
    ];
    const { winnerId } = resolveProtocolPrecedence(protocols, "brucelose");
    expect(winnerId).toBe("a-first-id");
  });
});

describe("Regressao - Risco C: Divergencia operational_complement vs is_operational_complement", () => {
  it("REGRESSÃO FASE 1A: resolveActivationState RECONHECE CORRETAMENTE is_operational_complement como complemento customizado (active_custom)", () => {
    const protocolWithIsOp = buildProtocol("custom-is-op", {
      origem: "customizado_fazenda",
      family_code: "brucelose",
      is_operational_complement: true,
    });
    
    // Testamos a resolucao de estado
    const state = resolveActivationState(protocolWithIsOp, "custom", false);
    // Agora o is_operational_complement eh reconhecido como active_custom devido ao fallback tolerante
    expect(state).toBe("active_custom");
  });

  it("REGRESSÃO FASE 1A: resolveActivationState reconhece corretamente operational_complement como active_custom", () => {
    const protocolWithOp = buildProtocol("custom-op", {
      origem: "customizado_fazenda",
      family_code: "brucelose",
      operational_complement: true,
    });
    
    const state = resolveActivationState(protocolWithOp, "custom", false);
    expect(state).toBe("active_custom");
  });
});
