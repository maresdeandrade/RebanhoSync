import type {
  InsumoTipoEnum,
  InsumoUnidadeBaseEnum,
  InsumoUnidadeCompraEnum,
  ProdutoVeterinarioCatalogEntry,
} from "@/lib/offline/types";

export type InventoryFormPreset = {
  unidadeBase: InsumoUnidadeBaseEnum;
  unidadeCompra: InsumoUnidadeCompraEnum;
  quantidadePorApresentacao: string;
  nome?: string;
  apresentacaoNome?: string;
  requiresVeterinaryProduct: boolean;
  showLote: boolean;
  showValidade: boolean;
  showFabricante: boolean;
};

export type InventoryFormLike = {
  tipo: InsumoTipoEnum;
  nome: string;
  categoria: string;
  unidadeBase: InsumoUnidadeBaseEnum;
  unidadeCompra: InsumoUnidadeCompraEnum;
  apresentacaoNome: string;
  quantidadePorApresentacao: string;
  quantidadeEntrada: string;
  identificacaoLote: string;
  validade: string;
  fabricante: string;
  localArmazenamento: string;
  custoTotal: string;
  custoUnitario: string;
};

export type InventoryFormField = keyof InventoryFormLike;

export type InventoryCostMode = "ausente" | "custo_total" | "custo_unitario";

export type InventoryCostSummary = {
  custoTotal: number | null;
  custoUnitario: number | null;
  status: "informado" | "ausente";
};

export const CUSTOM_CATEGORY_VALUE = "outro_personalizado";

export const MATERIAL_SANITARIO_CATEGORY = "Material sanitário";

const TYPE_OPTIONS: Array<{ value: InsumoTipoEnum; label: string }> = [
  { value: "nutricional", label: "Nutricional" },
  { value: "sanitario", label: "Sanitario" },
  { value: "outro", label: "Operacional" },
];

const CATEGORY_OPTIONS: Record<
  InsumoTipoEnum,
  Array<{ value: string; label: string }>
> = {
  nutricional: [
    { value: "Sal mineral", label: "Sal mineral" },
    {
      value: "Proteinado / suplemento proteico",
      label: "Proteinado / suplemento proteico",
    },
    {
      value: "Suplemento proteico-energético",
      label: "Suplemento proteico-energético",
    },
    { value: "Suplemento energético", label: "Suplemento energético" },
    { value: "Ração / concentrado", label: "Ração / concentrado" },
    { value: "Volumoso / feno", label: "Volumoso / feno" },
    { value: "Silagem", label: "Silagem" },
    { value: "Aditivo nutricional", label: "Aditivo nutricional" },
    { value: CUSTOM_CATEGORY_VALUE, label: "Outra categoria" },
  ],
  sanitario: [
    { value: "Vacina", label: "Vacina" },
    {
      value: "Antiparasitário / endectocida",
      label: "Antiparasitário / endectocida",
    },
    { value: "Vermífugo", label: "Vermífugo" },
    { value: "Antibiótico", label: "Antibiótico" },
    {
      value: "Anti-inflamatório / analgésico",
      label: "Anti-inflamatório / analgésico",
    },
    { value: "Vitamina / suporte", label: "Vitamina / suporte" },
    { value: "Ectoparasiticida", label: "Ectoparasiticida" },
    { value: MATERIAL_SANITARIO_CATEGORY, label: MATERIAL_SANITARIO_CATEGORY },
    { value: "Higiene / desinfecção", label: "Higiene / desinfecção" },
    { value: "Outro sanitário", label: "Outro sanitário" },
  ],
  outro: [
    { value: "Brinco de identificação", label: "Brinco de identificação" },
    {
      value: "Aplicador/seringa/agulha",
      label: "Aplicador/seringa/agulha",
    },
    { value: "Ferramenta/equipamento", label: "Ferramenta/equipamento" },
    { value: "EPI", label: "EPI" },
    { value: "Combustível/lubrificante", label: "Combustível/lubrificante" },
    { value: "Higiene/limpeza", label: "Higiene/limpeza" },
    { value: "Manutenção/peças", label: "Manutenção/peças" },
    { value: "Material de curral", label: "Material de curral" },
    {
      value: "Escritório / administrativo",
      label: "Escritório / administrativo",
    },
    { value: CUSTOM_CATEGORY_VALUE, label: "Outro operacional" },
  ],
};

const DEFAULT_PRESET: InventoryFormPreset = {
  unidadeBase: "un",
  unidadeCompra: "unidade",
  quantidadePorApresentacao: "1",
  requiresVeterinaryProduct: false,
  showLote: true,
  showValidade: true,
  showFabricante: true,
};

const SANITARY_CLINICAL_PRESET: InventoryFormPreset = {
  unidadeBase: "dose",
  unidadeCompra: "frasco",
  quantidadePorApresentacao: "1",
  requiresVeterinaryProduct: true,
  showLote: true,
  showValidade: true,
  showFabricante: true,
};

const PRESETS: Record<string, InventoryFormPreset> = {
  "nutricional::Sal mineral": {
    unidadeBase: "kg",
    unidadeCompra: "saco",
    quantidadePorApresentacao: "25",
    nome: "Sal mineral",
    requiresVeterinaryProduct: false,
    showLote: true,
    showValidade: false,
    showFabricante: true,
  },
  "nutricional::Proteinado / suplemento proteico": {
    unidadeBase: "kg",
    unidadeCompra: "saco",
    quantidadePorApresentacao: "30",
    nome: "Proteinado",
    requiresVeterinaryProduct: false,
    showLote: true,
    showValidade: false,
    showFabricante: true,
  },
  "nutricional::Ração / concentrado": {
    unidadeBase: "kg",
    unidadeCompra: "saco",
    quantidadePorApresentacao: "40",
    nome: "Ração / concentrado",
    requiresVeterinaryProduct: false,
    showLote: true,
    showValidade: false,
    showFabricante: true,
  },
  "nutricional::Volumoso / feno": {
    unidadeBase: "kg",
    unidadeCompra: "unidade",
    quantidadePorApresentacao: "1",
    nome: "Volumoso / feno",
    requiresVeterinaryProduct: false,
    showLote: false,
    showValidade: false,
    showFabricante: false,
  },
  "nutricional::Silagem": {
    unidadeBase: "kg",
    unidadeCompra: "unidade",
    quantidadePorApresentacao: "1",
    nome: "Silagem",
    requiresVeterinaryProduct: false,
    showLote: false,
    showValidade: false,
    showFabricante: false,
  },
  "sanitario::Material sanitário": {
    unidadeBase: "un",
    unidadeCompra: "caixa",
    quantidadePorApresentacao: "1",
    nome: MATERIAL_SANITARIO_CATEGORY,
    requiresVeterinaryProduct: false,
    showLote: true,
    showValidade: false,
    showFabricante: true,
  },
  "sanitario::Higiene / desinfecção": {
    unidadeBase: "un",
    unidadeCompra: "unidade",
    quantidadePorApresentacao: "1",
    nome: "Higiene / desinfecção",
    requiresVeterinaryProduct: false,
    showLote: true,
    showValidade: false,
    showFabricante: true,
  },
  "outro::Brinco de identificação": {
    unidadeBase: "un",
    unidadeCompra: "unidade",
    quantidadePorApresentacao: "1",
    nome: "Brinco de identificação",
    requiresVeterinaryProduct: false,
    showLote: false,
    showValidade: false,
    showFabricante: true,
  },
  "outro::Combustível/lubrificante": {
    unidadeBase: "l",
    unidadeCompra: "bombona",
    quantidadePorApresentacao: "20",
    nome: "Combustível/lubrificante",
    requiresVeterinaryProduct: false,
    showLote: false,
    showValidade: false,
    showFabricante: true,
  },
};

const SANITARY_CLINICAL_CATEGORIES = new Set([
  "Vacina",
  "Antiparasitário / endectocida",
  "Vermífugo",
  "Antibiótico",
  "Anti-inflamatório / analgésico",
  "Vitamina / suporte",
  "Ectoparasiticida",
]);

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}

export function getInventoryTypeOptions() {
  return TYPE_OPTIONS;
}

export function getInventoryCategoryOptions(tipo: InsumoTipoEnum) {
  return CATEGORY_OPTIONS[tipo] ?? [];
}

export function getInventoryCategoryPreset(
  tipo: InsumoTipoEnum,
  categoria: string,
): InventoryFormPreset {
  const preset = PRESETS[`${tipo}::${categoria}`];
  if (preset) return preset;
  if (tipo === "sanitario" && SANITARY_CLINICAL_CATEGORIES.has(categoria)) {
    return SANITARY_CLINICAL_PRESET;
  }
  return DEFAULT_PRESET;
}

export function isVeterinaryProductRequired(
  tipo: InsumoTipoEnum,
  categoria: string,
  _insumo?: string,
) {
  return (
    tipo === "sanitario" &&
    getInventoryCategoryPreset(tipo, categoria).requiresVeterinaryProduct
  );
}

export function getInventoryProductPreset(
  product: Pick<ProdutoVeterinarioCatalogEntry, "nome" | "categoria">,
) {
  const categoria = resolveVeterinaryProductCategory(product);
  return {
    ...getInventoryCategoryPreset("sanitario", categoria),
    nome: product.nome,
    categoria,
  };
}

export function resolveVeterinaryProductCategory(
  product: Pick<ProdutoVeterinarioCatalogEntry, "nome" | "categoria">,
) {
  const source = normalizeText(`${product.categoria ?? ""} ${product.nome}`);
  if (source.includes("vac")) return "Vacina";
  if (
    source.includes("verm") ||
    source.includes("paras") ||
    source.includes("endecto")
  ) {
    return source.includes("verm")
      ? "Vermífugo"
      : "Antiparasitário / endectocida";
  }
  if (source.includes("carrap") || source.includes("ectoparas")) {
    return "Ectoparasiticida";
  }
  if (source.includes("antib")) return "Antibiótico";
  if (source.includes("inflam") || source.includes("analges")) {
    return "Anti-inflamatório / analgésico";
  }
  if (source.includes("vitamin") || source.includes("mineral")) {
    return "Vitamina / suporte";
  }
  if (source.includes("antissep") || source.includes("desinf")) {
    return "Higiene / desinfecção";
  }
  if (source.includes("hidrat") || source.includes("suporte")) {
    return "Vitamina / suporte";
  }
  return product.categoria?.trim() || "Vacina";
}

export function applyInventoryPreset<T extends InventoryFormLike>(
  form: T,
  preset: Partial<InventoryFormPreset> & { categoria?: string },
  editedFields: ReadonlySet<InventoryFormField> = new Set(),
): T {
  const next = { ...form };

  const assignIfAllowed = <K extends InventoryFormField>(
    field: K,
    value: T[K] | undefined,
  ) => {
    if (value == null || editedFields.has(field)) return;
    next[field] = value;
  };

  if (preset.categoria && !editedFields.has("categoria")) {
    next.categoria = preset.categoria;
  }
  assignIfAllowed("nome", preset.nome as T["nome"] | undefined);
  assignIfAllowed(
    "unidadeBase",
    preset.unidadeBase as T["unidadeBase"] | undefined,
  );
  assignIfAllowed(
    "unidadeCompra",
    preset.unidadeCompra as T["unidadeCompra"] | undefined,
  );
  assignIfAllowed(
    "quantidadePorApresentacao",
    preset.quantidadePorApresentacao as
      | T["quantidadePorApresentacao"]
      | undefined,
  );

  const presentation = preset.apresentacaoNome ?? buildPresentationName(next);
  assignIfAllowed("apresentacaoNome", presentation as T["apresentacaoNome"]);

  return next;
}

export function shouldShowInventoryField(
  field: "lote" | "validade" | "fabricante",
  _form: InventoryFormLike,
  preset: InventoryFormPreset,
) {
  if (field === "lote") return preset.showLote;
  if (field === "validade") return preset.showValidade;
  return preset.showFabricante;
}

export function buildPresentationName(
  form: Pick<
    InventoryFormLike,
    "unidadeCompra" | "quantidadePorApresentacao" | "unidadeBase"
  >,
) {
  const quantity = form.quantidadePorApresentacao.trim();
  if (!quantity) return "";
  const unidadeCompraLabel =
    form.unidadeCompra.charAt(0).toUpperCase() + form.unidadeCompra.slice(1);
  return `${unidadeCompraLabel} ${quantity} ${form.unidadeBase}`;
}

export const buildInventoryPresentationName = buildPresentationName;

export function calculateBaseQuantity(
  form: Pick<
    InventoryFormLike,
    "quantidadeEntrada" | "quantidadePorApresentacao"
  >,
) {
  const quantidadeEntrada = parsePositiveNumber(form.quantidadeEntrada);
  const quantidadePorApresentacao = parsePositiveNumber(
    form.quantidadePorApresentacao,
  );
  if (!quantidadeEntrada || !quantidadePorApresentacao) return null;
  return quantidadeEntrada * quantidadePorApresentacao;
}

export const calculateInventoryBaseQuantity = calculateBaseQuantity;

export function calculateInventoryCostSummary(
  form: Pick<
    InventoryFormLike,
    | "quantidadeEntrada"
    | "quantidadePorApresentacao"
    | "custoTotal"
    | "custoUnitario"
  >,
  mode: InventoryCostMode,
): InventoryCostSummary {
  if (mode === "ausente") {
    return { custoTotal: null, custoUnitario: null, status: "ausente" };
  }

  const baseQuantity = calculateBaseQuantity(form);
  const entryQuantity = parsePositiveNumber(form.quantidadeEntrada);
  if (!baseQuantity || !entryQuantity) {
    return { custoTotal: null, custoUnitario: null, status: "ausente" };
  }

  if (mode === "custo_total") {
    const total = parseNonNegativeNumber(form.custoTotal);
    return total == null
      ? { custoTotal: null, custoUnitario: null, status: "ausente" }
      : {
          custoTotal: total,
          custoUnitario: round(total / entryQuantity, 4),
          status: "informado",
        };
  }

  const unit = parseNonNegativeNumber(form.custoUnitario);
  return unit == null
    ? { custoTotal: null, custoUnitario: null, status: "ausente" }
    : {
        custoTotal: round(unit * entryQuantity, 2),
        custoUnitario: unit,
        status: "informado",
      };
}
