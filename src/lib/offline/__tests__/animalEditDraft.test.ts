/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, OfflineDB } from "../db";
import { createGesture } from "../ops";
import { draftVersions, updateDraftVersion } from "../animalEditDrafts";

const user = "user-1", farm = "farm-1", animalId = "animal-1";
const animal = { id: animalId, fazenda_id: farm, identificacao: "BR-1", sexo: "F", status: "ativo", nome: null, payload: {}, revision: 1 };
const key = [user, farm, animalId];
const draft = { user_id: user, fazenda_id: farm, animal_id: animalId, version_id: "draft-v1", baseline: animal, values: { nome: "Editado" } };

describe("rascunho local de edição animal", () => {
  beforeEach(async () => {
    localStorage.clear();
    await Promise.all([db.state_animais.clear(), db.queue_ops.clear(), db.queue_gestures.clear(), db.local_ownership.clear(), db.table("local_animal_edit_drafts_v2").clear()]);
    await db.local_ownership.put({ key: "local-session", owner_user_id: user, updated_at: "now" });
    await db.state_animais.put(animal as never);
  });

  it("preserva rascunho por usuário, fazenda e animal após reabrir o banco", async () => {
    await db.table("local_animal_edit_drafts_v2").put(draft);
    db.close(); await db.open();
    expect(await db.table("local_animal_edit_drafts_v2").get(key)).toMatchObject({ version_id: "draft-v1", values: { nome: "Editado" } });
    expect(await db.table("local_animal_edit_drafts_v2").get(["user-2", farm, animalId])).toBeUndefined();
    expect(await db.table("local_animal_edit_drafts_v2").get([user, "farm-2", animalId])).toBeUndefined();
  });

  it("associa versão exata à operação e ao gesto na mesma transação", async () => {
    await db.table("local_animal_edit_drafts_v2").put(draft);
    const tx = await createGesture(farm, [{ table: "animais", action: "UPDATE", record: { id: animalId, nome: "Editado" } }], {
      animalEditBaseline: animal as never,
      animalDraftSubmission: { userId: user, farmId: farm, animalId, versionId: "draft-v1" },
    });
    const op = await db.queue_ops.where("client_tx_id").equals(tx).first();
    expect(op?.expected_revision).toBe(1);
    expect(await db.table("local_animal_edit_drafts_v2").get(key)).toMatchObject({ submission: { version_id: "draft-v1", client_tx_id: tx, client_op_id: op?.client_op_id } });
  });

  it("aborta o gesto se a versão do rascunho tiver mudado", async () => {
    await db.table("local_animal_edit_drafts_v2").put({ ...draft, version_id: "draft-v2" });
    await expect(createGesture(farm, [{ table: "animais", action: "UPDATE", record: { id: animalId, nome: "Editado" } }], {
      animalEditBaseline: animal as never,
      animalDraftSubmission: { userId: user, farmId: farm, animalId, versionId: "draft-v1" },
    })).rejects.toThrow("ANIMAL_DRAFT_CHANGED");
    expect(await db.queue_ops.count()).toBe(0);
    expect((await db.state_animais.get(animalId))?.nome).toBeNull();
  });

  it("reverte associação se a escrita do gesto falhar", async () => {
    await db.local_animal_edit_drafts_v2.put(draft as never);
    const failure = vi.spyOn(db.queue_gestures, "add").mockRejectedValueOnce(new Error("injected"));
    try {
      await expect(createGesture(farm, [{ table: "animais", action: "UPDATE", record: { id: animalId, nome: "Editado" } }], {
        animalEditBaseline: animal as never,
        animalDraftSubmission: { userId: user, farmId: farm, animalId, versionId: "draft-v1" },
      })).rejects.toThrow("injected");
      expect(await db.local_animal_edit_drafts_v2.get([user, farm, animalId])).not.toHaveProperty("submission");
      expect(await db.queue_ops.count()).toBe(0);
    } finally { failure.mockRestore(); }
  });

  it("não enfileira quando a base muda sem mudar a versão visível", async () => {
    await db.local_animal_edit_drafts_v2.put({ ...draft, baseline: { ...animal, revision: 2 } } as never);
    await expect(createGesture(farm, [{ table: "animais", action: "UPDATE", record: { id: animalId, nome: "Editado" } }], {
      animalEditBaseline: animal as never,
      animalDraftSubmission: { userId: user, farmId: farm, animalId, versionId: "draft-v1" },
    })).rejects.toThrow("ANIMAL_DRAFT_CHANGED");
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("serializa gravações concorrentes sem substituir nenhuma intenção", async () => {
    const write = (version: string, nome: string) => db.transaction("rw", db.local_animal_edit_drafts_v2, async () => {
      const current = await db.local_animal_edit_drafts_v2.get([user, farm, animalId]);
      await db.local_animal_edit_drafts_v2.put(updateDraftVersion(current, null, { ...draft, version_id: version, values: { nome } } as never));
    });
    await Promise.all([write("v1", "A"), write("v2", "B")]);
    db.close(); await db.open();
    expect(draftVersions(await db.local_animal_edit_drafts_v2.get([user, farm, animalId])).map(item => item.values.nome).sort()).toEqual(["A", "B"]);
  });

  it("não envia conflito sem confirmar exatamente as versões existentes", async () => {
    const other = { ...draft, version_id: "draft-v2", values: { nome: "Outro" } };
    await db.local_animal_edit_drafts_v2.put({ ...draft, conflicts: [other] } as never);
    const input = [{ table: "animais", action: "UPDATE" as const, record: { id: animalId, nome: "Editado" } }];
    await expect(createGesture(farm, input, { animalEditBaseline: animal as never,
      animalDraftSubmission: { userId: user, farmId: farm, animalId, versionId: "draft-v1", confirmedVersions: ["draft-v1"] },
    })).rejects.toThrow("ANIMAL_DRAFT_CONFLICT_CHANGED");
    expect(await db.queue_ops.count()).toBe(0);
    const tx = await createGesture(farm, input, { animalEditBaseline: animal as never,
      animalDraftSubmission: { userId: user, farmId: farm, animalId, versionId: "draft-v1", confirmedVersions: ["draft-v1", "draft-v2"] },
    });
    expect((await db.queue_ops.where("client_tx_id").equals(tx).first())?.expected_revision).toBe(1);
    expect(draftVersions(await db.local_animal_edit_drafts_v2.get([user, farm, animalId])).map(item => item.values.nome)).toEqual(["Editado", "Outro"]);
  });

  it("acrescenta a store ao banco versão 37 sem apagar animais ou fila", async () => {
    const name = `draft-upgrade-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(37).stores({ state_animais: "id, fazenda_id", queue_ops: "client_op_id, client_tx_id" });
    await old.table("state_animais").put(animal);
    await old.table("queue_ops").put({ client_op_id: "pending", client_tx_id: "tx" });
    old.close();
    const upgraded = new OfflineDB(name);
    await upgraded.open();
    expect(await upgraded.state_animais.get(animalId)).toMatchObject({ identificacao: "BR-1" });
    expect(await upgraded.queue_ops.get("pending")).toMatchObject({ client_tx_id: "tx" });
    expect(await upgraded.local_animal_edit_drafts_v2.count()).toBe(0);
    await upgraded.delete();
  });

  it("migra v38 sem perder rascunho e impede gravação do escritor antigo", async () => {
    const name = `draft-upgrade-v38-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(38).stores({ local_animal_edit_drafts: "[user_id+fazenda_id+animal_id], fazenda_id, submission.client_tx_id" });
    const legacy = { ...draft, submission: { version_id: "draft-v1", client_tx_id: "tx", client_op_id: "op" },
      conflicts: [{ ...draft, version_id: "draft-v2", values: { nome: "Outra edição" } }] };
    await old.table("local_animal_edit_drafts").put(legacy);
    old.close();
    const upgraded = new OfflineDB(name);
    await upgraded.open();
    expect(await upgraded.local_animal_edit_drafts_v2.get([user, farm, animalId])).toMatchObject(legacy);
    upgraded.close();
    await old.open();
    let oldWriteDenied = false;
    try { await old.table("local_animal_edit_drafts").put(draft); }
    catch { oldWriteDenied = true; }
    expect(oldWriteDenied).toBe(true);
    old.close();
    await upgraded.open();
    expect(await upgraded.local_animal_edit_drafts_v2.get([user, farm, animalId])).toMatchObject(legacy);
    upgraded.close();
    await Dexie.delete(name);
  });
});
