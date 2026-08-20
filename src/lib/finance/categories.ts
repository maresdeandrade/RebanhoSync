import type {
  FinanceCategoryTipoEnum,
  FinanceCategoryGrupoEnum,
} from "@/lib/offline/types";
import { sha256Sync } from "./sha256";

export interface DefaultFinanceCategoryDef {
  nome: string;
  tipo: FinanceCategoryTipoEnum;
  grupo: FinanceCategoryGrupoEnum;
  slug: string;
}

export const DEFAULT_FINANCE_CATEGORIES: DefaultFinanceCategoryDef[] = [
  {
    nome: "Venda de Animais",
    tipo: "receita",
    grupo: "venda_animais",
    slug: "venda-animais",
  },
  {
    nome: "Compra de Animais",
    tipo: "custo_variavel",
    grupo: "compra_animais",
    slug: "compra-animais",
  },
  {
    nome: "Sanidade/Medicamentos",
    tipo: "custo_variavel",
    grupo: "sanidade",
    slug: "sanidade-medicamentos",
  },
  {
    nome: "Nutrição/Alimentos",
    tipo: "custo_variavel",
    grupo: "nutricao",
    slug: "nutricao-alimentos",
  },
  {
    nome: "Mão de Obra/Salários",
    tipo: "custo_fixo",
    grupo: "mao_obra",
    slug: "mao-de-obra-salarios",
  },
  {
    nome: "Combustível",
    tipo: "custo_variavel",
    grupo: "combustivel",
    slug: "combustivel",
  },
  {
    nome: "Manutenção",
    tipo: "custo_fixo",
    grupo: "manutencao",
    slug: "manutencao",
  },
  {
    nome: "Arrendamento",
    tipo: "custo_fixo",
    grupo: "arrendamento",
    slug: "arrendamento",
  },
  {
    nome: "Infraestrutura",
    tipo: "investimento",
    grupo: "infraestrutura",
    slug: "infraestrutura",
  },
  {
    nome: "Reprodução/Sêmen",
    tipo: "custo_variavel",
    grupo: "reproducao",
    slug: "reproducao-semen",
  },
  {
    nome: "Administrativo",
    tipo: "custo_fixo",
    grupo: "administrativo",
    slug: "administrativo",
  },
  {
    nome: "Outros",
    tipo: "custo_variavel",
    grupo: "outros",
    slug: "outros",
  },
];

export function getDeterministicFinanceCategoryId(
  fazendaId: string,
  slug: string,
): string {
  const hash = sha256Sync(`${fazendaId}:${slug}`);
  const chars = hash.split("");
  // Custom deterministic UUID based on SHA-256.
  // We set version and variant bits to match standard UUID format,
  // yielding an effective entropy of ~122 bits.
  chars[12] = "5";
  chars[16] = ((parseInt(chars[16], 16) & 0x03) | 0x08).toString(16);
  return `${chars.slice(0, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}-${chars.slice(16, 20).join("")}-${chars.slice(20, 32).join("")}`;
}

/**
 * Retorna operações de INSERT para materializar categorias padrão offline.
 * A autoridade remota continua sendo a unicidade `(fazenda_id, slug)`;
 * a identidade local determinística evita duplicação por retry/reexecução do seeding.
 */
export function getLocalDefaultFinanceCategoriesOps(fazendaId: string) {
  return DEFAULT_FINANCE_CATEGORIES.map((c) => ({
    table: "finance_categories" as const,
    action: "INSERT" as const,
    record: {
      id: getDeterministicFinanceCategoryId(fazendaId, c.slug),
      fazenda_id: fazendaId,
      nome: c.nome,
      tipo: c.tipo,
      grupo: c.grupo,
      slug: c.slug,
      is_default: true,
      ativo: true,
      observacoes: "Categoria gerencial padrão semeada localmente.",
    },
  }));
}
