import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import type {
  AgendaCalendarAnchorQuickFilter,
  AgendaCalendarModeQuickFilter,
  AgendaStatusFilter,
  GroupMode,
} from "@/pages/Agenda/types";

type AgendaFiltersToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: AgendaStatusFilter;
  onStatusFilterChange: (value: AgendaStatusFilter) => void;
  dominioFilter: string;
  onDominioFilterChange: (value: string) => void;
  quickCalendarModeFilter: AgendaCalendarModeQuickFilter;
  onQuickCalendarModeFilterChange: (value: AgendaCalendarModeQuickFilter) => void;
  quickCalendarAnchorFilter: AgendaCalendarAnchorQuickFilter;
  onQuickCalendarAnchorFilterChange: (value: AgendaCalendarAnchorQuickFilter) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  groupMode: GroupMode;
  onGroupModeChange: (value: GroupMode) => void;
  onClearFilters: () => void;
};

export function AgendaFiltersToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  dominioFilter,
  onDominioFilterChange,
  quickCalendarModeFilter,
  onQuickCalendarModeFilterChange,
  quickCalendarAnchorFilter,
  onQuickCalendarAnchorFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  groupMode,
  onGroupModeChange,
  onClearFilters,
}: AgendaFiltersToolbarProps) {
  return (
    <Toolbar>
      <ToolbarGroup className="flex-1 gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por tipo, animal ou lote"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) => onStatusFilterChange(value as AgendaStatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="agendado">Agendado</SelectItem>
            <SelectItem value="concluido">Concluido</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dominioFilter} onValueChange={onDominioFilterChange}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os dominios</SelectItem>
            <SelectItem value="sanitario">Sanitario</SelectItem>
            <SelectItem value="pesagem">Pesagem</SelectItem>
            <SelectItem value="movimentacao">Movimentacao</SelectItem>
            <SelectItem value="nutricao">Nutricao</SelectItem>
            <SelectItem value="financeiro">Financeiro</SelectItem>
            <SelectItem value="reproducao">Reproducao</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={quickCalendarModeFilter}
          onValueChange={(value) =>
            onQuickCalendarModeFilterChange(value as AgendaCalendarModeQuickFilter)
          }
        >
          <SelectTrigger className="w-full sm:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os calendarios</SelectItem>
            <SelectItem value="campaign">Campanha</SelectItem>
            <SelectItem value="age_window">Janela etaria</SelectItem>
            <SelectItem value="rolling_interval">Recorrente</SelectItem>
            <SelectItem value="immediate">Uso imediato</SelectItem>
            <SelectItem value="clinical_protocol">Protocolo clinico</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={quickCalendarAnchorFilter}
          onValueChange={(value) =>
            onQuickCalendarAnchorFilterChange(value as AgendaCalendarAnchorQuickFilter)
          }
        >
          <SelectTrigger className="w-full sm:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ancoras</SelectItem>
            <SelectItem value="calendar_month">Calendario</SelectItem>
            <SelectItem value="birth">Nascimento</SelectItem>
            <SelectItem value="weaning">Desmama</SelectItem>
            <SelectItem value="pre_breeding_season">Pre-estacao</SelectItem>
            <SelectItem value="clinical_need">Necessidade clinica</SelectItem>
            <SelectItem value="dry_off">Secagem</SelectItem>
          </SelectContent>
        </Select>
      </ToolbarGroup>

      <ToolbarGroup className="gap-2">
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
          className="w-full sm:w-[160px]"
          aria-label="Data inicial"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
          className="w-full sm:w-[160px]"
          aria-label="Data final"
        />
        <Select value={groupMode} onValueChange={(value) => onGroupModeChange(value as GroupMode)}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="animal">Agrupar por animal</SelectItem>
            <SelectItem value="evento">Agrupar por evento</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Limpar filtros
        </Button>
      </ToolbarGroup>
    </Toolbar>
  );
}
