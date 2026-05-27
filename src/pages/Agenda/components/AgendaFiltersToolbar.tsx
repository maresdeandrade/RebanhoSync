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
  AgendaOperationalClassQuickFilter,
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
  quickOperationalClassFilter: AgendaOperationalClassQuickFilter;
  onQuickOperationalClassFilterChange: (value: AgendaOperationalClassQuickFilter) => void;
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
  quickOperationalClassFilter,
  onQuickOperationalClassFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  groupMode,
  onGroupModeChange,
  onClearFilters,
}: AgendaFiltersToolbarProps) {
  return (
    <div className="space-y-3">
      <Toolbar className="bg-muted/20 shadow-none border-none p-0">
        <ToolbarGroup className="flex-1 gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 bg-background"
              placeholder="Buscar por tipo, animal ou lote"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
          <Select value={groupMode} onValueChange={(value) => onGroupModeChange(value as GroupMode)}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="animal">Agrupar por animal</SelectItem>
              <SelectItem value="evento">Agrupar por evento</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground hover:text-foreground">
            Limpar
          </Button>
        </ToolbarGroup>
      </Toolbar>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={(value) => onStatusFilterChange(value as AgendaStatusFilter)}
        >
          <SelectTrigger className="h-8 w-fit min-w-[140px] border-none bg-muted/50 hover:bg-muted text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="agendado">Agendado</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dominioFilter} onValueChange={onDominioFilterChange}>
          <SelectTrigger className="h-8 w-fit min-w-[140px] border-none bg-muted/50 hover:bg-muted text-xs">
            <SelectValue placeholder="Domínio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os domínios</SelectItem>
            <SelectItem value="sanitario">Sanitário</SelectItem>
            <SelectItem value="pesagem">Pesagem</SelectItem>
            <SelectItem value="movimentacao">Movimentação</SelectItem>
            <SelectItem value="nutricao">Nutrição</SelectItem>
            <SelectItem value="financeiro">Financeiro</SelectItem>
            <SelectItem value="reproducao">Reprodução</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={quickCalendarModeFilter}
          onValueChange={(value) =>
            onQuickCalendarModeFilterChange(value as AgendaCalendarModeQuickFilter)
          }
        >
          <SelectTrigger className="h-8 w-fit min-w-[140px] border-none bg-muted/50 hover:bg-muted text-xs">
            <SelectValue placeholder="Calendário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os calendários</SelectItem>
            <SelectItem value="campanha">Campanha</SelectItem>
            <SelectItem value="janela_etaria">Janela etária</SelectItem>
            <SelectItem value="rotina_recorrente">Recorrente</SelectItem>
            <SelectItem value="procedimento_imediato">Uso imediato</SelectItem>
            <SelectItem value="nao_estruturado">Não estruturado</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1">
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="h-6 w-[120px] border-none bg-transparent p-0 text-xs focus-visible:ring-0"
            aria-label="Data inicial"
          />
          <span className="text-[10px] text-muted-foreground">até</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className="h-6 w-[120px] border-none bg-transparent p-0 text-xs focus-visible:ring-0"
            aria-label="Data final"
          />
        </div>
      </div>
    </div>
  );
}

