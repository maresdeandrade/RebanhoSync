import { describe, expect, it } from "vitest";

import { buildAgendaEventGroupMeta } from "@/lib/agenda/grouping";

function createAgendaInput() {
  return {
    item: {
      dominio: "sanitario",
      tipo: "vacinacao",
      source_kind: "automatico" as const,
      source_ref: {
        protocolo_id: "protocol-1",
        indicacao: "Bezerras entre 3 e 8 meses",
        dose_num: 1,
      },
      payload: {},
      protocol_item_version_id: null,
      interval_days_applied: 180,
      dedup_key: null,
    },
    produtoLabel: "Vacina Brucelose B19",
    protocol: {
      id: "protocol-1",
      nome: "Brucelose oficial",
    },
  };
}

describe("agenda grouping", () => {
  it("prioritizes protocol item version when available", () => {
    const meta = buildAgendaEventGroupMeta({
      ...createAgendaInput(),
      item: {
        ...createAgendaInput().item,
        protocol_item_version_id: "item-version-1",
      },
    });

    expect(meta).toEqual({
      key: "protocol-version:item-version-1",
      title: "Vacina Brucelose B19",
      subtitle: "Brucelose oficial | Dose 1 | 180d | Automatico",
    });
  });

  it("uses milestone key before generic fallback", () => {
    const meta = buildAgendaEventGroupMeta({
      ...createAgendaInput(),
      item: {
        ...createAgendaInput().item,
        source_ref: {
          milestone_key: "revisao_neonatal_d7",
        },
      },
      protocol: null,
    });

    expect(meta).toEqual({
      key: "milestone:revisao-neonatal-d7",
      title: "Vacina Brucelose B19",
      subtitle: "Marco revisao neonatal d7 | 180d | Automatico",
    });
  });

  it("builds richer fallback keys for non-protocol events", () => {
    const left = buildAgendaEventGroupMeta({
      ...createAgendaInput(),
      item: {
        ...createAgendaInput().item,
        source_kind: "manual",
        source_ref: {
          indicacao: "Lote A",
        },
      },
      protocol: null,
    });

    const right = buildAgendaEventGroupMeta({
      ...createAgendaInput(),
      item: {
        ...createAgendaInput().item,
        source_kind: "manual",
        source_ref: {
          indicacao: "Lote B",
        },
      },
      protocol: null,
    });

    expect(left.title).toBe("Vacina Brucelose B19");
    expect(right.title).toBe("Vacina Brucelose B19");
    expect(left.subtitle).toBe("Vacinacao | 180d | Manual");
    expect(right.subtitle).toBe("Vacinacao | 180d | Manual");
    expect(left.key).not.toBe(right.key);
  });
});
