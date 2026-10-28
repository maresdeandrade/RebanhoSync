import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
import { buildCalfJourneyAgendaOps } from "../calfJourney";
import { buildPostPartumOps } from "../postPartum";

const calf = {
  id: "22222222-2222-4222-8222-222222222222",
  identificacao: "CRIA",
  nome: null,
  lote_id: null,
  pai_id: null,
  data_nascimento: "2026-04-01",
  payload: { birth_event_id: "44444444-4444-4444-8444-444444444444" },
};
const mother = {
  id: "33333333-3333-4333-8333-333333333333",
  identificacao: "MAE",
};
const input = {
  fazendaId: "11111111-1111-4111-8111-111111111111",
  calf,
  mother,
};

describe("jornada prospectiva da cria", () => {
  it("emits no new sanitary INSERT on the legacy rail", () => {
    const result = buildCalfJourneyAgendaOps(input);
    expect(
      result.ops.filter(
        (op) => op.action === "INSERT" && op.record.dominio === "sanitario",
      ),
    ).toHaveLength(0);
    expect(result.ops.map((op) => op.record.tipo)).toEqual([
      "pesagem_d7",
      "pesagem_d30",
      "desmame",
    ]);
    expect(result.ops.map((op) => op.record.data_prevista)).toEqual([
      "2026-04-08",
      "2026-05-01",
      "2026-10-28",
    ]);
  });
  it("plans three daily umbilical intentions and an independent neonatal review", () => {
    const { sanitarioAgendaV2 = [] } = buildCalfJourneyAgendaOps(input);
    expect(sanitarioAgendaV2).toHaveLength(4);
    expect(
      sanitarioAgendaV2.map((draft) => draft.agenda.data_programada),
    ).toEqual([
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-04",
    ]);
    expect(
      sanitarioAgendaV2.map((draft) => draft.agenda.acao_sanitaria),
    ).toEqual([
      "cura_umbigo",
      "cura_umbigo",
      "cura_umbigo",
      "revisao_neonatal",
    ]);
    expect(
      sanitarioAgendaV2.every(
        (draft) =>
          draft.agenda.protocolo_id === null &&
          draft.agenda.execution_evento_id === null &&
          draft.agenda.produto_veterinario_id === null,
      ),
    ).toBe(true);
    const again = buildCalfJourneyAgendaOps(input);
    expect(again.sanitarioAgendaV2.map((draft) => draft.agenda.id)).toEqual(
      sanitarioAgendaV2.map((draft) => draft.agenda.id),
    );
  });
  it("records weighing and plans every sanitary milestone without a parallel sanitary fact", () => {
    const result = buildPostPartumOps({
      fazendaId: input.fazendaId,
      mother,
      calves: [calf],
      drafts: [
        {
          calfId: calf.id,
          identificacao: "CRIA",
          nome: "",
          loteId: null,
          pesoKg: "32",
          curaUmbigo: true,
        },
      ],
      occurredAt: "2026-04-01T12:00:00.000Z",
    });
    expect(result.ops.filter((op) => op.table === "eventos")).toHaveLength(1);
    expect(
      result.ops.some(
        (op) => op.table === "eventos_pesagem" && op.record.peso_kg === 32,
      ),
    ).toBe(true);
    expect(
      result.ops.some(
        (op) =>
          op.table === "eventos_sanitario" &&
          op.record.produto === "Cura de umbigo",
      ),
    ).toBe(false);
    expect(
      result.ops.filter(
        (op) =>
          op.table === "agenda_itens" &&
          op.action === "INSERT" &&
          op.record.dominio === "sanitario",
      ),
    ).toHaveLength(0);
    expect(
      result.sanitarioAgendaV2?.map((draft) => draft.agenda.acao_sanitaria),
    ).toEqual(["cura_umbigo", "cura_umbigo", "cura_umbigo", "revisao_neonatal"]);
  });
});
