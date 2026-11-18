/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import type { SanitaryTriageResultV2 } from "@/lib/sanitario/triage/sanitaryTriageV2";
import { defaultProtocolFamiliesV1 } from "@/lib/sanitario/adoption/protocolAdoptionV1";
import { saveProtocolAdoptionV1 } from "@/lib/sanitario/adoption/saveProtocolAdoptionV1";
import { SanitaryFarmProtocolsV1 } from "../SanitaryFarmProtocolsV1";
import { db } from "@/lib/offline/db";
import type { Operation } from "@/lib/offline/types";

const liveQuery = vi.hoisted(() => ({ query: null as null | (() => Promise<Operation[]>), rows: [] as Operation[] }));

vi.mock("@/lib/sanitario/adoption/saveProtocolAdoptionV1", () => ({ saveProtocolAdoptionV1: vi.fn() }));
vi.mock("@/lib/offline/db", async () => {
  const { default: Dexie } = await import("dexie");
  const { indexedDB, IDBKeyRange } = await import("fake-indexeddb");
  const database = new Dexie("farm-protocol-ui-test", { indexedDB, IDBKeyRange });
  database.version(1).stores({ queue_ops: "client_op_id, fazenda_id" });
  return { db: database };
});
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: (query: () => Promise<Operation[]>) => { liveQuery.query = query; return liveQuery.rows; } }));

function source(enabled?: boolean, farmId = "farm-1"): SanitaryProtocolWindowSourceV2 {
  const families = defaultProtocolFamiliesV1();
  families.brucelose_b19 = { monitoringEnabled: enabled ?? true };
  return {
    fazendaId: farmId,
    farmConfig: enabled === undefined ? undefined : {
      fazenda_id: farmId, payload: { sanitary_protocol_adoption_v1: { schemaVersion: 1, revision: 4, families } },
    },
    catalog: {
      protocols: [
        { id: "b19", familyCode: "brucelose_b19", name: "B19", status: "active" },
        { id: "aftosa", familyCode: "febre_aftosa", name: "Aftosa", status: "retired", legalStatus: "bloqueado" },
      ],
      items: [
        { id: "b19-v1", protocolId: "b19", logicalItemKey: "b19_femeas_3_8_meses", version: 1, status: "active", itemStatus: "active" },
        { id: "aftosa-v1", protocolId: "aftosa", logicalItemKey: "fmd_bloqueio_vacinacao_rotina", version: 1, status: "retired", itemStatus: "bloqueado" },
      ], productClassGroups: [],
    },
    animals: [], lots: [], executedHistory: [], executedEvents: [], agendaAnimals: [],
    agendas: [{ id: "agenda-1", fazenda_id: farmId, protocolo_id: "b19", status: "programada" }],
  } as unknown as SanitaryProtocolWindowSourceV2;
}
const result = {
  evaluations: [
    { animalId: "a", protocolId: "b19", itemId: "b19-v1", disposition: "opportunity_in_window", status: "in_action_window", blockers: [] },
    { animalId: "a", protocolId: "b19", itemId: "b19-v1", disposition: "opportunity_in_window", status: "in_action_window", blockers: [] },
    { animalId: "b", protocolId: "b19", itemId: "b19-v1", disposition: "insufficient_data", status: "insufficient_data", blockers: [] },
  ],
} as unknown as SanitaryTriageResultV2;
const callbacks = () => ({ onOpenAgenda: vi.fn(), onOpenTriage: vi.fn() });

describe("SanitaryFarmProtocolsV1", () => {
  beforeEach(() => { liveQuery.rows = []; vi.mocked(saveProtocolAdoptionV1).mockResolvedValue("op-1"); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("apresenta quatro pacotes, itens reais e animais únicos da coleção recebida", () => {
    const props = callbacks();
    render(<SanitaryFarmProtocolsV1 source={source(true)} result={result} canManage {...props} />);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    const card = screen.getByRole("region", { name: /B19/ });
    expect(within(card).getByText("B19 — fêmeas de 3 a 8 meses")).toBeInTheDocument();
    expect(within(card).getByText(/1 elegíveis/)).toBeInTheDocument();
    expect(within(card).getByText(/1 dados insuficientes/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: /Abrir lista/ }));
    expect(props.onOpenTriage).toHaveBeenCalledOnce();
    expect(props.onOpenTriage).toHaveBeenCalledWith("b19", "b19-v1");
    const aftosa = screen.getByRole("region", { name: /aftosa/i });
    expect(within(aftosa).queryByRole("switch")).not.toBeInTheDocument();
    expect(within(aftosa).getByText(/Indisponível/)).toBeInTheDocument();
  });

  it("OFF oculta contadores e mantém acesso às Agendas programadas", () => {
    const props = callbacks();
    render(<SanitaryFarmProtocolsV1 source={source(false)} result={result} canManage {...props} />);
    const card = screen.getByRole("region", { name: /B19/ });
    expect(within(card).queryByText(/elegíveis/)).not.toBeInTheDocument();
    expect(within(card).getByText(/1 Agenda.*preservada/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: /Abrir Agendas/ }));
    expect(props.onOpenAgenda).toHaveBeenCalledOnce();
  });

  it("salva só intenção com revisão original e mantém contadores confirmados", async () => {
    render(<SanitaryFarmProtocolsV1 source={source(true)} result={result} canManage {...callbacks()} />);
    fireEvent.click(screen.getByRole("switch", { name: /B19/ }));
    expect(screen.getByText(/1 elegíveis/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar protocolos" }));
    await waitFor(() => expect(saveProtocolAdoptionV1).toHaveBeenCalledWith("farm-1", 4, expect.objectContaining({ brucelose_b19: { monitoringEnabled: false } })));
    expect(await screen.findByText(/Aguardando sincronização/)).toBeInTheDocument();
    expect(screen.getByText(/1 elegíveis/)).toBeInTheDocument();
  });

  it("preserva consulta legada sem adesão e impede edição sem papel de gestão", () => {
    render(<SanitaryFarmProtocolsV1 source={source()} result={result} canManage={false} {...callbacks()} />);
    expect(screen.getByText(/Ainda não configurada/)).toBeInTheDocument();
    expect(screen.getByText(/1 elegíveis/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /B19/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar protocolos" })).toBeDisabled();
  });

  it("não transporta draft nem resposta assíncrona ao trocar de fazenda", async () => {
    let resolve!: (value: string) => void;
    vi.mocked(saveProtocolAdoptionV1).mockReturnValue(new Promise((done) => { resolve = done; }));
    const props = callbacks();
    const view = render(<SanitaryFarmProtocolsV1 source={source(true)} result={result} canManage {...props} />);
    fireEvent.click(screen.getByRole("switch", { name: /B19/ }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar protocolos" }));
    view.rerender(<SanitaryFarmProtocolsV1 source={source(true, "farm-2")} result={null} canManage {...props} />);
    resolve("old-op");
    await waitFor(() => expect(screen.getByRole("switch", { name: /B19/ })).toBeChecked());
    expect(screen.queryByText(/Aguardando sincronização/)).not.toBeInTheDocument();
  });

  it("não aplica draft sobre uma nova revisão confirmada sem recarregar", () => {
    const props = callbacks();
    const view = render(<SanitaryFarmProtocolsV1 source={source(true)} result={result} canManage {...props} />);
    fireEvent.click(screen.getByRole("switch", { name: /B19/ }));
    const updated = source(false);
    updated.farmConfig!.payload.sanitary_protocol_adoption_v1 = {
      schemaVersion: 1, revision: 5, families: { ...defaultProtocolFamiliesV1(), brucelose_b19: { monitoringEnabled: false } },
    };
    view.rerender(<SanitaryFarmProtocolsV1 source={updated} result={result} canManage {...props} />);
    expect(screen.getByRole("button", { name: "Salvar protocolos" })).toBeDisabled();
    expect(screen.queryByText(/1 elegíveis/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recarregar configuração" }));
    expect(saveProtocolAdoptionV1).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: /B19/ })).not.toBeChecked();
  });

  it("primeira gravação inicializa nove famílias com pré-confinamento OFF", async () => {
    render(<SanitaryFarmProtocolsV1 source={source()} result={result} canManage {...callbacks()} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar protocolos" }));
    await waitFor(() => expect(saveProtocolAdoptionV1).toHaveBeenCalledOnce());
    const [farmId, revision, families] = vi.mocked(saveProtocolAdoptionV1).mock.calls[0];
    expect(farmId).toBe("farm-1");
    expect(revision).toBe(0);
    expect(Object.keys(families)).toHaveLength(9);
    expect(families.vermifugacao_pre_confinamento_pasto_vedado).toEqual({ monitoringEnabled: false });
    expect(families.febre_aftosa).toBeUndefined();
    expect(screen.getByText(/1 elegíveis/)).toBeInTheDocument();
  });

  it("mostra etapas bloqueadas reais sem contadores e sem inventar reforço IBR", () => {
    const configured = source(true);
    configured.catalog.protocols.push(...[
      { id: "lepto", familyCode: "leptospirose", name: "Leptospirose", status: "active" },
      { id: "ibr", familyCode: "ibr_bvd", name: "IBR/BVD", status: "active" },
    ] as unknown as typeof configured.catalog.protocols);
    configured.catalog.items.push(...[
      { id: "lepto-v2", protocolId: "lepto", logicalItemKey: "lepto_primovac_dose2", version: 2, itemStatus: "bloqueado", status: "active" },
      { id: "ibr-v1", protocolId: "ibr", logicalItemKey: "ibr_bvd_primovac_dose1", version: 1, itemStatus: "active", status: "active" },
    ] as unknown as typeof configured.catalog.items);
    render(<SanitaryFarmProtocolsV1 source={configured} result={result} canManage {...callbacks()} />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Reprodutivo" }), { button: 0, ctrlKey: false });
    const lepto = screen.getByRole("region", { name: "Leptospirose" });
    expect(within(lepto).getByText("Primovacinação — dose 2")).toBeInTheDocument();
    expect(within(lepto).getByText("Indisponível")).toBeInTheDocument();
    expect(within(lepto).queryByText(/elegíveis/)).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "IBR/BVD" })).queryByText(/Reforço/)).not.toBeInTheDocument();
  });

  it("consulta pendências pelo tenant do record e domínio, sem depender do índice top-level", async () => {
    await db.queue_ops.bulkPut([
      { client_op_id: "ours", record: { fazenda_id: "farm-1", domain: "sanitary_protocol_adoption_v1" } },
      { client_op_id: "other-farm", record: { fazenda_id: "farm-2", domain: "sanitary_protocol_adoption_v1" } },
      { client_op_id: "other-domain", record: { fazenda_id: "farm-1", domain: "sanitario_v2" } },
    ] as Operation[]);
    render(<SanitaryFarmProtocolsV1 source={source(true)} result={result} canManage {...callbacks()} />);
    const operations = await liveQuery.query!();
    expect(operations.map(op => op.client_op_id)).toEqual(["ours"]);
    await db.queue_ops.clear();
  });

  it("mantém espera durável durante reconciliação e não permite um novo envio", () => {
    liveQuery.rows = [{ sync_state: "RECONCILE", record: { expected_revision: 4 } }] as Operation[];
    render(<SanitaryFarmProtocolsV1 source={source(true)} result={result} canManage {...callbacks()} />);
    expect(screen.getByText(/Aguardando sincronização/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /B19/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar protocolos" })).toBeDisabled();
    expect(screen.getByText(/1 elegíveis/)).toBeInTheDocument();
  });

  it("conflito não reenvia identidade antiga e exige pull mais recarga explícita", () => {
    liveQuery.rows = [{ sync_state: "REJECTED", blocked_reason: "PROTOCOL_ADOPTION_STALE_REVISION", record: { expected_revision: 4 } }] as Operation[];
    const props = callbacks();
    const view = render(<SanitaryFarmProtocolsV1 source={source(true)} result={result} canManage {...props} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Conflito de revisão");
    expect(screen.getByRole("switch", { name: /B19/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Recarregar configuração" }));
    expect(screen.getByRole("switch", { name: /B19/ })).toBeDisabled();
    const updated = source(true);
    updated.farmConfig!.payload.sanitary_protocol_adoption_v1 = { schemaVersion: 1, revision: 5, families: defaultProtocolFamiliesV1() };
    view.rerender(<SanitaryFarmProtocolsV1 source={updated} result={result} canManage {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Recarregar configuração" }));
    expect(screen.getByRole("switch", { name: /B19/ })).toBeEnabled();
    expect(saveProtocolAdoptionV1).not.toHaveBeenCalled();
  });
});
