/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import { createGesture } from "@/lib/offline/ops";
import Financeiro from "@/pages/Financeiro";

vi.mock("@/hooks/useAuth");
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: vi.fn() }));
vi.mock("@/lib/offline/ops", () => ({ createGesture: vi.fn() }));
vi.mock("@/lib/offline/db", () => ({
  db: {
    state_finance_categories: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({ count: vi.fn().mockResolvedValue(1) })),
      })),
    },
  },
}));
vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");
  return {
    Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
      open ? React.createElement("div", null, children) : null,
    DialogContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { role: "dialog" }, children),
    DialogDescription: ({ children }: { children: React.ReactNode }) =>
      React.createElement("p", null, children),
    DialogFooter: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
    DialogHeader: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", null, children),
    DialogTitle: ({ children }: { children: React.ReactNode }) =>
      React.createElement("h2", null, children),
  };
});
vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
    }) =>
      React.createElement(
        "select",
        {
          value,
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
            onValueChange?.(event.target.value),
        },
        children,
      ),
    SelectTrigger: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectValue: () => null,
    SelectContent: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children?: React.ReactNode;
    }) => React.createElement("option", { value }, children),
  };
});

const financeData = {
  eventosBase: [],
  detalhes: [],
  contrapartes: [],
  animais: [],
  lotes: [],
  pastos: [],
  categories: [
    {
      id: "category-1",
      fazenda_id: "farm-1",
      nome: "Sanidade",
      tipo: "custo_variavel",
      grupo: "sanidade",
      slug: "sanidade",
      ativo: true,
      deleted_at: null,
    },
  ],
  transactions: [],
  commercialEvents: [],
  commercialDetails: [],
};

function renderFinanceiro() {
  render(
    <MemoryRouter>
      <Financeiro />
    </MemoryRouter>,
  );
}

function fillRequiredTransactionFields() {
  const dialog = screen.getByRole("dialog");
  const comboboxes = within(dialog).getAllByRole("combobox");
  fireEvent.change(comboboxes[2], { target: { value: "category-1" } });
  fireEvent.change(within(dialog).getByPlaceholderText("0.00"), {
    target: { value: "150" },
  });
}

describe("Financeiro submit lock", () => {
  const mockedCreateGesture = vi.mocked(createGesture);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateGesture.mockReset();
    vi.mocked(useAuth).mockReturnValue({
      activeFarmId: "farm-1",
    } as ReturnType<typeof useAuth>);
    vi.mocked(useLiveQuery).mockReturnValue(financeData);
  });

  it.each([
    ["data vazia", ""],
    ["data inexistente no calendário", "2026-02-30"],
    ["formato incompatível", "17/10/2026"],
    ["texto inválido", "not-a-date"],
  ])(
    "rejeita %s junto ao campo, sem escrita e sem perder dados",
    async (_label, value) => {
      renderFinanceiro();
      fireEvent.click(screen.getByRole("button", { name: /Novo lançamento/i }));
      fillRequiredTransactionFields();
      fireEvent.change(screen.getByLabelText(/^Observações$/i), {
        target: { value: "Pagamento de auditoria" },
      });
      const date = screen.getByLabelText(/Data Registro/i);
      // Também cobre o fallback de navegadores sem suporte ao input date nativo.
      if (value) date.setAttribute("type", "text");
      fireEvent.change(date, { target: { value } });
      fireEvent.click(
        screen.getByRole("button", { name: /Salvar Lançamento/i }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        value
          ? "Informe uma data de registro válida."
          : "Informe a data do registro.",
      );
      expect(date).toHaveAttribute("aria-invalid", "true");
      expect(date).toHaveAttribute(
        "aria-describedby",
        "form-tx-occurred-at-error",
      );
      expect(screen.getByLabelText(/Valor Total/i)).toHaveValue(150);
      expect(screen.getByLabelText(/^Observações$/i)).toHaveValue(
        "Pagamento de auditoria",
      );
      expect(mockedCreateGesture).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    },
  );

  it("atualiza o erro ao corrigir o campo e salva apenas depois da correção", async () => {
    mockedCreateGesture.mockResolvedValue("tx-valid-date");
    renderFinanceiro();
    fireEvent.click(screen.getByRole("button", { name: /Novo lançamento/i }));
    fillRequiredTransactionFields();
    const date = screen.getByLabelText(/Data Registro/i);
    fireEvent.change(date, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar Lançamento/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe a data do registro.",
    );

    date.setAttribute("type", "text");
    fireEvent.change(date, { target: { value: "2026-13-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Informe uma data de registro válida.",
    );
    expect(mockedCreateGesture).not.toHaveBeenCalled();
    fireEvent.change(date, { target: { value: "2026-10-17" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(date).toHaveAttribute("aria-invalid", "false");
    expect(date).not.toHaveAttribute("aria-describedby");
    fireEvent.click(screen.getByRole("button", { name: /Salvar Lançamento/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mockedCreateGesture).toHaveBeenCalledTimes(1);
  });

  it.each(["realizado", "previsto", "cancelado"] as const)(
    "preserva ISO UTC e campos financeiros para data válida com status %s",
    async (status) => {
      mockedCreateGesture.mockResolvedValue("tx-valid-date");
      renderFinanceiro();
      fireEvent.click(screen.getByRole("button", { name: /Novo lançamento/i }));
      fillRequiredTransactionFields();
      const dialog = screen.getByRole("dialog");
      fireEvent.change(within(dialog).getAllByRole("combobox")[1], {
        target: { value: status },
      });
      fireEvent.change(screen.getByLabelText(/Data Registro/i), {
        target: { value: "2024-02-29" },
      });
      fireEvent.change(screen.getByLabelText(/Data Competência/i), {
        target: { value: "2024-02-01" },
      });
      fireEvent.change(screen.getByLabelText(/Data Vencimento/i), {
        target: { value: "2024-03-10" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: /Salvar Lançamento/i }),
      );

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(mockedCreateGesture).toHaveBeenCalledTimes(1);
      expect(mockedCreateGesture).toHaveBeenCalledWith("farm-1", [
        expect.objectContaining({
          table: "finance_transactions",
          action: "INSERT",
          record: expect.objectContaining({
            category_id: "category-1",
            direction: "saida",
            valor_total: 150,
            origem: "manual",
            status,
            occurred_at: "2024-02-29T00:00:00.000Z",
            paid_at: status === "realizado" ? "2024-02-29T00:00:00.000Z" : null,
            competence_date: "2024-02-01",
            due_date: "2024-03-10",
          }),
        }),
      ]);
    },
  );

  it("apresenta resultado observado indisponivel sem converter ausencia em R$ 0", () => {
    renderFinanceiro();
    expect(screen.getByText("Resultado economico observado")).toBeInTheDocument();
    expect(screen.getAllByText("Indisponivel")).toHaveLength(3);
    expect(screen.getByText(/Ausencia nao e tratada como R\$ 0/i)).toBeInTheDocument();
  });

  it("bloqueia clique duplo e rápido durante a persistência", async () => {
    let resolveGesture: ((value: string) => void) | undefined;
    mockedCreateGesture.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveGesture = resolve;
        }),
    );
    renderFinanceiro();
    fireEvent.click(screen.getByRole("button", { name: /Novo lançamento/i }));
    fillRequiredTransactionFields();
    const saveButton = screen.getByRole("button", {
      name: /Salvar Lançamento/i,
    });

    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(mockedCreateGesture).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: /Salvando lançamento/i }),
    ).toBeDisabled();

    resolveGesture?.("tx-finance");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("desbloqueia após erro e permite sucesso na tentativa seguinte", async () => {
    mockedCreateGesture
      .mockRejectedValueOnce(new Error("falha local"))
      .mockResolvedValueOnce("tx-finance-retry");
    renderFinanceiro();
    fireEvent.click(screen.getByRole("button", { name: /Novo lançamento/i }));
    fillRequiredTransactionFields();
    fireEvent.click(
      screen.getByRole("button", { name: /Salvar Lançamento/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Salvar Lançamento/i }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Salvar Lançamento/i }),
    );

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
