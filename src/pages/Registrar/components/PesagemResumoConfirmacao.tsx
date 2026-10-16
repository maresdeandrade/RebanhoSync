type PesagemResumoConfirmacaoProps = {
  selectedAnimalIds: string[];
  animals: Array<{ id: string; identificacao: string }>;
  weights: Record<string, string>;
  unitLabel: string;
};

export function PesagemResumoConfirmacao({
  selectedAnimalIds,
  animals,
  weights,
  unitLabel,
}: PesagemResumoConfirmacaoProps) {
  return (
    <ul aria-label="Pesos por animal" className="grid gap-2 text-sm">
      {selectedAnimalIds.map((animalId) => (
        <li
          key={animalId}
          className="flex flex-wrap justify-between gap-2 rounded-lg bg-background/70 px-3 py-2"
        >
          <span className="min-w-0 break-words text-muted-foreground">
            {animals.find((animal) => animal.id === animalId)?.identificacao ??
              animalId}
          </span>
          <span className="font-semibold">
            {weights[animalId]} {unitLabel}
          </span>
        </li>
      ))}
    </ul>
  );
}
