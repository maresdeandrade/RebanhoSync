import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatWeight,
  getWeightInputStep,
  getWeightUnitLabel,
} from "@/lib/format/weight";
import type { FarmWeightUnit } from "@/lib/farms/measurementConfig";
import { deriveRegistrarFinancialContext } from "@/pages/Registrar/helpers/financialContext";
import {
  runRegistrarCreateContraparteEffect,
  type RegistrarNovaContraparteDraft,
} from "@/pages/Registrar/effects/contraparteCreate";
import { showError, showSuccess } from "@/utils/toast";
import type { EventDomain } from "@/lib/events/types";
import type {
  CompraNovoAnimalDraft,
  FinanceiroFormData,
  FinanceiroNatureza,
  RegistrarSexo,
} from "@/pages/Registrar/types";

const INITIAL_FINANCEIRO_DATA: FinanceiroFormData = {
  natureza: "compra",
  contraparteId: "none",
  modoPreco: "por_lote",
  valorUnitario: "",
  valorTotal: "",
  quantidadeAnimais: "1",
  modoPeso: "nenhum",
  pesoLoteKg: "",
};

const INITIAL_NOVA_CONTRAPARTE: RegistrarNovaContraparteDraft = {
  tipo: "pessoa",
  nome: "",
  documento: "",
  telefone: "",
  email: "",
  endereco: "",
};

const FINANCEIRO_NATUREZA_OPTIONS: FinanceiroNatureza[] = [
  "compra",
  "venda",
  "sociedade_entrada",
  "sociedade_saida",
];

export function useRegistrarFinanceiroPackage(input: {
  role: string | null;
  activeFarmId: string | null;
  tipoManejo: EventDomain | null;
  selectedAnimalIds: string[];
  farmWeightUnit: FarmWeightUnit;
  parseUserWeight: (value: string) => number | null;
  lotes: Array<{ id: string; fazenda_id: string; nome: string }> | undefined;
}) {
  const [financeiroData, setFinanceiroData] = useState<FinanceiroFormData>(
    INITIAL_FINANCEIRO_DATA,
  );
  const [showNovaContraparte, setShowNovaContraparte] = useState(false);
  const [isSavingContraparte, setIsSavingContraparte] = useState(false);
  const [novaContraparte, setNovaContraparte] =
    useState<RegistrarNovaContraparteDraft>(INITIAL_NOVA_CONTRAPARTE);
  const [compraNovosAnimais, setCompraNovosAnimais] = useState<
    CompraNovoAnimalDraft[]
  >([]);
  const updateFinanceiroData = useCallback(
    <K extends keyof FinanceiroFormData>(
      key: K,
      value: FinanceiroFormData[K],
    ) => {
      setFinanceiroData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );
  const applyFinanceiroNaturezaQueryPrefill = useCallback(
    (natureza: string | null) => {
      if (!natureza) return;
      if (!FINANCEIRO_NATUREZA_OPTIONS.includes(natureza as FinanceiroNatureza))
        return;
      updateFinanceiroData("natureza", natureza as FinanceiroNatureza);
    },
    [updateFinanceiroData],
  );

  const canManageContraparte =
    input.role === "owner" || input.role === "manager";
  const financeiroWeightStep = getWeightInputStep(input.farmWeightUnit);
  const financeiroWeightUnitLabel = getWeightUnitLabel(input.farmWeightUnit);

  const financialContext = deriveRegistrarFinancialContext({
    financeiroData,
    selectedAnimalsCount: input.selectedAnimalIds.length,
    parseUserWeight: input.parseUserWeight,
  });

  const updateCompraNovoAnimalField = useCallback(
    <K extends keyof CompraNovoAnimalDraft>(
      localId: string,
      field: K,
      value: CompraNovoAnimalDraft[K],
    ) => {
      setCompraNovosAnimais((prev) =>
        prev.map((item) =>
          item.localId === localId ? { ...item, [field]: value } : item,
        ),
      );
    },
    [],
  );

  const updateCompraNovoAnimalPesoByIndex = useCallback(
    (index: number, value: string) => {
      setCompraNovosAnimais((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index ? { ...item, pesoKg: value } : item,
        ),
      );
    },
    [],
  );

  const handleCreateContraparte = useCallback(async () => {
    const fazendaId = input.activeFarmId ?? input.lotes?.[0]?.fazenda_id;
    if (!fazendaId) {
      showError("Selecione uma fazenda ativa.");
      return;
    }
    if (!canManageContraparte) {
      showError("Apenas owner/manager pode cadastrar contraparte.");
      return;
    }
    if (!novaContraparte.nome.trim()) {
      showError("Nome da contraparte e obrigatorio.");
      return;
    }

    setIsSavingContraparte(true);
    try {
      const { contraparteId, txId } = await runRegistrarCreateContraparteEffect(
        {
          fazendaId,
          draft: novaContraparte,
        },
      );

      setFinanceiroData((prev) => ({ ...prev, contraparteId }));
      setNovaContraparte(INITIAL_NOVA_CONTRAPARTE);
      setShowNovaContraparte(false);
      showSuccess(
        `Contraparte salva neste aparelho. Sincronizacao pendente. TX ${txId.slice(0, 8)}.`,
      );
    } catch {
      showError("Falha ao cadastrar contraparte.");
    } finally {
      setIsSavingContraparte(false);
    }
  }, [canManageContraparte, input.activeFarmId, input.lotes, novaContraparte]);

  useEffect(() => {
    if (
      input.selectedAnimalIds.length === 0 &&
      financeiroData.natureza === "venda"
    ) {
      setFinanceiroData((prev) => ({ ...prev, natureza: "compra" }));
    }
  }, [financeiroData.natureza, input.selectedAnimalIds.length]);

  useEffect(() => {
    if (input.tipoManejo !== "financeiro") {
      setCompraNovosAnimais([]);
      return;
    }

    if (
      financeiroData.natureza === "venda" &&
      financeiroData.modoPeso === "individual"
    ) {
      setCompraNovosAnimais((prev) =>
        input.selectedAnimalIds.map((animalId, index) => {
          const current = prev[index];
          return {
            localId: current?.localId ?? animalId,
            identificacao: current?.identificacao ?? "",
            sexo: current?.sexo ?? "F",
            dataNascimento: "",
            pesoKg: current?.pesoKg ?? "",
          };
        }),
      );
      return;
    }

    if (financeiroData.natureza !== "compra") {
      setCompraNovosAnimais([]);
      return;
    }

    if (input.selectedAnimalIds.length > 0) {
      setCompraNovosAnimais([]);
      return;
    }

    const nextQuantity = Math.max(
      1,
      Number.parseInt(financeiroData.quantidadeAnimais || "1", 10) || 1,
    );

    setCompraNovosAnimais((prev) =>
      Array.from({ length: nextQuantity }, (_, index) => {
        const current = prev[index];
        return (
          current ?? {
            localId: crypto.randomUUID(),
            identificacao: "",
            sexo: index === 0 ? ("F" as RegistrarSexo) : ("M" as RegistrarSexo),
            dataNascimento: "",
            pesoKg: "",
          }
        );
      }),
    );
  }, [
    financeiroData.modoPeso,
    financeiroData.natureza,
    financeiroData.quantidadeAnimais,
    input.selectedAnimalIds,
    input.tipoManejo,
  ]);

  const financialSummary = useMemo(() => {
    const valorLabel = Number.isFinite(
      financialContext.financeiroValorTotalCalculado,
    )
      ? financialContext.financeiroValorTotalCalculado.toFixed(2)
      : "-";

    const precoLabel =
      financeiroData.modoPreco === "por_animal" ? "Por animal" : "Por lote";

    const pesoLabel =
      financeiroData.modoPeso === "nenhum"
        ? "Nao informado"
        : financeiroData.modoPeso === "lote"
          ? `Lote ${
              financialContext.financeiroPesoLote !== null
                ? formatWeight(
                    financialContext.financeiroPesoLote,
                    input.farmWeightUnit,
                  )
                : "-"
            }`
          : "Individual";

    return {
      valorLabel,
      precoLabel,
      pesoLabel,
    };
  }, [
    financialContext.financeiroPesoLote,
    financialContext.financeiroValorTotalCalculado,
    financeiroData.modoPeso,
    financeiroData.modoPreco,
    input.farmWeightUnit,
  ]);

  return {
    financeiroData,
    setFinanceiroData,
    updateFinanceiroData,
    applyFinanceiroNaturezaQueryPrefill,
    showNovaContraparte,
    setShowNovaContraparte,
    isSavingContraparte,
    novaContraparte,
    setNovaContraparte,
    compraNovosAnimais,
    setCompraNovosAnimais,
    canManageContraparte,
    financeiroWeightStep,
    financeiroWeightUnitLabel,
    financialContext,
    handleCreateContraparte,
    updateCompraNovoAnimalField,
    updateCompraNovoAnimalPesoByIndex,
    financialSummary,
  };
}
