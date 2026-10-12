import {
  formatCommercialDate,
  formatCommercialMoney,
  formatCommercialNumber,
} from "./animalCommercialFormat";
import { useLiveQuery } from "dexie-react-hooks";
import {
  loadAnimalCommercialHistory,
  projectAnimalCommercialValues,
} from "@/lib/comercial/animalCommercialHistory";
import {
  classifyCommercialOperation,
  isCommercialSimulation,
  resolveCommercialFinanceLink,
} from "@/lib/finance/classification";
import { db } from "@/lib/offline/db";
import type {
  Evento,
  EventoComercial,
  FinanceTransaction,
} from "@/lib/offline/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CommercialEntry = {
  detail: EventoComercial;
  event?: Evento;
  transaction?: FinanceTransaction;
  financeUnavailable?: boolean;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

function financialCashLabel(
  realized: boolean,
  paidAt: string | null | undefined,
) {
  return realized && Boolean(paidAt)
    ? "Caixa realizado conforme lançamento vinculado e data de pagamento/recebimento. A quitação integral da operação não é comprovada por esta leitura."
    : "Pagamento, recebimento e quitação não comprovados por esta leitura.";
}

function FinancialAvailability({
  entry,
  available,
}: {
  entry: CommercialEntry;
  available: boolean;
}) {
  if (entry.financeUnavailable)
    return <p>Fonte financeira indisponível nesta leitura.</p>;
  return entry.detail.finance_transaction_id && !available ? (
    <p>Lançamento vinculado indisponível nesta fazenda.</p>
  ) : null;
}

function commercialParent(event: Evento | undefined, farmId: string) {
  return event?.fazenda_id === farmId &&
    !event.deleted_at &&
    event.dominio === "comercial"
    ? event
    : undefined;
}

function visibleCommercialEntry(entry: CommercialEntry, farmId: string) {
  if (entry.detail.fazenda_id !== farmId || entry.detail.deleted_at)
    return false;
  const parent = commercialParent(entry.event, farmId);
  return !isCommercialSimulation(
    parent ?? ({ payload: {} } as Evento),
    entry.detail,
  );
}

function CommercialFinanceEvidence({
  entry,
  farmId,
}: {
  entry: CommercialEntry;
  farmId: string;
}) {
  const { detail, event, transaction } = entry;
  const link = resolveCommercialFinanceLink({
    fazendaId: farmId,
    financeTransactionId: detail.finance_transaction_id,
    transactions: transaction && !transaction.deleted_at ? [transaction] : [],
  });
  const parent = commercialParent(event, farmId);
  const classification = parent
    ? classifyCommercialOperation(parent, detail, link.transaction)
    : null;
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm space-y-2">
      <h3 className="font-semibold">Vínculo financeiro</h3>
      <p className="break-words">
        {detail.finance_transaction_id
          ? `Referência registrada: ${detail.finance_transaction_id}`
          : "Sem vínculo financeiro registrado."}
      </p>
      <FinancialAvailability
        entry={entry}
        available={Boolean(link.transaction)}
      />
      {link.transaction && (
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Status do lançamento" value={link.transaction.status} />
          <Field
            label="Data de pagamento/recebimento registrada"
            value={formatCommercialDate(link.transaction.paid_at)}
          />
        </dl>
      )}
      <p>
        {financialCashLabel(
          Boolean(classification?.isRealizedCash),
          link.transaction?.paid_at,
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {classification
          ? `Classificação canônica: ${classification.sourceType}`
          : "Classificação indisponível: evento de origem não disponível."}
      </p>
      {classification?.limitations.map((limitation) => (
        <p key={limitation} className="text-xs text-muted-foreground">
          {limitation}
        </p>
      ))}
    </div>
  );
}

function CommercialOperationTotals({ detail }: { detail: EventoComercial }) {
  const status =
    { complete: "Completo", partial: "Parcial", blocked: "Bloqueado" }[
      detail.calculation_status
    ] ?? "Não registrado";
  return (
    <div className="border-t border-border/70 pt-3">
      <h3 className="mb-3 text-sm font-semibold">Totais da operação</h3>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Quantidade da operação"
          value={formatCommercialNumber(detail.quantidade_animais, "cab.")}
        />
        <Field
          label="Peso vivo total da operação"
          value={formatCommercialNumber(detail.peso_vivo_total, "kg")}
        />
        <Field
          label="Valor bruto da operação"
          value={formatCommercialMoney(detail.valor_bruto)}
        />
        <Field
          label="Valor líquido calculado registrado da operação"
          value={formatCommercialMoney(detail.valor_liquido_derivado)}
        />
        <Field
          label="Frete da operação"
          value={formatCommercialMoney(detail.frete)}
        />
        <Field
          label="Comissão da operação"
          value={formatCommercialMoney(detail.comissao)}
        />
        <Field
          label="Descontos da operação"
          value={formatCommercialMoney(detail.descontos)}
        />
        <Field
          label="Taxas e impostos da operação"
          value={formatCommercialMoney(detail.taxas_impostos)}
        />
        <Field
          label="Peso médio calculado registrado da operação"
          value={formatCommercialNumber(detail.peso_medio_derivado, "kg")}
        />
        <Field label="Estado do cálculo registrado" value={status} />
        <Field
          label="Contraparte registrada"
          value={detail.contraparte_nome || "Não informada"}
        />
      </dl>
    </div>
  );
}

function CommercialRecordLimitations({ detail }: { detail: EventoComercial }) {
  return (
    <div className="text-sm space-y-2">
      <h3 className="font-semibold">Limitações do registro</h3>
      <p className="text-muted-foreground">
        Cálculos registrados, sem recálculo nesta tela. Peso médio e valor
        líquido referem-se à operação, não ao animal. Não representam aptidão ou
        autorização comercial.
      </p>
      {(detail.limitations ?? []).map((limitation, index) => (
        <p key={index} className="text-muted-foreground">
          {limitation}
        </p>
      ))}
      {(detail.issues ?? []).map((issue, index) => (
        <p key={index} className="text-muted-foreground">
          {issue.severity === "blocking"
            ? "Bloqueio registrado"
            : "Aviso registrado"}
          : {issue.message}
        </p>
      ))}
    </div>
  );
}

function snapshotRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recordedPricingLine(detail: EventoComercial, animalId: string) {
  const pricing = snapshotRecord(snapshotRecord(detail.snapshot).pricing);
  const lines = Array.isArray(pricing.lines) ? pricing.lines : [];
  const matching = lines
    .map(snapshotRecord)
    .filter((line) => line.animal_id === animalId);
  return matching.length === 1 ? matching[0] : {};
}

function CommercialPricingEvidence({
  detail,
  animalId,
}: {
  detail: EventoComercial;
  animalId: string;
}) {
  const line = recordedPricingLine(detail, animalId);
  const text = (value: unknown) =>
    typeof value === "string" ? value : "Não registrado";
  return (
    <details className="text-sm">
      <summary className="cursor-pointer py-2 font-medium">
        Parâmetros individuais registrados no snapshot
      </summary>
      <dl className="grid gap-3 pt-3 sm:grid-cols-2">
        <Field
          label="Modo de precificação registrado"
          value={text(line.pricing_mode)}
        />
        <Field
          label="Fonte de peso registrada"
          value={text(line.weight_source)}
        />
        <Field
          label="Base de arroba registrada"
          value={text(line.arroba_basis)}
        />
        <Field
          label="Rendimento de carcaça registrado"
          value={formatCommercialNumber(line.carcass_yield_percent, "%")}
        />
        <Field
          label="Peso considerado registrado"
          value={formatCommercialNumber(line.weight_considered_kg, "kg")}
        />
        <Field
          label="Arrobas calculadas registradas"
          value={formatCommercialNumber(line.arrobas, "@")}
        />
        <Field
          label="Preço por arroba registrado"
          value={formatCommercialMoney(line.price_per_arroba)}
        />
        <Field
          label="Fonte de valor bruto registrada"
          value={text(line.gross_value_source)}
        />
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Somente a linha inequívoca deste animal no snapshot. Arroba, peso e
        rendimento não são convertidos ou preenchidos a partir do estado atual.
        Parâmetros ausentes permanecem não registrados.
      </p>
    </details>
  );
}

function CommercialIndividualValues({
  detail,
  animalId,
  parentAnimalId,
}: {
  detail: EventoComercial;
  animalId: string;
  parentAnimalId?: string | null;
}) {
  const purchase = detail.operation_type === "compra";
  const individual = projectAnimalCommercialValues(
    detail,
    animalId,
    parentAnimalId,
  );
  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Field
          label={
            purchase
              ? "Peso de aquisição deste animal:"
              : "Peso comercial de venda deste animal:"
          }
          value={
            individual.weight !== null
              ? formatCommercialNumber(individual.weight, individual.weightUnit)
              : "Não registrado para este animal"
          }
        />
        <Field
          label={
            purchase
              ? "Valor de compra deste animal:"
              : "Valor de venda deste animal:"
          }
          value={
            individual.value !== null
              ? formatCommercialMoney(individual.value)
              : "Não registrado para este animal"
          }
        />
      </dl>
      <p className="text-xs text-muted-foreground">
        Fonte individual: snapshot persistido ou registro individual da
        operação. Sem rateio do total e sem conversão de peso.
      </p>
    </>
  );
}

function CommercialOperationCard({
  entry,
  animalId,
  farmId,
}: {
  entry: CommercialEntry;
  animalId: string;
  farmId: string;
}) {
  const { detail, event } = entry;
  if (!visibleCommercialEntry(entry, farmId)) return null;
  const parent = commercialParent(event, farmId);
  const purchase = detail.operation_type === "compra";
  return (
    <Card className="min-w-0 border-border/70 shadow-none">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {!parent
              ? "Registro comercial — evento de origem indisponível"
              : purchase
                ? "Compra registrada"
                : "Venda registrada"}
          </CardTitle>
          <Badge variant="outline">
            {detail.scope === "lote"
              ? "Operação coletiva"
              : "Operação individual"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatCommercialDate(parent?.occurred_on ?? detail.occurred_at)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <CommercialIndividualValues
          detail={detail}
          animalId={animalId}
          parentAnimalId={parent?.animal_id}
        />
        <CommercialOperationTotals detail={detail} />
        <CommercialFinanceEvidence entry={entry} farmId={farmId} />
        <CommercialRecordLimitations detail={detail} />
        <CommercialPricingEvidence detail={detail} animalId={animalId} />
        {detail.observacoes && (
          <p className="break-words text-sm text-muted-foreground">
            Observação: {detail.observacoes}
          </p>
        )}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer py-2">
            Rastreabilidade do registro
          </summary>
          <dl className="space-y-2 break-all">
            <Field label="Evento comercial" value={detail.evento_id} />
            <Field label="Fazenda do registro" value={detail.fazenda_id} />
            <Field
              label="Registro local"
              value={formatCommercialDate(detail.client_recorded_at)}
            />
          </dl>
        </details>
      </CardContent>
    </Card>
  );
}

export function AnimalCommercialSection({
  farmId,
  animalId,
}: {
  farmId: string;
  animalId: string;
}) {
  const result = useLiveQuery(async () => {
    try {
      const details = await loadAnimalCommercialHistory(farmId, animalId);
      const rows = await Promise.all(
        details.map(async (detail): Promise<CommercialEntry> => {
          const event = await db.event_eventos.get(detail.evento_id);
          try {
            const transaction = detail.finance_transaction_id
              ? await db.state_finance_transactions.get(
                  detail.finance_transaction_id,
                )
              : undefined;
            return { detail, event, transaction };
          } catch {
            return { detail, event, financeUnavailable: true };
          }
        }),
      );
      return { farmId, animalId, rows, error: false };
    } catch {
      return { farmId, animalId, rows: [], error: true };
    }
  }, [farmId, animalId]);
  const current =
    result?.farmId === farmId && result?.animalId === animalId
      ? result
      : undefined;
  return (
    <section aria-label="Histórico comercial" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Histórico comercial factual</h2>
        <p className="text-sm text-muted-foreground">
          Compras e vendas registradas nesta fazenda. Simulações não representam
          venda executada e não integram este histórico.
        </p>
      </div>
      {!current ? (
        <p role="status">Carregando histórico comercial…</p>
      ) : current.error ? (
        <p role="alert">
          Não foi possível carregar o histórico comercial local. Reabra a aba
          para tentar novamente.
        </p>
      ) : current.rows.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          Sem operações comerciais registradas para este animal.
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {current.rows.map((entry) => (
            <CommercialOperationCard
              key={entry.detail.evento_id}
              entry={entry}
              animalId={animalId}
              farmId={farmId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
