/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/offline/ops", () => ({ createGesture: vi.fn(async () => "synthetic-move-tx") }));
vi.mock("@/hooks/useLotes", () => ({ useLotes: () => [{ id: "target-lot", nome: "Destino" }] }));
vi.mock("@/utils/toast", () => ({ showSuccess: vi.fn(), showError: vi.fn() }));
vi.mock("@/lib/sanitario/compliance/regulatoryReadModel", () => ({ loadRegulatorySurfaceSource: async () => null,
  buildRegulatoryOperationalReadModel: () => ({ flows: { movementInternal: { blockers: [
    { key: "a", label: "Aviso A", message: "Restricao A" }, { key: "b", label: "Aviso B", message: "Restricao B" },
  ], warnings: [] } } }) }));
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { MoverAnimalLote } from "../MoverAnimalLote";
const animal = { id: "synthetic-move-animal", fazenda_id: "synthetic-farm", identificacao: "SYNTHETIC", lote_id: "origin-lot" };
beforeEach(async () => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  vi.clearAllMocks(); await db.state_sanitario_casos.clear();
  await db.state_animais.put({ ...animal, payload: {}, revision: 1 } as never);
  await db.state_sanitario_casos.put({ id: "synthetic-move-case", fazenda_id: animal.fazenda_id, animal_id: animal.id,
    status: "aberto", closed_at: null, movement_blocked: true, disease_name: "Suspeita local" } as never);
});
afterEach(async () => { cleanup(); await db.state_sanitario_casos.clear(); await db.state_animais.clear(); });
it("allows factual movement with case/regulatory warnings and no projection rewrite", async () => {
  const user = userEvent.setup(); render(<MoverAnimalLote animal={animal} open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);
  await screen.findByText(/Suspeita local/);
  expect(screen.getByText(/Restricao A.*Restricao B/)).toBeInTheDocument();
  const button = screen.getByRole("button", { name: "Confirmar movimentacao" });
  expect(button).toBeDisabled(); // Missing destination remains an integrity error.
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
  await user.click(await screen.findByRole("option", { name: "Destino" }));
  expect(button).toBeEnabled(); await user.click(button);
  await waitFor(() => expect(createGesture).toHaveBeenCalledTimes(1));
  expect(vi.mocked(createGesture).mock.calls[0][1][0]).toMatchObject({ table: "movement_v1", record: { subject_id: animal.id, to_lote_id: "target-lot" } });
  expect((await db.state_animais.get(animal.id))?.payload).toEqual({});
});
