import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Beef,
  CalendarClock,
  Download,
  FileText,
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
  resolveReportRange,
  type ReportPreset,
} from "@/lib/reports/operationalSummary";
import { trackPilotMetric } from "@/lib/telemetry/pilotMetrics";
import { showError, showSuccess } from "@/utils/toast";
import { formatWeight } from "@/lib/format/weight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

  const source = useLiveQuery(
    async () => {
      if (!activeFarmId) return null;

      const [
        animals,
        lotes,
        pastos,
        agenda,
        eventos,
        eventosPesagem,
        eventosFinanceiro,
        gestures,
        rejections,
      ] = await Promise.all([
        db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_pastos.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_agenda_itens.where("fazenda_id").equals(activeFarmId).toArray(),
        db.event_eventos.where("fazenda_id").equals(activeFarmId).toArray(),
        db.event_eventos_pesagem.where("fazenda_id").equals(activeFarmId).toArray(),
        db.event_eventos_financeiro.where("fazenda_id").equals(activeFarmId).toArray(),
        db.queue_gestures.where("fazenda_id").equals(activeFarmId).toArray(),
        db.queue_rejections.where("fazenda_id").equals(activeFarmId).toArray(),
      ]);

      return {
        animals,
        lotes,
        pastos,
        agenda,
        eventos,
        eventosPesagem,
        eventosFinanceiro,
        gestures,
        rejections,
      };
    },
    [activeFarmId],
  );

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
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=720");

    if (!printWindow) {
      showError("Nao foi possivel abrir a janela de impressao.");
      return;
    }

    printWindow.document.write(buildOperationalSummaryPrintHtml(report, farmName));
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
      <div className="space-y-6">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Selecione uma fazenda para gerar o resumo</CardTitle>
            <CardDescription>
              O relatorio usa o estado local da fazenda ativa para montar agenda,
              rebanho, financeiro basico e sync.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Carregando resumo operacional</CardTitle>
            <CardDescription>
              Buscando rebanho, agenda, eventos e fila offline da fazenda ativa.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Resumo operacional</Badge>
            <Badge variant="outline">{report.range.label}</Badge>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {farm?.nome ?? "Sua fazenda"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Visao simples para revisar rotina, agenda, financeiro basico e
              saude do sync sem abrir varios modulos.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Periodo analisado: {formatDate(report.range.from)} a{" "}
            {formatDate(report.range.to)}.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Rebanho ativo</CardDescription>
            <Beef className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{report.summary.animaisAtivos}</div>
            <p className="text-sm text-muted-foreground">
              {report.summary.lotesAtivos} lote(s) e {report.summary.pastosAtivos} pasto(s) ativos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Agenda aberta</CardDescription>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{report.summary.agendaAberta}</div>
            <p className="text-sm text-muted-foreground">
              {report.summary.agendaHoje} para hoje e {report.summary.agendaAtrasada} em atraso.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Saldo no periodo</CardDescription>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                report.financeiro.saldo >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {money.format(report.financeiro.saldo)}
            </div>
            <p className="text-sm text-muted-foreground">
              {report.financeiro.transacoes} transacao(oes) financeiras no periodo.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Sync</CardDescription>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{report.summary.pendenciasSync}</div>
            <p className="text-sm text-muted-foreground">
              {report.summary.errosSync > 0
                ? `${report.summary.errosSync} erro(s) para revisar.`
                : "Sem erros pendentes na fila."}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Manejos no periodo</CardTitle>
            <CardDescription>
              Total de eventos registrados por dominio no intervalo selecionado.
            </CardDescription>
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
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              {report.summary.eventosPeriodo} evento(s) registrados no total.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Financeiro e pesagem</CardTitle>
            <CardDescription>
              Resumo enxuto para revisar caixa e manejo de ganho de peso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Entradas
                </div>
                <p className="mt-2 text-2xl font-bold">
                  {money.format(report.financeiro.entradas)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {report.financeiro.vendas} venda(s)
                </p>
              </div>

              <div className="rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  Saidas
                </div>
                <p className="mt-2 text-2xl font-bold">
                  {money.format(report.financeiro.saidas)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {report.financeiro.compras} compra(s)
                </p>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Scale className="h-4 w-4" />
                Pesagem no periodo
              </div>
              <p className="mt-2 text-2xl font-bold">
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

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Agenda que exige atencao</CardTitle>
            <CardDescription>
              Proximas tarefas abertas, com destaque para o que ja passou do prazo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.agendaAttention.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma tarefa aberta na agenda.
              </div>
            ) : (
              report.agendaAttention.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.titulo}</p>
                      <Badge
                        variant={
                          item.status === "atrasado"
                            ? "destructive"
                            : item.status === "hoje"
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
                    </div>
                    <p className="text-sm text-muted-foreground">{item.contexto}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(item.data)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Eventos recentes</CardTitle>
            <CardDescription>
              Ultimos registros do periodo para conversar com a equipe ou revisar a semana.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.recentEvents.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Nenhum evento encontrado para o periodo selecionado.
              </div>
            ) : (
              report.recentEvents.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{item.dominio}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.contexto}</p>
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
