/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { useLotes } from "@/hooks/useLotes";
import { createGesture } from "@/lib/offline/ops";
import { db } from "@/lib/offline/db";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import type { Animal } from "@/lib/offline/types";
import AnimalNovo from "@/pages/AnimalNovo";
import AnimalEditar from "@/pages/AnimalEditar";

vi.mock("@/hooks/useAuth");
vi.mock("@/hooks/useLotes");
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
vi.mock("@/lib/offline/ops", () => ({
  createGesture: vi.fn(async () => "tx-1"),
}));
vi.mock("@/lib/offline/pull", () => ({
  pullDataForFarm: vi.fn(async () => undefined),
}));
vi.mock("@/components/ui/select", async () => {
  const React = await import("react");

  function findAriaLabel(children: React.ReactNode): string | undefined {
    const childArray = React.Children.toArray(children);
    for (const child of childArray) {
      if (!React.isValidElement(child)) continue;
      const props = child.props as {
        "aria-label"?: string;
        children?: React.ReactNode;
      };
      if (props["aria-label"]) return props["aria-label"];
      const nested = findAriaLabel(props.children);
      if (nested) return nested;
    }
    return undefined;
  }

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
          "aria-label": findAriaLabel(children),
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

vi.mock("@/components/ui/field-combobox", async () => {
  const React = await import("react");

  return {
    FieldCombobox: ({
      id,
      value,
      onValueChange,
      options,
      placeholder,
    }: {
      id?: string;
      value?: string;
      onValueChange?: (value: string) => void;
      options: { value: string; label: string }[];
      placeholder?: string;
    }) =>
      React.createElement(
        "select",
        {
          id,
          value: value ?? "",
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
            onValueChange?.(event.target.value),
        },
        options.map((opt) =>
          React.createElement("option", { key: opt.value, value: opt.value }, opt.label),
        ),
      ),
  };
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

function makeAnimal(overrides: Partial<Animal> = {}): Animal {
  return {
    id: "animal-1",
    fazenda_id: "farm-1",
    identificacao: "BR-001",
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: null,
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    especie: "bovino",
    origem: null,
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-01T00:00:00.000Z",
    server_received_at: "2026-04-01T00:00:00.000Z",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

async function chooseSpecies(label: string) {
  const value = label === "Bubalino" ? "bubalino" : "bovino";
  fireEvent.change(screen.getByRole("combobox", { name: /Esp.cie/i }), {
    target: { value },
  });
}

describe("animal species in create/edit forms", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLotes = vi.mocked(useLotes);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  const mockedCreateGesture = vi.mocked(createGesture);

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.local_animal_edit_drafts_v2.clear();
    await db.local_ownership.put({ key: "local-session", owner_user_id: "test-user", updated_at: "now" });
    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      user: { id: "test-user" },
      localOwnership: { status: "OWNED", ownerUserId: "test-user", currentUserId: "test-user" },
      role: "owner",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    } as ReturnType<typeof useAuth>);
    mockedUseLotes.mockReturnValue([]);
    mockedUseLiveQuery.mockReturnValue([]);
  });

  it("grava especie informada no cadastro novo", async () => {
    render(
      <MemoryRouter>
        <AnimalNovo />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Identificação/i), {
      target: { value: "BR-010" },
    });
    await chooseSpecies("Bubalino");
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar animal/i })[0]);

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    const ops = mockedCreateGesture.mock.calls[0]?.[1] ?? [];
    expect(ops[0]?.record).toMatchObject({
      identificacao: "BR-010",
      especie: "bubalino",
    });
  });

  it("registra compra factual no mesmo gesto que incorpora o animal ativo", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AnimalNovo />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Identificação/i), {
      target: { value: "BR-COMPRA-01" },
    });
    await user.click(screen.getByRole("tab", { name: /Origem/i }));
    await user.click(screen.getByRole("button", { name: /^Compra$/i }));
    fireEvent.change(screen.getByLabelText(/Valor Total/i), {
      target: { value: "3200" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar animal/i })[0]);

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    const ops = mockedCreateGesture.mock.calls[0]?.[1] ?? [];
    const animalOp = ops.find((op) => op.table === "animais");
    const eventOp = ops.find((op) => op.table === "eventos");
    const commercialOp = ops.find((op) => op.table === "eventos_comercial");

    expect(ops.map((op) => op.table)).toEqual([
      "animais",
      "eventos",
      "eventos_comercial",
    ]);
    expect(animalOp?.record).toMatchObject({
      identificacao: "BR-COMPRA-01",
      origem: "compra",
      status: "ativo",
    });
    expect(eventOp?.record).toMatchObject({
      dominio: "comercial",
      animal_id: animalOp?.record.id,
    });
    expect(commercialOp?.record).toMatchObject({
      operation_type: "compra",
      scope: "animal",
      quantidade_animais: 1,
      valor_bruto: 3200,
      animal_ids: [animalOp?.record.id],
    });
    expect(ops.some((op) => op.table === "eventos_financeiro")).toBe(false);
  });

  it("owner cria nova sociedade, animal e vínculo na mesma gesture", async () => {
    const user = userEvent.setup();
    mockedUseLiveQuery.mockImplementation(((query) => {
      const source = typeof query === "function" ? query.toString() : "";
      if (source.includes("state_contrapartes")) {
        return [{ id: "contraparte-1", fazenda_id: "farm-1", nome: "Sócio" }];
      }
      return [];
    }) as typeof useLiveQuery);

    render(
      <MemoryRouter>
        <AnimalNovo />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Identificação/i), {
      target: { value: "SOC-NOVA-01" },
    });
    await user.click(screen.getByRole("tab", { name: /Origem/i }));
    await user.click(screen.getByRole("button", { name: /^Sociedade$/i }));
    fireEvent.change(screen.getByLabelText(/^Nome/i), {
      target: { value: "Nova parceria" },
    });
    fireEvent.change(screen.getByLabelText(/Contraparte/i), {
      target: { value: "contraparte-1" },
    });
    fireEvent.change(screen.getByLabelText(/Percentual da Fazenda/i), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar animal/i })[0]);

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalledTimes(1));
    const ops = mockedCreateGesture.mock.calls[0]?.[1] ?? [];
    expect(ops.map((op) => op.table)).toEqual([
      "sociedades_pecuarias",
      "animais",
      "sociedade_animais",
    ]);
    expect(ops.some((op) => op.table === "animais_sociedade")).toBe(false);
  });

  it("manager reutiliza sociedade existente e cria somente animal e vínculo", async () => {
    const user = userEvent.setup();
    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      role: "manager",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    } as ReturnType<typeof useAuth>);
    mockedUseLiveQuery.mockImplementation(((query) => {
      const source = typeof query === "function" ? query.toString() : "";
      if (source.includes("state_sociedades_pecuarias")) {
        return [
          {
            id: "sociedade-1",
            fazenda_id: "farm-1",
            nome: "Sociedade existente",
            status: "ativa",
            deleted_at: null,
          },
        ];
      }
      return [];
    }) as typeof useLiveQuery);

    render(
      <MemoryRouter>
        <AnimalNovo />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Identificação/i), {
      target: { value: "SOC-EXISTENTE-01" },
    });
    await user.click(screen.getByRole("tab", { name: /Origem/i }));
    await user.click(screen.getByRole("button", { name: /^Sociedade$/i }));
    fireEvent.change(screen.getByLabelText(/^Sociedade/i), {
      target: { value: "sociedade-1" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar animal/i })[0]);

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalledTimes(1));
    expect(mockedCreateGesture.mock.calls[0]?.[1].map((op) => op.table)).toEqual([
      "animais",
      "sociedade_animais",
    ]);
  });

  it("cowboy é bloqueado antes de persistir cadastro societário", async () => {
    const user = userEvent.setup();
    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      role: "cowboy",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    } as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <AnimalNovo />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Identificação/i), {
      target: { value: "SOC-BLOQUEADO-01" },
    });
    await user.click(screen.getByRole("tab", { name: /Origem/i }));
    await user.click(screen.getByRole("button", { name: /^Sociedade$/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar animal/i })[0]);

    expect(mockedCreateGesture).not.toHaveBeenCalled();
  });

  it("preserva especie existente na edicao quando o campo nao muda", async () => {
    const existingAnimal = makeAnimal({ especie: "bovino" });
    mockedUseLiveQuery.mockImplementation(((query) => {
      const source = typeof query === "function" ? query.toString() : "";
      if (source.includes("db.state_animais.get")) {
        return existingAnimal;
      }
      return [];
    }) as typeof useLiveQuery);

    render(
      <MemoryRouter initialEntries={["/animais/animal-1/editar"]}>
        <Routes>
          <Route path="/animais/:id/editar" element={<AnimalEditar />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      (await screen.findAllByRole("button", { name: /Salvar alteracoes/i }))[0],
    );

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    const ops = mockedCreateGesture.mock.calls[0]?.[1] ?? [];
    expect(ops[0]?.record.especie).toBe("bovino");
  });

  it("altera especie no cadastro existente", async () => {
    const existingAnimal = makeAnimal({ especie: "bovino" });
    mockedUseLiveQuery.mockImplementation(((query) => {
      const source = typeof query === "function" ? query.toString() : "";
      if (source.includes("db.state_animais.get")) {
        return existingAnimal;
      }
      return [];
    }) as typeof useLiveQuery);

    render(
      <MemoryRouter initialEntries={["/animais/animal-1/editar"]}>
        <Routes>
          <Route path="/animais/:id/editar" element={<AnimalEditar />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /Esp.cie/i })).toHaveValue(
        "bovino",
      ),
    );
    await chooseSpecies("Bubalino");
    expect(screen.getByRole("combobox", { name: /Esp.cie/i })).toHaveValue(
      "bubalino",
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: /Salvar alteracoes/i })[0],
    );

    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    const ops = mockedCreateGesture.mock.calls[0]?.[1] ?? [];
    expect(ops[0]?.record.especie).toBe("bubalino");
  });

  it("preserva rascunho quando o pull adiciona revisão ao animal aberto", async () => {
    let existingAnimal = makeAnimal({ nome: null, revision: undefined });
    mockedUseLiveQuery.mockImplementation(((query) => {
      const source = typeof query === "function" ? query.toString() : "";
      return source.includes("db.state_animais.get") ? existingAnimal : [];
    }) as typeof useLiveQuery);
    const view = () => (
      <MemoryRouter initialEntries={["/animais/animal-1/editar"]}>
        <Routes><Route path="/animais/:id/editar" element={<AnimalEditar />} /></Routes>
      </MemoryRouter>
    );
    const { rerender } = render(view());
    fireEvent.change(await screen.findByLabelText(/^Nome$/i), { target: { value: "Rascunho preservado" } });
    existingAnimal = { ...existingAnimal, revision: 1 };
    rerender(view());
    expect(screen.getByLabelText(/^Nome$/i)).toHaveValue("Rascunho preservado");
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar alteracoes/i })[0]);
    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    expect(mockedCreateGesture.mock.calls[0]?.[1][0].record.nome).toBe("Rascunho preservado");
    expect(mockedCreateGesture.mock.calls[0]?.[2]?.animalEditBaseline?.revision).toBeUndefined();
  });

  it("mantém o formulário e explica quando a revisão ainda não chegou", async () => {
    const existingAnimal = makeAnimal({ revision: undefined });
    mockedUseLiveQuery.mockImplementation(((query) =>
      typeof query === "function" && query.toString().includes("db.state_animais.get") ? existingAnimal : []) as typeof useLiveQuery);
    const errorToast = vi.spyOn(toast, "error").mockImplementation(() => "test");
    mockedCreateGesture.mockRejectedValueOnce(new Error("ANIMAL_REVISION_PENDING"));
    render(<MemoryRouter initialEntries={["/animais/animal-1/editar"]}>
      <Routes><Route path="/animais/:id/editar" element={<AnimalEditar />} /></Routes>
    </MemoryRouter>);
    fireEvent.change(await screen.findByLabelText(/^Nome$/i), { target: { value: "Rascunho offline" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar alteracoes/i })[0]);
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith(expect.stringContaining("Aguarde a confirmação")));
    expect(screen.getByLabelText(/^Nome$/i)).toHaveValue("Rascunho offline");
    errorToast.mockRestore();
  });

  it("restaura edição não sincronizada ao fechar e reabrir o formulário", async () => {
    const existingAnimal = makeAnimal({ revision: undefined });
    mockedUseLiveQuery.mockImplementation(((query) =>
      typeof query === "function" && query.toString().includes("db.state_animais.get") ? existingAnimal : []) as typeof useLiveQuery);
    const view = () => <MemoryRouter initialEntries={["/animais/animal-1/editar"]}>
      <Routes><Route path="/animais/:id/editar" element={<AnimalEditar />} /></Routes>
    </MemoryRouter>;
    const first = render(view());
    fireEvent.change(await screen.findByLabelText(/^Nome$/i), { target: { value: "Rascunho durável" } });
    await waitFor(async () => expect((await db.local_animal_edit_drafts_v2.get(["test-user", "farm-1", "animal-1"]))?.values.nome).toBe("Rascunho durável"));
    first.unmount();
    db.close(); await db.open();
    render(view());
    expect(await screen.findByLabelText(/^Nome$/i)).toHaveValue("Rascunho durável");
    expect(screen.getByRole("status")).toHaveTextContent("não sincronizadas");
  });

  it("isola rascunhos ao trocar de fazenda e restaura ao retornar", async () => {
    let farm = "farm-1";
    const auth = mockedUseAuth();
    mockedUseAuth.mockImplementation(() => ({ ...auth, activeFarmId: farm }));
    mockedUseLiveQuery.mockImplementation(((query) =>
      typeof query === "function" && query.toString().includes("db.state_animais.get")
        ? makeAnimal({ fazenda_id: farm, nome: null }) : []) as typeof useLiveQuery);
    const view = () => <MemoryRouter initialEntries={["/animais/animal-1/editar"]}>
      <Routes><Route path="/animais/:id/editar" element={<AnimalEditar />} /></Routes>
    </MemoryRouter>;
    const page = render(view());
    fireEvent.change(await screen.findByLabelText(/^Nome$/i), { target: { value: "Somente fazenda 1" } });
    await waitFor(async () => expect((await db.local_animal_edit_drafts_v2.get(["test-user", "farm-1", "animal-1"]))?.values.nome).toBe("Somente fazenda 1"));
    farm = "farm-2"; page.rerender(view());
    await waitFor(() => expect(screen.getByLabelText(/^Nome$/i)).toHaveValue(""));
    farm = "farm-1"; page.rerender(view());
    await waitFor(() => expect(screen.getByLabelText(/^Nome$/i)).toHaveValue("Somente fazenda 1"));
  });

  it("isola rascunhos na troca de usuário local", async () => {
    let currentUser = "test-user";
    const auth = mockedUseAuth();
    mockedUseAuth.mockImplementation(() => ({ ...auth, user: { id: currentUser } as typeof auth.user,
      localOwnership: { status: "OWNED", ownerUserId: currentUser, currentUserId: currentUser } }));
    const existingAnimal = makeAnimal({ nome: null });
    mockedUseLiveQuery.mockImplementation(((query) =>
      typeof query === "function" && query.toString().includes("db.state_animais.get") ? existingAnimal : []) as typeof useLiveQuery);
    const view = () => <MemoryRouter initialEntries={["/animais/animal-1/editar"]}>
      <Routes><Route path="/animais/:id/editar" element={<AnimalEditar />} /></Routes>
    </MemoryRouter>;
    const page = render(view());
    fireEvent.change(await screen.findByLabelText(/^Nome$/i), { target: { value: "Somente primeiro usuário" } });
    await waitFor(async () => expect((await db.local_animal_edit_drafts_v2.get(["test-user", "farm-1", "animal-1"]))?.values.nome).toBe("Somente primeiro usuário"));
    currentUser = "other-user";
    await db.local_ownership.put({ key: "local-session", owner_user_id: currentUser, updated_at: "now" });
    page.rerender(view());
    await waitFor(() => expect(screen.getByLabelText(/^Nome$/i)).toHaveValue(""));
    expect((await db.local_animal_edit_drafts_v2.get(["test-user", "farm-1", "animal-1"]))?.values.nome).toBe("Somente primeiro usuário");
  });

  it("preserva as duas edições concorrentes e permite recuperar ambas", async () => {
    const existingAnimal = makeAnimal({ nome: null });
    mockedUseLiveQuery.mockImplementation(((query) =>
      typeof query === "function" && query.toString().includes("db.state_animais.get") ? existingAnimal : []) as typeof useLiveQuery);
    const view = () => <MemoryRouter initialEntries={["/animais/animal-1/editar"]}>
      <Routes><Route path="/animais/:id/editar" element={<AnimalEditar />} /></Routes>
    </MemoryRouter>;
    const first = render(view());
    const second = render(view());
    const firstName = await within(first.container).findByPlaceholderText("Nome popular do animal");
    const secondName = await within(second.container).findByPlaceholderText("Nome popular do animal");
    fireEvent.change(firstName, { target: { value: "Primeira aba" } });
    await waitFor(async () => expect((await db.local_animal_edit_drafts_v2.get(["test-user", "farm-1", "animal-1"]))?.values.nome).toBe("Primeira aba"));
    fireEvent.change(secondName, { target: { value: "Segunda aba" } });
    await waitFor(async () => expect((await db.local_animal_edit_drafts_v2.get(["test-user", "farm-1", "animal-1"]))?.conflicts?.[0]?.values.nome).toBe("Segunda aba"));
    expect(secondName).toHaveValue("Segunda aba");
    expect((await db.local_animal_edit_drafts_v2.get(["test-user", "farm-1", "animal-1"]))?.values.nome).toBe("Primeira aba");
    first.unmount(); second.unmount();
    db.close(); await db.open();
    render(view());
    expect(await screen.findByText(/versões de rascunho/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /revisar versão 2/i }));
    await waitFor(() => expect(screen.getByPlaceholderText("Nome popular do animal")).toHaveValue("Segunda aba"));
  });

  it("permite revisar a versão conflitante e escolher explicitamente a revisão atual", async () => {
    const original = makeAnimal({ nome: null, revision: 1 });
    const current = makeAnimal({ nome: "Confirmado remoto", revision: 2 });
    mockedUseLiveQuery.mockImplementation(((query) =>
      typeof query === "function" && query.toString().includes("db.state_animais.get") ? current : []) as typeof useLiveQuery);
    const view = () => <MemoryRouter initialEntries={["/animais/animal-1/editar"]}>
      <Routes><Route path="/animais/:id/editar" element={<AnimalEditar />} /></Routes>
    </MemoryRouter>;
    await db.queue_ops.clear();
    await db.queue_rejections.clear();
    await db.state_animais.put(current);
    const first = render(view());
    fireEvent.change(await screen.findByLabelText(/^Nome$/i), { target: { value: "Primeira versão" } });
    await waitFor(async () => expect((await db.local_animal_edit_drafts_v2.get(["test-user", "farm-1", "animal-1"]))?.values.nome).toBe("Primeira versão"));
    const stored = (await db.local_animal_edit_drafts_v2.get(["test-user", "farm-1", "animal-1"]))!;
    await db.local_animal_edit_drafts_v2.put({ ...stored, baseline: original, conflicts: [{ ...stored, baseline: original, version_id: "outra-versao", values: { ...stored.values, nome: "Segunda versão" }, submission: { version_id: "outra-versao", client_tx_id: "tx-rejected", client_op_id: "op-rejected" } }] });
    await db.queue_ops.put({ client_op_id: "op-rejected", client_tx_id: "tx-rejected", op_order: 0, table: "animais", action: "UPDATE", sync_state: "REJECTED", created_at: "now", record: { id: "animal-1", fazenda_id: "farm-1" } });
    await db.queue_rejections.add({ client_op_id: "op-rejected", client_tx_id: "tx-rejected", fazenda_id: "farm-1", table: "animais", action: "UPDATE", reason_code: "REVISION_CONFLICT", reason_message: "conflict", created_at: "now" });
    first.unmount(); render(view());
    await screen.findByText(/versões de rascunho/i);
    fireEvent.click(screen.getByRole("button", { name: /revisar versão 2/i }));
    await waitFor(() => expect(screen.getByLabelText(/^Nome$/i)).toHaveValue("Segunda versão"));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /usar revisão atual como base/i }));
    await waitFor(async () => expect((await db.local_animal_edit_drafts_v2.get(["test-user", "farm-1", "animal-1"]))?.conflicts?.[0]?.baseline.revision).toBe(2));
    const actualOps = await vi.importActual<typeof import("@/lib/offline/ops")>("@/lib/offline/ops");
    mockedCreateGesture.mockImplementationOnce(actualOps.createGesture);
    fireEvent.click(screen.getAllByRole("button", { name: /Salvar alteracoes/i })[0]);
    await waitFor(() => expect(mockedCreateGesture).toHaveBeenCalled());
    expect(mockedCreateGesture.mock.calls[0]?.[1][0].record.nome).toBe("Segunda versão");
    expect(mockedCreateGesture.mock.calls[0]?.[2]?.animalEditBaseline?.revision).toBe(2);
    await waitFor(async () => expect((await db.queue_ops.filter(op => op.record.nome === "Segunda versão").first())?.expected_revision).toBe(2));
    expect(await db.queue_rejections.where("client_tx_id").equals("tx-rejected").count()).toBe(1);
    confirm.mockRestore();
  });
});
