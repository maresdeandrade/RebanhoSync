import { useCallback, useEffect, useState } from "react";

import type { ReproductionEventData } from "@/components/events/ReproductionForm";
import type { EventDomain } from "@/lib/events/types";
import { isMovimentacaoDestinoIgualOrigem, shouldClearMovimentacaoDestino } from "@/pages/Registrar/helpers/movimentacao";
import { parseRegistrarNumeric } from "@/pages/Registrar/helpers/financialContext";

type UseRegistrarShellStateInput = {
  semLoteOption: string;
};

const INITIAL_REPRODUCAO_DATA: ReproductionEventData = {
  tipo: "cobertura",
  machoId: null,
  observacoes: "",
};

export function useRegistrarShellState({
  semLoteOption,
}: UseRegistrarShellStateInput) {
  const [tipoManejo, setTipoManejo] = useState<EventDomain | null>(null);
  const [selectedLoteId, setSelectedLoteId] = useState<string>("");
  const [selectedAnimais, setSelectedAnimais] = useState<string[]>([]);
  const [animalSearch, setAnimalSearch] = useState("");
  const [sourceTaskId, setSourceTaskId] = useState<string>("");

  const [pesagemData, setPesagemData] = useState<Record<string, string>>({});
  const [movimentacaoData, setMovimentacaoData] = useState({ toLoteId: "" });
  const [nutricaoData, setNutricaoData] = useState({
    alimentoNome: "",
    quantidadeKg: "",
  });
  const [reproducaoData, setReproducaoData] =
    useState<ReproductionEventData>(INITIAL_REPRODUCAO_DATA);

  const selectedLoteIdNormalized =
    selectedLoteId === semLoteOption ? null : selectedLoteId || null;

  const onSelectedLoteIdChange = useCallback((value: string) => {
    setSelectedLoteId(value);
    setSelectedAnimais([]);
  }, []);

  const onSelectVisibleAnimais = useCallback((visibleIds: string[]) => {
    setSelectedAnimais((prev) => Array.from(new Set([...prev, ...visibleIds])));
  }, []);

  const onToggleAnimalSelection = useCallback(
    (animalId: string, checked: boolean) => {
      setSelectedAnimais((prev) =>
        checked ? [...prev, animalId] : prev.filter((id) => id !== animalId),
      );
    },
    [],
  );

  const clearSelectedAnimais = useCallback(() => {
    setSelectedAnimais([]);
  }, []);

  const nutricaoQuantidade =
    nutricaoData.quantidadeKg.trim() !== ""
      ? parseRegistrarNumeric(nutricaoData.quantidadeKg)
      : null;
  const nutricaoAlimentoMissing = nutricaoData.alimentoNome.trim().length === 0;
  const nutricaoQuantidadeInvalida =
    nutricaoQuantidade === null ||
    !Number.isFinite(nutricaoQuantidade) ||
    nutricaoQuantidade <= 0;

  const movimentacaoSemDestino = movimentacaoData.toLoteId.trim().length === 0;
  const movimentacaoDestinoIgualOrigem = isMovimentacaoDestinoIgualOrigem({
    origemLoteId: selectedLoteIdNormalized,
    destinoLoteId: movimentacaoData.toLoteId,
  });

  const partoRequiresSingleMatrix =
    tipoManejo === "reproducao" &&
    reproducaoData.tipo === "parto" &&
    selectedAnimais.length > 1;

  useEffect(() => {
    if (
      shouldClearMovimentacaoDestino({
        origemLoteId: selectedLoteIdNormalized,
        destinoLoteId: movimentacaoData.toLoteId,
      })
    ) {
      setMovimentacaoData((prev) => ({ ...prev, toLoteId: "" }));
    }
  }, [movimentacaoData.toLoteId, selectedLoteIdNormalized]);

  return {
    tipoManejo,
    setTipoManejo,
    selectedLoteId,
    setSelectedLoteId,
    selectedLoteIdNormalized,
    selectedAnimais,
    setSelectedAnimais,
    animalSearch,
    setAnimalSearch,
    sourceTaskId,
    setSourceTaskId,
    pesagemData,
    setPesagemData,
    movimentacaoData,
    setMovimentacaoData,
    nutricaoData,
    setNutricaoData,
    reproducaoData,
    setReproducaoData,
    partoRequiresSingleMatrix,
    nutricaoAlimentoMissing,
    nutricaoQuantidadeInvalida,
    movimentacaoSemDestino,
    movimentacaoDestinoIgualOrigem,
    onSelectedLoteIdChange,
    onSelectVisibleAnimais,
    onToggleAnimalSelection,
    clearSelectedAnimais,
  };
}
