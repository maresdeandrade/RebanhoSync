import { describe, expect, it } from "vitest";

import { formatMissingTechnicalProductMessageV2 } from "../sanitaryProductAvailabilityPresentationV2";

describe("sanitaryProductAvailabilityPresentationV2", () => {
  it("explica ausência de correspondência técnica na execução sem chamar de incompatibilidade comprovada", () => {
    const message = formatMissingTechnicalProductMessageV2(
      "product_class",
      "execution",
    );

    expect(message).toContain("correspondência técnica verificável");
    expect(message).toContain("classe ampla");
    expect(message).toContain("não comprovam compatibilidade");
    expect(message).toContain("aplicação já realizada pode ser declarado");
    expect(message).toContain("não comprova cumprimento do protocolo");
  });

  it("preserva que a agenda manual pode existir sem produto", () => {
    const message = formatMissingTechnicalProductMessageV2(
      "product_class_group",
      "planning",
    );

    expect(message).toContain("grupo técnico");
    expect(message).toContain("pode continuar sem produto planejado");
    expect(message).not.toContain("serão oferecidos para execução");
  });
});
