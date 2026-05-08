import { describe, expect, it } from "vitest";

import { resolveAnimalVisualDescriptor } from "@/components/animals/animalVisualProfile";

describe("AnimalVisualAvatar", () => {
  it("usa fallback generico quando nao ha categoria confiavel", () => {
    expect(resolveAnimalVisualDescriptor(null)).toMatchObject({
      profile: "generic",
      label: "Perfil nao classificado",
    });
  });

  it("mapeia somente o rotulo recebido para o perfil visual aprovado", () => {
    expect(resolveAnimalVisualDescriptor("Novilha")).toMatchObject({
      profile: "novilha",
      label: "Novilha",
    });

    expect(resolveAnimalVisualDescriptor("Vaca Parida")).toMatchObject({
      profile: "vaca-parida",
      label: "Vaca Parida",
    });
  });
});
