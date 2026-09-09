import React from "react";
import type { Animal } from "@/lib/offline/types";
import {
  type ProductiveCommercialSimulationResult,
  type ProductiveSimulationDerived,
  type CommercialSimulationDerived,
  type SimulationComparisonDerived,
} from "@/lib/simulation/productiveCommercialSimulation";
import type { CommercialArrobaBasis } from "@/lib/comercial/commercialPricing";
import { useProductiveCommercialSimulation } from "./useProductiveCommercialSimulation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Scale,
  TrendingUp,
  AlertCircle,
  Info,
  Layers,
} from "lucide-react";

export interface ProductiveCommercialSimulatorProps {
  animal: Pick<Animal, "id" | "brinco" | "nome" | "fazenda_id" | "deleted_at">;
  fazendaId: string;
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null || !Number.isFinite(val)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

function formatNumber(val: number | null | undefined, decimals = 2): string {
  if (val == null || !Number.isFinite(val)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

function formatDate(isoStr: string | null | undefined): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function ObservedDataBlock({
  animal,
  observedWeightKg,
  observedAt,
  factualGmdKgDay,
}: {
  animal: Pick<Animal, "id" | "brinco" | "nome">;
  observedWeightKg: number | null;
  observedAt: string | null;
  factualGmdKgDay: number | null;
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-bold tracking-wider">
              OBSERVADO
            </Badge>
            <CardTitle className="text-base font-semibold">
              Dados Fatuais Registrados
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">Fonte: Histórico de Pesagens</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-3 bg-muted/20">
            <span className="text-xs text-muted-foreground block font-medium">
              Último peso observado
            </span>
            <div className="flex items-center gap-2 mt-1">
              <Scale className="h-4 w-4 text-primary" />
              <span className="text-xl font-bold">
                {observedWeightKg != null ? `${formatNumber(observedWeightKg, 1)} kg` : "Sem pesagem"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">
              Data: {formatDate(observedAt)}
            </span>
          </div>

          <div className="rounded-lg border p-3 bg-muted/20">
            <span className="text-xs text-muted-foreground block font-medium">
              GMD factual observado
            </span>
            <div className="flex items-center gap-2 mt-1">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xl font-bold">
                {factualGmdKgDay != null ? `${formatNumber(factualGmdKgDay, 3)} kg/dia` : "Aguardando série"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">
              {factualGmdKgDay != null ? "Calculado entre últimas pesagens" : "Série histórica insuficiente"}
            </span>
          </div>

          <div className="rounded-lg border p-3 bg-muted/20">
            <span className="text-xs text-muted-foreground block font-medium">
              Animal
            </span>
            <div className="mt-1">
              <span className="text-base font-bold block">
                {animal.brinco || animal.nome || "Sem identificação"}
              </span>
              <span className="text-xs text-muted-foreground block">
                ID: {animal.id.slice(0, 8)}...
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>
            O peso observado provém de medição física anterior e não é inferido como peso atual em tempo real.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

interface AssumptionsBlockProps {
  targetWeightInput: string;
  setTargetWeightInput: (v: string) => void;
  assumedGmdInput: string;
  setAssumedGmdInput: (v: string) => void;
  pricePerArrobaInput: string;
  setPricePerArrobaInput: (v: string) => void;
  arrobaBasis: CommercialArrobaBasis;
  setArrobaBasis: (v: CommercialArrobaBasis) => void;
  carcassYieldInput: string;
  setCarcassYieldInput: (v: string) => void;
  sellNowCarcassWeightInput: string;
  setSellNowCarcassWeightInput: (v: string) => void;
  targetCarcassWeightInput: string;
  setTargetCarcassWeightInput: (v: string) => void;
  dailyCostInput: string;
  setDailyCostInput: (v: string) => void;
  additionalCostInput: string;
  setAdditionalCostInput: (v: string) => void;
}

function AssumptionsBlock(props: AssumptionsBlockProps) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary text-primary font-bold tracking-wider">
              PREMISSA
            </Badge>
            <CardTitle className="text-base font-semibold">
              Premissas do Cenário
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">Parâmetros editáveis</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="targetWeightInput" className="text-xs font-semibold">
              Peso-alvo vivo (kg) *
            </Label>
            <Input
              id="targetWeightInput"
              type="number"
              step="1"
              min="1"
              placeholder="Ex: 500 (obrigatório)"
              value={props.targetWeightInput}
              onChange={(e) => props.setTargetWeightInput(e.target.value)}
              className="h-9"
            />
            <span className="text-[11px] text-muted-foreground">
              Peso vivo final desejado para a projeção biológica.
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assumedGmdInput" className="text-xs font-semibold">
              GMD assumido no cenário (kg/dia) *
            </Label>
            <Input
              id="assumedGmdInput"
              type="number"
              step="0.05"
              min="0.01"
              placeholder="Ex: 0.80 (obrigatório)"
              value={props.assumedGmdInput}
              onChange={(e) => props.setAssumedGmdInput(e.target.value)}
              className="h-9"
            />
            <span className="text-[11px] text-muted-foreground">
              Premissa editável. O ganho histórico não garante ganho futuro.
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pricePerArrobaInput" className="text-xs font-semibold">
              Preço por arroba (R$) *
            </Label>
            <Input
              id="pricePerArrobaInput"
              type="number"
              step="5"
              min="1"
              placeholder="Ex: 300 (obrigatório)"
              value={props.pricePerArrobaInput}
              onChange={(e) => props.setPricePerArrobaInput(e.target.value)}
              className="h-9"
            />
            <span className="text-[11px] text-muted-foreground">
              Cotação projetada para a venda.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="arrobaBasisSelect" className="text-xs font-semibold">
              Base de cálculo da arroba *
            </Label>
            <Select
              value={props.arrobaBasis}
              onValueChange={(val: CommercialArrobaBasis) => props.setArrobaBasis(val)}
            >
              <SelectTrigger id="arrobaBasisSelect" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="live_weight_yield">Rendimento sobre peso vivo (%)</SelectItem>
                <SelectItem value="carcass_weight">Pesos de carcaça diretos (15 kg/@)</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground">
              Regra de conversão entre kg e arrobas comerciais.
            </span>
          </div>

          {props.arrobaBasis === "live_weight_yield" ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="carcassYieldInput" className="text-xs font-semibold">
                Rendimento de carcaça (%) *
              </Label>
              <Input
                id="carcassYieldInput"
                type="number"
                step="0.5"
                min="1"
                max="100"
                placeholder="Ex: 50 (obrigatório)"
                value={props.carcassYieldInput}
                onChange={(e) => props.setCarcassYieldInput(e.target.value)}
                className="h-9"
              />
              <span className="text-[11px] text-muted-foreground">
                Obrigatório para a base sobre peso vivo. Não possui default automático.
              </span>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="sellNowCarcassWeightInput" className="text-xs font-semibold">
                  Carcaça na venda agora (kg) *
                </Label>
                <Input
                  id="sellNowCarcassWeightInput"
                  type="number"
                  step="0.5"
                  min="1"
                  placeholder="Ex: 210"
                  value={props.sellNowCarcassWeightInput}
                  onChange={(e) => props.setSellNowCarcassWeightInput(e.target.value)}
                  className="h-9"
                />
                <span className="text-[11px] text-muted-foreground">
                  Premissa de carcaça para a pesagem atual.
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="targetCarcassWeightInput" className="text-xs font-semibold">
                  Carcaça no alvo pretendido (kg) *
                </Label>
                <Input
                  id="targetCarcassWeightInput"
                  type="number"
                  step="0.5"
                  min="1"
                  placeholder="Ex: 260"
                  value={props.targetCarcassWeightInput}
                  onChange={(e) => props.setTargetCarcassWeightInput(e.target.value)}
                  className="h-9"
                />
                <span className="text-[11px] text-muted-foreground">
                  Premissa de carcaça projetada ao atingir o alvo.
                </span>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="dailyCostInput" className="text-xs font-semibold">
              Custo diário incremental (R$/dia)
            </Label>
            <Input
              id="dailyCostInput"
              type="number"
              step="0.5"
              min="0"
              placeholder="Ex: 5.00 (opcional)"
              value={props.dailyCostInput}
              onChange={(e) => props.setDailyCostInput(e.target.value)}
              className="h-9"
            />
            <span className="text-[11px] text-muted-foreground">
              Custo de trato/nutrição incremental diário.
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="additionalCostInput" className="text-xs font-semibold">
              Custos adicionais pontuais (R$)
            </Label>
            <Input
              id="additionalCostInput"
              type="number"
              step="10"
              min="0"
              placeholder="Ex: 50.00 (opcional)"
              value={props.additionalCostInput}
              onChange={(e) => props.setAdditionalCostInput(e.target.value)}
              className="h-9"
            />
            <span className="text-[11px] text-muted-foreground">
              Vacinas, frete ou despesas adicionais específicas.
            </span>
          </div>

          <div className="flex items-center">
            <div className="rounded-md border p-2.5 bg-muted/10 text-xs text-muted-foreground flex items-center gap-2 w-full">
              <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                <strong>Aviso sobre custos:</strong> Se algum custo for omitido, a cobertura será parcial. Custos não preenchidos <em>nunca são assumidos como zero</em>.
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductiveScenarioBlock({
  productive,
  observedWeightKg,
  assumedGmdKgDay,
}: {
  productive: ProductiveSimulationDerived;
  observedWeightKg: number | null;
  assumedGmdKgDay: number;
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-sky-600 hover:bg-sky-600 text-white font-bold tracking-wider">
              SIMULADO
            </Badge>
            <CardTitle className="text-base font-semibold">
              Cenário Produtivo
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">Projeção Biológica do Cenário</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-3 bg-muted/10">
            <span className="text-xs text-muted-foreground block font-medium">
              Ganho necessário
            </span>
            <div className="text-xl font-bold mt-1">
              {formatNumber(productive.weightGainKg, 1)} kg
            </div>
            <span className="text-xs text-muted-foreground block mt-1">
              {productive.weightGainKg === 0
                ? "Peso-alvo já atingido"
                : `De ${formatNumber(observedWeightKg, 1)} kg para ${formatNumber(productive.targetWeightKg, 1)} kg`}
            </span>
          </div>

          <div className="rounded-lg border p-3 bg-muted/10">
            <span className="text-xs text-muted-foreground block font-medium">
              Tempo estimado no cenário
            </span>
            <div className="text-xl font-bold mt-1 text-primary">
              {Math.ceil(productive.estimatedDays)} dias
            </div>
            <span className="text-xs text-muted-foreground block mt-1">
              Com base no GMD assumido de {formatNumber(assumedGmdKgDay, 2)} kg/dia
            </span>
          </div>

          <div className="rounded-lg border p-3 bg-muted/10">
            <span className="text-xs text-muted-foreground block font-medium">
              Peso final simulado
            </span>
            <div className="text-xl font-bold mt-1">
              {formatNumber(productive.targetWeightKg, 1)} kg
            </div>
            <span className="text-xs text-muted-foreground block mt-1">
              Alvo pretendido no cenário
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CommercialScenarioBlock({
  commercial,
  arrobaBasis,
  pricePerArroba,
}: {
  commercial: CommercialSimulationDerived;
  arrobaBasis: CommercialArrobaBasis;
  pricePerArroba: number;
}) {
  const coverageLabel =
    commercial.costCoverage === "COMPLETE"
      ? "Completa (informados)"
      : "Parcial";

  const coverageVariant =
    commercial.costCoverage === "COMPLETE" ? "default" : "secondary";

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold tracking-wider">
              SIMULADO
            </Badge>
            <CardTitle className="text-base font-semibold">
              Cenário Comercial
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Cobertura de custos:</span>
            <Badge variant={coverageVariant} className="text-[10px] uppercase font-bold">
              {coverageLabel}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border p-3 bg-muted/10">
            <span className="text-xs text-muted-foreground block font-medium">
              Arrobas no peso-alvo
            </span>
            <div className="text-xl font-bold mt-1">
              {formatNumber(commercial.targetArrobas, 2)} @
            </div>
            <span className="text-xs text-muted-foreground block mt-1">
              Base: {arrobaBasis === "carcass_weight" ? "Carcaça direta (15kg)" : "Rend. vivo"}
            </span>
          </div>

          <div className="rounded-lg border p-3 bg-muted/10">
            <span className="text-xs text-muted-foreground block font-medium">
              Receita bruta simulada
            </span>
            <div className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
              {formatCurrency(commercial.grossRevenueSimulated)}
            </div>
            <span className="text-xs text-muted-foreground block mt-1">
              A {formatCurrency(pricePerArroba)}/@
            </span>
          </div>

          <div className="rounded-lg border p-3 bg-muted/10">
            <span className="text-xs text-muted-foreground block font-medium">
              Custos incrementais
            </span>
            <div className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">
              {formatCurrency(commercial.incrementalCost)}
            </div>
            <span className="text-xs text-muted-foreground block mt-1">
              {commercial.incrementalCost === null
                ? "Não informados"
                : commercial.costCoverage === "COMPLETE"
                ? "Custos informados somados"
                : "Cobertura parcial"}
            </span>
          </div>

          <div className="rounded-lg border p-3 bg-muted/10">
            <span className="text-xs text-muted-foreground block font-medium">
              Margem parcial simulada
            </span>
            <div className="text-xl font-bold mt-1">
              {formatCurrency(commercial.partialSimulatedMargin)}
            </div>
            <span className="text-xs text-muted-foreground block mt-1">
              Receita bruta - custos informados
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Preço de equilíbrio do cenário (Break-even)
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Preço por arroba que igualaria os dois cenários considerando apenas as premissas e custos completos informados.
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xl font-black text-primary block">
              {commercial.breakEvenPricePerArroba != null
                ? `${formatCurrency(commercial.breakEvenPricePerArroba)} / @`
                : "Indisponível sem cobertura completa"}
            </span>
          </div>
        </div>

        <div className="rounded-md border p-2.5 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-200">
          <strong>Aviso:</strong> Cálculo parcial com base apenas nos custos informados. Custos fixos da fazenda, mão de obra geral, aquisição de animais e carência não foram deduzidos. Nunca trate este valor como lucro líquido ou garantia financeira.
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonBlock({
  comparison,
}: {
  comparison: SimulationComparisonDerived;
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-purple-500 text-purple-600 dark:text-purple-400 font-bold tracking-wider">
              SIMULADO
            </Badge>
            <CardTitle className="text-base font-semibold">
              Comparação: Vender Agora × Manter até Alvo
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">Diferença numérica pura sem recomendação</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border p-4 bg-muted/10 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Cenário A • Venda Agora
              </span>
              <Badge variant="secondary" className="text-[10px]">Fato Observado</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Peso vivo observado:</span>
                <p className="font-semibold text-sm mt-0.5">{formatNumber(comparison.sellNow.weightKg, 1)} kg</p>
              </div>
              <div>
                <span className="text-muted-foreground">Arrobas:</span>
                <p className="font-semibold text-sm mt-0.5">{formatNumber(comparison.sellNow.arrobas, 2)} @</p>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <span className="text-muted-foreground">Receita bruta agora:</span>
                <p className="font-bold text-base mt-0.5 text-foreground">
                  {formatCurrency(comparison.sellNow.grossRevenue)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-4 bg-muted/10 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Cenário B • Manter até Alvo
              </span>
              <Badge variant="outline" className="text-[10px]">Projeção no Cenário</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Peso vivo pretendido:</span>
                <p className="font-semibold text-sm mt-0.5">{formatNumber(comparison.keepUntilTarget.targetWeightKg, 1)} kg</p>
              </div>
              <div>
                <span className="text-muted-foreground">Arrobas:</span>
                <p className="font-semibold text-sm mt-0.5">{formatNumber(comparison.keepUntilTarget.targetArrobas, 2)} @</p>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <span className="text-muted-foreground">Receita bruta no alvo:</span>
                <p className="font-bold text-base mt-0.5 text-foreground">
                  {formatCurrency(comparison.keepUntilTarget.grossRevenue)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Custos incrementais:</span>
                <p className="font-semibold mt-0.5 text-amber-600 dark:text-amber-400">
                  {formatCurrency(comparison.keepUntilTarget.incrementalCost)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Resultado parcial:</span>
                <p className="font-semibold mt-0.5">
                  {formatCurrency(comparison.keepUntilTarget.partialIncrementalResult)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-3 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold uppercase tracking-wider text-muted-foreground">
              Diferença Numérica entre Cenários
            </span>
            <p className="text-muted-foreground mt-0.5">
              Delta estritamente aritmético entre manter até o peso-alvo e vender nas condições atuais observadas.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <span className="text-muted-foreground block text-[11px]">Diferença de Receita Bruta:</span>
              <span className="font-bold text-sm text-foreground">
                {comparison.difference.grossRevenueDelta >= 0 ? "+" : ""}
                {formatCurrency(comparison.difference.grossRevenueDelta)}
              </span>
            </div>
            {comparison.difference.partialIncrementalResultDelta != null && (
              <div className="text-right border-l pl-4">
                <span className="text-muted-foreground block text-[11px]">Diferença Parcial Líquida:</span>
                <span className="font-bold text-sm text-foreground">
                  {comparison.difference.partialIncrementalResultDelta >= 0 ? "+" : ""}
                  {formatCurrency(comparison.difference.partialIncrementalResultDelta)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground text-center italic">
          Este comparativo apresenta apenas a diferença matemática entre as premissas informadas. Ele não decide, não recomenda e não orienta a conduta comercial do produtor.
        </div>
      </CardContent>
    </Card>
  );
}

function LimitationsBlock({ limitations }: { limitations: string[] }) {
  return (
    <Card className="border-border/60 bg-muted/10 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          Limitações do Cenário e Notas de Conformidade
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
          {limitations.map((lim, idx) => (
            <li key={idx}>{lim}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SimulationActiveContent({
  simulation,
  observedWeightKg,
}: {
  simulation: ProductiveCommercialSimulationResult;
  observedWeightKg: number | null;
}) {
  if (simulation.status === "BLOCKED" || !simulation.productive || !simulation.commercial) {
    return null;
  }
  return (
    <>
      <ProductiveScenarioBlock
        productive={simulation.productive}
        observedWeightKg={observedWeightKg}
        assumedGmdKgDay={simulation.assumptions.assumedGmdKgDay}
      />
      <CommercialScenarioBlock
        commercial={simulation.commercial}
        arrobaBasis={simulation.assumptions.arrobaBasis}
        pricePerArroba={simulation.assumptions.pricePerArroba}
      />
      {simulation.comparison && (
        <ComparisonBlock comparison={simulation.comparison} />
      )}
    </>
  );
}

export function ProductiveCommercialSimulator({
  animal,
  fazendaId,
}: ProductiveCommercialSimulatorProps) {
  const {
    observedWeightKg,
    observedAt,
    factualGmdKgDay,
    inputs,
    setters,
    simulation,
  } = useProductiveCommercialSimulation({ animal, fazendaId });

  return (
    <div className="space-y-6" data-testid="productive-commercial-simulator">
      <div className="flex flex-col gap-2 border-b pb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">
            Simulação Produtiva e Comercial
          </h2>
          <Badge variant="outline" className="text-xs uppercase font-semibold">
            F23 V1 • Efêmero
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Simulador de cenários baseado em fatos observados e premissas explícitas.
          Os cálculos são estritamente prospectivos e não geram eventos, tarefas na agenda nem recomendações operacionais.
        </p>
      </div>

      <ObservedDataBlock
        animal={animal}
        observedWeightKg={observedWeightKg}
        observedAt={observedAt}
        factualGmdKgDay={factualGmdKgDay}
      />

      <AssumptionsBlock
        targetWeightInput={inputs.targetWeightInput}
        setTargetWeightInput={setters.setTargetWeightInput}
        assumedGmdInput={inputs.assumedGmdInput}
        setAssumedGmdInput={setters.setAssumedGmdInput}
        pricePerArrobaInput={inputs.pricePerArrobaInput}
        setPricePerArrobaInput={setters.setPricePerArrobaInput}
        arrobaBasis={inputs.arrobaBasis}
        setArrobaBasis={setters.setArrobaBasis}
        carcassYieldInput={inputs.carcassYieldInput}
        setCarcassYieldInput={setters.setCarcassYieldInput}
        sellNowCarcassWeightInput={inputs.sellNowCarcassWeightInput}
        setSellNowCarcassWeightInput={setters.setSellNowCarcassWeightInput}
        targetCarcassWeightInput={inputs.targetCarcassWeightInput}
        setTargetCarcassWeightInput={setters.setTargetCarcassWeightInput}
        dailyCostInput={inputs.dailyCostInput}
        setDailyCostInput={setters.setDailyCostInput}
        additionalCostInput={inputs.additionalCostInput}
        setAdditionalCostInput={setters.setAdditionalCostInput}
      />

      {simulation.status === "BLOCKED" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Simulação Bloqueada</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2 text-xs">
              {simulation.blockReasons?.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <SimulationActiveContent
        simulation={simulation}
        observedWeightKg={observedWeightKg}
      />

      <LimitationsBlock limitations={simulation.limitations} />
    </div>
  );
}
