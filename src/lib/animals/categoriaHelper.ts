// src/lib/animals/categoriaHelper.ts

export interface CategoriaInput {
  categoria_zootecnica?: string | null;
  payload?: {
    taxonomy_facts?: {
      categoria?: string | null;
      categoria_zootecnica?: string | null;
      [key: string]: unknown;
    } | null;
    lifecycle?: {
      categoria?: string | null;
      stage?: string | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

/**
 * Pure helper to extract the current zootecnic category of an animal.
 * Strictly respects the hierarchy:
 * 1. Direct field (categoria_zootecnica)
 * 2. Fallback to payload.taxonomy_facts.categoria or payload.taxonomy_facts.categoria_zootecnica
 * 3. Fallback to payload.lifecycle.categoria or payload.lifecycle.stage
 * 4. Default: "Categoria desconhecida"
 */
export function getCategoriaAtual(animal: CategoriaInput | null | undefined): string {
  if (!animal) {
    return "Categoria desconhecida";
  }

  // 1. Direct field
  if (typeof animal.categoria_zootecnica === "string" && animal.categoria_zootecnica.trim()) {
    return formatCategoryLabel(animal.categoria_zootecnica);
  }

  // 2. Fallback to payload.taxonomy_facts
  const taxonomyFacts = animal.payload?.taxonomy_facts;
  if (taxonomyFacts) {
    if (typeof taxonomyFacts.categoria === "string" && taxonomyFacts.categoria.trim()) {
      return formatCategoryLabel(taxonomyFacts.categoria);
    }
    if (typeof taxonomyFacts.categoria_zootecnica === "string" && taxonomyFacts.categoria_zootecnica.trim()) {
      return formatCategoryLabel(taxonomyFacts.categoria_zootecnica);
    }
  }

  // 3. Fallback to payload.lifecycle
  const lifecycle = animal.payload?.lifecycle;
  if (lifecycle) {
    if (typeof lifecycle.categoria === "string" && lifecycle.categoria.trim()) {
      return formatCategoryLabel(lifecycle.categoria);
    }
    if (typeof lifecycle.stage === "string" && lifecycle.stage.trim()) {
      return formatCategoryLabel(lifecycle.stage);
    }
  }

  return "Categoria desconhecida";
}

/**
 * Clean category label from snake_case or legacy tags.
 */
function formatCategoryLabel(label: string): string {
  const clean = label.trim();
  if (clean === "categoria_desconhecida" || clean === "desconhecida") {
    return "Categoria desconhecida";
  }
  
  // Convert snake_case to Space separated
  return clean
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
