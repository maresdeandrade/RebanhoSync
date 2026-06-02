import type { InsumoTipoEnum } from "@/lib/offline/types";

import {
  applyInventoryPreset,
  getInventoryCategoryPreset,
  type InventoryFormField,
  type InventoryFormLike,
  type InventoryFormPreset,
} from "./inventoryFormPresets";

export type InventoryItemOption = {
  id: string;
  tipo: InsumoTipoEnum;
  categoria: string;
  nome: string;
  preset?: Partial<InventoryFormPreset>;
};

const ITEM_NAMES: Record<InsumoTipoEnum, Record<string, string[]>> = {
  nutricional: {
    "Sal mineral": [
      "Sal mineral pronto uso",
      "Sal mineral reprodução",
      "Sal mineral cria",
      "Sal mineral recria",
      "Sal mineral engorda",
    ],
    "Proteinado / suplemento proteico": [
      "Proteinado baixo consumo",
      "Proteinado médio consumo",
      "Proteinado alto consumo",
      "Suplemento proteico seca",
      "Suplemento proteico águas",
    ],
    "Suplemento proteico-energético": [
      "Proteinado energético",
      "Suplemento múltiplo",
      "Suplemento recria",
      "Suplemento engorda a pasto",
      "Suplemento semiconfinamento",
    ],
    "Suplemento energético": [
      "Milho moído",
      "Sorgo moído",
      "Polpa cítrica",
      "Melaço",
      "Casquinha de soja",
    ],
    "Ração / concentrado": [
      "Ração bezerro",
      "Ração recria",
      "Ração engorda",
      "Concentrado proteico",
      "Concentrado energético",
    ],
    "Volumoso / feno": ["Feno", "Pré-secado", "Cana picada", "Capim picado"],
    Silagem: [
      "Silagem de milho",
      "Silagem de sorgo",
      "Silagem de capim",
      "Silagem de cana",
    ],
    "Aditivo nutricional": [
      "Levedura",
      "Ionóforo",
      "Tamponante",
      "Probiótico",
      "Adsorvente de micotoxina",
      "Conservante de silagem",
    ],
  },
  sanitario: {
    Vacina: [
      "Vacina Brucelose B19",
      "Vacina Raiva Herbívoros",
      "Vacina Clostridioses",
      "Vacina Reprodutiva IBR/BVD/Lepto",
      "Outra vacina",
    ],
    "Antiparasitário / endectocida": [
      "Ivermectina",
      "Doramectina",
      "Abamectina",
      "Endectocida genérico",
    ],
    Vermífugo: [
      "Benzimidazol",
      "Levamisol",
      "Vermífugo oral",
      "Vermífugo injetável",
    ],
    Antibiótico: [
      "Oxitetraciclina",
      "Antibiótico penicilínico",
      "Antibiótico intramamário",
    ],
    "Anti-inflamatório / analgésico": ["AINE", "Analgésico", "Antitérmico"],
    "Vitamina / suporte": [
      "Complexo B",
      "Suporte vitamínico-mineral",
      "Solução eletrolítica",
    ],
    Ectoparasiticida: [
      "Carrapaticida",
      "Mosquicida",
      "Ectoparasiticida pour-on",
      "Ectoparasiticida pulverização",
    ],
    "Material sanitário": [
      "Seringa",
      "Agulha",
      "Aplicador",
      "Luva",
      "Algodão",
      "Gaze",
      "Equipo",
    ],
    "Higiene / desinfecção": [
      "Desinfetante",
      "Iodo",
      "Álcool",
      "Cal virgem",
      "Detergente",
    ],
  },
  outro: {
    "Brinco de identificação": [
      "Brinco visual",
      "Brinco eletrônico",
      "Botton",
      "Aplicador de brinco",
    ],
    "Aplicador/seringa/agulha": [
      "Seringa descartável",
      "Seringa dosadora",
      "Agulha 40x12",
      "Agulha 30x8",
      "Pistola dosadora",
    ],
    "Ferramenta/equipamento": [
      "Alicate",
      "Balança portátil",
      "Bastão",
      "Corda",
      "Tronco/acessório",
    ],
    EPI: ["Luva", "Bota", "Avental", "Máscara", "Óculos de proteção"],
    "Combustível/lubrificante": [
      "Diesel",
      "Gasolina",
      "Óleo lubrificante",
      "Graxa",
    ],
    "Higiene/limpeza": [
      "Detergente",
      "Desinfetante",
      "Vassoura",
      "Pulverizador",
    ],
    "Manutenção/peças": [
      "Parafuso",
      "Arame",
      "Isolador",
      "Mangueira",
      "Registro",
    ],
    "Material de curral": [
      "Tábua",
      "Mourão",
      "Arame liso",
      "Arame farpado",
      "Porteira",
    ],
    "Escritório / administrativo": [
      "Etiqueta",
      "Caneta marcadora",
      "Papel",
      "Pasta",
    ],
  },
};

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ITEM_OPTIONS: InventoryItemOption[] = Object.entries(ITEM_NAMES).flatMap(
  ([tipo, categories]) =>
    Object.entries(categories).flatMap(([categoria, names]) =>
      names.map((nome) => ({
        id: `${tipo}-${slug(categoria)}-${slug(nome)}`,
        tipo: tipo as InsumoTipoEnum,
        categoria,
        nome,
      })),
    ),
);

export function getInventoryItemOptions(
  tipo: InsumoTipoEnum,
  categoria: string,
) {
  return ITEM_OPTIONS.filter(
    (item) => item.tipo === tipo && item.categoria === categoria,
  );
}

export function applyInventoryItemSelection<T extends InventoryFormLike>(
  form: T,
  item: InventoryItemOption,
  editedFields: ReadonlySet<InventoryFormField> = new Set(),
): T {
  const categoryPreset = getInventoryCategoryPreset(item.tipo, item.categoria);
  return applyInventoryPreset(
    {
      ...form,
      tipo: item.tipo,
      categoria: item.categoria,
    },
    {
      ...categoryPreset,
      ...item.preset,
      nome: item.nome === "Outro / digitar" ? "" : item.nome,
      categoria: item.categoria,
    },
    editedFields,
  );
}
