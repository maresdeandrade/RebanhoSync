import { Droplets, Scale } from "lucide-react";

import { AnimalHeadIcon } from "@/components/animals/AnimalHeadIcon";
import { Badge } from "@/components/ui/badge";
import type { Animal } from "@/lib/offline/types";
import { getAnimalVisualProfile } from "@/lib/animals/presentation";
import { cn } from "@/lib/utils";

export function AnimalCategoryBadge({
  animal,
  categoriaLabel,
}: {
  animal: Animal;
  categoriaLabel?: string | null;
}) {
  const profile = getAnimalVisualProfile(animal, categoriaLabel);
  const modifierLabel =
    profile.modifier === "female"
      ? "F"
      : profile.modifier === "male"
        ? "M"
        : null;
  const ModifierIcon =
    profile.modifier === "maternal"
      ? Droplets
      : profile.modifier === "weight"
        ? Scale
        : null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-2 border-border/70 bg-background/80 py-1 pl-1.5 pr-2 text-foreground",
        profile.toneClassName,
      )}
    >
      <span
        className={cn(
          "relative inline-flex items-center justify-center rounded-full bg-white/85 ring-1 ring-black/5",
          profile.frameClassName,
        )}
      >
        <AnimalHeadIcon className={cn("text-current", profile.headClassName)} />
        <span className="absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-background bg-white text-[10px] font-bold leading-none">
          {ModifierIcon ? (
            <ModifierIcon className="h-2.5 w-2.5 text-current" />
          ) : (
            modifierLabel
          )}
        </span>
      </span>
      {profile.label}
    </Badge>
  );
}
