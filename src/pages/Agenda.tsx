import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Filter,
  Plus,
  Search,
  XCircle,
  ClipboardCheck,
} from "lucide-react";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { pullDataForFarm } from "@/lib/offline/pull";
import { useAuth } from "@/hooks/useAuth";
import { concluirPendenciaSanitaria } from "@/lib/sanitario/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import type { AgendaItem, Animal, Lote, SanitarioTipoEnum } from "@/lib/offline/types";

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

function statusClass(status: string) {
  if (status === "cancelado") return "bg-red-100 text-red-700 border-red-200";
  if (status === "concluido") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
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

const Agenda = () => {
  const navigate = useNavigate();
  const { activeFarmId } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "agendado" | "concluido" | "cancelado">(
    "all",
  );
  const [dominioFilter, setDominioFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("animal");

  useEffect(() => {
    if (!activeFarmId) return;

    pullDataForFarm(activeFarmId, ["agenda_itens", "animais", "lotes"], { mode: "merge" }).catch((error) => {
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
        itens: itens.filter((i) => !i.deleted_at),
        animais: animais.filter((a) => !a.deleted_at),
        lotes: lotes.filter((l) => !l.deleted_at),
        gestos,
      };
    },
    [activeFarmId],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const animalById = new Map(data.animais.map((a) => [a.id, a]));
    const loteById = new Map(data.lotes.map((l) => [l.id, l]));
    const gestoByTx = new Map(data.gestos.map((g) => [g.client_tx_id, g.status]));
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
      .sort((a, b) => a!.item.data_prevista.localeCompare(b!.item.data_prevista))
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
        rows: [...group.rows].sort((a, b) => a.item.data_prevista.localeCompare(b.item.data_prevista)),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
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
        if (row.item.data_prevista < current.earliestDate) current.earliestDate = row.item.data_prevista;
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
        rows: [...group.rows].sort((a, b) => a.item.data_prevista.localeCompare(b.item.data_prevista)),
      }))
      .sort((a, b) => a.earliestDate.localeCompare(b.earliestDate));
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
    const params = new URLSearchParams();
    params.set("sourceTaskId", item.id);
    params.set("dominio", item.dominio);
    if (item.animal_id) params.set("animalId", item.animal_id);
    if (item.lote_id) params.set("loteId", item.lote_id);

    const protocoloId = readString(item.source_ref, "protocolo_id");
    const protocoloItemId =
      readString(item.source_ref, "protocolo_item_id") ?? item.protocol_item_version_id;
    const produto = readString(item.source_ref, "produto") ?? readString(item.payload, "produto");
    const sanitarioTipo = asSanitarioTipo(readString(item.source_ref, "tipo"));

    if (protocoloId) params.set("protocoloId", protocoloId);
    if (protocoloItemId) params.set("protocoloItemId", protocoloItemId);
    if (produto) params.set("produto", produto);
    if (sanitarioTipo) params.set("sanitarioTipo", sanitarioTipo);

    navigate(`/registrar?${params.toString()}`);
  };

  const renderGenericRow = (row: AgendaRow) => {
    const { item } = row;

    return (
      <div key={item.id} className="rounded-md border p-3 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold capitalize">{item.tipo.replaceAll("_", " ")}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(`${item.data_prevista}T00:00:00`).toLocaleDateString("pt-BR")} -{" "}
              {row.animalNome} ({row.idadeLabel}) - {row.loteNome}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{DOMAIN_LABEL[item.dominio] ?? item.dominio}</Badge>
            <Badge className={statusClass(item.status)}>
              {STATUS_LABEL[item.status] ?? item.status}
            </Badge>
            <Badge variant="outline">{item.source_kind}</Badge>
            <Badge variant="outline">{row.syncStatus}</Badge>
          </div>
        </div>

        <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
          <span>
            Produto: <span className="font-mono">{row.produtoLabel}</span>
          </span>
          {item.source_evento_id && (
            <span>
              Evento: <span className="font-mono">{item.source_evento_id.slice(0, 8)}</span>
            </span>
          )}
          {item.protocol_item_version_id && (
            <span>
              Protocolo: <span className="font-mono">{item.protocol_item_version_id.slice(0, 8)}</span>
            </span>
          )}
          {item.dedup_key && (
            <span>
              Dedup: <span className="font-mono">{item.dedup_key.slice(0, 12)}</span>
            </span>
          )}
        </div>

        {item.status === "agendado" && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => goToRegistrar(item)}>
              Registrar Evento
            </Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus(item, "concluido")}>
              Concluir
            </Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus(item, "cancelado")}>
              Cancelar
            </Button>
            {item.source_evento_id && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(`/eventos?eventoId=${item.source_evento_id}`)}
              >
                Ver Evento
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!data || data.itens.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Agenda de Manejo</h1>
          <Button size="sm" onClick={() => navigate("/registrar")}>
            <Plus className="h-4 w-4 mr-2" /> Novo Item
          </Button>
        </div>
        <EmptyState
          icon={Calendar}
          title="Agenda vazia"
          description="Sua agenda de manejo esta vazia. Registre eventos para gerar novas tarefas."
          action={{
            label: "Registrar Atividade",
            onClick: () => navigate("/registrar"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agenda de Manejo</h1>
          <p className="text-sm text-muted-foreground">
            Itens manuais e automaticos vinculados ao fluxo de eventos.
          </p>
        </div>
        <Button size="sm" onClick={() => navigate("/registrar")}>
          <Plus className="h-4 w-4 mr-2" /> Registrar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Agendados</p>
              <p className="text-2xl font-bold">{counts.agendado}</p>
            </div>
            <Calendar className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Concluidos</p>
              <p className="text-2xl font-bold">{counts.concluido}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Cancelados</p>
              <p className="text-2xl font-bold">{counts.cancelado}</p>
            </div>
            <XCircle className="h-5 w-5 text-red-500" />
          </CardContent>
        </Card>
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
                className="pl-9"
                placeholder="Tipo, animal, lote..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "all" | "agendado" | "concluido" | "cancelado")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="agendado">Agendado</SelectItem>
                <SelectItem value="concluido">Concluido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dominio</Label>
            <Select value={dominioFilter} onValueChange={setDominioFilter}>
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
            <Label>Data de</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Data ate</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Agrupar por</Label>
            <Select value={groupMode} onValueChange={(v) => setGroupMode(v as GroupMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="animal">Animal</SelectItem>
                <SelectItem value="evento">Evento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
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
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
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
                  readString(group.animal?.payload, "categoria_produtiva")
                  ?? readString(group.animal?.payload, "categoria")
                  ?? "N/D";
                const sexoLabel =
                  group.animal?.sexo === "M"
                    ? "Macho"
                    : group.animal?.sexo === "F"
                      ? "Femea"
                      : "N/D";
                const raca = group.animal?.raca ?? "N/D";
                const lote = group.rows[0]?.loteNome ?? "Sem lote";
                const idade = group.rows[0]?.idadeLabel ?? "idade n/d";

                return (
                  <Card key={group.key}>
                    <CardHeader className="pb-3 space-y-2">
                      <div className="grid gap-2 md:grid-cols-3 text-sm">
                        <span>
                          Identificacao: <span className="font-medium">{group.title}</span>
                        </span>
                        <span>
                          Sexo: <span className="font-medium">{sexoLabel}</span>
                        </span>
                        <span>
                          Raca: <span className="font-medium">{raca}</span>
                        </span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-3 text-sm">
                        <span>
                          Idade: <span className="font-medium">{idade}</span>
                        </span>
                        <span>
                          Lote: <span className="font-medium">{lote}</span>
                        </span>
                        <span>
                          Classificacao zootecnica: <span className="font-medium">{categoriaZootecnica}</span>
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{group.rows.length} pendencia(s)</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {group.rows.map((row) => {
                        const periodicidade =
                          row.item.interval_days_applied && row.item.interval_days_applied > 0
                            ? `${row.item.interval_days_applied} dias`
                            : "Dose unica";
                        const indicacao =
                          readString(row.item.source_ref, "indicacao")
                          ?? (readNumber(row.item.source_ref, "dose_num")
                            ? `Dose ${readNumber(row.item.source_ref, "dose_num")}`
                            : "Aplicacao conforme protocolo");

                        return (
                          <div key={row.item.id} className="rounded-md border p-3 space-y-3">
                            <div className="grid gap-2 md:grid-cols-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Nome da Vacina: </span>
                                <span className="font-medium">{row.produtoLabel}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Periodicidade: </span>
                                <span className="font-medium">{periodicidade}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Indicacao: </span>
                                <span className="font-medium">{indicacao}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Data prevista: </span>
                                <span className="font-medium">
                                  {new Date(`${row.item.data_prevista}T00:00:00`).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{DOMAIN_LABEL[row.item.dominio] ?? row.item.dominio}</Badge>
                              <Badge className={statusClass(row.item.status)}>
                                {STATUS_LABEL[row.item.status] ?? row.item.status}
                              </Badge>
                              <Badge variant="outline">{row.syncStatus}</Badge>
                              {row.item.protocol_item_version_id && (
                                <Badge variant="outline">
                                  Protocolo {row.item.protocol_item_version_id.slice(0, 8)}
                                </Badge>
                              )}
                            </div>

                            {row.item.status === "agendado" && (
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" onClick={() => goToRegistrar(row.item)}>
                                  Registrar Evento
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateStatus(row.item, "concluido")}
                                >
                                  Concluir
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateStatus(row.item, "cancelado")}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
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
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{group.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {group.subtitle} | {uniqueAnimals} animal(is) | {group.rows.length} pendencia(s)
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {group.rows.map(renderGenericRow)}
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      )}
    </div>
  );
};

export default Agenda;
