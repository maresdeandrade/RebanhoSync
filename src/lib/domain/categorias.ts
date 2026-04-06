import { Animal, CategoriaZootecnica } from "@/lib/offline/types";
import {
  deriveAnimalTaxonomy,
  getCategoriaZootecnicaLabel,
} from "@/lib/animals/taxonomy";

function buildVirtualCategoria(
  animal: Animal,
  categoria: ReturnType<typeof deriveAnimalTaxonomy>["categoria_zootecnica"],
): CategoriaZootecnica {
  const nome = getCategoriaZootecnicaLabel(categoria);

  return {
    id: `canon:${categoria}`,
    fazenda_id: animal.fazenda_id,
    nome,
    sexo: animal.sexo,
    aplica_ambos: false,
    idade_min_dias: null,
    idade_max_dias: null,
    ativa: true,
    payload: {
      source: "canonical_taxonomy",
      categoria_canonica: categoria,
    },
    client_id: "canonical",
    client_op_id: "canonical",
    client_tx_id: null,
    client_recorded_at: animal.client_recorded_at,
    server_received_at: animal.server_received_at,
    created_at: animal.created_at,
    updated_at: animal.updated_at,
    deleted_at: null,
  };
}

/**
 * Compatibilidade para telas legadas.
 * A fonte de verdade da categoria agora é a taxonomia canônica.
 */
export function classificarAnimal(
  animal: Animal,
  _categorias: CategoriaZootecnica[],
): CategoriaZootecnica | null {
  return buildVirtualCategoria(
    animal,
    deriveAnimalTaxonomy(animal).categoria_zootecnica,
  );
}

export const CATEGORIAS_PADRAO: Omit<
  CategoriaZootecnica,
  | "id"
  | "fazenda_id"
  | "client_id"
  | "client_op_id"
  | "client_tx_id"
  | "client_recorded_at"
  | "server_received_at"
  | "created_at"
  | "updated_at"
  | "deleted_at"
>[] = [
  {
    nome: "Bezerra",
    sexo: "F",
    aplica_ambos: false,
    idade_min_dias: null,
    idade_max_dias: null,
    ativa: true,
    payload: { source: "canonical_taxonomy", categoria_canonica: "bezerra" },
  },
  {
    nome: "Novilha",
    sexo: "F",
    aplica_ambos: false,
    idade_min_dias: null,
    idade_max_dias: null,
    ativa: true,
    payload: { source: "canonical_taxonomy", categoria_canonica: "novilha" },
  },
  {
    nome: "Vaca",
    sexo: "F",
    aplica_ambos: false,
    idade_min_dias: null,
    idade_max_dias: null,
    ativa: true,
    payload: { source: "canonical_taxonomy", categoria_canonica: "vaca" },
  },
  {
    nome: "Bezerro",
    sexo: "M",
    aplica_ambos: false,
    idade_min_dias: null,
    idade_max_dias: null,
    ativa: true,
    payload: { source: "canonical_taxonomy", categoria_canonica: "bezerro" },
  },
  {
    nome: "Garrote",
    sexo: "M",
    aplica_ambos: false,
    idade_min_dias: null,
    idade_max_dias: null,
    ativa: true,
    payload: { source: "canonical_taxonomy", categoria_canonica: "garrote" },
  },
  {
    nome: "Boi",
    sexo: "M",
    aplica_ambos: false,
    idade_min_dias: null,
    idade_max_dias: null,
    ativa: true,
    payload: { source: "canonical_taxonomy", categoria_canonica: "boi_terminacao" },
  },
  {
    nome: "Touro",
    sexo: "M",
    aplica_ambos: false,
    idade_min_dias: null,
    idade_max_dias: null,
    ativa: true,
    payload: { source: "canonical_taxonomy", categoria_canonica: "touro" },
  },
];

export function getLabelCategoria(categoria: CategoriaZootecnica): string {
  return categoria.nome;
}
