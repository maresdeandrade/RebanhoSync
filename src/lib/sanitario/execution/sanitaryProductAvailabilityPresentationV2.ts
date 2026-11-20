type ProductRequirementKindV2 =
  | "specific_product"
  | "product_class"
  | "product_class_group"
  | "none"
  | string;

export function formatMissingTechnicalProductMessageV2(
  requirementKind: ProductRequirementKindV2,
  context: "execution" | "planning",
) {
  const requirement =
    requirementKind === "product_class_group"
      ? "grupo técnico"
      : requirementKind === "product_class"
        ? "classe técnica"
        : "requisito técnico";
  const action =
    context === "execution"
      ? "O produto de uma aplicação já realizada pode ser declarado com pendência técnica; isso não comprova cumprimento do protocolo nem autoriza nova aplicação."
      : "A agenda pode continuar sem produto planejado; isso não comprova compatibilidade nem autoriza execução.";
  return `Nenhum produto com correspondência técnica verificável para este ${requirement} foi encontrado no catálogo local. A classe ampla do produto, nomes ou metadados de pesquisa não comprovam compatibilidade. ${action}`;
}
