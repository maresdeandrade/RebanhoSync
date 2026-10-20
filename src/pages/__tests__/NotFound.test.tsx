/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NotFound from "@/pages/NotFound";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("UX16 — rota inexistente apresenta texto em portugues e retorno por teclado", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const user = userEvent.setup();
  render(
    <MemoryRouter
      initialEntries={["/rota-inexistente"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/" element={<h1>Aplicação</h1>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "404 — Página não encontrada",
  );
  expect(
    screen.getByText("A página que você procura não existe ou foi movida."),
  ).toBeVisible();
  const back = screen.getByRole("link", { name: "Voltar ao início" });
  expect(back).toHaveAttribute("href", "/");
  await user.tab();
  expect(back).toHaveFocus();
  await user.keyboard("[Enter]");
  expect(screen.getByRole("heading", { name: "Aplicação" })).toBeVisible();
  expect(log).toHaveBeenCalledWith(expect.any(String), "/rota-inexistente");
});
