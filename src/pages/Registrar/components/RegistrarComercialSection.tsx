import {
  Fragment,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Animal, Contraparte } from "@/lib/offline/types";
import type { AnimalBreedEnum } from "@/lib/animals/catalogs";
import type { AnimalSpeciesEnum } from "@/lib/animals/species";
import { ANIMAL_BREED_OPTIONS } from "@/lib/animals/catalogs";
import { ANIMAL_SPECIES_OPTIONS } from "@/lib/animals/species";
import type { CommercialNewAnimalDraft } from "@/lib/comercial/commercialOperationCommand";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Info,
  AlertTriangle,
  AlertCircle,
  Scale,
  Lock,
  Pencil,
  Plus,
  Copy,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { FinanceiroContraparteSection } from "@/pages/Registrar/components/FinanceiroContraparteSection";
import { RegistrarSociedadeSection } from "@/pages/Registrar/components/RegistrarSociedadeSection";
import type { RegistrarNovaContraparteDraft } from "@/pages/Registrar/effects/contraparteCreate";
import { calculateCommercialOperation } from "@/lib/comercial/commercialOperation";
import {
  calculateCommercialPricingLine,
  calculateEffectiveArrobaPrices,
  resolveCommercialWeightUnit,
  sumCommercialArrobas,
  sumCommercialPricingValues,
  switchCommercialWeightUnit,
  type CommercialArrobaBasis,
  type CommercialPricingMode,
} from "@/lib/comercial/commercialPricing";
import { resolveAnimalClassificationSnapshot } from "@/lib/animals/classificationSnapshot";
import { cn } from "@/lib/utils";
import type { RegistrarTargetMode } from "@/pages/Registrar/helpers/commercialForm";
import {
  formatCommercialBirthAge,
  resolvePurchaseQuantity,
} from "@/pages/Registrar/helpers/commercialForm";
import {
  distributeCommercialInput,
  parseOptionalCommercialNumber,
  sumCommercialInputs,
} from "@/pages/Registrar/helpers/commercialLineDistribution";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComercialFormData = {
  operationType: "compra" | "venda" | "sociedade";
  scope: "animal" | "lote";
  occurredAt: string;
  /** Usado apenas no scope=lote */
  quantidadeAnimais: string;
  /** Peso total agregado (pré-preenchido da soma dos últimos pesos; editável) */
  commercialWeightTotal: string;
  valorBruto: string;
  frete: string;
  comissao: string;
  descontos: string;
  taxasImpostos: string;
  bonificacoes: string;
  contraparteId: string;
  financeTransactionId: string;
  observacoes: string;
  /** Peso individual por animal (scope=animal) — chave = animal.id */
  pesosPorAnimal: Record<string, string>;
  /** Valor individual por animal (scope=animal) — chave = animal.id */
  valoresPorAnimal: Record<string, string>;
  newAnimals: CommercialNewAnimalDraft[];
  commonSpecies: AnimalSpeciesEnum | "none";
  commonBreed: AnimalBreedEnum | "none";
  commonEntryDate: string;
  saleSnapshotIds: string[];
  purchaseDestinationLotId: string;
  pricingMode: CommercialPricingMode;
  pricePerArroba: string;
  arrobaBasis: CommercialArrobaBasis | null;
  carcassYieldPercent: string;
};

type AnimalWithLastWeight = {
  id: string;
  identificacao: string;
  nome: string | null;
  lastWeightKg: number | null;
  categoria: string;
  sexo: "M" | "F";
  dataNascimento: string | null;
};

type RegistrarComercialSectionProps = {
  fazendaId: string;
  comercialData: ComercialFormData;
  updateComercialData: <K extends keyof ComercialFormData>(
    field: K,
    value: ComercialFormData[K],
  ) => void;
  selectedAnimalIds: string[];
  /** Animais do lote com peso pré-carregado (passado do index) */
  animaisComPeso: AnimalWithLastWeight[];
  contrapartes: Contraparte[] | undefined;
  canManageContraparte: boolean;
  showNovaContraparte: boolean;
  onToggleNovaContraparte: () => void;
  novaContraparte: RegistrarNovaContraparteDraft;
  onNovaContraparteFieldChange: (
    field: keyof RegistrarNovaContraparteDraft,
    value: string,
  ) => void;
  onCreateContraparte: () => void;
  isSavingContraparte: boolean;
  onNavigateContrapartes: () => void;
  financeTransactions:
    | Array<{
        id: string;
        occurred_at: string;
        direction: string;
        valor: number;
        description?: string;
      }>
    | undefined;
  transitChecklistSection?: ReactNode;
  sanitaryMovementBlockSection?: ReactNode;
  currentLotActiveAnimalIds?: string[];
  targetMode: RegistrarTargetMode | null;
  targetLotId: string | null;
  lotes: Array<{ id: string; nome: string }>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtAnimalLabel(a: AnimalWithLastWeight) {
  return a.nome ? `${a.identificacao} (${a.nome})` : a.identificacao;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegistrarComercialSection(
  props: RegistrarComercialSectionProps,
) {
  const {
    fazendaId,
    comercialData,
    updateComercialData,
    selectedAnimalIds,
    animaisComPeso,
    contrapartes,
    canManageContraparte,
    showNovaContraparte,
    onToggleNovaContraparte,
    novaContraparte,
    onNovaContraparteFieldChange,
    onCreateContraparte,
    isSavingContraparte,
    onNavigateContrapartes,
    financeTransactions,
    transitChecklistSection,
    sanitaryMovementBlockSection,
    currentLotActiveAnimalIds,
    targetMode,
    targetLotId,
    lotes,
  } = props;

  const isAnimalScope = comercialData.scope === "animal";
  const hasAnimals = selectedAnimalIds.length > 0;
  const purchase = comercialData.operationType === "compra";
  const newAnimals = comercialData.newAnimals;
  const commonSpecies = comercialData.commonSpecies ?? "none";
  const commonBreed = comercialData.commonBreed ?? "none";
  const commonEntryDate = comercialData.commonEntryDate ?? "";
  const saleSnapshotIds = comercialData.saleSnapshotIds;
  const lotActiveIds = currentLotActiveAnimalIds ?? [];
  const [expandedPurchaseRows, setExpandedPurchaseRows] = useState<Set<string>>(
    new Set(),
  );
  const commercialWeightUnit = resolveCommercialWeightUnit(
    comercialData.pricingMode,
    comercialData.arrobaBasis,
  );
  const previousWeightUnit = useRef(commercialWeightUnit);

  const weightUnitSymbol = commercialWeightUnit === "arroba" ? "@" : "kg";
  const distributeDisplayedWeight = (
    totalDisplay: string,
    lineIds: readonly string[],
  ) => distributeCommercialInput(totalDisplay, lineIds);

  const calculatePricing = (
    commercialWeight: string | number | null | undefined,
    pricePerHead: string | number | null | undefined,
    overrides: Partial<
      Pick<
        ComercialFormData,
        "pricingMode" | "pricePerArroba" | "arrobaBasis" | "carcassYieldPercent"
      >
    > = {},
  ) =>
    calculateCommercialPricingLine({
      pricingMode: overrides.pricingMode ?? comercialData.pricingMode,
      commercialWeight: {
        unit: commercialWeightUnit,
        amount: commercialWeight,
      },
      pricePerHead,
      pricePerArroba: overrides.pricePerArroba ?? comercialData.pricePerArroba,
      arrobaBasis: overrides.arrobaBasis ?? comercialData.arrobaBasis,
      carcassYieldPercent:
        overrides.carcassYieldPercent ?? comercialData.carcassYieldPercent,
    });

  const repricePurchaseLines = (
    lines: CommercialNewAnimalDraft[],
    overrides: Parameters<typeof calculatePricing>[2] = {},
  ) => {
    const calculations = lines.map((line) =>
      calculatePricing(line.commercialWeight, null, overrides),
    );
    const next = lines.map((line, index) => ({
      ...line,
      valorIndividual: calculations[index]!.individualGrossValue,
    }));
    updateComercialData("newAnimals", next);
    updateComercialData(
      "valorBruto",
      sumCommercialPricingValues(calculations)?.input ?? "",
    );
  };

  const repriceExistingLines = (
    weights: Record<string, string>,
    lineIds: readonly string[],
    overrides: Parameters<typeof calculatePricing>[2] = {},
  ) => {
    const calculations = lineIds.map((id) =>
      calculatePricing(weights[id] ?? "", null, overrides),
    );
    updateComercialData(
      "valoresPorAnimal",
      Object.fromEntries(
        lineIds.map((id, index) => [
          id,
          calculations[index]!.individualGrossValueInput,
        ]),
      ),
    );
    updateComercialData(
      "valorBruto",
      sumCommercialPricingValues(calculations)?.input ?? "",
    );
  };

  const resizePurchaseGrid = (
    quantity: number,
    scope = comercialData.scope,
  ) => {
    const safe = resolvePurchaseQuantity(scope, quantity);
    const next = Array.from(
      { length: safe },
      (_, index) =>
        newAnimals[index] ?? {
          localId: crypto.randomUUID(),
          identificacao: "",
          sexo: "F" as const,
          especie: commonSpecies === "none" ? null : commonSpecies,
          raca: commonBreed === "none" ? null : commonBreed,
          dataNascimento: "",
          dataEntrada: commonEntryDate || null,
          commercialWeight: null,
          valorIndividual: null,
        },
    );
    const currentDisplayTotal =
      sumCommercialInputs(
        newAnimals.map((item) =>
          item.commercialWeight === null || item.commercialWeight === undefined
            ? ""
            : String(item.commercialWeight),
        ),
      ) || comercialData.commercialWeightTotal;
    const distributedWeights = distributeDisplayedWeight(
      currentDisplayTotal,
      next.map((item) => item.localId),
    );
    const distributedValues =
      comercialData.pricingMode !== "per_arroba"
        ? distributeCommercialInput(
            comercialData.valorBruto,
            next.map((item) => item.localId),
          )
        : {};
    updateComercialData(
      "newAnimals",
      next.map((item) => ({
        ...item,
        commercialWeight: parseOptionalCommercialNumber(
          distributedWeights[item.localId] ?? "",
        ),
        valorIndividual:
          comercialData.pricingMode !== "per_arroba"
            ? parseOptionalCommercialNumber(
                distributedValues[item.localId] ?? "",
              )
            : calculatePricing(distributedWeights[item.localId] ?? "", null)
                .individualGrossValue,
      })),
    );
    updateComercialData("quantidadeAnimais", String(safe));
    if (comercialData.pricingMode === "per_arroba") {
      const calculations = next.map((item) =>
        calculatePricing(distributedWeights[item.localId] ?? "", null),
      );
      updateComercialData(
        "valorBruto",
        sumCommercialPricingValues(calculations)?.input ?? "",
      );
    }
  };

  const updateNewAnimal = (
    localId: string,
    patch: Partial<CommercialNewAnimalDraft>,
  ) => {
    updateComercialData(
      "newAnimals",
      newAnimals.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item,
      ),
    );
  };

  const replacePurchaseLines = (lines: CommercialNewAnimalDraft[]) => {
    const lineIds = lines.map((item) => item.localId);
    const currentDisplayTotal =
      sumCommercialInputs(
        newAnimals.map((item) =>
          item.commercialWeight === null || item.commercialWeight === undefined
            ? ""
            : String(item.commercialWeight),
        ),
      ) || comercialData.commercialWeightTotal;
    const distributedWeights = distributeDisplayedWeight(
      currentDisplayTotal,
      lineIds,
    );
    const distributedValues = distributeCommercialInput(
      comercialData.valorBruto,
      lineIds,
    );
    const redistributed = lines.map((item) => ({
      ...item,
      commercialWeight: parseOptionalCommercialNumber(
        distributedWeights[item.localId] ?? "",
      ),
      valorIndividual:
        comercialData.pricingMode !== "per_arroba"
          ? parseOptionalCommercialNumber(distributedValues[item.localId] ?? "")
          : item.valorIndividual,
    }));
    updateComercialData("quantidadeAnimais", String(lines.length));
    if (comercialData.pricingMode === "per_arroba") {
      repricePurchaseLines(redistributed);
      return;
    }
    updateComercialData("newAnimals", redistributed);
  };

  const commercialLineIds = useMemo(
    () =>
      purchase
        ? newAnimals.map((item) => item.localId)
        : isAnimalScope
          ? selectedAnimalIds
          : saleSnapshotIds,
    [isAnimalScope, newAnimals, purchase, saleSnapshotIds, selectedAnimalIds],
  );
  const displayedWeights = Object.fromEntries(
    commercialLineIds.map((id) => {
      const draft = purchase
        ? newAnimals.find((item) => item.localId === id)
        : null;
      return [
        id,
        purchase
          ? draft?.commercialWeight === null ||
            draft?.commercialWeight === undefined
            ? ""
            : String(draft.commercialWeight)
          : (comercialData.pesosPorAnimal[id] ?? ""),
      ];
    }),
  );
  const displayedWeightTotal = sumCommercialInputs(
    commercialLineIds.map((id) => displayedWeights[id] ?? ""),
  );

  const pricingCalculations = useMemo(
    () =>
      Object.fromEntries(
        commercialLineIds.map((id) => {
          const draft = purchase
            ? newAnimals.find((item) => item.localId === id)
            : null;
          return [
            id,
            calculateCommercialPricingLine({
              pricingMode: comercialData.pricingMode,
              commercialWeight: {
                unit: commercialWeightUnit,
                amount: purchase
                  ? draft?.commercialWeight
                  : (comercialData.pesosPorAnimal[id] ?? ""),
              },
              pricePerHead: purchase
                ? draft?.valorIndividual
                : (comercialData.valoresPorAnimal[id] ?? ""),
              pricePerArroba: comercialData.pricePerArroba,
              arrobaBasis: comercialData.arrobaBasis,
              carcassYieldPercent: comercialData.carcassYieldPercent,
            }),
          ];
        }),
      ),
    [
      commercialLineIds,
      comercialData,
      commercialWeightUnit,
      newAnimals,
      purchase,
    ],
  );
  const pricingIssue = Object.values(pricingCalculations).find(
    (item) => item.issue,
  )?.issue;

  const handleAggregateChange = (
    field: "commercialWeightTotal" | "valorBruto",
    value: string,
  ) => {
    const distributed =
      field === "commercialWeightTotal"
        ? distributeDisplayedWeight(value, commercialLineIds)
        : distributeCommercialInput(value, commercialLineIds);
    updateComercialData(field, value);
    if (purchase) {
      const lineField =
        field === "commercialWeightTotal"
          ? "commercialWeight"
          : "valorIndividual";
      const next = newAnimals.map((item) => ({
        ...item,
        [lineField]: parseOptionalCommercialNumber(
          distributed[item.localId] ?? "",
        ),
      }));
      if (
        field === "commercialWeightTotal" &&
        comercialData.pricingMode === "per_arroba"
      ) {
        repricePurchaseLines(next);
      } else {
        updateComercialData("newAnimals", next);
      }
      return;
    }
    const targetField =
      field === "commercialWeightTotal" ? "pesosPorAnimal" : "valoresPorAnimal";
    updateComercialData(targetField, distributed);
    if (
      field === "commercialWeightTotal" &&
      comercialData.pricingMode === "per_arroba"
    ) {
      repriceExistingLines(distributed, commercialLineIds);
    }
  };

  const updatePurchaseLineNumber = (
    localId: string,
    field: "commercialWeight" | "valorIndividual",
    value: string,
  ) => {
    const canonicalValue = parseOptionalCommercialNumber(value);
    const next = newAnimals.map((item) =>
      item.localId === localId ? { ...item, [field]: canonicalValue } : item,
    );
    if (
      field === "commercialWeight" &&
      comercialData.pricingMode === "per_arroba"
    ) {
      repricePurchaseLines(next);
    } else {
      updateComercialData("newAnimals", next);
    }
    updateComercialData(
      field === "commercialWeight" ? "commercialWeightTotal" : "valorBruto",
      field === "commercialWeight"
        ? sumCommercialInputs(
            next.map((item) =>
              item.commercialWeight === null ||
              item.commercialWeight === undefined
                ? ""
                : String(item.commercialWeight),
            ),
          )
        : sumCommercialInputs(
            next.map((item) => {
              const current = item[field];
              return current === null || current === undefined
                ? ""
                : String(current);
            }),
          ),
    );
  };

  const updateExistingLineNumber = (
    id: string,
    field: "pesosPorAnimal" | "valoresPorAnimal",
    value: string,
  ) => {
    const canonicalValue = parseOptionalCommercialNumber(value);
    const next = {
      ...comercialData[field],
      [id]: canonicalValue === null ? "" : String(canonicalValue),
    };
    updateComercialData(field, next);
    if (
      field === "pesosPorAnimal" &&
      comercialData.pricingMode === "per_arroba"
    ) {
      repriceExistingLines(next, commercialLineIds);
    }
    updateComercialData(
      field === "pesosPorAnimal" ? "commercialWeightTotal" : "valorBruto",
      field === "pesosPorAnimal"
        ? sumCommercialInputs(
            commercialLineIds.map((lineId) => next[lineId] ?? ""),
          )
        : sumCommercialInputs(
            commercialLineIds.map((lineId) => next[lineId] ?? ""),
          ),
    );
  };

  const handlePricingModeChange = (pricingMode: CommercialPricingMode) => {
    const shouldClearWeights = comercialData.pricingMode !== pricingMode;
    updateComercialData("pricingMode", pricingMode);
    updateComercialData("pricePerArroba", "");
    updateComercialData("arrobaBasis", null);
    updateComercialData("carcassYieldPercent", "");
    updateComercialData("valorBruto", "");
    if (shouldClearWeights) {
      updateComercialData("commercialWeightTotal", "");
      updateComercialData("pesosPorAnimal", {});
    }
    if (purchase) {
      updateComercialData(
        "newAnimals",
        newAnimals.map((item) => ({
          ...item,
          commercialWeight: shouldClearWeights ? null : item.commercialWeight,
          valorIndividual: null,
        })),
      );
    } else {
      updateComercialData(
        "valoresPorAnimal",
        Object.fromEntries(commercialLineIds.map((id) => [id, ""])),
      );
    }
  };

  const handleArrobaConfigChange = <
    K extends "pricePerArroba" | "arrobaBasis" | "carcassYieldPercent",
  >(
    field: K,
    value: ComercialFormData[K],
  ) => {
    updateComercialData(field, value);
    const overrides = { [field]: value } as Parameters<
      typeof calculatePricing
    >[2];
    if (field === "arrobaBasis") {
      const replacesExistingBasis = comercialData.arrobaBasis !== value;
      if (value === "carcass_weight") {
        updateComercialData("carcassYieldPercent", "");
        overrides.carcassYieldPercent = "";
      }
      if (replacesExistingBasis) {
        updateComercialData("commercialWeightTotal", "");
        if (purchase) {
          repricePurchaseLines(
            newAnimals.map((item) => ({ ...item, commercialWeight: null })),
            overrides,
          );
        } else {
          const emptyWeights = Object.fromEntries(
            commercialLineIds.map((id) => [id, ""]),
          );
          updateComercialData("pesosPorAnimal", emptyWeights);
          repriceExistingLines(emptyWeights, commercialLineIds, overrides);
        }
      } else if (purchase) {
        repricePurchaseLines(newAnimals, overrides);
      } else {
        repriceExistingLines(
          comercialData.pesosPorAnimal,
          commercialLineIds,
          overrides,
        );
      }
      return;
    }
    if (purchase) repricePurchaseLines(newAnimals, overrides);
    else
      repriceExistingLines(
        comercialData.pesosPorAnimal,
        commercialLineIds,
        overrides,
      );
  };

  useEffect(() => {
    if (previousWeightUnit.current === commercialWeightUnit) return;
    const previousUnit = previousWeightUnit.current;
    previousWeightUnit.current = commercialWeightUnit;
    updateComercialData("commercialWeightTotal", "");
    updateComercialData("pesosPorAnimal", {});
    updateComercialData("arrobaBasis", null);
    updateComercialData("carcassYieldPercent", "");
    if (comercialData.pricingMode === "per_arroba") {
      updateComercialData("valorBruto", "");
    }
    updateComercialData(
      "newAnimals",
      newAnimals.map((item) => ({
        ...item,
        commercialWeight: switchCommercialWeightUnit(
          { unit: previousUnit, amount: item.commercialWeight },
          commercialWeightUnit,
        ).amount,
        valorIndividual:
          comercialData.pricingMode === "per_arroba"
            ? null
            : item.valorIndividual,
      })),
    );
  }, [
    comercialData.pricingMode,
    newAnimals,
    updateComercialData,
    commercialWeightUnit,
  ]);

  // ---------------------------------------------------------------------------
  // Auto-fill: quando scope muda para "animal" e há animais selecionados,
  // pré-preenche pesos comerciais em kg a partir dos últimos pesos zootécnicos
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (
      purchase ||
      commercialWeightUnit !== "kg" ||
      commercialLineIds.length === 0 ||
      (comercialData.pricingMode !== "per_head" &&
        comercialData.arrobaBasis === "carcass_weight")
    )
      return;

    const newPesosPorAnimal: Record<string, string> = {};
    let total = 0;
    let hasSomeWeight = false;

    let changed = false;
    for (const id of commercialLineIds) {
      const a = animaisComPeso.find((x) => x.id === id);
      const existing = comercialData.pesosPorAnimal[id];
      if (existing !== undefined) {
        // já preenchido — preservar
        newPesosPorAnimal[id] = existing;
        const v = parseFloat(existing);
        if (!isNaN(v) && v >= 0) {
          total += v;
          hasSomeWeight = true;
        }
      } else if (a?.lastWeightKg != null) {
        newPesosPorAnimal[id] = String(a.lastWeightKg);
        total += a.lastWeightKg;
        hasSomeWeight = true;
        changed = true;
      } else {
        newPesosPorAnimal[id] = "";
        changed = true;
      }
    }

    if (changed) {
      updateComercialData("pesosPorAnimal", newPesosPorAnimal);
      if (comercialData.pricingMode !== "per_head") {
        repriceExistingLines(newPesosPorAnimal, commercialLineIds);
      }
    }

    // Só sobrescreve o total comercial se ainda não foi editado manualmente
    if (hasSomeWeight && comercialData.commercialWeightTotal === "") {
      updateComercialData("commercialWeightTotal", String(total.toFixed(2)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    commercialLineIds,
    animaisComPeso,
    comercialData.arrobaBasis,
    comercialData.pricingMode,
    purchase,
    commercialWeightUnit,
  ]);

  // ---------------------------------------------------------------------------
  // Cálculo do resumo de operação
  // ---------------------------------------------------------------------------
  const calculationSummary = useMemo(() => {
    if (comercialData.operationType === "sociedade") {
      return {
        calculationStatus: "complete" as const,
        issues: [],
        limitations: [],
        snapshot: {},
      };
    }

    const qty =
      comercialData.operationType === "compra"
        ? newAnimals.length
        : commercialLineIds.length;

    const peso =
      parseOptionalCommercialNumber(comercialData.commercialWeightTotal) ?? 0;
    const bruto = parseOptionalCommercialNumber(comercialData.valorBruto) ?? 0;
    const frete = parseOptionalCommercialNumber(comercialData.frete) ?? 0;
    const comissao = parseOptionalCommercialNumber(comercialData.comissao) ?? 0;
    const descontos =
      parseOptionalCommercialNumber(comercialData.descontos) ?? 0;
    const taxas =
      parseOptionalCommercialNumber(comercialData.taxasImpostos) ?? 0;
    const bonificacoes =
      parseOptionalCommercialNumber(comercialData.bonificacoes) ?? 0;

    const contraparte = contrapartes?.find(
      (c) => c.id === comercialData.contraparteId,
    );

    return calculateCommercialOperation({
      operationType: comercialData.operationType,
      scope: comercialData.scope,
      occurredAt: comercialData.occurredAt,
      quantidadeAnimais: qty > 0 ? qty : undefined,
      pesoVivoTotal:
        comercialData.commercialWeightTotal !== "" &&
        commercialWeightUnit === "kg" &&
        comercialData.arrobaBasis !== "carcass_weight"
          ? peso
          : undefined,
      valorBruto: comercialData.valorBruto !== "" ? bruto : undefined,
      frete: comercialData.frete !== "" ? frete : undefined,
      comissao: comercialData.comissao !== "" ? comissao : undefined,
      descontos: comercialData.descontos !== "" ? descontos : undefined,
      taxasImpostos: comercialData.taxasImpostos !== "" ? taxas : undefined,
      bonificacoes:
        comercialData.bonificacoes !== "" ? bonificacoes : undefined,
      contraparteId:
        comercialData.contraparteId !== "none"
          ? comercialData.contraparteId
          : undefined,
      contraparteNome: contraparte?.nome,
      financeTransactionId:
        comercialData.financeTransactionId !== "none"
          ? comercialData.financeTransactionId
          : undefined,
      animalIds: commercialLineIds,
      loteId: purchase
        ? comercialData.purchaseDestinationLotId || undefined
        : (targetLotId ?? undefined),
    });
  }, [
    comercialData,
    commercialLineIds,
    contrapartes,
    newAnimals.length,
    purchase,
    targetLotId,
    commercialWeightUnit,
  ]);
  const totalArrobas = useMemo(
    () => sumCommercialArrobas(Object.values(pricingCalculations)),
    [pricingCalculations],
  );
  const effectiveArrobaPrices = useMemo(
    () =>
      totalArrobas
        ? calculateEffectiveArrobaPrices({
            totalArrobas: totalArrobas.value,
            grossValue: comercialData.valorBruto,
            netValue: calculationSummary.valorLiquidoDerivado,
          })
        : null,
    [
      calculationSummary.valorLiquidoDerivado,
      comercialData.valorBruto,
      totalArrobas,
    ],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
      {/* Tipo de Operação (Sempre Visível) */}
      <div className="space-y-3">
        <Label>Tipo de Operação</Label>
        <div className="flex gap-2">
          {(
            [
              { value: "compra", label: "Compra" },
              { value: "venda", label: "Venda" },
              { value: "sociedade", label: "Sociedade" },
            ] as const
          ).map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={
                comercialData.operationType === opt.value
                  ? "default"
                  : "outline"
              }
              onClick={() => {
                updateComercialData("operationType", opt.value);
                if (opt.value === "compra") {
                  resizePurchaseGrid(
                    Number(comercialData.quantidadeAnimais),
                    comercialData.scope,
                  );
                  updateComercialData("saleSnapshotIds", []);
                } else if (opt.value === "venda") {
                  const nextScope =
                    selectedAnimalIds.length === 1 ? "animal" : "lote";
                  updateComercialData("scope", nextScope);
                  updateComercialData(
                    "quantidadeAnimais",
                    String(
                      nextScope === "animal"
                        ? selectedAnimalIds.length
                        : saleSnapshotIds.length,
                    ),
                  );
                }
              }}
              disabled={
                (opt.value === "venda" &&
                  (targetMode !== "existing" ||
                    (selectedAnimalIds.length === 0 && !targetLotId))) ||
                (opt.value === "sociedade" && selectedAnimalIds.length === 0)
              }
              className="rounded-full shadow-none flex-1"
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Compra e venda sao registros manuais informados pelo usuario; nao
          validam aptidao comercial.
        </p>
      </div>

      {comercialData.operationType === "sociedade" ? (
        <RegistrarSociedadeSection
          selectedAnimalIds={selectedAnimalIds}
          contrapartes={contrapartes}
          fazendaId={fazendaId}
        />
      ) : (
        <Tabs defaultValue="operacao" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50 p-1">
            <TabsTrigger value="operacao" className="rounded-md">
              Dados Operacionais
            </TabsTrigger>
            <TabsTrigger value="detalhes" className="rounded-md">
              Envolvidos &amp; Vínculos
            </TabsTrigger>
          </TabsList>

          {/* ---------------------------------------------------------------- */}
          {/* Tab 1: Dados Operacionais */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent
            value="operacao"
            className="space-y-5 focus-visible:outline-none"
          >
            <div className="space-y-3 rounded-xl border border-border/60 bg-background/50 p-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                <p className="font-semibold">Simulação comercial</p>
                <p>
                  Ajuste cotação, peso, rendimento, despesas e bonificações. O
                  fato comercial e o estado dos animais só mudam após a
                  confirmação da operação.
                </p>
              </div>
              <Label>Modalidade de preço *</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant={
                    comercialData.pricingMode === "per_head"
                      ? "default"
                      : "outline"
                  }
                  onClick={() => handlePricingModeChange("per_head")}
                >
                  Valor por cabeça
                </Button>
                <Button
                  type="button"
                  variant={
                    comercialData.pricingMode === "per_arroba"
                      ? "default"
                      : "outline"
                  }
                  onClick={() => handlePricingModeChange("per_arroba")}
                >
                  Preço por arroba
                </Button>
                <Button
                  type="button"
                  variant={
                    comercialData.pricingMode === "total_value"
                      ? "default"
                      : "outline"
                  }
                  onClick={() => handlePricingModeChange("total_value")}
                >
                  Valor total
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {comercialData.pricingMode === "per_arroba" ? (
                  <div className="space-y-2">
                    <Label>Preço por arroba (R$) *</Label>
                    <Input
                      aria-label="Preço por arroba"
                      type="number"
                      min="0"
                      step="0.01"
                      value={comercialData.pricePerArroba}
                      onChange={(event) =>
                        handleArrobaConfigChange(
                          "pricePerArroba",
                          event.target.value,
                        )
                      }
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>Quantidade de arrobas</Label>
                  <Select
                    value={comercialData.arrobaBasis ?? "direct"}
                    onValueChange={(value) =>
                      handleArrobaConfigChange(
                        "arrobaBasis",
                        value === "direct"
                          ? null
                          : (value as CommercialArrobaBasis),
                      )
                    }
                  >
                    <SelectTrigger aria-label="Base de cálculo da arroba">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">
                        Informar arrobas diretamente
                      </SelectItem>
                      <SelectItem value="carcass_weight">
                        Calcular pelo peso de carcaça
                      </SelectItem>
                      <SelectItem value="live_weight_yield">
                        Estimar pelo peso vivo e rendimento
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {comercialData.arrobaBasis === "live_weight_yield" ? (
                  <div className="space-y-2">
                    <Label>Rendimento de carcaça (%) *</Label>
                    <Input
                      aria-label="Rendimento de carcaça"
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      value={comercialData.carcassYieldPercent}
                      onChange={(event) =>
                        handleArrobaConfigChange(
                          "carcassYieldPercent",
                          event.target.value,
                        )
                      }
                    />
                  </div>
                ) : comercialData.arrobaBasis === null ? (
                  <p className="self-end text-xs text-muted-foreground">
                    Informe diretamente as arrobas consideradas na negociação.
                  </p>
                ) : null}
              </div>
              {pricingIssue ? (
                <p className="text-xs font-medium text-amber-700">
                  {pricingIssue}
                </p>
              ) : null}
            </div>

            {/* Escopo da Operação */}
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3">
                <Label>Escopo da Operação</Label>
                <div className="flex gap-2">
                  {(
                    [
                      { value: "animal", label: "Animal individual" },
                      { value: "lote", label: "Lote de animais" },
                    ] as const
                  ).map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={
                        comercialData.scope === opt.value
                          ? "default"
                          : "outline"
                      }
                      onClick={() => {
                        updateComercialData("scope", opt.value);
                        updateComercialData("saleSnapshotIds", []);
                        if (purchase) {
                          resizePurchaseGrid(
                            Number(comercialData.quantidadeAnimais),
                            opt.value,
                          );
                        } else {
                          updateComercialData(
                            "quantidadeAnimais",
                            String(
                              opt.value === "animal"
                                ? selectedAnimalIds.length
                                : 0,
                            ),
                          );
                        }
                      }}
                      disabled={
                        !purchase &&
                        ((opt.value === "animal" &&
                          selectedAnimalIds.length !== 1) ||
                          (opt.value === "lote" && !targetLotId))
                      }
                      className="rounded-full shadow-none flex-1"
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isAnimalScope && hasAnimals
                    ? `${selectedAnimalIds.length} animal(is) pré-selecionado(s). Pesos e valores individuais abaixo.`
                    : purchase
                      ? "A compra cria os animais dentro desta operação."
                      : !hasAnimals
                        ? "Sem animais selecionados. Para venda por lote, congele o snapshot abaixo."
                        : null}
                </p>
              </div>
            </div>

            {/* Cabeçalho operacional compacto */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {/* Data da Operação */}
              <div className="space-y-2">
                <Label>Data da operação</Label>
                <Input
                  type="date"
                  value={comercialData.occurredAt}
                  onChange={(e) =>
                    updateComercialData("occurredAt", e.target.value)
                  }
                  className="bg-background"
                />
              </div>

              {/* Quantidade de Animais */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Quantidade de animais
                  {isAnimalScope && (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                </Label>
                <Input
                  aria-label="Quantidade de Animais"
                  type="number"
                  min={purchase && comercialData.scope === "lote" ? "2" : "1"}
                  max={purchase ? "500" : undefined}
                  value={
                    purchase
                      ? String(newAnimals.length)
                      : String(commercialLineIds.length)
                  }
                  disabled={!purchase || isAnimalScope}
                  onChange={(e) =>
                    purchase
                      ? resizePurchaseGrid(Number(e.target.value))
                      : updateComercialData("quantidadeAnimais", e.target.value)
                  }
                  placeholder="Ex: 10"
                  className={cn(
                    "bg-background",
                    isAnimalScope && "opacity-70 cursor-not-allowed",
                  )}
                />
                {isAnimalScope && (
                  <p className="text-[11px] text-muted-foreground">
                    Escopo individual fixo em uma linha
                  </p>
                )}
              </div>

              {/* Peso total na unidade de entrada/exibição */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Peso total ({weightUnitSymbol})
                  {isAnimalScope && hasAnimals && (
                    <Pencil className="h-3 w-3 text-blue-500" />
                  )}
                </Label>
                <Input
                  aria-label={`Peso total (${weightUnitSymbol})`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={comercialData.commercialWeightTotal}
                  onChange={(e) =>
                    handleAggregateChange(
                      "commercialWeightTotal",
                      e.target.value,
                    )
                  }
                  placeholder={
                    commercialWeightUnit === "arroba"
                      ? "Ex: 30.00"
                      : "Ex: 3500.00"
                  }
                  className="bg-background"
                />
                {commercialLineIds.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Alterar o peso total redistribui o valor entre os animais e
                    substitui os pesos individuais atuais.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  O peso comercial não atualiza o peso atual do animal. Registre
                  uma pesagem para atualizar o estado zootécnico.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Valor bruto total</Label>
                <Input
                  aria-label="Valor Bruto (R$)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={comercialData.valorBruto}
                  readOnly={comercialData.pricingMode === "per_arroba"}
                  onChange={(event) =>
                    comercialData.pricingMode !== "per_arroba"
                      ? handleAggregateChange("valorBruto", event.target.value)
                      : undefined
                  }
                  className="bg-background"
                />
                {comercialData.pricingMode === "per_arroba" ? (
                  <p className="text-[11px] text-muted-foreground">
                    Derivado da soma exata das linhas.
                  </p>
                ) : null}
              </div>
            </div>

            {purchase ? (
              <div className="space-y-3 rounded-xl border p-4 bg-background/50">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>
                      Lote de destino
                      {comercialData.scope === "lote" ? " *" : ""}
                    </Label>
                    <Select
                      value={comercialData.purchaseDestinationLotId || "none"}
                      onValueChange={(value) =>
                        updateComercialData(
                          "purchaseDestinationLotId",
                          value === "none" ? "" : value,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sem lote" />
                      </SelectTrigger>
                      <SelectContent>
                        {comercialData.scope === "animal" ? (
                          <SelectItem value="none">Sem lote</SelectItem>
                        ) : null}
                        {lotes.map((lote) => (
                          <SelectItem key={lote.id} value={lote.id}>
                            {lote.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Espécie comum</Label>
                    <Select
                      value={commonSpecies}
                      onValueChange={(value) => {
                        updateComercialData(
                          "commonSpecies",
                          value as ComercialFormData["commonSpecies"],
                        );
                        updateComercialData(
                          "newAnimals",
                          newAnimals.map((item) => ({
                            ...item,
                            especie:
                              value === "none"
                                ? null
                                : (value as AnimalSpeciesEnum),
                          })),
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informada</SelectItem>
                        {ANIMAL_SPECIES_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Raça comum</Label>
                    <Select
                      value={commonBreed}
                      onValueChange={(value) => {
                        updateComercialData(
                          "commonBreed",
                          value as ComercialFormData["commonBreed"],
                        );
                        updateComercialData(
                          "newAnimals",
                          newAnimals.map((item) => ({
                            ...item,
                            raca:
                              value === "none"
                                ? null
                                : (value as AnimalBreedEnum),
                          })),
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não informada</SelectItem>
                        {ANIMAL_BREED_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data de entrada comum</Label>
                    <Input
                      type="date"
                      value={commonEntryDate}
                      onChange={(event) => {
                        updateComercialData(
                          "commonEntryDate",
                          event.target.value,
                        );
                        updateComercialData(
                          "newAnimals",
                          newAnimals.map((item) => ({
                            ...item,
                            dataEntrada: event.target.value || null,
                          })),
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {newAnimals.length} animal(is) na grade
                  </p>
                  {comercialData.scope === "lote" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={newAnimals.length >= 500}
                      onClick={() =>
                        replacePurchaseLines([
                          ...newAnimals,
                          {
                            localId: crypto.randomUUID(),
                            identificacao: "",
                            sexo: "F",
                            especie:
                              commonSpecies === "none" ? null : commonSpecies,
                            raca: commonBreed === "none" ? null : commonBreed,
                            dataNascimento: "",
                            dataEntrada: commonEntryDate || null,
                            commercialWeight: null,
                            valorIndividual: null,
                          },
                        ])
                      }
                    >
                      <Plus className="mr-1 h-4 w-4" /> Adicionar animal
                    </Button>
                  ) : null}
                </div>
                <div className="max-h-80 overflow-auto rounded-lg border">
                  <table className="min-w-[900px] w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-muted">
                      <tr className="border-b text-left text-xs">
                        <th className="p-2">Identificação</th>
                        <th className="p-2">Sexo</th>
                        <th className="p-2">Nascimento/idade</th>
                        <th className="p-2">
                          Peso individual ({weightUnitSymbol})
                        </th>
                        <th className="p-2">Arrobas</th>
                        <th className="p-2">Valor</th>
                        <th className="p-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newAnimals.map((draft, index) => {
                        const calculation = pricingCalculations[draft.localId];
                        const classification =
                          resolveAnimalClassificationSnapshot(
                            {
                              sexo: draft.sexo,
                              data_nascimento: draft.dataNascimento ?? null,
                              payload: draft.payload,
                            },
                            { referenceDate: comercialData.occurredAt },
                          );
                        const birthAge = formatCommercialBirthAge(
                          draft.dataNascimento,
                          comercialData.occurredAt,
                        );
                        const expanded = expandedPurchaseRows.has(
                          draft.localId,
                        );
                        return (
                          <Fragment key={draft.localId}>
                            <tr className="border-b align-middle last:border-b-0">
                              <td className="p-2">
                                <Input
                                  aria-label={`Identificação animal ${index + 1}`}
                                  className="h-9 min-w-36"
                                  value={draft.identificacao}
                                  placeholder={`Identificação ${index + 1}`}
                                  onChange={(event) =>
                                    updateNewAnimal(draft.localId, {
                                      identificacao: event.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <Select
                                  value={draft.sexo}
                                  onValueChange={(value) =>
                                    updateNewAnimal(draft.localId, {
                                      sexo: value as "M" | "F",
                                    })
                                  }
                                >
                                  <SelectTrigger
                                    aria-label={`Sexo animal ${index + 1}`}
                                    className="h-9 w-20"
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="F">F</SelectItem>
                                    <SelectItem value="M">M</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="p-2">
                                <Input
                                  aria-label={`Nascimento animal ${index + 1}`}
                                  className="h-9 w-36"
                                  type="date"
                                  value={draft.dataNascimento ?? ""}
                                  onChange={(event) =>
                                    updateNewAnimal(draft.localId, {
                                      dataNascimento: event.target.value,
                                    })
                                  }
                                />
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  {draft.dataNascimento
                                    ? `Exata${birthAge ? ` · ${birthAge}` : ""}`
                                    : "Não informado"}
                                </p>
                              </td>
                              <td className="p-2">
                                <Input
                                  aria-label={`Peso animal ${index + 1}`}
                                  className="h-9 w-28"
                                  type="number"
                                  min="0"
                                  value={displayedWeights[draft.localId] ?? ""}
                                  step="0.01"
                                  onChange={(event) =>
                                    updatePurchaseLineNumber(
                                      draft.localId,
                                      "commercialWeight",
                                      event.target.value,
                                    )
                                  }
                                />
                              </td>
                              <td className="p-2 tabular-nums">
                                {calculation?.arrobasInput || "—"}
                              </td>
                              <td className="p-2">
                                {comercialData.pricingMode === "per_head" ? (
                                  <Input
                                    aria-label={`Valor animal ${index + 1}`}
                                    className="h-9 w-28"
                                    type="number"
                                    min="0"
                                    value={draft.valorIndividual ?? ""}
                                    step="0.01"
                                    onChange={(event) =>
                                      updatePurchaseLineNumber(
                                        draft.localId,
                                        "valorIndividual",
                                        event.target.value,
                                      )
                                    }
                                  />
                                ) : calculation?.individualGrossValueInput ? (
                                  `R$ ${calculation.individualGrossValueInput}`
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="p-2">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    aria-label={`Detalhes animal ${index + 1}`}
                                    onClick={() =>
                                      setExpandedPurchaseRows((current) => {
                                        const next = new Set(current);
                                        if (next.has(draft.localId))
                                          next.delete(draft.localId);
                                        else next.add(draft.localId);
                                        return next;
                                      })
                                    }
                                  >
                                    <ChevronDown
                                      className={cn(
                                        "h-4 w-4 transition-transform",
                                        expanded && "rotate-180",
                                      )}
                                    />
                                  </Button>
                                  {comercialData.scope === "lote" ? (
                                    <>
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`Duplicar animal ${index + 1}`}
                                        disabled={newAnimals.length >= 500}
                                        onClick={() => {
                                          const next = [...newAnimals];
                                          next.splice(index + 1, 0, {
                                            ...draft,
                                            localId: crypto.randomUUID(),
                                            identificacao: `${draft.identificacao}-copia`,
                                          });
                                          replacePurchaseLines(next);
                                        }}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`Remover animal ${index + 1}`}
                                        disabled={newAnimals.length <= 2}
                                        onClick={() =>
                                          replacePurchaseLines(
                                            newAnimals.filter(
                                              (item) =>
                                                item.localId !== draft.localId,
                                            ),
                                          )
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                            {expanded ? (
                              <tr className="border-b bg-muted/20">
                                <td colSpan={7} className="p-3">
                                  <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="space-y-1 text-xs">
                                      <Label>Categoria</Label>
                                      <p>
                                        {classification.categoriaZootecnica ===
                                        "desconhecida"
                                          ? "Não derivada: dados cadastrais insuficientes."
                                          : `${
                                              classification.source ===
                                              "inferred"
                                                ? "Derivada"
                                                : "Cadastral"
                                            }: ${classification.display.categoriaZootecnica}`}
                                      </p>
                                    </div>
                                    <p className="self-end text-xs text-muted-foreground sm:col-span-2">
                                      Espécie, raça e data de entrada usam os
                                      valores comuns acima e permanecem
                                      editáveis sem perder a linha.
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : comercialData.scope === "lote" ? (
              <div className="space-y-2 rounded-xl border p-4 bg-background/50">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Snapshot do lote</Label>
                    <p className="text-xs text-muted-foreground">
                      {lotActiveIds.length} animais ativos elegíveis agora.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      updateComercialData(
                        "saleSnapshotIds",
                        [...lotActiveIds].sort(),
                      );
                      updateComercialData(
                        "quantidadeAnimais",
                        String(lotActiveIds.length),
                      );
                    }}
                  >
                    Atualizar seleção
                  </Button>
                </div>
                <p className="text-xs">
                  Snapshot congelado: {saleSnapshotIds.length} animais.
                </p>
                {JSON.stringify([...lotActiveIds].sort()) !==
                JSON.stringify(saleSnapshotIds) ? (
                  <p className="text-xs text-amber-700">
                    A composição mudou; atualize a seleção antes de confirmar.
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* ---------------------------------------------------------------- */}
            {/* MODO POR ANIMAL: grid individual */}
            {/* ---------------------------------------------------------------- */}
            {!purchase && commercialLineIds.length > 0 && (
              <div className="space-y-3 border border-border/60 rounded-xl p-4 bg-background/50">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">
                    Peso &amp; Valor por Animal
                  </p>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {commercialLineIds.length} animal(is)
                  </span>
                </div>

                <div className="max-h-80 overflow-auto rounded-lg border">
                  <table className="min-w-[1000px] w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-muted">
                      <tr className="border-b text-left text-xs">
                        <th className="p-2">Animal</th>
                        <th className="p-2">Sexo</th>
                        <th className="p-2">Nascimento/idade</th>
                        <th className="p-2">
                          Peso individual ({weightUnitSymbol})
                        </th>
                        <th className="p-2">Arrobas</th>
                        <th className="p-2">Preço unitário</th>
                        <th className="p-2">Valor calculado</th>
                        <th className="p-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commercialLineIds.map((id, index) => {
                        const animal = animaisComPeso.find((a) => a.id === id);
                        const calculation = pricingCalculations[id];
                        return (
                          <tr key={id} className="border-b last:border-b-0">
                            <td className="p-2 font-medium">
                              {animal ? fmtAnimalLabel(animal) : id.slice(0, 8)}
                            </td>
                            <td className="p-2">{animal?.sexo ?? "—"}</td>
                            <td className="p-2 text-xs">
                              {animal?.dataNascimento
                                ? `${animal.dataNascimento} · ${
                                    formatCommercialBirthAge(
                                      animal.dataNascimento,
                                      comercialData.occurredAt,
                                    ) ?? "idade indisponível"
                                  }`
                                : "Não informado"}
                            </td>
                            <td className="p-2">
                              <Input
                                aria-label={`Peso animal existente ${index + 1}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={displayedWeights[id] ?? ""}
                                onChange={(event) =>
                                  updateExistingLineNumber(
                                    id,
                                    "pesosPorAnimal",
                                    event.target.value,
                                  )
                                }
                                placeholder={
                                  commercialWeightUnit === "kg" &&
                                  animal?.lastWeightKg != null
                                    ? String(animal.lastWeightKg)
                                    : "0.00"
                                }
                                className="h-9 w-28 bg-background"
                              />
                            </td>
                            <td className="p-2 tabular-nums">
                              {calculation?.arrobasInput || "—"}
                            </td>
                            <td className="p-2">
                              {comercialData.pricingMode === "per_head" ? (
                                <Input
                                  aria-label={`Valor animal existente ${index + 1}`}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    comercialData.valoresPorAnimal[id] ?? ""
                                  }
                                  onChange={(event) =>
                                    updateExistingLineNumber(
                                      id,
                                      "valoresPorAnimal",
                                      event.target.value,
                                    )
                                  }
                                  className="h-9 w-28 bg-background"
                                />
                              ) : comercialData.pricePerArroba ? (
                                `R$ ${Number(comercialData.pricePerArroba).toFixed(2)}/@`
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="p-2 font-medium tabular-nums">
                              {calculation?.individualGrossValueInput
                                ? `R$ ${calculation.individualGrossValueInput}`
                                : "—"}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">
                              Snapshot fixo
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totais derivados no modo animal */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
                  <div className="rounded-lg bg-muted/60 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Peso Total
                    </p>
                    <p className="mt-1 text-xl font-bold text-foreground">
                      {displayedWeightTotal !== ""
                        ? `${displayedWeightTotal} ${weightUnitSymbol}`
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Valor Total Individual
                    </p>
                    <p className="mt-1 text-xl font-bold text-foreground">
                      {(() => {
                        const total = sumCommercialInputs(
                          commercialLineIds.map(
                            (id) => comercialData.valoresPorAnimal[id] ?? "",
                          ),
                        );
                        return total === "" ? "—" : `R$ ${total}`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* Valores Financeiros (agregados) */}
            {/* ---------------------------------------------------------------- */}
            <div className="grid gap-5 border-t pt-5 md:grid-cols-2 lg:grid-cols-3">
              {/* Frete */}
              <div className="space-y-2">
                <Label>Frete (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={comercialData.frete}
                  onChange={(e) => updateComercialData("frete", e.target.value)}
                  placeholder="0.00"
                  className="bg-background"
                />
              </div>

              {/* Comissão */}
              <div className="space-y-2">
                <Label>Comissão (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={comercialData.comissao}
                  onChange={(e) =>
                    updateComercialData("comissao", e.target.value)
                  }
                  placeholder="0.00"
                  className="bg-background"
                />
              </div>

              {/* Descontos */}
              <div className="space-y-2">
                <Label>Descontos (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={comercialData.descontos}
                  onChange={(e) =>
                    updateComercialData("descontos", e.target.value)
                  }
                  placeholder="0.00"
                  className="bg-background"
                />
              </div>

              {/* Taxas/Impostos */}
              <div className="space-y-2">
                <Label>Taxas &amp; Impostos (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={comercialData.taxasImpostos}
                  onChange={(e) =>
                    updateComercialData("taxasImpostos", e.target.value)
                  }
                  placeholder="0.00"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Bonificações (R$)</Label>
                <Input
                  aria-label="Bonificações (R$)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={comercialData.bonificacoes}
                  onChange={(e) =>
                    updateComercialData("bonificacoes", e.target.value)
                  }
                  placeholder="0.00"
                  className="bg-background"
                />
              </div>
            </div>

            {/* Derivados globais */}
            <div className="grid gap-4 border-t pt-5 md:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background/50 p-4 text-center">
                <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                  Peso médio ({weightUnitSymbol})
                </span>
                <p className="mt-1 text-2xl font-bold text-primary">
                  {calculationSummary.pesoMedioDerivado !== undefined
                    ? `${calculationSummary.pesoMedioDerivado.toFixed(2)} ${weightUnitSymbol}`
                    : displayedWeightTotal !== "" &&
                        commercialLineIds.length > 0
                      ? `${(
                          Number(displayedWeightTotal) /
                          commercialLineIds.length
                        ).toFixed(2)} ${weightUnitSymbol}`
                      : "—"}
                </p>
              </div>

              <div className="rounded-lg border border-border/60 bg-background/50 p-4 text-center">
                <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                  {purchase
                    ? "Custo total da aquisição"
                    : "Receita líquida da venda"}
                </span>
                <p className="mt-1 text-2xl font-bold text-primary">
                  {calculationSummary.valorLiquidoDerivado !== undefined
                    ? `R$ ${calculationSummary.valorLiquidoDerivado.toFixed(2)}`
                    : "—"}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-background/50 p-4 text-center">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Arrobas consideradas
                </span>
                <p className="mt-1 text-xl font-bold">
                  {totalArrobas ? `${totalArrobas.input} @` : "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-background/50 p-4 text-center">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Preço efetivo bruto
                </span>
                <p className="mt-1 text-xl font-bold">
                  {effectiveArrobaPrices?.gross
                    ? `R$ ${effectiveArrobaPrices.gross.input}/@`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-background/50 p-4 text-center">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Preço efetivo líquido
                </span>
                <p className="mt-1 text-xl font-bold">
                  {effectiveArrobaPrices?.net
                    ? `R$ ${effectiveArrobaPrices.net.input}/@`
                    : "—"}
                </p>
              </div>
            </div>

            {/* Feedback assistivo + issues */}
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary/80">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold text-primary">
                    Informações Auxiliares Assistivas
                  </p>
                  <p>• Operação registrada conforme dados informados.</p>
                  <p>• Valor final derivado conforme o tipo da operação.</p>
                  <p>
                    • Não representa recomendação comercial ou substitui
                    validação operacional/financeira.
                  </p>
                </div>
              </div>

              {calculationSummary.issues.length > 0 && (
                <div className="space-y-2">
                  {calculationSummary.issues.map((issue, idx) => (
                    <Alert
                      key={idx}
                      variant={
                        issue.severity === "blocking"
                          ? "destructive"
                          : "default"
                      }
                      className="rounded-xl"
                    >
                      {issue.severity === "blocking" ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      <AlertTitle className="text-sm font-semibold capitalize">
                        {issue.severity === "blocking"
                          ? "Restrição Impeditiva"
                          : "Aviso de Cálculo"}
                      </AlertTitle>
                      <AlertDescription className="text-xs mt-1">
                        {issue.message}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {calculationSummary.limitations.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900 space-y-1">
                  <p className="font-semibold text-amber-800 uppercase tracking-wider text-[10px]">
                    Limitações Informativas (
                    {calculationSummary.calculationStatus})
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-800/95">
                    {calculationSummary.limitations.map((lim, idx) => (
                      <li key={idx}>{lim}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ---------------------------------------------------------------- */}
          {/* Tab 2: Envolvidos & Vínculos */}
          {/* ---------------------------------------------------------------- */}
          <TabsContent
            value="detalhes"
            className="space-y-5 focus-visible:outline-none"
          >
            <FinanceiroContraparteSection
              isFinanceiroSociedade={false}
              financeiroContraparteId={comercialData.contraparteId}
              contrapartes={contrapartes}
              onFinanceiroContraparteChange={(val) =>
                updateComercialData("contraparteId", val)
              }
              showNovaContraparte={showNovaContraparte}
              onToggleNovaContraparte={onToggleNovaContraparte}
              canManageContraparte={canManageContraparte}
              onNavigateContrapartes={onNavigateContrapartes}
              novaContraparte={novaContraparte}
              onNovaContraparteFieldChange={onNovaContraparteFieldChange}
              onCreateContraparte={onCreateContraparte}
              isSavingContraparte={isSavingContraparte}
            />

            {/* Vínculo Financeiro Opcional */}
            <div className="space-y-3 border-t pt-5">
              <div>
                <Label className="text-sm font-semibold">
                  Vínculo Financeiro Opcional
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Esta operação comercial não gera lançamento financeiro
                  automaticamente. Selecione um lançamento existente se desejar
                  conciliar.
                </p>
              </div>

              <Select
                value={comercialData.financeTransactionId}
                onValueChange={(val) =>
                  updateComercialData("financeTransactionId", val)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem vínculo financeiro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo financeiro</SelectItem>
                  {financeTransactions?.map((tx) => {
                    const directionLabel =
                      tx.direction === "in" ? "Receita" : "Despesa";
                    const dateStr = tx.occurred_at
                      ? tx.occurred_at.slice(0, 10)
                      : "";
                    const desc = tx.description ? ` - ${tx.description}` : "";
                    return (
                      <SelectItem key={tx.id} value={tx.id}>
                        {`[${directionLabel}] R$ ${tx.valor.toFixed(2)} (${dateStr})${desc}`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div className="space-y-2 border-t pt-5">
              <Label>Observações Gerais</Label>
              <Textarea
                value={comercialData.observacoes}
                onChange={(e) =>
                  updateComercialData("observacoes", e.target.value)
                }
                placeholder="Digite aqui quaisquer detalhes sobre a negociação..."
                className="bg-background min-h-24 rounded-xl"
              />
            </div>
          </TabsContent>
        </Tabs>
      )}

      {transitChecklistSection}
      {sanitaryMovementBlockSection}
    </div>
  );
}
