import { Link } from "react-router-dom";
import type { Animal } from "@/lib/offline/types";
import { Badge } from "@/components/ui/badge";

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
      {mother && (
        <Link to={`/animais/${mother.id}`}>
          <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-800">
            Matriz {mother.identificacao}
          </Badge>
        </Link>
      )}

      {father && (
        <Link to={`/animais/${father.id}`}>
          <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">
            Pai {father.identificacao}
          </Badge>
        </Link>
      )}

      {visibleCalves.map((calf) => (
        <Link key={calf.id} to={`/animais/${calf.id}`}>
          <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">
            Cria {calf.identificacao}
          </Badge>
        </Link>
      ))}

      {remainingCalves > 0 && (
        <Badge variant="outline">+{remainingCalves} cria(s)</Badge>
      )}
    </div>
  );
}
