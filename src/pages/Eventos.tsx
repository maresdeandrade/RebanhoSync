import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { Calendar, MoreHorizontal, PlusCircle, RefreshCw, Search } from "lucide-react";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type {
  DominioEnum,
  Evento,
  EventoFinanceiro,
  EventoMovimentacao,
  EventoNutricao,
  EventoPesagem,
  EventoSanitario,
  GestureStatus,
} from "@/lib/offline/types";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import type { EventInput } from "@/lib/events/types";
import { EventValidationError } from "@/lib/events/validators";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { formatWeight } from "@/lib/format/weight";
import { cn } from "@/lib/utils";
import { showError, showSuccess } from "@/utils/toast";

type SyncFilter = "all" | GestureStatus | "SYNCED";

const DOMAIN_LABEL: Record<DominioEnum, string> = {
  sanitario: "Sanitario",
  pesagem: "Pesagem",
  nutricao: "Nutricao",
  movimentacao: "Movimentacao",
  reproducao: "Reproducao",
  financeiro: "Financeiro",
};

const STATUS_LABEL: Record<GestureStatus | "SYNCED", string> = {
  PENDING: "Pendente",
  SYNCING: "Sincronizando",
  DONE: "Sincronizado",
  ERROR: "Erro",
  SYNCED: "Sincronizado",
  REJECTED: "Rejeitado",
};

function getSyncTone(status: GestureStatus | "SYNCED") {
  if (status === "REJECTED" || status === "ERROR") return "danger";
  if (status === "PENDING") return "warning";
  if (status === "SYNCING") return "info";
  return "success";
}

function normalizeSyncStatus(status?: string): GestureStatus | "SYNCED" {
  if (!status || status === "DONE" || status === "SYNCED") return "SYNCED";
  return status as GestureStatus;
}

function toCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function toDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PAGE_SIZE = 50;

const Eventos = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightedEventId = searchParams.get("eventoId");
  const { activeFarmId, farmMeasurementConfig } = useAuth();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [domainFilter, setDomainFilter] = useState<"all" | DominioEnum>("all");
  const [animalFilter, setAnimalFilter] = useState("all");
  const [loteFilter, setLoteFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState<SyncFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    activeFarmId,
    search,
    domainFilter,
    animalFilter,
    loteFilter,
    syncFilter,
    dateFrom,
    dateTo,
  ]);
  const [complementTargetId, setComplementTargetId] = useState<string | null>(
    null,
  );
  const [complementText, setComplementText] = useState("");
  const [isSavingComplement, setIsSavingComplement] = useState(false);

  const data = useLiveQuery(async () => {
    if (!activeFarmId) {
      return {
        eventos: [],
        totalCount: 0,
        sanitarios: [],
        pesagens: [],
        nutricao: [],
        movimentacoes: [],
        financeiro: [],
        reproducao: [],
        animais: [],
        lotes: [],
        gestos: [],
      };
    }

    const [animais, lotes, gestos] = await Promise.all([
      db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
      db.queue_gestures.where("fazenda_id").equals(activeFarmId).toArray(),
    ]);

    const animalById = new Map(animais.map((a) => [a.id, a]));
    const loteById = new Map(lotes.map((l) => [l.id, l]));
    const gestoByTx = new Map(gestos.map((g) => [g.client_tx_id, g.status]));

    const getFilteredCollection = () => {
      const base = db.event_eventos
        .where("[fazenda_id+occurred_at]")
        .between(
          [activeFarmId, Dexie.minKey],
          [activeFarmId, Dexie.maxKey],
          true,
          true,
        )
        .reverse();

      return base.filter((evento) => {
        if (evento.deleted_at) return false;

        // Domain filter
        if (domainFilter !== "all" && evento.dominio !== domainFilter)
          return false;

        // Animal filter
        if (animalFilter !== "all" && evento.animal_id !== animalFilter)
          return false;

        // Lote filter
        if (loteFilter !== "all" && evento.lote_id !== loteFilter) return false;

        // Sync filter
        const syncStatus = normalizeSyncStatus(
          evento.client_tx_id ? gestoByTx.get(evento.client_tx_id) : "SYNCED",
        );
        if (syncFilter !== "all" && syncStatus !== syncFilter) return false;

        // Date filters
        const occurredOn = evento.occurred_at.slice(0, 10);
        if (dateFrom && occurredOn < dateFrom) return false;
        if (dateTo && occurredOn > dateTo) return false;

        // Partial Search (only fields available in event_eventos + state_animais/lotes)
          if (debouncedSearch.trim()) {
            const searchLower = debouncedSearch.trim().toLowerCase();
          const animal = evento.animal_id
            ? animalById.get(evento.animal_id)
            : null;
          const lote = evento.lote_id ? loteById.get(evento.lote_id) : null;
          const textIndex = [
            DOMAIN_LABEL[evento.dominio],
            animal?.identificacao,
            lote?.nome,
            evento.observacoes ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!textIndex.includes(searchLower)) return false;
        }

        return true;
      });
    };

    const [totalCount, eventosPaged] = await Promise.all([
      getFilteredCollection().count(),
      getFilteredCollection().limit(visibleCount).toArray(),
    ]);

    const eventIds = eventosPaged.map((e) => e.id);

    const [
      sanitarios,
      pesagens,
      nutricao,
      movimentacoes,
      financeiro,
      reproducao,
    ] = await Promise.all([
      db.event_eventos_sanitario.where("evento_id").anyOf(eventIds).toArray(),
      db.event_eventos_pesagem.where("evento_id").anyOf(eventIds).toArray(),
      db.event_eventos_nutricao.where("evento_id").anyOf(eventIds).toArray(),
      db.event_eventos_movimentacao
        .where("evento_id")
        .anyOf(eventIds)
        .toArray(),
      db.event_eventos_financeiro.where("evento_id").anyOf(eventIds).toArray(),
      db.event_eventos_reproducao.where("evento_id").anyOf(eventIds).toArray(),
    ]);

    return {
      eventos: eventosPaged,
      totalCount,
      sanitarios: sanitarios.filter((e) => !e.deleted_at),
      pesagens: pesagens.filter((e) => !e.deleted_at),
      nutricao: nutricao.filter((e) => !e.deleted_at),
      movimentacoes: movimentacoes.filter((e) => !e.deleted_at),
      financeiro: financeiro.filter((e) => !e.deleted_at),
      reproducao: reproducao.filter((e) => !e.deleted_at),
      animais: animais.filter((a) => !a.deleted_at),
      lotes: lotes.filter((l) => !l.deleted_at),
      gestos,
    };
  }, [
    activeFarmId,
    domainFilter,
    animalFilter,
    loteFilter,
    syncFilter,
    dateFrom,
    dateTo,
    search,
    visibleCount,
  ]);

  const detailMaps = useMemo(() => {
    if (!data) return null;

    return {
      sanitarioByEvento: new Map<string, EventoSanitario>(
        data.sanitarios.map((item) => [item.evento_id, item]),
      ),
      pesagemByEvento: new Map<string, EventoPesagem>(
        data.pesagens.map((item) => [item.evento_id, item]),
      ),
      nutricaoByEvento: new Map<string, EventoNutricao>(
        data.nutricao.map((item) => [item.evento_id, item]),
      ),
      movByEvento: new Map<string, EventoMovimentacao>(
        data.movimentacoes.map((item) => [item.evento_id, item]),
      ),
      finByEvento: new Map<string, EventoFinanceiro>(
        data.financeiro.map((item) => [item.evento_id, item]),
      ),
    };
  }, [data]);

  const buildComplementEventInput = (
    baseEvento: Evento,
    complemento: string,
  ): EventInput | null => {
    if (!activeFarmId || !detailMaps) return null;

    const payloadBase = {
      kind: "complemento_evento",
      source_evento_id: baseEvento.id,
      source_dominio: baseEvento.dominio,
    };

    if (baseEvento.dominio === "sanitario") {
      const detail = detailMaps.sanitarioByEvento.get(baseEvento.id);
      if (!detail) return null;
      return {
        dominio: "sanitario",
        fazendaId: activeFarmId,
        occurredAt: new Date().toISOString(),
        animalId: baseEvento.animal_id,
        loteId: baseEvento.lote_id,
        corrigeEventoId: baseEvento.id,
        observacoes: complemento,
        payload: payloadBase,
        tipo: detail.tipo,
        produto: detail.produto,
      };
    }

    if (baseEvento.dominio === "pesagem") {
      const detail = detailMaps.pesagemByEvento.get(baseEvento.id);
      if (!detail) return null;
      return {
        dominio: "pesagem",
        fazendaId: activeFarmId,
        occurredAt: new Date().toISOString(),
        animalId: baseEvento.animal_id,
        loteId: baseEvento.lote_id,
        corrigeEventoId: baseEvento.id,
        observacoes: complemento,
        payload: payloadBase,
        pesoKg: detail.peso_kg,
      };
    }

    if (baseEvento.dominio === "movimentacao") {
      const detail = detailMaps.movByEvento.get(baseEvento.id);
      if (!detail) return null;
      return {
        dominio: "movimentacao",
        fazendaId: activeFarmId,
        occurredAt: new Date().toISOString(),
        animalId: baseEvento.animal_id,
        loteId: baseEvento.lote_id,
        corrigeEventoId: baseEvento.id,
        observacoes: complemento,
        payload: payloadBase,
        fromLoteId: detail.from_lote_id,
        toLoteId: detail.to_lote_id,
        fromPastoId: detail.from_pasto_id,
        toPastoId: detail.to_pasto_id,
        applyAnimalStateUpdate: false,
      };
    }

    if (baseEvento.dominio === "nutricao") {
      const detail = detailMaps.nutricaoByEvento.get(baseEvento.id);
      if (!detail?.alimento_nome || !detail.quantidade_kg) return null;
      return {
        dominio: "nutricao",
        fazendaId: activeFarmId,
        occurredAt: new Date().toISOString(),
        animalId: baseEvento.animal_id,
        loteId: baseEvento.lote_id,
        corrigeEventoId: baseEvento.id,
        observacoes: complemento,
        payload: payloadBase,
        alimentoNome: detail.alimento_nome,
        quantidadeKg: detail.quantidade_kg,
      };
    }

    if (baseEvento.dominio === "financeiro") {
      const detail = detailMaps.finByEvento.get(baseEvento.id);
      if (!detail) return null;
      return {
        dominio: "financeiro",
        fazendaId: activeFarmId,
        occurredAt: new Date().toISOString(),
        animalId: baseEvento.animal_id,
        loteId: baseEvento.lote_id,
        corrigeEventoId: baseEvento.id,
        observacoes: complemento,
        payload: payloadBase,
        tipo: detail.tipo,
        valorTotal: Number(detail.valor_total),
        contraparteId: detail.contraparte_id,
        applyAnimalStateUpdate: false,
      };
    }

    return null;
  };

  const handleSaveComplement = async (baseEvento: Evento) => {
    if (!activeFarmId) {
      showError("Fazenda ativa obrigatoria.");
      return;
    }
    const complemento = complementText.trim();
    if (!complemento) {
      showError("Descreva o complemento antes de salvar.");
      return;
    }

    const input = buildComplementEventInput(baseEvento, complemento);
    if (!input) {
      showError(
        "Nao foi possivel gerar complemento para este evento (detalhes insuficientes).",
      );
      return;
    }

    setIsSavingComplement(true);
    try {
      const built = buildEventGesture(input);
      const txId = await createGesture(activeFarmId, built.ops);
      showSuccess(`Complemento adicionado. TX: ${txId.slice(0, 8)}`);
      setComplementTargetId(null);
      setComplementText("");
    } catch (error: unknown) {
      if (error instanceof EventValidationError) {
        showError(
          error.issues[0]?.message ?? "Dados invalidos para complemento.",
        );
      } else {
        showError("Falha ao salvar complemento.");
      }
    } finally {
      setIsSavingComplement(false);
    }
  };

  const timeline = useMemo(() => {
    if (!data) return [];

    const animalById = new Map(data.animais.map((a) => [a.id, a]));
    const loteById = new Map(data.lotes.map((l) => [l.id, l]));
    const gestoByTx = new Map(
      data.gestos.map((g) => [g.client_tx_id, g.status]),
    );

    const sanitarioByEvento = new Map(
      data.sanitarios.map((d) => [d.evento_id, d]),
    );
    const pesagemByEvento = new Map(data.pesagens.map((d) => [d.evento_id, d]));
    const nutricaoByEvento = new Map(
      data.nutricao.map((d) => [d.evento_id, d]),
    );
    const movByEvento = new Map(
      data.movimentacoes.map((d) => [d.evento_id, d]),
    );
    const finByEvento = new Map(data.financeiro.map((d) => [d.evento_id, d]));
    const reproByEvento = new Map(data.reproducao.map((d) => [d.evento_id, d]));

    const searchLower = debouncedSearch.trim().toLowerCase();

    const rows = data.eventos
      .map((evento) => {
        const animal = evento.animal_id
          ? animalById.get(evento.animal_id)
          : null;
        const lote = evento.lote_id ? loteById.get(evento.lote_id) : null;
        const syncStatus = normalizeSyncStatus(
          evento.client_tx_id ? gestoByTx.get(evento.client_tx_id) : "SYNCED",
        );

        let detail = "";
        let amount: number | null = null;

        if (evento.dominio === "sanitario") {
          const d = sanitarioByEvento.get(evento.id);
          detail = d ? `${d.tipo} - ${d.produto}` : "Sem detalhe sanitario";
        } else if (evento.dominio === "pesagem") {
          const d = pesagemByEvento.get(evento.id);
          detail = d
            ? formatWeight(d.peso_kg, farmMeasurementConfig.weight_unit)
            : "Sem detalhe de pesagem";
        } else if (evento.dominio === "nutricao") {
          const d = nutricaoByEvento.get(evento.id);
          if (d) {
            const quantidade =
              d.quantidade_kg != null ? `${d.quantidade_kg} kg` : "";
            detail = `${d.alimento_nome ?? "Alimento"} ${quantidade}`.trim();
          } else {
            detail = "Sem detalhe de nutricao";
          }
        } else if (evento.dominio === "movimentacao") {
          const d = movByEvento.get(evento.id);
          if (d) {
            const fromLote = d.from_lote_id
              ? loteById.get(d.from_lote_id)?.nome
              : null;
            const toLote = d.to_lote_id
              ? loteById.get(d.to_lote_id)?.nome
              : null;
            detail = `Lote: ${fromLote ?? "-"} -> ${toLote ?? "-"}`;
          } else {
            detail = "Sem detalhe de movimentacao";
          }
        } else if (evento.dominio === "financeiro") {
          const d = finByEvento.get(evento.id);
          if (d) {
            amount = d.valor_total;
            const payloadKind =
              evento.payload && typeof evento.payload.kind === "string"
                ? (evento.payload.kind as string)
                : "";
            const naturezaLabel =
              payloadKind === "sociedade_entrada"
                ? "Sociedade (Entrada)"
                : payloadKind === "sociedade_saida"
                  ? "Sociedade (Saida)"
                  : d.tipo === "compra"
                    ? "Compra"
                    : "Venda";
            detail = `${naturezaLabel} - ${toCurrency(d.valor_total)}`;
          } else {
            detail = "Sem detalhe financeiro";
          }
        } else if (evento.dominio === "reproducao") {
          const d = reproByEvento.get(evento.id);
          detail = d ? d.tipo : "Sem detalhe de reproducao";
        }

        const textIndex = [
          DOMAIN_LABEL[evento.dominio],
          detail,
          animal?.identificacao,
          lote?.nome,
          evento.observacoes ?? "",
        ]
          .join(" ")
          .toLowerCase();

        const searchMatch = !searchLower || textIndex.includes(searchLower);

        // All other filters are already handled in useLiveQuery
        if (!searchMatch) {
          return null;
        }

        return {
          id: evento.id,
          evento,
          animalNome: animal?.identificacao ?? "Sem animal",
          loteNome: lote?.nome ?? "Sem lote",
          detail,
          amount,
          syncStatus,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      evento: (typeof data.eventos)[number];
      animalNome: string;
      loteNome: string;
      detail: string;
      amount: number | null;
      syncStatus: GestureStatus | "SYNCED";
    }>;

    return rows;
  }, [data, debouncedSearch, farmMeasurementConfig.weight_unit]);

  const animais = data?.animais ?? [];
  const lotes = data?.lotes ?? [];
  const syncSummary = useMemo(
    () =>
      timeline.reduce(
        (summary, row) => {
          if (row.syncStatus === "PENDING" || row.syncStatus === "SYNCING") {
            summary.pending += 1;
          }
          if (row.syncStatus === "REJECTED" || row.syncStatus === "ERROR") {
            summary.errors += 1;
          }
          if (row.syncStatus === "SYNCED") {
            summary.synced += 1;
          }
          return summary;
        },
        { pending: 0, errors: 0, synced: 0 },
      ),
    [timeline],
  );
  const hasActiveFilters =
    debouncedSearch.trim().length > 0 ||
    domainFilter !== "all" ||
    animalFilter !== "all" ||
    loteFilter !== "all" ||
    syncFilter !== "all" ||
    dateFrom.length > 0 ||
    dateTo.length > 0;

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Historico operacional"
        title="Eventos da fazenda"
        description="Timeline unificada por dominio com filtros compactos e rastreio de sincronizacao sem competir com o conteudo principal."
        meta={
          <>
            <StatusBadge tone="neutral">
              {data?.totalCount ?? 0} registro(s) filtrado(s)
            </StatusBadge>
            {hasActiveFilters ? (
              <StatusBadge tone="info">Filtros ativos</StatusBadge>
            ) : null}
            {syncSummary.errors > 0 ? (
              <StatusBadge tone="danger">
                {syncSummary.errors} falha(s) visiveis
              </StatusBadge>
            ) : null}
          </>
        }
        actions={
          <Button onClick={() => navigate("/registrar")}>
            <PlusCircle className="h-4 w-4" />
            Novo registro
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Eventos filtrados"
          value={data?.totalCount ?? 0}
          hint={`${timeline.length} carregado(s) nesta leitura.`}
        />
        <MetricCard
          label="Pendentes de sync"
          value={syncSummary.pending}
          hint="Inclui registros pendentes e sincronizando."
          tone={syncSummary.pending > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Falhas visiveis"
          value={syncSummary.errors}
          hint={
            syncSummary.errors > 0
              ? "Revise rejeicoes e erros do recorte atual."
              : "Nenhuma falha aparente nos itens carregados."
          }
          tone={syncSummary.errors > 0 ? "danger" : "success"}
        />
      </section>

      <Toolbar>
        <ToolbarGroup className="flex-1 gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por dominio, animal, lote ou observacao"
              className="pl-9"
            />
          </div>

          <Select
            value={domainFilter}
            onValueChange={(value) => setDomainFilter(value as "all" | DominioEnum)}
          >
            <SelectTrigger aria-label="Filtrar por dominio" className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os dominios</SelectItem>
              <SelectItem value="sanitario">Sanitario</SelectItem>
              <SelectItem value="pesagem">Pesagem</SelectItem>
              <SelectItem value="movimentacao">Movimentacao</SelectItem>
              <SelectItem value="nutricao">Nutricao</SelectItem>
              <SelectItem value="reproducao">Reproducao</SelectItem>
              <SelectItem value="financeiro">Financeiro</SelectItem>
            </SelectContent>
          </Select>

          <Select value={animalFilter} onValueChange={setAnimalFilter}>
            <SelectTrigger aria-label="Filtrar por animal" className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os animais</SelectItem>
              {animais.map((animal) => (
                <SelectItem key={animal.id} value={animal.id}>
                  {animal.identificacao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={loteFilter} onValueChange={setLoteFilter}>
            <SelectTrigger aria-label="Filtrar por lote" className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os lotes</SelectItem>
              {lotes.map((lote) => (
                <SelectItem key={lote.id} value={lote.id}>
                  {lote.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={syncFilter}
            onValueChange={(value) => setSyncFilter(value as SyncFilter)}
          >
            <SelectTrigger aria-label="Filtrar por sincronizacao" className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo sync</SelectItem>
              <SelectItem value="SYNCED">Sincronizado</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="SYNCING">Sincronizando</SelectItem>
              <SelectItem value="ERROR">Erro</SelectItem>
              <SelectItem value="REJECTED">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        </ToolbarGroup>

        <ToolbarGroup className="gap-2">
          <Input
            type="date"
            aria-label="Data inicial"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full sm:w-[160px]"
          />
          <Input
            type="date"
            aria-label="Data final"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full sm:w-[160px]"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setSearch("");
              setDomainFilter("all");
              setAnimalFilter("all");
              setLoteFilter("all");
              setSyncFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Limpar filtros
          </Button>
        </ToolbarGroup>
      </Toolbar>

      {timeline.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum evento encontrado</p>
            <p className="text-sm text-muted-foreground">
              Ajuste o recorte atual ou registre um novo evento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {timeline.map((row) => {
            const isHighlighted = highlightedEventId === row.id;
            const isComplementOpen = complementTargetId === row.id;

            return (
              <article
                key={row.id}
                className={cn(
                  "rounded-2xl border border-border/70 bg-background/95 p-4 shadow-soft",
                  isHighlighted && "border-primary/30 bg-primary/5",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{DOMAIN_LABEL[row.evento.dominio]}</p>
                      <StatusBadge tone="neutral">{row.animalNome}</StatusBadge>
                      <StatusBadge tone="neutral">{row.loteNome}</StatusBadge>
                      <StatusBadge tone={getSyncTone(row.syncStatus)}>
                        {STATUS_LABEL[row.syncStatus]}
                      </StatusBadge>
                      {isHighlighted ? (
                        <StatusBadge tone="info">Em foco</StatusBadge>
                      ) : null}
                    </div>

                    <p className="text-sm leading-6 text-muted-foreground">
                      {row.detail}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{toDateTime(row.evento.occurred_at)}</span>
                      <span>ID {row.id.slice(0, 8)}</span>
                      {row.evento.source_task_id ? (
                        <span>Agenda {row.evento.source_task_id.slice(0, 8)}</span>
                      ) : null}
                      {row.evento.corrige_evento_id ? (
                        <span>
                          Complementa {row.evento.corrige_evento_id.slice(0, 8)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    {row.amount != null ? (
                      <div className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-sm font-semibold">
                        {toCurrency(row.amount)}
                      </div>
                    ) : null}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={`Mais acoes para o evento ${row.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {row.evento.animal_id ? (
                          <DropdownMenuItem
                            onClick={() => navigate(`/animais/${row.evento.animal_id}`)}
                          >
                            Abrir ficha do animal
                          </DropdownMenuItem>
                        ) : null}
                        {row.evento.dominio === "reproducao" ? (
                          <DropdownMenuItem disabled>
                            Complemento indisponivel em reproducao
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => {
                              setComplementTargetId(isComplementOpen ? null : row.id);
                              setComplementText("");
                            }}
                          >
                            {isComplementOpen
                              ? "Fechar complemento"
                              : "Adicionar complemento"}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {isComplementOpen ? (
                  <div className="mt-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Complemento do evento
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Acrescente contexto sem alterar o fato original ja
                        registrado.
                      </p>
                    </div>

                    <Textarea
                      id={`complemento-${row.id}`}
                      className="mt-3"
                      placeholder="Descreva informacoes adicionais deste evento..."
                      value={complementText}
                      onChange={(event) => setComplementText(event.target.value)}
                      rows={3}
                    />

                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setComplementTargetId(null);
                          setComplementText("");
                        }}
                        disabled={isSavingComplement}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveComplement(row.evento)}
                        disabled={isSavingComplement}
                      >
                        {isSavingComplement ? "Salvando..." : "Salvar complemento"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}

          {data && data.totalCount > timeline.length ? (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              >
                Carregar mais (restam {data.totalCount - timeline.length})
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default Eventos;
