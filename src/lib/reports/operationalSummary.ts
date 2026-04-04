import type {
  AgendaItem,
  Animal,
  DominioEnum,
  Evento,
  EventoFinanceiro,
  EventoPesagem,
  FinanceiroTipoEnum,
  Gesture,
  Lote,
  Pasto,
  Rejection,
} from "@/lib/offline/types";

export type ReportPreset = "7d" | "30d" | "90d" | "mes_atual";

export interface ReportRange {
  preset: ReportPreset;
  from: string;
  to: string;
  label: string;
  filenameTag: string;
}

export interface OperationalSummaryInput {
  animals: Animal[];
  lotes: Lote[];
  pastos: Pasto[];
  agenda: AgendaItem[];
  eventos: Evento[];
  eventosPesagem: EventoPesagem[];
  eventosFinanceiro: EventoFinanceiro[];
  gestures: Gesture[];
  rejections: Rejection[];
}

export interface SummaryMetric {
  label: string;
  value: number;
}

export interface AgendaAttentionRow {
  id: string;
  data: string;
  titulo: string;
  contexto: string;
  status: "atrasado" | "hoje" | "proximo";
}

export interface RecentEventRow {
  id: string;
  data: string;
  dominio: string;
  contexto: string;
}

export interface OperationalSummaryReport {
  generatedAt: string;
  range: ReportRange;
  summary: {
    animaisAtivos: number;
    lotesAtivos: number;
    pastosAtivos: number;
    agendaAberta: number;
    agendaHoje: number;
    agendaAtrasada: number;
    eventosPeriodo: number;
    pendenciasSync: number;
    errosSync: number;
  };
  manejoByDomain: SummaryMetric[];
  financeiro: {
    entradas: number;
    saidas: number;
    saldo: number;
    transacoes: number;
    compras: number;
    vendas: number;
  };
  pesagem: {
    totalPesagens: number;
    pesoMedioKg: number | null;
    ultimoPesoKg: number | null;
    ultimaPesagemEm: string | null;
  };
  agendaAttention: AgendaAttentionRow[];
  recentEvents: RecentEventRow[];
}

const DOMAIN_LABEL: Record<DominioEnum, string> = {
  sanitario: "Sanitario",
  pesagem: "Pesagem",
  nutricao: "Nutricao",
  movimentacao: "Movimentacao",
  reproducao: "Reproducao",
  financeiro: "Financeiro",
};

const DOMAIN_ORDER: DominioEnum[] = [
  "sanitario",
  "pesagem",
  "movimentacao",
  "nutricao",
  "reproducao",
  "financeiro",
];

const FINANCE_SIGNAL: Record<FinanceiroTipoEnum, "entrada" | "saida"> = {
  compra: "saida",
  venda: "entrada",
};

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const LONG_DATETIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function toLocalDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function safeDateLabel(dateKey: string): string {
  return SHORT_DATE_FORMATTER.format(new Date(`${dateKey}T00:00:00`));
}

function safeDateTimeLabel(iso: string): string {
  return LONG_DATETIME_FORMATTER.format(new Date(iso));
}

function getEventDateKey(evento: Evento): string {
  return evento.occurred_on ?? evento.occurred_at.slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toCsvCell(value: string | number | null): string {
  const text = value == null ? "" : String(value);
  if (text.includes(";") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function resolveAgendaStatus(
  item: AgendaItem,
  todayKey: string,
): AgendaAttentionRow["status"] {
  if (item.data_prevista < todayKey) return "atrasado";
  if (item.data_prevista === todayKey) return "hoje";
  return "proximo";
}

export function resolveReportRange(
  preset: ReportPreset,
  now = new Date(),
): ReportRange {
  const endDate = toLocalDateOnly(now);

  if (preset === "mes_atual") {
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    return {
      preset,
      from: toDateKey(startDate),
      to: toDateKey(endDate),
      label: "Mes atual",
      filenameTag: `${startDate.getFullYear()}-${`${startDate.getMonth() + 1}`.padStart(2, "0")}`,
    };
  }

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const startDate = shiftDays(endDate, -(days - 1));

  return {
    preset,
    from: toDateKey(startDate),
    to: toDateKey(endDate),
    label: `Ultimos ${days} dias`,
    filenameTag: `${days}d`,
  };
}

export function buildOperationalSummary(
  input: OperationalSummaryInput,
  range: ReportRange,
  now = new Date(),
): OperationalSummaryReport {
  const todayKey = toDateKey(toLocalDateOnly(now));
  const animals = input.animals.filter(
    (animal) => !animal.deleted_at && animal.status === "ativo",
  );
  const lotes = input.lotes.filter((lote) => !lote.deleted_at);
  const pastos = input.pastos.filter((pasto) => !pasto.deleted_at);
  const agendaAberta = input.agenda.filter(
    (item) => !item.deleted_at && item.status === "agendado",
  );
  const eventos = input.eventos.filter(
    (evento) =>
      !evento.deleted_at &&
      getEventDateKey(evento) >= range.from &&
      getEventDateKey(evento) <= range.to,
  );

  const animalById = new Map(
    animals.map((animal) => [
      animal.id,
      animal.identificacao || animal.nome || "Animal sem identificacao",
    ]),
  );
  const loteById = new Map(lotes.map((lote) => [lote.id, lote.nome]));
  const financeByEventId = new Map(
    input.eventosFinanceiro
      .filter((item) => !item.deleted_at)
      .map((item) => [item.evento_id, item]),
  );
  const weightByEventId = new Map(
    input.eventosPesagem
      .filter((item) => !item.deleted_at)
      .map((item) => [item.evento_id, item]),
  );

  const domainCounts = DOMAIN_ORDER.map((dominio) => ({
    label: DOMAIN_LABEL[dominio],
    value: eventos.filter((evento) => evento.dominio === dominio).length,
  }));

  const financeEvents = eventos
    .filter((evento) => evento.dominio === "financeiro")
    .map((evento) => financeByEventId.get(evento.id))
    .filter((item): item is EventoFinanceiro => Boolean(item));

  const financeiro = financeEvents.reduce(
    (acc, item) => {
      if (FINANCE_SIGNAL[item.tipo] === "entrada") {
        acc.entradas += Number(item.valor_total || 0);
        acc.vendas += 1;
      } else {
        acc.saidas += Number(item.valor_total || 0);
        acc.compras += 1;
      }
      acc.transacoes += 1;
      return acc;
    },
    {
      entradas: 0,
      saidas: 0,
      saldo: 0,
      transacoes: 0,
      compras: 0,
      vendas: 0,
    },
  );
  financeiro.saldo = financeiro.entradas - financeiro.saidas;

  const pesagens = eventos
    .filter((evento) => evento.dominio === "pesagem")
    .map((evento) => ({
      evento,
      detalhe: weightByEventId.get(evento.id),
    }))
    .filter(
      (item): item is { evento: Evento; detalhe: EventoPesagem } =>
        Boolean(item.detalhe),
    );

  const totalPeso = pesagens.reduce(
    (acc, item) => acc + Number(item.detalhe.peso_kg || 0),
    0,
  );
  const ultimaPesagem = pesagens
    .slice()
    .sort((left, right) => right.evento.occurred_at.localeCompare(left.evento.occurred_at))[0];

  const agendaAttention = agendaAberta
    .slice()
    .sort((left, right) => left.data_prevista.localeCompare(right.data_prevista))
    .slice(0, 10)
    .map((item) => ({
      id: item.id,
      data: item.data_prevista,
      titulo: `${DOMAIN_LABEL[item.dominio]}: ${item.tipo.replaceAll("_", " ")}`,
      contexto:
        animalById.get(item.animal_id ?? "") ??
        loteById.get(item.lote_id ?? "") ??
        "Sem animal ou lote vinculado",
      status: resolveAgendaStatus(item, todayKey),
    }));

  const recentEvents = eventos
    .slice()
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
    .slice(0, 8)
    .map((evento) => ({
      id: evento.id,
      data: getEventDateKey(evento),
      dominio: DOMAIN_LABEL[evento.dominio],
      contexto:
        animalById.get(evento.animal_id ?? "") ??
        loteById.get(evento.lote_id ?? "") ??
        evento.observacoes ??
        "Registro geral",
    }));

  return {
    generatedAt: new Date().toISOString(),
    range,
    summary: {
      animaisAtivos: animals.length,
      lotesAtivos: lotes.length,
      pastosAtivos: pastos.length,
      agendaAberta: agendaAberta.length,
      agendaHoje: agendaAberta.filter((item) => item.data_prevista === todayKey).length,
      agendaAtrasada: agendaAberta.filter((item) => item.data_prevista < todayKey).length,
      eventosPeriodo: eventos.length,
      pendenciasSync: input.gestures.filter(
        (gesture) => gesture.status === "PENDING" || gesture.status === "SYNCING",
      ).length,
      errosSync: input.rejections.length,
    },
    manejoByDomain: domainCounts,
    financeiro,
    pesagem: {
      totalPesagens: pesagens.length,
      pesoMedioKg: pesagens.length > 0 ? totalPeso / pesagens.length : null,
      ultimoPesoKg: ultimaPesagem?.detalhe.peso_kg ?? null,
      ultimaPesagemEm: ultimaPesagem
        ? getEventDateKey(ultimaPesagem.evento)
        : null,
    },
    agendaAttention,
    recentEvents,
  };
}

export function buildOperationalSummaryCsv(
  report: OperationalSummaryReport,
  farmName: string,
): string {
  const lines: string[] = [];
  const pushRow = (...cells: Array<string | number | null>) => {
    lines.push(cells.map(toCsvCell).join(";"));
  };

  pushRow("secao", "campo", "valor");
  pushRow("meta", "fazenda", farmName);
  pushRow("meta", "periodo", `${report.range.label} (${report.range.from} a ${report.range.to})`);
  pushRow("meta", "gerado_em", report.generatedAt);
  pushRow("resumo", "animais_ativos", report.summary.animaisAtivos);
  pushRow("resumo", "lotes_ativos", report.summary.lotesAtivos);
  pushRow("resumo", "pastos_ativos", report.summary.pastosAtivos);
  pushRow("resumo", "agenda_aberta", report.summary.agendaAberta);
  pushRow("resumo", "agenda_hoje", report.summary.agendaHoje);
  pushRow("resumo", "agenda_atrasada", report.summary.agendaAtrasada);
  pushRow("resumo", "eventos_no_periodo", report.summary.eventosPeriodo);
  pushRow("resumo", "pendencias_sync", report.summary.pendenciasSync);
  pushRow("resumo", "erros_sync", report.summary.errosSync);
  pushRow("financeiro", "entradas", report.financeiro.entradas.toFixed(2));
  pushRow("financeiro", "saidas", report.financeiro.saidas.toFixed(2));
  pushRow("financeiro", "saldo", report.financeiro.saldo.toFixed(2));
  pushRow("financeiro", "transacoes", report.financeiro.transacoes);
  pushRow("pesagem", "total_pesagens", report.pesagem.totalPesagens);
  pushRow(
    "pesagem",
    "peso_medio_kg",
    report.pesagem.pesoMedioKg == null ? "" : report.pesagem.pesoMedioKg.toFixed(2),
  );
  pushRow(
    "pesagem",
    "ultimo_peso_kg",
    report.pesagem.ultimoPesoKg == null ? "" : report.pesagem.ultimoPesoKg.toFixed(2),
  );
  pushRow("pesagem", "ultima_pesagem_em", report.pesagem.ultimaPesagemEm);

  for (const item of report.manejoByDomain) {
    pushRow("manejo", item.label, item.value);
  }

  for (const item of report.agendaAttention) {
    pushRow("agenda", item.data, `${item.titulo} | ${item.contexto} | ${item.status}`);
  }

  for (const item of report.recentEvents) {
    pushRow("evento", item.data, `${item.dominio} | ${item.contexto}`);
  }

  return lines.join("\r\n");
}

export function buildOperationalSummaryPrintHtml(
  report: OperationalSummaryReport,
  farmName: string,
): string {
  const metricCards = [
    ["Animais ativos", String(report.summary.animaisAtivos)],
    ["Agenda aberta", String(report.summary.agendaAberta)],
    ["Saldo no periodo", report.financeiro.saldo.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })],
    ["Sync pendente", String(report.summary.pendenciasSync)],
  ]
    .map(
      ([label, value]) => `
        <div class="metric-card">
          <span class="metric-label">${escapeHtml(label)}</span>
          <strong class="metric-value">${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");

  const manejoRows = report.manejoByDomain
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.value}</td>
        </tr>
      `,
    )
    .join("");

  const agendaRows =
    report.agendaAttention.length > 0
      ? report.agendaAttention
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(safeDateLabel(item.data))}</td>
                <td>${escapeHtml(item.titulo)}</td>
                <td>${escapeHtml(item.contexto)}</td>
                <td>${escapeHtml(item.status)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="4">Nenhuma tarefa aberta na agenda.</td>
          </tr>
        `;

  const eventRows =
    report.recentEvents.length > 0
      ? report.recentEvents
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(safeDateLabel(item.data))}</td>
                <td>${escapeHtml(item.dominio)}</td>
                <td>${escapeHtml(item.contexto)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="3">Nenhum evento registrado no periodo.</td>
          </tr>
        `;

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Resumo operacional - ${escapeHtml(farmName)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #0f172a;
            margin: 32px;
          }
          h1, h2 {
            margin: 0 0 12px;
          }
          p {
            margin: 0 0 8px;
          }
          .meta {
            color: #475569;
            margin-bottom: 24px;
          }
          .metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin: 20px 0 28px;
          }
          .metric-card {
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 12px 16px;
          }
          .metric-label {
            display: block;
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .metric-value {
            font-size: 22px;
          }
          section {
            margin-bottom: 24px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
            padding: 10px 8px;
            font-size: 14px;
          }
          th {
            color: #475569;
          }
          .finance-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
          }
          .finance-card {
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 12px 16px;
          }
          @media print {
            body {
              margin: 18px;
            }
          }
        </style>
      </head>
      <body>
        <h1>Resumo operacional</h1>
        <p><strong>${escapeHtml(farmName)}</strong></p>
        <p class="meta">
          ${escapeHtml(report.range.label)} | ${escapeHtml(safeDateLabel(report.range.from))} a ${escapeHtml(safeDateLabel(report.range.to))}<br />
          Gerado em ${escapeHtml(safeDateTimeLabel(report.generatedAt))}
        </p>

        <div class="metrics">${metricCards}</div>

        <section>
          <h2>Manejos no periodo</h2>
          <table>
            <thead>
              <tr>
                <th>Dominio</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${manejoRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Financeiro basico</h2>
          <div class="finance-grid">
            <div class="finance-card">
              <span class="metric-label">Entradas</span>
              <strong>${escapeHtml(report.financeiro.entradas.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              }))}</strong>
            </div>
            <div class="finance-card">
              <span class="metric-label">Saidas</span>
              <strong>${escapeHtml(report.financeiro.saidas.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              }))}</strong>
            </div>
            <div class="finance-card">
              <span class="metric-label">Saldo</span>
              <strong>${escapeHtml(report.financeiro.saldo.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              }))}</strong>
            </div>
          </div>
          <p class="meta" style="margin-top: 12px;">
            ${report.financeiro.transacoes} transacao(oes) no periodo. Pesagens: ${report.pesagem.totalPesagens}.
          </p>
        </section>

        <section>
          <h2>Agenda que exige atencao</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tarefa</th>
                <th>Contexto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${agendaRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Eventos recentes</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Dominio</th>
                <th>Contexto</th>
              </tr>
            </thead>
            <tbody>${eventRows}</tbody>
          </table>
        </section>
      </body>
    </html>
  `;
}
