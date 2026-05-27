import { Calendar } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

interface AgendaEmptyStateProps {
  hasItems: boolean;
  hasComplianceAttention: boolean;
  onOpenProtocols: () => void;
  onGoToRegistrar: () => void;
}

export function AgendaEmptyState({
  hasItems,
  hasComplianceAttention,
  onOpenProtocols,
  onGoToRegistrar,
}: AgendaEmptyStateProps) {
  if (hasItems) return null;

  return (
    <EmptyState
      icon={Calendar}
      title="Agenda vazia"
      description={
        hasComplianceAttention
          ? "Ha pendencias de conformidade fora da agenda."
          : "Registre eventos ou ative protocolos para alimentar a rotina."
      }
      action={{
        label: hasComplianceAttention ? "Abrir protocolos" : "Registrar",
        onClick: hasComplianceAttention ? onOpenProtocols : onGoToRegistrar,
      }}
    />
  );
}
