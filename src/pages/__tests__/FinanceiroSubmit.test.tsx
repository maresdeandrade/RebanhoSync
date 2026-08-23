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
    vi.mocked(useAuth).mockReturnValue({
      activeFarmId: "farm-1",
    } as ReturnType<typeof useAuth>);
    vi.mocked(useLiveQuery).mockReturnValue(financeData);
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
