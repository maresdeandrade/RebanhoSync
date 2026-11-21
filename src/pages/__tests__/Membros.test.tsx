/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Membros from "../Membros";

const { from, rpc, toast } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), toast: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from, rpc } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ activeFarmId: "farm-a", role: "owner" }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
const owner = { user_id: "owner-a", fazenda_id: "farm-a", role: "owner", accepted_at: "2026-11-20T00:00:00Z", deleted_at: null, created_at: "2026-11-20T00:00:00Z" };
let invites: Record<string, unknown>[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  invites = [];
  from.mockImplementation((table: string) => ({ select: (fields: string) => {
    if (table === "user_fazendas") return { eq: async () => fields.includes("!")
      ? { data: null, error: { message: "relationship not found" } }
      : { data: [owner], error: null } };
    if (table === "user_profiles") return { in: async () => ({ data: [], error: null }) };
    const chain = { eq: () => chain, is: () => chain, order: async () => ({ data: invites, error: null }) };
    return chain;
  } }));
  rpc.mockResolvedValue({ data: [{ user_id: "owner-a", email: "owner@example.test" }], error: null });
});

it("atualiza lista e contador de convites após criar sem recarregar a página", async () => {
  rpc.mockImplementation(async (name: string) => {
    if (name === "create_invite") {
      invites = [{ id: "invite-a", email: "worker@example.test", phone: null, role: "cowboy", token: "11111111-1111-4111-8111-111111111111", expires_at: "2099-01-01", created_at: "2026-11-20" }];
      return { data: invites[0], error: null };
    }
    return { data: [{ user_id: "owner-a", email: "owner@example.test" }], error: null };
  });
  render(<Membros />);
  await screen.findByText("owner@example.test");
  fireEvent.click(screen.getByRole("button", { name: "Convidar membro" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "worker@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Gerar convite" }));
  await screen.findByLabelText("Link do convite");
  fireEvent.click(screen.getAllByRole("button", { name: "Fechar" })[0]);
  expect(await screen.findByText("worker@example.test")).toBeInTheDocument();
  expect(screen.getByText("1 convite(s)")).toBeInTheDocument();
});
afterEach(cleanup);

it("mostra o proprietário sem perfil complementar, sem exigir uma FK inexistente", async () => {
  render(<Membros />);
  expect(await screen.findByText("owner@example.test")).toBeInTheDocument();
  expect(screen.getByText("1 pessoa(s)")).toBeInTheDocument();
  expect(screen.queryByText("Nenhum membro neste recorte")).not.toBeInTheDocument();
});

it("distingue erro na consulta de uma equipe vazia", async () => {
  const normal = from.getMockImplementation()!;
  from.mockImplementation((table: string) => table === "user_fazendas"
    ? { select: () => ({ eq: async () => ({ data: null, error: { message: "network unavailable" } }) }) }
    : normal(table));
  render(<Membros />);
  expect(await screen.findByRole("button", { name: /Tentar novamente/ })).toBeInTheDocument();
  expect(screen.queryByText("Nenhum membro neste recorte")).not.toBeInTheDocument();
});
