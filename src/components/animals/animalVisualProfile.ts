export type SafeAnimalVisualProfile =
  | "generic"
  | "bezerro"
  | "boi"
  | "novilha"
  | "touro"
  | "vaca-parida"
  | "vaca-seca"
  | "vaca";

export type AnimalVisualDescriptor = {
  profile: SafeAnimalVisualProfile;
  label: string;
  frameClassName: string;
  sexToneClassName: string;
};

function normalizeProfileLabel(value: string | null | undefined) {
  return value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase() ?? "";
}

export function resolveAnimalVisualDescriptor(
  categoriaLabel?: string | null,
): AnimalVisualDescriptor {
  const normalized = normalizeProfileLabel(categoriaLabel);

  if (!normalized) {
    return {
      profile: "generic",
      label: "Perfil nao classificado",
      frameClassName:
        "border-border/80 bg-muted/50 text-muted-foreground dark:bg-muted/30",
      sexToneClassName: "text-muted-foreground",
    };
  }

  if (
    normalized.includes("vaca parida") ||
    normalized.includes("recem parida") ||
    normalized.includes("matriz parida")
  ) {
    return {
      profile: "vaca-parida",
      label: categoriaLabel?.trim() || "Vaca parida",
      frameClassName:
        "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800/70 dark:bg-sky-950/40 dark:text-sky-100",
      sexToneClassName: "text-rose-600 dark:text-rose-300",
    };
  }

  if (normalized.includes("vaca seca") || normalized.includes("solteira")) {
    return {
      profile: "vaca-seca",
      label: categoriaLabel?.trim() || "Vaca seca",
      frameClassName:
        "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800/70 dark:bg-sky-950/40 dark:text-sky-100",
      sexToneClassName: "text-rose-600 dark:text-rose-300",
    };
  }

  // Use exact or specific boundaries to avoid "recria" matching "cria"
  if (normalized.includes("bezer") || normalized === "cria" || normalized.includes(" cria ")) {
    return {
      profile: "bezerro",
      label: categoriaLabel?.trim() || "Bezerro",
      frameClassName:
        "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800/70 dark:bg-sky-950/40 dark:text-sky-100",
      sexToneClassName: "text-current",
    };
  }

  if (normalized.includes("novilh") || normalized.includes("recria")) {
    return {
      profile: "novilha",
      label: categoriaLabel?.trim() || "Novilha",
      frameClassName:
        "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800/70 dark:bg-sky-950/40 dark:text-sky-100",
      sexToneClassName: "text-current",
    };
  }

  if (normalized.includes("touro") || normalized.includes("reprodutor")) {
    return {
      profile: "touro",
      label: categoriaLabel?.trim() || "Touro reprodutor",
      frameClassName:
        "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800/70 dark:bg-sky-950/40 dark:text-sky-100",
      sexToneClassName: "text-sky-700 dark:text-sky-300",
    };
  }

  if (normalized.includes("boi") || normalized.includes("engorda") || normalized.includes("terminacao")) {
    return {
      profile: "boi",
      label: categoriaLabel?.trim() || "Boi engorda",
      frameClassName:
        "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800/70 dark:bg-sky-950/40 dark:text-sky-100",
      sexToneClassName: "text-sky-700 dark:text-sky-300",
    };
  }

  if (normalized.includes("vaca") || normalized.includes("matriz")) {
    return {
      profile: "vaca",
      label: categoriaLabel?.trim() || "Vaca",
      frameClassName:
        "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800/70 dark:bg-sky-950/40 dark:text-sky-100",
      sexToneClassName: "text-rose-600 dark:text-rose-300",
    };
  }

  return {
    profile: "generic",
    label: categoriaLabel?.trim() || "Perfil nao classificado",
    frameClassName:
      "border-border/80 bg-muted/50 text-muted-foreground dark:bg-muted/30",
    sexToneClassName: "text-muted-foreground",
  };
}
