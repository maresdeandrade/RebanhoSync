import type {
  Animal,
  ProdutoVeterinarioCatalogEntry,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
  SanitarioTipoEnum,
} from "@/lib/offline/types";
import {
  readVeterinaryProductSelection,
  resolveVeterinaryProductByName,
  searchVeterinaryProducts,
  type VeterinaryProductSelection,
} from "@/lib/sanitario/catalog/products";
import { listAnimalsBlockedBySanitaryAlert } from "@/lib/sanitario/compliance/alerts";
import {
  EMPTY_REGULATORY_OPERATIONAL_READ_MODEL,
  type RegulatoryFlowReadModel,
  type RegulatoryOperationalReadModel,
} from "@/lib/sanitario/compliance/regulatoryReadModel";
import {
  validateTransitChecklist,
  type TransitChecklistDraft,
} from "@/lib/sanitario/compliance/transit";
import { formatSanitaryProtocolRestrictions } from "@/lib/sanitario/engine/protocolRules";
import {
  evaluateSanitaryProtocolEligibility,
  type SanitaryProtocolEligibilitySummary,
} from "@/lib/sanitario/engine/protocolRules";
import {
  buildSanitaryExecutionPayload,
  type SanitaryExecutionPayload,
} from "@/lib/sanitario/models/executionPayload";

export type RegistrarPackageFinanceiroNatureza =
  | "compra"
  | "venda"
  | "sociedade_entrada"
  | "sociedade_saida"
  | "doacao_entrada"
  | "doacao_saida"
  | "arrendamento";

export type RegistrarSanitaryProtocolItemEvaluation = {
  item: ProtocoloSanitarioItem;
  protocolo: ProtocoloSanitario | null;
  eligibility: SanitaryProtocolEligibilitySummary;
};

export type RegistrarSanitaryPackage = SanitaryExecutionPayload & {
  isSanitary: boolean;
  protocoloItem: ProtocoloSanitarioItem | null;
  selectedVeterinaryProduct: ProdutoVeterinarioCatalogEntry | null;
  selectedVeterinaryProductSelection: VeterinaryProductSelection | null;
  hasVeterinaryProducts: boolean;
  isVeterinaryProductsEmpty: boolean;
  veterinaryProductSuggestions: ProdutoVeterinarioCatalogEntry[];
  protocoloItensEvaluated: RegistrarSanitaryProtocolItemEvaluation[];
  selectedProtocoloItemEvaluation: RegistrarSanitaryProtocolItemEvaluation | null;
  selectedProtocolRestrictionsText: string | null;
  selectedProtocolPrimaryReason: string | null;
  allProtocolItemsIneligible: boolean;
  protocolEligibilityIssues: string[];
  sanitatioProductMissing: boolean;
  showsTransitChecklist: boolean;
  officialTransitChecklistEnabled: boolean;
  animalsBlockedBySanitaryAlert: ReturnType<
    typeof listAnimalsBlockedBySanitaryAlert<Animal>
  >;
  sanitaryMovementBlockIssues: string[];
  movementComplianceGuards: RegulatoryFlowReadModel;
  nutritionComplianceGuards: RegulatoryFlowReadModel;
  transitChecklistIssues: string[];
  complianceFlowIssues: string[];
  warnings: string[];
};

export type ResolveRegistrarSanitaryPackageInput = {
  tipoManejo: string | null;
  financeiroNatureza: RegistrarPackageFinanceiroNatureza;
  regulatorySurfaceConfig: Record<string, unknown> | null;
  regulatoryReadModel: RegulatoryOperationalReadModel;
  animaisNoLote?: Animal[];
  selectedAnimaisDetalhes: Animal[];
  protocolos?: ProtocoloSanitario[] | null;
  protocoloItens?: ProtocoloSanitarioItem[] | null;
  protocoloItemId?: string | null;
  sanitarioData: {
    tipo: SanitarioTipoEnum;
    produto: string;
  };
  selectedVeterinaryProductId?: string | null;
  veterinaryProducts?: ProdutoVeterinarioCatalogEntry[] | null;
  transitChecklist: TransitChecklistDraft;
  asOfDate: string;
};

export function resolveProtocolProductSelectionFromCatalog(input: {
  payload: Record<string, unknown> | null | undefined;
  productName: string;
  sanitaryType: SanitarioTipoEnum;
  veterinaryProducts?: ProdutoVeterinarioCatalogEntry[] | null;
}): VeterinaryProductSelection | null {
  const fromPayload = readVeterinaryProductSelection(input.payload);
  if (fromPayload) return fromPayload;

  const resolved = resolveVeterinaryProductByName(
    input.productName,
    input.veterinaryProducts ?? [],
    {
      sanitaryType: input.sanitaryType,
    },
  );

  if (!resolved.product) return null;

  return {
    id: resolved.product.id,
    nome: resolved.product.nome,
    categoria: resolved.product.categoria,
    origem: "catalogo_automatico",
    matchMode: resolved.matchMode,
  };
}

const isFinanceiroSaidaNatureza = (
  natureza: RegistrarPackageFinanceiroNatureza,
) =>
  natureza === "venda" ||
  natureza === "sociedade_saida" ||
  natureza === "doacao_saida";

const shouldShowTransitChecklist = (input: {
  tipoManejo: string | null;
  financeiroNatureza: RegistrarPackageFinanceiroNatureza;
}) =>
  input.tipoManejo === "movimentacao" ||
  (input.tipoManejo === "financeiro" &&
    isFinanceiroSaidaNatureza(input.financeiroNatureza));

const readStringArray = (
  payload: Record<string, unknown> | null | undefined,
  key: string,
): string[] => {
  const value = payload?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
};

const hasOfficialTransitChecklistEnabled = (
  config: Record<string, unknown> | null,
) => {
  const payload = config?.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  return readStringArray(
    payload as Record<string, unknown>,
    "activated_template_slugs",
  ).includes("transito-gta-precheck");
};

function buildProtocolEligibilityIssues(input: {
  tipoManejo: string | null;
  selectedProtocolCompatibleWithAll: boolean | null;
}) {
  if (
    input.tipoManejo !== "sanitario" ||
    input.selectedProtocolCompatibleWithAll === null ||
    input.selectedProtocolCompatibleWithAll
  ) {
    return [];
  }

  return ["O item de protocolo escolhido nao atende todos os animais selecionados."];
}

function buildSanitaryMovementBlockIssues(input: {
  showsTransitChecklist: boolean;
  blockedAnimals: Array<{ animal: Pick<Animal, "identificacao"> }>;
}) {
  if (!input.showsTransitChecklist || input.blockedAnimals.length === 0) {
    return [];
  }

  const firstBlocked = input.blockedAnimals[0];
  if (!firstBlocked) return [];

  return [
    input.blockedAnimals.length === 1
      ? `${firstBlocked.animal.identificacao} esta com suspeita sanitaria aberta e nao pode sair da fazenda.`
      : `${input.blockedAnimals.length} animal(is) do recorte atual estao com suspeita sanitaria aberta e bloqueio de movimentacao.`,
  ];
}

function buildComplianceFlowIssues(input: {
  tipoManejo: string | null;
  financeiroNatureza: RegistrarPackageFinanceiroNatureza;
  movementBlockers: Array<{ message: string }>;
  nutritionBlockers: Array<{ message: string }>;
}) {
  if (input.tipoManejo === "nutricao") {
    return input.nutritionBlockers.map((guard) => guard.message);
  }

  if (
    input.tipoManejo === "movimentacao" ||
    (input.tipoManejo === "financeiro" &&
      isFinanceiroSaidaNatureza(input.financeiroNatureza))
  ) {
    return input.movementBlockers.map((guard) => guard.message);
  }

  return [];
}

export function resolveRegistrarSanitaryPackage(
  input: ResolveRegistrarSanitaryPackageInput,
): RegistrarSanitaryPackage {
  const veterinaryProducts = input.veterinaryProducts ?? [];
  const protocolos = input.protocolos ?? [];
  const protocoloItens = input.protocoloItens ?? [];
  const selectedVeterinaryProduct =
    veterinaryProducts.find(
      (product) => product.id === input.selectedVeterinaryProductId,
    ) ?? null;
  const selectedVeterinaryProductSelection =
    selectedVeterinaryProduct === null
      ? null
      : {
          id: selectedVeterinaryProduct.id,
          nome: selectedVeterinaryProduct.nome,
          categoria: selectedVeterinaryProduct.categoria,
          origem: "catalogo" as const,
        };

  const protocolosById = new Map(
    protocolos.map((protocolo) => [protocolo.id, protocolo]),
  );
  const protocoloItensEvaluated = protocoloItens
    .map((item) => {
      const protocolo = protocolosById.get(item.protocolo_id) ?? null;
      const eligibility = evaluateSanitaryProtocolEligibility(
        item,
        input.selectedAnimaisDetalhes,
        protocolo,
      );

      return {
        item,
        protocolo,
        eligibility,
      };
    })
    .sort((left, right) => {
      if (
        left.eligibility.compatibleWithAll !==
        right.eligibility.compatibleWithAll
      ) {
        return left.eligibility.compatibleWithAll ? -1 : 1;
      }

      return (left.item.dose_num ?? 0) - (right.item.dose_num ?? 0);
    });
  const selectedProtocoloItemEvaluation =
    input.protocoloItemId === null || input.protocoloItemId === undefined
      ? null
      : protocoloItensEvaluated.find(
          ({ item }) => item.id === input.protocoloItemId,
        ) ?? null;
  const protocoloItem = selectedProtocoloItemEvaluation?.item ?? null;
  const selectedProtocolRestrictionsText = selectedProtocoloItemEvaluation
    ? formatSanitaryProtocolRestrictions(
        selectedProtocoloItemEvaluation.eligibility.restrictions,
      )
    : null;
  const selectedProtocolPrimaryReason =
    selectedProtocoloItemEvaluation?.eligibility.reasons[0] ?? null;
  const allProtocolItemsIneligible =
    protocoloItensEvaluated.length > 0 &&
    protocoloItensEvaluated.every(
      ({ eligibility }) => !eligibility.compatibleWithAll,
    );
  const protocolEligibilityIssues = buildProtocolEligibilityIssues({
    tipoManejo: input.tipoManejo,
    selectedProtocolCompatibleWithAll:
      selectedProtocoloItemEvaluation?.eligibility.compatibleWithAll ?? null,
  });

  const showsTransitChecklist = shouldShowTransitChecklist({
    tipoManejo: input.tipoManejo,
    financeiroNatureza: input.financeiroNatureza,
  });
  const officialTransitChecklistEnabled = hasOfficialTransitChecklistEnabled(
    input.regulatorySurfaceConfig,
  );
  const isExternalTransitContext =
    showsTransitChecklist && input.transitChecklist.enabled;
  const movementComplianceGuards =
    showsTransitChecklist || input.tipoManejo === "movimentacao"
      ? isExternalTransitContext
        ? input.regulatoryReadModel.flows.movementExternal
        : input.regulatoryReadModel.flows.movementInternal
      : EMPTY_REGULATORY_OPERATIONAL_READ_MODEL.flows.movementInternal;
  const nutritionComplianceGuards =
    input.tipoManejo === "nutricao"
      ? input.regulatoryReadModel.flows.nutrition
      : EMPTY_REGULATORY_OPERATIONAL_READ_MODEL.flows.nutrition;
  const transitChecklistIssues = showsTransitChecklist
    ? validateTransitChecklist(input.transitChecklist, input.asOfDate)
    : [];
  const movementSensitiveAnimals = !showsTransitChecklist
    ? []
    : input.selectedAnimaisDetalhes.length > 0
      ? input.selectedAnimaisDetalhes
      : input.animaisNoLote ?? [];
  const animalsBlockedBySanitaryAlert = listAnimalsBlockedBySanitaryAlert(
    movementSensitiveAnimals,
  );
  const sanitaryMovementBlockIssues = buildSanitaryMovementBlockIssues({
    showsTransitChecklist,
    blockedAnimals: animalsBlockedBySanitaryAlert,
  });
  const complianceFlowIssues = buildComplianceFlowIssues({
    tipoManejo: input.tipoManejo,
    financeiroNatureza: input.financeiroNatureza,
    movementBlockers: movementComplianceGuards.blockers,
    nutritionBlockers: nutritionComplianceGuards.blockers,
  });

  const sanitaryProductPayload = buildSanitaryExecutionPayload({
    isSanitaryExecution: input.tipoManejo === "sanitario",
    protocoloItem,
    typedProductName: input.sanitarioData.produto,
    selectedVeterinaryProductSelection,
    resolveProtocolProductSelection: (payload, productName, sanitaryType) =>
      resolveProtocolProductSelectionFromCatalog({
        payload,
        productName,
        sanitaryType,
        veterinaryProducts,
      }),
  });

  return {
    isSanitary: input.tipoManejo === "sanitario",
    protocoloItem,
    selectedVeterinaryProduct,
    selectedVeterinaryProductSelection,
    hasVeterinaryProducts: veterinaryProducts.length > 0,
    isVeterinaryProductsEmpty:
      Array.isArray(input.veterinaryProducts) && veterinaryProducts.length === 0,
    veterinaryProductSuggestions: searchVeterinaryProducts(veterinaryProducts, {
      query: input.sanitarioData.produto,
      sanitaryType: input.sanitarioData.tipo,
      limit: 6,
    }),
    protocoloItensEvaluated,
    selectedProtocoloItemEvaluation,
    selectedProtocolRestrictionsText,
    selectedProtocolPrimaryReason,
    allProtocolItemsIneligible,
    protocolEligibilityIssues,
    sanitatioProductMissing: input.sanitarioData.produto.trim().length === 0,
    showsTransitChecklist,
    officialTransitChecklistEnabled,
    animalsBlockedBySanitaryAlert,
    sanitaryMovementBlockIssues,
    movementComplianceGuards,
    nutritionComplianceGuards,
    transitChecklistIssues,
    complianceFlowIssues,
    warnings: [],
    ...sanitaryProductPayload,
  };
}
