import {
  EventValidationError,
  assertValidEventInput,
  validateEventInput,
} from "@/lib/events/validators";

describe("event validators", () => {
  it("rejects event without target", () => {
    const issues = validateEventInput({
      dominio: "pesagem",
      fazendaId: "farm-1",
      pesoKg: 250,
    });

    expect(issues.some((i) => i.code === "REQUIRED_TARGET")).toBe(true);
  });

  it("rejects future occurredAt", () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const issues = validateEventInput({
      dominio: "pesagem",
      fazendaId: "farm-1",
      animalId: "animal-1",
      pesoKg: 250,
      occurredAt: future,
    });

    expect(issues.some((i) => i.code === "FUTURE_DATETIME")).toBe(true);
  });

  it("rejects zero weight in pesagem", () => {
    const issues = validateEventInput({
      dominio: "pesagem",
      fazendaId: "farm-1",
      animalId: "animal-1",
      pesoKg: 0,
    });

    expect(issues.some((i) => i.field === "pesoKg")).toBe(true);
  });

  it("rejects financeiro without positive value", () => {
    const issues = validateEventInput({
      dominio: "financeiro",
      fazendaId: "farm-1",
      animalId: "animal-1",
      tipo: "compra",
      valorTotal: -1,
    });

    expect(issues.some((i) => i.field === "valorTotal")).toBe(true);
  });

  it("rejects sanitary alert without animal target", () => {
    const issues = validateEventInput({
      dominio: "alerta_sanitario",
      fazendaId: "farm-1",
      loteId: "lote-1",
      alertKind: "suspeita_aberta",
      animalPayload: {},
    });

    expect(issues.some((i) => i.field === "animalId")).toBe(true);
  });

  it("allows farm-level compliance events without animal or lote target", () => {
    const issues = validateEventInput({
      dominio: "conformidade",
      fazendaId: "farm-1",
      complianceKind: "checklist",
    });

    expect(issues).toHaveLength(0);
  });

  it("rejects movimentacao with same origin and destination", () => {
    const issues = validateEventInput({
      dominio: "movimentacao",
      fazendaId: "farm-1",
      animalId: "animal-1",
      loteId: "lote-1",
      fromLoteId: "lote-1",
      toLoteId: "lote-1",
    });

    expect(issues.some((i) => i.code === "INVALID_DESTINATION")).toBe(true);
  });

  it("throws EventValidationError for invalid input", () => {
    expect(() =>
      assertValidEventInput({
        dominio: "nutricao",
        fazendaId: "farm-1",
        animalId: "animal-1",
        alimentoNome: "",
        quantidadeKg: 0,
      }),
    ).toThrow(EventValidationError);
  });
});
