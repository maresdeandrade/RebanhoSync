import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BodyConditionEvaluation = {
  ecc: number;
  occurred_at: string;
  escala_min: number;
  escala_max: number;
  escala_passo: number;
  observacoes?: string | null;
};

type BodyConditionHistoryEntry = {
  id: string;
  dataLabel: string;
  ecc: number;
  escalaMin: number;
  escalaMax: number;
  escalaPasso: number;
  observacoes?: string | null;
};

type AnimalBodyConditionSectionProps = {
  latest: BodyConditionEvaluation | null | undefined;
  history: BodyConditionHistoryEntry[] | undefined;
  onRegister: () => void;
};

function formatScale(min: number, max: number, step: number) {
  return `Escala: ${min} a ${max} (passo ${step})`;
}

export function AnimalBodyConditionSection({
  latest,
  history,
  onRegister,
}: AnimalBodyConditionSectionProps) {
  return (
    <Card
      aria-label="Escore de Condição Corporal"
      className="min-w-0 border-border/70 shadow-none"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
            Escore de Condição Corporal (ECC)
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onRegister}>
            Registrar ECC
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {latest === undefined ? (
          <p role="status" className="text-sm text-muted-foreground">
            Carregando avaliações ECC…
          </p>
        ) : latest ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Último ECC factual
                </p>
                <p className="text-3xl font-semibold text-foreground">
                  {latest.ecc.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatScale(
                    latest.escala_min,
                    latest.escala_max,
                    latest.escala_passo,
                  )}
                </p>
              </div>
              <div className="min-w-0 space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Data da avaliação
                </p>
                <p className="text-xl font-semibold">
                  {new Date(latest.occurred_at).toLocaleDateString("pt-BR")}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                  {latest.observacoes
                    ? `Observações: ${latest.observacoes}`
                    : "Sem observações"}
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sem ECC factual registrado
          </p>
        )}
        {history === undefined ? (
          <p role="status" className="text-sm text-muted-foreground">
            Carregando histórico ECC…
          </p>
        ) : history.length > 0 ? (
          <details className="rounded-xl border border-border/70">
            <summary className="cursor-pointer rounded-xl p-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              Histórico de avaliações ({history.length})
            </summary>
            <div className="divide-y divide-border/70 border-t border-border/70">
              {history.map((item) => (
                <div key={item.id} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium">{item.dataLabel}</p>
                    <p className="text-sm font-semibold">
                      ECC {item.ecc.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatScale(
                      item.escalaMin,
                      item.escalaMax,
                      item.escalaPasso,
                    )}
                  </p>
                  {item.observacoes ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                      {item.observacoes}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
