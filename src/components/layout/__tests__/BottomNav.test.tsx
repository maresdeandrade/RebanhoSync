/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { getBottomNavigationActiveKey } from "../navigationConfig";
import { BottomNav } from "../BottomNav";

describe("BottomNav", () => {
  function renderBottomNav(initialEntry = "/home") {
    const onOpenMenu = vi.fn();

    render(
      <MemoryRouter
        initialEntries={[initialEntry]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <BottomNav onOpenMenu={onOpenMenu} />
      </MemoryRouter>,
    );

    return { onOpenMenu };
  }

  it("renders the five mobile items with expected links", () => {
    renderBottomNav();

    expect(screen.getByRole("navigation", { name: /navegacao mobile/i }))
      .toHaveClass("md:hidden");
    expect(screen.getByRole("link", { name: /hoje/i })).toHaveAttribute(
      "href",
      "/home",
    );
    expect(screen.getByRole("link", { name: /rebanho/i })).toHaveAttribute(
      "href",
      "/animais",
    );
    expect(screen.getByRole("link", { name: /manejo/i })).toHaveAttribute(
      "href",
      "/registrar",
    );
    expect(screen.getByRole("link", { name: /estrutura/i })).toHaveAttribute(
      "href",
      "/pastos",
    );
    expect(screen.getByRole("button", { name: /mais/i })).toBeInTheDocument();
  });

  it("opens the full mobile menu from Mais", () => {
    const { onOpenMenu } = renderBottomNav("/financeiro");

    fireEvent.click(screen.getByRole("button", { name: /mais/i }));

    expect(onOpenMenu).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /mais/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it.each([
    ["/home", "Hoje"],
    ["/agenda", "Hoje"],
    ["/registrar", "Manejo"],
    ["/animais/animal-1", "Rebanho"],
    ["/lotes/lote-1", "Rebanho"],
    ["/pastos/pasto-1", "Estrutura"],
  ])("marks %s as %s", (path, label) => {
    renderBottomNav(path);

    const item =
      label === "Mais"
        ? screen.getByRole("button", { name: label })
        : screen.getByRole("link", { name: label });

    expect(item).toHaveAttribute("aria-current", "page");
  });

  it("resolves active keys for secondary routes", () => {
    expect(getBottomNavigationActiveKey("/protocolos-sanitarios")).toBe("mais");
    expect(getBottomNavigationActiveKey("/eventos")).toBe("mais");
  });
});
