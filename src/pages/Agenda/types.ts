import type { AgendaScheduleBucket } from "@/lib/agenda/groupOrdering";
import type {
  SanitaryBaseCalendarAnchor,
  SanitaryBaseCalendarMode,
} from "@/lib/sanitario/calendar";

export type GroupMode = "animal" | "evento";

export type AnimalQuickFilter =
  | "all"
  | "with-animal"
  | "without-animal"
  | "F"
  | "M"
  | "unknown";

export type AgendaCalendarModeQuickFilter = "all" | SanitaryBaseCalendarMode;

export type AgendaCalendarAnchorQuickFilter = "all" | SanitaryBaseCalendarAnchor;

export type QuickFilterTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export type AgendaScheduleQuickFilter = AgendaScheduleBucket | "all";
