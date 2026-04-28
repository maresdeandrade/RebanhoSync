import type { AgendaScheduleBucket } from "@/lib/agenda/groupOrdering";
import type {
  AgendaSummaryBadge,
  AgendaAnimalGroupSummary,
  AgendaEventGroupSummary,
} from "@/lib/agenda/groupSummaries";
import type { SanitaryAgendaPriority } from "@/lib/sanitario/engine/protocolRules";
import type {
  AgendaItem,
  Animal,
  Lote,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import type { SyncStage } from "@/lib/offline/syncPresentation";
import type {
  SanitaryBaseCalendarAnchor,
  SanitaryBaseCalendarMode,
} from "@/lib/sanitario/engine/calendar";

export type GroupMode = "animal" | "evento";

export type AnimalQuickFilter =
  | "all"
  | "with-animal"
  | "without-animal"
  | "F"
  | "M"
  | "unknown";

export type AgendaCalendarModeQuickFilter = "all" | SanitaryBaseCalendarMode;

export type AgendaCalendarAnchorQuickFilter =
  | "all"
  | SanitaryBaseCalendarAnchor;

export type QuickFilterTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export type AgendaScheduleQuickFilter = AgendaScheduleBucket | "all";

export type AgendaStatusFilter = "all" | "agendado" | "concluido" | "cancelado";

export type AgendaContextualFocus = {
  token: number;
  groupKey: string;
  rowId: string;
  rowIds: string[];
};

export type AgendaRow = {
  item: AgendaItem;
  animal: Animal | null;
  lote: Lote | null;
  animalNome: string;
  loteNome: string;
  idadeLabel: string;
  syncStage: SyncStage;
  produtoLabel: string;
  scheduleLabel: string | null;
  scheduleMode: SanitaryBaseCalendarMode | null;
  scheduleModeLabel: string | null;
  scheduleAnchor: SanitaryBaseCalendarAnchor | null;
  scheduleAnchorLabel: string | null;
  protocol: ProtocoloSanitario | null;
  protocolItem: ProtocoloSanitarioItem | null;
  priority: SanitaryAgendaPriority | null;
};

export type AgendaAnimalGroup = {
  key: string;
  title: string;
  rows: AgendaRow[];
  visibleRows: AgendaRow[];
  animal: Animal | null;
  summary: AgendaAnimalGroupSummary;
  sortMeta: {
    hasOverdue: boolean;
    hasToday: boolean;
    pendingCount: number;
    firstPendingDate: string | null;
    firstDate: string | null;
    severityRank: number;
  };
};

export type AgendaEventGroup = {
  key: string;
  title: string;
  subtitle: string;
  rows: AgendaRow[];
  visibleRows: AgendaRow[];
  earliestDate: string;
  summary: AgendaEventGroupSummary;
  sortMeta: {
    hasOverdue: boolean;
    hasToday: boolean;
    pendingCount: number;
    firstPendingDate: string | null;
    firstDate: string | null;
    severityRank: number;
  };
};
