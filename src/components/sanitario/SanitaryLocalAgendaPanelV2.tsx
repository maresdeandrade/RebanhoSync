import { useMemo, useState } from "react";
import { CalendarClock, ExternalLink, Search, ShieldX } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const statusLabels = {
  programada: "Programada",
  fechada: "Fechada",
  cancelada: "Cancelada",
  dispensada: "Dispensada",
} as const;

const initialFilters: SanitaryLocalAgendaFiltersV2 = {
  search: "",
  status: "todas",
  startDate: "",
  endDate: "",
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "Data não informada";
}

type Props = {
  items: SanitaryLocalAgendaListItemV2[] | undefined;
  onReschedule: (agendaId: string, plannedFor: string) => Promise<void>;
  onCancel: (agendaId: string) => Promise<void>;
};

export function SanitaryLocalAgendaPanelV2({ items, onReschedule, onCancel }: Props) {
  const [filters, setFilters] = useState(initialFilters);
  const [selected, setSelected] = useState<SanitaryLocalAgendaListItemV2 | null>(null);
  const [plannedFor, setPlannedFor] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const filteredItems = useMemo(
    () => filterLocalSanitaryAgendasV2(items ?? [], filters),
    [filters, items],
  );

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
              <SelectItem value="programada">Programadas</SelectItem>
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
          {filteredItems.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{item.itemLabel}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{item.protocolLabel}</p>
                  </div>
                  <Badge variant={item.status === "programada" ? "default" : "secondary"}>{statusLabels[item.status]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">Data planejada</dt><dd className="font-medium">{formatDate(item.plannedFor)}</dd></div>
                  <div>
                    <dt className="text-muted-foreground">Origem</dt>
                    <dd className="font-medium">
                      {item.target.href ? <Link className="inline-flex items-center gap-1 text-primary hover:underline" to={item.target.href}>{item.target.label}<ExternalLink className="h-3.5 w-3.5" /></Link> : item.target.label}
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={!item.canManage || busyAction !== null} onClick={() => openReschedule(item)}>Reagendar</Button>
                  <Button type="button" variant="outline" disabled={!item.canManage || busyAction !== null} onClick={() => cancelAgenda(item)}>Cancelar agenda</Button>
                  <Button type="button" disabled title="A agenda não registra execução"><ShieldX className="h-4 w-4" />Execução indisponível</Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
    </div>
  );
}
