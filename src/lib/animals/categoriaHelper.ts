// src/lib/animals/categoriaHelper.ts

import { resolveAnimalClassificationSnapshot } from "./classificationSnapshot";

export interface CategoriaInput {
  categoria_zootecnica?: string | null;
  sexo?: string | null;
  data_nascimento?: string | null;
  payload?: {
    taxonomy_facts?: {
      categoria?: string | null;
      categoria_zootecnica?: string | null;
      [key: string]: unknown;
    } | null;
    lifecycle?: {
      categoria?: string | null;
      stage?: string | null;
      estagio_vida?: string | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

/**
 * @deprecated Use resolveAnimalClassificationSnapshot() from "@/lib/animals/classificationSnapshot" instead.
 * 
 * Pure legacy helper to extract the current zootecnic category of an animal.
 * Left in place for backward visual compatibility, but MUST NOT be used for KPIs, metrics, or protocols.
 */
export function getCategoriaAtual(animal: CategoriaInput | null | undefined): string {
  if (!animal) {
    return "Categoria desconhecida";
  }

  // 1. Try resolving using the new classification snapshot first to ensure high-fidelity KPIs aren't broken
  try {
    const snap = resolveAnimalClassificationSnapshot({
      sexo: animal.sexo,
      data_nascimento: animal.data_nascimento,
      payload: animal.payload as Record<string, unknown>,
    });
    if (snap.categoriaZootecnica !== "desconhecida") {
      return snap.display.categoriaZootecnica;
    }
  } catch {
    // Fallback safely to legacy logic if new snapshot fails or runs in a context with missing data
  }

  // 2. Direct field
  if (typeof animal.categoria_zootecnica === "string" && animal.categoria_zootecnica.trim()) {
    return formatCategoryLabel(animal.categoria_zootecnica);
  }

  // 3. Fallback to payload.taxonomy_facts
  const taxonomyFacts = animal.payload?.taxonomy_facts;
  if (taxonomyFacts) {
    if (typeof taxonomyFacts.categoria === "string" && taxonomyFacts.categoria.trim()) {
      return formatCategoryLabel(taxonomyFacts.categoria);
    }
    if (typeof taxonomyFacts.categoria_zootecnica === "string" && taxonomyFacts.categoria_zootecnica.trim()) {
      return formatCategoryLabel(taxonomyFacts.categoria_zootecnica);
    }
  }

  // 4. Fallback to payload.lifecycle
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

