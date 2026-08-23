/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  Evento,
  EventoEcc,
  EventoMovimentacao,
  EventoPesagem,
} from "@/lib/offline/types";
import { AnimalMovementHistoryTable } from "../AnimalMovementHistoryTable";
import { buildAnimalOccupancyTimeline } from "../buildAnimalOccupancyTimeline";
import { buildEccMetricsForOccupancy } from "../buildEccMetricsForOccupancy";
import { buildWeightGainForOccupancy } from "../buildWeightGainForOccupancy";

const ANIMAL_ID = "animal-1";
const FARM_ID = "farm-1";
const REFERENCE_DATE = "2026-04-01T08:00:00.000Z";

function event(
  id: string,
  dominio: Evento["dominio"],
  occurredAt: string,
): Evento {
  return {
    id,
    fazenda_id: FARM_ID,
    dominio,
    occurred_at: occurredAt,
    animal_id: ANIMAL_ID,
    lote_id: null,
    deleted_at: null,
  } as Evento;
}

function movement(
  eventId: string,
  fromLoteId: string | null,
  toLoteId: string | null,
  fromPastoId: string | null,
  toPastoId: string | null,
): EventoMovimentacao {
  return {
    evento_id: eventId,
    fazenda_id: FARM_ID,
    from_lote_id: fromLoteId,
    to_lote_id: toLoteId,
    from_pasto_id: fromPastoId,
    to_pasto_id: toPastoId,
    deleted_at: null,
  } as EventoMovimentacao;
}

function weight(eventId: string, pesoKg: number): EventoPesagem {
  return {
    evento_id: eventId,
    fazenda_id: FARM_ID,
    peso_kg: pesoKg,
    deleted_at: null,
  } as EventoPesagem;
}

function ecc(eventId: string, value: number): EventoEcc {
  return {
    event_id: eventId,
    fazenda_id: FARM_ID,
    animal_id: ANIMAL_ID,
    ecc: value,
    deleted_at: null,
  } as EventoEcc;
}

function baseMovement() {
  const movementEvent = event(
    "movement-entry",
    "movimentacao",
    "2026-01-01T08:00:00.000Z",
  );
  return {
    events: [movementEvent],
    movimentacoes: new Map([
      [
        movementEvent.id,
        movement(movementEvent.id, null, "lote-a", null, "pasto-a"),
      ],
    ]),
  };
}

describe("AnimalMovementHistoryTable com occupancy canônico", () => {
  it("renderiza movimentacao sem peso e sem ECC com status vazio", () => {
    const { events, movimentacoes } = baseMovement();
    const periods = buildAnimalOccupancyTimeline({
      animalId: ANIMAL_ID,
      events,
      movimentacoes,
      referenceDate: REFERENCE_DATE,
    });

    render(<AnimalMovementHistoryTable periods={periods} />);

    expect(periods[0].weightStatus.status).toBe("empty");
    expect(periods[0].eccStatus.status).toBe("empty");
    expect(screen.getAllByText("Vazio")).toHaveLength(2);
  });

  it("renderiza periodo enriquecido com peso", () => {
    const { events, movimentacoes } = baseMovement();
    const weightStart = event(
      "weight-start",
      "pesagem",
      "2026-01-02T08:00:00.000Z",
    );
    const weightEnd = event(
      "weight-end",
      "pesagem",
      "2026-03-01T08:00:00.000Z",
    );
    const allEvents = [...events, weightStart, weightEnd];
    const [period] = buildAnimalOccupancyTimeline({
      animalId: ANIMAL_ID,
      events: allEvents,
      movimentacoes,
      referenceDate: REFERENCE_DATE,
    });
    const enriched = buildWeightGainForOccupancy({
      period,
      events: allEvents,
      pesagens: new Map([
        [weightStart.id, weight(weightStart.id, 300)],
        [weightEnd.id, weight(weightEnd.id, 330)],
      ]),
    });

    render(<AnimalMovementHistoryTable periods={[enriched]} />);

    expect(enriched.weightStatus.status).toBe("complete");
    expect(screen.getByText("Ini: 300.0 kg")).toBeInTheDocument();
    expect(screen.getByText("Fin: 330.0 kg")).toBeInTheDocument();
    expect(screen.getByText("+30.0 kg")).toBeInTheDocument();
  });

  it("renderiza periodo enriquecido com ECC", () => {
    const { events, movimentacoes } = baseMovement();
    const eccStart = event(
      "ecc-start",
      "ecc",
      "2026-01-02T08:00:00.000Z",
    );
    const eccEnd = event(
      "ecc-end",
      "ecc",
      "2026-03-01T08:00:00.000Z",
    );
    const allEvents = [...events, eccStart, eccEnd];
    const [period] = buildAnimalOccupancyTimeline({
      animalId: ANIMAL_ID,
      events: allEvents,
      movimentacoes,
      referenceDate: REFERENCE_DATE,
    });
    const enriched = buildEccMetricsForOccupancy({
      period,
      events: allEvents,
      eccs: new Map([
        [eccStart.id, ecc(eccStart.id, 2.5)],
        [eccEnd.id, ecc(eccEnd.id, 3)],
      ]),
    });

    render(<AnimalMovementHistoryTable periods={[enriched]} />);

    expect(enriched.eccStatus.status).toBe("complete");
    expect(screen.getByText("Ini: 2.5")).toBeInTheDocument();
    expect(screen.getByText("Fin: 3.0")).toBeInTheDocument();
    expect(screen.getByText("+0.5")).toBeInTheDocument();
  });

  it("reconstroi entrada, saida e multiplas movimentacoes em ordem factual", () => {
    const entry = event(
      "movement-entry",
      "movimentacao",
      "2026-01-01T08:00:00.000Z",
    );
    const transfer = event(
      "movement-transfer",
      "movimentacao",
      "2026-02-01T08:00:00.000Z",
    );
    const exit = event(
      "movement-exit",
      "movimentacao",
      "2026-03-01T08:00:00.000Z",
    );
    const periods = buildAnimalOccupancyTimeline({
      animalId: ANIMAL_ID,
      events: [exit, entry, transfer],
      movimentacoes: new Map([
        [entry.id, movement(entry.id, null, "lote-a", null, "pasto-a")],
        [
          transfer.id,
          movement(
            transfer.id,
            "lote-a",
            "lote-b",
            "pasto-a",
            "pasto-b",
          ),
        ],
        [
          exit.id,
          movement(exit.id, "lote-b", null, "pasto-b", null),
        ],
      ]),
      referenceDate: REFERENCE_DATE,
    });

    expect(periods).toHaveLength(3);
    expect(periods[0]).toMatchObject({
      loteId: "lote-a",
      pastoId: "pasto-a",
      saidaAt: transfer.occurred_at,
    });
    expect(periods[1]).toMatchObject({
      loteId: "lote-b",
      pastoId: "pasto-b",
      saidaAt: exit.occurred_at,
    });
    expect(periods[2]).toMatchObject({
      loteId: null,
      pastoId: null,
      saidaAt: null,
    });
  });

  it("reconstroi o mesmo read model apos reload", () => {
    const input = baseMovement();
    const firstBuild = buildAnimalOccupancyTimeline({
      animalId: ANIMAL_ID,
      ...input,
      referenceDate: REFERENCE_DATE,
    });
    const rebuilt = buildAnimalOccupancyTimeline({
      animalId: ANIMAL_ID,
      ...input,
      referenceDate: REFERENCE_DATE,
    });

    expect(rebuilt).toEqual(firstBuild);
  });

  it("ignora evento legado sem detalhe de movimentacao", () => {
    const legacyEvent = event(
      "legacy-movement",
      "movimentacao",
      "2026-01-01T08:00:00.000Z",
    );
    const periods = buildAnimalOccupancyTimeline({
      animalId: ANIMAL_ID,
      events: [legacyEvent],
      movimentacoes: new Map(),
      referenceDate: REFERENCE_DATE,
    });

    render(<AnimalMovementHistoryTable periods={periods} />);

    expect(periods).toEqual([]);
    expect(
      screen.getByText("Sem histórico de movimentação disponível."),
    ).toBeInTheDocument();
  });
});
