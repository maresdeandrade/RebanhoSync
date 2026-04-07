import { Badge } from "@/components/ui/badge";
import type { Animal } from "@/lib/offline/types";
import { getAnimalVisualProfile } from "@/lib/animals/presentation";
import { cn } from "@/lib/utils";

function getCategoryDescriptor(role: ReturnType<typeof getAnimalVisualProfile>["role"]) {
  switch (role) {
    case "bezerra":
      return "Cria";
    case "bezerro":
      return "Cria";
    case "novilha":
      return "Recria";
    case "garrote":
      return "Recria";
    case "vaca":
      return "Matriz";
    case "touro":
      return "Reprodutor";
    case "boi":
    default:
      return "Terminacao";
  }
}

function getDotClassName(role: ReturnType<typeof getAnimalVisualProfile>["role"]) {
  switch (role) {
    case "bezerra":
    case "novilha":
    case "vaca":
      return "bg-rose-500";
    case "bezerro":
    case "garrote":
    case "touro":
      return "bg-sky-500";
    case "boi":
    default:
      return "bg-amber-500";
  }
}

export function AnimalCategoryBadge({
  animal,
  categoriaLabel,
}: {
  animal: Animal;
  categoriaLabel?: string | null;
}) {
  const profile = getAnimalVisualProfile(animal, categoriaLabel);
  const descriptor = getCategoryDescriptor(profile.role);

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto gap-2 border-border/70 bg-background/90 px-2.5 py-1.5 text-foreground",
        profile.toneClassName,
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          getDotClassName(profile.role),
        )}
      />
      <span className="font-medium">{profile.label}</span>
      <span className="text-[11px] font-medium text-current/70">
        {descriptor}
      </span>
    </Badge>
  );
}
