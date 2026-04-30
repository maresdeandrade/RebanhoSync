import { describe, expect, it } from "vitest";

import {
  STANDARD_PROTOCOLS,
  STANDARD_PROTOCOL_LIBRARY_VERSION,
  buildStandardProtocolItemPayload,
  buildStandardProtocolPayload,
  normalizeStandardProtocolInterval,
} from "@/lib/sanitario/catalog/baseProtocols";
import { readSanitaryBaseCalendar } from "@/lib/sanitario/engine/calendar";
import { readSanitaryRegimen } from "@/lib/sanitario/engine/regimen";

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

  it("keeps official-only regulatory families out of the farm template library", () => {
    expect(STANDARD_PROTOCOLS.some((entry) => entry.id === "vac-brucelose")).toBe(false);
    expect(STANDARD_PROTOCOLS.some((entry) => entry.id === "vac-raiva")).toBe(false);
  });

  it("defines the operational rabies D1/D2/annual sequence contract", () => {
    const protocol = STANDARD_PROTOCOLS.find(
      (entry) => entry.id === "vac-raiva-herbivoros",
    );
    expect(protocol).toBeDefined();
    expect(protocol).toMatchObject({
      family_code: "raiva_herbivoros",
      status_legal: "recomendado",
      scope: "fazenda",
      activation_mode: "materializar_protocolo",
      obrigatorio: false,
    });

    const payloads = new Map(
      protocol!.itens.map((item) => [
        item.item_code,
        buildStandardProtocolItemPayload(protocol!, item),
      ]),
    );

    expect([...payloads.keys()]).toEqual(["raiva_d1", "raiva_d2", "raiva_anual"]);

    const d1 = payloads.get("raiva_d1");
    const d2 = payloads.get("raiva_d2");
    const annual = payloads.get("raiva_anual");

    expect(d1).toMatchObject({
      family_code: "raiva_herbivoros",
      item_code: "raiva_d1",
      milestone_code: "raiva_d1",
      sequence_order: 1,
      schedule_kind: "calendar_base",
      agenda_activation: {
        mode: "risk_config_explicit",
        explicit: true,
        risk_field: "zona_raiva_risco",
        risk_values: ["medio", "alto"],
        unknown_history_policy: "start_from_d1",
      },
      regime_sanitario: {
        milestone_code: "raiva_d1",
        sequence_order: 1,
        depends_on_milestone: null,
        schedule_rule: {
          kind: "calendar_base",
          calendar_mode: "clinical_protocol",
        },
      },
    });

    expect(d2).toMatchObject({
      family_code: "raiva_herbivoros",
      item_code: "raiva_d2",
      milestone_code: "raiva_d2",
      sequence_order: 2,
      schedule_kind: "after_previous_completion",
      depends_on_item_code: "raiva_d1",
      depends_on: {
        milestone_code: "raiva_d1",
        interval_days: 30,
      },
      agenda_activation: {
        mode: "risk_config_explicit",
        explicit: true,
        risk_field: "zona_raiva_risco",
        risk_values: ["medio", "alto"],
      },
      regime_sanitario: {
        milestone_code: "raiva_d2",
        sequence_order: 2,
        depends_on_milestone: "raiva_d1",
        schedule_rule: {
          kind: "after_previous_completion",
          interval_days: 30,
        },
      },
    });

    expect(annual).toMatchObject({
      family_code: "raiva_herbivoros",
      item_code: "raiva_anual",
      milestone_code: "raiva_anual",
      sequence_order: 3,
      schedule_kind: "rolling_from_last_completion",
      depends_on_item_code: "raiva_d2",
      depends_on: {
        milestone_code: "raiva_d2",
        interval_days: 365,
      },
      agenda_activation: {
        mode: "risk_config_explicit",
        explicit: true,
        risk_field: "zona_raiva_risco",
        risk_values: ["medio", "alto"],
      },
      regime_sanitario: {
        milestone_code: "raiva_anual",
        sequence_order: 3,
        depends_on_milestone: "raiva_d2",
        schedule_rule: {
          kind: "rolling_from_last_completion",
          interval_days: 365,
        },
      },
    });
  });

  it("keeps PNEFA, IN50 and GTA out of the operational rabies sequence", () => {
    const rabiesProtocol = STANDARD_PROTOCOLS.find(
      (entry) => entry.id === "vac-raiva-herbivoros",
    );
    expect(rabiesProtocol).toBeDefined();

    const serialized = JSON.stringify(rabiesProtocol);
    expect(serialized).not.toMatch(/pnefa|aftosa|in50|notificaveis|gta/i);
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

    const payload = buildStandardProtocolItemPayload(protocol!, item!);

    expect(payload).toMatchObject({
      item_code: "seca-julho",
      depends_on_item_code: "seca-maio",
      indicacao: expect.any(String),
      calendario_base: {
        mode: "campaign",
        anchor: "calendar_month",
      },
      regime_sanitario: {
        schedule_rule: {
          calendar_mode: "campaign",
        },
      },
    });
    expect(readSanitaryBaseCalendar(payload)).toMatchObject({
      mode: "campanha",
      anchor: "calendar_month",
      label: "Campanha de julho",
      intervalDays: 60,
      months: [7],
    });
    expect(readSanitaryRegimen(payload)).toMatchObject({
      family_code: "controle_estrategico_parasitas",
      milestone_code: "seca_julho",
      depends_on_milestone: "seca_maio",
      sequence_order: 2,
      schedule_rule: {
        calendarMode: "campaign",
      },
    });
  });

  it("normalizes non-positive intervals so persisted protocol items remain compatible with agenda", () => {
    const protocol = STANDARD_PROTOCOLS.find((entry) => entry.id === "med-cura-umbigo");
    expect(protocol).toBeDefined();

    expect(normalizeStandardProtocolInterval(protocol!.itens[0])).toBe(1);
  });
});
