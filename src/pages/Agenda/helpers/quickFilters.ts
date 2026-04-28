import type { AgendaScheduleBucket } from "@/lib/agenda/groupOrdering";
import { describeSanitaryCalendarAnchor, describeSanitaryCalendarMode } from "@/lib/sanitario/engine/calendar";
import type { AgendaItem, Animal } from "@/lib/offline/types";
import type {
  AgendaCalendarAnchorQuickFilter,
  AgendaCalendarModeQuickFilter,
  AnimalQuickFilter,
  QuickFilterTone,
} from "@/pages/Agenda/types";

export function getScheduleQuickFilterLabel(value: AgendaScheduleBucket) {
  if (value === "overdue") return "Atrasado";
  if (value === "today") return "Hoje";
  if (value === "future") return "Futuro";
  return "Fechado";
}

export function getAnimalQuickFilterLabel(value: AnimalQuickFilter) {
  if (value === "with-animal") return "Com animal";
  if (value === "without-animal") return "Sem animal";
  if (value === "F") return "Fêmeas";
  if (value === "M") return "Machos";
  if (value === "unknown") return "Sexo n/d";
  return "Todos";
}

export function getCalendarModeQuickFilterLabel(
  value: AgendaCalendarModeQuickFilter,
) {
  if (value === "all") return "Todos";
  return describeSanitaryCalendarMode(value);
}

export function getCalendarAnchorQuickFilterLabel(
  value: AgendaCalendarAnchorQuickFilter,
) {
  if (value === "all") return "Todas";
  return describeSanitaryCalendarAnchor(value) ?? "Sem âncora";
}

export function parseCalendarModeQuickFilter(
  value: string | null,
): AgendaCalendarModeQuickFilter | null {
  if (value === null) return null;
  if (
    value === "all" ||
    value === "campanha" ||
    value === "janela_etaria" ||
    value === "rotina_recorrente" ||
    value === "procedimento_imediato" ||
    value === "nao_estruturado"
  ) {
    return value;
  }
  return null;
}

export function parseCalendarAnchorQuickFilter(
  value: string | null,
): AgendaCalendarAnchorQuickFilter | null {
  if (value === null) return null;
  if (
    value === "all" ||
    value === "sem_ancora" ||
    value === "nascimento" ||
    value === "desmama" ||
    value === "parto_previsto" ||
    value === "entrada_fazenda" ||
    value === "movimentacao" ||
    value === "diagnostico_evento" ||
    value === "conclusao_etapa_dependente" ||
    value === "ultima_conclusao_mesma_familia"
  ) {
    return value;
  }
  return null;
}

export function parseAgendaDominioFilter(value: string | null): string | null {
  if (value === null) return null;
  if (
    value === "all" ||
    value === "sanitario" ||
    value === "pesagem" ||
    value === "movimentacao" ||
    value === "nutricao" ||
    value === "financeiro" ||
    value === "reproducao"
  ) {
    return value;
  }
  return null;
}

export function matchesAnimalQuickFilter(
  item: Pick<AgendaItem, "animal_id">,
  animal: Pick<Animal, "sexo"> | null,
  filter: AnimalQuickFilter,
) {
  if (filter === "all") return true;
  if (filter === "with-animal") return Boolean(item.animal_id);
  if (filter === "without-animal") return !item.animal_id;
  if (filter === "unknown") return Boolean(item.animal_id) && !animal?.sexo;
  return animal?.sexo === filter;
}

export function mapAnimalBadgeToQuickFilter(
  key: string,
): AnimalQuickFilter | null {
  if (key === "animals") return "with-animal";
  if (key === "female") return "F";
  if (key === "male") return "M";
  if (key === "unknown") return "unknown";
  if (key === "without-animal") return "without-animal";
  return null;
}

export function mapScheduleBadgeToQuickFilter(
  key: string,
): AgendaScheduleBucket | null {
  if (key === "overdue") return "overdue";
  if (key === "today") return "today";
  if (key === "future") return "future";
  return null;
}

export function getQuickFilterBadgeToneClass(tone: QuickFilterTone) {
  if (tone === "info") return "border-info/15 bg-info-muted text-info";
  if (tone === "success") return "border-success/15 bg-success-muted text-success";
  if (tone === "warning") return "border-warning/20 bg-warning-muted text-warning";
  if (tone === "danger") return "border-destructive/15 bg-destructive/10 text-destructive";
  return "border-border/80 bg-background/75 text-muted-foreground";
}
