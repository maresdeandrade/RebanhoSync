/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Perfil } from "@/pages/Perfil";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "fixture-user" } } }) },
  from: vi.fn(() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) })),
} }));

describe("atalho administrativo do Perfil", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ isSuperAdmin: true, refreshSettings: vi.fn(), farmExperienceMode: "completo" } as ReturnType<typeof useAuth>);
  });
  function renderProfile() {
    render(<MemoryRouter initialEntries={["/perfil"]}><Routes>
      <Route path="/perfil" element={<Perfil />} />
      <Route path="/admin" element={<div>Destino administrativo</div>} />
    </Routes></MemoryRouter>);
  }
  it("oferece um único atalho para /admin, sem formulário de curadoria", async () => {
    const user = userEvent.setup();
    renderProfile();
    const shortcut = await screen.findByRole("button", { name: "Painel Administrativo" });
    expect(screen.getAllByRole("button", { name: "Painel Administrativo" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /aprovar|rejeitar|publicar|preview/i })).not.toBeInTheDocument();
    await user.click(shortcut);
    expect(screen.getByText("Destino administrativo")).toBeInTheDocument();
  });
  it("não exibe o atalho para usuários sem superadmin", async () => {
    vi.mocked(useAuth).mockReturnValue({ isSuperAdmin: false, refreshSettings: vi.fn(), farmExperienceMode: "completo" } as ReturnType<typeof useAuth>);
    renderProfile();
    await screen.findByText("Conta e acesso");
    expect(screen.queryByRole("button", { name: "Painel Administrativo" })).not.toBeInTheDocument();
  });
});
