/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FarmProtocolManager } from "@/components/sanitario/FarmProtocolManager";
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
    protocol_item_id: overrides?.protocol_item_id ?? "protocol-item-1",
    version: overrides?.version ?? 1,
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

  it("mostra conflito inline ao editar um protocolo com familia ja coberta pelo pack oficial", () => {
    const officialProtocol = buildProtocol({
      id: "official-brucelose",
      nome: "Brucelose oficial",
      payload: {
        origem: "catalogo_oficial",
        family_code: "brucelose",
      },
    });

    render(
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

    render(
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
});
