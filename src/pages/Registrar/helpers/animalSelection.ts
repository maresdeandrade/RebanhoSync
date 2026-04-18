type AnimalSelectionRecord = {
  id: string;
  identificacao: string;
  nome: string | null;
  rfid: string | null;
  sexo: "M" | "F" | null;
};

type FilterRegistrarAnimalsBySearchInput = {
  animals: AnimalSelectionRecord[];
  search: string;
};

export function filterRegistrarAnimalsBySearch(
  input: FilterRegistrarAnimalsBySearchInput,
) {
  const normalizedSearch = input.search.trim().toLowerCase();
  if (!normalizedSearch) return input.animals;

  return input.animals.filter((animal) =>
    [
      animal.identificacao,
      animal.nome ?? "",
      animal.rfid ?? "",
      animal.sexo === "M" ? "macho" : "femea",
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch),
  );
}

type ResolveSelectedVisibleCountInput = {
  selectedAnimalIds: string[];
  visibleAnimalIds: string[];
};

export function resolveSelectedVisibleCount(
  input: ResolveSelectedVisibleCountInput,
) {
  return input.visibleAnimalIds.filter((id) =>
    input.selectedAnimalIds.includes(id),
  ).length;
}
