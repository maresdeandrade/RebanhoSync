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
          ? "Não há tarefas locais de agenda. Existem pendências de conformidade para revisar separadamente."
          : "Não há tarefas locais de agenda nesta fazenda. Isso não significa ausência de eventos executados."
      }
      action={{
        label: hasComplianceAttention ? "Abrir protocolos" : "Registrar execução",
        onClick: hasComplianceAttention ? onOpenProtocols : onGoToRegistrar,
      }}
    />
  );
}
