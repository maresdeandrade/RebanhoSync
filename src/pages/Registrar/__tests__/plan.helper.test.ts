import { describe, expect, it } from "vitest";
import {
  buildRegistrarAgendaCompletionOp,
  resolveRegistrarDistinctAnimalIds,
  resolveRegistrarTargetAnimalIds,
} from "@/pages/Registrar/helpers/plan";

describe("plan helpers", () => {
  it("retorna alvos selecionados quando há seleção", () => {
    const targetIds = resolveRegistrarTargetAnimalIds({
      hasSelectedAnimals: true,
      selectedAnimais: ["a1", "a2"],
    });

    expect(targetIds).toEqual(["a1", "a2"]);
  });

  it("retorna alvo nulo quando não há seleção", () => {
    const targetIds = resolveRegistrarTargetAnimalIds({
      hasSelectedAnimals: false,
      selectedAnimais: [],
    });

    expect(targetIds).toEqual([null]);
  });

  it("deduplica ids distintos removendo null", () => {
    const distinct = resolveRegistrarDistinctAnimalIds([
      "a1",
      null,
      "a2",
      "a1",
    ]);

    expect(distinct).toEqual(["a1", "a2"]);
  });

  it("monta operação de conclusão de agenda vinculada ao evento", () => {
    const op = buildRegistrarAgendaCompletionOp({
      sourceTaskId: "task-1",
      linkedEventId: "evt-1",
    });

    expect(op).toEqual({
      table: "agenda_itens",
      action: "UPDATE",
      record: {
        id: "task-1",
        status: "concluido",
        source_evento_id: "evt-1",
      },
    });
  });
});
