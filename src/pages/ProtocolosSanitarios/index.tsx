import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpenCheck, CalendarClock, History, ShieldCheck } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { SanitaryLocalAgendaPanelV2 } from "@/components/sanitario/SanitaryLocalAgendaPanelV2";
import { SanitaryCompliancePanelV2 } from "@/components/sanitario/SanitaryCompliancePanelV2";
import { SanitaryProtocolWindowPanelV2 } from "@/components/sanitario/SanitaryProtocolWindowPanelV2";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageIntro } from "@/components/ui/page-intro";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import {
  cancelLocalSanitaryAgendaV2,
  listLocalSanitaryAgendasV2,
  rescheduleLocalSanitaryAgendaV2,
} from "@/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2";
import {
  executeSanitaryAgendaV2,
  type ExecuteSanitaryAgendaInputV2,
} from "@/lib/sanitario/execution/sanitaryAgendaExecutionV2";
import {
  createGroupedManualSanitaryAgendasV2,
  listSanitaryDocumentaryPendenciesV2,
  loadSanitaryProtocolWindowSourceV2,
  type SanitaryOperationalContextV2,
  type SanitaryProtocolWindowRowV2,
} from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";

type CentralSanitaryTab = "janelas" | "agenda" | "historico" | "catalogo" | "conformidade";
type HistoryRecordFilter = "todos" | "executed_event" | "external_documented" | "declaration" | "documentary_pendency";

function readCentralSanitaryTab(value: string | null): CentralSanitaryTab {
  return value === "agenda" || value === "historico" || value === "catalogo" || value === "conformidade"
    ? value
    : "janelas";
}

const ProtocolosSanitarios = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeFarmId, user } = useAuth();
  const initialTab = readCentralSanitaryTab(searchParams.get("tab"));
  const initialAnimalId = searchParams.get("animalId");
  const initialLotId = searchParams.get("loteId");
  const initialLotContextId = initialAnimalId ? initialLotId : null;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [historyFilters, setHistoryFilters] = useState({
    text: "",
    animal: "",
    lote: "",
    protocol: "",
    item: "",
    product: "",
    origin: "",
    startDate: "",
    endDate: "",
    recordType: "todos" as HistoryRecordFilter,
  });
  const localAgenda = useLiveQuery(
    () => (activeFarmId ? listLocalSanitaryAgendasV2(activeFarmId) : []),
    [activeFarmId],
  );
  const windowSource = useLiveQuery(
    () => (activeFarmId ? loadSanitaryProtocolWindowSourceV2(activeFarmId) : undefined),
    [activeFarmId],
  );
  const documentaryPendencies = listSanitaryDocumentaryPendenciesV2({
    source: windowSource,
    evaluatedAt: new Date().toISOString().slice(0, 10),
  });
  const executedEvents = (windowSource?.executedEvents ?? []).filter((event) => {
    if (historyFilters.recordType !== "todos" && historyFilters.recordType !== "executed_event") return false;
    if (historyFilters.startDate && event.executedAt.slice(0, 10) < historyFilters.startDate) return false;
    if (historyFilters.endDate && event.executedAt.slice(0, 10) > historyFilters.endDate) return false;
    const fields = [
      event.protocolLabel,
      event.itemLabel,
      event.animalLabel,
      event.lotLabel,
      event.productLabel,
      event.originLabel,
    ];
    const text = historyFilters.text.trim().toLocaleLowerCase("pt-BR");
    if (text && !fields.join(" ").toLocaleLowerCase("pt-BR").includes(text)) return false;
    if (historyFilters.animal && !event.animalLabel.toLocaleLowerCase("pt-BR").includes(historyFilters.animal.toLocaleLowerCase("pt-BR"))) return false;
    if (historyFilters.lote && !event.lotLabel.toLocaleLowerCase("pt-BR").includes(historyFilters.lote.toLocaleLowerCase("pt-BR"))) return false;
    if (historyFilters.protocol && !event.protocolLabel.toLocaleLowerCase("pt-BR").includes(historyFilters.protocol.toLocaleLowerCase("pt-BR"))) return false;
    if (historyFilters.item && !event.itemLabel.toLocaleLowerCase("pt-BR").includes(historyFilters.item.toLocaleLowerCase("pt-BR"))) return false;
    if (historyFilters.product && !event.productLabel.toLocaleLowerCase("pt-BR").includes(historyFilters.product.toLocaleLowerCase("pt-BR"))) return false;
    if (historyFilters.origin && !event.originLabel.toLocaleLowerCase("pt-BR").includes(historyFilters.origin.toLocaleLowerCase("pt-BR"))) return false;
    return true;
  });
  const filteredPendencies = documentaryPendencies.filter((pendency) => {
    if (historyFilters.recordType !== "todos" && historyFilters.recordType !== "documentary_pendency") return false;
    const text = historyFilters.text.trim().toLocaleLowerCase("pt-BR");
    if (!text) return true;
    return [
      pendency.protocolLabel,
      pendency.itemLabel,
      pendency.animalLabel,
      pendency.lotLabel,
      pendency.reasons.join(" "),
    ]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(text);
  });

  const clearInitialFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("animalId");
    next.delete("loteId");
    setSearchParams(next, { replace: true });
  };

  if (!activeFarmId) {
    return (
      <div className="container mx-auto space-y-5 pb-10">
        <EmptyState
          icon={ShieldCheck}
          title="Fazenda não selecionada"
          action={{ label: "Selecionar fazenda", onClick: () => navigate("/select-fazenda") }}
        />
      </div>
    );
  }

  const reschedule = async (agendaId: string, plannedFor: string) => {
    try {
      await rescheduleLocalSanitaryAgendaV2({ agendaId, fazendaId: activeFarmId, plannedFor });
      toast.success("Agenda sanitária reagendada.");
    } catch {
      toast.error("Não foi possível reagendar esta agenda.");
    }
  };

  const cancel = async (agendaId: string) => {
    try {
      await cancelLocalSanitaryAgendaV2({ agendaId, fazendaId: activeFarmId });
      toast.success("Agenda sanitária cancelada.");
    } catch {
      toast.error("Não foi possível cancelar esta agenda.");
    }
  };

  const planSelected = async (
    rows: SanitaryProtocolWindowRowV2[],
    plannedFor: string,
    operationalContext: SanitaryOperationalContextV2,
  ) => {
    try {
      const results = await createGroupedManualSanitaryAgendasV2({
        rows,
        fazendaId: activeFarmId,
        plannedFor,
        operationalContext,
      });
      toast.success(
        results.length === 1
          ? "Agenda sanitária criada."
          : `${results.length} agendas sanitárias agrupadas foram criadas.`,
      );
    } catch {
      toast.error("Não foi possível planejar as agendas selecionadas.");
    }
  };

  const executeAgenda = async (payloads: Array<Omit<ExecuteSanitaryAgendaInputV2, "fazendaId">>) => {
    try {
      const results = [];
      for (const payload of payloads) {
        results.push(
          await executeSanitaryAgendaV2({
            ...payload,
            fazendaId: activeFarmId,
          }),
        );
      }
      const stockMovements = results.filter((result) => result.createsStockMovement).length;
      toast.success(
        results.length === 1
          ? stockMovements > 0
            ? "Evento sanitário registrado com baixa de estoque."
            : "Evento sanitário registrado."
          : `${results.length} eventos sanitários registrados.`,
      );
    } catch {
      toast.error("Não foi possível executar esta agenda sanitária.");
    }
  };

  return (
    <div className="container mx-auto space-y-5 pb-10">
      <PageIntro
        eyebrow="Sanitário"
        title="Central Sanitária"
        description="Acompanhe planejamentos sanitários locais e consulte as fontes separadas de catálogo e histórico executado."
        meta={<><StatusBadge tone="info">Local e offline</StatusBadge><StatusBadge tone="neutral">Execução explícita</StatusBadge></>}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="janelas"><CalendarClock className="mr-2 h-4 w-4" />Janelas sanitárias</TabsTrigger>
          <TabsTrigger value="agenda"><CalendarClock className="mr-2 h-4 w-4" />Agenda sanitária</TabsTrigger>
          <TabsTrigger value="historico"><History className="mr-2 h-4 w-4" />Histórico sanitário</TabsTrigger>
          <TabsTrigger value="catalogo"><BookOpenCheck className="mr-2 h-4 w-4" />Catálogo sanitário</TabsTrigger>
          <TabsTrigger value="conformidade"><ShieldCheck className="mr-2 h-4 w-4" />Conformidade</TabsTrigger>
        </TabsList>

        <TabsContent value="janelas">
          <SanitaryProtocolWindowPanelV2
            source={windowSource}
            initialAnimalId={initialAnimalId}
            initialLotId={initialLotId}
            initialLotContextId={initialLotContextId}
            onClearInitialFilter={clearInitialFilter}
            onPlan={planSelected}
          />
        </TabsContent>

        <TabsContent value="agenda">
          <SanitaryLocalAgendaPanelV2
            items={localAgenda}
            defaultResponsibleName={user?.email ?? user?.id ?? null}
            onReschedule={reschedule}
            onCancel={cancel}
            onExecute={executeAgenda}
          />
        </TabsContent>

        <TabsContent value="conformidade">
          <SanitaryCompliancePanelV2
            source={windowSource}
            initialAnimalId={initialAnimalId}
            initialLotId={initialLotId}
          />
        </TabsContent>

        <TabsContent value="catalogo">
          <Card>
            <CardHeader><CardTitle>Catálogo sanitário v2</CardTitle><CardDescription>Consulta local de protocolos, itens e grupos técnicos. Catálogo é regra e não comprova execução.</CardDescription></CardHeader>
            <CardContent><Button onClick={() => navigate("/protocolos-sanitarios/catalogo-v2")}>Abrir catálogo sanitário</Button></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Filtros do histórico sanitário</CardTitle>
                <CardDescription>Filtros locais sobre eventos executados e registros documentais. Agenda futura não entra como histórico.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <Input aria-label="Texto" placeholder="Texto" value={historyFilters.text} onChange={(event) => setHistoryFilters((current) => ({ ...current, text: event.target.value }))} />
                <Input aria-label="Animal" placeholder="Animal" value={historyFilters.animal} onChange={(event) => setHistoryFilters((current) => ({ ...current, animal: event.target.value }))} />
                <Input aria-label="Lote" placeholder="Lote" value={historyFilters.lote} onChange={(event) => setHistoryFilters((current) => ({ ...current, lote: event.target.value }))} />
                <Input aria-label="Protocolo" placeholder="Protocolo" value={historyFilters.protocol} onChange={(event) => setHistoryFilters((current) => ({ ...current, protocol: event.target.value }))} />
                <Input aria-label="Item" placeholder="Item" value={historyFilters.item} onChange={(event) => setHistoryFilters((current) => ({ ...current, item: event.target.value }))} />
                <Input aria-label="Produto" placeholder="Produto" value={historyFilters.product} onChange={(event) => setHistoryFilters((current) => ({ ...current, product: event.target.value }))} />
                <Input aria-label="Origem" placeholder="Origem" value={historyFilters.origin} onChange={(event) => setHistoryFilters((current) => ({ ...current, origin: event.target.value }))} />
                <Select value={historyFilters.recordType} onValueChange={(recordType: HistoryRecordFilter) => setHistoryFilters((current) => ({ ...current, recordType }))}>
                  <SelectTrigger aria-label="Tipo de registro"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="executed_event">Eventos executados</SelectItem>
                    <SelectItem value="external_documented">Histórico externo documentado</SelectItem>
                    <SelectItem value="declaration">Declarações</SelectItem>
                    <SelectItem value="documentary_pendency">Pendências documentais</SelectItem>
                  </SelectContent>
                </Select>
                <Input aria-label="Data inicial" type="date" value={historyFilters.startDate} onChange={(event) => setHistoryFilters((current) => ({ ...current, startDate: event.target.value }))} />
                <Input aria-label="Data final" type="date" value={historyFilters.endDate} onChange={(event) => setHistoryFilters((current) => ({ ...current, endDate: event.target.value }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Eventos executados</CardTitle><CardDescription>Fatos sanitários criados por execução confirmada. Agendas abertas, fechadas ou canceladas não são prova de execução.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {executedEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum evento sanitário executado encontrado nos filtros locais.</p>
                ) : (
                  executedEvents.map((event) => (
                    <div key={event.eventId} className="rounded-lg border border-border/70 bg-background p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">{event.protocolLabel} · {event.itemLabel}</p>
                          <p className="text-sm text-muted-foreground">{new Date(event.executedAt).toLocaleDateString("pt-BR")} · {event.animalLabel} · {event.lotLabel}</p>
                          <p className="text-sm text-muted-foreground">{event.productLabel} · {event.doseLabel} · {event.routeLabel}</p>
                          <p className="text-sm text-muted-foreground">{event.responsibleLabel} · {event.originLabel} · estoque {event.stockLabel} · carência {event.withdrawalLabel}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => navigate("/eventos")}>Abrir eventos</Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Histórico externo documentado</CardTitle><CardDescription>Registros anteriores com evidência documental. Não movimentam estoque.</CardDescription></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Nenhum histórico externo documentado listado nesta visão.</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Declarações</CardTitle><CardDescription>Declarações sanitárias sem documento comprobatório completo.</CardDescription></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Nenhuma declaração sanitária listada nesta visão.</p></CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pendências documentais</CardTitle>
                <CardDescription>Comprovações necessárias antes de tratar histórico externo como evidência suficiente. Não cria agenda automática.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredPendencies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma pendência documental sanitária encontrada nos filtros locais.</p>
                ) : (
                  filteredPendencies.map((pendency) => (
                    <div key={`${pendency.animalId}:${pendency.protocolLabel}:${pendency.itemLabel}`} className="rounded-lg border border-border/70 bg-background p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">{pendency.protocolLabel} · {pendency.itemLabel}</p>
                          <p className="text-sm text-muted-foreground">{pendency.lotLabel}</p>
                          <p className="mt-1 text-sm text-amber-700">{pendency.reasons[0]}</p>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <Link to={pendency.animalHref}>Abrir animal</Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProtocolosSanitarios;
