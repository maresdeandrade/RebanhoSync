import { StatusBadge } from "@/components/ui/status-badge";

type GuardLike = {
  key: string;
  label: string;
  tone: "neutral" | "info" | "warning" | "danger";
  message?: string;
};

export function RegistrarSanitaryMovementBlockSection(input: {
  blockedAnimals: Array<{
    animal: { id: string; identificacao: string };
    alert: { diseaseName: string | null };
  }>;
}) {
  if (input.blockedAnimals.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-rose-200/70 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Bloqueio sanitario de movimentacao</p>
        <p className="text-xs text-muted-foreground">
          Animais com suspeita sanitaria aberta nao podem seguir para movimentacao
          externa ou venda ate o encerramento do alerta.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {input.blockedAnimals.map(({ animal, alert }) => (
          <StatusBadge key={animal.id} tone="danger">
            {animal.identificacao}: {alert.diseaseName ?? "suspeita aberta"}
          </StatusBadge>
        ))}
      </div>
    </div>
  );
}

export function RegistrarComplianceBlockSection(input: {
  title: string;
  description: string;
  blockers: GuardLike[];
  warnings: GuardLike[];
}) {
  if (input.blockers.length === 0 && input.warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{input.title}</p>
        <p className="text-xs text-muted-foreground">{input.description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {input.blockers.map((guard) => (
          <StatusBadge key={guard.key} tone={guard.tone}>
            {guard.label}
          </StatusBadge>
        ))}
        {input.warnings.map((guard) => (
          <StatusBadge key={guard.key} tone={guard.tone}>
            {guard.label}
          </StatusBadge>
        ))}
      </div>
      {input.blockers.length > 0 ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {input.blockers[0]?.message}
        </div>
      ) : null}
      {input.blockers.length === 0 && input.warnings.length > 0 ? (
        <div className="rounded-lg border border-warning/20 bg-warning-muted/60 p-3 text-sm text-warning">
          {input.warnings[0]?.message}
        </div>
      ) : null}
    </div>
  );
}
