/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import type { ReactElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { FarmProtocolManager } from "@/components/sanitario/FarmProtocolManager";
import { createGesture } from "@/lib/offline/ops";
import type {
  ProdutoVeterinarioCatalogEntry,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";

vi.mock("@/lib/offline/ops", () => ({
  createGesture: vi.fn(),
}));

vi.mock("@/utils/toast", () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const FIXED_TIMESTAMP = "2026-04-12T10:00:00.000Z";

function buildProtocol(
  overrides?: Partial<ProtocoloSanitario>,
): ProtocoloSanitario {
  return {
    id: overrides?.id ?? "protocol-1",
    fazenda_id: overrides?.fazenda_id ?? "farm-1",
    nome: overrides?.nome ?? "Protocolo teste",
    descricao: overrides?.descricao ?? null,
    ativo: overrides?.ativo ?? true,
    payload: overrides?.payload ?? {},
    client_id: overrides?.client_id ?? "client-1",
    client_op_id: overrides?.client_op_id ?? "op-1",
    client_tx_id: overrides?.client_tx_id ?? null,
    client_recorded_at: overrides?.client_recorded_at ?? FIXED_TIMESTAMP,
    server_received_at: overrides?.server_received_at ?? FIXED_TIMESTAMP,
    created_at: overrides?.created_at ?? FIXED_TIMESTAMP,
    updated_at: overrides?.updated_at ?? FIXED_TIMESTAMP,
    deleted_at: overrides?.deleted_at ?? null,
  };
}

function buildProtocolItem(
  overrides?: Partial<ProtocoloSanitarioItem>,
): ProtocoloSanitarioItem {
  return {
    id: overrides?.id ?? "item-1",
    fazenda_id: overrides?.fazenda_id ?? "farm-1",
    protocolo_id: overrides?.protocolo_id ?? "protocol-1",
    logical_item_key: overrides?.logical_item_key ?? "logical-item-1",
    item_code: overrides?.item_code ?? "dose_1",
    version: overrides?.version ?? 1,
    ativo: overrides?.ativo ?? true,
    superseded_by_id: overrides?.superseded_by_id ?? null,
    superseded_at: overrides?.superseded_at ?? null,
    tipo: overrides?.tipo ?? "vacinacao",
    produto: overrides?.produto ?? "Vacina teste",
    intervalo_dias: overrides?.intervalo_dias ?? 30,
    dose_num: overrides?.dose_num ?? 1,
    gera_agenda: overrides?.gera_agenda ?? true,
    dedup_template: overrides?.dedup_template ?? null,
    payload: overrides?.payload ?? {},
    client_id: overrides?.client_id ?? "client-1",
    client_op_id: overrides?.client_op_id ?? "op-1",
    client_tx_id: overrides?.client_tx_id ?? null,
    client_recorded_at: overrides?.client_recorded_at ?? FIXED_TIMESTAMP,
    server_received_at: overrides?.server_received_at ?? FIXED_TIMESTAMP,
    created_at: overrides?.created_at ?? FIXED_TIMESTAMP,
    updated_at: overrides?.updated_at ?? FIXED_TIMESTAMP,
    deleted_at: overrides?.deleted_at ?? null,
  };
}

describe("FarmProtocolManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderManager(ui: ReactElement) {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
  }

  it("mostra conflito inline ao editar um protocolo com familia ja coberta pelo pack oficial", () => {
    const officialProtocol = buildProtocol({
      id: "official-brucelose",
      nome: "Brucelose oficial",
      payload: {
        origem: "catalogo_oficial",
        family_code: "brucelose",
      },
    });

    renderManager(
      <FarmProtocolManager
        activeFarmId="farm-1"
        farmExperienceMode="completo"
        catalogProducts={[] satisfies ProdutoVeterinarioCatalogEntry[]}
        protocols={[officialProtocol]}
        protocolItems={[]}
        canManage
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /criar protocolo/i }));
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Complemento local" },
    });
    fireEvent.change(screen.getByLabelText("Familia protocolar"), {
      target: { value: "brucelose" },
    });

    const protocolDialog = screen.getByRole("dialog");
    expect(protocolDialog).toHaveTextContent(
      /familia protocolar "brucelose" ja esta coberta pelo pack oficial/i,
    );
    expect(
      within(protocolDialog).getByRole("button", { name: /criar protocolo/i }),
    ).toBeDisabled();
  });

  it("abre nova etapa com contexto de familia, milestone sequencial e dedup sugerido", () => {
    const customProtocol = buildProtocol({
      id: "raiva-protocol",
      nome: "Raiva dos herbivoros",
      payload: {
        origem: "customizado_fazenda",
        family_code: "raiva_herbivoros",
        regimen_version: 1,
      },
    });
    const firstDose = buildProtocolItem({
      id: "raiva-dose-1",
      protocolo_id: "raiva-protocol",
      produto: "Vacina antirrabica",
      dose_num: 1,
      payload: {
        item_code: "dose_1",
      },
    });

    renderManager(
      <FarmProtocolManager
        activeFarmId="farm-1"
        farmExperienceMode="completo"
        catalogProducts={[] satisfies ProdutoVeterinarioCatalogEntry[]}
        protocols={[customProtocol]}
        protocolItems={[firstDose]}
        canManage
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /nova etapa/i }));

    const itemDialog = screen.getByRole("dialog");
    expect(within(itemDialog).getByText("Contexto da etapa")).toBeInTheDocument();
    expect(itemDialog).toHaveTextContent(/familia: raiva_herbivoros/i);
    expect(itemDialog).toHaveTextContent(/milestone: dose_2/i);
    expect(itemDialog).toHaveTextContent(/depende de: dose_1/i);
    expect(itemDialog).toHaveTextContent(
      /dedup sugerido: sanitario:raiva_herbivoros:\{animal_id\}:milestone:dose_2/i,
    );
  });

  it("exibe classe operacional da etapa sanitaria", () => {
    const protocol = buildProtocol({
      id: "tpb-protocol",
      nome: "TPB",
      payload: {
        origem: "customizado_fazenda",
        family_code: "tpb",
      },
    });
    const clinicalItem = buildProtocolItem({
      id: "tpb-item",
      protocolo_id: "tpb-protocol",
      tipo: "medicamento",
      produto: "Roteiro TPB",
      gera_agenda: false,
      payload: {
        calendario_base: {
          mode: "clinical_protocol",
          anchor: "clinical_need",
        },
      },
    });

    renderManager(
      <FarmProtocolManager
        activeFarmId="farm-1"
        farmExperienceMode="completo"
        catalogProducts={[] satisfies ProdutoVeterinarioCatalogEntry[]}
        protocols={[protocol]}
        protocolItems={[clinicalItem]}
        canManage
      />,
    );

    expect(screen.getByText("Protocolo clinico")).toBeInTheDocument();
    expect(screen.getByText("Apoio clinico")).toBeInTheDocument();
    expect(screen.getByText("Sem agenda")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /registrar manejo clinico/i }),
    ).toBeInTheDocument();
  });

  it("exibe codigo humano e versao da etapa", () => {
    const protocol = buildProtocol({
      id: "protocol-versioned",
      nome: "Protocolo versionado",
      payload: {
        origem: "customizado_fazenda",
        family_code: "raiva",
      },
    });
    const item = buildProtocolItem({
      id: "item-version-3",
      protocolo_id: "protocol-versioned",
      item_code: "raiva_d1",
      version: 3,
      produto: "Vacina antirrabica",
    });

    renderManager(
      <FarmProtocolManager
        activeFarmId="farm-1"
        farmExperienceMode="completo"
        catalogProducts={[] satisfies ProdutoVeterinarioCatalogEntry[]}
        protocols={[protocol]}
        protocolItems={[item]}
        canManage
      />,
    );

    expect(screen.getByText("raiva_d1 / v3")).toBeInTheDocument();
  });

  it("ativa agenda operacional de Vaca Seca somente na copia da fazenda", () => {
    const protocol = buildProtocol({
      id: "dry-cow-protocol",
      nome: "Terapia de Vaca Seca",
      payload: {
        origem: "biblioteca_canonica_fazenda",
        standard_id: "med-mastite-seca",
        family_code: "terapia_vaca_seca",
      },
    });
    const clinicalItem = buildProtocolItem({
      id: "dry-cow-item",
      protocolo_id: "dry-cow-protocol",
      tipo: "medicamento",
      produto: "Antibiotico Intramamario (Vaca Seca)",
      intervalo_dias: 0,
      gera_agenda: false,
      payload: {
        standard_id: "med-mastite-seca",
        family_code: "terapia_vaca_seca",
        item_code: "secagem-intramamario",
        calendario_base: {
          mode: "clinical_protocol",
          anchor: "dry_off",
        },
      },
    });

    renderManager(
      <FarmProtocolManager
        activeFarmId="farm-1"
        farmExperienceMode="completo"
        catalogProducts={[] satisfies ProdutoVeterinarioCatalogEntry[]}
        protocols={[protocol]}
        protocolItems={[clinicalItem]}
        canManage
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /ativar agenda de vaca seca/i }),
    );

    expect(createGesture).toHaveBeenCalledWith("farm-1", [
      expect.objectContaining({
        table: "protocolos_sanitarios_itens",
        action: "UPDATE",
        record: expect.objectContaining({
          id: "dry-cow-item",
          ativo: false,
          superseded_at: expect.any(String),
        }),
      }),
      expect.objectContaining({
        table: "protocolos_sanitarios_itens",
        action: "INSERT",
        record: expect.objectContaining({
          logical_item_key: "logical-item-1",
          version: 2,
          ativo: true,
          gera_agenda: true,
          intervalo_dias: 60,
          payload: expect.objectContaining({
            family_code: "terapia_vaca_seca",
            item_code: "secagem-intramamario",
            protocol_id: "med-mastite-seca",
            materialization_contract_version: 1,
            agenda_activation: expect.objectContaining({
              mode: "dry_off_reproductive_window",
              source: "farm_protocol_explicit_activation",
              contract_version: 1,
            }),
            dry_cow_therapy: expect.objectContaining({
              activation_status: "operational_agenda_enabled",
              materialization_contract_version: 1,
            }),
          }),
        }),
      }),
      expect.objectContaining({
        table: "protocolos_sanitarios_itens",
        action: "UPDATE",
        record: expect.objectContaining({
          id: "dry-cow-item",
          superseded_by_id: expect.any(String),
        }),
      }),
    ]);
  });

  it("mantem ativacao de Vaca Seca oculta fora do modo completo", () => {
    const protocol = buildProtocol({
      id: "dry-cow-protocol",
      nome: "Terapia de Vaca Seca",
      payload: {
        origem: "biblioteca_canonica_fazenda",
        standard_id: "med-mastite-seca",
        family_code: "terapia_vaca_seca",
      },
    });
    const clinicalItem = buildProtocolItem({
      id: "dry-cow-item",
      protocolo_id: "dry-cow-protocol",
      tipo: "medicamento",
      produto: "Antibiotico Intramamario (Vaca Seca)",
      intervalo_dias: 0,
      gera_agenda: false,
      payload: {
        standard_id: "med-mastite-seca",
        family_code: "terapia_vaca_seca",
        item_code: "secagem-intramamario",
        calendario_base: {
          mode: "clinical_protocol",
          anchor: "dry_off",
        },
      },
    });

    renderManager(
      <FarmProtocolManager
        activeFarmId="farm-1"
        farmExperienceMode="essencial"
        catalogProducts={[] satisfies ProdutoVeterinarioCatalogEntry[]}
        protocols={[protocol]}
        protocolItems={[clinicalItem]}
        canManage
      />,
    );

    expect(screen.getByText("Exposicao controlada")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ativar agenda de vaca seca/i }),
    ).not.toBeInTheDocument();
    expect(createGesture).not.toHaveBeenCalled();
  });
});
