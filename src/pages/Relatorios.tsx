import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  Beef,
  CalendarClock,
  Download,
  FileText,
  PackageSearch,
  Printer,
  Receipt,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/offline/db";
import { triggerDownload } from "@/lib/offline/rejections";
import {
  buildOperationalSummary,
  buildOperationalSummaryCsv,
  buildOperationalSummaryPrintHtml,
  OPERATIONAL_REPORT_LIMITATIONS,
  OPERATIONAL_REPORT_SOURCE_NOTES,
  resolveReportRange,
  type ReportPreset,
} from "@/lib/reports/operationalSummary";
import { trackPilotMetric } from "@/lib/telemetry/pilotMetrics";
import { showError, showSuccess } from "@/utils/toast";
import { formatWeight } from "@/lib/format/weight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/ui/page-intro";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FarmSummary = {
  nome: string;
};

const PERIOD_OPTIONS: Array<{ value: ReportPreset; label: string }> = [
  { value: "7d", label: "Ultimos 7 dias" },
  { value: "30d", label: "Ultimos 30 dias" },
  { value: "90d", label: "Ultimos 90 dias" },
  { value: "mes_atual", label: "Mes atual" },
];

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(dateKey: string): string {
  return dateFormatter.format(new Date(`${dateKey}T00:00:00`));
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(value);
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 40);
}

const Relatorios = () => {
  const { activeFarmId, farmMeasurementConfig } = useAuth();
  const [farm, setFarm] = useState<FarmSummary | null>(null);
  const [preset, setPreset] = useState<ReportPreset>("30d");

  useEffect(() => {
    const loadFarm = async () => {
      if (!activeFarmId) {
        setFarm(null);
        return;
      }

      const { data, error } = await supabase
        .from("fazendas")
        .select("nome")
        .eq("id", activeFarmId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error || !data) {
        setFarm(null);
        return;
      }

      setFarm(data);
    };

    loadFarm();
  }, [activeFarmId]);

  const source = useLiveQuery(async () => {
    if (!activeFarmId) return null;

    const [
      animals,
      lotes,
      pastos,
      agenda,
      protocolosSanitarios,
      protocoloItensSanitarios,
      fazendaSanidadeConfig,
      catalogoProtocolosOficiais,
      catalogoProtocolosOficiaisItens,
      eventos,
      eventosPesagem,
      eventosSanitario,
      eventosFinanceiro,
      insumos,
      insumoApresentacoes,
      insumoLotes,
      insumoMovimentacoes,
      gestures,
      rejections,
    ] = await Promise.all([
      db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_pastos.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_agenda_itens.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_protocolos_sanitarios
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.state_protocolos_sanitarios_itens
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.state_fazenda_sanidade_config.get(activeFarmId),
      db.catalog_protocolos_oficiais.toArray(),
      db.catalog_protocolos_oficiais_itens.toArray(),
      db.event_eventos.where("fazenda_id").equals(activeFarmId).toArray(),
      db.event_eventos_pesagem
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.event_eventos_sanitario
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.event_eventos_financeiro
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.state_insumos.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_insumo_apresentacoes
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.state_insumo_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_insumo_movimentacoes
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.queue_gestures.where("fazenda_id").equals(activeFarmId).toArray(),
      db.queue_rejections.where("fazenda_id").equals(activeFarmId).toArray(),
    ]);

    return {
      animals,
      lotes,
      pastos,
      agenda,
      protocolosSanitarios,
      protocoloItensSanitarios,
      fazendaSanidadeConfig:
        fazendaSanidadeConfig && !fazendaSanidadeConfig.deleted_at
          ? fazendaSanidadeConfig
          : null,
      catalogoProtocolosOficiais,
      catalogoProtocolosOficiaisItens,
      eventos,
      eventosPesagem,
      eventosSanitario,
      eventosFinanceiro,
      insumos,
      insumoApresentacoes,
      insumoLotes,
      insumoMovimentacoes,
      gestures,
      rejections,
    };
  }, [activeFarmId]);

  const range = useMemo(() => resolveReportRange(preset), [preset]);

  const report = useMemo(() => {
    if (!source) return null;
    return buildOperationalSummary(source, range);
  }, [range, source]);

  const maxDomainCount = useMemo(() => {
    if (!report) return 1;
    return Math.max(...report.manejoByDomain.map((item) => item.value), 1);
  }, [report]);

  const handleExportCsv = () => {
    if (!report) return;

    const farmName = farm?.nome ?? "fazenda";
    const csv = buildOperationalSummaryCsv(report, farmName);
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const filename = `resumo_operacional_${slugify(farmName) || "fazenda"}_${report.range.filenameTag}_${report.range.to}.csv`;
    triggerDownload(blob, filename);
    void trackPilotMetric({
      fazendaId: activeFarmId,
      eventName: "report_exported",
      status: "success",
      route: "/relatorios",
      quantity: 1,
      payload: {
        period: report.range.preset,
        filename,
      },
    });
    showSuccess("Resumo exportado em CSV.");
  };

  const handlePrint = () => {
    if (!report) return;

    const farmName = farm?.nome ?? "Fazenda";
    const printWindow = window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=1024,height=720",
    );

    if (!printWindow) {
      showError("Nao foi possivel abrir a janela de impressao.");
      return;
    }

    printWindow.document.write(
      buildOperationalSummaryPrintHtml(report, farmName),
    );
    printWindow.document.close();
    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
    }, 200);

    void trackPilotMetric({
      fazendaId: activeFarmId,
      eventName: "report_printed",
      status: "success",
      route: "/relatorios",
      quantity: 1,
      payload: {
        period: report.range.preset,
      },
    });
  };

  if (!activeFarmId) {
    return (
      <div className="space-y-5">
        <PageIntro
          variant="plain"
          eyebrow="Resumo"
          title="Selecione uma fazenda"
          actions={
            <Button asChild>
              <Link to="/select-fazenda">Escolher fazenda</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Carregando resumo operacional</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageIntro
       variant="plain"
        title="Relatorios"
        description="Leituras derivadas de eventos, state_* e agenda. Indicadores parciais nao representam DRE, ROI, margem ou custo por arroba."
        meta={
          <>
            <StatusBadge tone="neutral">{farm?.nome ?? "Sua fazenda"}</StatusBadge>
            <StatusBadge tone="neutral">{report.range.label}</StatusBadge>
          </>
        }
        actions={
          <>
          <Select
            value={preset}
            onValueChange={(value) => setPreset(value as ReportPreset)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          {
            title: "Relatorio Sanitario",
            description: "Aplicacoes no periodo e cobertura por categoria.",
            source: "Fonte: eventos sanitarios",
            icon: FileText,
          },
          {
            title: "Pesagens",
            description: "Peso medio e ultima pesagem no periodo; GMD por lote/pasto exige permanencia comprovada.",
            source: "Fonte: eventos de pesagem",
            icon: Scale,
          },
          {
            title: "Movimentacao",
            description: "Movimentacoes executadas no periodo e estado atual apenas como read model.",
            source: "Fonte: eventos + state_*",
            icon: Beef,
          },
          {
            title: "Reproducao",
            description: "Estacao de monta, prenhez, partos e pos-parto.",
            source: "Fonte: eventos reprodutivos",
            icon: CalendarClock,
          },
          {
            title: "Financeiro operacional",
            description: "Receita, despesa e saldo informados no periodo; leitura parcial, nao DRE ou margem.",
            source: "Fonte: lancamentos financeiros",
            icon: Receipt,
          },
          {
            title: "Visao operacional",
            description: "Agenda aberta indica pendencia/intencao; eventos indicam fatos executados.",
            source: "Fonte: agenda + eventos",
            icon: RefreshCw,
          },
        ].map((item) => (
          <Card key={item.title} className="shadow-none">
            <CardContent className="flex min-h-[190px] flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-success-muted text-success">
                  <item.icon className="h-5 w-5" />
                </div>
                <StatusBadge tone="neutral">{item.source}</StatusBadge>
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" variant="outline">
                  Visualizar
                </Button>
                <Button size="sm" variant="ghost" onClick={handleExportCsv}>
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Resumo operacional
            </p>
            <h2 className="text-xl font-semibold">{farm?.nome ?? "Sua fazenda"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(report.range.from)} a {formatDate(report.range.to)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-between text-sm font-medium text-muted-foreground">
              Rebanho ativo
              <Beef className="h-4 w-4" />
            </p>
            <div className="text-3xl font-bold">
              {report.summary.animaisAtivos}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{report.summary.lotesAtivos} lotes</Badge>
              <Badge variant="outline">
                {report.summary.pastosAtivos} pastos
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Estado atual vindo de state_*; nao substitui historico completo.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-between text-sm font-medium text-muted-foreground">
              Agenda aberta
              <CalendarClock className="h-4 w-4" />
            </p>
            <div className="text-3xl font-bold">
              {report.summary.agendaAberta}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{report.summary.agendaHoje} hoje</Badge>
              {report.summary.agendaAtrasada > 0 ? (
                <Badge variant="destructive">
                  {report.summary.agendaAtrasada} atrasadas
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Agenda e pendencia/intencao futura, nao fato executado.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-between text-sm font-medium text-muted-foreground">
              Saldo no periodo
              <Receipt className="h-4 w-4" />
            </p>
            <div
              className={`text-3xl font-bold ${
                report.financeiro.saldo >= 0
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {money.format(report.financeiro.saldo)}
            </div>
            <div className="mt-3">
              <Badge variant="outline">
                {report.financeiro.transacoes} transacoes
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Leitura operacional parcial; nao e DRE, ROI ou margem.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center justify-between text-sm font-medium text-muted-foreground">
              Envio
              <RefreshCw className="h-4 w-4" />
            </p>
            <div className="text-3xl font-bold">
              {report.summary.pendenciasSync}
            </div>
            {report.summary.errosSync > 0 ? (
              <div className="mt-3">
                <Badge variant="destructive">
                  {report.summary.errosSync} para revisar
                </Badge>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="shadow-none">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <CardTitle className="text-base">Fontes e limitacoes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {[...OPERATIONAL_REPORT_SOURCE_NOTES, ...OPERATIONAL_REPORT_LIMITATIONS].map((item) => (
              <p key={item}>{item}</p>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="shadow-none">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <CardTitle className="text-base">Manejos no periodo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.manejoByDomain.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">{item.value}</span>
                </div>
                <Progress value={(item.value / maxDomainCount) * 100} />
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              {report.summary.eventosPeriodo} evento(s) registrados no total.
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <CardTitle className="text-base">Financeiro e pesagem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Entradas
                </div>
                <p className="mt-2 text-2xl font-semibold">
                  {money.format(report.financeiro.entradas)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {report.financeiro.vendas} venda(s)
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  Saidas
                </div>
                <p className="mt-2 text-2xl font-semibold">
                  {money.format(report.financeiro.saidas)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {report.financeiro.compras} compra(s)
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Scale className="h-4 w-4" />
                Pesagem no periodo
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {report.pesagem.pesoMedioKg == null
                  ? "Sem dados"
                  : formatWeight(
                      report.pesagem.pesoMedioKg,
                      farmMeasurementConfig.weight_unit,
                    )}
              </p>
              <p className="text-sm text-muted-foreground">
                {report.pesagem.totalPesagens} pesagem(ns)
                {report.pesagem.ultimaPesagemEm
                  ? ` | ultima em ${formatDate(report.pesagem.ultimaPesagemEm)}`
                  : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="shadow-none">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <PackageSearch className="h-4 w-4" />
                Estoque operacional
              </CardTitle>
              <StatusBadge tone="neutral">
                Fonte: inventario de insumos
              </StatusBadge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Insumos ativos</p>
                <p className="mt-2 text-2xl font-semibold">
                  {report.inventory.itensAtivos}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Lotes ativos</p>
                <p className="mt-2 text-2xl font-semibold">
                  {report.inventory.lotesAtivos}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Entradas no periodo
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">
                  +{formatQuantity(report.inventory.entradasPeriodo)}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Saidas no periodo
                </p>
                <p className="mt-2 text-2xl font-semibold text-red-700">
                  -{formatQuantity(report.inventory.saidasPeriodo)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Parametrizados
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {report.inventory.resupplyConfiguredItems}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Ressuprir</p>
                <p className="mt-2 text-2xl font-semibold text-amber-700">
                  {report.inventory.resupplyWarningItems}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Abaixo do minimo
                </p>
                <p className="mt-2 text-2xl font-semibold text-red-700">
                  {report.inventory.resupplyCriticalItems}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">
                    Custo operacional parcial
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Leitura derivada do inventario e dos snapshots de movimentacao.
                  </p>
                </div>
                <StatusBadge tone="neutral">
                  Fonte: read model de inventario
                </StatusBadge>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border/70 bg-background p-3">
                  <p className="text-xs text-muted-foreground">
                    Entradas com custo
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {money.format(report.inventory.partialCost.entradasKnownCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatQuantity(
                      report.inventory.partialCost.entradasKnownQuantity,
                    )}{" "}
                    un. base
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background p-3">
                  <p className="text-xs text-muted-foreground">
                    Saidas/consumos com custo
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {money.format(report.inventory.partialCost.saidasKnownCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatQuantity(
                      report.inventory.partialCost.saidasKnownQuantity,
                    )}{" "}
                    un. base
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background p-3">
                  <p className="text-xs text-muted-foreground">
                    Saldo economico conhecido
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {money.format(report.inventory.partialCost.saldoKnownCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {
                      report.inventory.partialCost.activeLotsWithKnownCost
                    }{" "}
                    lote(s)
                  </p>
                </div>
              </div>

              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-lg border border-dashed border-border/70 bg-background p-3">
                  <p className="font-medium">Entradas sem custo</p>
                  <p className="text-muted-foreground">
                    {report.inventory.partialCost.entradasMissingCostMovements}{" "}
                    movimentacao(oes) |{" "}
                    {formatQuantity(
                      report.inventory.partialCost.entradasMissingCostQuantity,
                    )}{" "}
                    un. base
                  </p>
                </div>
                <div className="rounded-lg border border-dashed border-border/70 bg-background p-3">
                  <p className="font-medium">Saidas sem custo</p>
                  <p className="text-muted-foreground">
                    {report.inventory.partialCost.saidasMissingCostMovements}{" "}
                    movimentacao(oes) |{" "}
                    {formatQuantity(
                      report.inventory.partialCost.saidasMissingCostQuantity,
                    )}{" "}
                    un. base
                  </p>
                </div>
                <div className="rounded-lg border border-dashed border-border/70 bg-background p-3">
                  <p className="font-medium">Saldo sem custo</p>
                  <p className="text-muted-foreground">
                    {report.inventory.partialCost.activeLotsWithMissingCost}{" "}
                    lote(s) |{" "}
                    {formatQuantity(
                      report.inventory.partialCost.saldoMissingCostQuantity,
                    )}{" "}
                    un. base
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">
                    Pre-requisitos da fase 3
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Produto catalogado, mapeamento para insumo/lote e uso do consumo assistido.
                  </p>
                </div>
                <StatusBadge
                  tone={
                    report.inventory.sanitaryPhase3Prerequisites.readyForAutoReview
                      ? "success"
                      : "warning"
                  }
                >
                  {report.inventory.sanitaryPhase3Prerequisites.readyForAutoReview
                    ? "Apto para revisao"
                    : "Coletando evidencias"}
                </StatusBadge>
              </div>

              <div className="grid gap-3 sm:grid-cols-5">
                <div className="rounded-lg border border-border/70 bg-background p-3">
                  <p className="text-xs text-muted-foreground">
                    Eventos sanitarios
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {report.inventory.sanitaryPhase3Prerequisites.sanitaryEvents}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background p-3">
                  <p className="text-xs text-muted-foreground">
                    Produto catalogado
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {report.inventory.sanitaryPhase3Prerequisites.catalogLinkedEvents}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background p-3">
                  <p className="text-xs text-muted-foreground">
                    Produto mapeado
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {
                      report.inventory.sanitaryPhase3Prerequisites
                        .reliablyMappedCatalogProducts
                    }
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background p-3">
                  <p className="text-xs text-muted-foreground">
                    Apresentacao ok
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {
                      report.inventory.sanitaryPhase3Prerequisites
                        .presentationMappedCatalogProducts
                    }
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background p-3">
                  <p className="text-xs text-muted-foreground">
                    Consumo assistido
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {
                      report.inventory.sanitaryPhase3Prerequisites
                        .assistedConsumptionEvents
                    }
                    {report.inventory.sanitaryPhase3Prerequisites
                      .assistedConsumptionCoveragePct == null
                      ? ""
                      : ` (${report.inventory.sanitaryPhase3Prerequisites.assistedConsumptionCoveragePct}%)`}
                  </p>
                </div>
              </div>

              {report.inventory.sanitaryPhase3Prerequisites
                .unmappedCatalogProducts > 0 ? (
                <p className="text-sm text-amber-700">
                  {
                    report.inventory.sanitaryPhase3Prerequisites
                      .unmappedCatalogProducts
                  }{" "}
                  produto(s) catalogado(s) ainda sem mapeamento confiavel para
                  insumo sanitario com lote ativo.
                </p>
              ) : null}
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">
                    Alertas de reposicao
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Saldo atual, parametros de ressuprimento e demanda futura.
                  </p>
                </div>
                <StatusBadge
                  tone={
                    report.inventory.replenishmentAlerts.some(
                      (item) => item.severity === "critical",
                    )
                      ? "danger"
                      : report.inventory.replenishmentAlerts.length > 0
                        ? "warning"
                        : "success"
                  }
                >
                  {report.inventory.replenishmentAlerts.length} alerta(s)
                </StatusBadge>
              </div>

              {report.inventory.replenishmentAlerts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-background p-3 text-sm text-muted-foreground">
                  Sem alerta operacional de reposicao.
                </div>
              ) : (
                <div className="space-y-2">
                  {report.inventory.replenishmentAlerts.slice(0, 6).map((item) => (
                    <div
                      key={item.insumoId}
                      className="grid gap-3 rounded-lg border border-border/70 bg-background p-3 md:grid-cols-[1.1fr_0.7fr_0.7fr_1fr]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.insumo}</p>
                          <Badge
                            variant={
                              item.severity === "critical"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {item.severity === "critical"
                              ? "Critico"
                              : "Atencao"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.categoria} · {item.tipo}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className="font-semibold">
                          {formatQuantity(item.currentBalanceBase)}{" "}
                          {item.unidadeBase}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Demanda futura
                        </p>
                        <p className="font-semibold">
                          {item.futureDemandBase == null
                            ? "Sem demanda"
                            : `${formatQuantity(item.futureDemandBase)} ${item.unidadeBase}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Motivo</p>
                        <p className="text-sm font-medium">
                          {item.reasons.join(" + ")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {report.inventory.categorias.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                Nenhum item de estoque cadastrado.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {report.inventory.categorias.map((category) => (
                  <div
                    key={category.categoria}
                    className="rounded-xl border border-border/70 bg-muted/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{category.categoria}</p>
                        <p className="text-sm text-muted-foreground">
                          {category.itens} item(ns) · {category.lotes} lote(s)
                        </p>
                      </div>
                      <StatusBadge tone="neutral">
                        Saldo {formatQuantity(category.saldo)}
                      </StatusBadge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <span className="text-emerald-700">
                        +{formatQuantity(category.entradas)} entrada(s)
                      </span>
                      <span className="text-red-700">
                        -{formatQuantity(category.saidas)} saida(s)
                      </span>
                      <span className="text-amber-700">
                        {category.resupplyWarningCount} ressuprir
                      </span>
                      <span className="text-red-700">
                        {category.resupplyCriticalCount} abaixo minimo
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">
                    Demanda futura por agenda valida
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Proximos {report.inventory.futureDemand.horizonDays} dias,
                    com base em agenda sanitaria aberta.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    tone={
                      report.inventory.futureDemand.status === "complete"
                        ? "success"
                        : report.inventory.futureDemand.status === "partial"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {report.inventory.futureDemand.status === "complete"
                      ? "Completo"
                      : report.inventory.futureDemand.status === "partial"
                        ? "Parcial"
                        : "Sem demanda"}
                  </StatusBadge>
                  {report.inventory.futureDemand.missingProductCount > 0 ? (
                    <Badge variant="secondary">
                      {report.inventory.futureDemand.missingProductCount} sem
                      produto
                    </Badge>
                  ) : null}
                  {report.inventory.futureDemand.missingQuantityCount > 0 ? (
                    <Badge variant="secondary">
                      {report.inventory.futureDemand.missingQuantityCount} sem
                      quantidade
                    </Badge>
                  ) : null}
                </div>
              </div>

              {report.inventory.futureDemand.groups.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-background p-3 text-sm text-muted-foreground">
                  Sem demanda futura calculavel nos proximos{" "}
                  {report.inventory.futureDemand.horizonDays} dias.
                </div>
              ) : (
                <div className="space-y-2">
                  {report.inventory.futureDemand.groups.slice(0, 6).map((item) => (
                    <div
                      key={item.productKey}
                      className="grid gap-3 rounded-lg border border-border/70 bg-background p-3 md:grid-cols-[1.3fr_0.7fr_0.7fr_0.7fr]"
                    >
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.agendaItemCount} agenda(s) · {item.animalCount}{" "}
                          animal(is)
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Demanda
                        </p>
                        <p className="font-semibold">
                          {item.estimatedQuantity == null
                            ? "Sem quantidade"
                            : `${formatQuantity(item.estimatedQuantity)} ${item.productUnit}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className="font-semibold">
                          {formatQuantity(item.availableBalance)}{" "}
                          {item.productUnit}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Gap</p>
                        <Badge
                          variant={
                            item.balanceGap != null && item.balanceGap > 0
                              ? "destructive"
                              : "outline"
                          }
                        >
                          {item.balanceGap == null
                            ? "Sem quantidade"
                            : formatQuantity(item.balanceGap)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {report.inventory.items.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-base font-semibold">Itens e lotes</h3>
                <div className="space-y-2">
                  {report.inventory.items.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-3 rounded-xl border border-border/70 bg-background p-4 md:grid-cols-[1.2fr_0.65fr_0.65fr_0.8fr]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.insumo}</p>
                          <Badge variant="outline">{item.categoria}</Badge>
                          <Badge variant="outline">{item.tipo}</Badge>
                          {item.resupplyStatus !== "unconfigured" ? (
                            <Badge
                              variant={
                                item.resupplyStatus === "critical"
                                  ? "destructive"
                                  : item.resupplyStatus === "warning"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {item.resupplyStatus === "critical"
                                ? "Abaixo minimo"
                                : item.resupplyStatus === "warning"
                                  ? "Ressuprir"
                                  : "Adequado"}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.lote} · {item.apresentacao}
                          {item.local ? ` · ${item.local}` : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className="font-semibold">
                          {formatQuantity(item.saldo)} {item.unidadeBase}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Periodo
                        </p>
                        <p className="font-semibold">
                          <span className="text-emerald-700">
                            +{formatQuantity(item.entradas)}
                          </span>{" "}
                          <span className="text-red-700">
                            -{formatQuantity(item.saidas)}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Ressuprimento
                        </p>
                        <p className="font-semibold">
                          {item.resupplyStatus === "unconfigured"
                            ? "Sem parametro"
                            : item.resupplyGap == null
                              ? "Sem gap"
                              : formatQuantity(item.resupplyGap)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {report.regulatoryCompliance.openCount > 0 ? (
        <section>
          <Card className="shadow-none">
            <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
              <CardTitle className="text-base">
                Conformidade regulatoria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {report.regulatoryCompliance.badges.map((badge) => (
                  <Badge
                    key={badge.key}
                    variant={
                      badge.tone === "danger"
                        ? "destructive"
                        : badge.tone === "warning"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {badge.label} {badge.count}
                  </Badge>
                ))}
                {report.regulatoryCompliance.nutritionBlockers > 0 ? (
                  <Badge variant="destructive">Bloqueia nutricao</Badge>
                ) : null}
                {report.regulatoryCompliance.saleBlockers > 0 ? (
                  <Badge variant="destructive">Bloqueia venda/transito</Badge>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">
                    Pendencias abertas
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {report.regulatoryCompliance.openCount}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">
                    Bloqueios ativos
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {report.regulatoryCompliance.blockingCount}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">
                    Venda/transito
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {report.regulatoryCompliance.saleBlockers}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {report.regulatoryCompliance.topItems.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-xl border border-border/70 bg-muted/20 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.label}</p>
                      <Badge
                        variant={
                          item.tone === "danger"
                            ? "destructive"
                            : item.tone === "warning"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {item.statusLabel}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.recommendation}
                    </p>
                  </div>
                ))}
              </div>

              {report.regulatoryCompliance.subareas.length > 0 ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold">
                      Recortes analiticos por subarea
                    </h3>
                  </div>
                  {report.regulatoryCompliance.subareas.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-xl border border-border/70 bg-muted/20 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{item.label}</p>
                            <Badge
                              variant={
                                item.tone === "danger"
                                  ? "destructive"
                                  : item.tone === "warning"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {item.openCount} pendencia(s)
                            </Badge>
                            {item.blockerCount > 0 ? (
                              <Badge variant="destructive">
                                {item.blockerCount} bloqueio(s)
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.recommendation}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to={`/protocolos-sanitarios?overlaySubarea=${item.key}`}
                            >
                              Abrir area
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link
                              to={`/eventos?dominio=conformidade&overlaySubarea=${item.key}`}
                            >
                              Ver historico
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/animais?overlaySubarea=${item.key}`}>
                              Ver animais
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {report.regulatoryCompliance.impacts.length > 0 ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold">
                      Impacto da conformidade
                    </h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {report.regulatoryCompliance.impacts.map((item) => (
                      <div
                        key={item.key}
                        className="rounded-xl border border-border/70 bg-muted/20 p-4"
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{item.label}</p>
                            <Badge
                              variant={
                                item.tone === "danger"
                                  ? "destructive"
                                  : item.tone === "warning"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {item.totalCount > 0
                                ? `${item.totalCount} alerta(s)`
                                : "Sem restricao"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.message}
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button asChild size="sm" variant="outline">
                              <Link
                                to={`/protocolos-sanitarios?overlayImpact=${item.key}`}
                              >
                                Abrir recorte
                              </Link>
                            </Button>
                            <Button asChild size="sm" variant="ghost">
                              <Link
                                to={`/eventos?dominio=conformidade&overlayImpact=${item.key}`}
                              >
                                Ver historico
                              </Link>
                            </Button>
                            <Button asChild size="sm" variant="ghost">
                              <Link to={`/animais?overlayImpact=${item.key}`}>
                                Ver animais
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="shadow-none">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <CardTitle className="text-base">Agenda que exige atencao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.agendaAttention.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                Nenhuma tarefa aberta na agenda.
              </div>
            ) : (
              report.agendaAttention.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.titulo}</p>
                      <Badge
                        variant={
                          item.priorityTone === "danger" ||
                          item.status === "atrasado"
                            ? "destructive"
                            : item.priorityTone === "warning" ||
                                item.status === "hoje"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {item.status === "atrasado"
                          ? "Atrasado"
                          : item.status === "hoje"
                            ? "Hoje"
                            : "Proximo"}
                      </Badge>
                      {item.priorityLabel ? (
                        <Badge
                          variant={
                            item.priorityTone === "danger"
                              ? "destructive"
                              : item.priorityTone === "warning"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {item.priorityLabel}
                        </Badge>
                      ) : null}
                      {item.operationalClassLabel ? (
                        <Badge variant="outline">
                          {item.operationalClassLabel}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.contexto}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(item.data)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <CardTitle className="text-base">Eventos recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.recentEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                Nenhum evento encontrado para o periodo selecionado.
              </div>
            ) : (
              report.recentEvents.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{item.dominio}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.contexto}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(item.data)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Relatorios;
