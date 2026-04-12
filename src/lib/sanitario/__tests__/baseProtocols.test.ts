import { describe, expect, it } from "vitest";

import {
  STANDARD_PROTOCOLS,
  STANDARD_PROTOCOL_LIBRARY_VERSION,
  buildStandardProtocolItemPayload,
  buildStandardProtocolPayload,
  normalizeStandardProtocolInterval,
} from "@/lib/sanitario/baseProtocols";
import { readSanitaryBaseCalendar } from "@/lib/sanitario/calendar";

describe("standard sanitary protocol library", () => {
  it("keeps protocol ids unique and item dependencies internally consistent", () => {
    const protocolIds = new Set<string>();

    for (const protocol of STANDARD_PROTOCOLS) {
      expect(protocolIds.has(protocol.id)).toBe(false);
      protocolIds.add(protocol.id);

      const itemCodes = new Set(protocol.itens.map((item) => item.item_code));
      expect(itemCodes.size).toBe(protocol.itens.length);

      for (const item of protocol.itens) {
        if (!item.depends_on_item_code) continue;
        expect(itemCodes.has(item.depends_on_item_code)).toBe(true);
      }
    }
  });

  it("builds protocol payload with canonical source and library metadata", () => {
    const protocol = STANDARD_PROTOCOLS.find((entry) => entry.id === "vac-brucelose");
    expect(protocol).toBeDefined();

    const payload = buildStandardProtocolPayload(protocol!);

    expect(payload).toMatchObject({
      origem: "template_padrao",
      standard_id: "vac-brucelose",
      obrigatorio: true,
      biblioteca_base_versao: STANDARD_PROTOCOL_LIBRARY_VERSION,
      calendario_base: {
        version: STANDARD_PROTOCOL_LIBRARY_VERSION,
        profile: "janela_etaria",
        label: "Janela etaria obrigatoria",
        categoria: "vacinas",
      },
    });
  });

  it("builds item payload with stable item code, dependency metadata and calendar-base", () => {
    const protocol = STANDARD_PROTOCOLS.find(
      (entry) => entry.id === "vermi-estrategica-seca",
    );
    expect(protocol).toBeDefined();

    const item = protocol!.itens.find((entry) => entry.item_code === "seca-julho");
    expect(item).toBeDefined();

    const payload = buildStandardProtocolItemPayload(item!);

    expect(payload).toMatchObject({
      item_code: "seca-julho",
      depends_on_item_code: "seca-maio",
      indicacao: expect.any(String),
    });
    expect(readSanitaryBaseCalendar(payload)).toMatchObject({
      mode: "campaign",
      anchor: "calendar_month",
      label: "Campanha de julho",
      intervalDays: 60,
      months: [7],
    });
  });

  it("normalizes non-positive intervals so persisted protocol items remain compatible with agenda", () => {
    const protocol = STANDARD_PROTOCOLS.find((entry) => entry.id === "vac-brucelose");
    expect(protocol).toBeDefined();

    expect(normalizeStandardProtocolInterval(protocol!.itens[0])).toBe(1);
  });
});
