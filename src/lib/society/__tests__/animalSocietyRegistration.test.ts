/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { OperationInput, SociedadePecuaria } from "@/lib/offline/types";
import { buildAnimalSocietyRegistrationOps } from "../animalSocietyRegistration";

const farmId = "00000000-0000-4000-8000-000000000001";
const animalId = "00000000-0000-4000-8000-000000000002";
const societyId = "00000000-0000-4000-8000-000000000003";
const linkId = "00000000-0000-4000-8000-000000000004";
const now = "2026-08-22T12:00:00.000Z";

function animalOperation(): OperationInput {
  return {
    table: "animais",
    action: "INSERT",
    record: {
      id: animalId,
      fazenda_id: farmId,
      identificacao: "SOC-001",
      sexo: "F",
      status: "ativo",
      origem: "sociedade",
      lote_id: null,
      payload: {},
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
  };
}

function activeSociety(
  overrides: Partial<SociedadePecuaria> = {},
): SociedadePecuaria {
  return {
    id: societyId,
    fazenda_id: farmId,
    contraparte_id: "00000000-0000-4000-8000-000000000005",
    nome: "Sociedade existente",
    status: "ativa",
    data_inicio: "2026-08-20",
    data_fim: null,
    percentual_fazenda: 50,
    percentual_parceiro: 50,
    regra_custos: "proporcional",
    regra_perdas: "proporcional",
    regra_receita: "proporcional",
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "society-op-1",
    client_tx_id: null,
    client_recorded_at: now,
    deleted_at: null,
    ...overrides,
  };
}

function buildNew(role: "owner" | "manager" | "cowboy") {
  return buildAnimalSocietyRegistrationOps({
    role,
    fazendaId: farmId,
    animalId,
    animalOperation: animalOperation(),
    linkId,
    dataEntrada: "2026-08-20",
    now,
    society: {
      kind: "new",
      id: societyId,
      contraparteId: "00000000-0000-4000-8000-000000000005",
      nome: "Nova parceria",
      percentualFazenda: 60,
    },
  });
}

async function clearSocietyStores() {
  await db.transaction(
    "rw",
    db.state_animais,
    db.state_sociedades_pecuarias,
    db.state_sociedade_animais,
    db.queue_ops,
    db.queue_gestures,
    async () => {
      await Promise.all([
        db.state_animais.clear(),
        db.state_sociedades_pecuarias.clear(),
        db.state_sociedade_animais.clear(),
        db.queue_ops.clear(),
        db.queue_gestures.clear(),
      ]);
    },
  );
}

describe("cadastro de animal societário", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearSocietyStores();
  });

  afterEach(async () => {
    await clearSocietyStores();
  });

  it.each(["owner", "manager"] as const)(
    "%s cria sociedade, animal e vínculo no contrato vigente",
    (role) => {
      const ops = buildNew(role);

      expect(ops.map((op) => op.table)).toEqual([
        "sociedades_pecuarias",
        "animais",
        "sociedade_animais",
      ]);
      expect(ops[0]?.record).toMatchObject({
        fazenda_id: farmId,
        percentual_fazenda: 60,
        percentual_parceiro: 40,
      });
      expect(ops[2]?.record).toMatchObject({
        fazenda_id: farmId,
        sociedade_id: societyId,
        animal_id: animalId,
        status: "ativo",
      });
      expect(ops.some((op) => op.table === "animais_sociedade")).toBe(false);
    },
  );

  it("bloqueia role incompatível antes de produzir operações persistíveis", () => {
    expect(() => buildNew("cowboy")).toThrow("SOCIETY_WRITE_FORBIDDEN");
  });

  it("bloqueia qualquer nova gesture no contrato legado", async () => {
    await expect(
      createGesture(farmId, [
        {
          table: "animais_sociedade",
          action: "INSERT",
          record: { id: linkId, fazenda_id: farmId },
        },
      ]),
    ).rejects.toThrow("LEGACY_SOCIETY_WRITE_BLOCKED");

    expect(await db.queue_gestures.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("reutiliza sociedade ativa existente sem duplicá-la", () => {
    const ops = buildAnimalSocietyRegistrationOps({
      role: "manager",
      fazendaId: farmId,
      animalId,
      animalOperation: animalOperation(),
      linkId,
      dataEntrada: "2026-08-20",
      now,
      society: { kind: "existing", society: activeSociety() },
    });

    expect(ops.map((op) => op.table)).toEqual(["animais", "sociedade_animais"]);
    expect(ops[1]?.record.sociedade_id).toBe(societyId);
  });

  it("recusa sociedade de outra fazenda antes da gesture", () => {
    expect(() =>
      buildAnimalSocietyRegistrationOps({
        role: "owner",
        fazendaId: farmId,
        animalId,
        animalOperation: animalOperation(),
        linkId,
        dataEntrada: "2026-08-20",
        now,
        society: {
          kind: "existing",
          society: activeSociety({ fazenda_id: "farm-other" }),
        },
      }),
    ).toThrow("SOCIETY_NOT_ACTIVE_IN_FARM");
  });

  it("retry com a mesma identidade não duplica sociedade, animal ou vínculo", async () => {
    const ops = buildNew("owner");
    const options = {
      clientTxId: "society-tx-1",
      clientOpIds: ["society-op-1", "animal-op-1", "link-op-1"],
    };

    await createGesture(farmId, ops, options);
    await createGesture(farmId, ops, options);

    expect(await db.queue_gestures.count()).toBe(1);
    expect(await db.queue_ops.count()).toBe(3);
    expect(await db.state_sociedades_pecuarias.count()).toBe(1);
    expect(await db.state_animais.count()).toBe(1);
    expect(await db.state_sociedade_animais.count()).toBe(1);
  });

  it("falha local entre animal e vínculo faz rollback da gesture inteira", async () => {
    const ops = buildNew("owner");
    delete ops[2]?.record.id;

    await expect(createGesture(farmId, ops)).rejects.toBeDefined();

    expect(await db.queue_gestures.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.state_sociedades_pecuarias.count()).toBe(0);
    expect(await db.state_animais.count()).toBe(0);
    expect(await db.state_sociedade_animais.count()).toBe(0);
  });
});
