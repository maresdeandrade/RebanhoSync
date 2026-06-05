import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Calendar,
  MoreHorizontal,
  PackageMinus,
  PlusCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import {
  getGestureSyncStage,
  getSyncStageLabel,
  type SyncStage,
} from "@/lib/offline/syncPresentation";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { describeSanitaryAlertEvent } from "@/lib/sanitario/compliance/alerts";
import { evaluateSanitaryInventoryConsumptionReadiness } from "@/lib/sanitario/compliance/inventoryConsumption";
import {
  buildSanitaryExceptionsReadModel,
  summarizeSanitaryExceptions,
} from "@/lib/sanitario/reconciliation/sanitaryExceptions";
import { buildSanitaryOccurrenceResolutionGesture } from "@/lib/sanitario/reconciliation/sanitaryCorrections";
import {
  buildRegulatoryOperationalReadModel,
  EMPTY_REGULATORY_OPERATIONAL_READ_MODEL,
  getRegulatoryAnalyticsImpactLabel,
  getRegulatoryAnalyticsSubareaLabel,
  loadRegulatorySurfaceSource,
  parseRegulatoryAnalyticsImpactKey,
  parseRegulatoryAnalyticsSubareaKey,
  resolveRegulatoryAnalyticsImpactsFromAttributes,
  resolveRegulatoryAnalyticsSubareaFromAttributes,
  type RegulatoryAnalyticsImpactKey,
  type RegulatoryAnalyticsSubareaKey,
} from "@/lib/sanitario/compliance/regulatoryReadModel";
import { cn } from "@/lib/utils";
import { showError, showSuccess } from "@/utils/toast";

type SyncFilter = "all" | GestureStatus | "SYNCED";
type RegulatorySubareaFilter = RegulatoryAnalyticsSubareaKey | "all";
type RegulatoryImpactFilter = RegulatoryAnalyticsImpactKey | "all";

const DOMAIN_LABEL: Record<DominioEnum, string> = {
  sanitario: "Sanitario",
  alerta_sanitario: "Alerta sanitario",
  conformidade: "Conformidade",
  pesagem: "Pesagem",
  nutricao: "Nutricao",
  movimentacao: "Movimentacao",
  reproducao: "Reproducao",
  financeiro: "Financeiro",
  obito: "Óbito",
};

function parseDomainFilter(
  value: string | null | undefined,
): "all" | DominioEnum {
  if (
    value === "sanitario" ||
    value === "alerta_sanitario" ||
    value === "conformidade" ||
    value === "pesagem" ||
    value === "nutricao" ||
    value === "movimentacao" ||
    value === "reproducao" ||
    value === "financeiro" ||
    value === "obito"
  ) {
    return value;
  }

  return "all";
}

function readPayloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
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

function formatDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR");
}

function readSnapshotString(snapshot: unknown, key: string): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  const value = (snapshot as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatSanitaryEventDetail(detail: EventoSanitario): string {
  const product = detail.produto_nome_snapshot ?? detail.produto ?? detail.tipo;
  const stockLot = detail.estoque_lote_codigo_snapshot
    ? `lote ${detail.estoque_lote_codigo_snapshot}`
    : detail.estoque_lote_id
      ? "lote de estoque vinculado"
      : "sem lote de estoque";
  const validity = formatDateOnly(detail.validade_produto);
  const dose =
    detail.dose_quantidade != null
      ? `${detail.dose_quantidade} ${detail.dose_unidade ?? ""}`.trim()
      : null;
  const withdrawal = [
    detail.carencia_carne_ate
      ? `carne ate ${formatDateOnly(detail.carencia_carne_ate)}`
      : null,
    detail.carencia_leite_ate
      ? `leite ate ${formatDateOnly(detail.carencia_leite_ate)}`
      : null,
  ].filter(Boolean);
  const protocolCode =
    readSnapshotString(detail.protocol_item_snapshot, "item_code") ??
    readSnapshotString(detail.protocol_item_snapshot, "itemCode");
  const protocol =
    protocolCode && detail.protocol_item_version
      ? `${protocolCode} / v${detail.protocol_item_version}`
      : detail.protocol_item_version
        ? `item sanitario v${detail.protocol_item_version}`
        : null;

  return [
    product,
    stockLot,
    validity ? `validade ${validity}` : null,
    dose ? `dose ${dose}` : null,
    detail.via_aplicacao ? `via ${detail.via_aplicacao}` : null,
    detail.responsavel_nome ? `responsavel ${detail.responsavel_nome}` : null,
    withdrawal.length > 0 ? `carencia ${withdrawal.join(" / ")}` : "sem carencia",
    detail.custo_total_snapshot != null
      ? `custo ${toCurrency(detail.custo_total_snapshot)}`
      : "custo ausente",
    protocol ? `protocolo ${protocol}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
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
  const domainFilterFromQuery = parseDomainFilter(searchParams.get("dominio"));
  const regulatorySubareaFromQuery =
    parseRegulatoryAnalyticsSubareaKey(searchParams.get("overlaySubarea")) ??
    "all";
  const regulatoryImpactFromQuery =
    parseRegulatoryAnalyticsImpactKey(searchParams.get("overlayImpact")) ??
    "all";
  const { activeFarmId, farmMeasurementConfig } = useAuth();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [domainFilter, setDomainFilter] = useState<"all" | DominioEnum>(
    domainFilterFromQuery,
  );
  const [animalFilter, setAnimalFilter] = useState("all");
  const [loteFilter, setLoteFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState<SyncFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [regulatorySubareaFilter, setRegulatorySubareaFilter] =
    useState<RegulatorySubareaFilter>(regulatorySubareaFromQuery);
  const [regulatoryImpactFilter, setRegulatoryImpactFilter] =
    useState<RegulatoryImpactFilter>(regulatoryImpactFromQuery);

  useEffect(() => {
    setDomainFilter(domainFilterFromQuery);
  }, [domainFilterFromQuery]);

  useEffect(() => {
    setRegulatorySubareaFilter(regulatorySubareaFromQuery);
  }, [regulatorySubareaFromQuery]);

  useEffect(() => {
    setRegulatoryImpactFilter(regulatoryImpactFromQuery);
  }, [regulatoryImpactFromQuery]);

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
    regulatorySubareaFilter,
    regulatoryImpactFilter,
  ]);
  const [complementTargetId, setComplementTargetId] = useState<string | null>(
    null,
  );
  const [complementText, setComplementText] = useState("");
  const [isSavingComplement, setIsSavingComplement] = useState(false);
  const regulatoryReadModel =
    useLiveQuery(async () => {
      if (!activeFarmId) return EMPTY_REGULATORY_OPERATIONAL_READ_MODEL;
      return buildRegulatoryOperationalReadModel(
        await loadRegulatorySurfaceSource(activeFarmId),
      );
    }, [activeFarmId]) || EMPTY_REGULATORY_OPERATIONAL_READ_MODEL;

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
        agenda: [],
        insumoMovimentacoes: [],
        insumoLotes: [],
      };
    }

    const [animais, lotes, gestos, agenda, insumoMovimentacoes, insumoLotes] =
      await Promise.all([
        db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
        db.queue_gestures.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_agenda_itens.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_insumo_movimentacoes
          .where("fazenda_id")
          .equals(activeFarmId)
          .toArray(),
        db.state_insumo_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
      ]);

    const animalById = new Map(animais.map((a) => [a.id, a]));
    const loteById = new Map(lotes.map((l) => [l.id, l]));
    const gestoByTx = new Map(gestos.map((g) => [g.client_tx_id, g]));

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

        if (
          regulatorySubareaFilter !== "all" ||
          regulatoryImpactFilter !== "all"
        ) {
          if (evento.dominio !== "conformidade") return false;

          const subarea = resolveRegulatoryAnalyticsSubareaFromAttributes({
            subarea: readPayloadString(evento.payload, "subarea"),
            complianceKind: readPayloadString(
              evento.payload,
              "compliance_kind",
            ),
          });
          const impacts = resolveRegulatoryAnalyticsImpactsFromAttributes({
            subarea: readPayloadString(evento.payload, "subarea"),
            complianceKind: readPayloadString(
              evento.payload,
              "compliance_kind",
            ),
          });

          if (
            regulatorySubareaFilter !== "all" &&
            subarea !== regulatorySubareaFilter
          ) {
            return false;
          }

          if (
            regulatoryImpactFilter !== "all" &&
            !impacts.includes(regulatoryImpactFilter)
          ) {
            return false;
          }
        }

        // Animal filter
        if (animalFilter !== "all" && evento.animal_id !== animalFilter)
          return false;

        // Lote filter
        if (loteFilter !== "all" && evento.lote_id !== loteFilter) return false;

        // Sync filter
        const syncStatus = normalizeSyncStatus(
          evento.client_tx_id
            ? gestoByTx.get(evento.client_tx_id)?.status
            : "SYNCED",
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
      agenda: agenda.filter((item) => !item.deleted_at),
      insumoMovimentacoes: insumoMovimentacoes.filter((item) => !item.deleted_at),
      insumoLotes: insumoLotes.filter((item) => !item.deleted_at),
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
    regulatorySubareaFilter,
    regulatoryImpactFilter,
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
    if (isSavingComplement) return;

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
      await createGesture(activeFarmId, built.ops);
      showSuccess("Complemento salvo neste aparelho. Sincronizacao pendente.");
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

  const sanitaryExceptions = useMemo(() => {
    if (!data) return [];
    return buildSanitaryExceptionsReadModel({
      eventos: data.eventos,
      eventosSanitario: data.sanitarios,
      insumoMovimentacoes: data.insumoMovimentacoes,
      agendaItens: data.agenda,
      estoqueLotes: data.insumoLotes,
      detectedAt: new Date().toISOString(),
    });
  }, [data]);
  const sanitaryExceptionSummary = useMemo(
    () => summarizeSanitaryExceptions(sanitaryExceptions, data?.eventos ?? []),
    [sanitaryExceptions, data?.eventos],
  );

  const handleResolveOccurrence = async (
    eventoId: string,
    action: "resolver" | "cancelar",
  ) => {
    if (!activeFarmId || !data) {
      showError("Fazenda ativa obrigatoria.");
      return;
    }
    const sourceEvent = data.eventos.find((evento) => evento.id === eventoId);
    if (!sourceEvent) {
      showError("Evento de origem nao encontrado.");
      return;
    }
    const agendaItemIds = data.agenda
      .filter((item) => item.status === "agendado" && item.source_evento_id === eventoId)
      .map((item) => item.id);
    const motivo =
      action === "resolver"
        ? "Ocorrencia sanitaria resolvida no painel de excecoes."
        : "Ocorrencia sanitaria cancelada no painel de excecoes.";

    try {
      const built = buildSanitaryOccurrenceResolutionGesture({
        fazendaId: activeFarmId,
        eventoOrigemId: eventoId,
        dominioOrigem: sourceEvent.dominio,
        occurredAt: new Date().toISOString(),
        action,
        motivo,
        animalId: sourceEvent.animal_id,
        loteId: sourceEvent.lote_id,
        agendaItemIds,
        acaoRealizada: motivo,
      });
      await createGesture(activeFarmId, built.ops);
      showSuccess("Resolucao registrada neste aparelho. Sincronizacao pendente.");
    } catch {
      showError("Falha ao registrar resolucao da ocorrencia.");
    }
  };

  const timeline = useMemo(() => {
    if (!data) return [];

    const animalById = new Map(data.animais.map((a) => [a.id, a]));
    const loteById = new Map(data.lotes.map((l) => [l.id, l]));
    const gestoByTx = new Map(data.gestos.map((g) => [g.client_tx_id, g]));

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
        const syncStage = getGestureSyncStage(
          evento.client_tx_id
            ? (gestoByTx.get(evento.client_tx_id) ?? null)
            : null,
        );

        let detail = "";
        let amount: number | null = null;
        let canCreateInventoryConsumption = false;

        if (evento.dominio === "sanitario") {
          const d = sanitarioByEvento.get(evento.id);
          detail = d ? formatSanitaryEventDetail(d) : "Sem detalhe sanitario";
          canCreateInventoryConsumption =
            evaluateSanitaryInventoryConsumptionReadiness({
              event: evento,
              sanitaryDetail: d,
            }).canCreateManualMovement;
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
          if (d?.tipo === "aborto") {
            detail = "Aborto / Interrupção de gestação";
          } else {
            detail = d ? d.tipo : "Sem detalhe de reproducao";
          }
        } else if (evento.dominio === "alerta_sanitario") {
          detail = describeSanitaryAlertEvent(evento.payload);
        } else if (evento.dominio === "conformidade") {
          detail =
            typeof evento.payload.official_item_label === "string"
              ? `${evento.payload.official_item_label} - ${evento.payload.status ?? "pendente"}`
              : "Checklist de conformidade";
        } else if (evento.dominio === "obito") {
          const causa =
            evento.payload && typeof evento.payload.causa === "string"
              ? (evento.payload.causa as string)
              : null;
          detail = causa ? `Óbito: ${causa}` : "Registro de óbito";
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
          syncStage,
          canCreateInventoryConsumption,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      evento: (typeof data.eventos)[number];
      animalNome: string;
      loteNome: string;
      detail: string;
      amount: number | null;
      syncStage: SyncStage;
      canCreateInventoryConsumption: boolean;
    }>;

    return rows;
  }, [data, debouncedSearch, farmMeasurementConfig.weight_unit]);

  const animais = data?.animais ?? [];
  const lotes = data?.lotes ?? [];
  const syncSummary = useMemo(
    () =>
      timeline.reduce(
        (summary, row) => {
          if (
            row.syncStage === "local_pending" ||
            row.syncStage === "syncing"
          ) {
            summary.pending += 1;
          }
          if (row.syncStage === "rejected" || row.syncStage === "error") {
            summary.errors += 1;
          }
          if (
            row.syncStage === "synced" ||
            row.syncStage === "synced_altered"
          ) {
            summary.synced += 1;
          }
          return summary;
        },
        { pending: 0, errors: 0, synced: 0 },
      ),
    [timeline],
  );
  const hasRegulatoryAnalyticalFilters =
    regulatorySubareaFilter !== "all" || regulatoryImpactFilter !== "all";
  const regulatoryFilterSummary = useMemo(() => {
    const labels: string[] = [];

    if (regulatorySubareaFilter !== "all") {
      labels.push(getRegulatoryAnalyticsSubareaLabel(regulatorySubareaFilter));
    }
    if (regulatoryImpactFilter !== "all") {
      labels.push(getRegulatoryAnalyticsImpactLabel(regulatoryImpactFilter));
    }

    return labels;
  }, [regulatoryImpactFilter, regulatorySubareaFilter]);
  const hasActiveFilters =
    debouncedSearch.trim().length > 0 ||
    domainFilter !== "all" ||
    animalFilter !== "all" ||
    loteFilter !== "all" ||
    syncFilter !== "all" ||
    dateFrom.length > 0 ||
    dateTo.length > 0 ||
    hasRegulatoryAnalyticalFilters;

  return (
    <div className="space-y-5">
      <PageIntro
        variant="plain"
        eyebrow="Historico de eventos executados"
        title="Eventos"
        description="Lista fatos ja registrados. Novo registro abre o fluxo manual e nao transforma agenda em historico."
        meta={
          <>
            <StatusBadge tone="neutral">
              {data?.totalCount ?? 0} registro(s) filtrado(s)
            </StatusBadge>
            {hasActiveFilters ? (
              <StatusBadge tone="info">Filtros ativos</StatusBadge>
            ) : null}
            {hasRegulatoryAnalyticalFilters ? (
              <StatusBadge tone="info">Recorte regulatorio ativo</StatusBadge>
            ) : null}
            {syncSummary.errors > 0 ? (
              <StatusBadge tone="danger">
                {syncSummary.errors} registro(s) para revisar
              </StatusBadge>
            ) : null}
            {regulatoryReadModel.attention.openCount > 0 ? (
              <StatusBadge
                tone={
                  regulatoryReadModel.hasBlockingIssues ? "danger" : "warning"
                }
              >
                {regulatoryReadModel.attention.openCount} pendencia(s) de
                conformidade
              </StatusBadge>
            ) : null}
            {regulatoryFilterSummary.map((label) => (
              <StatusBadge key={label} tone="info">
                {label}
              </StatusBadge>
            ))}
          </>
        }
        actions={
          <Button onClick={() => navigate("/registrar")}>
            <PlusCircle className="h-4 w-4" />
            Novo registro manual
          </Button>
        }
      />

      {regulatoryReadModel.attention.openCount > 0 ? (
        <Card className="border-warning/25 bg-warning-muted/50 shadow-none">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <CardTitle className="text-base">Atenção de conformidade</CardTitle>
            <p className="text-sm text-muted-foreground">
              Conformidade aberta
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {regulatoryReadModel.attention.badges.map((badge) => (
                <StatusBadge key={badge.key} tone={badge.tone}>
                  {badge.label} {badge.count}
                </StatusBadge>
              ))}
              {regulatoryReadModel.flows.nutrition.blockerCount > 0 ? (
                <StatusBadge tone="danger">Bloqueia nutricao</StatusBadge>
              ) : null}
              {regulatoryReadModel.flows.sale.blockerCount > 0 ? (
                <StatusBadge tone="danger">Bloqueia venda/transito</StatusBadge>
              ) : null}
            </div>

            {regulatoryReadModel.attention.topItems.slice(0, 2).map((item) => (
              <div
                key={item.key}
                className="rounded-xl border border-border/70 bg-background/80 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.label}</p>
                  <StatusBadge tone={item.tone}>{item.statusLabel}</StatusBadge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.recommendation}
                </p>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/protocolos-sanitarios")}
              >
                Abrir conformidade
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDomainFilter("conformidade")}
              >
                Filtrar conformidade
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Toolbar className="bg-muted/20 shadow-none">
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
            onValueChange={(value) =>
              setDomainFilter(value as "all" | DominioEnum)
            }
          >
            <SelectTrigger
              aria-label="Filtrar por dominio"
              className="w-full sm:w-[180px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os dominios</SelectItem>
              <SelectItem value="sanitario">Sanitario</SelectItem>
              <SelectItem value="alerta_sanitario">Alerta sanitario</SelectItem>
              <SelectItem value="conformidade">Conformidade</SelectItem>
              <SelectItem value="pesagem">Pesagem</SelectItem>
              <SelectItem value="movimentacao">Movimentacao</SelectItem>
              <SelectItem value="nutricao">Nutricao</SelectItem>
              <SelectItem value="reproducao">Reproducao</SelectItem>
              <SelectItem value="financeiro">Financeiro</SelectItem>
              <SelectItem value="obito">Óbito</SelectItem>
            </SelectContent>
          </Select>

          <Select value={animalFilter} onValueChange={setAnimalFilter}>
            <SelectTrigger
              aria-label="Filtrar por animal"
              className="w-full sm:w-[180px]"
            >
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
            <SelectTrigger
              aria-label="Filtrar por lote"
              className="w-full sm:w-[180px]"
            >
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
            <SelectTrigger
              aria-label="Filtrar por envio"
              className="w-full sm:w-[180px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo envio</SelectItem>
              <SelectItem value="SYNCED">Enviado</SelectItem>
              <SelectItem value="PENDING">Aguardando envio</SelectItem>
              <SelectItem value="SYNCING">Enviando</SelectItem>
              <SelectItem value="ERROR">Erro no envio</SelectItem>
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
              setRegulatorySubareaFilter("all");
              setRegulatoryImpactFilter("all");
            }}
          >
            <RefreshCw className="h-4 w-4" />
            {hasRegulatoryAnalyticalFilters
              ? "Limpar recorte regulatorio"
              : "Limpar filtros"}
          </Button>
        </ToolbarGroup>
      </Toolbar>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Excecoes sanitarias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              tone={sanitaryExceptionSummary.totalOpen > 0 ? "warning" : "success"}
            >
              {sanitaryExceptionSummary.totalOpen} abertas
            </StatusBadge>
            <StatusBadge tone="neutral">
              {sanitaryExceptionSummary.inconsistentStockCount} estoque
            </StatusBadge>
            <StatusBadge tone="neutral">
              {sanitaryExceptionSummary.missingCostCount} custo ausente
            </StatusBadge>
            <StatusBadge tone="neutral">
              {sanitaryExceptionSummary.overdueCorrectivePendingCount} vencidas
            </StatusBadge>
          </div>

          {sanitaryExceptions
            .filter((item) => item.status === "open")
            .slice(0, 5)
            .map((exception) => (
              <div
                key={exception.id}
                className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 md:flex-row md:items-start md:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      tone={
                        exception.severity === "critical"
                          ? "danger"
                          : exception.severity === "warning"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {exception.code}
                    </StatusBadge>
                    <span className="text-xs text-muted-foreground">
                      Fonte: {exception.source}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{exception.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {exception.recommended_action}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {exception.evento_id ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setComplementTargetId(exception.evento_id ?? null);
                        setComplementText("");
                      }}
                    >
                      Complementar
                    </Button>
                  ) : null}
                  {(exception.code === "ocorrencia_biosseguranca_aberta" ||
                    exception.code === "suspeita_notificavel_aberta" ||
                    exception.code === "ocorrencia_com_pendencia_aberta") &&
                  exception.source_evento_id ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          handleResolveOccurrence(
                            exception.source_evento_id!,
                            "resolver",
                          )
                        }
                      >
                        Resolver
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleResolveOccurrence(
                            exception.source_evento_id!,
                            "cancelar",
                          )
                        }
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {timeline.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="p-10 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum evento encontrado</p>
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
                  "rounded-xl border border-border/70 bg-background/95 p-4 shadow-none transition-colors hover:border-primary/25",
                  isHighlighted && "border-primary/30 bg-primary/5",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {DOMAIN_LABEL[row.evento.dominio]}
                      </p>
                      <StatusBadge tone="neutral">{row.animalNome}</StatusBadge>
                      <StatusBadge tone="neutral">{row.loteNome}</StatusBadge>
                      {isHighlighted ? (
                        <StatusBadge tone="info">Em foco</StatusBadge>
                      ) : null}
                    </div>

                    <p className="text-sm leading-6 text-muted-foreground">
                      {row.detail}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{toDateTime(row.evento.occurred_at)}</span>
                      {row.syncStage !== "synced" &&
                      row.syncStage !== "synced_altered" ? (
                        <span>Envio: {getSyncStageLabel(row.syncStage)}</span>
                      ) : null}
                      {row.evento.source_task_id ? (
                        <span>Origem: agenda</span>
                      ) : null}
                      {row.evento.corrige_evento_id ? (
                        <span>Complemento</span>
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
                            onClick={() =>
                              navigate(`/animais/${row.evento.animal_id}`)
                            }
                          >
                            Abrir ficha do animal
                          </DropdownMenuItem>
                        ) : null}
                        {row.canCreateInventoryConsumption ? (
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(
                                `/insumos?sourceEventoId=${encodeURIComponent(row.evento.id)}`,
                              )
                            }
                          >
                            <PackageMinus className="mr-2 h-4 w-4" />
                            Baixar do estoque
                          </DropdownMenuItem>
                        ) : null}
                        {row.evento.dominio === "reproducao" ||
                        row.evento.dominio === "alerta_sanitario" ||
                        row.evento.dominio === "conformidade" ? (
                          <DropdownMenuItem disabled>
                            Complemento indisponivel neste dominio
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => {
                              setComplementTargetId(
                                isComplementOpen ? null : row.id,
                              );
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
                  <div className="mt-4 rounded-xl border border-border/70 bg-muted/30 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Complemento do evento
                      </p>
                    </div>

                    <Textarea
                      id={`complemento-${row.id}`}
                      className="mt-3"
                      placeholder="Descreva informacoes adicionais deste evento..."
                      value={complementText}
                      onChange={(event) =>
                        setComplementText(event.target.value)
                      }
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
                        {isSavingComplement
                          ? "Salvando..."
                          : "Salvar complemento"}
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
