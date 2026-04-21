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
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dominioFilter} onValueChange={onDominioFilterChange}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue />
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
          <SelectTrigger className="w-full sm:w-[190px]">
            <SelectValue />
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
            <SelectItem value="all">Todas as âncoras</SelectItem>
            <SelectItem value="sem_ancora">Sem âncora</SelectItem>
            <SelectItem value="nascimento">Nascimento</SelectItem>
            <SelectItem value="desmama">Desmama</SelectItem>
            <SelectItem value="parto_previsto">Parto previsto</SelectItem>
            <SelectItem value="entrada_fazenda">Entrada na fazenda</SelectItem>
            <SelectItem value="movimentacao">Movimentação</SelectItem>
            <SelectItem value="diagnostico_evento">Diagnóstico de evento</SelectItem>
            <SelectItem value="conclusao_etapa_dependente">Conclusão de etapa anterior</SelectItem>
            <SelectItem value="ultima_conclusao_mesma_familia">Última conclusão da mesma família</SelectItem>
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
