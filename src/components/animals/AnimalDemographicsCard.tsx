import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AnimalVisualAvatar } from "./AnimalVisualAvatar";
import { resolveAnimalVisualDescriptor, type SafeAnimalVisualProfile } from "./animalVisualProfile";
import type { Animal } from "@/lib/offline/types";
import type { AnimalTaxonomySnapshot } from "@/lib/animals/taxonomy";

interface AnimalDemographicsCardProps {
  animalRows: { animal: Animal }[];
  taxonomyByAnimal: Map<string, AnimalTaxonomySnapshot>;
  sexoFilter: string;
}

export function AnimalDemographicsCard({ animalRows, taxonomyByAnimal, sexoFilter }: AnimalDemographicsCardProps) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();

    for (const { animal } of animalRows) {
      const taxonomy = taxonomyByAnimal.get(animal.id);
      const descriptor = resolveAnimalVisualDescriptor(taxonomy?.display.categoria);
      const key = `${descriptor.profile}_${animal.sexo || "U"}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [animalRows, taxonomyByAnimal]);

  // Determine what to show based on the active filter
  const isFemale = sexoFilter === "F";
  const isMale = sexoFilter === "M";

  const getCount = (profile: string, sexo: string) => counts.get(`${profile}_${sexo}`) || 0;

  // Group profiles logically for display
  const displayGroups = [];

  if (isFemale || (!isFemale && !isMale)) {
    displayGroups.push(
      { profile: "vaca-parida", label: "Vacas Paridas", count: getCount("vaca-parida", "F"), categoriaLabel: "vaca parida", sexo: "F" as const },
      { profile: "vaca-seca", label: "Vacas Secas", count: getCount("vaca-seca", "F") + getCount("vaca", "F"), categoriaLabel: "vaca seca", sexo: "F" as const },
      { profile: "novilha", label: "Novilhas", count: getCount("novilha", "F"), categoriaLabel: "novilha", sexo: "F" as const },
      { profile: "bezerro", label: "Bezerras", count: getCount("bezerro", "F"), categoriaLabel: "bezerra", sexo: "F" as const }
    );
  }

  if (isMale || (!isFemale && !isMale)) {
    displayGroups.push(
      { profile: "touro", label: "Touros", count: getCount("touro", "M") + getCount("touro", "U"), categoriaLabel: "touro", sexo: "M" as const },
      { profile: "boi", label: "Bois", count: getCount("boi", "M") + getCount("boi", "U"), categoriaLabel: "boi", sexo: "M" as const },
      { profile: "novilha", label: "Novilhos", count: getCount("novilha", "M"), categoriaLabel: "novilho", sexo: "M" as const },
      { profile: "bezerro", label: "Bezerros", count: getCount("bezerro", "M"), categoriaLabel: "bezerro", sexo: "M" as const }
    );
  }

  // Aggregate unclassified or generic entries
  let generics = 0;
  for (const [key, val] of counts.entries()) {
    if (key.startsWith("generic_") || (key.endsWith("_U") && !key.startsWith("touro_") && !key.startsWith("boi_"))) {
      generics += val;
    }
  }

  return (
    <Card className="col-span-full border-sky-100 bg-sky-50/30 dark:border-sky-900/40 dark:bg-sky-900/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-sky-900 dark:text-sky-100">
          Perfil do Rebanho
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          {displayGroups.filter(g => g.count > 0).map((group, idx) => (
            <div 
              key={`${group.profile}-${group.sexo}-${idx}`} 
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/60 dark:bg-sky-950/40 border border-sky-100/50 dark:border-sky-900/50 shadow-sm min-w-[100px] w-[115px]"
            >
              <div className="relative mb-3 mt-1">
                <AnimalVisualAvatar
                  categoriaLabel={group.categoriaLabel}
                  sexo={group.sexo}
                  size="md"
                />
                <div className="absolute -bottom-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900 border-2 border-white dark:border-sky-950 px-1 shadow-sm">
                  <span className="text-[11px] font-bold text-sky-900 dark:text-sky-100 leading-none">
                    {group.count}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-center leading-tight tracking-wider text-slate-600 dark:text-slate-300 uppercase">
                {group.label}
              </span>
            </div>
          ))}

          {generics > 0 && (
            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/60 dark:bg-sky-950/40 border border-sky-100/50 dark:border-sky-900/50 shadow-sm min-w-[100px] w-[115px]">
              <div className="relative mb-3 mt-1">
                <AnimalVisualAvatar
                  categoriaLabel="Genérico"
                  size="md"
                  className="opacity-60 grayscale"
                />
                <div className="absolute -bottom-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900 border-2 border-white dark:border-sky-950 px-1 shadow-sm">
                  <span className="text-[11px] font-bold text-sky-900 dark:text-sky-100 leading-none">
                    {generics}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-center leading-tight tracking-wider text-slate-600 dark:text-slate-300 uppercase">
                Não Classificados
              </span>
            </div>
          )}
          
          {animalRows.length === 0 && (
            <div className="text-sm text-muted-foreground w-full text-center py-4">
              Nenhum animal listado no recorte atual.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
