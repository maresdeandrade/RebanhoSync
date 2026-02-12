import { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Calendar, Filter, RefreshCw, Search, PlusCircle } from "lucide-react";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { useAuth } from "@/hooks/useAuth";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function statusBadgeClass(status: GestureStatus | "SYNCED") {
  if (status === "REJECTED" || status === "ERROR") {
    return "bg-red-100 text-red-700 border-red-200";
  }
  if (status === "PENDING") {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }
  if (status === "SYNCING") {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
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

const Eventos = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightedEventId = searchParams.get("eventoId");
  const { activeFarmId } = useAuth();

  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<"all" | DominioEnum>("all");
  const [animalFilter, setAnimalFilter] = useState("all");
  const [loteFilter, setLoteFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState<SyncFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [complementTargetId, setComplementTargetId] = useState<string | null>(
    null,
  );
  const [complementText, setComplementText] = useState("");
  const [isSavingComplement, setIsSavingComplement] = useState(false);

  const data = useLiveQuery(
    async () => {
      if (!activeFarmId) {
        return {
          eventos: [],
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

      const [
        eventos,
        sanitarios,
        pesagens,
        nutricao,
        movimentacoes,
        financeiro,
        reproducao,
        animais,
        lotes,
        gestos,
      ] = await Promise.all([
        db.event_eventos.where("fazenda_id").equals(activeFarmId).toArray(),
        db.event_eventos_sanitario.where("fazenda_id").equals(activeFarmId).toArray(),
        db.event_eventos_pesagem.where("fazenda_id").equals(activeFarmId).toArray(),
        db.event_eventos_nutricao.where("fazenda_id").equals(activeFarmId).toArray(),
        db.event_eventos_movimentacao.where("fazenda_id").equals(activeFarmId).toArray(),
        db.event_eventos_financeiro.where("fazenda_id").equals(activeFarmId).toArray(),
        db.event_eventos_reproducao.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
        db.queue_gestures.where("fazenda_id").equals(activeFarmId).toArray(),
      ]);

      return {
        eventos: eventos.filter((e) => !e.deleted_at),
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
    },
    [activeFarmId],
  );

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
        showError(error.issues[0]?.message ?? "Dados invalidos para complemento.");
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
    const gestoByTx = new Map(data.gestos.map((g) => [g.client_tx_id, g.status]));

    const sanitarioByEvento = new Map(data.sanitarios.map((d) => [d.evento_id, d]));
    const pesagemByEvento = new Map(data.pesagens.map((d) => [d.evento_id, d]));
    const nutricaoByEvento = new Map(data.nutricao.map((d) => [d.evento_id, d]));
    const movByEvento = new Map(data.movimentacoes.map((d) => [d.evento_id, d]));
    const finByEvento = new Map(data.financeiro.map((d) => [d.evento_id, d]));
    const reproByEvento = new Map(data.reproducao.map((d) => [d.evento_id, d]));

    const searchLower = search.trim().toLowerCase();

    const rows = data.eventos
      .map((evento) => {
        const animal = evento.animal_id ? animalById.get(evento.animal_id) : null;
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
          detail = d ? `${d.peso_kg.toFixed(2)} kg` : "Sem detalhe de pesagem";
        } else if (evento.dominio === "nutricao") {
          const d = nutricaoByEvento.get(evento.id);
          if (d) {
            const quantidade = d.quantidade_kg != null ? `${d.quantidade_kg} kg` : "";
            detail = `${d.alimento_nome ?? "Alimento"} ${quantidade}`.trim();
          } else {
            detail = "Sem detalhe de nutricao";
          }
        } else if (evento.dominio === "movimentacao") {
          const d = movByEvento.get(evento.id);
          if (d) {
            const fromLote = d.from_lote_id ? loteById.get(d.from_lote_id)?.nome : null;
            const toLote = d.to_lote_id ? loteById.get(d.to_lote_id)?.nome : null;
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

        const occurredOn = evento.occurred_at.slice(0, 10);
        const dateMatch =
          (!dateFrom || occurredOn >= dateFrom) && (!dateTo || occurredOn <= dateTo);
        const domainMatch = domainFilter === "all" || evento.dominio === domainFilter;
        const animalMatch = animalFilter === "all" || evento.animal_id === animalFilter;
        const loteMatch = loteFilter === "all" || evento.lote_id === loteFilter;
        const syncMatch = syncFilter === "all" || syncStatus === syncFilter;
        const searchMatch = !searchLower || textIndex.includes(searchLower);

        if (!dateMatch || !domainMatch || !animalMatch || !loteMatch || !syncMatch || !searchMatch) {
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
      .filter(Boolean)
      .sort((a, b) => {
        const aValue = a!.evento.occurred_at;
        const bValue = b!.evento.occurred_at;
        return bValue.localeCompare(aValue);
      }) as Array<{
      id: string;
      evento: (typeof data.eventos)[number];
      animalNome: string;
      loteNome: string;
      detail: string;
      amount: number | null;
      syncStatus: GestureStatus | "SYNCED";
    }>;

    return rows;
  }, [
    data,
    search,
    domainFilter,
    animalFilter,
    loteFilter,
    syncFilter,
    dateFrom,
    dateTo,
  ]);

  const animais = data?.animais ?? [];
  const lotes = data?.lotes ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Eventos</h1>
          <p className="text-sm text-muted-foreground">
            Timeline unificada por dominio com rastreio de sync.
          </p>
        </div>
        <Button onClick={() => navigate("/registrar")}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo Registro
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Busca</Label>
            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-3" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Produto, animal, lote..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dominio</Label>
            <Select
              value={domainFilter}
              onValueChange={(value) => setDomainFilter(value as "all" | DominioEnum)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sanitario">Sanitario</SelectItem>
                <SelectItem value="pesagem">Pesagem</SelectItem>
                <SelectItem value="movimentacao">Movimentacao</SelectItem>
                <SelectItem value="nutricao">Nutricao</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Animal</Label>
            <Select value={animalFilter} onValueChange={setAnimalFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {animais.map((animal) => (
                  <SelectItem key={animal.id} value={animal.id}>
                    {animal.identificacao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Lote</Label>
            <Select value={loteFilter} onValueChange={setLoteFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {lotes.map((lote) => (
                  <SelectItem key={lote.id} value={lote.id}>
                    {lote.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sync</Label>
            <Select
              value={syncFilter}
              onValueChange={(value) => setSyncFilter(value as SyncFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="SYNCED">Sincronizado</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="SYNCING">Sincronizando</SelectItem>
                <SelectItem value="ERROR">Erro</SelectItem>
                <SelectItem value="REJECTED">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data de</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Data ate</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
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
              <RefreshCw className="mr-2 h-4 w-4" />
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        {timeline.length} evento(s) encontrado(s)
      </div>

      {timeline.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Nenhum evento encontrado</p>
            <p className="text-sm text-muted-foreground">
              Ajuste os filtros ou registre um novo evento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {timeline.map((row) => {
            const isHighlighted = highlightedEventId === row.id;

            return (
              <Card
                key={row.id}
                className={isHighlighted ? "ring-2 ring-primary border-primary/40" : ""}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {DOMAIN_LABEL[row.evento.dominio]}
                      </div>
                      <div className="text-sm text-muted-foreground">{row.detail}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{toDateTime(row.evento.occurred_at)}</Badge>
                      <Badge variant="outline">{row.animalNome}</Badge>
                      <Badge variant="outline">{row.loteNome}</Badge>
                      <Badge className={statusBadgeClass(row.syncStatus)}>
                        {STATUS_LABEL[row.syncStatus]}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div className="text-muted-foreground">
                      Evento ID: <span className="font-mono">{row.id.slice(0, 8)}</span>
                    </div>
                    {row.amount != null && (
                      <div className="font-semibold">{toCurrency(row.amount)}</div>
                    )}
                  </div>

                  {row.evento.source_task_id && (
                    <div className="text-xs text-muted-foreground">
                      Vinculado a agenda:{" "}
                      <span className="font-mono">{row.evento.source_task_id.slice(0, 8)}</span>
                    </div>
                  )}
                  {row.evento.corrige_evento_id && (
                    <div className="text-xs text-muted-foreground">
                      Complementa evento:{" "}
                      <span className="font-mono">{row.evento.corrige_evento_id.slice(0, 8)}</span>
                    </div>
                  )}

                  <div className="pt-1">
                    {row.evento.dominio === "reproducao" ? (
                      <p className="text-xs text-muted-foreground">
                        Complemento ainda nao suportado para reproducao.
                      </p>
                    ) : complementTargetId === row.id ? (
                      <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                        <Label htmlFor={`complemento-${row.id}`}>
                          Complemento do evento
                        </Label>
                        <Textarea
                          id={`complemento-${row.id}`}
                          placeholder="Descreva informacoes adicionais deste evento..."
                          value={complementText}
                          onChange={(e) => setComplementText(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveComplement(row.evento)}
                            disabled={isSavingComplement}
                          >
                            {isSavingComplement ? "Salvando..." : "Salvar complemento"}
                          </Button>
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
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setComplementTargetId(row.id);
                          setComplementText("");
                        }}
                      >
                        Adicionar complemento
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Eventos;
