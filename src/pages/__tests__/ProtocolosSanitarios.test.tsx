/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/hooks/useAuth";
import { useProtocolosData } from "@/pages/ProtocolosSanitarios/helpers/useProtocolosData";
import ProtocolosSanitarios from "@/pages/ProtocolosSanitarios";

vi.mock("@/hooks/useAuth");
vi.mock("@/pages/ProtocolosSanitarios/helpers/useProtocolosData");
vi.mock("@/components/sanitario/OfficialSanitaryPackManager", () => ({
  OfficialSanitaryPackManager: () => <div>Pack oficial mock</div>,
}));
vi.mock("@/components/sanitario/RegulatoryOverlayManager", () => ({
  RegulatoryOverlayManager: () => <div>Conformidade mock</div>,
}));
vi.mock("@/components/sanitario/FarmProtocolManager", () => ({
  FarmProtocolManager: () => <div>Protocolos da fazenda mock</div>,
}));

describe("ProtocolosSanitarios page", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseProtocolosData = vi.mocked(useProtocolosData);
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      farmExperienceMode: "completo",
      role: "manager",
    } as ReturnType<typeof useAuth>);
    mockedUseProtocolosData.mockReturnValue({
      catalogProducts: [],
      protocolosExistentes: [],
      protocolosItensExistentes: [],
      agendaItens: [],
      animais: [],
      sanidadeConfig: null,
      isRefreshing: false,
      refreshError: null,
      isLoading: false,
    });
  });

  it("separa a navegacao entre pack oficial, conformidade e protocolos da fazenda", () => {
    render(
      <MemoryRouter>
        <ProtocolosSanitarios />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Pack oficial" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Conformidade" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Protocolos da fazenda" }),
    ).toBeEnabled();
    expect(screen.getByText("Pack oficial mock")).toBeInTheDocument();
    expect(screen.getByText("Conformidade mock")).toBeInTheDocument();
    expect(screen.getByText("Protocolos da fazenda mock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Conformidade" }));

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("mantem protocolos da fazenda bloqueado para perfil somente leitura", () => {
    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      farmExperienceMode: "completo",
      role: "cowboy",
    } as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <ProtocolosSanitarios />
      </MemoryRouter>,
    );

    expect(screen.getByText("Somente leitura")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Protocolos da fazenda" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Conformidade" })).toBeEnabled();
  });
});
