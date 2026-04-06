import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  MoreHorizontal,
  Plus,
  Search,
  XCircle,
} from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { useAuth } from "@/hooks/useAuth";
import { getAnimalBreedLabel } from "@/lib/animals/catalogs";
import {
  getAnimalLifeStageLabel,
  getPendingAnimalLifecycleKindLabel,
  getPendingAnimalLifecycleTransitions,
  summarizePendingAnimalLifecycleTransitions,
} from "@/lib/animals/lifecycle";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { pullDataForFarm } from "@/lib/offline/pull";
import type { AgendaItem, Animal, Lote, SanitarioTipoEnum } from "@/lib/offline/types";
import { isCalfJourneyAgendaItem } from "@/lib/reproduction/calfJourney";
import { concluirPendenciaSanitaria } from "@/lib/sanitario/service";
import { showError, showSuccess } from "@/utils/toast";

const DOMAIN_LABEL: Record<string, string> = {
  sanitario: "Sanitario",
  pesagem: "Pesagem",
  movimentacao: "Movimentacao",
  nutricao: "Nutricao",
  financeiro: "Financeiro",
  reproducao: "Reproducao",
};

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  concluido: "Concluido",
  cancelado: "Cancelado",
};

type GroupMode = "animal" | "evento";

type AgendaRow = {
  item: AgendaItem;
  animal: Animal | null;
  lote: Lote | null;
  animalNome: string;
  loteNome: string;
  idadeLabel: string;
  syncStatus: string;
  produtoLabel: string;
};

function getAgendaStatusTone(status: string) {
  if (status === "cancelado") return "danger";
  if (status === "concluido") return "success";
  return "warning";
}

function getSyncTone(status: string) {
  if (status === "ERROR" || status === "REJECTED") return "danger";
  if (status === "PENDING" || status === "SYNCING") return "warning";
  return "neutral";
}

function normalizeSyncStatus(status?: string) {
  if (!status || status === "DONE" || status === "SYNCED") return "SYNCED";
  return status;
}

function readString(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asSanitarioTipo(value: string | null): SanitarioTipoEnum | null {
  if (value === "vacinacao" || value === "vermifugacao" || value === "medicamento") {
    return value;
  }
  return null;
}

function formatAnimalAge(dataNascimento: string | null) {
  if (!dataNascimento) return "idade n/d";

  const birth = new Date(`${dataNascimento}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "idade n/d";

  const diffMs = Date.now() - birth.getTime();
  if (diffMs < 0) return "idade n/d";

  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (totalDays < 30) return `${totalDays}d`;

  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);

  if (years > 0) return months > 0 ? `${years}a ${months}m` : `${years}a`;
  return `${Math.floor(totalDays / 30)}m`;
}

function formatAgendaDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

export default function Agenda() {
  const navigate = useNavigate();
  const { activeFarmId, farmLifecycleConfig } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "agendado" | "concluido" | "cancelado"
  >("all");
  const [dominioFilter, setDominioFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("animal");

  useEffect(() => {
    if (!activeFarmId) return;

    pullDataForFarm(activeFarmId, ["agenda_itens", "animais", "lotes"], {
      mode: "merge",
    }).catch((error) => {
      console.warn("[agenda] failed to refresh agenda_itens", error);
    });
  }, [activeFarmId]);

  const data = useLiveQuery(
    async () => {
      if (!activeFarmId) {
        return { itens: [], animais: [], lotes: [], gestos: [] };
      }

      const [itens, animais, lotes, gestos] = await Promise.all([
        db.state_agenda_itens.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
        db.queue_gestures.where("fazenda_id").equals(activeFarmId).toArray(),
      ]);

      return {
        itens: itens.filter((item) => !item.deleted_at),
        animais: animais.filter((animal) => !animal.deleted_at),
        lotes: lotes.filter((lote) => !lote.deleted_at),
        gestos,
      };
    },
    [activeFarmId],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const animalById = new Map(data.animais.map((animal) => [animal.id, animal]));
    const loteById = new Map(data.lotes.map((lote) => [lote.id, lote]));
    const gestoByTx = new Map(data.gestos.map((gesture) => [gesture.client_tx_id, gesture.status]));
    const searchLower = search.trim().toLowerCase();

    return data.itens
      .map((item) => {
        const animal = item.animal_id ? animalById.get(item.animal_id) : null;
        const lote = item.lote_id ? loteById.get(item.lote_id) : null;
        const syncStatus = normalizeSyncStatus(
          item.client_tx_id ? gestoByTx.get(item.client_tx_id) : "SYNCED",
        );

        const dateMatch =
          (!dateFrom || item.data_prevista >= dateFrom) &&
          (!dateTo || item.data_prevista <= dateTo);
        const statusMatch = statusFilter === "all" || item.status === statusFilter;
        const dominioMatch = dominioFilter === "all" || item.dominio === dominioFilter;

        const textIndex = [
          item.tipo,
          item.dominio,
          animal?.identificacao ?? "",
          lote?.nome ?? "",
        ]
          .join(" ")
          .toLowerCase();
        const searchMatch = !searchLower || textIndex.includes(searchLower);

        if (!dateMatch || !statusMatch || !dominioMatch || !searchMatch) return null;

        return {
          item,
          animal,
          lote,
          animalNome: animal?.identificacao ?? "Sem animal",
          loteNome: lote?.nome ?? "Sem lote",
          syncStatus,
        };
      })
      .filter(Boolean)
      .sort((left, right) => left!.item.data_prevista.localeCompare(right!.item.data_prevista))
      .map((row) => {
        const typed = row as NonNullable<typeof row>;
        const produtoLabel =
          readString(typed.item.source_ref, "produto") ??
          readString(typed.item.payload, "produto") ??
          typed.item.tipo.replaceAll("_", " ");

        return {
          ...typed,
          idadeLabel: formatAnimalAge(typed.animal?.data_nascimento ?? null),
          produtoLabel,
        };
      }) as AgendaRow[];
  }, [data, search, statusFilter, dominioFilter, dateFrom, dateTo]);

  const lifecycleQueue = useMemo(() => {
    if (!data) return [];

    return getPendingAnimalLifecycleTransitions(
      data.animais.filter((animal) => animal.status === "ativo"),
      farmLifecycleConfig,
    ).map((item) => {
      const animal = data.animais.find((entry) => entry.id === item.animalId) ?? null;
      const lote =
        animal?.lote_id
          ? data.lotes.find((entry) => entry.id === animal.lote_id) ?? null
          : null;

      return {
        ...item,
        loteNome: lote?.nome ?? "Sem lote",
      };
    });
  }, [data, farmLifecycleConfig]);

  const lifecycleSummary = useMemo(
    () => summarizePendingAnimalLifecycleTransitions(lifecycleQueue),
    [lifecycleQueue],
  );

  const groupedByAnimal = useMemo(() => {
    const byAnimal = new Map<
      string,
      {
        key: string;
        title: string;
        rows: AgendaRow[];
        animal: Animal | null;
      }
    >();

    for (const row of filtered) {
      const key = row.item.animal_id ?? `sem-animal:${row.item.id}`;
      const animalIdShort = row.item.animal_id ? row.item.animal_id.slice(0, 8) : null;
      const title = row.animal?.identificacao ?? (animalIdShort ? `Animal ${animalIdShort}` : "Sem animal");

      const current = byAnimal.get(key);
      if (current) {
        current.rows.push(row);
      } else {
        byAnimal.set(key, {
          key,
          title,
          rows: [row],
          animal: row.animal,
        });
      }
    }

    return Array.from(byAnimal.values())
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((left, right) =>
          left.item.data_prevista.localeCompare(right.item.data_prevista),
        ),
      }))
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [filtered]);

  const groupedByEvent = useMemo(() => {
    const byEvent = new Map<
      string,
      {
        key: string;
        title: string;
        subtitle: string;
        rows: AgendaRow[];
        earliestDate: string;
      }
    >();

    for (const row of filtered) {
      const key = row.item.protocol_item_version_id
        ? `protocol:${row.item.protocol_item_version_id}`
        : `tipo:${row.item.tipo}:produto:${row.produtoLabel}`;
      const protocoloLabel = row.item.protocol_item_version_id
        ? `Protocolo ${row.item.protocol_item_version_id.slice(0, 8)}`
        : `Tipo ${row.item.tipo.replaceAll("_", " ")}`;

      const current = byEvent.get(key);
      if (current) {
        current.rows.push(row);
        if (row.item.data_prevista < current.earliestDate) {
          current.earliestDate = row.item.data_prevista;
        }
      } else {
        byEvent.set(key, {
          key,
          title: row.produtoLabel,
          subtitle: protocoloLabel,
          rows: [row],
          earliestDate: row.item.data_prevista,
        });
      }
    }

    return Array.from(byEvent.values())
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((left, right) =>
          left.item.data_prevista.localeCompare(right.item.data_prevista),
        ),
      }))
      .sort((left, right) => left.earliestDate.localeCompare(right.earliestDate));
  }, [filtered]);

  const counts = useMemo(() => {
    let agendado = 0;
    let concluido = 0;
    let cancelado = 0;
    for (const row of filtered) {
      if (row.item.status === "agendado") agendado++;
      if (row.item.status === "concluido") concluido++;
      if (row.item.status === "cancelado") cancelado++;
    }
    return { agendado, concluido, cancelado };
  }, [filtered]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    dominioFilter !== "all" ||
    dateFrom.length > 0 ||
    dateTo.length > 0 ||
    groupMode !== "animal";

  const updateStatus = async (item: AgendaItem, status: "concluido" | "cancelado") => {
    if (!activeFarmId) {
      showError("Fazenda ativa nao encontrada.");
      return;
    }

    const sourceTipo = asSanitarioTipo(readString(item.source_ref, "tipo"));
    const sourceProduto =
      readString(item.source_ref, "produto") ??
      readString(item.payload, "produto") ??
      null;

    if (item.dominio === "sanitario" && status === "concluido") {
      try {
        const eventoId = await concluirPendenciaSanitaria({
          agendaItemId: item.id,
          occurredAt: new Date().toISOString(),
          tipo: sourceTipo ?? undefined,
          produto: sourceProduto ?? undefined,
          payload: {
            origem: "agenda_concluir",
          },
        });

        await pullDataForFarm(
          activeFarmId,
          ["agenda_itens", "eventos", "eventos_sanitario"],
          { mode: "merge" },
        );

        showSuccess(`Evento sanitario criado: ${eventoId.slice(0, 8)}`);
        return;
      } catch (error) {
        console.error("[agenda] failed to conclude sanitary item with event", error);
        showError("Falha ao concluir pendencia sanitaria com evento.");
        return;
      }
    }

    try {
      await createGesture(activeFarmId, [
        {
          table: "agenda_itens",
          action: "UPDATE",
          record: {
            id: item.id,
            status,
            source_evento_id: item.source_evento_id ?? null,
          },
        },
      ]);
      showSuccess(`Item ${status === "concluido" ? "concluido" : "cancelado"} com sucesso.`);
    } catch {
      showError("Falha ao atualizar item da agenda.");
    }
  };

  const goToRegistrar = (item: AgendaItem) => {
    if (item.animal_id && isCalfJourneyAgendaItem(item)) {
      const params = new URLSearchParams();
      params.set("agendaItemId", item.id);
      if (item.source_evento_id) {
        params.set("eventoId", item.source_evento_id);
      }
      navigate(`/animais/${item.animal_id}/cria-inicial?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams();
    params.set("sourceTaskId", item.id);
    params.set("dominio", item.dominio);
    if (item.animal_id) params.set("animalId", item.animal_id);
    if (item.lote_id) params.set("loteId", item.lote_id);

    const protocoloId = readString(item.source_ref, "protocolo_id");
    const protocoloItemId =
      readString(item.source_ref, "protocolo_item_id") ?? item.protocol_item_version_id;
    const produto =
      readString(item.source_ref, "produto") ?? readString(item.payload, "produto");
    const sanitarioTipo = asSanitarioTipo(readString(item.source_ref, "tipo"));

    if (protocoloId) params.set("protocoloId", protocoloId);
    if (protocoloItemId) params.set("protocoloItemId", protocoloItemId);
    if (produto) params.set("produto", produto);
    if (sanitarioTipo) params.set("sanitarioTipo", sanitarioTipo);

    navigate(`/registrar?${params.toString()}`);
  };

  const renderRow = (row: AgendaRow) => {
    const periodicidade =
      row.item.interval_days_applied && row.item.interval_days_applied > 0
        ? `${row.item.interval_days_applied} dias`
        : "Dose unica";
    const indicacao =
      readString(row.item.source_ref, "indicacao") ??
      (readNumber(row.item.source_ref, "dose_num")
        ? `Dose ${readNumber(row.item.source_ref, "dose_num")}`
        : "Aplicacao conforme protocolo");

    return (
      <article
        key={row.item.id}
        className="rounded-2xl border border-border/70 bg-muted/30 p-4"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium capitalize">
                {row.item.tipo.replaceAll("_", " ")}
              </p>
              <StatusBadge tone="neutral">
                {DOMAIN_LABEL[row.item.dominio] ?? row.item.dominio}
              </StatusBadge>
              <StatusBadge tone={getAgendaStatusTone(row.item.status)}>
                {STATUS_LABEL[row.item.status] ?? row.item.status}
              </StatusBadge>
              <StatusBadge tone={getSyncTone(row.syncStatus)}>
                {row.syncStatus}
              </StatusBadge>
            </div>

            <p className="text-sm leading-6 text-muted-foreground">
              {formatAgendaDate(row.item.data_prevista)} | {row.animalNome} ({row.idadeLabel}) | {row.loteNome}
            </p>

            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p className="text-muted-foreground">
                Produto: <span className="font-medium text-foreground">{row.produtoLabel}</span>
              </p>
              <p className="text-muted-foreground">
                Periodicidade: <span className="font-medium text-foreground">{periodicidade}</span>
              </p>
              <p className="text-muted-foreground">
                Indicacao: <span className="font-medium text-foreground">{indicacao}</span>
              </p>
              <p className="text-muted-foreground">
                Origem: <span className="font-medium text-foreground">{row.item.source_kind}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {row.item.source_evento_id ? (
                <span>Evento {row.item.source_evento_id.slice(0, 8)}</span>
              ) : null}
              {row.item.protocol_item_version_id ? (
                <span>Protocolo {row.item.protocol_item_version_id.slice(0, 8)}</span>
              ) : null}
              {row.item.dedup_key ? (
                <span>Dedup {row.item.dedup_key.slice(0, 12)}</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {row.item.status === "agendado" ? (
              <Button size="sm" onClick={() => goToRegistrar(row.item)}>
                {isCalfJourneyAgendaItem(row.item)
                  ? "Abrir rotina da cria"
                  : "Registrar evento"}
              </Button>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={`Mais acoes para o item ${row.item.id}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {row.item.status === "agendado" && !isCalfJourneyAgendaItem(row.item) ? (
                  <DropdownMenuItem onClick={() => updateStatus(row.item, "concluido")}>
                    Concluir
                  </DropdownMenuItem>
                ) : null}
                {row.item.status === "agendado" ? (
                  <DropdownMenuItem onClick={() => updateStatus(row.item, "cancelado")}>
                    Cancelar
                  </DropdownMenuItem>
                ) : null}
                {row.item.source_evento_id ? (
                  <DropdownMenuItem
                    onClick={() => navigate(`/eventos?eventoId=${row.item.source_evento_id}`)}
                  >
                    Ver evento
                  </DropdownMenuItem>
                ) : null}
                {row.item.animal_id ? (
                  <DropdownMenuItem onClick={() => navigate(`/animais/${row.item.animal_id}`)}>
                    Abrir ficha do animal
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </article>
    );
  };

  if (!data || data.itens.length === 0) {
    return (
      <div className="space-y-5">
        <PageIntro
          eyebrow="Rotina planejada"
          title="Agenda de manejo"
          description="Itens manuais e automaticos que sustentam a rotina do dia, sempre vinculados ao fluxo real de eventos."
          actions={
            <Button size="sm" onClick={() => navigate("/registrar")}>
              <Plus className="h-4 w-4" />
              Registrar
            </Button>
          }
        />

        <EmptyState
          icon={Calendar}
          title="Agenda vazia"
          description="A agenda ainda nao tem tarefas abertas. Registre eventos ou ative protocolos para alimentar a rotina."
          action={{
            label: "Registrar atividade",
            onClick: () => navigate("/registrar"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Rotina planejada"
        title="Agenda de manejo"
        description="Itens manuais e automaticos vinculados ao fluxo de eventos, com leitura clara do proximo passo e do estado de sync."
        meta={
          <>
            <StatusBadge tone="neutral">{filtered.length} item(ns) no recorte</StatusBadge>
            {hasActiveFilters ? <StatusBadge tone="info">Filtros ativos</StatusBadge> : null}
            {lifecycleSummary.total > 0 ? (
              <StatusBadge tone="warning">
                {lifecycleSummary.total} transicao(oes) no radar
              </StatusBadge>
            ) : null}
          </>
        }
        actions={
          <Button size="sm" onClick={() => navigate("/registrar")}>
            <Plus className="h-4 w-4" />
            Registrar
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Agendados"
          value={counts.agendado}
          hint="Itens que ainda pedem acao."
          tone={counts.agendado > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Concluidos"
          value={counts.concluido}
          hint="Ja resolvidos no recorte atual."
          tone="success"
        />
        <MetricCard
          label="Cancelados"
          value={counts.cancelado}
          hint="Itens encerrados sem execucao."
          tone={counts.cancelado > 0 ? "danger" : "default"}
        />
      </section>

      {lifecycleSummary.total > 0 ? (
        <Card className="border-warning/20 bg-warning-muted/70 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Transicoes de estagio no radar
            </CardTitle>
            <CardDescription>
              {lifecycleSummary.total} pendencia(s), com {lifecycleSummary.strategic} estrategica(s) e {lifecycleSummary.biological} biologica(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lifecycleQueue.slice(0, 4).map((item) => (
              <div
                key={item.animalId}
                className="rounded-2xl border border-border/70 bg-background/90 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.identificacao}</p>
                      <StatusBadge
                        tone={
                          item.queueKind === "decisao_estrategica" ? "warning" : "info"
                        }
                      >
                        {getPendingAnimalLifecycleKindLabel(item.queueKind)}
                      </StatusBadge>
                      <StatusBadge tone={item.canAutoApply ? "info" : "warning"}>
                        {item.canAutoApply ? "Auto/hibrido" : "Manual"}
                      </StatusBadge>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {getAnimalLifeStageLabel(item.currentStage)} para{" "}
                      {getAnimalLifeStageLabel(item.targetStage)} | {item.loteNome}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.reason}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/animais/${item.animalId}`}>Abrir ficha</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link to="/animais/transicoes">Tratar na fila</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Toolbar>
        <ToolbarGroup className="flex-1 gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por tipo, animal ou lote"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as "all" | "agendado" | "concluido" | "cancelado")
            }
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

          <Select value={dominioFilter} onValueChange={setDominioFilter}>
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
        </ToolbarGroup>

        <ToolbarGroup className="gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full sm:w-[160px]"
            aria-label="Data inicial"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full sm:w-[160px]"
            aria-label="Data final"
          />
          <Select value={groupMode} onValueChange={(value) => setGroupMode(value as GroupMode)}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="animal">Agrupar por animal</SelectItem>
              <SelectItem value="evento">Agrupar por evento</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setDominioFilter("all");
              setDateFrom("");
              setDateTo("");
              setGroupMode("animal");
            }}
          >
            Limpar filtros
          </Button>
        </ToolbarGroup>
      </Toolbar>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum item encontrado</p>
            <p className="text-sm text-muted-foreground">
              Ajuste os filtros para localizar tarefas da agenda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupMode === "animal"
            ? groupedByAnimal.map((group) => {
                const categoriaZootecnica =
                  readString(group.animal?.payload, "categoria_produtiva") ??
                  readString(group.animal?.payload, "categoria") ??
                  "N/D";
                const sexoLabel =
                  group.animal?.sexo === "M"
                    ? "Macho"
                    : group.animal?.sexo === "F"
                      ? "Femea"
                      : "N/D";
                const raca = getAnimalBreedLabel(group.animal?.raca) ?? "N/D";
                const lote = group.rows[0]?.loteNome ?? "Sem lote";
                const idade = group.rows[0]?.idadeLabel ?? "idade n/d";

                return (
                  <Card key={group.key}>
                    <CardHeader>
                      <CardTitle className="text-base">{group.title}</CardTitle>
                      <CardDescription>
                        {sexoLabel} | {idade} | {lote} | {raca} | {categoriaZootecnica}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {group.rows.map(renderRow)}
                    </CardContent>
                  </Card>
                );
              })
            : groupedByEvent.map((group) => {
                const uniqueAnimals = new Set(
                  group.rows
                    .map((row) => row.item.animal_id)
                    .filter((animalId): animalId is string => Boolean(animalId)),
                ).size;

                return (
                  <Card key={group.key}>
                    <CardHeader>
                      <CardTitle className="text-base">{group.title}</CardTitle>
                      <CardDescription>
                        {group.subtitle} | {uniqueAnimals} animal(is) | {group.rows.length} pendencia(s)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {group.rows.map(renderRow)}
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      )}
    </div>
  );
}
