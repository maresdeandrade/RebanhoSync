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
        variationKg >= 0
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }
    >
      {variationKg >= 0 ? "+" : ""}
      {formatWeight(Math.abs(variationKg), weightUnit)} no periodo
    </Badge>
  );
}
