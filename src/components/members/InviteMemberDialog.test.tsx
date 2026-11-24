/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InviteMemberDialog } from "./InviteMemberDialog";
const { rpc, toast } = vi.hoisted(() => ({ rpc: vi.fn(), toast: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: { token: "11111111-1111-4111-8111-111111111111" }, error: null }); });
afterEach(cleanup);
it("rejeita email invalido antes de gerar um convite utilizavel", async () => {
  render(<InviteMemberDialog open onOpenChange={() => {}} fazendaId="farm-a" callerRole="owner" onSuccess={() => {}} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nao-e-email" } });
  fireEvent.click(screen.getByRole("button", { name: "Gerar convite" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/email|e-mail/i);
  expect(screen.queryByLabelText("Link do convite")).not.toBeInTheDocument();
});

it("explica que o link gerado precisa ser compartilhado e não envia mensagem", async () => {
  const onSuccess = vi.fn();
  render(<InviteMemberDialog open onOpenChange={() => {}} fazendaId="farm-a" callerRole="owner" onSuccess={onSuccess} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "pessoa@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Gerar convite" }));
  expect(await screen.findByLabelText("Link do convite")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(/nenhuma mensagem foi enviada/i);
  expect(screen.getByRole("status")).toHaveTextContent(/copie e compartilhe/i);
  expect(onSuccess).toHaveBeenCalledOnce();
});
