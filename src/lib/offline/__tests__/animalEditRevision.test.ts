/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { createGesture } from "../ops";

const farm = "30000000-0000-4000-8000-000000000001";
const animal = { id: "animal-1", fazenda_id: farm, identificacao: "BR-001", sexo: "F", status: "ativo", nome: null, payload: {} };
const edit = [{ table: "animais", action: "UPDATE" as const, record: { id: animal.id, nome: "Rascunho" } }];

describe("edição com revisão de animal recém-criado", () => {
  beforeEach(async () => {
    localStorage.clear();
    await Promise.all([db.state_animais.clear(), db.queue_ops.clear(), db.queue_gestures.clear()]);
  });

  it("não enfileira edição sem revisão e preserva o cadastro pendente", async () => {
    await createGesture(farm, [{ table: "animais", action: "INSERT", record: animal }]);
    const baseline = await db.state_animais.get(animal.id);
    await expect(createGesture(farm, edit, { animalEditBaseline: baseline })).rejects.toThrow("ANIMAL_REVISION_PENDING");
    expect((await db.state_animais.get(animal.id))?.nome).toBeNull();
    expect(await db.queue_ops.count()).toBe(1);
  });

  it("aceita revisão recebida sem mudanças de negócio e captura o CAS", async () => {
    await db.state_animais.put(animal as never);
    const baseline = await db.state_animais.get(animal.id);
    await db.state_animais.update(animal.id, { revision: 1 });
    const tx = await createGesture(farm, edit, { animalEditBaseline: baseline });
    expect((await db.queue_ops.where("client_tx_id").equals(tx).first())?.expected_revision).toBe(1);
    expect((await db.state_animais.get(animal.id))?.nome).toBe("Rascunho");
  });

  it("aceita transição de revisão zero para um sem alterar o conteúdo base", async () => {
    await db.state_animais.put({ ...animal, revision: 0 } as never);
    const baseline = await db.state_animais.get(animal.id);
    await db.state_animais.update(animal.id, { revision: 1 });
    const tx = await createGesture(farm, edit, { animalEditBaseline: baseline });
    expect((await db.queue_ops.where("client_tx_id").equals(tx).first())?.expected_revision).toBe(1);
  });

  it("não sobrescreve alteração local concorrente", async () => {
    await db.state_animais.put({ ...animal, revision: 1 } as never);
    const baseline = await db.state_animais.get(animal.id);
    await db.state_animais.update(animal.id, { nome: "Alteração concorrente" });
    await expect(createGesture(farm, edit, { animalEditBaseline: baseline })).rejects.toThrow("ANIMAL_EDIT_STALE");
    expect((await db.state_animais.get(animal.id))?.nome).toBe("Alteração concorrente");
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("não captura uma revisão remota mais recente como se fosse a da abertura", async () => {
    await db.state_animais.put({ ...animal, revision: 1 } as never);
    const baseline = await db.state_animais.get(animal.id);
    await db.state_animais.update(animal.id, { revision: 2 });
    await expect(createGesture(farm, edit, { animalEditBaseline: baseline })).rejects.toThrow("ANIMAL_EDIT_STALE");
    expect(await db.queue_ops.count()).toBe(0);
  });
});
