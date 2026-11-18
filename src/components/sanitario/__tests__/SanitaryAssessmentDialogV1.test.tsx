/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { enqueueSanitaryAssessmentV1 } from "@/lib/sanitario/execution/sanitaryAssessmentV1";
import type { SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import type { SanitaryTriageEvaluationV2 } from "@/lib/sanitario/triage/sanitaryTriageV2";
import { SanitaryAssessmentDialogV1 } from "../SanitaryAssessmentDialogV1";

vi.mock("@/lib/sanitario/execution/sanitaryAssessmentV1", () => ({ enqueueSanitaryAssessmentV1: vi.fn() }));
const source = { fazendaId: "farm-1", catalog: { items: [{ id: "item-1", protocolId: "protocol-1", version: 1 }] } } as unknown as SanitaryProtocolWindowSourceV2;
const evaluation = { animalId: "animal-1", identification: "Mimosa", protocolId: "protocol-1", protocolLabel: "Parasitas", itemId: "item-1", itemLabel: "Avaliação" } as SanitaryTriageEvaluationV2;

describe("SanitaryAssessmentDialogV1", () => {
  it("exige responsável e enfileira indicação sem declarar aplicação", async () => {
    vi.mocked(enqueueSanitaryAssessmentV1).mockResolvedValue("event-1");
    const onQueued = vi.fn();
    render(<SanitaryAssessmentDialogV1 source={source} evaluation={evaluation} onClose={vi.fn()} onQueued={onQueued} />);
    const submit = screen.getByRole("button", { name: "Registrar avaliação" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Responsável pela avaliação"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Resultado da avaliação"), { target: { value: "treatment_indicated" } });
    fireEvent.click(submit);
    await waitFor(() => expect(onQueued).toHaveBeenCalledOnce());
    expect(enqueueSanitaryAssessmentV1).toHaveBeenCalledWith(expect.objectContaining({ animalIds: ["animal-1"], itemId: "item-1", responsibleName: "Ana", result: "treatment_indicated" }));
    expect(screen.getByText(/não registra aplicação de produto/)).toBeInTheDocument();
  });

  it("explica indisponibilidade quando sincronização sanitária está desligada", async () => {
    vi.mocked(enqueueSanitaryAssessmentV1).mockRejectedValue(new Error("SANITARIO_V2_PUSH_DISABLED"));
    render(<SanitaryAssessmentDialogV1 source={source} evaluation={evaluation} onClose={vi.fn()} onQueued={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Responsável pela avaliação"), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar avaliação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("sincronização sanitária desta fazenda ainda não está habilitada");
  });
});
