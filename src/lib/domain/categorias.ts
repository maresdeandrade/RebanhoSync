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

  // Ordenar categorias pode ser necessário se a ordem de precedência importar (ex: mais específico primeiro)
  // Assumimos que 'categorias' já vem ordenado ou que não há sobreposição conflitante crítica.
  
  return (
    categorias.find((cat) => {
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
    payload: {},
  },
  {
    nome: "Garrote",
    sexo: "M",
    aplica_ambos: false,
    idade_min_dias: 241,
    idade_max_dias: 730, // ~24 meses
    ativa: true,
    payload: {},
  },
  {
    nome: "Novilha",
    sexo: "F",
    aplica_ambos: false,
    idade_min_dias: 241,
    idade_max_dias: 900, // ~30 meses
    ativa: true,
    payload: {},
  },
  {
    nome: "Touro",
    sexo: "M",
    aplica_ambos: false,
    idade_min_dias: 731,
    idade_max_dias: null,
    ativa: true,
    payload: {
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
    payload: {},
  },
  {
    nome: "Vaca",
    sexo: "F",
    aplica_ambos: false,
    idade_min_dias: 901,
    idade_max_dias: null,
    ativa: true,
    payload: {},
  },
];

/**
 * Retorna label formatado da categoria
 */
export function getLabelCategoria(categoria: CategoriaZootecnica): string {
  return categoria.nome;
}
