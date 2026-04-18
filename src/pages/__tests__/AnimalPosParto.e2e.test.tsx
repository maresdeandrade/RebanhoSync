/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/offline/db";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { showSuccess } from "@/utils/toast";
import AnimalPosParto from "@/pages/AnimalPosParto";
import AnimalCriaInicial from "@/pages/AnimalCriaInicial";
import type { Animal, Lote, Pasto } from "@/lib/offline/types";

vi.mock("@/hooks/useAuth");
vi.mock("@/utils/toast", () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
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

const FARM_ID = "farm-1";
const MOTHER_ID = "matriz-1";
const FATHER_ID = "touro-1";
const MATERNITY_LOTE_ID = "lote-maternidade";
const PASTO_ID = "pasto-maternidade";
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

  const eventId = "evento-parto-e2e-1";
  const calfId = "cria-e2e-1";

  await db.state_animais.add(
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
        birth_event_id: eventId,
        ordem_cria: 1,
      },
    }),
  );

  await db.queue_gestures.clear();
  await db.queue_ops.clear();

  return {
    eventId,
    calfIds: [calfId],
  };
}

describe("Fluxo E2E de parto -> pos-parto -> cria", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedShowSuccess = vi.mocked(showSuccess);

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await resetOfflineDb();

    mockedUseAuth.mockReturnValue({
      activeFarmId: FARM_ID,
      role: "owner",
      farmMeasurementConfig: { weight_unit: "kg" },
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    } as ReturnType<typeof useAuth>);
  });

  afterEach(async () => {
    localStorage.clear();
    await resetOfflineDb();
  });

  it("fecha o pos-parto a partir do parto e conclui um marco inicial da cria", async () => {
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
      >
        <Routes>
          <Route path="/animais/:id/pos-parto" element={<AnimalPosParto />} />
          <Route
            path="/animais/:id/cria-inicial"
            element={<AnimalCriaInicial />}
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
    const identificacaoInput = await screen.findByLabelText(/Identificacao final/i);
    expect(identificacaoInput).toHaveValue("TMP-001");

    fireEvent.change(identificacaoInput, {
      target: { value: "BZ-001" },
    });
    fireEvent.change(screen.getByLabelText(/Primeira pesagem \(kg\)/i), {
      target: { value: "32.5" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Registrar cura do umbigo/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Finalizar pos-parto/i }));

    expect(
      await screen.findByRole("heading", {
        name: /Jornada inicial da cria BZ-001/i,
      }),
    ).toBeInTheDocument();
    expect(mockedShowSuccess).toHaveBeenCalledWith(
      expect.stringContaining("Pos-parto finalizado para 1 cria(s)."),
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
      "revisao_neonatal",
    ]);
    expect(await db.queue_gestures.count()).toBe(1);

    expect(
      await screen.findByText("Revisao neonatal"),
    ).toBeInTheDocument();

    const reviewAction = screen.getAllByRole("button", {
      name: /Concluir marco/i,
    })[0];
    fireEvent.click(reviewAction);

    expect(
      await screen.findByRole("link", { name: /Ver evento gerado/i }),
    ).toHaveAttribute("href", expect.stringMatching(/\/eventos\?eventoId=/));

    const agendaAfterReview = await db.state_agenda_itens
      .where("animal_id")
      .equals(calfId)
      .toArray();
    const reviewAgenda = agendaAfterReview.find(
      (item) => item.tipo === "revisao_neonatal",
    );

    expect(reviewAgenda?.status).toBe("concluido");
    expect(reviewAgenda?.source_evento_id).toBeTruthy();

    const reviewEvent = await db.event_eventos.get(reviewAgenda?.source_evento_id ?? "");
    expect(reviewEvent?.animal_id).toBe(calfId);
    expect(reviewEvent?.source_task_id).toBe(reviewAgenda?.id);

    const reviewDetail = await db.event_eventos_sanitario.get(
      reviewAgenda?.source_evento_id ?? "",
    );
    expect(reviewDetail?.produto).toBe("Revisao neonatal");
    expect(await db.queue_gestures.count()).toBe(2);
  });
});
