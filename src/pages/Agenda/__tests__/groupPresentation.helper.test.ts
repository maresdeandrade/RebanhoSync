import { describe, expect, it } from "vitest";
import type { AgendaItem, SanitarioAgendaLocalV2 } from "@/lib/offline/types";
import {
  buildAgendaBaseRows,
  groupAgendaRowsByEvent,
} from "@/pages/Agenda/helpers/derivations";
import { buildAgendaGroupPresentation } from "@/pages/Agenda/helpers/groupPresentation";
import { normalizeAgendaPageData } from "@/pages/Agenda/useAgendaPageData";

function snapshotRows(itemLabel: string, protocolName?: string) {
  return buildAgendaBaseRows(
    normalizeAgendaPageData({
      sanitaryAgendasV2: [
        {
          id: "agenda-1",
          fazenda_id: "farm-1",
          status: "programada",
          data_programada: "2099-01-01",
          protocolo_id: "v2-protocol",
          protocol_item_version_id: "unresolved-version",
          protocol_item_snapshot: { itemLabel, protocolName, version: 3 },
          produto_snapshot: {},
          metadata: {},
        } as SanitarioAgendaLocalV2,
      ],
    }),
    {
      search: "",
      statusFilter: "all",
      dominioFilter: "all",
      dateFrom: "",
      dateTo: "",
    },
  );
}

describe("agenda group presentation from canonical loaded data", () => {
  it.each([
    "Avaliar Vermifugação Pré-desmama",
    "Avaliar Vermifugação Pré-confinamento ou Pasto Vedado",
    "Avaliar Matrizes Pré-parto",
  ])(
    "promotes %s without converting an assessment into execution",
    (action) => {
      const rows = snapshotRows(action);
      expect(rows[0].protocol).toBeNull();
      const groups = groupAgendaRowsByEvent({
        baseRows: rows,
        filteredRows: rows,
        hasQuickFiltersActive: false,
      });
      expect(groups[0].title).toContain("Produto definido na execução");
      const before = JSON.stringify(groups);
      const presentation = buildAgendaGroupPresentation(groups[0].rows);
      expect(presentation.title).toBe(action);
      expect(presentation.subtitle).not.toContain("Versao");
      expect(presentation.products).toEqual(["Produto definido na execução"]);
      expect(presentation.statuses).toEqual([
        { label: "Agendado", tone: "warning" },
      ]);
      expect(JSON.stringify(groups)).toBe(before);
    },
  );

  it("resolves B19 context from the V2 snapshot without a V1 protocol lookup", () => {
    const presentation = buildAgendaGroupPresentation(
      snapshotRows("Dose única", "Brucelose B19"),
    );
    expect(presentation.title).toBe("Dose única");
    expect(presentation.subtitle).toBe("Brucelose B19");
  });

  it("does not repeat an action already supplied as the protocol label", () => {
    const presentation = buildAgendaGroupPresentation(
      snapshotRows("Brucelose B19", "Brucelose B19"),
    );
    expect(presentation.title).toBe("Brucelose B19");
    expect(presentation.subtitle).toBe("");
  });

  it("keeps partial records honest instead of deriving a type or protocol from product/version", () => {
    const rows = snapshotRows("");
    const presentation = buildAgendaGroupPresentation(rows);
    expect(presentation.title).toBe("Manejo sanitário");
    expect(presentation.subtitle).toBe("");
    expect(presentation.title).not.toContain("unresolved-version");
  });

  it("does not hide a short protocol name that only matches letters inside an action", () => {
    const presentation = buildAgendaGroupPresentation(
      snapshotRows("Avaliar Matrizes Pré-parto", "IA"),
    );
    expect(presentation.subtitle).toBe("IA");
  });

  it("preserves every action, product, date and status for heterogeneous rows", () => {
    const rows = snapshotRows(
      "Avaliar Matrizes Pré-parto",
      "Programa de matrizes",
    );
    const canceled = structuredClone(rows[0]);
    canceled.item.id = "canceled";
    canceled.item.tipo = "vacinacao";
    canceled.item.status = "cancelado";
    canceled.item.data_prevista = "2099-02-02";
    canceled.produtoLabel = "Vacina B19";
    const presentation = buildAgendaGroupPresentation([...rows, canceled]);
    expect(presentation.title).toBe("Avaliar Matrizes Pré-parto · Vacinação");
    expect(presentation.products).toEqual([
      "Produto definido na execução",
      "Vacina B19",
    ]);
    expect(presentation.dates).toEqual(["01/01/2099", "02/02/2099"]);
    expect(presentation.statuses.map((s) => s.label)).toEqual([
      "Agendado",
      "Cancelado",
    ]);
  });

  it("keeps code-based vaccine doses and canonical targets visible", () => {
    const rows = buildAgendaBaseRows(
      normalizeAgendaPageData({
        itens: [
          {
            id: "b19",
            fazenda_id: "farm-1",
            tipo: "vacinacao",
            dominio: "sanitario",
            status: "agendado",
            data_prevista: "2099-01-01",
            source_kind: "automatico",
            source_ref: {
              protocolo: "Brucelose B19",
              target_label: "18 animais",
              produto: "Vacina B19",
            },
            protocol_item_code: "b19_d1",
            interval_days_applied: 60,
          } as AgendaItem,
        ],
      }),
      {
        search: "",
        statusFilter: "all",
        dominioFilter: "all",
        dateFrom: "",
        dateTo: "",
      },
    );
    const presentation = buildAgendaGroupPresentation(rows);
    expect(presentation.title).toBe("Vacinação");
    expect(presentation.subtitle).toBe("Brucelose B19 · D1");
    expect(presentation.targets).toEqual(["18 animais"]);
    expect(presentation.intervals).toEqual(["Intervalo: 60 dias"]);
  });
});
