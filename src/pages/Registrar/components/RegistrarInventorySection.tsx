import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import type { Insumo, InsumoLote, SanitarioTipoEnum } from "@/lib/offline/types";
import { sortLotsFEFO, validateLotEligibility } from "@/lib/inventory/eligibility";
import {
  resolveSanitaryDefaultApplicationRoute,
  resolveSanitaryDefaultDoseUnit,
} from "@/lib/inventory/sanitaryDefaults";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Calendar, Package, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RegistrarInventorySectionProps {
  activeFarmId: string;
  tipoManejo: "sanitario" | "nutricao";
  selectedAnimalCount: number;
  sanitarioTipo?: SanitarioTipoEnum;

  // State controlado
  gerarBaixaEstoque: boolean;
  onGerarBaixaEstoqueChange: (value: boolean) => void;
  selectedInsumoId: string;
  onSelectedInsumoIdChange: (value: string) => void;
  selectedLoteId: string;
  onSelectedLoteIdChange: (value: string) => void;
  quantidadeConsumida: string; // no nutricional, controlada pelo pai (quantidadeKg); no sanitario, calculada ou informada
  onQuantidadeConsumidaChange?: (value: string) => void;
  doseSanitaria?: string;
  onDoseSanitariaChange?: (value: string) => void;
  doseUnidadeSanitaria?: string;
  onDoseUnidadeSanitariaChange?: (value: string) => void;
  viaAplicacaoSanitaria?: string;
  onViaAplicacaoSanitariaChange?: (value: string) => void;

  // Refs exportados para o pai passar no EventInput
  onInsumoRefChange?: (insumo: Insumo | null) => void;
  onLoteRefChange?: (lote: InsumoLote | null) => void;
  
  // Para sincronizacao de quantidade externa no nutricional
  quantidadeExternaKg?: string;
}

export function RegistrarInventorySection(props: RegistrarInventorySectionProps) {
  const {
    activeFarmId,
    tipoManejo,
    selectedAnimalCount,
    sanitarioTipo = "vacinacao",
    gerarBaixaEstoque,
    onGerarBaixaEstoqueChange,
    selectedInsumoId,
    onSelectedInsumoIdChange,
    selectedLoteId,
    onSelectedLoteIdChange,
    quantidadeConsumida,
    onQuantidadeConsumidaChange,
    doseSanitaria = "",
    onDoseSanitariaChange,
    doseUnidadeSanitaria = "dose",
    onDoseUnidadeSanitariaChange,
    viaAplicacaoSanitaria = "",
    onViaAplicacaoSanitariaChange,
    onInsumoRefChange,
    onLoteRefChange,
    quantidadeExternaKg,
  } = props;

  // 1. Buscar Insumos do Dexie
  const insumos = useLiveQuery(async () => {
    if (!activeFarmId) return [] as Insumo[];
    const expectedTipo = tipoManejo === "sanitario" ? "sanitario" : "nutricional";
    const items = await db.state_insumos
      .where("fazenda_id")
      .equals(activeFarmId)
      .toArray();
    return items.filter((i) => i.tipo === expectedTipo && i.ativo && !i.deleted_at);
  }, [activeFarmId, tipoManejo]);

  // 2. Buscar Lotes do Insumo Selecionado com Saldo Projetado Offline
  const lotes = useLiveQuery(async () => {
    if (!activeFarmId || !selectedInsumoId) return [] as InsumoLote[];
    
    const [lotesList, movements, gestures] = await Promise.all([
      db.state_insumo_lotes
        .where("[fazenda_id+insumo_id]")
        .equals([activeFarmId, selectedInsumoId])
        .toArray(),
      db.state_insumo_movimentacoes
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.queue_gestures
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
    ]);

    const pendingTxIds = new Set(
      gestures
        .filter((g) => g.status !== "DONE" && g.status !== "SYNCED")
        .map((g) => g.client_tx_id)
    );

    const activeLots = lotesList.filter((l) => !l.deleted_at);

    return activeLots.map((lot) => {
      const pendingMovements = movements.filter(
        (m) =>
          m.insumo_lote_id === lot.id &&
          m.client_tx_id &&
          pendingTxIds.has(m.client_tx_id)
      );

      const saldoProjetado = pendingMovements.reduce((saldo, movement) => {
        const delta =
          movement.tipo === "entrada" ||
          movement.tipo === "ajuste_positivo" ||
          movement.tipo === "transferencia_entrada"
            ? movement.quantidade_base
            : -movement.quantidade_base;
        return saldo + delta;
      }, lot.saldo_atual_base);

      return {
        ...lot,
        saldo_atual_base: Math.max(saldoProjetado, 0),
      };
    });
  }, [activeFarmId, selectedInsumoId]);

  const sortedLots = useMemo(() => {
    return lotes ? sortLotsFEFO(lotes) : [];
  }, [lotes]);

  const activeInsumo = useMemo(() => {
    return insumos?.find((i) => i.id === selectedInsumoId) || null;
  }, [insumos, selectedInsumoId]);

  const activeLote = useMemo(() => {
    return sortedLots.find((l) => l.id === selectedLoteId) || null;
  }, [sortedLots, selectedLoteId]);

  // Propagar refs para o parent
  useEffect(() => {
    onInsumoRefChange?.(activeInsumo);
  }, [activeInsumo, onInsumoRefChange]);

  useEffect(() => {
    onLoteRefChange?.(activeLote);
  }, [activeLote, onLoteRefChange]);

  useEffect(() => {
    if (tipoManejo !== "sanitario") return;

    const defaultDoseUnit = resolveSanitaryDefaultDoseUnit({
      loteUnit: activeLote?.unidade_base ?? null,
      insumo: activeInsumo,
    });
    if (
      activeLote &&
      defaultDoseUnit &&
      doseUnidadeSanitaria !== defaultDoseUnit
    ) {
      onDoseUnidadeSanitariaChange?.(defaultDoseUnit);
    }

    if (!viaAplicacaoSanitaria) {
      onViaAplicacaoSanitariaChange?.(
        resolveSanitaryDefaultApplicationRoute({
          sanitarioTipo,
          insumo: activeInsumo,
        }),
      );
    }
  }, [
    activeInsumo,
    activeLote,
    doseUnidadeSanitaria,
    onDoseUnidadeSanitariaChange,
    onViaAplicacaoSanitariaChange,
    sanitarioTipo,
    tipoManejo,
    viaAplicacaoSanitaria,
  ]);

  // Sugestao automatica de lote por FEFO
  useEffect(() => {
    if (gerarBaixaEstoque && sortedLots.length > 0 && !selectedLoteId) {
      onSelectedLoteIdChange(sortedLots[0].id);
    }
  }, [gerarBaixaEstoque, sortedLots, selectedLoteId, onSelectedLoteIdChange]);

  // Sincronizar quantidade consumida em Nutricao
  useEffect(() => {
    if (tipoManejo === "nutricao" && quantidadeExternaKg !== undefined) {
      onQuantidadeConsumidaChange?.(quantidadeExternaKg);
    }
  }, [tipoManejo, quantidadeExternaKg, onQuantidadeConsumidaChange]);

  // Sincronizar dose + animais para quantidade sanitara
  useEffect(() => {
    if (tipoManejo === "sanitario" && doseSanitaria && onQuantidadeConsumidaChange) {
      const parsedDose = parseFloat(doseSanitaria.replace(",", "."));
      if (Number.isFinite(parsedDose) && parsedDose > 0) {
        const total = parsedDose * selectedAnimalCount;
        onQuantidadeConsumidaChange(String(parseFloat(total.toFixed(4))));
      } else {
        onQuantidadeConsumidaChange("");
      }
    }
  }, [tipoManejo, doseSanitaria, selectedAnimalCount, onQuantidadeConsumidaChange]);

  // Validador de elegibilidade
  const validation = useMemo(() => {
    if (!gerarBaixaEstoque || !activeLote) return null;
    const qty = parseFloat(quantidadeConsumida.replace(",", "."));
    return validateLotEligibility(activeLote, Number.isFinite(qty) ? qty : 0);
  }, [gerarBaixaEstoque, activeLote, quantidadeConsumida]);

  const formattedLotValidity = (validity: string | null) => {
    if (!validity) return "Sem validade";
    return new Date(`${validity}T00:00:00`).toLocaleDateString("pt-BR");
  };

  return (
    <div className="space-y-4 rounded-xl border border-dashed border-border/100 bg-background/30 p-3.5 mt-2">
      {tipoManejo === "sanitario" && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs">Dose por Cabeca</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="Ex.: 2"
              className="h-11 rounded-xl bg-background"
              value={doseSanitaria}
              onChange={(e) => onDoseSanitariaChange?.(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Unidade</Label>
            <select
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              value={activeLote?.unidade_base || doseUnidadeSanitaria}
              onChange={(e) => onDoseUnidadeSanitariaChange?.(e.target.value)}
              disabled={Boolean(activeLote)}
            >
              <option value="dose">dose</option>
              <option value="ml">ml</option>
              <option value="l">l</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="un">un</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Via de Aplicacao</Label>
            <select
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              value={viaAplicacaoSanitaria}
              onChange={(e) => onViaAplicacaoSanitariaChange?.(e.target.value)}
            >
              <option value="">Selecione...</option>
              <option value="subcutanea">Subcutanea</option>
              <option value="intramuscular">Intramuscular</option>
              <option value="oral">Oral</option>
              <option value="topica">Topica</option>
              <option value="intramamaria">Intramamaria</option>
              <option value="outra">Outra</option>
            </select>
          </div>
        </div>
      )}

      {/* Switch de ativacao de baixa */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-sm font-semibold flex items-center gap-1.5 cursor-pointer" htmlFor="switch-baixa">
            <TrendingDown className="h-4.5 w-4.5 text-primary" />
            Baixar do Estoque
          </Label>
          <span className="text-xs text-muted-foreground">
            Lançar baixa automática assistida deste produto no estoque
          </span>
        </div>
        <input
          id="switch-baixa"
          type="checkbox"
          checked={gerarBaixaEstoque}
          onChange={(e) => onGerarBaixaEstoqueChange(e.target.checked)}
          className="h-5 w-10 cursor-pointer rounded-full appearance-none bg-muted border border-input checked:bg-primary relative before:absolute before:h-4 before:w-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:translate-x-5 transition-all duration-200"
        />
      </div>

      {gerarBaixaEstoque && (
        <div className="space-y-4.5 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Selecao de Insumo */}
          <div className="space-y-2">
            <Label className="text-xs">Selecione o Insumo do Estoque</Label>
            <select
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              value={selectedInsumoId}
              onChange={(e) => {
                onSelectedInsumoIdChange(e.target.value);
                onSelectedLoteIdChange(""); // Reset lote
              }}
            >
              <option value="">Selecione um Insumo...</option>
              {insumos?.map((insumo) => (
                <option key={insumo.id} value={insumo.id}>
                  {insumo.nome} {insumo.categoria ? `(${insumo.categoria})` : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedInsumoId && (
            <>
              {/* Selecao de Lote */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center justify-between">
                  <span>Lote de Estoque (Sugerido por FEFO)</span>
                  {activeLote && (
                    <Badge variant="outline" className="text-[10px] font-normal py-0">
                      Saldo: {activeLote.saldo_atual_base} {activeLote.unidade_base}
                    </Badge>
                  )}
                </Label>
                <select
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                  value={selectedLoteId}
                  onChange={(e) => onSelectedLoteIdChange(e.target.value)}
                >
                  <option value="">Selecione um lote...</option>
                  {sortedLots.map((lote, index) => {
                    const validationCheck = validateLotEligibility(
                      lote,
                      parseFloat(quantidadeConsumida) || 0
                    );
                    const labelSuf = index === 0 ? " (Sugerido)" : "";
                    return (
                      <option
                        key={lote.id}
                        value={lote.id}
                        disabled={!validationCheck.eligible && validationCheck.error?.includes("deletado")}
                      >
                        Lote: {lote.identificacao_lote || "Sem ID"} · Venc: {formattedLotValidity(lote.validade)} · Saldo: {lote.saldo_atual_base} {lote.unidade_base}{labelSuf}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Quantidade/Dose */}
              {tipoManejo === "sanitario" ? (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Dose por Cabeça</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Ex.: 2"
                        className="h-11 rounded-xl bg-background pr-12"
                        value={doseSanitaria}
                        onChange={(e) => onDoseSanitariaChange?.(e.target.value)}
                      />
                      <span className="absolute right-3.5 top-3 text-xs text-muted-foreground font-medium pointer-events-none">
                        {activeLote?.unidade_base || "ml"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Quantidade Total</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        disabled
                        className="h-11 rounded-xl bg-muted pr-12 text-muted-foreground font-semibold"
                        value={quantidadeConsumida}
                      />
                      <span className="absolute right-3.5 top-3 text-xs text-muted-foreground font-medium pointer-events-none">
                        {activeLote?.unidade_base || "ml"}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground block pl-0.5">
                      Dose × {selectedAnimalCount} animal(is)
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Via de Aplicacao</Label>
                    <select
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                      value={viaAplicacaoSanitaria}
                      onChange={(e) => onViaAplicacaoSanitariaChange?.(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      <option value="subcutanea">Subcutanea</option>
                      <option value="intramuscular">Intramuscular</option>
                      <option value="oral">Oral</option>
                      <option value="topica">Topica</option>
                      <option value="intramamaria">Intramamaria</option>
                      <option value="outra">Outra</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs">Quantidade Baixada</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      disabled
                      className="h-11 rounded-xl bg-muted pr-12 text-muted-foreground font-semibold"
                      value={quantidadeConsumida}
                    />
                    <span className="absolute right-3.5 top-3 text-xs text-muted-foreground font-medium pointer-events-none">
                      {activeLote?.unidade_base || "kg"}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block pl-0.5">
                    Sincronizada com o peso do alimento acima
                  </span>
                </div>
              )}

              {/* Mensagens de Alertas e Validação */}
              {validation && (
                <div className="space-y-2 mt-1">
                  {!validation.eligible && validation.error && (
                    <div className="flex items-start gap-2 text-xs text-destructive rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 animate-in fade-in duration-200">
                      <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-destructive" />
                      <span>{validation.error}</span>
                    </div>
                  )}
                  {validation.eligible && validation.warning && (
                    <div className="flex items-start gap-2 text-xs text-warning rounded-lg border border-warning/20 bg-warning/5 p-2.5 animate-in fade-in duration-200">
                      <Calendar className="h-4.5 w-4.5 shrink-0 mt-0.5 text-warning" />
                      <span>{validation.warning}</span>
                    </div>
                  )}
                  {validation.eligible && !validation.warning && activeLote && (
                    <div className="flex items-start gap-2 text-xs text-emerald-600 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 dark:text-emerald-400 dark:border-emerald-900/50 dark:bg-emerald-950/20 animate-in fade-in duration-200">
                      <Package className="h-4.5 w-4.5 shrink-0 mt-0.5 text-emerald-500" />
                      <span>Lote selecionado elegível com saldo e validade adequados!</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
