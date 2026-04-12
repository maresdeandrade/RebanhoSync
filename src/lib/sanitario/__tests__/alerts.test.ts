import {
  buildClosedSanitaryAlertPayload,
  buildOpenSanitaryAlertPayload,
  buildSanitaryAlertEventPayload,
  describeSanitaryAlertEvent,
  getAnimalSanitaryAlertBlockReason,
  hasOpenSanitaryAlert,
  readAnimalSanitaryAlert,
  readStringArray,
} from "@/lib/sanitario/alerts";

describe("sanitary alerts", () => {
  it("builds and reads an open sanitary alert state", () => {
    const payload = buildOpenSanitaryAlertPayload(
      { foo: "bar" },
      {
        diseaseCode: "notif-generica",
        diseaseName: "Suspeita sanitaria de notificacao obrigatoria",
        notificationType: "imediata",
        occurredAt: "2026-04-10T12:00:00.000Z",
        notes: "Animal com sinais neurologicos.",
        routeLabel: "Acionar SVO e abrir rota e-Sisbravet",
        immediateActions: ["Segregar animal", "Suspender movimentacao"],
        alertSignals: ["sinais de causa desconhecida"],
      },
    );

    const alert = readAnimalSanitaryAlert(payload);
    expect(alert).toMatchObject({
      status: "suspeita_aberta",
      diseaseCode: "notif-generica",
      movementBlocked: true,
      requiresImmediateNotification: true,
    });
    expect(alert?.immediateActions).toEqual([
      "Segregar animal",
      "Suspender movimentacao",
    ]);
    expect(hasOpenSanitaryAlert(payload)).toBe(true);
  });

  it("closes an existing sanitary alert and releases movement", () => {
    const openPayload = buildOpenSanitaryAlertPayload(
      {},
      {
        diseaseCode: "raiva-herbivoros",
        diseaseName: "Raiva dos herbivoros - suspeita",
        notificationType: "imediata",
        occurredAt: "2026-04-10T12:00:00.000Z",
      },
    );

    const closedPayload = buildClosedSanitaryAlertPayload(openPayload, {
      occurredAt: "2026-04-11T08:00:00.000Z",
      closureReason: "descartada",
      closureNotes: "Exame clinico descartou a suspeita.",
    });

    const alert = readAnimalSanitaryAlert(closedPayload);
    expect(alert).toMatchObject({
      status: "encerrada",
      movementBlocked: false,
      closureReason: "descartada",
    });
    expect(hasOpenSanitaryAlert(closedPayload)).toBe(false);
  });

  it("formats movement block reason from the current animal state", () => {
    const payload = buildOpenSanitaryAlertPayload(
      {},
      {
        diseaseName: "Raiva dos herbivoros - suspeita",
        occurredAt: "2026-04-10T12:00:00.000Z",
      },
    );

    expect(
      getAnimalSanitaryAlertBlockReason({
        identificacao: "M-101",
        payload,
      } as never),
    ).toContain("M-101");
  });

  it("describes sanitary alert event payloads", () => {
    const openEvent = buildSanitaryAlertEventPayload({
      alertKind: "suspeita_aberta",
      diseaseName: "Suspeita sanitaria de notificacao obrigatoria",
    });
    const closeEvent = buildSanitaryAlertEventPayload({
      alertKind: "suspeita_encerrada",
      diseaseName: "Suspeita sanitaria de notificacao obrigatoria",
      closureReason: "descartada",
    });

    expect(describeSanitaryAlertEvent(openEvent)).toBe(
      "Suspeita aberta: Suspeita sanitaria de notificacao obrigatoria",
    );
    expect(describeSanitaryAlertEvent(closeEvent)).toBe(
      "Suspeita encerrada: descartada",
    );
  });

  it("reads array fields defensively", () => {
    expect(
      readStringArray(
        { passos: ["Acionar SVO", 123, ""] as unknown as string[] },
        "passos",
      ),
    ).toEqual(["Acionar SVO"]);
  });
});
