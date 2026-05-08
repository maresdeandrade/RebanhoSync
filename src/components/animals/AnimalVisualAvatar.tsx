import {
  resolveAnimalVisualDescriptor,
  type SafeAnimalVisualProfile,
} from "@/components/animals/animalVisualProfile";
import { cn } from "@/lib/utils";

function AnimalLineArt({
  profile,
  className,
}: {
  profile: SafeAnimalVisualProfile;
  className?: string;
}) {
  const isCalf = profile === "bezerro";
  const isBull = profile === "touro";
  const isFinished = profile === "boi";
  const hasCalf = profile === "vaca-parida";

  return (
    <svg
      viewBox="0 0 120 78"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path
        d={
          isCalf
            ? "M28 42c8-16 38-17 54-5 6 4 10 4 15 2"
            : isFinished
              ? "M18 39c8-23 58-24 80-8 6 4 10 5 15 2"
              : "M18 42c9-20 55-22 78-7 6 4 10 5 15 2"
        }
      />
      <path d={isCalf ? "M30 42c-2 8-1 17 5 22h47c7-5 9-14 7-22" : "M20 43c-2 10 0 22 8 28h58c10-6 14-19 11-32"} />
      <path d="M96 34c7-6 15-6 20 1" />
      <path d="M111 33l5-7" />
      <path d="M108 32l-2-8" />
      {isBull ? <path d="M64 21c5-8 14-9 20-1" /> : null}
      {isFinished ? <path d="M42 33c9-7 25-8 40-1" /> : null}
      <path d="M35 68v-14" />
      <path d="M51 69v-13" />
      <path d="M82 69v-14" />
      <path d="M95 67v-13" />
      <path d="M22 45c-9 6-11 15-7 22" />
      {hasCalf ? (
        <>
          <path d="M31 62c6-8 21-9 30-3" />
          <path d="M33 62c-1 4 0 8 3 10h21c3-2 4-6 3-10" />
          <path d="M59 59c4-3 9-3 12 1" />
          <path d="M39 71v-7" />
          <path d="M54 71v-7" />
        </>
      ) : null}
      {profile === "generic" ? (
        <>
          <path d="M48 38c2-4 5-6 8-6s6 2 8 6" />
          <path d="M43 46c3-2 7-2 10 1" />
          <path d="M67 47c3-3 7-3 10-1" />
          <path d="M53 54c3 3 7 4 11 4s8-1 11-4" />
        </>
      ) : null}
    </svg>
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
  const sexLabel = sexo === "F" ? "F" : sexo === "M" ? "M" : null;

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl border",
        descriptor.frameClassName,
        size === "sm" && "h-16 w-20",
        size === "md" && "h-24 w-28",
        size === "lg" && "h-32 w-36",
        className,
      )}
      aria-label={`Representacao visual: ${descriptor.label}`}
      title={descriptor.label}
    >
      {sexLabel ? (
        <span
          className={cn(
            "absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full border border-current/25 bg-background/80 text-[11px] font-bold",
            descriptor.sexToneClassName,
          )}
        >
          {sexLabel}
        </span>
      ) : null}
      <AnimalLineArt
        profile={descriptor.profile}
        className={cn(
          "drop-shadow-sm",
          size === "sm" && "h-11 w-16",
          size === "md" && "h-16 w-24",
          size === "lg" && "h-20 w-32",
        )}
      />
    </div>
  );
}
