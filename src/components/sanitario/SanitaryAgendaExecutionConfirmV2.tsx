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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/offline/db";
import type { Insumo, InsumoLote, SanitarioProdutoLocalV2 } from "@/lib/offline/types";
import {
  formatSanitaryProductClassLabelV2,
  type SanitaryLocalAgendaListItemV2,
} from "@/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2";
import type { ExecuteSanitaryAgendaInputV2 } from "@/lib/sanitario/execution/sanitaryAgendaExecutionV2";

type ExecutionPayload = Omit<ExecuteSanitaryAgendaInputV2, "fazendaId">;

export type SanitaryExecutionInventoryLotOptionV2 = {
  id: string;
  label: string;
  productId: string;
  unit: string;
  balanceLabel: string;
};

export type SanitaryExecutionProductOptionV2 = {
  id: string;
  label: string;
  name: string;
  productClass: string | null;
  source: "catalog_product" | "inventory_supply";
  weakTechnicalLink?: boolean;
  warning?: string | null;
};

type Props = {
  items: SanitaryLocalAgendaListItemV2[];
  open: boolean;
  defaultResponsibleName?: string | null;
  productOptions?: SanitaryExecutionProductOptionV2[];
  inventoryLotOptions?: SanitaryExecutionInventoryLotOptionV2[];
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

function normalizeForMatch(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function productLabel(product: SanitarioProdutoLocalV2) {
  return [product.nome_comercial, product.fabricante].filter(Boolean).join(" · ");
}

function formatUnit(value: string, quantity: number) {
  if (value === "dose" && quantity !== 1) return "doses";
  return value;
}

function lotLabel(lot: InsumoLote) {
  const base = lot.identificacao_lote?.trim() || "Lote sem identificação";
  const saldo = `${lot.saldo_atual_base} ${formatUnit(lot.unidade_base, lot.saldo_atual_base)}`;
  return `${base} · saldo ${saldo}`;
}

function supplyLabel(supply: Insumo) {
  return [supply.nome, supply.categoria].filter(Boolean).join(" · ");
}

function compatibleProduct(
  product: SanitarioProdutoLocalV2,
  item: SanitaryLocalAgendaListItemV2,
  classesByGroup: Map<string, Set<string>>,
) {
  if (item.productRequirementKind === "specific_product" && item.plannedProductId) {
    return product.id === item.plannedProductId;
  }
  if (item.productRequirementKind === "product_class" && item.productClass) {
    return product.classe === item.productClass;
  }
  if (item.productRequirementKind === "product_class_group" && item.productClassGroupId) {
    const classIds = classesByGroup.get(item.productClassGroupId);
    return classIds && classIds.size > 0 ? classIds.has(product.classe) : true;
  }
  return true;
}

function compatibleSupplyByFallback(supply: Insumo, item: SanitaryLocalAgendaListItemV2) {
  if (supply.tipo !== "sanitario" || !supply.ativo || supply.deleted_at) return false;
  if (item.productRequirementKind === "none") return true;
  const text = normalizeForMatch(
    [supply.nome, supply.categoria, JSON.stringify(supply.payload ?? {})].join(" "),
  );
  if (item.productClass) {
    const classLabel = normalizeForMatch(
      formatSanitaryProductClassLabelV2(item.productClass) ?? item.productClass,
    );
    const classTokens = classLabel.split(" ").filter((token) => token.length > 2);
    if (classTokens.length > 0 && classTokens.every((token) => text.includes(token))) {
      return true;
    }
    if (item.productClass.startsWith("vacina") && text.includes("vacina")) {
      return true;
    }
  }
  if (item.productClassGroupName) {
    const group = normalizeForMatch(item.productClassGroupName);
    if (group && text.includes(group)) return true;
  }
  return item.productRequirementKind === "product_class_group" && text.includes("sanitario");
}

// eslint-disable-next-line react-refresh/only-export-components
export async function loadSanitaryAgendaExecutionOptionsV2(
  items: SanitaryLocalAgendaListItemV2[],
) {
  const fazendaId = items[0]?.fazendaId ?? null;
  const [products, groupMembers, supplies, lots] = await Promise.all([
    db.catalog_sanitario_produtos_v2.toArray(),
    db.catalog_sanitario_product_class_group_members_v2.toArray(),
    fazendaId ? db.state_insumos.where("fazenda_id").equals(fazendaId).toArray() : [],
    fazendaId ? db.state_insumo_lotes.where("fazenda_id").equals(fazendaId).toArray() : [],
  ]);
  const classesByGroup = new Map<string, Set<string>>();
  for (const member of groupMembers) {
    if (member.deleted_at || !member.is_allowed) continue;
    const current = classesByGroup.get(member.group_id) ?? new Set<string>();
    current.add(member.class_id);
    classesByGroup.set(member.group_id, current);
  }
  const catalogProductOptions = products
    .filter((product) => !product.deleted_at && product.status_curatorial === "ativo")
    .filter((product) => items.every((item) => compatibleProduct(product, item, classesByGroup)))
    .map((product) => ({
      id: product.id,
      label: productLabel(product),
      name: product.nome_comercial,
      productClass: product.classe ?? null,
      source: "catalog_product" as const,
      weakTechnicalLink: false,
      warning: null,
    }));
  const existingOptionIds = new Set(catalogProductOptions.map((product) => product.id));
  const supplyOptions = supplies
    .filter((supply) => !supply.deleted_at && supply.tipo === "sanitario" && supply.ativo)
    .filter((supply) => items.every((item) => compatibleSupplyByFallback(supply, item)))
    .map((supply) => {
      const linkedProductId = supply.produto_veterinario_id;
      const id = linkedProductId && existingOptionIds.has(linkedProductId)
        ? linkedProductId
        : `insumo:${supply.id}`;
      return {
        id,
        label: supplyLabel(supply),
        name: supply.nome,
        productClass: null,
        source: "inventory_supply" as const,
        weakTechnicalLink: !linkedProductId,
        warning: linkedProductId
          ? null
          : "Produto encontrado no estoque, mas sem vínculo técnico completo. Confirme antes de executar.",
        supplyId: supply.id,
      };
    })
    .filter((option, index, all) => all.findIndex((entry) => entry.id === option.id) === index)
    .filter((option) => !existingOptionIds.has(option.id));
  const productOptions = [...catalogProductOptions, ...supplyOptions];
  const productIdBySupply = new Map<string, string>();
  for (const supply of supplies) {
    const linkedOptionId =
      supply.produto_veterinario_id && existingOptionIds.has(supply.produto_veterinario_id)
        ? supply.produto_veterinario_id
        : `insumo:${supply.id}`;
    if (productOptions.some((option) => option.id === linkedOptionId)) {
      productIdBySupply.set(supply.id, linkedOptionId);
    }
  }
  const inventoryLotOptions = lots
    .filter(
      (lot) =>
        !lot.deleted_at &&
        lot.status === "ativo" &&
        lot.saldo_atual_base > 0 &&
        productIdBySupply.has(lot.insumo_id),
    )
    .map((lot) => ({
      id: lot.id,
      label: lotLabel(lot),
      productId: productIdBySupply.get(lot.insumo_id)!,
      unit: lot.unidade_base,
      balanceLabel: `${lot.saldo_atual_base} ${formatUnit(lot.unidade_base, lot.saldo_atual_base)}`,
    }));
  return { productOptions, inventoryLotOptions };
}

export function SanitaryAgendaExecutionConfirmV2({
  items,
  open,
  defaultResponsibleName,
  productOptions: injectedProductOptions,
  inventoryLotOptions: injectedInventoryLotOptions,
  onOpenChange,
  onConfirm,
}: Props) {
  const item = items[0] ?? null;
  const totalAnimals = Math.max(
    items.reduce((sum, entry) => sum + Math.max(entry.animalCount, 1), 0),
    items.length,
  );
  const [executedAt, setExecutedAt] = useState(todayKey());
  const [productOptions, setProductOptions] = useState<SanitaryExecutionProductOptionV2[]>([]);
  const [inventoryLotOptions, setInventoryLotOptions] = useState<SanitaryExecutionInventoryLotOptionV2[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [inventoryLotId, setInventoryLotId] = useState("");
  const [dosesPerAnimal, setDosesPerAnimal] = useState("1");
  const [extraDoses, setExtraDoses] = useState("0");
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
  const selectedProduct = productOptions.find((option) => option.id === selectedProductId) ?? null;
  const compatibleLots = inventoryLotOptions.filter(
    (option) => !selectedProductId || option.productId === selectedProductId,
  );
  const selectedLot = compatibleLots.find((option) => option.id === inventoryLotId) ?? null;
  const dosesPerAnimalNumber = Number(dosesPerAnimal);
  const extraDosesNumber = Number(extraDoses);
  const plannedDoses =
    Number.isFinite(dosesPerAnimalNumber) && dosesPerAnimalNumber > 0
      ? Number((dosesPerAnimalNumber * totalAnimals).toFixed(4))
      : 0;
  const totalDoses =
    plannedDoses +
    (Number.isFinite(extraDosesNumber) && extraDosesNumber > 0 ? extraDosesNumber : 0);
  const executionUnit = selectedLot?.unit ?? "dose";

  useEffect(() => {
    if (!open) return;
    const initialDose = sameValue(items, (entry) => entry.suggestedDose);
    const initialRoute = sameValue(items, (entry) => entry.suggestedRoute);
    setExecutedAt(todayKey());
    setSelectedProductId("");
    setInventoryLotId("");
    setDosesPerAnimal(
      typeof initialDose === "number" && initialDose > 0
        ? String(initialDose)
        : "1",
    );
    setExtraDoses("0");
    setRoute(typeof initialRoute === "string" ? initialRoute : "");
    setResponsibleName(defaultResponsibleName?.trim() ?? "");
    setNotes("");
    setConfirmed(false);
    setBatchClientOpId(`sanitary-agenda-batch-v2:${operationId()}`);
  }, [defaultResponsibleName, items, open]);

  useEffect(() => {
    if (!open) return;
    if (injectedProductOptions || injectedInventoryLotOptions) {
      setProductOptions(injectedProductOptions ?? []);
      setInventoryLotOptions(injectedInventoryLotOptions ?? []);
      return;
    }
    let cancelled = false;
    loadSanitaryAgendaExecutionOptionsV2(items)
      .then((options) => {
        if (cancelled) return;
        setProductOptions(options.productOptions);
        setInventoryLotOptions(options.inventoryLotOptions);
      })
      .catch(() => {
        if (cancelled) return;
        setProductOptions([]);
        setInventoryLotOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [injectedInventoryLotOptions, injectedProductOptions, items, open]);

  useEffect(() => {
    if (!open || selectedProductId) return;
    const plannedProductId = sameValue(items, (entry) => entry.plannedProductId);
    if (typeof plannedProductId === "string" && productOptions.some((option) => option.id === plannedProductId)) {
      setSelectedProductId(plannedProductId);
      return;
    }
    if (productOptions.length === 1) {
      setSelectedProductId(productOptions[0].id);
    }
  }, [items, open, productOptions, selectedProductId]);

  useEffect(() => {
    if (!selectedProductId) {
      setInventoryLotId("");
      return;
    }
    const lots = inventoryLotOptions.filter((option) => option.productId === selectedProductId);
    if (lots.length === 1) {
      setInventoryLotId(lots[0].id);
    } else if (!lots.some((option) => option.id === inventoryLotId)) {
      setInventoryLotId("");
    }
  }, [inventoryLotId, inventoryLotOptions, selectedProductId]);

  const canSubmit = useMemo(() => {
    if (items.length === 0 || !confirmed || !executedAt) return false;
    if (productRequired && !selectedProductId) return false;
    if ((productRequired || selectedProductId) && (!dosesPerAnimal || totalDoses <= 0 || !route.trim())) {
      return false;
    }
    return true;
  }, [
    items.length,
    confirmed,
    executedAt,
    productRequired,
    selectedProductId,
    dosesPerAnimal,
    totalDoses,
    route,
  ]);

  const submit = async () => {
    if (items.length === 0 || !canSubmit || (selectedProductId && !selectedProduct)) return;
    setSubmitting(true);
    try {
      const payloads = items.map((entry, index): ExecutionPayload => {
        const quantityForAgenda =
          inventoryLotId.trim() && totalDoses && totalAnimals > 0
            ? Number(((totalDoses * Math.max(entry.animalCount, 1)) / totalAnimals).toFixed(4))
            : null;
        return {
        agendaId: entry.id,
        clientOpId: `${batchClientOpId}:${index + 1}:${entry.id}`,
        executedAt,
        responsibleName: responsibleName.trim() || undefined,
        notes: notes.trim() || undefined,
        product: selectedProduct
          ? {
              productId: selectedProduct.id,
              productName: selectedProduct.name,
              productClass: selectedProduct.productClass ?? entry.productClass,
              productClassGroupId: entry.productClassGroupId,
              inventoryLotId: inventoryLotId.trim() || undefined,
              quantityConsumed: quantityForAgenda,
              unit: executionUnit,
            }
          : undefined,
        application:
          dosesPerAnimal || route.trim()
            ? {
                dose: dosesPerAnimal ? Number(dosesPerAnimal) : null,
                doseUnit: executionUnit,
                route: route.trim() || null,
              }
            : undefined,
        confirmation: {
          userConfirmedExecution: true,
          userConfirmedStockMovement: Boolean(inventoryLotId.trim()),
          userConfirmedWithdrawal: Boolean(selectedProduct),
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
              {selectedProductId && !inventoryLotId.trim() ? (
                <p className="text-amber-700">Produto selecionado sem baixa de estoque.</p>
              ) : null}
              {selectedProduct?.warning ? (
                <p className="text-amber-700">{selectedProduct.warning}</p>
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
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger aria-label="Produto real">
                    <SelectValue placeholder="Selecionar produto cadastrado" />
                  </SelectTrigger>
                  <SelectContent>
                    {productOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {productRequired && productOptions.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    Nenhum produto sanitário cadastrado compatível encontrado.
                  </p>
                ) : null}
              </label>
              <div className="rounded-lg border border-border p-3 text-sm">
                <div className="text-muted-foreground">Classe do produto</div>
                <div className="font-medium">{commonProductClassLabel}</div>
              </div>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Via</span>
                <Input
                  aria-label="Via"
                  value={route}
                  onChange={(event) => setRoute(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Doses por animal</span>
                <Input
                  aria-label="Doses por animal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={dosesPerAnimal}
                  onChange={(event) => setDosesPerAnimal(event.target.value)}
                />
              </label>
              <div className="rounded-lg border border-border p-3 text-sm">
                <div className="text-muted-foreground">Doses previstas</div>
                <div className="font-medium">{plannedDoses} {formatUnit(executionUnit, plannedDoses)}</div>
              </div>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Doses extras/perda</span>
                <Input
                  aria-label="Doses extras/perda"
                  type="number"
                  min="0"
                  step="1"
                  value={extraDoses}
                  onChange={(event) => setExtraDoses(event.target.value)}
                />
              </label>
              <div className="rounded-lg border border-border p-3 text-sm">
                <div className="text-muted-foreground">Total de doses usadas</div>
                <div className="font-medium">{totalDoses} {formatUnit(executionUnit, totalDoses)}</div>
              </div>
              {hasDivergentSuggestions ? (
                <p className="text-sm text-amber-700 md:col-span-2">
                  Quantidade não preenchida automaticamente porque há divergência entre animais, produto ou unidade.
                </p>
              ) : null}
            </section>

            <section className="grid gap-3 md:grid-cols-2" aria-label="Estoque opcional">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Lote de estoque</span>
                <Select value={inventoryLotId} onValueChange={setInventoryLotId} disabled={compatibleLots.length === 0}>
                  <SelectTrigger aria-label="Lote de estoque">
                    <SelectValue placeholder={compatibleLots.length ? "Selecionar lote" : "Sem lote compatível"} />
                  </SelectTrigger>
                  <SelectContent>
                    {compatibleLots.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedLot ? (
                  <p className="text-xs text-muted-foreground">Saldo disponível: {selectedLot.balanceLabel}</p>
                ) : null}
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
