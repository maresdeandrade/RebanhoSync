import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type { SanitaryAgendaDiagnostic } from "@/lib/sanitario/operations/agendaDiagnostics";

type SanitaryAgendaDiagnosticsPanelProps = {
  diagnostics: SanitaryAgendaDiagnostic[];
  pendingSanitaryCount: number;
  onOpenProtocols?: () => void;
};

export function SanitaryAgendaDiagnosticsPanel({
  diagnostics,
  pendingSanitaryCount,
  onOpenProtocols,
}: SanitaryAgendaDiagnosticsPanelProps) {
  const hasPendingAgenda = pendingSanitaryCount > 0;
  const topDiagnostics = diagnostics.slice(0, 5);

  return (
    <section className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {hasPendingAgenda ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <HelpCircle className="h-5 w-5 text-warning-foreground" />
            )}
            <h2 className="text-base font-semibold text-foreground">
              Diagnóstico da agenda sanitária
            </h2>
            <StatusBadge tone={hasPendingAgenda ? "success" : "warning"}>
              {hasPendingAgenda
                ? `${pendingSanitaryCount} pendência(s)`
                : "Sem pendências sanitárias"}
            </StatusBadge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {hasPendingAgenda
              ? "A agenda sanitária tem itens materializados. Use os cartões para revisar protocolo, produto e próximo passo."
              : "Quando a agenda sanitária está vazia, estes motivos ajudam a localizar configuração, elegibilidade ou janela operacional."}
          </p>
        </div>

        {onOpenProtocols ? (
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={onOpenProtocols}
          >
            Abrir protocolos
          </button>
        ) : null}
      </div>

      {topDiagnostics.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {topDiagnostics.map((diagnostic) => (
            <div
              key={diagnostic.code}
              className="rounded-lg border border-border/70 bg-background/80 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <StatusBadge tone={diagnostic.tone}>
                  {diagnostic.count}x
                </StatusBadge>
                <span className="text-sm font-semibold text-foreground">
                  {diagnostic.title}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {diagnostic.action}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
          Nenhum bloqueio provável detectado nos protocolos locais.
        </p>
      )}
    </section>
  );
}
