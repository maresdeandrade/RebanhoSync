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
    const familyCodes = new Set<string>();

    for (const protocol of STANDARD_PROTOCOLS) {
      expect(protocolIds.has(protocol.id)).toBe(false);
      protocolIds.add(protocol.id);
      expect(familyCodes.has(protocol.family_code)).toBe(false);
      familyCodes.add(protocol.family_code);

      const itemCodes = new Set(protocol.itens.map((item) => item.item_code));
      expect(itemCodes.size).toBe(protocol.itens.length);

      for (const item of protocol.itens) {
        if (!item.depends_on_item_code) continue;
        expect(itemCodes.has(item.depends_on_item_code)).toBe(true);
      }
    }
  });

  it("keeps regulatory families out of the farm template library", () => {
    expect(STANDARD_PROTOCOLS.some((entry) => entry.id === "vac-brucelose")).toBe(false);
    expect(STANDARD_PROTOCOLS.some((entry) => entry.id === "vac-raiva")).toBe(false);
  });

  it("builds protocol payload with canonical source and library metadata", () => {
    const protocol = STANDARD_PROTOCOLS.find(
      (entry) => entry.id === "vac-clostridioses",
    );
    expect(protocol).toBeDefined();

    const payload = buildStandardProtocolPayload(protocol!);

    expect(payload).toMatchObject({
      origem: "template_padrao",
      source_origin: "biblioteca_canonica_fazenda",
      scope: "fazenda",
      activation_mode: "materializar_protocolo",
      status_legal: "recomendado",
      family_code: "clostridioses",
      canonical_key: "clostridioses",
      standard_id: "vac-clostridioses",
      obrigatorio: false,
      biblioteca_base_versao: STANDARD_PROTOCOL_LIBRARY_VERSION,
      calendario_base: {
        version: STANDARD_PROTOCOL_LIBRARY_VERSION,
        profile: "preventivo_anual",
        label: "Revisao anual preventiva",
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
    const protocol = STANDARD_PROTOCOLS.find((entry) => entry.id === "med-cura-umbigo");
    expect(protocol).toBeDefined();

    expect(normalizeStandardProtocolInterval(protocol!.itens[0])).toBe(1);
  });
});
