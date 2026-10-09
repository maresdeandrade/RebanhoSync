import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import MarketingHome from "../marketing/Home";
import { MarketingContact, MarketingFaq } from "../marketing/StaticPages";

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter future={routerFuture}>{ui}</MemoryRouter>,
  );
}

describe("Website marketing", () => {
  it("apresenta o posicionamento, CTAs e mantém claims bloqueados fora da Home", () => {
    renderWithRouter(<MarketingHome />);

    expect(
      screen.getByRole("heading", {
        name: "O que acontece no campo, pronto para decidir.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Solicitar demonstração" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Agenda e Eventos permanecem separados/i)).toBeInTheDocument();

    expect(document.body).not.toHaveTextContent(/tudo funciona sem internet/i);
    expect(document.body).not.toHaveTextContent(/nunca perde dados/i);
    expect(document.body).not.toHaveTextContent(/liberado para abate/i);
  });

  it("explica Agenda e Evento como conceitos distintos no FAQ", async () => {
    const user = userEvent.setup();
    renderWithRouter(<MarketingFaq />);

    const trigger = screen.getByRole("button", {
      name: "Como é separado o planejado do que aconteceu?",
    });
    await user.click(trigger);

    expect(
      screen.getByText(/Agenda representa intenção ou tarefa futura/i),
    ).toBeVisible();
    expect(screen.getByText(/Evento representa fato executado/i)).toBeVisible();
  });

  it("mantém o formulário de demonstração em modo preview sem transmitir dados", async () => {
    const user = userEvent.setup();
    renderWithRouter(<MarketingContact />);

    await user.type(screen.getByLabelText("Nome"), "Fazenda Teste");
    await user.type(screen.getByLabelText("Telefone / WhatsApp"), "11999999999");
    await user.type(screen.getByLabelText("E-mail"), "teste@example.com");
    await user.selectOptions(screen.getByLabelText("Sua função"), "gestor");
    await user.click(screen.getByRole("button", { name: "Solicitar demonstração" }));

    expect(
      screen.getByRole("status"),
    ).toHaveTextContent("Nenhum dado foi transmitido nesta prévia.");
  });
});
