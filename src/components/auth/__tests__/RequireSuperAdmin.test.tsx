/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireSuperAdmin } from "../RequireSuperAdmin";
import * as useAuthModule from "@/hooks/useAuth";
import type { Session, User } from "@supabase/supabase-js";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockUser: User = {
  id: "user-1",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-08-24T10:00:00Z",
};

const mockSession: Session = {
  access_token: "token",
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "refresh",
  user: mockUser,
};

describe("RequireSuperAdmin Component Guard", () => {
  it("exibe tela de carregamento quando o status ainda está sendo avaliado", () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: mockSession,
      user: mockUser,
      loading: false,
      isSuperAdmin: null,
      activeFarmId: null,
      role: null,
      farmExperienceMode: "standard",
      farmLifecycleConfig: {} as unknown as ReturnType<typeof useAuthModule.useAuth>["farmLifecycleConfig"],
      farmMeasurementConfig: {} as unknown as ReturnType<typeof useAuthModule.useAuth>["farmMeasurementConfig"],
      notificationPreferences: {} as unknown as ReturnType<typeof useAuthModule.useAuth>["notificationPreferences"],
      loadRoleForFarm: vi.fn(),
      setActiveFarm: vi.fn(),
      refreshSettings: vi.fn(),
      signOut: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter>
        <RequireSuperAdmin>
          <div>Conteúdo Protegido</div>
        </RequireSuperAdmin>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Conteúdo Protegido")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("redireciona para /login quando o usuário não está autenticado", () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: null,
      user: null,
      loading: false,
      isSuperAdmin: false,
      activeFarmId: null,
      role: null,
      farmExperienceMode: "standard",
      farmLifecycleConfig: {} as unknown as ReturnType<typeof useAuthModule.useAuth>["farmLifecycleConfig"],
      farmMeasurementConfig: {} as unknown as ReturnType<typeof useAuthModule.useAuth>["farmMeasurementConfig"],
      notificationPreferences: {} as unknown as ReturnType<typeof useAuthModule.useAuth>["notificationPreferences"],
      loadRoleForFarm: vi.fn(),
      setActiveFarm: vi.fn(),
      refreshSettings: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <RequireSuperAdmin>
                <div>Conteúdo Protegido</div>
              </RequireSuperAdmin>
            }
          />
          <Route path="/login" element={<div>Página de Login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Conteúdo Protegido")).not.toBeInTheDocument();
    expect(screen.getByText("Página de Login")).toBeInTheDocument();
  });

  it("redireciona para /home quando o usuário autenticado NÃO é SuperAdmin", () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: mockSession,
      user: mockUser,
      loading: false,
      isSuperAdmin: false,
      activeFarmId: "farm-1",
      role: "owner",
      farmExperienceMode: "standard",
      farmLifecycleConfig: {} as unknown as ReturnType<typeof useAuthModule.useAuth>["farmLifecycleConfig"],
      farmMeasurementConfig: {} as unknown as ReturnType<typeof useAuthModule.useAuth>["farmMeasurementConfig"],
      notificationPreferences: {} as unknown as ReturnType<typeof useAuthModule.useAuth>["notificationPreferences"],
      loadRoleForFarm: vi.fn(),
      setActiveFarm: vi.fn(),
      refreshSettings: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <RequireSuperAdmin>
                <div>Conteúdo Protegido</div>
              </RequireSuperAdmin>
            }
          />
          <Route path="/home" element={<div>Página Inicial Home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Conteúdo Protegido")).not.toBeInTheDocument();
    expect(screen.getByText("Página Inicial Home")).toBeInTheDocument();
  });

  it("renderiza o conteúdo protegido quando o usuário é SuperAdmin confirmado", () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      session: mockSession,
      user: mockUser,
      loading: false,
      isSuperAdmin: true,
      activeFarmId: "farm-1",
      role: "owner",
      farmExperienceMode: "standard",
      farmLifecycleConfig: {} as unknown as ReturnType<typeof useAuthModule.useAuth>["farmLifecycleConfig"],
      farmMeasurementConfig: {} as unknown as ReturnType<typeof useAuthModule.useAuth>["farmMeasurementConfig"],
      notificationPreferences: {} as unknown as ReturnType<typeof useAuthModule.useAuth>["notificationPreferences"],
      loadRoleForFarm: vi.fn(),
      setActiveFarm: vi.fn(),
      refreshSettings: vi.fn(),
      signOut: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <RequireSuperAdmin>
          <div>Conteúdo Protegido SuperAdmin</div>
        </RequireSuperAdmin>
      </MemoryRouter>,
    );

    expect(screen.getByText("Conteúdo Protegido SuperAdmin")).toBeInTheDocument();
  });
});
