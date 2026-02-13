import { differenceInDays, parseISO } from "date-fns";
import { Animal, CategoriaZootecnica } from "@/lib/offline/types";

/**
 * Classifica um animal em uma categoria zootécnica baseada em sua idade e sexo.
 * Retorna a primeira categoria que der match, respeitando a ordem do array passado.
 */
export function classificarAnimal(
  animal: Animal,
  categorias: CategoriaZootecnica[]
): CategoriaZootecnica | null {
  if (!animal.data_nascimento) return null;

  const hoje = new Date();
  const dataNascimento = parseISO(animal.data_nascimento);
  const idadeDias = differenceInDays(hoje, dataNascimento);

  // Ordenação determinística antes da classificação
  const categoriasOrdenadas = [...categorias].sort((a, b) => {
    // 1. Ativa primeiro
    if (a.ativa !== b.ativa) return a.ativa ? -1 : 1;

    // 2. Order (payload.order) ASC
    const orderA = (a.payload as any)?.order ?? 9999;
    const orderB = (b.payload as any)?.order ?? 9999;
    if (orderA !== orderB) return orderA - orderB;

    // 3. Idade Minima ASC
    const minA = a.idade_min_dias ?? 0;
    const minB = b.idade_min_dias ?? 0;
    if (minA !== minB) return minA - minB;

    // 4. Especificidade (aplica_ambos=false primeiro)
    if (a.aplica_ambos !== b.aplica_ambos) return a.aplica_ambos ? 1 : -1;

    // 5. Nome ASC
    return a.nome.localeCompare(b.nome);
  });
  
  return (
    categoriasOrdenadas.find((cat) => {
      // 1. Verifica Sexo
      const sexoMatch =
        cat.aplica_ambos || (cat.sexo && cat.sexo === animal.sexo);

      if (!sexoMatch) return false;

      // 2. Verifica Idade
      const minDias = cat.idade_min_dias ?? 0;
      const maxDias = cat.idade_max_dias ?? 999999;
      const idadeMatch = idadeDias >= minDias && idadeDias <= maxDias;

      // 3. Verifica Status
      const statusMatch = cat.ativa;

      if (!idadeMatch || !statusMatch) return false;

      // 4. Verifica Critérios Especiais (Payload)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const criteria = (cat.payload as any)?.criteria;
      if (criteria) {
        if (criteria.papel_macho && animal.papel_macho !== criteria.papel_macho) {
          return false;
        }
        if (criteria.habilitado_monta !== undefined && animal.habilitado_monta !== criteria.habilitado_monta) {
          return false;
        }
      }

      return true;
    }) || null
  );
}

/**
 * Gera as categorias padrão para inicialização do sistema
 */
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
    nome: "Bezerro(a)",
    sexo: null,
    aplica_ambos: true,
    idade_min_dias: 0,
    idade_max_dias: 240, // ~8 meses
    ativa: true,
    payload: { order: 10 },
  },
  {
    nome: "Garrote",
    sexo: "M",
    aplica_ambos: false,
    idade_min_dias: 241,
    idade_max_dias: 730, // ~24 meses
    ativa: true,
    payload: { order: 20 },
  },
  {
    nome: "Novilha",
    sexo: "F",
    aplica_ambos: false,
    idade_min_dias: 241,
    idade_max_dias: 900, // ~30 meses
    ativa: true,
    payload: { order: 30 },
  },
  {
    nome: "Touro",
    sexo: "M",
    aplica_ambos: false,
    idade_min_dias: 731,
    idade_max_dias: null,
    ativa: true,
    payload: {
      order: 40,
      criteria: {
        papel_macho: "reprodutor",
        habilitado_monta: true
      }
    },
  },
  {
    nome: "Boi",
    sexo: "M",
    aplica_ambos: false,
    idade_min_dias: 731,
    idade_max_dias: null,
    ativa: true,
    payload: { order: 50 },
  },
  {
    nome: "Vaca",
    sexo: "F",
    aplica_ambos: false,
    idade_min_dias: 901,
    idade_max_dias: null,
    ativa: true,
    payload: { order: 60 },
  },
  {
    nome: "Vaca Prenha", // Exemplo de categoria legada ou especial desativada por padrão ou fallback
    sexo: "F",
    aplica_ambos: false,
    idade_min_dias: 0,
    idade_max_dias: null,
    ativa: false, // Inativa por padrão para não atrapalhar
    payload: { order: 999 },
  }
];

/**
 * Retorna label formatado da categoria
 */
export function getLabelCategoria(categoria: CategoriaZootecnica): string {
  return categoria.nome;
}
