import { Activity, ArrowUpRight, Baby, Shield, Scale } from "lucide-react";

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

function getCategoryIcon(role: ReturnType<typeof getAnimalVisualProfile>["role"]) {
  switch (role) {
    case "bezerra":
    case "bezerro":
      return Baby;
    case "novilha":
    case "garrote":
      return ArrowUpRight;
    case "vaca":
      return Activity;
    case "touro":
      return Shield;
    case "boi":
    default:
      return Scale;
  }
}

function getDotClassName(role: ReturnType<typeof getAnimalVisualProfile>["role"]) {
  switch (role) {
    case "bezerra":
    case "novilha":
    case "vaca":
      return "text-rose-600";
    case "bezerro":
    case "garrote":
    case "touro":
      return "text-sky-600";
    case "boi":
    default:
      return "text-amber-600";
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
  const Icon = getCategoryIcon(profile.role);

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto gap-2 border-border bg-background px-2.5 py-1.5 text-foreground shadow-sm",
        profile.toneClassName,
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          getDotClassName(profile.role),
        )}
      />
      <span className="font-bold">{profile.label}</span>
      <span className="text-[11px] font-semibold text-muted-foreground border-l border-border pl-2">
        {descriptor}
      </span>
    </Badge>
  );
}
