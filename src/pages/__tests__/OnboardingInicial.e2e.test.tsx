/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import OnboardingInicial from "@/pages/OnboardingInicial";

vi.mock("@/hooks/useAuth");
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("OnboardingInicial wizard", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  const mockedFrom = vi.mocked(supabase.from);
  const maybeSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
    } as ReturnType<typeof useAuth>);

    mockedUseLiveQuery.mockReturnValue({
      pastos: 1,
      lotes: 0,
      animais: 0,
      protocolos: 0,
      eventos: 0,
    } as ReturnType<typeof useLiveQuery>);

    maybeSingle.mockResolvedValue({
      data: {
        nome: "Fazenda Boa Vista",
        municipio: "Cuiaba",
        estado: "MT",
        tipo_producao: "corte",
      },
    });

    mockedFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle,
          }),
        }),
      }),
    } as never);
  });

  it("foca a primeira etapa pendente e permite navegar pelo wizard", async () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <OnboardingInicial />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: /Implantacao guiada da fazenda/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/Proxima recomendacao:/i)).toBeInTheDocument();
    await waitFor(
      () => {
        expect(
          screen.getByRole("heading", { name: /3\. Organizar os lotes/i }),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const cta = screen.getByRole("link", { name: /Abrir proximo passo/i });
    expect(cta).toHaveAttribute("href", "/lotes/importar");

    fireEvent.click(screen.getByRole("button", { name: /Rebanho/i }));

    await waitFor(
      () => {
        expect(
          screen.getByRole("heading", { name: /4\. Trazer o rebanho inicial/i }),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(screen.getAllByText(/0 animal\(is\) cadastrados/i).length).toBeGreaterThan(0);
  });
});
