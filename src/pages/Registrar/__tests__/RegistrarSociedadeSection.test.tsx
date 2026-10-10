/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import "fake-indexeddb/auto";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/offline/db";
import type { Animal, SociedadePecuaria } from "@/lib/offline/types";
import { loadAnimalAcquisitionHistory } from "@/lib/comercial/animalCommercialHistory";
import { RegistrarSociedadeSection } from "../components/RegistrarSociedadeSection";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ role: "owner" }) }));

const farm = "10000000-0000-4000-8000-000000000001";
async function clear() {
  await Promise.all(
    [
      db.state_animais,
      db.state_sociedade_animais,
      db.state_sociedades_pecuarias,
      db.event_eventos,
      db.event_eventos_pesagem,
      db.queue_ops,
    ].map((table) => table.clear()),
  );
}

describe("entrada factual pelo formulário de Sociedade", () => {
  beforeEach(async () => {
    await clear();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });
  afterEach(async () => {
    cleanup();
    vi.restoreAllMocks();
    await clear();
  });

  async function fill(weights: number[]) {
    const user = userEvent.setup();
    render(
      <RegistrarSociedadeSection
        selectedAnimalIds={[]}
        contrapartes={[{ id: "parceiro", nome: "Sócio" }]}
        fazendaId={farm}
      />,
    );
    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(
      await screen.findByRole("option", { name: /Criar nova sociedade/ }),
    );
    fireEvent.change(screen.getByPlaceholderText("Ex: Sociedade Nelore G1"), {
      target: { value: "Aquisição em sociedade" },
    });
    // A criação da sociedade é parte do mesmo gesto de entrada.
    await user.click(screen.getAllByRole("combobox")[2]);
    await user.click(await screen.findByRole("option", { name: "Sócio" }));
    if (weights.length > 1)
      await user.click(screen.getByRole("button", { name: /Múltiplos/ }));
    for (const [i, weight] of weights.entries()) {
      fireEvent.change(screen.getByPlaceholderText(`BR-${i + 1}`), {
        target: { value: `SOC-${i}` },
      });
      fireEvent.change(
        screen.getByLabelText(`Peso de aquisição animal ${i + 1} (kg)`),
        { target: { value: String(weight) } },
      );
    }
    await user.click(
      screen.getByRole("button", { name: "Confirmar Registro de Entrada" }),
    );
  }

  it.each([[[320]], [[320, 355]]])(
    "persiste pesos individuais %j pelo handler real",
    async (weights) => {
      await fill(weights);
      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith(
          "Entrada em sociedade registrada com sucesso!",
        ),
      );
      db.close();
      await db.open();
      const animals = await db.state_animais.toArray();
      expect(animals).toHaveLength(weights.length);
      for (const [i, weight] of weights.entries()) {
        const animal = animals.find((row) => row.identificacao === `SOC-${i}`)!;
        expect(
          (await loadAnimalAcquisitionHistory(farm, animal.id))[0],
        ).toMatchObject({ origin: "sociedade", weight, value: null });
      }
      expect(await db.event_eventos_pesagem.count()).toBe(weights.length);
    },
  );

  it("vincula animal existente sem criar pesagem ou aquisição física", async () => {
    const user = userEvent.setup();
    const animalId = "30000000-0000-4000-8000-000000000001";
    const societyId = "40000000-0000-4000-8000-000000000001";
    const animal = { id: animalId, fazenda_id: farm, identificacao: "EXISTENTE", status: "ativo", lote_id: null, deleted_at: null } as Animal;
    await db.state_animais.add(animal);
    await db.state_sociedades_pecuarias.add({
      id: societyId, fazenda_id: farm, nome: "Sociedade existente", status: "ativa",
      percentual_fazenda: 50, percentual_parceiro: 50, deleted_at: null,
    } as SociedadePecuaria);
    render(<RegistrarSociedadeSection selectedAnimalIds={[animalId]} contrapartes={[]} fazendaId={farm} />);
    await user.click(screen.getByRole("button", { name: /Vincular Existente/ }));
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Sociedade existente/ }));
    await user.click(screen.getByRole("button", { name: /Vincular 1 Animais à Sociedade/ }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("1 animais vinculados com sucesso!"));
    expect(await db.state_sociedade_animais.toArray()).toEqual([
      expect.objectContaining({ animal_id: animalId, sociedade_id: societyId, payload: { tipo_acao: "vinculo_existente", physicalEntry: false } }),
    ]);
    expect(await db.state_animais.get(animalId)).toEqual(animal);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_pesagem.count()).toBe(0);
    expect(await loadAnimalAcquisitionHistory(farm, animalId)).toEqual([]);
    expect((await db.queue_ops.toArray()).map((op) => op.table)).toEqual(["sociedade_animais"]);
  });

  it.each([[[0]], [[320, 0]]])(
    "rejeita peso zero em %j antes de persistir qualquer parte da entrada",
    async (weights) => {
      await fill(weights);
      expect(window.alert).toHaveBeenCalled();
      expect(window.alert).not.toHaveBeenCalledWith(
        "Entrada em sociedade registrada com sucesso!",
      );
      expect(await db.state_animais.count()).toBe(0);
      expect(await db.queue_ops.count()).toBe(0);
    },
  );
});
