/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegistrarStickyActionBar } from "../components/RegistrarStickyActionBar";
import { RegistrarComplianceBlockSection } from "../components/RegistrarComplianceBlocks";
afterEach(cleanup);
describe("factual registration warnings", () => {
  it("shows all warnings once at confirmation without disabling registration", () => {
    render(<RegistrarStickyActionBar step={3} isFinalizing={false} canAdvanceToConfirm tipoManejo="movimentacao"
      sourceTaskId={null} actionStepIssues={[]} advisoryWarnings={["Caso aberto", "GTA nao verificada", "Restricao", "Caso aberto"]}
      onBack={vi.fn()} onNext={vi.fn()} onFinalize={vi.fn()} />);
    expect(screen.getAllByText("Caso aberto")).toHaveLength(1);
    expect(screen.getByText("GTA nao verificada")).toBeInTheDocument(); expect(screen.getByText("Restricao")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar|registrar/i })).toBeEnabled();
    expect(screen.getByText(/nao autoriza transito/)).toBeInTheDocument();
  });
  it("does not hide compliance warnings behind the first restriction", () => {
    render(<RegistrarComplianceBlockSection title="Restricoes" blockers={[
      { key: "a", label: "A", tone: "danger", message: "Aviso A" }, { key: "b", label: "B", tone: "danger", message: "Aviso B" },
    ]} warnings={[{ key: "c", label: "C", tone: "warning", message: "Aviso C" }]} />);
    for (const message of ["Aviso A", "Aviso B", "Aviso C"]) expect(screen.getByText(message)).toBeInTheDocument();
  });
});
