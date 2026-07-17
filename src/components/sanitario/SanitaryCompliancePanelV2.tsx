import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SANITARY_COMPLIANCE_STATUS_LABELS_V2,
  buildSanitaryComplianceV2,
  type SanitaryComplianceRowV2,
  type SanitaryComplianceStatusV2,
} from "@/lib/sanitario/compliance/sanitaryComplianceV2";
import type { SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";

type GroupBy = "none" | "protocol" | "item" | "animal" | "lot";
type DocumentaryFilter = "all" | "pending" | "without_pending";

const STATUS_ORDER = Object.keys(
  SANITARY_COMPLIANCE_STATUS_LABELS_V2,
) as SanitaryComplianceStatusV2[];

function statusVariant(status: SanitaryComplianceStatusV2) {
  if (status === "compliant") return "secondary" as const;
  if (status === "blocked" || status === "overdue") return "destructive" as const;
  return "outline" as const;
}

function groupIdentity(row: SanitaryComplianceRowV2, groupBy: GroupBy) {
  if (groupBy === "protocol") return row.protocolLabel;
  if (groupBy === "item") return row.itemLabel;
  if (groupBy === "animal") return row.animalLabel;
  if (groupBy === "lot") return row.lotLabel;
  return "Situação sanitária";
}

function uniqueOptions(
  rows: SanitaryComplianceRowV2[],
  resolve: (row: SanitaryComplianceRowV2) => { id: string; label: string } | null,
) {
  const values = new Map<string, string>();
  for (const row of rows) {
    const value = resolve(row);
    if (value) values.set(value.id, value.label);
  }
  return Array.from(values, ([id, label]) => ({ id, label })).sort((left, right) =>
    left.label.localeCompare(right.label, "pt-BR"),
  );
}

export function SanitaryCompliancePanelV2({
  source,
  initialAnimalId,
  initialLotId,
  evaluatedAt = new Date().toISOString().slice(0, 10),
}: {
  source: SanitaryProtocolWindowSourceV2 | undefined;
  initialAnimalId?: string | null;
  initialLotId?: string | null;
  evaluatedAt?: string;
}) {
  const model = useMemo(
    () => (source ? buildSanitaryComplianceV2({ source, evaluatedAt }) : null),
    [evaluatedAt, source],
  );
  const [filters, setFilters] = useState({
    protocolId: "all",
    itemId: "all",
    animalId: initialAnimalId ?? "all",
    lotId: initialLotId ?? "all",
    status: "all" as SanitaryComplianceStatusV2 | "all",
    documentary: "all" as DocumentaryFilter,
    startDate: "",
    endDate: "",
    product: "",
    groupBy: "none" as GroupBy,
  });
  const rows = model?.rows ?? [];
  const protocols = uniqueOptions(rows, (row) => ({
    id: row.protocolId,
    label: row.protocolLabel,
  }));
  const items = uniqueOptions(rows, (row) => ({ id: row.itemId, label: row.itemLabel }));
  const animals = uniqueOptions(rows, (row) => ({
    id: row.animalId,
    label: row.animalLabel,
  }));
  const lots = uniqueOptions(rows, (row) =>
    row.lotId ? { id: row.lotId, label: row.lotLabel } : null,
  );
  const filteredRows = rows.filter((row) => {
    if (filters.protocolId !== "all" && row.protocolId !== filters.protocolId) return false;
    if (filters.itemId !== "all" && row.itemId !== filters.itemId) return false;
    if (filters.animalId !== "all" && row.animalId !== filters.animalId) return false;
    if (filters.lotId !== "all" && row.lotId !== filters.lotId) return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.documentary === "pending" && !row.documentPendency) return false;
    if (filters.documentary === "without_pending" && row.documentPendency) return false;
    const date = row.evidenceDate?.slice(0, 10) ?? row.agendaDate;
    if (filters.startDate && (!date || date < filters.startDate)) return false;
    if (filters.endDate && (!date || date > filters.endDate)) return false;
    if (
      filters.product.trim() &&
      !row.productLabel
        ?.toLocaleLowerCase("pt-BR")
        .includes(filters.product.trim().toLocaleLowerCase("pt-BR"))
    ) {
      return false;
    }
    return true;
  });
  const groupedRows = new Map<string, SanitaryComplianceRowV2[]>();
  for (const row of filteredRows) {
    const group = groupIdentity(row, filters.groupBy);
    groupedRows.set(group, [...(groupedRows.get(group) ?? []), row]);
  }

  if (!source || !model) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Carregando conformidade sanitária local...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Resumo de conformidade</CardTitle>
          <CardDescription>
            Leitura derivada. Agenda é planejamento; somente evento executado ou histórico externo documentado compatível comprova conformidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STATUS_ORDER.map((status) => (
            <button
              key={status}
              type="button"
              aria-label={`Filtrar por ${SANITARY_COMPLIANCE_STATUS_LABELS_V2[status]}`}
              className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 ${
                filters.status === status ? "border-primary bg-primary/5" : "border-border/70"
              }`}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  status: current.status === status ? "all" : status,
                }))
              }
            >
              <p className="text-xs text-muted-foreground">
                {SANITARY_COMPLIANCE_STATUS_LABELS_V2[status]}
              </p>
              <p className="mt-1 text-2xl font-semibold">{model.statuses[status]}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtros de conformidade</CardTitle>
          <CardDescription>Os filtros alteram apenas esta leitura local.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Select value={filters.protocolId} onValueChange={(protocolId) => setFilters((current) => ({ ...current, protocolId }))}>
            <SelectTrigger aria-label="Protocolo"><SelectValue placeholder="Protocolo" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os protocolos</SelectItem>{protocols.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.itemId} onValueChange={(itemId) => setFilters((current) => ({ ...current, itemId }))}>
            <SelectTrigger aria-label="Item"><SelectValue placeholder="Item" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os itens</SelectItem>{items.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.animalId} onValueChange={(animalId) => setFilters((current) => ({ ...current, animalId }))}>
            <SelectTrigger aria-label="Animal"><SelectValue placeholder="Animal" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os animais</SelectItem>{animals.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.lotId} onValueChange={(lotId) => setFilters((current) => ({ ...current, lotId }))}>
            <SelectTrigger aria-label="Lote"><SelectValue placeholder="Lote" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os lotes</SelectItem>{lots.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(status: SanitaryComplianceStatusV2 | "all") => setFilters((current) => ({ ...current, status }))}>
            <SelectTrigger aria-label="Situação"><SelectValue placeholder="Situação" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas as situações</SelectItem>{STATUS_ORDER.map((status) => <SelectItem key={status} value={status}>{SANITARY_COMPLIANCE_STATUS_LABELS_V2[status]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.documentary} onValueChange={(documentary: DocumentaryFilter) => setFilters((current) => ({ ...current, documentary }))}>
            <SelectTrigger aria-label="Pendência documental"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Com ou sem pendência documental</SelectItem><SelectItem value="pending">Com pendência documental</SelectItem><SelectItem value="without_pending">Sem pendência documental</SelectItem></SelectContent>
          </Select>
          <Input aria-label="Período inicial" type="date" value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} />
          <Input aria-label="Período final" type="date" value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} />
          <Input aria-label="Produto" placeholder="Produto" value={filters.product} onChange={(event) => setFilters((current) => ({ ...current, product: event.target.value }))} />
          <Select value={filters.groupBy} onValueChange={(groupBy: GroupBy) => setFilters((current) => ({ ...current, groupBy }))}>
            <SelectTrigger aria-label="Agrupar por"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">Sem agrupamento</SelectItem><SelectItem value="protocol">Agrupar por protocolo</SelectItem><SelectItem value="item">Agrupar por item</SelectItem><SelectItem value="animal">Agrupar por animal</SelectItem><SelectItem value="lot">Agrupar por lote</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setFilters({ protocolId: "all", itemId: "all", animalId: "all", lotId: "all", status: "all", documentary: "all", startDate: "", endDate: "", product: "", groupBy: "none" })}>Limpar filtros</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conformidade por animal, protocolo e item</CardTitle>
          <CardDescription>{filteredRows.length} resultado(s). Esta leitura não libera venda, abate, leite ou trânsito.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {filteredRows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum resultado encontrado nos filtros.</p> : null}
          {Array.from(groupedRows.entries()).map(([group, entries]) => (
            <section key={group} className="space-y-3">
              {filters.groupBy !== "none" ? <h3 className="font-semibold">{group}</h3> : null}
              {entries.map((row) => (
                <div key={row.key} className="rounded-lg border border-border/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold">{row.animalLabel} · {row.lotLabel}</p>
                      <p className="text-sm">{row.protocolLabel} · {row.itemLabel}</p>
                      <p className="text-sm text-muted-foreground">{row.evidenceLabel}</p>
                      <p className="text-xs text-muted-foreground">Origem: {row.evidenceOriginLabel}</p>
                      {row.documentPendency ? <p className="text-sm text-amber-700">Pendência: {row.documentPendency}</p> : null}
                      {row.activeWithdrawal ? <p className="text-xs text-muted-foreground">Carência ativa existente nas fontes estruturadas; sinal informativo, sem liberação operacional.</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(row.status)}>{SANITARY_COMPLIANCE_STATUS_LABELS_V2[row.status]}</Badge>
                      <Button size="sm" variant="outline" asChild><Link to={row.animalHref}>Abrir animal</Link></Button>
                      {row.agendaId ? <Button size="sm" variant="outline" asChild><Link to={`/protocolos-sanitarios?tab=agenda&agendaId=${encodeURIComponent(row.agendaId)}`}>Abrir agenda</Link></Button> : null}
                      {row.eventId ? <Button size="sm" variant="outline" asChild><Link to={`/eventos?eventoId=${encodeURIComponent(row.eventId)}`}>Abrir evento</Link></Button> : null}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

