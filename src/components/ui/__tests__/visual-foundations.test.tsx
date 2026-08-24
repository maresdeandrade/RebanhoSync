/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader, PageIntro } from "../page-intro";
import { StateBanner } from "../state-banner";
import { StatusBadge } from "../status-badge";
import { FilterBar, Toolbar } from "../toolbar";

describe("visual foundations", () => {
  it("keeps structural aliases on the canonical implementations", () => {
    expect(PageHeader).toBe(PageIntro);
    expect(FilterBar).toBe(Toolbar);
  });

  it.each([
    ["offline", "border-semantic-offline-border"],
    ["pending", "border-semantic-pending-border"],
    ["conflict", "border-semantic-conflict-border"],
    ["unknown", "border-semantic-unknown-border"],
    ["notPermitted", "border-semantic-not-permitted-border"],
  ] as const)("exposes the %s operational tone", (tone, expectedClass) => {
    render(<StatusBadge tone={tone}>{tone}</StatusBadge>);

    expect(screen.getByText(tone)).toHaveClass(expectedClass);
  });

  it("provides textual state and polite announcements independently of color", () => {
    render(
      <StateBanner
        tone="conflict"
        title="Conflito de versões"
        description="Revise as versões antes de continuar."
        live="polite"
      />,
    );

    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Conflito de versões")).toBeInTheDocument();
    expect(
      screen.getByText("Revise as versões antes de continuar."),
    ).toBeInTheDocument();
  });
});
