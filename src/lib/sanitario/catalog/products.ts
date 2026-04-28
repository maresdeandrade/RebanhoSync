import { db } from "@/lib/offline/db";
import type {
  ProdutoVeterinarioCatalogEntry,
  SanitarioTipoEnum,
} from "@/lib/offline/types";
import { supabase } from "@/lib/supabase";

export type VeterinaryProductOrigin =
  | "catalogo"
  | "catalogo_automatico"
  | "texto_livre";

export type VeterinaryProductMatchMode =
  | "exact"
  | "contains"
  | "token_overlap";

export interface VeterinaryProductSelection {
  id: string;
  nome: string;
  categoria: string | null;
  origem?: VeterinaryProductOrigin;
  matchMode?: VeterinaryProductMatchMode | null;
}

export interface VeterinaryProductResolution {
  product: ProdutoVeterinarioCatalogEntry | null;
  matchMode: VeterinaryProductMatchMode | null;
}

const PRODUCT_METADATA_KEYS = [
  "produto_veterinario_id",
  "produto_nome_catalogo",
  "produto_categoria",
  "produto_origem",
  "produto_match_mode",
  "produto_rotulo_informado",
] as const;

const CATEGORY_HINTS: Record<SanitarioTipoEnum, string[]> = {
  vacinacao: ["vacina", "vacinacao"],
  vermifugacao: ["antiparasitario", "vermifugo", "endectocida"],
  medicamento: [
    "medicamento",
    "antibiotico",
    "anti inflamatorio",
    "antiinflamatorio",
    "vitamina",
    "antitermico",
  ],
};

const normalizeText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenize = (value: string): string[] =>
  normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

const categoryMatchesSanitaryType = (
  categoria: string | null,
  sanitaryType?: SanitarioTipoEnum,
): boolean => {
  if (!categoria || !sanitaryType) return false;
  const normalizedCategory = normalizeText(categoria);
  return CATEGORY_HINTS[sanitaryType].some((hint) =>
    normalizedCategory.includes(hint),
  );
};

const scoreProductCandidate = (
  query: string,
  product: ProdutoVeterinarioCatalogEntry,
  sanitaryType?: SanitarioTipoEnum,
): number => {
  const normalizedQuery = normalizeText(query);
  const normalizedName = normalizeText(product.nome);

  if (!normalizedQuery || !normalizedName) {
    return categoryMatchesSanitaryType(product.categoria, sanitaryType) ? 20 : 1;
  }

  if (normalizedName === normalizedQuery) return 100;
  if (
    normalizedName.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedName)
  ) {
    return 80;
  }

  const queryTokens = tokenize(query);
  const nameTokens = tokenize(product.nome);
  if (queryTokens.length === 0 || nameTokens.length === 0) {
    return categoryMatchesSanitaryType(product.categoria, sanitaryType) ? 20 : 0;
  }

  let score = 0;
  const overlapCount = queryTokens.filter((token) => nameTokens.includes(token)).length;
  const overlapRatio = overlapCount / queryTokens.length;

  if (overlapCount > 0) {
    score += Math.round(overlapRatio * 55);
  }

  if (categoryMatchesSanitaryType(product.categoria, sanitaryType)) {
    score += 10;
  }

  return score;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const normalizeVeterinaryProductText = normalizeText;

export const refreshVeterinaryProductsCatalog = async (): Promise<
  ProdutoVeterinarioCatalogEntry[]
> => {
  const { data, error } = await supabase
    .from("produtos_veterinarios")
    .select("id, nome, categoria, created_at, updated_at")
    .order("categoria", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const products = (data ?? []) as ProdutoVeterinarioCatalogEntry[];

  await db.transaction("rw", db.catalog_produtos_veterinarios, async () => {
    await db.catalog_produtos_veterinarios.clear();
    if (products.length > 0) {
      await db.catalog_produtos_veterinarios.bulkPut(products);
    }
  });

  return products;
};

export const searchVeterinaryProducts = (
  catalog: ProdutoVeterinarioCatalogEntry[],
  options?: {
    query?: string;
    sanitaryType?: SanitarioTipoEnum;
    limit?: number;
  },
): ProdutoVeterinarioCatalogEntry[] => {
  const query = options?.query ?? "";
  const limit = options?.limit ?? 6;

  return catalog
    .map((product) => ({
      product,
      score: scoreProductCandidate(query, product, options?.sanitaryType),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.product.nome.localeCompare(right.product.nome);
    })
    .slice(0, limit)
    .map(({ product }) => product);
};

export const resolveVeterinaryProductByName = (
  productName: string,
  catalog: ProdutoVeterinarioCatalogEntry[],
  options?: { sanitaryType?: SanitarioTipoEnum },
): VeterinaryProductResolution => {
  const matches = searchVeterinaryProducts(catalog, {
    query: productName,
    sanitaryType: options?.sanitaryType,
    limit: 1,
  });

  const bestMatch = matches[0] ?? null;
  if (!bestMatch) {
    return { product: null, matchMode: null };
  }

  const normalizedQuery = normalizeText(productName);
  const normalizedName = normalizeText(bestMatch.nome);

  if (normalizedName === normalizedQuery) {
    return { product: bestMatch, matchMode: "exact" };
  }

  if (
    normalizedName.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedName)
  ) {
    return { product: bestMatch, matchMode: "contains" };
  }

  return { product: bestMatch, matchMode: "token_overlap" };
};

export const readVeterinaryProductSelection = (
  payload: Record<string, unknown> | null | undefined,
): VeterinaryProductSelection | null => {
  const id = payload?.produto_veterinario_id;
  const nome = payload?.produto_nome_catalogo;
  const categoria = payload?.produto_categoria;
  const origem = payload?.produto_origem;
  const matchMode = payload?.produto_match_mode;

  if (!isNonEmptyString(id) || !isNonEmptyString(nome)) {
    return null;
  }

  return {
    id,
    nome,
    categoria: isNonEmptyString(categoria) ? categoria : null,
    origem:
      origem === "catalogo" ||
      origem === "catalogo_automatico" ||
      origem === "texto_livre"
        ? origem
        : undefined,
    matchMode:
      matchMode === "exact" ||
      matchMode === "contains" ||
      matchMode === "token_overlap"
        ? matchMode
        : null,
  };
};

export const pickVeterinaryProductMetadata = (
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {};

  for (const key of PRODUCT_METADATA_KEYS) {
    const value = payload?.[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim().length === 0) continue;
    metadata[key] = value;
  }

  return metadata;
};

export const buildVeterinaryProductMetadata = (input: {
  selectedProduct?: VeterinaryProductSelection | null;
  typedName?: string;
  source?: VeterinaryProductOrigin;
  matchMode?: VeterinaryProductMatchMode | null;
}): Record<string, unknown> => {
  const typedName = input.typedName?.trim() ?? "";
  const selectedProduct = input.selectedProduct ?? null;

  if (!selectedProduct) {
    return typedName ? { produto_origem: "texto_livre" } : {};
  }

  const metadata: Record<string, unknown> = {
    produto_veterinario_id: selectedProduct.id,
    produto_nome_catalogo: selectedProduct.nome,
    produto_categoria: selectedProduct.categoria,
    produto_origem: input.source ?? selectedProduct.origem ?? "catalogo",
  };

  const matchMode = input.matchMode ?? selectedProduct.matchMode ?? null;
  if (matchMode) {
    metadata.produto_match_mode = matchMode;
  }

  if (
    typedName &&
    normalizeText(typedName) !== normalizeText(selectedProduct.nome)
  ) {
    metadata.produto_rotulo_informado = typedName;
  }

  return metadata;
};

export const buildVeterinaryProductMetadataPatch = (input: {
  selectedProduct?: VeterinaryProductSelection | null;
  typedName?: string;
  source?: VeterinaryProductOrigin;
  matchMode?: VeterinaryProductMatchMode | null;
}): Record<string, unknown> => ({
  produto_veterinario_id: null,
  produto_nome_catalogo: null,
  produto_categoria: null,
  produto_origem: null,
  produto_match_mode: null,
  produto_rotulo_informado: null,
  ...buildVeterinaryProductMetadata(input),
});
