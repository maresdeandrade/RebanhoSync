import {
  resolveAnimalVisualDescriptor,
  type SafeAnimalVisualProfile,
} from "@/components/animals/animalVisualProfile";
import { cn } from "@/lib/utils";

import bezerroSvg from "@/assets/animal-profiles/animal-profile-bezerro.svg";
import boiSvg from "@/assets/animal-profiles/animal-profile-boi-engorda.svg";
import genericoSvg from "@/assets/animal-profiles/animal-profile-generico.svg";
import novilhaSvg from "@/assets/animal-profiles/animal-profile-novilha.svg";
import touroSvg from "@/assets/animal-profiles/animal-profile-touro-reprodutor.svg";
import vacaParidaSvg from "@/assets/animal-profiles/animal-profile-vaca-parida.svg";
import vacaSecaSvg from "@/assets/animal-profiles/animal-profile-vaca-seca.svg";

function AnimalImage({
  profile,
  className,
}: {
  profile: SafeAnimalVisualProfile;
  className?: string;
}) {
  const src = {
    bezerro: bezerroSvg,
    boi: boiSvg,
    generic: genericoSvg,
    novilha: novilhaSvg,
    touro: touroSvg,
    "vaca-parida": vacaParidaSvg,
    "vaca-seca": vacaSecaSvg,
    vaca: vacaSecaSvg,
  }[profile];

  return (
    <div
      className={cn("bg-current", className)}
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
      aria-hidden="true"
    />
  );
}

export function AnimalVisualAvatar({
  categoriaLabel,
  sexo,
  size = "md",
  className,
}: {
  categoriaLabel?: string | null;
  sexo?: "M" | "F" | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const descriptor = resolveAnimalVisualDescriptor(categoriaLabel);
  const sexLabel = sexo === "F" ? "♀" : sexo === "M" ? "♂" : null;

  const sexColorClass =
    sexo === "F"
      ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-900/50"
      : sexo === "M"
        ? "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-900/50"
        : "";

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl border bg-card text-card-foreground",
        descriptor.frameClassName,
        "bg-card text-card-foreground",
        size === "sm" && "h-16 w-20",
        size === "md" && "h-24 w-28",
        size === "lg" && "h-32 w-36",
        className,
      )}
      aria-label={`Representação visual: ${descriptor.label}`}
      title={descriptor.label}
    >
      {sexLabel ? (
        <span
          className={cn(
            "absolute left-0 top-0 z-10 grid h-5 w-5 place-items-center rounded-full border opacity-100 text-[12px] font-bold leading-none shadow-sm",
            sexColorClass,
          )}
        >
          {sexLabel}
        </span>
      ) : null}
      <AnimalImage
        profile={descriptor.profile}
        className={cn(
          "object-contain drop-shadow-sm",
          "text-slate-800 dark:text-slate-200",
          size === "sm" && "h-11 w-16",
          size === "md" && "h-16 w-24",
          size === "lg" && "h-20 w-32",
        )}
      />
    </div>
  );
}
