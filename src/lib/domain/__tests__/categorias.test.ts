import { describe, it, expect } from "vitest";
import { classificarAnimal, CATEGORIAS_PADRAO } from "../categorias";
import { Animal, CategoriaZootecnica, SexoEnum, PapelMachoEnum } from "@/lib/offline/types";
import { subDays } from "date-fns";

const createAnimal = (
  sexo: SexoEnum,
  dias: number,
  papel_macho: PapelMachoEnum | null = null,
  habilitado_monta: boolean = false
): Animal => {
  return {
    id: "1",
    data_nascimento: subDays(new Date(), dias).toISOString(),
    sexo,
    papel_macho,
    habilitado_monta,
    fazenda_id: "fazenda1",
    identificacao: "123",
    status: "ativo",
    lote_id: null,
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    origem: null,
    raca: null,
    observacoes: null,
    payload: {},
    client_id: "client1",
    client_op_id: "op1",
    client_tx_id: null,
    client_recorded_at: new Date().toISOString(),
    server_received_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
};

const categorias = CATEGORIAS_PADRAO.map((c, i) => ({
  ...c,
  id: `cat-${i}`,
  fazenda_id: "fazenda1",
  client_id: "client1",
  client_op_id: "op1",
  client_tx_id: null,
  client_recorded_at: new Date().toISOString(),
  server_received_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
})) as CategoriaZootecnica[];

describe("classificarAnimal", () => {
  it("should classify Bezerro correctly (< 240 days)", () => {
    const animal = createAnimal("M", 100);
    const result = classificarAnimal(animal, categorias);
    expect(result?.nome).toBe("Bezerro(a)");
  });

  it("should classify Garrote correctly (241-730 days)", () => {
    const animal = createAnimal("M", 400);
    const result = classificarAnimal(animal, categorias);
    expect(result?.nome).toBe("Garrote");
  });

  it("should classify standard Male > 731 days as Boi", () => {
    const animal = createAnimal("M", 800);
    // Default: papel_macho = null, habilitado_monta = false
    const result = classificarAnimal(animal, categorias);
    expect(result?.nome).toBe("Boi");
  });

  it("should classify Reprodutor + Habilitado > 731 days as Touro", () => {
    const animal = createAnimal("M", 800, "reprodutor", true);
    const result = classificarAnimal(animal, categorias);
    expect(result?.nome).toBe("Touro");
  });

  it("should classify Reprodutor + NOT Habilitado > 731 days as Boi", () => {
    const animal = createAnimal("M", 800, "reprodutor", false);
    const result = classificarAnimal(animal, categorias);
    expect(result?.nome).toBe("Boi");
  });

  it("should classify Rufiao + Habilitado > 731 days as Boi", () => {
    const animal = createAnimal("M", 800, "rufiao", true);
    const result = classificarAnimal(animal, categorias);
    expect(result?.nome).toBe("Boi");
  });

  it("should classify Female > 901 days as Vaca", () => {
    const animal = createAnimal("F", 1000);
    const result = classificarAnimal(animal, categorias);
    expect(result?.nome).toBe("Vaca");
  });
});
