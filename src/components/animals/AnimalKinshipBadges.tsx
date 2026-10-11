import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import type { Animal } from "@/lib/offline/types";

type AnimalKinshipBadgesProps = {
  mother?: Animal | null;
  father?: Animal | null;
  motherId?: string | null;
  fatherId?: string | null;
  calves?: Animal[];
  loading?: boolean;
  expandAdditionalCalves?: boolean;
};

function getKinshipPlaceholder({
  mother,
  father,
  motherId,
  fatherId,
  calves,
  loading,
}: AnimalKinshipBadgesProps) {
  const parents = [
    { id: motherId, animal: mother },
    { id: fatherId, animal: father },
  ];
  if (loading || parents.some(({ id, animal }) => id && animal === undefined)) {
    return { message: "Carregando vínculos familiares…", loading: true };
  }

  if ([mother, father, calves?.length].some(Boolean)) return null;
  if (parents.some(({ id }) => Boolean(id))) {
    return {
      message: "Vínculo genealógico cadastrado indisponível.",
      loading: false,
    };
  }
  if (parents.every(({ id }) => id === null) && calves !== undefined) {
    return { message: "Sem vínculo genealógico cadastrado.", loading: false };
  }
  return {
    message: "Nenhum vínculo genealógico disponível para exibição.",
    loading: false,
  };
}

export function AnimalKinshipBadges({
  mother,
  father,
  motherId,
  fatherId,
  calves,
  loading = false,
  expandAdditionalCalves = false,
}: AnimalKinshipBadgesProps) {
  const visibleCalves = (calves ?? []).slice(0, 2);
  const additionalCalves = (calves ?? []).slice(visibleCalves.length);
  const remainingCalves = additionalCalves.length;
  const placeholder = getKinshipPlaceholder({
    mother,
    father,
    motherId,
    fatherId,
    calves,
    loading,
  });

  if (placeholder) {
    return (
      <span
        role={placeholder.loading ? "status" : undefined}
        className="text-xs text-muted-foreground"
      >
        {placeholder.message}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {mother ? (
        <Link to={`/animais/${mother.id}`}>
          <Badge
            variant="outline"
            className="border-border/70 bg-rose-50/70 text-foreground dark:bg-rose-950/40"
          >
            Matriz {mother.identificacao}
          </Badge>
        </Link>
      ) : null}

      {father ? (
        <Link to={`/animais/${father.id}`}>
          <Badge
            variant="outline"
            className="border-border/70 bg-sky-50/70 text-foreground dark:bg-sky-950/40"
          >
            Pai {father.identificacao}
          </Badge>
        </Link>
      ) : null}

      {visibleCalves.map((calf) => (
        <Link key={calf.id} to={`/animais/${calf.id}`}>
          <Badge
            variant="outline"
            className="border-border/70 bg-sky-50/70 text-foreground dark:bg-sky-950/40"
          >
            Cria {calf.identificacao}
          </Badge>
        </Link>
      ))}

      {remainingCalves > 0 && expandAdditionalCalves ? (
        <details className="basis-full">
          <summary className="w-fit cursor-pointer rounded-md text-xs font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            Ver +{remainingCalves} cria(s)
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {additionalCalves.map((calf) => (
              <Link key={calf.id} to={`/animais/${calf.id}`}>
                <Badge
                  variant="outline"
                  className="border-border/70 bg-sky-50/70 text-foreground dark:bg-sky-950/40"
                >
                  Cria {calf.identificacao}
                </Badge>
              </Link>
            ))}
          </div>
        </details>
      ) : remainingCalves > 0 ? (
        <Badge variant="outline" className="border-border/70 bg-background/80">
          +{remainingCalves} cria(s)
        </Badge>
      ) : null}
    </div>
  );
}
