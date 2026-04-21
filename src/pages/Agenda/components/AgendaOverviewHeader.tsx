import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";

type HeaderBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

type HeaderBadge = {
  key: string;
  label: string;
  tone: HeaderBadgeTone;
};

type AgendaOverviewHeaderProps = {
  badges: HeaderBadge[];
  onGoToRegistrar: () => void;
};

export function AgendaOverviewHeader({ badges, onGoToRegistrar }: AgendaOverviewHeaderProps) {
  return (
    <PageIntro
      eyebrow="Rotina planejada"
      title="Agenda de manejo"
      description="Itens manuais e automáticos vinculados ao fluxo de eventos, com leitura clara do próximo passo e do estado de sync."
      meta={
        <>
          {badges.map((badge) => (
            <StatusBadge key={badge.key} tone={badge.tone}>
              {badge.label}
            </StatusBadge>
          ))}
        </>
      }
      actions={
        <Button size="sm" onClick={onGoToRegistrar}>
          <Plus className="h-4 w-4" />
          Registrar
        </Button>
      }
    />
  );
}
