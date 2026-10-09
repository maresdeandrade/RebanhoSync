import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FarmWeightUnit } from "@/lib/farms/measurementConfig";
import {
  formatWeight,
  formatWeightPerDay,
  formatWeightValue,
} from "@/lib/format/weight";
import type {
  AnimalWeightPresentation,
  buildAnimalWeightHistory,
} from "@/lib/insights/animalWeightPresentation";
import type { GmdNotCalculatedReason } from "@/lib/insights/gmdCalculation";
import { AnimalWeightVariationBadge } from "./AnimalWeightVariationBadge";

type AnimalWeightSectionProps = {
  presentation: AnimalWeightPresentation | null | undefined;
  history: ReturnType<typeof buildAnimalWeightHistory>;
  weightUnit: FarmWeightUnit;
  onRegister: () => void;
};

const GMD_UNAVAILABLE_LABELS: Record<GmdNotCalculatedReason, string> = {
  INSUFFICIENT_OBSERVATIONS:
    "São necessárias duas observações factuais elegíveis.",
  CONFLICT: "Há conflito entre registros de pesagem.",
  INVALID_INTERVAL: "O intervalo entre as observações é inválido.",
  INVALID_NUMERIC_INPUT: "Os valores não permitem calcular o GMD.",
  UNSUPPORTED: "Animal indisponível na fonte factual.",
};

function formatObservedDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatDurationValue(value: number, unit: string) {
  const rounded = Math.round(value * 100) / 100;
  const approximate = Math.abs(rounded - value) > 1e-9;
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
  return `${approximate ? "aproximadamente " : ""}${formatted} ${unit}${rounded === 1 ? "" : "s"}`;
}

function formatGmdInterval(intervalDays: number) {
  if (intervalDays >= 1) return formatDurationValue(intervalDays, "dia");

  const seconds = intervalDays * 86_400;
  if (seconds < 1) return "menos de 1 segundo";
  if (seconds >= 3_600) return formatDurationValue(seconds / 3_600, "hora");
  if (seconds >= 60) return formatDurationValue(seconds / 60, "minuto");
  return formatDurationValue(seconds, "segundo");
}

function GmdDetails({
  gmd,
  weightUnit,
}: {
  gmd: AnimalWeightPresentation["gmd"] | undefined;
  weightUnit: FarmWeightUnit;
}) {
  if (!gmd)
    return (
      <p className="text-sm text-muted-foreground">
        GMD indisponível: sem dados factuais disponíveis.
      </p>
    );
  if (gmd.status === "NOT_CALCULATED") {
    return (
      <>
        <p className="text-sm font-medium">GMD indisponível</p>
        <p className="text-xs text-muted-foreground">
          {GMD_UNAVAILABLE_LABELS[gmd.reason]}
        </p>
        {gmd.source.status === "INSUFFICIENT_OBSERVATIONS" ? (
          <p className="text-xs text-muted-foreground">
            Observações elegíveis: {gmd.source.observedCount} de{" "}
            {gmd.source.requiredCount}.
          </p>
        ) : null}
      </>
    );
  }
  return (
    <>
      <p className="text-xl font-semibold">
        {formatWeightPerDay(gmd.gmdKgPerDay, weightUnit)}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatObservedDate(gmd.initialMeasuredAt)} a{" "}
        {formatObservedDate(gmd.finalMeasuredAt)}
      </p>
      <p className="text-xs text-muted-foreground">
        Intervalo: {formatGmdInterval(gmd.intervalDays)}
      </p>
    </>
  );
}

function LatestWeightDetails({
  latest,
  weightUnit,
}: {
  latest: AnimalWeightPresentation["latestObservedWeight"] | undefined;
  weightUnit: FarmWeightUnit;
}) {
  if (latest?.status !== "available")
    return (
      <p className="text-sm text-muted-foreground">
        {latest?.status === "conflict"
          ? "Peso indisponível: conflito factual."
          : "Sem pesagem factual disponível."}
      </p>
    );
  return (
    <>
      <p className="text-xl font-semibold">
        {formatWeight(latest.value.weight, weightUnit)}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatObservedDate(latest.value.measuredAt)}
      </p>
    </>
  );
}

export function AnimalWeightSection({
  presentation,
  history,
  weightUnit,
  onRegister,
}: AnimalWeightSectionProps) {
  const latest = presentation?.latestObservedWeight;
  const gmd = presentation?.gmd;
  const calculated = gmd?.status === "CALCULATED" ? gmd : null;
  const hasConflict =
    gmd?.status === "NOT_CALCULATED" && gmd.reason === "CONFLICT";

  return (
    <Card
      aria-label="Peso e GMD"
      className="min-w-0 border-border/70 shadow-none"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Peso e GMD</CardTitle>
          <Button variant="outline" size="sm" onClick={onRegister}>
            Registrar pesagem
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {presentation === undefined ? (
          <p role="status" className="text-sm text-muted-foreground">
            Carregando pesagens…
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="min-w-0 space-y-1 rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Último peso registrado
              </p>
              <LatestWeightDetails latest={latest} weightUnit={weightUnit} />
            </div>
            <div className="min-w-0 space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Variação no período do GMD
              </p>
              {calculated ? (
                <AnimalWeightVariationBadge
                  variationKg={calculated.weightDeltaKg}
                  weightUnit={weightUnit}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Variação indisponível.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Entre as duas últimas observações elegíveis.
              </p>
            </div>
            <div className="min-w-0 space-y-1 rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                GMD observado
              </p>
              <GmdDetails gmd={gmd} weightUnit={weightUnit} />
            </div>
          </div>
        )}
        <p className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
          Confiabilidade não classificada. O último peso e o GMD não
          representam, por si só, peso atual confiável. Uso operacional não
          autorizado: o cálculo não autoriza decisões operacionais.
        </p>
        {history.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Histórico factual · {history.length} pesagem(ns)
            </p>
            <div
              aria-label="Gráfico do histórico factual de peso"
              className="h-64 min-w-0 w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} accessibilityLayer>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="dataLabel"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={32}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={60}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12,
                    }}
                    tickFormatter={(value) =>
                      formatWeightValue(value, weightUnit)
                    }
                  />
                  <Tooltip
                    itemStyle={{ color: "hsl(var(--card-foreground))" }}
                    formatter={(value: number) => [
                      formatWeight(value, weightUnit),
                      "Peso",
                    ]}
                    labelFormatter={(label) => `Data: ${label}`}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                  <Line
                    type="monotone"
                    isAnimationActive={false}
                    dataKey="pesoKg"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : presentation !== undefined ? (
          <p className="text-sm text-muted-foreground">
            {hasConflict
              ? "Histórico indisponível: conflito entre registros de pesagem."
              : "Sem histórico de pesagem para acompanhar a evolução deste animal."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
