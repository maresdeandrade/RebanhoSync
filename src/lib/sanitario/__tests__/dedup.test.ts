import { describe, expect, it } from "vitest";

import {
  buildSanitaryDedupKey,
  campaignPeriodKey,
  intervalPeriodKey,
  parseDedupKey,
  windowPeriodKey,
} from "@/lib/sanitario/engine/dedup";

describe("sanitary dedup canonical contract", () => {
  it("builds the canonical structured key with all required dimensions", () => {
    expect(
      buildSanitaryDedupKey({
        scopeType: "animal",
        scopeId: "animal-1",
        familyCode: "Raiva_Herbivoros",
        itemCode: "Raiva_D1",
        regimenVersion: 1,
        mode: "janela_etaria",
        periodKey: "2026-04-01",
      }),
    ).toBe("sanitario:animal:animal-1:raiva_herbivoros:raiva_d1:v1:window:2026-04-01");
  });

  it("uses stable period modes for campaign, window and interval schedules", () => {
    expect(
      buildSanitaryDedupKey({
        scopeType: "animal",
        scopeId: "animal-1",
        familyCode: "controle_estrategico_parasitas",
        itemCode: "seca-maio",
        regimenVersion: 1,
        mode: "campanha",
        periodKey: campaignPeriodKey("2026-05-12"),
      }),
    ).toBe(
      "sanitario:animal:animal-1:controle_estrategico_parasitas:seca-maio:v1:campaign:2026-05",
    );

    expect(windowPeriodKey("2026-05-02")).toBe("2026-05-02");
    expect(intervalPeriodKey("2026-07-30")).toBe("2026-07-30");
  });

  it("parses canonical keys back into semantic dimensions", () => {
    expect(
      parseDedupKey(
        "sanitario:animal:animal-1:brucelose:brucelose-b19:v1:window:2026-05-02",
      ),
    ).toEqual({
      scopeType: "animal",
      scopeId: "animal-1",
      familyCode: "brucelose",
      itemCode: "brucelose-b19",
      regimenVersion: 1,
      periodType: "window",
      periodKey: "2026-05-02",
      jurisdiction: undefined,
    });
  });

  it("parses period keys containing colons without shifting dimensions", () => {
    expect(
      parseDedupKey(
        "sanitario:fazenda:faz-1:notificacao:notificacao_svo:v1:event:evt:legacy:77",
      ),
    ).toEqual({
      scopeType: "fazenda",
      scopeId: "faz-1",
      familyCode: "notificacao",
      itemCode: "notificacao_svo",
      regimenVersion: 1,
      periodType: "event",
      periodKey: "evt:legacy:77",
      jurisdiction: undefined,
    });
  });

  it("keeps jurisdiction when present after the period key", () => {
    expect(
      parseDedupKey(
        "sanitario:lote:lote-1:campanha_estadual:maio_go:v1:campaign:2026-05:GO",
      ),
    ).toMatchObject({
      periodKey: "2026-05",
      jurisdiction: "GO",
    });
  });

  it("rejects empty semantic dimensions before building a key", () => {
    expect(() =>
      buildSanitaryDedupKey({
        scopeType: "animal",
        scopeId: "",
        familyCode: "raiva",
        itemCode: "d1",
        regimenVersion: 1,
        mode: "campanha",
        periodKey: "2026-05",
      }),
    ).toThrow("scopeId vazio");
  });
});
