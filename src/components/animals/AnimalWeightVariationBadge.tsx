import { Badge } from "@/components/ui/badge";
import type { FarmWeightUnit } from "@/lib/farms/measurementConfig";
import { formatWeight } from "@/lib/format/weight";

type AnimalWeightVariationBadgeProps = {
  variationKg: number | null | undefined;
  weightUnit: FarmWeightUnit;
};

export function AnimalWeightVariationBadge({
  variationKg,
  weightUnit,
}: AnimalWeightVariationBadgeProps) {
  if (variationKg == null) return null;

  return (
    <Badge
      variant="outline"
      className={
        variationKg > 0
          ? "border-success/30 bg-success-muted text-foreground"
          : variationKg < 0
            ? "border-warning/30 bg-warning-muted text-foreground"
            : "border-border bg-muted text-muted-foreground"
      }
    >
      {variationKg > 0 ? "+" : variationKg < 0 ? "−" : ""}
      {formatWeight(Math.abs(variationKg), weightUnit)}
      {variationKg > 0
        ? " · ganho"
        : variationKg < 0
          ? " · perda"
          : " · sem variação"}
    </Badge>
  );
}
