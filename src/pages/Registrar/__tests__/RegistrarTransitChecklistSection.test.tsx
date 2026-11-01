/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TRANSIT_CHECKLIST_DRAFT,
  validateTransitChecklist,
} from "@/lib/sanitario/compliance/transit";
import { RegistrarTransitChecklistSection } from "../components/RegistrarTransitChecklistSection";

const draft = {
  ...DEFAULT_TRANSIT_CHECKLIST_DRAFT,
  enabled: true,
  purpose: "reproducao" as const,
  isInterstate: true,
};
const baseProps = {
  transitChecklist: draft,
  onTransitChecklistChange: vi.fn(),
  officialTransitChecklistEnabled: true,
  transitPurposeOptions: [{ value: "reproducao" as const, label: "Reproducao" }],
  ufOptions: [],
};

afterEach(cleanup);

describe("RegistrarTransitChecklistSection", () => {
  it("exibe todos os avisos de GTA nao confirmada e reproducao interestadual incompleta", () => {
    const issues = validateTransitChecklist(draft, "2026-10-29");
    expect(issues).toHaveLength(5);

    render(
      <RegistrarTransitChecklistSection {...baseProps} transitChecklistIssues={issues} />,
    );

    for (const issue of issues) {
      expect(screen.getByText(issue)).toBeVisible();
    }
    expect(screen.getAllByRole("listitem")).toHaveLength(issues.length);
    expect(screen.getByText("Aviso documental (nao bloqueia o registro)")).toBeVisible();
    expect(screen.getByText(/o RebanhoSync nao emite, consulta, autentica/)).toBeVisible();
  });

  it("exibe uma unica vez avisos repetidos na entrada", () => {
    render(
      <RegistrarTransitChecklistSection
        {...baseProps}
        transitChecklistIssues={["GTA nao confirmada.", "Atestados ausentes.", "GTA nao confirmada."]}
      />,
    );

    expect(screen.getAllByText("GTA nao confirmada.")).toHaveLength(1);
    expect(screen.getByText("Atestados ausentes.")).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("nao exibe o painel documental quando nao ha avisos", () => {
    render(
      <RegistrarTransitChecklistSection {...baseProps} transitChecklistIssues={[]} />,
    );

    expect(screen.queryByText("Aviso documental (nao bloqueia o registro)")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
