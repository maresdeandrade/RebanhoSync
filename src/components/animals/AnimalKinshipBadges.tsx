import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import type { Animal } from "@/lib/offline/types";

export function AnimalKinshipBadges({
  mother,
  father,
  calves,
}: {
  mother?: Animal | null;
  father?: Animal | null;
  calves?: Animal[];
}) {
  const visibleCalves = (calves ?? []).slice(0, 2);
  const remainingCalves = Math.max((calves?.length ?? 0) - visibleCalves.length, 0);

  if (!mother && !father && (!calves || calves.length === 0)) {
    return <span className="text-xs text-muted-foreground">Sem vinculo</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {mother ? (
        <Link to={`/animais/${mother.id}`}>
          <Badge
            variant="outline"
            className="border-border/70 bg-rose-50/70 text-foreground"
          >
            Matriz {mother.identificacao}
          </Badge>
        </Link>
      ) : null}

      {father ? (
        <Link to={`/animais/${father.id}`}>
          <Badge
            variant="outline"
            className="border-border/70 bg-sky-50/70 text-foreground"
          >
            Pai {father.identificacao}
          </Badge>
        </Link>
      ) : null}

      {visibleCalves.map((calf) => (
        <Link key={calf.id} to={`/animais/${calf.id}`}>
          <Badge
            variant="outline"
            className="border-border/70 bg-sky-50/70 text-foreground"
          >
            Cria {calf.identificacao}
          </Badge>
        </Link>
      ))}

      {remainingCalves > 0 ? (
        <Badge variant="outline" className="border-border/70 bg-background/80">
          +{remainingCalves} cria(s)
        </Badge>
      ) : null}
    </div>
  );
}
