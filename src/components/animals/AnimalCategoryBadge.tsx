import { Badge } from "@/components/ui/badge";
import { resolveAnimalVisualDescriptor } from "@/components/animals/animalVisualProfile";
import type { Animal } from "@/lib/offline/types";
import { cn } from "@/lib/utils";

function getCategoryDescriptor(
  profile: ReturnType<typeof resolveAnimalVisualDescriptor>["profile"],
) {
  switch (profile) {
    case "bezerro":
      return "Cria";
    case "novilha":
      return "Recria";
    case "vaca-parida":
      return "Matriz";
    case "vaca-seca":
    case "vaca":
      return "Matriz";
    case "touro":
      return "Reprodutor";
    case "boi":
      return "Engorda";
    default:
      return "Sem perfil";
  }
}

function getDotClassName(
  profile: ReturnType<typeof resolveAnimalVisualDescriptor>["profile"],
) {
  switch (profile) {
    case "novilha":
    case "vaca-parida":
    case "vaca-seca":
    case "vaca":
      return "bg-rose-500";
    case "bezerro":
    case "touro":
      return "bg-sky-500";
    case "boi":
      return "bg-amber-500";
    default:
      return "bg-muted-foreground";
  }
}

export function AnimalCategoryBadge({
  categoriaLabel,
}: {
  animal: Animal;
  categoriaLabel?: string | null;
}) {
  const visual = resolveAnimalVisualDescriptor(categoriaLabel);
  const descriptor = getCategoryDescriptor(visual.profile);

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto gap-2 px-2.5 py-1.5",
        visual.frameClassName,
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          getDotClassName(visual.profile),
        )}
      />
      <span className="font-medium">{visual.label}</span>
      <span className="text-[11px] font-medium text-current/70">
        {descriptor}
      </span>
    </Badge>
  );
}
