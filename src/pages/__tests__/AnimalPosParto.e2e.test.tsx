/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { buildReproductionGesture } from "@/lib/reproduction/register";
import { establishLocalOwnership } from "@/lib/offline/ownership";
import { executeSanitaryAgendaV2 } from "@/lib/sanitario/execution/sanitaryAgendaExecutionV2";
import { showSuccess } from "@/utils/toast";
import AnimalPosParto from "@/pages/AnimalPosParto";
import type { Animal, Lote, Pasto } from "@/lib/offline/types";

vi.mock("@/hooks/useAuth");
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: "user-neonatal-e2e" } } }, error: null })) } },
}));
vi.mock("@/utils/toast", () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ children }: { children?: ReactNode }) => <>{children ?? null}</>,
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

const FARM_ID = "11111111-1111-4111-8111-111111111111";
const MOTHER_ID = "33333333-3333-4333-8333-333333333333";
const FATHER_ID = "55555555-5555-4555-8555-555555555555";
const MATERNITY_LOTE_ID = "66666666-6666-4666-8666-666666666666";
const PASTO_ID = "77777777-7777-4777-8777-777777777777";
const NOW = "2026-04-11T12:00:00.000Z";

function makeAnimal(overrides: Partial<Animal>): Animal {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    fazenda_id: overrides.fazenda_id ?? FARM_ID,
    identificacao: overrides.identificacao ?? "AN-001",
    sexo: overrides.sexo ?? "F",
    status: overrides.status ?? "ativo",
    lote_id: overrides.lote_id ?? null,
    data_nascimento: overrides.data_nascimento ?? "2024-01-01",
    data_entrada: overrides.data_entrada ?? null,
    data_saida: overrides.data_saida ?? null,
    pai_id: overrides.pai_id ?? null,
    mae_id: overrides.mae_id ?? null,
    nome: overrides.nome ?? null,
    rfid: overrides.rfid ?? null,
    origem: overrides.origem ?? "nascimento",
    raca: overrides.raca ?? null,
    papel_macho: overrides.papel_macho ?? null,
    habilitado_monta: overrides.habilitado_monta ?? false,
    observacoes: overrides.observacoes ?? null,
    payload: overrides.payload ?? {},
    client_id: overrides.client_id ?? "client-1",
    client_op_id: overrides.client_op_id ?? `op-${overrides.id ?? "animal"}`,
    client_tx_id: overrides.client_tx_id ?? null,
    client_recorded_at: overrides.client_recorded_at ?? NOW,
    server_received_at: overrides.server_received_at ?? NOW,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
    deleted_at: overrides.deleted_at ?? null,
  };
}

function makeLote(overrides: Partial<Lote>): Lote {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    fazenda_id: overrides.fazenda_id ?? FARM_ID,
    nome: overrides.nome ?? "Lote",
    status: overrides.status ?? "ativo",
    pasto_id: overrides.pasto_id ?? null,
    touro_id: overrides.touro_id ?? null,
    observacoes: overrides.observacoes ?? null,
    payload: overrides.payload ?? {},
    client_id: overrides.client_id ?? "client-1",
    client_op_id: overrides.client_op_id ?? `op-${overrides.id ?? "lote"}`,
    client_tx_id: overrides.client_tx_id ?? null,
    client_recorded_at: overrides.client_recorded_at ?? NOW,
    server_received_at: overrides.server_received_at ?? NOW,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
    deleted_at: overrides.deleted_at ?? null,
  };
}

function makePasto(overrides: Partial<Pasto>): Pasto {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    fazenda_id: overrides.fazenda_id ?? FARM_ID,
    nome: overrides.nome ?? "Pasto",
    area_ha: overrides.area_ha ?? 12,
    capacidade_ua: overrides.capacidade_ua ?? 15,
    tipo_pasto: overrides.tipo_pasto ?? "cultivado",
    infraestrutura: overrides.infraestrutura ?? {},
    observacoes: overrides.observacoes ?? null,
    payload: overrides.payload ?? {},
    client_id: overrides.client_id ?? "client-1",
    client_op_id: overrides.client_op_id ?? `op-${overrides.id ?? "pasto"}`,
    client_tx_id: overrides.client_tx_id ?? null,
    client_recorded_at: overrides.client_recorded_at ?? NOW,
    server_received_at: overrides.server_received_at ?? NOW,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
    deleted_at: overrides.deleted_at ?? null,
  };
}

function AnimalCriaInicialStub() {
  return <h1>Jornada inicial da cria</h1>;
}

async function resetOfflineDb() {
  if (!db.isOpen()) {
    await db.open();
  }

  for (const table of db.tables) {
    await table.clear();
  }
}

async function seedReproductionBase() {
  await db.state_pastos.bulkAdd([
    makePasto({
      id: PASTO_ID,
      nome: "Pasto maternidade",
    }),
  ]);

  await db.state_lotes.bulkAdd([
    makeLote({
      id: MATERNITY_LOTE_ID,
      nome: "Maternidade",
      pasto_id: PASTO_ID,
    }),
    makeLote({
      id: "lote-bezerreiro",
      nome: "Bezerreiro",
      pasto_id: PASTO_ID,
    }),
  ]);

  await db.state_animais.bulkAdd([
    makeAnimal({
      id: MOTHER_ID,
      identificacao: "MAT-001",
      sexo: "F",
      lote_id: MATERNITY_LOTE_ID,
      data_nascimento: "2022-01-15",
      raca: "nelore",
      origem: "compra",
      payload: {},
    }),
    makeAnimal({
      id: FATHER_ID,
      identificacao: "TOR-001",
      sexo: "M",
      lote_id: MATERNITY_LOTE_ID,
      data_nascimento: "2020-08-10",
      raca: "nelore",
      origem: "compra",
      papel_macho: "reprodutor",
      habilitado_monta: true,
      payload: {},
    }),
  ]);

  const birth = buildReproductionGesture({
    fazendaId: FARM_ID,
    animalId: MOTHER_ID,
    animalIdentificacao: "MAT-001",
    eventId: "44444444-4444-4444-8444-444444444444",
    occurredAt: NOW,
    loteId: MATERNITY_LOTE_ID,
    paiId: FATHER_ID,
    data: {
      tipo: "parto", dataParto: "2026-04-11", numeroCrias: 1,
      crias: [{ localId: "22222222-2222-4222-8222-222222222222", identificacao: "TMP-001", sexo: "F" }],
    },
  });
  await createGesture(FARM_ID, birth.ops, {
    sanitarioAgendaV2: birth.sanitarioAgendaV2,
    enqueueSanitarioAgendaV2: true,
  });
  return birth;
}

async function settleUi() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Fluxo E2E de parto -> pos-parto -> cria", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedShowSuccess = vi.mocked(showSuccess);

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await resetOfflineDb();
    vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("VITE_BACKEND_ENV", "development");
    await establishLocalOwnership({ user: { id: "user-neonatal-e2e" } } as never);
    localStorage.setItem("rebanhosync:sanitario-v2-push", "local");
    await db.sync_sanitario_v2_cutovers.put({
      key: `${FARM_ID}:2`, fazenda_id: FARM_ID, contract_version: 2, status: "APPLIED",
      prepared_at: NOW, applying_at: NOW, applied_at: NOW, failed_at: null, last_error: null, updated_at: NOW,
    });

    mockedUseAuth.mockReturnValue({
      activeFarmId: FARM_ID,
      role: "owner",
      user: { id: "user-neonatal-e2e" },
      farmMeasurementConfig: { weight_unit: "kg" },
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    } as ReturnType<typeof useAuth>);
  });

  afterEach(async () => {
    await act(async () => cleanup());
    localStorage.clear();
    await resetOfflineDb();
    vi.unstubAllEnvs();
  });

  it(
    "fecha o pos-parto sem fato sanitário paralelo e executa somente D0 pelo comando da Central",
    { retry: 2 },
    async () => {
    const user = userEvent.setup();
    const parto = await seedReproductionBase();
    const calfId = parto.calfIds[0] ?? "cria-e2e-1";
    const repairReproBase = async () => {
      await db.state_pastos.put(
        makePasto({
          id: PASTO_ID,
          nome: "Pasto maternidade",
        }),
      );
      await db.state_lotes.put(
        makeLote({
          id: MATERNITY_LOTE_ID,
          nome: "Maternidade",
          pasto_id: PASTO_ID,
        }),
      );
      await db.state_animais.put(
        makeAnimal({
          id: MOTHER_ID,
          identificacao: "MAT-001",
          sexo: "F",
          lote_id: MATERNITY_LOTE_ID,
          data_nascimento: "2022-01-15",
          raca: "nelore",
          origem: "compra",
          payload: {},
        }),
      );
      await db.state_animais.put(
        makeAnimal({
          id: FATHER_ID,
          identificacao: "TOR-001",
          sexo: "M",
          lote_id: MATERNITY_LOTE_ID,
          data_nascimento: "2020-08-10",
          raca: "nelore",
          origem: "compra",
          papel_macho: "reprodutor",
          habilitado_monta: true,
          payload: {},
        }),
      );
      await db.state_animais.put(
        makeAnimal({
          id: calfId,
          identificacao: "TMP-001",
          sexo: "F",
          lote_id: MATERNITY_LOTE_ID,
          data_nascimento: "2026-04-11",
          mae_id: MOTHER_ID,
          pai_id: FATHER_ID,
          origem: "nascimento",
          payload: {
            generated_from: "evento_parto",
            birth_event_id: parto.eventId,
            ordem_cria: 1,
          },
        }),
      );
    };
    await repairReproBase();
    const posPartoUrl = new URLSearchParams();
    posPartoUrl.set("eventoId", parto.eventId);
    posPartoUrl.set("cria", calfId);

    render(
      <MemoryRouter
        initialEntries={[`/animais/${MOTHER_ID}/pos-parto?${posPartoUrl.toString()}`]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/animais/:id/pos-parto" element={<AnimalPosParto />} />
          <Route
            path="/animais/:id/cria-inicial"
            element={<AnimalCriaInicialStub />}
          />
        </Routes>
      </MemoryRouter>,
    );

    const heading = await screen
      .findByRole("heading", {
        name: /Pos-parto da matriz MAT-001/i,
      })
      .catch(async () => {
        await repairReproBase();
        return screen.findByRole("heading", {
          name: /Pos-parto da matriz MAT-001/i,
        });
      });
    expect(heading).toBeInTheDocument();
    await settleUi();
    const identificacaoInput = await screen.findByLabelText(/Identificacao final/i);
    expect(identificacaoInput).toHaveValue("TMP-001");

    await user.clear(identificacaoInput);
    await user.type(identificacaoInput, "BZ-001");
    await user.clear(screen.getByLabelText(/Primeira pesagem \(kg\)/i));
    await user.type(screen.getByLabelText(/Primeira pesagem \(kg\)/i), "32.5");
    expect(screen.queryByRole("checkbox", { name: /Registrar cura do umbigo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Registrar manejo na Central Sanitária/i }))
      .toHaveAttribute("href", `/protocolos-sanitarios?tab=agenda&animalId=${calfId}`);
    await user.click(
      screen.getByRole("button", { name: /Registrar pós-parto/i }),
    );
    await settleUi();

    await waitFor(
      () => {
        expect(
          screen.getByRole("heading", {
            name: /Jornada inicial da cria/i,
          }),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    expect(mockedShowSuccess).toHaveBeenCalledWith(
      expect.stringContaining("Execução registrada com sucesso. Pós-parto finalizado para 1 cria(s)."),
    );

    await waitFor(async () => {
      const calf = await db.state_animais.get(calfId);
      expect(calf?.identificacao).toBe("BZ-001");
      expect(calf?.payload.neonatal_setup).toMatchObject({
        mother_id: MOTHER_ID,
        father_id: FATHER_ID,
        birth_event_id: parto.eventId,
        initial_weight_kg: 32.5,
      });
    });

    const agendaAfterPostPartum = await db.state_agenda_itens
      .where("animal_id")
      .equals(calfId)
      .toArray();

    expect(agendaAfterPostPartum.map((item) => item.tipo).sort()).toEqual([
      "desmame",
      "pesagem_d30",
      "pesagem_d7",
    ]);
    expect(await db.queue_gestures.count()).toBe(2);
    expect(await db.event_eventos_pesagem.count()).toBe(1);
    expect(await db.event_eventos_sanitario.count()).toBe(0);

    const sanitaryAgenda = (await db.ops_sanitario_agenda_v2.where("fazenda_id").equals(FARM_ID).toArray())
      .sort((a, b) => a.data_programada.localeCompare(b.data_programada));
    expect(sanitaryAgenda.map(item => item.acao_sanitaria)).toEqual([
      "cura_umbigo", "cura_umbigo", "cura_umbigo", "revisao_neonatal",
    ]);
    expect(sanitaryAgenda.every(item => item.status === "programada")).toBe(true);
    const d0 = sanitaryAgenda[0];
    const execution = {
      fazendaId: FARM_ID,
      agendaId: d0.id,
      clientOpId: `central-e2e:${d0.id}`,
      executedAt: NOW,
      registrationMode: "executed_fact" as const,
      confirmation: { userConfirmedExecution: true as const },
    };
    const executed = await executeSanitaryAgendaV2(execution);
    await settleUi();
    expect(await db.ops_sanitario_agenda_v2.get(d0.id)).toMatchObject({ status: "executada", execution_evento_id: executed.eventId });
    for (const pending of sanitaryAgenda.slice(1))
      expect((await db.ops_sanitario_agenda_v2.get(pending.id))?.status).toBe("programada");
    expect(await db.event_eventos.get(executed.eventId)).toMatchObject({ animal_id: calfId, source_sanitario_agenda_v2_id: d0.id });
    expect(await db.event_eventos_sanitario.count()).toBe(1);
    expect(await db.event_eventos_sanitario.get(executed.eventId)).toMatchObject({
      produto_sanitario_v2_id: null, dose_quantidade: null, via_aplicacao: null,
    });
    expect(await db.queue_gestures.count()).toBe(3);
    const operations = await db.queue_ops.toArray();
    expect(operations.filter(op => op.record.command === "apply_factual_core")).toHaveLength(1);
    expect((await executeSanitaryAgendaV2(execution)).eventId).toBe(executed.eventId);
    expect(await db.queue_ops.toArray()).toEqual(operations);
    expect(await db.event_eventos_sanitario.count()).toBe(1);
    await settleUi();
    },
  );
});

