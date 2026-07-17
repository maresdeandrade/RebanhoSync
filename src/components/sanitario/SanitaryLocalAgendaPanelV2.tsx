import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Play,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  filterLocalSanitaryAgendasV2,
  type SanitaryLocalAgendaFiltersV2,
  type SanitaryLocalAgendaListItemV2,
} from "@/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2";
import type { ExecuteSanitaryAgendaInputV2 } from "@/lib/sanitario/execution/sanitaryAgendaExecutionV2";
import {
  SanitaryAgendaExecutionConfirmV2,
  type SanitaryExecutionInventoryLotOptionV2,
  type SanitaryExecutionProductOptionV2,
} from "./SanitaryAgendaExecutionConfirmV2";

const statusLabels = {
  programada: "Planejada",
  executada: "Executada",
  fechada: "Fechada",
  cancelada: "Cancelada",
  dispensada: "Dispensada",
} as const;

const incompatibleSelectionMessage =
  "As agendas selecionadas possuem diferenças de protocolo, item, produto exigido ou status. Execute separadamente ou ajuste a seleção.";

const initialFilters: SanitaryLocalAgendaFiltersV2 = {
  search: "",
  status: "todas",
  startDate: "",
  endDate: "",
};

type ExecutionPayload = Omit<ExecuteSanitaryAgendaInputV2, "fazendaId">;

type Props = {
  items: SanitaryLocalAgendaListItemV2[] | undefined;
  defaultResponsibleName?: string | null;
  executionProductOptions?: SanitaryExecutionProductOptionV2[];
  executionInventoryLotOptions?: SanitaryExecutionInventoryLotOptionV2[];
  onReschedule: (agendaId: string, plannedFor: string) => Promise<void>;
  onCancel: (agendaId: string) => Promise<void>;
  onExecute: (payloads: ExecutionPayload[]) => Promise<void>;
};

type AgendaGroupV2 = {
  key: string;
  title: string;
  subtitle: string;
  plannedFor: string;
  status: SanitaryLocalAgendaListItemV2["status"];
  items: SanitaryLocalAgendaListItemV2[];
  compatible: boolean;
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "Data não informada";
}

function compatibilityKey(item: SanitaryLocalAgendaListItemV2) {
  return [
    item.protocolId ?? item.protocolLabel,
    item.itemKey ?? item.itemLabel,
    item.productRequirementKind,
    item.productClass ?? "",
    item.productClassGroupId ?? "",
    item.status,
  ].join("|");
}

function groupLocalSanitaryAgendasV2(items: SanitaryLocalAgendaListItemV2[]) {
  const groups = new Map<string, AgendaGroupV2>();
  for (const item of items) {
    const key = [
      item.protocolLabel,
      item.itemLabel,
      item.plannedFor,
      item.status,
      item.productRequirementKind,
      item.productClass ?? "",
      item.productClassGroupId ?? "",
    ].join("|");
    const current = groups.get(key);
    if (current) {
      current.items.push(item);
      continue;
    }
    groups.set(key, {
      key,
      title: item.itemLabel,
      subtitle: item.protocolLabel,
      plannedFor: item.plannedFor,
      status: item.status,
      items: [item],
      compatible: false,
    });
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    compatible:
      group.items.every((entry) => entry.canExecute) &&
      new Set(group.items.map(compatibilityKey)).size === 1,
  }));
}

function selectedCompatibilityMessage(items: SanitaryLocalAgendaListItemV2[]) {
  if (items.length === 0) return null;
  if (items.some((item) => !item.canExecute)) return incompatibleSelectionMessage;
  if (new Set(items.map(compatibilityKey)).size > 1) {
    return incompatibleSelectionMessage;
  }
  return null;
}

export function SanitaryLocalAgendaPanelV2({
  items,
  defaultResponsibleName,
  executionProductOptions,
  executionInventoryLotOptions,
  onReschedule,
  onCancel,
  onExecute,
}: Props) {
  const [filters, setFilters] = useState(initialFilters);
  const [selected, setSelected] = useState<SanitaryLocalAgendaListItemV2 | null>(null);
  const [executionTargets, setExecutionTargets] = useState<SanitaryLocalAgendaListItemV2[]>([]);
  const [selectedAgendaIds, setSelectedAgendaIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [plannedFor, setPlannedFor] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const filteredItems = useMemo(
    () => filterLocalSanitaryAgendasV2(items ?? [], filters),
    [filters, items],
  );
  const groups = useMemo(() => groupLocalSanitaryAgendasV2(filteredItems), [filteredItems]);
  const selectedItems = filteredItems.filter((item) => selectedAgendaIds.has(item.id));
  const batchBlockMessage = selectedCompatibilityMessage(selectedItems);

  const openReschedule = (item: SanitaryLocalAgendaListItemV2) => {
    setSelected(item);
    setPlannedFor(item.plannedFor);
  };

  const confirmReschedule = async () => {
    if (!selected || !plannedFor) return;
    setBusyAction(`reschedule:${selected.id}`);
    try {
      await onReschedule(selected.id, plannedFor);
      setSelected(null);
    } finally {
      setBusyAction(null);
    }
  };

  const cancelAgenda = async (item: SanitaryLocalAgendaListItemV2) => {
    setBusyAction(`cancel:${item.id}`);
    try {
      await onCancel(item.id);
    } finally {
      setBusyAction(null);
    }
  };

  const executeAgenda = async (payloads: ExecutionPayload[]) => {
    setBusyAction("execute:batch");
    try {
      await onExecute(payloads);
      setExecutionTargets([]);
      setSelectedAgendaIds(new Set());
    } finally {
      setBusyAction(null);
    }
  };

  const toggleItemSelection = (item: SanitaryLocalAgendaListItemV2, checked: boolean) => {
    setSelectedAgendaIds((current) => {
      const next = new Set(current);
      if (checked) next.add(item.id);
      else next.delete(item.id);
      return next;
    });
  };

  const toggleGroupSelection = (group: AgendaGroupV2, checked: boolean) => {
    setSelectedAgendaIds((current) => {
      const next = new Set(current);
      for (const item of group.items) {
        if (!item.canExecute) continue;
        if (checked) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  };

  const toggleGroupExpanded = (groupKey: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  if (items === undefined) {
    return <p className="text-sm text-muted-foreground">Carregando agenda sanitária local...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Agenda é planejamento futuro. Reagendar ou cancelar não registra execução, não movimenta estoque e não calcula carência.
      </div>

      <section className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-4" aria-label="Filtros da agenda sanitária">
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Buscar protocolo, item, animal ou lote</span>
          <span className="relative block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Buscar agenda sanitária"
              className="pl-9"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Status</span>
          <Select
            value={filters.status}
            onValueChange={(status: SanitaryLocalAgendaFiltersV2["status"]) =>
              setFilters((current) => ({ ...current, status }))
            }
          >
            <SelectTrigger aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos</SelectItem>
              <SelectItem value="programada">Planejadas</SelectItem>
              <SelectItem value="executada">Executadas</SelectItem>
              <SelectItem value="fechada">Fechadas</SelectItem>
              <SelectItem value="cancelada">Canceladas</SelectItem>
              <SelectItem value="dispensada">Dispensadas</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">De</span>
            <Input aria-label="Data inicial" type="date" value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Até</span>
            <Input aria-label="Data final" type="date" value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} />
          </label>
        </div>
      </section>

      {filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <CalendarClock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="font-medium">Nenhuma agenda sanitária encontrada</p>
          <p className="text-sm text-muted-foreground">Ajuste os filtros ou crie um planejamento pelo contexto do animal ou lote.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
            <span className="text-muted-foreground">
              {selectedItems.length} agenda(s) selecionada(s)
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={selectedItems.length === 0 || Boolean(batchBlockMessage) || busyAction !== null}
                onClick={() => setExecutionTargets(selectedItems)}
              >
                <Play className="h-4 w-4" />
                Executar selecionadas
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={selectedAgendaIds.size === 0}
                onClick={() => setSelectedAgendaIds(new Set())}
              >
                Limpar seleção
              </Button>
            </div>
            {batchBlockMessage ? (
              <p className="basis-full text-sm text-amber-700">{batchBlockMessage}</p>
            ) : null}
          </div>

          {groups.map((group) => {
            const expanded = expandedGroups.has(group.key);
            const executableItems = group.items.filter((item) => item.canExecute);
            const selectedCount = group.items.filter((item) => selectedAgendaIds.has(item.id)).length;
            const groupFullySelected =
              executableItems.length > 0 &&
              executableItems.every((item) => selectedAgendaIds.has(item.id));
            const targetsLabel = Array.from(new Set(group.items.map((item) => item.target.label))).join(", ");

            return (
              <Card key={group.key}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        aria-label={`Selecionar grupo ${group.title}`}
                        checked={groupFullySelected}
                        disabled={!group.compatible || busyAction !== null}
                        onCheckedChange={(checked) => toggleGroupSelection(group, checked === true)}
                      />
                      <div>
                        <CardTitle className="text-base">{group.title}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{group.subtitle}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {group.items.length} agenda(s) · {group.items.reduce((sum, entry) => sum + entry.animalCount, 0)} animal(is) · {targetsLabel}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={group.status === "programada" ? "default" : "secondary"}>{statusLabels[group.status]}</Badge>
                      <Button type="button" variant="ghost" size="sm" onClick={() => toggleGroupExpanded(group.key)}>
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {expanded ? "Ocultar agendas" : "Ver agendas"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-muted-foreground">Data planejada</dt><dd className="font-medium">{formatDate(group.plannedFor)}</dd></div>
                    <div><dt className="text-muted-foreground">Seleção</dt><dd className="font-medium">{selectedCount} de {group.items.length}</dd></div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    {group.compatible ? (
                      <Button type="button" disabled={busyAction !== null} onClick={() => setExecutionTargets(group.items)}>
                        <Play className="h-4 w-4" />
                        Executar grupo
                      </Button>
                    ) : null}
                  </div>
                  {expanded ? (
                    <div className="md:col-span-2">
                      <div className="divide-y rounded-lg border border-border">
                        {group.items.map((item) => (
                          <div key={item.id} className="grid gap-3 p-3 text-sm md:grid-cols-[auto_1fr_auto] md:items-center">
                            <Checkbox
                              aria-label={`Selecionar agenda ${item.target.label}`}
                              checked={selectedAgendaIds.has(item.id)}
                              disabled={!item.canExecute || busyAction !== null}
                              onCheckedChange={(checked) => toggleItemSelection(item, checked === true)}
                            />
                            <div>
                              <div className="font-medium">
                                {item.target.href ? (
                                  <Link className="inline-flex items-center gap-1 text-primary hover:underline" to={item.target.href}>{item.target.label}<ExternalLink className="h-3.5 w-3.5" /></Link>
                                ) : item.target.label}
                              </div>
                              <div className="text-muted-foreground">{formatDate(item.plannedFor)} · {item.animalCount} animal(is)</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" variant="outline" disabled={!item.canManage || busyAction !== null} onClick={() => openReschedule(item)}>Reagendar</Button>
                              <Button type="button" variant="outline" disabled={!item.canManage || busyAction !== null} onClick={() => cancelAgenda(item)}>Cancelar agenda</Button>
                              {item.canExecute ? (
                                <Button type="button" disabled={busyAction !== null} onClick={() => setExecutionTargets([item])}>
                                  Executar
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                      {!group.compatible ? (
                        <p className="mt-2 text-xs text-amber-700">
                          As agendas deste grupo não estão elegíveis para execução em lote.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar agenda sanitária</DialogTitle>
            <DialogDescription>Altere somente a data planejada desta intenção futura.</DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm">
            <span className="font-medium">Nova data planejada</span>
            <Input aria-label="Nova data planejada" type="date" value={plannedFor} onChange={(event) => setPlannedFor(event.target.value)} />
          </label>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setSelected(null)}>Voltar</Button><Button type="button" disabled={!plannedFor || busyAction !== null} onClick={confirmReschedule}>Salvar nova data</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <SanitaryAgendaExecutionConfirmV2
        items={executionTargets}
        open={executionTargets.length > 0}
        defaultResponsibleName={defaultResponsibleName}
        productOptions={executionProductOptions}
        inventoryLotOptions={executionInventoryLotOptions}
        onOpenChange={(open) => !open && setExecutionTargets([])}
        onConfirm={executeAgenda}
      />
    </div>
  );
}
