import { ReactNode, useEffect, useMemo } from "react";
import type { Animal, Contraparte } from "@/lib/offline/types";
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
} from "lucide-react";
import { FinanceiroContraparteSection } from "@/pages/Registrar/components/FinanceiroContraparteSection";
import type { RegistrarNovaContraparteDraft } from "@/pages/Registrar/effects/contraparteCreate";
import { calculateCommercialOperation } from "@/lib/comercial/commercialOperation";
import { cn } from "@/lib/utils";
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
  pesoVivoTotal: string;
  valorBruto: string;
  frete: string;
  comissao: string;
  descontos: string;
  taxasImpostos: string;
  contraparteId: string;
  financeTransactionId: string;
  observacoes: string;
  /** Peso individual por animal (scope=animal) — chave = animal.id */
  pesosPorAnimal: Record<string, string>;
  /** Valor individual por animal (scope=animal) — chave = animal.id */
  valoresPorAnimal: Record<string, string>;
};

type AnimalWithLastWeight = {
  id: string;
  identificacao: string;
  nome: string | null;
  lastWeightKg: number | null;
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
  weightUnitLabel: string;
  transitChecklistSection?: ReactNode;
  sanitaryMovementBlockSection?: ReactNode;
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
    weightUnitLabel,
    transitChecklistSection,
    sanitaryMovementBlockSection,
  } = props;

  const isAnimalScope = comercialData.scope === "animal";
  const hasAnimals = selectedAnimalIds.length > 0;

  // ---------------------------------------------------------------------------
  // Auto-fill: quando scope muda para "animal" e há animais selecionados,
  // pré-preenche pesosPorAnimal com os últimos pesos e totaliza pesoVivoTotal
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isAnimalScope || !hasAnimals) return;

    const newPesosPorAnimal: Record<string, string> = {};
    let total = 0;
    let hasSomeWeight = false;

    for (const id of selectedAnimalIds) {
      const a = animaisComPeso.find((x) => x.id === id);
      const existing = comercialData.pesosPorAnimal[id];
      if (existing !== undefined) {
        // já preenchido — preservar
        newPesosPorAnimal[id] = existing;
        const v = parseFloat(existing);
        if (!isNaN(v) && v > 0) {
          total += v;
          hasSomeWeight = true;
        }
      } else if (a?.lastWeightKg != null) {
        newPesosPorAnimal[id] = String(a.lastWeightKg);
        total += a.lastWeightKg;
        hasSomeWeight = true;
      } else {
        newPesosPorAnimal[id] = "";
      }
    }

    updateComercialData("pesosPorAnimal", newPesosPorAnimal);

    // Só sobrescreve pesoVivoTotal se ainda não foi editado manualmente
    if (hasSomeWeight && comercialData.pesoVivoTotal === "") {
      updateComercialData("pesoVivoTotal", String(total.toFixed(2)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimalScope, selectedAnimalIds, animaisComPeso]);

  // Recalcula peso total quando pesosPorAnimal muda no modo animal
  useEffect(() => {
    if (!isAnimalScope || !hasAnimals) return;
    const total = selectedAnimalIds.reduce((acc, id) => {
      const v = parseFloat(comercialData.pesosPorAnimal[id] ?? "");
      return isNaN(v) ? acc : acc + v;
    }, 0);
    if (total > 0) {
      updateComercialData("pesoVivoTotal", String(total.toFixed(2)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comercialData.pesosPorAnimal]);

  // ---------------------------------------------------------------------------
  // Cálculo do resumo de operação
  // ---------------------------------------------------------------------------
  const calculationSummary = useMemo(() => {
    const qty =
      isAnimalScope && hasAnimals
        ? selectedAnimalIds.length
        : parseInt(comercialData.quantidadeAnimais, 10) || 0;

    const peso = parseFloat(comercialData.pesoVivoTotal) || 0;
    const bruto = parseFloat(comercialData.valorBruto) || 0;
    const frete = parseFloat(comercialData.frete) || 0;
    const comissao = parseFloat(comercialData.comissao) || 0;
    const descontos = parseFloat(comercialData.descontos) || 0;
    const taxas = parseFloat(comercialData.taxasImpostos) || 0;

    const contraparte = contrapartes?.find(
      (c) => c.id === comercialData.contraparteId,
    );

    return calculateCommercialOperation({
      operationType: comercialData.operationType,
      scope: comercialData.scope,
      occurredAt: comercialData.occurredAt,
      quantidadeAnimais: qty > 0 ? qty : undefined,
      pesoVivoTotal: comercialData.pesoVivoTotal !== "" ? peso : undefined,
      valorBruto: comercialData.valorBruto !== "" ? bruto : undefined,
      frete: comercialData.frete !== "" ? frete : undefined,
      comissao: comercialData.comissao !== "" ? comissao : undefined,
      descontos: comercialData.descontos !== "" ? descontos : undefined,
      taxasImpostos: comercialData.taxasImpostos !== "" ? taxas : undefined,
      contraparteId:
        comercialData.contraparteId !== "none"
          ? comercialData.contraparteId
          : undefined,
      contraparteNome: contraparte?.nome,
      financeTransactionId:
        comercialData.financeTransactionId !== "none"
          ? comercialData.financeTransactionId
          : undefined,
      animalIds: isAnimalScope ? selectedAnimalIds : undefined,
    });
  }, [
    comercialData,
    selectedAnimalIds,
    contrapartes,
    isAnimalScope,
    hasAnimals,
  ]);

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
              onClick={() => updateComercialData("operationType", opt.value)}
              className="rounded-full shadow-none flex-1"
            >
              {opt.label}
            </Button>
          ))}
        </div>
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
            {/* Escopo da Operação */}
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3">
              <Label>Escopo da Operação</Label>
              <div className="flex gap-2">
                {(
                  [
                    { value: "animal", label: "Por Animal" },
                    { value: "lote", label: "Por Lote" },
                  ] as const
                ).map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={
                      comercialData.scope === opt.value ? "default" : "outline"
                    }
                    onClick={() => updateComercialData("scope", opt.value)}
                    disabled={opt.value === "animal" && !hasAnimals}
                    className="rounded-full shadow-none flex-1"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {isAnimalScope && hasAnimals
                  ? `${selectedAnimalIds.length} animal(is) pré-selecionado(s). Pesos e valores individuais abaixo.`
                  : !hasAnimals
                    ? "Sem animais selecionados. Use Por Lote para informar totais."
                    : null}
              </p>
            </div>
              </div>

            {/* Data + Quantidade + Peso Total */}
          <div className="grid gap-5 md:grid-cols-3">
            {/* Data da Operação */}
            <div className="space-y-2">
              <Label>Data da Operação</Label>
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
                Quantidade de Animais
                {isAnimalScope && hasAnimals && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </Label>
              <Input
                type="number"
                min="1"
                value={
                  isAnimalScope && hasAnimals
                    ? String(selectedAnimalIds.length)
                    : comercialData.quantidadeAnimais
                }
                disabled={isAnimalScope && hasAnimals}
                onChange={(e) =>
                  updateComercialData("quantidadeAnimais", e.target.value)
                }
                placeholder="Ex: 10"
                className={cn(
                  "bg-background",
                  isAnimalScope &&
                    hasAnimals &&
                    "opacity-70 cursor-not-allowed",
                )}
              />
              {isAnimalScope && hasAnimals && (
                <p className="text-[11px] text-muted-foreground">
                  Derivado da seleção de animais
                </p>
              )}
            </div>

            {/* Peso Vivo Total */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Peso Vivo Total ({weightUnitLabel})
                {isAnimalScope && hasAnimals && (
                  <Pencil className="h-3 w-3 text-blue-500" />
                )}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={comercialData.pesoVivoTotal}
                onChange={(e) =>
                  updateComercialData("pesoVivoTotal", e.target.value)
                }
                placeholder="Ex: 3500.00"
                className="bg-background"
              />
              {isAnimalScope && hasAnimals && (
                <p className="text-[11px] text-muted-foreground">
                  Soma dos pesos individuais (editável)
                </p>
              )}
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* MODO POR ANIMAL: grid individual */}
          {/* ---------------------------------------------------------------- */}
          {isAnimalScope && hasAnimals && (
            <div className="space-y-3 border border-border/60 rounded-xl p-4 bg-background/50">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">
                  Peso &amp; Valor por Animal
                </p>
                <span className="ml-auto text-xs text-muted-foreground">
                  {selectedAnimalIds.length} animal(is)
                </span>
              </div>

              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-[1fr_120px_120px] gap-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
                  <span>Animal</span>
                  <span>Peso ({weightUnitLabel})</span>
                  <span>Valor (R$)</span>
                </div>

                {selectedAnimalIds.map((id) => {
                  const animal = animaisComPeso.find((a) => a.id === id);
                  const label = animal
                    ? fmtAnimalLabel(animal)
                    : id.slice(0, 8);
                  const hasLastWeight =
                    animal?.lastWeightKg != null &&
                    !comercialData.pesosPorAnimal[id];

                  return (
                    <div
                      key={id}
                      className="grid grid-cols-[1fr_120px_120px] gap-2 items-center"
                    >
                      {/* Nome */}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{label}</p>
                        {hasLastWeight && (
                          <p className="text-[10px] text-muted-foreground">
                            Último: {animal!.lastWeightKg} {weightUnitLabel}
                          </p>
                        )}
                      </div>

                      {/* Peso individual */}
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={comercialData.pesosPorAnimal[id] ?? ""}
                        onChange={(e) => {
                          const next = {
                            ...comercialData.pesosPorAnimal,
                            [id]: e.target.value,
                          };
                          updateComercialData("pesosPorAnimal", next);
                        }}
                        placeholder={
                          animal?.lastWeightKg != null
                            ? String(animal.lastWeightKg)
                            : "0.0"
                        }
                        className="bg-background h-9 text-sm"
                      />

                      {/* Valor individual */}
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={comercialData.valoresPorAnimal[id] ?? ""}
                        onChange={(e) => {
                          const next = {
                            ...comercialData.valoresPorAnimal,
                            [id]: e.target.value,
                          };
                          updateComercialData("valoresPorAnimal", next);
                        }}
                        placeholder="0.00"
                        className="bg-background h-9 text-sm"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Totais derivados no modo animal */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
                <div className="rounded-lg bg-muted/60 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Peso Total
                  </p>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {comercialData.pesoVivoTotal
                      ? `${parseFloat(comercialData.pesoVivoTotal).toFixed(1)} ${weightUnitLabel}`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/60 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Valor Total Individual
                  </p>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {(() => {
                      const total = selectedAnimalIds.reduce((acc, id) => {
                        const v = parseFloat(
                          comercialData.valoresPorAnimal[id] ?? "",
                        );
                        return isNaN(v) ? acc : acc + v;
                      }, 0);
                      return total > 0 ? `R$ ${total.toFixed(2)}` : "—";
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
            {/* Valor Bruto */}
            <div className="space-y-2">
              <Label>
                {isAnimalScope && hasAnimals
                  ? "Valor Bruto Total (R$)"
                  : "Valor Bruto (R$)"}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={comercialData.valorBruto}
                onChange={(e) =>
                  updateComercialData("valorBruto", e.target.value)
                }
                placeholder="0.00"
                className="bg-background"
              />
            </div>

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
          </div>

          {/* Derivados globais */}
          <div className="grid gap-4 border-t pt-5 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-background/50 p-4 text-center">
              <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                Peso Médio Estimado
              </span>
              <p className="mt-1 text-2xl font-bold text-primary">
                {calculationSummary.pesoMedioDerivado !== undefined
                  ? `${calculationSummary.pesoMedioDerivado.toFixed(2)} ${weightUnitLabel}`
                  : "—"}
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/50 p-4 text-center">
              <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                Valor Líquido Estimado
              </span>
              <p className="mt-1 text-2xl font-bold text-primary">
                {calculationSummary.valorLiquidoDerivado !== undefined
                  ? `R$ ${calculationSummary.valorLiquidoDerivado.toFixed(2)}`
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
                <p>• Valor líquido estimado a partir dos campos preenchidos.</p>
                <p>
                  • Não representa recomendação comercial ou substitui validação
                  operacional/financeira.
                </p>
              </div>
            </div>

            {calculationSummary.issues.length > 0 && (
              <div className="space-y-2">
                {calculationSummary.issues.map((issue, idx) => (
                  <Alert
                    key={idx}
                    variant={
                      issue.severity === "blocking" ? "destructive" : "default"
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
                  Limitações Informativas ({calculationSummary.calculationStatus}
                  )
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
