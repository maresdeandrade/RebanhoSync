import { describe, expect, it } from "vitest";
import { projectSanitaryAssessmentV1 } from "../sanitaryAssessmentProjectionV1";

const event = (id: string, result = "no_treatment_indicated", extra = {}) => ({
  id, fazenda_id: "farm", dominio: "sanitario", occurred_at: "2026-05-01T12:00:00Z", deleted_at: null,
  corrige_evento_id: null, payload: { schema: "sanitary_assessment_v1", assessment: { schema_version: 1, result, protocol_id: "protocol", item_id: "item", item_version: 1, cycle_key: "2026", origin: "farm_assessment", responsible_name: "Gestor" } }, ...extra,
});
const rel = (id: string, animal = "animal", farm = "farm") => ({ evento_id: id, animal_id: animal, fazenda_id: farm });
const query = (events: ReturnType<typeof event>[], relations = [rel("one")]) => projectSanitaryAssessmentV1({ events, relations, farmId: "farm", animalId: "animal", protocolId: "protocol", itemId: "item", itemVersion: 1, cycleKey: "2026", asOf: "2026-05-31" });

describe("projeção factual de avaliação", () => {
  it("distingue os três resultados sem inferir aplicação", () => {
    for (const result of ["no_treatment_indicated", "treatment_indicated", "insufficient_data"]) expect(query([event("one", result)])).toEqual({ state: result, eventId: "one" });
  });
  it("exige vínculo individual, fazenda, versão e ciclo e não antecipa fatos futuros", () => {
    expect(query([event("one")], [rel("one", "other")])).toBeNull();
    expect(query([event("one")], [rel("one", "animal", "other")])).toBeNull();
    expect(query([event("one", "no_treatment_indicated", { occurred_at: "2027-01-01T00:00:00Z" })])).toBeNull();
  });
  it("aplica correção append-only e identifica fatos concorrentes ambíguos", () => {
    expect(query([event("one"), event("two", "treatment_indicated", { corrige_evento_id: "one" })], [rel("one"), rel("two")])).toEqual({ state: "treatment_indicated", eventId: "two" });
    expect(query([event("one"), event("two", "treatment_indicated")], [rel("one"), rel("two")])).toEqual({ state: "conflict", evidence: [expect.objectContaining({ eventId: "one", result: "no_treatment_indicated" }), expect.objectContaining({ eventId: "two", result: "treatment_indicated" })] });
  });
  it("não resolve uma correção sem a cadeia factual completa", () => {
    expect(query([event("two", "treatment_indicated", { corrige_evento_id: "one" })], [rel("two")])).toEqual({ state: "conflict", evidence: [] });
    expect(query([event("one"), event("two", "treatment_indicated", { corrige_evento_id: "one" }), event("three", "insufficient_data", { corrige_evento_id: "two" })], [rel("one"), rel("two"), rel("three")])).toEqual({ state: "insufficient_data", eventId: "three" });
  });
  it("valida a data da avaliação original na janela, inclusive após correção posterior", () => {
    const options = { farmId: "farm", animalId: "animal", protocolId: "protocol", itemId: "item", itemVersion: 1, cycleKey: "2026", asOf: "2026-12-31", windows: [{ startDate: "2026-05-01", endDate: "2026-05-31" }] };
    expect(projectSanitaryAssessmentV1({ ...options, events: [event("one", "no_treatment_indicated", { occurred_at: "2026-01-01T12:00:00Z" })], relations: [rel("one")] })).toBeNull();
    expect(projectSanitaryAssessmentV1({ ...options, events: [event("one"), event("two", "treatment_indicated", { occurred_at: "2026-06-15T12:00:00Z", corrige_evento_id: "one" })], relations: [rel("one"), rel("two")] })).toEqual({ state: "treatment_indicated", eventId: "two" });
    expect(projectSanitaryAssessmentV1({ ...options, windows: [], events: [event("one")], relations: [rel("one")] })).toEqual({ state: "conflict", evidence: [] });
  });
  it("mantém evidências independentes com conclusão consensual sem escolher uma por data", () => {
    expect(query([event("one"), event("two"), event("three", "no_treatment_indicated", { corrige_evento_id: "two" })], [rel("one"), rel("two"), rel("three")])).toEqual({ state: "no_treatment_indicated", evidence: [expect.objectContaining({ eventId: "one" }), expect.objectContaining({ eventId: "three" })] });
  });
});
