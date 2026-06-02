import { resolveAnimalClassificationSnapshot } from "@/lib/animals/classificationSnapshot";
import type { Animal } from "@/lib/offline/types";
import type { DataStatus } from "./occupancyTypes";

export interface PredominantCategoryResult {
  label: string;
  status: DataStatus;
}

type OccupancyAnimalClassificationFields = Animal & {
  categoria_zootecnica?: string | null;
  destino_produtivo?: string | null;
};

export function getPredominantCategorySnapshot(
  animals: Animal[],
  referenceDate?: string | null,
): PredominantCategoryResult {
  if (animals.length === 0) {
    return {
      label: "Categoria desconhecida",
      status: {
        status: "empty",
        reason: "Sem animais ativos para classificar",
        source: "classificationSnapshot",
      },
    };
  }

  const counts = new Map<string, number>();
  const sources = new Set<string>();
  const limitations = new Set<string>();
  let knownCount = 0;

  for (const animal of animals) {
    const classifiedAnimal = animal as OccupancyAnimalClassificationFields;
    const snapshot = resolveAnimalClassificationSnapshot(
      {
        categoria_zootecnica: classifiedAnimal.categoria_zootecnica,
        sexo: classifiedAnimal.sexo,
        data_nascimento: classifiedAnimal.data_nascimento,
        papel_macho: classifiedAnimal.papel_macho,
        habilitado_monta: classifiedAnimal.habilitado_monta,
        destino_produtivo: classifiedAnimal.destino_produtivo,
        payload: classifiedAnimal.payload,
      },
      { referenceDate },
    );

    const label = snapshot.display.categoriaZootecnica;
    if (snapshot.categoriaZootecnica !== "desconhecida") {
      knownCount++;
    }
    sources.add(snapshot.source);
    snapshot.limitations.forEach((limitation) => limitations.add(limitation));
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  let label = "Categoria desconhecida";
  let max = 0;
  for (const [categoryLabel, count] of counts.entries()) {
    if (count > max) {
      max = count;
      label = categoryLabel;
    }
  }

  const status: DataStatus =
    knownCount === 0
      ? {
          status: "empty",
          reason: "Classificacao operacional ausente",
          source: "classificationSnapshot",
          limitation: Array.from(limitations).join("; ") || "Sem fonte suficiente para classificar",
        }
      : knownCount < animals.length || limitations.size > 0
        ? {
            status: "partial",
            reason: `${knownCount} de ${animals.length} animais com categoria resolvida`,
            source: `classificationSnapshot:${Array.from(sources).sort().join("+")}`,
            limitation: Array.from(limitations).join("; ") || "Parte da classificacao foi inferida",
          }
        : {
            status: "complete",
            reason: "Categoria operacional resolvida para todos os animais ativos",
            source: `classificationSnapshot:${Array.from(sources).sort().join("+")}`,
          };

  return { label, status };
}
