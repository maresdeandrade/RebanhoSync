import { useCallback, useMemo, type ComponentProps } from "react";

import { getWeightInputStep, getWeightUnitLabel } from "@/lib/format/weight";
import type { FarmWeightUnit } from "@/lib/farms/measurementConfig";
import type { Animal, Contraparte } from "@/lib/offline/types";
import { RegistrarFinanceiroSection } from "@/pages/Registrar/components/RegistrarFinanceiroSection";
import { RegistrarMovimentacaoSection } from "@/pages/Registrar/components/RegistrarMovimentacaoSection";
import { RegistrarNutricaoSection } from "@/pages/Registrar/components/RegistrarNutricaoSection";
import { RegistrarPesagemSection } from "@/pages/Registrar/components/RegistrarPesagemSection";
import { RegistrarReproducaoSection } from "@/pages/Registrar/components/RegistrarReproducaoSection";
import { RegistrarSanitarioSection } from "@/pages/Registrar/components/RegistrarSanitarioSection";
import { RegistrarTransitChecklistSection } from "@/pages/Registrar/components/RegistrarTransitChecklistSection";
import {
  RegistrarComplianceBlockSection,
  RegistrarSanitaryMovementBlockSection,
} from "@/pages/Registrar/components/RegistrarComplianceBlocks";
import { buildRegistrarActionSectionSlots } from "@/pages/Registrar/buildRegistrarActionSectionSlots";

type RegistrarSanitarioSectionProps = ComponentProps<
  typeof RegistrarSanitarioSection
>;
type RegistrarPesagemSectionProps = ComponentProps<
  typeof RegistrarPesagemSection
>;
type RegistrarMovimentacaoSectionProps = ComponentProps<
  typeof RegistrarMovimentacaoSection
>;
type RegistrarNutricaoSectionProps = ComponentProps<
  typeof RegistrarNutricaoSection
>;
type RegistrarFinanceiroSectionProps = ComponentProps<
  typeof RegistrarFinanceiroSection
>;
type RegistrarReproducaoSectionProps = ComponentProps<
  typeof RegistrarReproducaoSection
>;

type RegistrarActionSectionStateInput = {
  activeFarmId: string | null;
  selectedAnimais: string[];
  selectedAnimaisDetalhesCount: number;
  selectedLoteIdNormalized: string | null;
  lotes: Array<{ id: string; nome: string }> | undefined;
  farmWeightUnit: FarmWeightUnit;
  animaisNoLote: Animal[] | undefined;

  sanitarioSection: Omit<
    RegistrarSanitarioSectionProps,
    "onProtocoloChange" | "onProtocoloItemChange"
  > & {
    setProtocoloId: (value: string) => void;
    setProtocoloItemId: (value: string) => void;
  };

  transitChecklistState: {
    transitChecklistSection: ComponentProps<
      typeof RegistrarTransitChecklistSection
    >["transitChecklist"];
    onTransitChecklistChange: ComponentProps<
      typeof RegistrarTransitChecklistSection
    >["onTransitChecklistChange"];
    officialTransitChecklistEnabled: ComponentProps<
      typeof RegistrarTransitChecklistSection
    >["officialTransitChecklistEnabled"];
    transitChecklistIssues: ComponentProps<
      typeof RegistrarTransitChecklistSection
    >["transitChecklistIssues"];
    showsTransitChecklist: boolean;
    blockedAnimals: ComponentProps<
      typeof RegistrarSanitaryMovementBlockSection
    >["blockedAnimals"];
    movementComplianceGuards: {
      blockers: ComponentProps<
        typeof RegistrarComplianceBlockSection
      >["blockers"];
      warnings: ComponentProps<
        typeof RegistrarComplianceBlockSection
      >["warnings"];
    };
    nutritionComplianceGuards: {
      blockers: ComponentProps<
        typeof RegistrarComplianceBlockSection
      >["blockers"];
      warnings: ComponentProps<
        typeof RegistrarComplianceBlockSection
      >["warnings"];
    };
  };

  pesagemSection: {
    invalidAnimalIds: string[];
    pesagemData: Record<string, string>;
    setPesagemData: (
      updater: (prev: Record<string, string>) => Record<string, string>,
    ) => void;
  };

  movimentacaoSection: {
    movimentacaoData: { toLoteId: string };
    setMovimentacaoData: (value: { toLoteId: string }) => void;
    movimentacaoSemDestino: boolean;
    movimentacaoDestinoIgualOrigem: boolean;
  };

  nutricaoSection: {
    nutricaoData: { alimentoNome: string; quantidadeKg: string };
    setNutricaoData: (
      updater: (prev: { alimentoNome: string; quantidadeKg: string }) => {
        alimentoNome: string;
        quantidadeKg: string;
      },
    ) => void;
    nutricaoAlimentoMissing: boolean;
    nutricaoQuantidadeInvalida: boolean;
  };

  financeiroSection: {
    financeiroData: RegistrarFinanceiroSectionProps["financeiroData"];
    updateFinanceiroData: (
      field:
        | "natureza"
        | "quantidadeAnimais"
        | "modoPreco"
        | "valorUnitario"
        | "valorTotal"
        | "modoPeso"
        | "pesoLoteKg"
        | "contraparteId",
      value: string,
    ) => void;
    financeiroValorTotalCalculado: number;
    isFinanceiroSociedade: boolean;
    contrapartes: Contraparte[] | undefined;
    canManageContraparte: boolean;
    showNovaContraparte: boolean;
    setShowNovaContraparte: (
      value: boolean | ((prev: boolean) => boolean),
    ) => void;
    novaContraparte: RegistrarFinanceiroSectionProps["novaContraparte"];
    setNovaContraparte: (
      updater: (
        prev: RegistrarFinanceiroSectionProps["novaContraparte"],
      ) => RegistrarFinanceiroSectionProps["novaContraparte"],
    ) => void;
    handleCreateContraparte: () => void;
    isSavingContraparte: boolean;
    compraNovosAnimais: RegistrarFinanceiroSectionProps["compraNovosAnimais"];
    updateCompraNovoAnimalField: (
      localId: string,
      field: "identificacao" | "sexo" | "dataNascimento" | "pesoKg",
      value: string,
    ) => void;
    updateCompraNovoAnimalPesoByIndex: (index: number, value: string) => void;
    financeiroWeightStep: string;
    financeiroWeightUnitLabel: string;
    onNavigateContrapartes: () => void;
  };

  reproducaoSection: {
    partoRequiresSingleMatrix: boolean;
    reproducaoData: RegistrarReproducaoSectionProps["data"];
    setReproducaoData: RegistrarReproducaoSectionProps["onChange"];
  };
};

export function useRegistrarActionSectionState(
  input: RegistrarActionSectionStateInput,
) {
  const {
    transitChecklistSection,
    sanitaryMovementBlockSection,
    movementComplianceBlockSection,
    nutritionComplianceBlockSection,
  } = buildRegistrarActionSectionSlots({
    transitChecklist: input.transitChecklistState.transitChecklistSection,
    onTransitChecklistChange:
      input.transitChecklistState.onTransitChecklistChange,
    officialTransitChecklistEnabled:
      input.transitChecklistState.officialTransitChecklistEnabled,
    transitChecklistIssues: input.transitChecklistState.transitChecklistIssues,
    showsTransitChecklist: input.transitChecklistState.showsTransitChecklist,
    blockedAnimals: input.transitChecklistState.blockedAnimals,
    movementComplianceGuards:
      input.transitChecklistState.movementComplianceGuards,
    nutritionComplianceGuards:
      input.transitChecklistState.nutritionComplianceGuards,
  });

  const onProtocoloChange = useCallback(
    (value: string) =>
      input.sanitarioSection.setProtocoloId(value === "none" ? "" : value),
    [input.sanitarioSection],
  );

  const sanitarioSectionProps: RegistrarSanitarioSectionProps = {
    ...input.sanitarioSection,
    onProtocoloChange,
    onProtocoloItemChange: input.sanitarioSection.setProtocoloItemId,
    selectedAnimaisDetalhesCount: input.selectedAnimaisDetalhesCount,
  };

  const pesagemSectionProps: RegistrarPesagemSectionProps = {
    selectedAnimalIds: input.selectedAnimais,
    animaisNoLote: input.animaisNoLote,
    invalidAnimalIds: input.pesagemSection.invalidAnimalIds,
    weightInputStep: getWeightInputStep(input.farmWeightUnit),
    weightUnitLabel: getWeightUnitLabel(input.farmWeightUnit),
    pesagemData: input.pesagemSection.pesagemData,
    onPesoChange: (animalId, value) =>
      input.pesagemSection.setPesagemData((prev) => ({
        ...prev,
        [animalId]: value,
      })),
  };

  const lotesDestino = useMemo(
    () =>
      input.lotes?.filter(
        (lote) => lote.id !== input.selectedLoteIdNormalized,
      ) ?? [],
    [input.lotes, input.selectedLoteIdNormalized],
  );

  const movimentacaoSectionProps: RegistrarMovimentacaoSectionProps = {
    movimentacaoDestinoId: input.movimentacaoSection.movimentacaoData.toLoteId,
    onMovimentacaoDestinoChange: (value) =>
      input.movimentacaoSection.setMovimentacaoData({ toLoteId: value }),
    lotesDestino,
    movimentacaoSemDestino: input.movimentacaoSection.movimentacaoSemDestino,
    movimentacaoDestinoIgualOrigem:
      input.movimentacaoSection.movimentacaoDestinoIgualOrigem,
    transitChecklistSection,
    sanitaryMovementBlockSection,
    movementComplianceBlockSection,
  };

  const nutricaoSectionProps: RegistrarNutricaoSectionProps = {
    alimentoNome: input.nutricaoSection.nutricaoData.alimentoNome,
    onAlimentoNomeChange: (value) =>
      input.nutricaoSection.setNutricaoData((prev) => ({
        ...prev,
        alimentoNome: value,
      })),
    quantidadeKg: input.nutricaoSection.nutricaoData.quantidadeKg,
    onQuantidadeKgChange: (value) =>
      input.nutricaoSection.setNutricaoData((prev) => ({
        ...prev,
        quantidadeKg: value,
      })),
    nutricaoAlimentoMissing: input.nutricaoSection.nutricaoAlimentoMissing,
    nutricaoQuantidadeInvalida:
      input.nutricaoSection.nutricaoQuantidadeInvalida,
    nutritionComplianceBlockSection,
  };

  const financeiroSectionProps: RegistrarFinanceiroSectionProps = {
    financeiroData: input.financeiroSection.financeiroData,
    onNaturezaChange: (natureza) =>
      input.financeiroSection.updateFinanceiroData("natureza", natureza),
    onQuantidadeAnimaisChange: (value) =>
      input.financeiroSection.updateFinanceiroData("quantidadeAnimais", value),
    onModoPrecoChange: (modoPreco) =>
      input.financeiroSection.updateFinanceiroData("modoPreco", modoPreco),
    onValorUnitarioChange: (valorUnitario) =>
      input.financeiroSection.updateFinanceiroData(
        "valorUnitario",
        valorUnitario,
      ),
    onValorTotalChange: (valorTotal) =>
      input.financeiroSection.updateFinanceiroData("valorTotal", valorTotal),
    onModoPesoChange: (modoPeso) =>
      input.financeiroSection.updateFinanceiroData("modoPeso", modoPeso),
    onPesoLoteChange: (pesoLoteKg) =>
      input.financeiroSection.updateFinanceiroData("pesoLoteKg", pesoLoteKg),
    onContraparteChange: (contraparteId) =>
      input.financeiroSection.updateFinanceiroData(
        "contraparteId",
        contraparteId,
      ),
    financeiroValorTotalCalculado:
      input.financeiroSection.financeiroValorTotalCalculado,
    isFinanceiroSociedade: input.financeiroSection.isFinanceiroSociedade,
    selectedAnimalIds: input.selectedAnimais,
    contrapartes: input.financeiroSection.contrapartes,
    canManageContraparte: input.financeiroSection.canManageContraparte,
    showNovaContraparte: input.financeiroSection.showNovaContraparte,
    onToggleNovaContraparte: () =>
      input.financeiroSection.setShowNovaContraparte((prev) => !prev),
    onNavigateContrapartes: input.financeiroSection.onNavigateContrapartes,
    novaContraparte: input.financeiroSection.novaContraparte,
    onNovaContraparteFieldChange: (field, value) =>
      input.financeiroSection.setNovaContraparte((prev) => ({
        ...prev,
        [field]: value,
      })),
    onCreateContraparte: input.financeiroSection.handleCreateContraparte,
    isSavingContraparte: input.financeiroSection.isSavingContraparte,
    compraNovosAnimais: input.financeiroSection.compraNovosAnimais,
    onCompraIdentificacaoChange: (localId, value) =>
      input.financeiroSection.updateCompraNovoAnimalField(
        localId,
        "identificacao",
        value,
      ),
    onCompraSexoChange: (localId, value) =>
      input.financeiroSection.updateCompraNovoAnimalField(
        localId,
        "sexo",
        value,
      ),
    onCompraDataNascimentoChange: (localId, value) =>
      input.financeiroSection.updateCompraNovoAnimalField(
        localId,
        "dataNascimento",
        value,
      ),
    onCompraPesoChange: (localId, value) =>
      input.financeiroSection.updateCompraNovoAnimalField(
        localId,
        "pesoKg",
        value,
      ),
    onVendaPesoAtIndexChange:
      input.financeiroSection.updateCompraNovoAnimalPesoByIndex,
    animaisNoLote: input.animaisNoLote,
    weightInputStep: input.financeiroSection.financeiroWeightStep,
    weightUnitLabel: input.financeiroSection.financeiroWeightUnitLabel,
    transitChecklistSection,
    sanitaryMovementBlockSection,
    movementComplianceBlockSection,
  };

  const reproducaoSectionProps: RegistrarReproducaoSectionProps = {
    partoRequiresSingleMatrix:
      input.reproducaoSection.partoRequiresSingleMatrix,
    fazendaId: input.activeFarmId ?? "",
    animalId: input.selectedAnimais[0],
    data: input.reproducaoSection.reproducaoData,
    onChange: input.reproducaoSection.setReproducaoData,
  };

  return {
    sanitarioSectionProps,
    pesagemSectionProps,
    movimentacaoSectionProps,
    nutricaoSectionProps,
    financeiroSectionProps,
    reproducaoSectionProps,
  };
}
