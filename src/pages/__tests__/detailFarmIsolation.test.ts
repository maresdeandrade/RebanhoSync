/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";
import type { Animal, Lote, Pasto } from "@/lib/offline/types";
import {
  readAnimalInActiveFarm,
  readLoteInActiveFarm,
  readPastoInActiveFarm,
} from "@/pages/detailFarmIsolation";

const FARM_A = "farm-a";
const FARM_B = "farm-b";

function animal(id: string, fazendaId: string): Animal {
  return {
    id,
    fazenda_id: fazendaId,
    identificacao: id,
    status: "ativo",
  } as Animal;
}

function lote(id: string, fazendaId: string): Lote {
  return {
    id,
    fazenda_id: fazendaId,
    nome: id,
    status: "ativo",
  } as Lote;
}

function pasto(id: string, fazendaId: string): Pasto {
  return {
    id,
    fazenda_id: fazendaId,
    nome: id,
  } as Pasto;
}

describe("isolamento local das telas de detalhe por fazenda", () => {
  beforeEach(async () => {
    db.close();
    await db.delete();
    await db.open();

    await db.state_animais.bulkAdd([
      animal("animal-a", FARM_A),
      animal("animal-b", FARM_B),
    ]);
    await db.state_lotes.bulkAdd([
      lote("lote-a", FARM_A),
      lote("lote-b", FARM_B),
    ]);
    await db.state_pastos.bulkAdd([
      pasto("pasto-a", FARM_A),
      pasto("pasto-b", FARM_B),
    ]);
  });

  afterAll(async () => {
    db.close();
    await db.delete();
  });

  it("nao devolve animal de outra fazenda pelo id", async () => {
    await expect(readAnimalInActiveFarm("animal-b", FARM_A)).resolves.toBeNull();
    await expect(readAnimalInActiveFarm("animal-a", FARM_A)).resolves.toMatchObject({
      id: "animal-a",
      fazenda_id: FARM_A,
    });
  });

  it("nao devolve lote de outra fazenda pelo id", async () => {
    await expect(readLoteInActiveFarm("lote-b", FARM_A)).resolves.toBeNull();
    await expect(readLoteInActiveFarm("lote-a", FARM_A)).resolves.toMatchObject({
      id: "lote-a",
      fazenda_id: FARM_A,
    });
  });

  it("nao devolve pasto de outra fazenda pelo id", async () => {
    await expect(readPastoInActiveFarm("pasto-b", FARM_A)).resolves.toBeNull();
    await expect(readPastoInActiveFarm("pasto-a", FARM_A)).resolves.toMatchObject({
      id: "pasto-a",
      fazenda_id: FARM_A,
    });
  });

  it("reavalia o mesmo id quando activeFarmId troca", async () => {
    await expect(readAnimalInActiveFarm("animal-b", FARM_A)).resolves.toBeNull();
    await expect(readAnimalInActiveFarm("animal-b", FARM_B)).resolves.toMatchObject({
      id: "animal-b",
      fazenda_id: FARM_B,
    });
    await expect(readAnimalInActiveFarm("animal-b", FARM_A)).resolves.toBeNull();
  });

  it("mantem a URL cruzada bloqueada apos reload do Dexie", async () => {
    await expect(readPastoInActiveFarm("pasto-b", FARM_A)).resolves.toBeNull();

    db.close();
    await db.open();

    await expect(readPastoInActiveFarm("pasto-b", FARM_A)).resolves.toBeNull();
  });
});
