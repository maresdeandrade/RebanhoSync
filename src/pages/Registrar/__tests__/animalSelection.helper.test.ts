import { describe, expect, it } from "vitest";
import {
  filterRegistrarAnimalsBySearch,
  resolveSelectedVisibleCount,
} from "@/pages/Registrar/helpers/animalSelection";

describe("filterRegistrarAnimalsBySearch", () => {
  const animals = [
    {
      id: "a-1",
      identificacao: "MTR-001",
      nome: "Estrela",
      rfid: "rfid-1",
      sexo: "F" as const,
    },
    {
      id: "a-2",
      identificacao: "TOR-010",
      nome: "Atlas",
      rfid: "rfid-2",
      sexo: "M" as const,
    },
  ];

  it("retorna base completa quando busca está vazia", () => {
    const filtered = filterRegistrarAnimalsBySearch({
      animals,
      search: "   ",
    });

    expect(filtered).toEqual(animals);
  });

  it("filtra por termos normalizados de identificação/nome/sexo", () => {
    const byName = filterRegistrarAnimalsBySearch({
      animals,
      search: "estrela",
    });
    const bySex = filterRegistrarAnimalsBySearch({
      animals,
      search: "macho",
    });

    expect(byName.map((item) => item.id)).toEqual(["a-1"]);
    expect(bySex.map((item) => item.id)).toEqual(["a-2"]);
  });
});

describe("resolveSelectedVisibleCount", () => {
  it("conta somente selecionados que continuam visíveis no recorte", () => {
    const count = resolveSelectedVisibleCount({
      selectedAnimalIds: ["a-1", "a-2", "a-3"],
      visibleAnimalIds: ["a-2", "a-4"],
    });

    expect(count).toBe(1);
  });
});
