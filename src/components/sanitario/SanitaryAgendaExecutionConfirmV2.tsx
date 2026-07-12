import { useEffect, useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formatSanitaryProductClassLabelV2,
  type SanitaryLocalAgendaListItemV2,
} from "@/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2";
import type { ExecuteSanitaryAgendaInputV2 } from "@/lib/sanitario/execution/sanitaryAgendaExecutionV2";

type ExecutionPayload = Omit<ExecuteSanitaryAgendaInputV2, "fazendaId">;

type Props = {
  items: SanitaryLocalAgendaListItemV2[];
  open: boolean;
  defaultResponsibleName?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payloads: ExecutionPayload[]) => Promise<void>;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function operationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function requiresProduct(item: SanitaryLocalAgendaListItemV2 | null | undefined) {
  return item
    ? ["specific_product", "product_class", "product_class_group"].includes(
        item.productRequirementKind,
      )
    : false;
}

function sameValue<T>(items: T[], read: (item: T) => string | number | null | undefined) {
  const values = Array.from(
    new Set(
      items
        .map(read)
        .filter((value): value is string | number => value !== null && value !== undefined && value !== ""),
    ),
  );
  return values.length === 1 ? values[0] : null;
}

function formatDate(value: string | undefined) {
  if (!value) return "Data não informada";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "Data não informada";
}

export function SanitaryAgendaExecutionConfirmV2({
  items,
  open,
  defaultResponsibleName,
  onOpenChange,
  onConfirm,
}: Props) {
  const item = items[0] ?? null;
  const totalAnimals = Math.max(
    items.reduce((sum, entry) => sum + Math.max(entry.animalCount, 1), 0),
    items.length,
  );
  const [executedAt, setExecutedAt] = useState(todayKey());
  const [productName, setProductName] = useState("");
  const [inventoryLotId, setInventoryLotId] = useState("");
  const [quantityConsumed, setQuantityConsumed] = useState("");
  const [quantityTouched, setQuantityTouched] = useState(false);
  const [unit, setUnit] = useState("");
  const [dose, setDose] = useState("");
  const [doseUnit, setDoseUnit] = useState("");
  const [route, setRoute] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchClientOpId, setBatchClientOpId] = useState("");
  const productRequired = items.some(requiresProduct);
  const productClassGroupWarning = items.some(
    (entry) => entry.productRequirementKind === "product_class_group",
  );
  const commonProductId = useMemo(
    () => sameValue(items, (entry) => entry.plannedProductId),
    [items],
  );
  const commonProductName = useMemo(
    () => sameValue(items, (entry) => entry.plannedProductName),
    [items],
  );
  const commonProductClass = useMemo(
    () => sameValue(items, (entry) => entry.productClass),
    [items],
  );
  const commonProductClassLabel =
    formatSanitaryProductClassLabelV2(typeof commonProductClass === "string" ? commonProductClass : null) ??
    item?.productClassLabel ??
    "Classe não informada";
  const hasDivergentSuggestions =
    items.length > 1 &&
    (sameValue(items, (entry) => entry.suggestedDose) === null ||
      sameValue(items, (entry) => entry.suggestedDoseUnit) === null ||
      sameValue(items, (entry) => entry.suggestedRoute) === null);

  useEffect(() => {
    if (!open) return;
    const initialDose = sameValue(items, (entry) => entry.suggestedDose);
    const initialDoseUnit = sameValue(items, (entry) => entry.suggestedDoseUnit);
    const initialRoute = sameValue(items, (entry) => entry.suggestedRoute);
    setExecutedAt(todayKey());
    setProductName(typeof commonProductName === "string" ? commonProductName : "");
    setInventoryLotId("");
    setQuantityConsumed("");
    setQuantityTouched(false);
    setUnit(typeof initialDoseUnit === "string" ? initialDoseUnit : "");
    setDose(typeof initialDose === "number" ? String(initialDose) : "");
    setDoseUnit(typeof initialDoseUnit === "string" ? initialDoseUnit : "");
    setRoute(typeof initialRoute === "string" ? initialRoute : "");
    setResponsibleName(defaultResponsibleName?.trim() ?? "");
    setNotes("");
    setConfirmed(false);
    setBatchClientOpId(`sanitary-agenda-batch-v2:${operationId()}`);
  }, [commonProductName, defaultResponsibleName, items, open]);

  useEffect(() => {
    if (quantityTouched || !dose || !doseUnit.trim() || totalAnimals <= 0) return;
    const doseNumber = Number(dose);
    if (!Number.isFinite(doseNumber) || doseNumber <= 0) return;
    setQuantityConsumed(String(Number((doseNumber * totalAnimals).toFixed(4))));
    setUnit((current) => current || doseUnit.trim());
  }, [dose, doseUnit, quantityTouched, totalAnimals]);

  const canSubmit = useMemo(() => {
    if (items.length === 0 || !confirmed || !executedAt) return false;
    if (productRequired && !productName.trim()) return false;
    if ((productRequired || productName.trim()) && (!dose || !doseUnit.trim() || !route.trim())) {
      return false;
    }
    if (inventoryLotId.trim() && (!quantityConsumed || !unit.trim())) return false;
    return true;
  }, [
    items.length,
    confirmed,
    executedAt,
    productRequired,
    productName,
    dose,
    doseUnit,
    route,
    inventoryLotId,
    quantityConsumed,
    unit,
  ]);

  const submit = async () => {
    if (items.length === 0 || !canSubmit) return;
    setSubmitting(true);
    try {
      const quantityTotal = quantityConsumed ? Number(quantityConsumed) : null;
      const payloads = items.map((entry, index): ExecutionPayload => {
        const quantityForAgenda =
          quantityTotal && totalAnimals > 0
            ? Number(((quantityTotal * Math.max(entry.animalCount, 1)) / totalAnimals).toFixed(4))
            : null;
        return {
        agendaId: entry.id,
        clientOpId: `${batchClientOpId}:${index + 1}:${entry.id}`,
        executedAt,
        responsibleName: responsibleName.trim() || undefined,
        notes: notes.trim() || undefined,
        product: productName.trim()
          ? {
              productId: typeof commonProductId === "string" ? commonProductId : undefined,
              productName: productName.trim(),
              productClass: entry.productClass,
              productClassGroupId: entry.productClassGroupId,
              inventoryLotId: inventoryLotId.trim() || undefined,
              quantityConsumed: quantityForAgenda,
              unit: unit.trim() || null,
            }
          : undefined,
        application:
          dose || doseUnit.trim() || route.trim()
            ? {
                dose: dose ? Number(dose) : null,
                doseUnit: doseUnit.trim() || null,
                route: route.trim() || null,
              }
            : undefined,
        confirmation: {
          userConfirmedExecution: true,
          userConfirmedStockMovement: Boolean(inventoryLotId.trim()),
          userConfirmedWithdrawal: Boolean(commonProductId),
        },
      };
      });
      await onConfirm(payloads);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Executar agenda sanitária</DialogTitle>
          <DialogDescription>
            Esta ação registra um evento sanitário executado.
          </DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-muted/30 p-3 text-sm" aria-label="Resumo">
              <p className="font-medium">{item.protocolLabel}</p>
              <p className="text-muted-foreground">{item.itemLabel}</p>
              <p className="text-muted-foreground">
                {items.length === 1
                  ? `Alvo: ${item.target.label}`
                  : `${items.length} agendas compatíveis · ${totalAnimals} animal(is)`}
                {" · "}Planejada para {formatDate(item.plannedFor)}
              </p>
            </section>

            <div className="grid gap-3 rounded-lg border border-border p-3 text-sm text-muted-foreground">
              <p>Produto real, dose e via serão registrados como execução sanitária.</p>
              <p>Agenda deixará de ser apenas intenção futura.</p>
              <p>Estoque e carência só serão gerados quando houver dados e regra explícita.</p>
              {productClassGroupWarning ? (
                <p className="text-amber-700">
                  Grupo técnico não define dose nem carência. A carência só será calculada se houver regra explícita para o produto executado.
                </p>
              ) : null}
              {productName.trim() && !inventoryLotId.trim() ? (
                <p className="text-amber-700">Produto informado sem baixa de estoque.</p>
              ) : null}
            </div>

            <section className="grid gap-3 md:grid-cols-2" aria-label="Produto e aplicação">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Data de execução</span>
                <Input
                  aria-label="Data de execução"
                  type="date"
                  value={executedAt}
                  onChange={(event) => setExecutedAt(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Responsável</span>
                <Input
                  aria-label="Responsável"
                  value={responsibleName}
                  onChange={(event) => setResponsibleName(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="font-medium">
                  Produto real{productRequired ? " obrigatório" : ""}
                </span>
                <Input
                  aria-label="Produto real"
                  list="sanitary-execution-products-v2"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                />
                {typeof commonProductName === "string" ? (
                  <datalist id="sanitary-execution-products-v2">
                    <option value={commonProductName} />
                  </datalist>
                ) : null}
              </label>
              <div className="rounded-lg border border-border p-3 text-sm">
                <div className="text-muted-foreground">Classe do produto</div>
                <div className="font-medium">{commonProductClassLabel}</div>
              </div>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Dose</span>
                <Input
                  aria-label="Dose"
                  type="number"
                  min="0"
                  step="0.01"
                  value={dose}
                  onChange={(event) => setDose(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Unidade da dose</span>
                <Input
                  aria-label="Unidade da dose"
                  value={doseUnit}
                  onChange={(event) => setDoseUnit(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Via</span>
                <Input
                  aria-label="Via"
                  value={route}
                  onChange={(event) => setRoute(event.target.value)}
                />
              </label>
              {hasDivergentSuggestions ? (
                <p className="text-sm text-amber-700 md:col-span-2">
                  Quantidade não preenchida automaticamente porque há divergência nos dados da seleção.
                </p>
              ) : null}
            </section>

            <section className="grid gap-3 md:grid-cols-2" aria-label="Estoque opcional">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Lote de estoque</span>
                <Input
                  aria-label="Lote de estoque"
                  value={inventoryLotId}
                  onChange={(event) => setInventoryLotId(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Quantidade consumida</span>
                <Input
                  aria-label="Quantidade consumida"
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantityConsumed}
                  onChange={(event) => {
                    setQuantityTouched(true);
                    setQuantityConsumed(event.target.value);
                  }}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Unidade consumida</span>
                <Input
                  aria-label="Unidade consumida"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                />
              </label>
            </section>

            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Observação</summary>
              <Textarea
                className="mt-3"
                aria-label="Observação"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </details>

            <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(value) => setConfirmed(value === true)}
                aria-label="Confirmo que este manejo sanitário foi executado."
              />
              <span>Confirmo que este manejo sanitário foi executado.</span>
            </label>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button type="button" disabled={!canSubmit || submitting} onClick={submit}>
            Confirmar execução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
