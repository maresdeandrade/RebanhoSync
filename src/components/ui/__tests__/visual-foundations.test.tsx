/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Alert } from "../alert";
import { Badge } from "../badge";
import { Button } from "../button";
import { Card } from "../card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../dialog";
import { Input } from "../input";
import { PageHeader, PageIntro } from "../page-intro";
import { Popover, PopoverContent } from "../popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../sheet";
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

  it("applies canonical interaction tokens without changing component APIs", () => {
    render(
      <>
        <Button disabled>Salvar</Button>
        <Input aria-label="Nome" disabled />
        <Card data-testid="surface">Conteúdo</Card>
        <Badge>Ativo</Badge>
        <Alert variant="danger">Falha</Alert>
      </>,
    );

    expect(screen.getByRole("button", { name: "Salvar" })).toHaveClass(
      "bg-primary",
      "hover:bg-primary-hover",
      "disabled:bg-control-disabled",
    );
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveClass(
      "border-border-strong",
      "bg-surface",
      "disabled:text-control-disabled-foreground",
    );
    expect(screen.getByTestId("surface")).toHaveClass(
      "bg-surface",
      "text-content-primary",
    );
    expect(screen.getByText("Ativo")).toHaveClass("hover:bg-primary-hover");
    expect(screen.getByRole("alert")).toHaveClass(
      "border-danger-border",
      "bg-danger-muted",
    );
  });

  it("uses the elevated surface contract for floating primitives", () => {
    const dialog = render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Dialog</DialogTitle>
          <DialogDescription>Descrição do dialog.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("dialog", { name: "Dialog" })).toHaveClass(
      "border-border-strong",
      "bg-surface-elevated",
    );
    dialog.unmount();

    const sheet = render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>Sheet</SheetTitle>
          <SheetDescription>Descrição do sheet.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole("dialog", { name: "Sheet" })).toHaveClass(
      "border-border-strong",
      "bg-surface-elevated",
    );
    sheet.unmount();

    render(
      <Popover defaultOpen>
        <PopoverContent>Popover</PopoverContent>
      </Popover>,
    );

    expect(screen.getByText("Popover")).toHaveClass(
      "border-border-strong",
      "bg-surface-elevated",
    );
  });
});
