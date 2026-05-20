import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import {
  BadgeDollarSign,
  AlertTriangle,
  Handshake,
  PlusCircle,
  Receipt,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { db } from "@/lib/offline/db";
import { useAuth } from "@/hooks/useAuth";
import {
  buildRegulatoryOperationalReadModel,
  EMPTY_REGULATORY_OPERATIONAL_READ_MODEL,
  loadRegulatorySurfaceSource,
} from "@/lib/sanitario/compliance/regulatoryReadModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function toDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const Financeiro = () => {
  const navigate = useNavigate();
  const { activeFarmId } = useAuth();

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<
    "all" | "compra" | "venda" | "sociedade"
  >("all");
  const [contraparteFilter, setContraparteFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const regulatoryReadModel =
    useLiveQuery(async () => {
      if (!activeFarmId) return EMPTY_REGULATORY_OPERATIONAL_READ_MODEL;
      return buildRegulatoryOperationalReadModel(
        await loadRegulatorySurfaceSource(activeFarmId),
      );
    }, [activeFarmId]) || EMPTY_REGULATORY_OPERATIONAL_READ_MODEL;
  const saleCompliance = regulatoryReadModel.flows.sale;
  const saleBlockingMessage =
    saleCompliance.firstBlockerMessage ?? saleCompliance.firstWarningMessage;

  const data = useLiveQuery(async () => {
    if (!activeFarmId) {
      return {
        eventosBase: [],
        detalhes: [],
        contrapartes: [],
        animais: [],
        lotes: [],
      };
    }

    const [eventosBase, detalhes, contrapartes, animais, lotes] =
      await Promise.all([
        db.event_eventos.where("fazenda_id").equals(activeFarmId).toArray(),
        db.event_eventos_financeiro
          .where("fazenda_id")
          .equals(activeFarmId)
          .toArray(),
        db.state_contrapartes
          .where("fazenda_id")
          .equals(activeFarmId)
          .toArray(),
        db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
      ]);

    return {
      eventosBase: eventosBase.filter(
        (e) => e.dominio === "financeiro" && !e.deleted_at,
      ),
      detalhes: detalhes.filter((d) => !d.deleted_at),
      contrapartes: contrapartes.filter((c) => !c.deleted_at),
      animais: animais.filter((a) => !a.deleted_at),
      lotes: lotes.filter((l) => !l.deleted_at),
    };
  }, [activeFarmId]);

  const rows = useMemo(() => {
    if (!data) return [];

    const eventoById = new Map(data.eventosBase.map((e) => [e.id, e]));
    const contraparteById = new Map(data.contrapartes.map((c) => [c.id, c]));
    const animalById = new Map(data.animais.map((a) => [a.id, a]));
    const loteById = new Map(data.lotes.map((l) => [l.id, l]));
    const searchLower = search.trim().toLowerCase();

    return data.detalhes
      .map((detalhe) => {
        const evento = eventoById.get(detalhe.evento_id);
        if (!evento) return null;

        const contraparte = detalhe.contraparte_id
          ? contraparteById.get(detalhe.contraparte_id)
          : null;
        const animal = evento.animal_id
          ? animalById.get(evento.animal_id)
          : null;
        const lote = evento.lote_id ? loteById.get(evento.lote_id) : null;
        const occurredOn = evento.occurred_at.slice(0, 10);

        const payloadKind =
          evento.payload && typeof evento.payload.kind === "string"
            ? (evento.payload.kind as string)
            : "";
        const quantidadeAnimais =
          evento.payload &&
          typeof evento.payload.quantidade_animais === "number"
            ? (evento.payload.quantidade_animais as number)
            : animal
              ? 1
              : 0;
        const isSociedade = payloadKind.startsWith("sociedade_");
        const isDoacao =
          payloadKind === "doacao_entrada" || payloadKind === "doacao_saida";
        const isArrendamento = payloadKind === "arrendamento";
        let naturezaLabel = detalhe.tipo === "compra" ? "Compra" : "Venda";
        if (isSociedade) {
          naturezaLabel =
            payloadKind === "sociedade_entrada"
              ? "Sociedade (Entrada)"
              : payloadKind === "sociedade_saida"
                ? "Sociedade (Saida)"
                : "Sociedade";
        } else if (isDoacao) {
          naturezaLabel = "Doacao";
        } else if (isArrendamento) {
          naturezaLabel = "Arrendamento";
        }

        const tipoMatch =
          tipoFilter === "all"
            ? true
            : tipoFilter === "sociedade"
              ? isSociedade
              : detalhe.tipo === tipoFilter && !isSociedade;
        const contraparteMatch =
          contraparteFilter === "all" ||
          detalhe.contraparte_id === contraparteFilter;
        const dateMatch =
          (!dateFrom || occurredOn >= dateFrom) &&
          (!dateTo || occurredOn <= dateTo);

        const textIndex = [
          detalhe.tipo,
          naturezaLabel,
          payloadKind,
          contraparte?.nome ?? "",
          animal?.identificacao ?? "",
          lote?.nome ?? "",
          evento.observacoes ?? "",
        ]
          .join(" ")
          .toLowerCase();
        const searchMatch = !searchLower || textIndex.includes(searchLower);

        if (!tipoMatch || !contraparteMatch || !dateMatch || !searchMatch)
          return null;

        return {
          id: detalhe.evento_id,
          tipo: detalhe.tipo,
          valorTotal: Number(detalhe.valor_total),
          contraparteNome: contraparte?.nome ?? "Sem contraparte",
          animalNome: animal?.identificacao ?? "Sem animal",
          loteNome: lote?.nome ?? "Sem lote",
          naturezaLabel,
          isSociedade,
          quantidadeAnimais,
          occurredAt: evento.occurred_at,
          sourceTaskId: evento.source_task_id,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.occurredAt.localeCompare(a!.occurredAt)) as Array<{
      id: string;
      tipo: "compra" | "venda";
      valorTotal: number;
      contraparteNome: string;
      animalNome: string;
      loteNome: string;
      naturezaLabel: string;
      isSociedade: boolean;
      quantidadeAnimais: number;
      occurredAt: string;
      sourceTaskId: string | null;
    }>;
  }, [data, search, tipoFilter, contraparteFilter, dateFrom, dateTo]);

  const summary = useMemo(() => {
    let compras = 0;
    let vendas = 0;
    let sociedadeEntrada = 0;
    let sociedadeSaida = 0;
    for (const row of rows) {
      if (row.isSociedade) {
        if (row.tipo === "compra") sociedadeEntrada += row.valorTotal;
        if (row.tipo === "venda") sociedadeSaida += row.valorTotal;
        continue;
      }
      if (row.tipo === "compra") compras += row.valorTotal;
      if (row.tipo === "venda") vendas += row.valorTotal;
    }
    return {
      compras,
      vendas,
      saldo: vendas - compras,
      sociedadeEntrada,
      sociedadeSaida,
      saldoSociedade: sociedadeEntrada - sociedadeSaida,
    };
  }, [rows]);

  const contrapartes = data?.contrapartes ?? [];

  return (
    <div className="space-y-5">
      <PageIntro
        variant="plain"
        eyebrow="Gestao"
        title="Financeiro"
        meta={
          <>
            <StatusBadge tone="neutral">{rows.length} lancamento(s)</StatusBadge>
            {saleCompliance.blockerCount > 0 ? (
              <StatusBadge tone="danger">Venda bloqueada</StatusBadge>
            ) : saleCompliance.warningCount > 0 ? (
              <StatusBadge tone="warning">Venda exige revisao</StatusBadge>
            ) : null}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/contrapartes")}>
              <Handshake className="h-4 w-4" />
              Parceiros
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigate("/registrar?dominio=financeiro&natureza=compra")
              }
            >
              <PlusCircle className="h-4 w-4" />
              Nova compra
            </Button>
            <Button
              onClick={() =>
                navigate("/registrar?dominio=financeiro&natureza=venda")
              }
              disabled={saleCompliance.blockerCount > 0}
            >
              <PlusCircle className="h-4 w-4" />
              Nova venda
            </Button>
          </div>
        }
      />

      {regulatoryReadModel.attention.openCount > 0 ? (
        <Card className="border-warning/25 bg-warning-muted/50 shadow-none">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Venda e transito sob leitura regulatoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {regulatoryReadModel.attention.badges.map((badge) => (
                <StatusBadge key={badge.key} tone={badge.tone}>
                  {badge.label} {badge.count}
                </StatusBadge>
              ))}
              {saleCompliance.blockerCount > 0 ? (
                <StatusBadge tone="danger">Bloqueia nova venda</StatusBadge>
              ) : saleCompliance.warningCount > 0 ? (
                <StatusBadge tone="warning">
                  Exige revisao antes da venda
                </StatusBadge>
              ) : null}
            </div>
            {saleBlockingMessage ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {saleBlockingMessage}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/protocolos-sanitarios")}
              >
                Abrir conformidade
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  navigate("/registrar?dominio=financeiro&natureza=compra")
                }
              >
                Registrar compra
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="border-border/70 shadow-none">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-between text-xs font-medium uppercase text-muted-foreground">
              <span>Compras</span>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </p>
            <p className="text-2xl font-semibold tracking-tight">
              {money.format(summary.compras)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-none">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-between text-xs font-medium uppercase text-muted-foreground">
              <span>Vendas</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </p>
            <p className="text-2xl font-semibold tracking-tight">
              {money.format(summary.vendas)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-none">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-between text-xs font-medium uppercase text-muted-foreground">
              <span>Saldo</span>
              <BadgeDollarSign className="h-4 w-4 text-primary" />
            </p>
            <p
              className={`text-2xl font-semibold tracking-tight ${
                summary.saldo >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {money.format(summary.saldo)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-none">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-between text-xs font-medium uppercase text-muted-foreground">
              <span>Sociedade</span>
              <Handshake className="h-4 w-4 text-muted-foreground" />
            </p>
            <p
              className={`text-2xl font-semibold tracking-tight ${
                summary.saldoSociedade >= 0
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {money.format(summary.saldoSociedade)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Toolbar className="bg-muted/20 shadow-none">
        <ToolbarGroup className="flex-1 gap-2">
          <div className="relative min-w-[220px] flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Contraparte, animal, lote..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Select
            value={tipoFilter}
            onValueChange={(value) =>
              setTipoFilter(value as "all" | "compra" | "venda" | "sociedade")
            }
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="compra">Compra</SelectItem>
              <SelectItem value="venda">Venda</SelectItem>
              <SelectItem value="sociedade">Sociedade</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={contraparteFilter}
            onValueChange={setContraparteFilter}
          >
            <SelectTrigger className="w-full sm:w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {contrapartes.map((contraparte) => (
                <SelectItem key={contraparte.id} value={contraparte.id}>
                  {contraparte.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ToolbarGroup>

        <ToolbarGroup className="gap-2">
          <Input
            type="date"
            aria-label="Data inicial"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full sm:w-[150px]"
          />

          <Input
            type="date"
            aria-label="Data final"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full sm:w-[150px]"
          />

          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setTipoFilter("all");
              setContraparteFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Limpar filtros
          </Button>
        </ToolbarGroup>
      </Toolbar>

      {rows.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="p-10 text-center">
            <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Sem lancamentos no filtro atual</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-border/70 bg-background/95 p-4 shadow-none transition-colors hover:border-primary/25"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.contraparteNome}</p>
                    <Badge
                      className={
                        row.isSociedade
                          ? "border-violet-200 bg-violet-100 text-violet-700"
                          : row.tipo === "compra"
                            ? "border-red-200 bg-red-100 text-red-700"
                            : "border-emerald-200 bg-emerald-100 text-emerald-700"
                      }
                    >
                      {row.naturezaLabel}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.animalNome} - {row.loteNome}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {row.quantidadeAnimais > 1 ? (
                      <Badge variant="outline">
                        {row.quantidadeAnimais} animais
                      </Badge>
                    ) : null}
                    {row.sourceTaskId ? (
                      <Badge variant="outline">Agenda</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-lg font-semibold tracking-tight">
                    {money.format(row.valorTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {toDateTime(row.occurredAt)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default Financeiro;

