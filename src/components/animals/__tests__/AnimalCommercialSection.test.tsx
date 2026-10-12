import { formatCommercialDate } from "../animalCommercialFormat";
/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import "fake-indexeddb/auto";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimalCommercialSection } from "../AnimalCommercialSection";
import { db } from "@/lib/offline/db";
import * as history from "@/lib/comercial/animalCommercialHistory";
import type {
  Evento,
  EventoComercial,
  FinanceTransaction,
} from "@/lib/offline/types";

const farmId = "farm-c3";
const animalId = "animal-c3";
const eventId = "event-c3";
const recordedAt = "2026-10-07T12:00:00.000Z";

function detail(overrides: Partial<EventoComercial> = {}): EventoComercial {
  return {
    evento_id: eventId,
    fazenda_id: farmId,
    operation_type: "compra",
    scope: "animal",
    occurred_at: "2026-10-07",
    quantidade_animais: 1,
    peso_vivo_total: 320,
    peso_medio_derivado: 320,
    valor_bruto: 3000,
    valor_liquido_derivado: 2800,
    frete: 200,
    comissao: null,
    descontos: null,
    taxas_impostos: null,
    contraparte_id: null,
    contraparte_nome: "Contraparte registrada",
    animal_ids: [animalId],
    lote_id: null,
    finance_transaction_id: null,
    snapshot: {},
    calculation_status: "complete",
    limitations: [],
    issues: [],
    observacoes: null,
    client_id: "client-c3",
    client_op_id: "op-c3",
    client_tx_id: "tx-c3",
    client_recorded_at: recordedAt,
    created_at: recordedAt,
    updated_at: recordedAt,
    deleted_at: null,
    ...overrides,
  };
}

async function seed(
  overrides: Partial<EventoComercial> = {},
  eventOverrides: Partial<Evento> = {},
) {
  await db.event_eventos.put({
    id: eventId,
    fazenda_id: farmId,
    animal_id: animalId,
    dominio: "comercial",
    occurred_at: recordedAt,
    occurred_on: "2026-10-07",
    payload: { kind: "commercial_operation_v2" },
    deleted_at: null,
    ...eventOverrides,
  } as Evento);
  await db.event_eventos_comercial.put(detail(overrides));
}

function open() {
  return render(
    <AnimalCommercialSection farmId={farmId} animalId={animalId} />,
  );
}
async function card() {
  return (await screen.findByText("Compra registrada")).closest(
    ".rounded-lg",
  )! as HTMLElement;
}
function field(label: string) {
  return screen.getByText(label).parentElement!;
}

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await Promise.all([
    db.event_eventos.clear(),
    db.event_eventos_comercial.clear(),
    db.state_finance_transactions.clear(),
  ]);
});

describe("apresentação comercial factual", () => {
  it("distingue carregamento de histórico vazio", async () => {
    const view = open();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Carregando histórico comercial",
    );
    expect(
      screen.queryByText(/Sem operações comerciais/),
    ).not.toBeInTheDocument();
    await screen.findByText(/Sem operações comerciais/);
    expect(view.queryByRole("status")).not.toBeInTheDocument();
  });

  it("mostra aquisição individual registrada e a fonte factual", async () => {
    await seed({ animal_ids: null, snapshot: {} });
    open();
    await card();
    expect(
      within(field("Valor de compra deste animal:")).getByText("R$ 3.000,00"),
    ).toBeVisible();
    expect(
      within(field("Peso de aquisição deste animal:")).getByText("320 kg"),
    ).toBeVisible();
    expect(screen.getAllByText("07/10/2026")[0]).toBeVisible();
    expect(
      screen.getByText(/Fonte individual: snapshot persistido/),
    ).toBeVisible();
  });

  it("não divide o valor total de uma operação coletiva", async () => {
    await seed({
      scope: "lote",
      quantidade_animais: 2,
      animal_ids: [animalId, "outro"],
      valor_bruto: 7000,
      peso_vivo_total: 640,
    });
    open();
    await card();
    expect(
      within(field("Valor de compra deste animal:")).getByText(
        "Não registrado para este animal",
      ),
    ).toBeVisible();
    expect(
      within(field("Valor bruto da operação")).getByText("R$ 7.000,00"),
    ).toBeVisible();
    expect(screen.queryByText("R$ 3.500,00")).not.toBeInTheDocument();
  });

  it("exibe arroba e rendimento somente como parâmetros individuais persistidos", async () => {
    await seed({
      snapshot: {
        pricing: {
          lines: [
            {
              animal_id: animalId,
              pricing_mode: "per_arroba",
              commercial_weight: 20,
              commercial_weight_unit: "arroba",
              individual_gross_value: 6000,
              arrobas: 20,
              carcass_yield_percent: 52,
              arroba_basis: "live_weight_yield",
              price_per_arroba: 300,
              weight_source: "declared",
              gross_value_source: "derived",
            },
          ],
        },
      },
    });
    open();
    await card();
    expect(
      within(field("Peso de aquisição deste animal:")).getByText("20 @"),
    ).toBeVisible();
    screen.getByText("Parâmetros individuais registrados no snapshot").click();
    expect(
      within(field("Rendimento de carcaça registrado")).getByText("52 %"),
    ).toBeVisible();
    expect(
      within(field("Peso considerado registrado")).getByText("Não registrado"),
    ).toBeVisible();
    expect(
      within(field("Arrobas calculadas registradas")).getByText("20 @"),
    ).toBeVisible();
  });

  it.each([null, undefined, 0])(
    "preserva valor %s sem substituir ausência por zero",
    async (value) => {
      await seed({
        valor_bruto: value,
        valor_liquido_derivado: value,
        frete: value,
        peso_vivo_total: value,
        snapshot: { valor_por_animal: { [animalId]: value } },
      });
      open();
      await card();
      expect(
        within(field("Valor bruto da operação")).getByText(
          value === 0 ? "R$ 0,00" : "Não registrado",
        ),
      ).toBeVisible();
      expect(
        within(field("Valor de compra deste animal:")).getByText(
          value === 0 ? "R$ 0,00" : "Não registrado para este animal",
        ),
      ).toBeVisible();
      expect(
        within(field("Peso vivo total da operação")).getByText(
          value === 0 ? "0 kg" : "Não registrado",
        ),
      ).toBeVisible();
    },
  );

  it.each(["previsto", "realizado"] as const)(
    "vínculo %s sem paid_at não comprova pagamento",
    async (status) => {
      await seed({ finance_transaction_id: "finance-c3" });
      await db.state_finance_transactions.put({
        id: "finance-c3",
        fazenda_id: farmId,
        status,
        paid_at: null,
        deleted_at: null,
      } as FinanceTransaction);
      open();
      await card();
      expect(
        screen.getByText(/Classificação canônica: comercial_linked/),
      ).toBeVisible();
      expect(
        screen.getByText(
          "Pagamento, recebimento e quitação não comprovados por esta leitura.",
        ),
      ).toBeVisible();
    },
  );

  it("usa caixa realizado canônico sem afirmar quitação integral", async () => {
    await seed({ finance_transaction_id: "finance-c3" });
    await db.state_finance_transactions.put({
      id: "finance-c3",
      fazenda_id: farmId,
      status: "realizado",
      paid_at: "2026-10-07",
      deleted_at: null,
    } as FinanceTransaction);
    open();
    await card();
    expect(
      screen.getByText(/Caixa realizado conforme lançamento vinculado/),
    ).toHaveTextContent("quitação integral da operação não é comprovada");
  });

  it("paid_at ausente em lançamento legado não comprova recebimento", async () => {
    await seed({ finance_transaction_id: "finance-c3" });
    await db.state_finance_transactions.put({
      id: "finance-c3",
      fazenda_id: farmId,
      status: "realizado",
      deleted_at: null,
    } as FinanceTransaction);
    open();
    await card();
    expect(
      screen.getByText(
        "Pagamento, recebimento e quitação não comprovados por esta leitura.",
      ),
    ).toBeVisible();
  });

  it.each(["other-farm", "deleted"])(
    "não usa vínculo financeiro %s",
    async (kind) => {
      await seed({ finance_transaction_id: "finance-c3" });
      await db.state_finance_transactions.put({
        id: "finance-c3",
        fazenda_id: kind === "other-farm" ? "outra-fazenda" : farmId,
        status: "realizado",
        paid_at: "2026-10-07",
        deleted_at: kind === "deleted" ? recordedAt : null,
      } as FinanceTransaction);
      open();
      await card();
      expect(
        screen.getByText("Lançamento vinculado indisponível nesta fazenda."),
      ).toBeVisible();
      expect(
        screen.getByText(/Classificação canônica: comercial_isolated/),
      ).toBeVisible();
      expect(
        screen.queryByText(/Caixa realizado conforme/),
      ).not.toBeInTheDocument();
    },
  );

  it("apresenta cálculo parcial, limitações e avisos persistidos", async () => {
    await seed({
      calculation_status: "partial",
      valor_liquido_derivado: 1234,
      limitations: ["Frete não informado no registro."],
      issues: [
        {
          code: "missing_cost",
          severity: "warning",
          message: "Custos incompletos.",
        },
      ],
    });
    open();
    await card();
    expect(
      within(field("Estado do cálculo registrado")).getByText("Parcial"),
    ).toBeVisible();
    expect(
      within(field("Valor líquido calculado registrado da operação")).getByText(
        "R$ 1.234,00",
      ),
    ).toBeVisible();
    expect(screen.getByText("Frete não informado no registro.")).toBeVisible();
    expect(
      screen.getByText("Aviso registrado: Custos incompletos."),
    ).toBeVisible();
  });

  it.each(["event", "snapshot"])(
    "exclui simulação indicada em %s",
    async (source) => {
      await seed(
        {
          operation_type: "venda",
          snapshot: source === "snapshot" ? { simulation: true } : {},
        },
        source === "event"
          ? { payload: { kind: "commercial_simulation" } }
          : {},
      );
      open();
      await screen.findByText(/Sem operações comerciais/);
      expect(screen.queryByText("Venda registrada")).not.toBeInTheDocument();
      expect(
        screen.getByText(/Simulações não representam venda executada/),
      ).toBeVisible();
    },
  );

  it("preserva histórico coletivo sem fonte individual de outro animal", async () => {
    await seed({
      scope: "lote",
      animal_ids: [animalId, "outro"],
      quantidade_animais: 2,
      snapshot: {
        pricing: {
          lines: [
            {
              animal_id: "outro",
              individual_gross_value: 9000,
              commercial_weight: 19,
              commercial_weight_unit: "arroba",
            },
          ],
        },
      },
    });
    open();
    await card();
    expect(screen.queryByText("R$ 9.000,00")).not.toBeInTheDocument();
    expect(screen.queryByText("19 @")).not.toBeInTheDocument();
  });

  it("mostra erro do loader sem declarar ausência de histórico", async () => {
    vi.spyOn(history, "loadAnimalCommercialHistory").mockRejectedValue(
      new Error("unavailable"),
    );
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar",
    );
    expect(
      screen.queryByText(/Sem operações comerciais/),
    ).not.toBeInTheDocument();
  });

  it("falha financeira mantém o fato e não comprova liquidação", async () => {
    await seed({ finance_transaction_id: "finance-c3" });
    vi.spyOn(db.state_finance_transactions, "get").mockRejectedValue(
      new Error("unavailable"),
    );
    open();
    await card();
    expect(
      screen.getByText("Fonte financeira indisponível nesta leitura."),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Pagamento, recebimento e quitação não comprovados por esta leitura.",
      ),
    ).toBeVisible();
  });

  it("troca de fazenda não mantém registro anterior", async () => {
    await seed();
    const view = open();
    await card();
    view.rerender(
      <AnimalCommercialSection farmId="outra-fazenda" animalId={animalId} />,
    );
    expect(screen.queryByText("Compra registrada")).not.toBeInTheDocument();
    await screen.findByText(/Sem operações comerciais/);
  });

  it("não desloca datas civis por timezone", () => {
    expect(formatCommercialDate("2026-01-01")).toBe("01/01/2026");
    expect(formatCommercialDate("2026-01-01T12:00:00.000Z")).toBe(
      new Date("2026-01-01T12:00:00.000Z").toLocaleDateString("pt-BR"),
    );
    expect(formatCommercialDate(undefined)).toBe("Não informada");
  });
});
