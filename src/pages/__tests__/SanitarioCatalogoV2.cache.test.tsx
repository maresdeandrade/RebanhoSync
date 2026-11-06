/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/lib/offline/db";
import { pullSanitarioProtocolCatalogV2 } from "@/lib/offline/pull";
import SanitarioCatalogoV2 from "@/pages/SanitarioCatalogoV2";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/offline/pull", () => ({
  pullSanitarioProtocolCatalogV2: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: "user" } } },
        error: null,
      })),
    },
  },
}));
const pull = vi.mocked(pullSanitarioProtocolCatalogV2);
const protocol = (
  id = "global",
  scope = "global",
  fazenda_id: string | null = null,
) => ({
  id,
  family_code: id,
  name: `Protocolo ${id}`,
  scope,
  fazenda_id,
  version: 1,
  status: "active",
  approval_status: "approved",
  deleted_at: null,
});
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  await db.catalog_sanitario_protocolos_v2.clear();
  await db.catalog_sanitario_protocolo_itens_versions_v2.clear();
  await db.catalog_sanitario_product_class_groups_v2.clear();
  pull
    .mockReset()
    .mockResolvedValue({ protocolsFullFetch: false, remoteEmpty: false });
});
afterEach(cleanup);

it("não declara vazio remoto com base apenas em pull concluído sem recibo", async () => {
  pull.mockResolvedValueOnce(undefined as never);
  render(<SanitarioCatalogoV2 />);
  await waitFor(() => expect(pull).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Atualizar catálogo" }),
    ).toBeEnabled(),
  );
  expect(
    screen.queryByText("Nenhum protocolo disponível no catálogo global."),
  ).not.toBeInTheDocument();
});

it("exibe ausência de protocolos e grupos disponíveis sem painéis de protocolo vazios", async () => {
  await db.catalog_sanitario_product_class_groups_v2.put({
    id: "only-group",
    scope: "global",
    fazenda_id: null,
    group_key: "only-group",
    name: "Grupo sem protocolo",
    deleted_at: null,
  });
  render(<SanitarioCatalogoV2 />);
  expect(
    await screen.findByText("Nenhum protocolo disponível neste dispositivo."),
  ).toBeInTheDocument();
  expect(screen.getByText("Grupo sem protocolo")).toBeInTheDocument();
  expect(screen.queryByText("Selecione um protocolo")).not.toBeInTheDocument();
});

it("StrictMode mantém cache disponível e ignora erro de solicitação invalidada por offline", async () => {
  await db.catalog_sanitario_protocolos_v2.put(protocol());
  let rejectPull!: (error: unknown) => void;
  pull.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectPull = reject;
      }),
  );
  const view = render(
    <StrictMode>
      <SanitarioCatalogoV2 />
    </StrictMode>,
  );
  await screen.findAllByText("Protocolo global");
  expect(pull).toHaveBeenCalledTimes(1);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  await act(async () => {
    window.dispatchEvent(new Event("offline"));
    rejectPull(new Error("old request"));
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  view.unmount();
  render(<SanitarioCatalogoV2 />);
  expect(
    (await screen.findAllByText("Protocolo global")).length,
  ).toBeGreaterThan(0);
  expect(pull).toHaveBeenCalledTimes(1);
});

it("StrictMode conclui uma única atualização e desmontagem impede resposta obsoleta de alterar a nova tela", async () => {
  let resolveOld!: (result: Awaited<ReturnType<typeof pull>>) => void;
  pull.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  const first = render(
    <StrictMode>
      <SanitarioCatalogoV2 />
    </StrictMode>,
  );
  await waitFor(() => expect(pull).toHaveBeenCalledTimes(1));
  first.unmount();
  render(
    <StrictMode>
      <SanitarioCatalogoV2 />
    </StrictMode>,
  );
  await waitFor(() => expect(pull).toHaveBeenCalledTimes(2));
  await act(async () => {
    resolveOld({ protocolsFullFetch: true, remoteEmpty: true });
  });
  expect(
    screen.queryByText("Nenhum protocolo disponível no catálogo global."),
  ).not.toBeInTheDocument();
  expect(
    await screen.findByText("Consulta remota concluída."),
  ).toBeInTheDocument();
});

it("baixa ao abrir com cache vazio e mostra mudanças do Dexie sem remontar", async () => {
  render(<SanitarioCatalogoV2 />);
  await waitFor(() => expect(pull).toHaveBeenCalledTimes(1));
  await act(async () => {
    await db.catalog_sanitario_protocolos_v2.put(protocol());
  });
  expect(
    (await screen.findAllByText("Protocolo global")).length,
  ).toBeGreaterThan(0);
});

it("consulta cache offline, observa reconexão e preserva dados em falha de autenticação", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  await db.catalog_sanitario_protocolos_v2.put(protocol());
  render(<SanitarioCatalogoV2 />);
  expect(
    (await screen.findAllByText("Protocolo global")).length,
  ).toBeGreaterThan(0);
  expect(pull).not.toHaveBeenCalled();
  expect(screen.getByText(/Offline/)).toBeInTheDocument();
  pull.mockRejectedValueOnce({ code: "PGRST301", message: "JWT expired" });
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  await act(async () => {
    window.dispatchEvent(new Event("online"));
  });
  expect(await screen.findByText(/sessão/i)).toBeInTheDocument();
  expect(screen.getAllByText("Protocolo global").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: /Atualizar catálogo/ }));
  await waitFor(() => expect(pull).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.queryByText(/sessão/i)).not.toBeInTheDocument(),
  );
});

it("distingue vazio remoto confirmado de cache ainda não atualizado", async () => {
  pull.mockResolvedValueOnce({ protocolsFullFetch: true, remoteEmpty: true });
  render(<SanitarioCatalogoV2 />);
  expect(
    await screen.findByText("Nenhum protocolo disponível no catálogo global."),
  ).toBeInTheDocument();
});

it("não exibe protocolos de fazendas nem grupos tenant no catálogo global", async () => {
  await db.catalog_sanitario_product_class_groups_v2.put({
    id: "tenant-group",
    group_key: "tenant-group",
    name: "Grupo tenant",
    scope: "tenant",
    fazenda_id: "a",
    deleted_at: null,
  });
  await db.catalog_sanitario_protocolos_v2.bulkPut([
    protocol(),
    protocol("fazenda-a", "fazenda", "a"),
    protocol("fazenda-b", "fazenda", "b"),
  ]);
  render(<SanitarioCatalogoV2 />);
  expect(
    (await screen.findAllByText("Protocolo global")).length,
  ).toBeGreaterThan(0);
  expect(screen.queryAllByText("Protocolo fazenda-a")).toHaveLength(0);
  expect(screen.queryAllByText("Protocolo fazenda-b")).toHaveLength(0);
  expect(
    within(screen.getByText("Grupos técnicos").parentElement!).getByText("0"),
  ).toBeInTheDocument();
});

it("instala a resposta remota pelo pull real, renderiza e repete sem duplicar", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/offline/pull")>(
      "@/lib/offline/pull",
    );
  vi.mocked(supabase.from).mockImplementation((table) => {
    const rows = table === "sanitario_protocolos_v2" ? [protocol()] : [];
    const query = {
      select: () => query,
      eq: () => query,
      is: () => query,
      in: () => query,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return query as unknown as ReturnType<typeof supabase.from>;
  });
  pull.mockImplementation(actual.pullSanitarioProtocolCatalogV2);
  render(<SanitarioCatalogoV2 />);
  expect(
    (await screen.findAllByText("Protocolo global")).length,
  ).toBeGreaterThan(0);
  await screen.findByRole("button", { name: "Atualizar catálogo" });
  fireEvent.click(screen.getByRole("button", { name: "Atualizar catálogo" }));
  await waitFor(() => expect(pull).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Atualizar catálogo" }),
    ).toBeEnabled(),
  );
  expect(await db.catalog_sanitario_protocolos_v2.count()).toBe(1);
});

it("preserva cache com rede lenta, mostra falha de rede e permite retry", async () => {
  await db.catalog_sanitario_protocolos_v2.put(protocol());
  let rejectPull!: (cause: unknown) => void;
  pull.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectPull = reject;
      }),
  );
  render(<SanitarioCatalogoV2 />);
  expect(
    (await screen.findAllByText("Protocolo global")).length,
  ).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /Atualizando/ })).toBeDisabled();
  expect(screen.getByText(/Dados locais parciais/)).toBeInTheDocument();
  await act(async () => {
    rejectPull(new TypeError("Failed to fetch"));
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /dados locais foram preservados/,
  );
  fireEvent.click(screen.getByRole("button", { name: "Atualizar catálogo" }));
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(await db.catalog_sanitario_protocolos_v2.count()).toBe(1);
});

it("não confunde sessão ausente com catálogo remoto vazio", async () => {
  vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
    data: { session: null },
    error: null,
  });
  render(<SanitarioCatalogoV2 />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/sessão/);
  expect(pull).not.toHaveBeenCalled();
  expect(
    screen.queryByText("Nenhum protocolo disponível no catálogo global."),
  ).not.toBeInTheDocument();
});

it("observa também itens e grupos técnicos alterados por outra sincronização", async () => {
  await db.catalog_sanitario_protocolos_v2.put(protocol());
  render(<SanitarioCatalogoV2 />);
  await screen.findAllByText("Protocolo global");
  await act(async () => {
    await db.catalog_sanitario_protocolo_itens_versions_v2.put({
      id: "item-live",
      protocol_id: "global",
      logical_item_key: "consulta",
      version: 1,
      item_status: "condicional",
      status: "active",
      product_requirement_kind: "product_class_group",
      product_class_group_id: "group-live",
      deleted_at: null,
    });
  });
  expect(
    await screen.findByRole("article", { name: /consulta — versão 1/ }),
  ).toBeInTheDocument();
  await act(async () => {
    await db.catalog_sanitario_product_class_groups_v2.put({
      id: "group-live",
      group_key: "group-live",
      name: "Grupo atualizado",
      scope: "global",
      fazenda_id: null,
      deleted_at: null,
    });
  });
  expect(await screen.findByText("Grupo atualizado")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByText(/Dados locais parciais/)).not.toBeInTheDocument(),
  );
});
