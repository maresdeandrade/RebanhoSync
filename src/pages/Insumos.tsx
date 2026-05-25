import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Boxes,
  Pencil,
  PackagePlus,
  Search,
  Save,
  ShoppingCart,
  SlidersHorizontal,
  Syringe,
  X,
} from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAuth } from "@/hooks/useAuth";
import {
  convertPresentationQuantityToBase,
  evaluateInventoryLotManualMovement,
  evaluateInventoryLotConsumption,
  evaluateNutritionalInventoryConsumptionReadiness,
  projectInventoryLotBalance,
} from "@/lib/inventory/inventoryContracts";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { pullDataForFarm } from "@/lib/offline/pull";
import type {
  Evento,
  EventoNutricao,
  EventoPastoAvaliacao,
  EventoSanitario,
  Insumo,
  InsumoApresentacao,
  InsumoLote,
  InsumoLoteStatusEnum,
  InsumoMovimentacao,
  InsumoMovimentacaoTipoEnum,
  InsumoTipoEnum,
  InsumoUnidadeBaseEnum,
  InsumoUnidadeCompraEnum,
  ProdutoVeterinarioCatalogEntry,
} from "@/lib/offline/types";
import { evaluateSanitaryInventoryConsumptionReadiness } from "@/lib/sanitario/compliance/inventoryConsumption";
import { refreshVeterinaryProductsCatalog } from "@/lib/sanitario/catalog/products";
import { showError, showSuccess } from "@/utils/toast";

type EntryForm = {
  tipo: InsumoTipoEnum;
  nome: string;
  categoria: string;
  produtoVeterinarioId: string;
  unidadeBase: InsumoUnidadeBaseEnum;
  unidadeCompra: InsumoUnidadeCompraEnum;
  apresentacaoNome: string;
  quantidadePorApresentacao: string;
  quantidadeEntrada: string;
  identificacaoLote: string;
  validade: string;
  fabricante: string;
  localArmazenamento: string;
};

type ConsumptionForm = {
  sourceKey: string;
  insumoLoteId: string;
  quantidadeBase: string;
  observacoes: string;
};

type ManualMovementForm = {
  insumoLoteId: string;
  tipo: Extract<
    InsumoMovimentacaoTipoEnum,
    "entrada" | "ajuste_positivo" | "ajuste_negativo"
  >;
  quantidadeBase: string;
  observacoes: string;
};

type LotEditForm = {
  lotId: string;
  insumoNome: string;
  categoria: string;
  ativo: boolean;
  apresentacaoNome: string;
  apresentacaoFabricante: string;
  identificacaoLote: string;
  validade: string;
  fabricante: string;
  localArmazenamento: string;
  status: InsumoLoteStatusEnum;
};

type InventorySnapshot = {
  insumos: Insumo[];
  apresentacoes: InsumoApresentacao[];
  lotes: InsumoLote[];
  movimentacoes: InsumoMovimentacao[];
  eventos: Evento[];
  sanitario: EventoSanitario[];
  nutricao: EventoNutricao[];
  pasto: EventoPastoAvaliacao[];
  produtos: ProdutoVeterinarioCatalogEntry[];
  pendingTxIds: Set<string>;
};

type SourceOption = {
  key: string;
  eventoId: string;
  dominio: "sanitario" | "nutricao" | "pastagem";
  label: string;
  quantityBase: number | null;
  unidadeBase: InsumoUnidadeBaseEnum | null;
  animalId: string | null;
  rebanhoLoteId: string | null;
  pastoId: string | null;
};

const NONE_VALUE = "__none__";

const EMPTY_ENTRY_FORM: EntryForm = {
  tipo: "nutricional",
  nome: "",
  categoria: "",
  produtoVeterinarioId: NONE_VALUE,
  unidadeBase: "kg",
  unidadeCompra: "saco",
  apresentacaoNome: "",
  quantidadePorApresentacao: "25",
  quantidadeEntrada: "1",
  identificacaoLote: "",
  validade: "",
  fabricante: "",
  localArmazenamento: "",
};

const EMPTY_CONSUMPTION_FORM: ConsumptionForm = {
  sourceKey: NONE_VALUE,
  insumoLoteId: NONE_VALUE,
  quantidadeBase: "",
  observacoes: "",
};

const EMPTY_MANUAL_MOVEMENT_FORM: ManualMovementForm = {
  insumoLoteId: NONE_VALUE,
  tipo: "entrada",
  quantidadeBase: "",
  observacoes: "",
};

const unidadeBaseOptions: Array<{ value: InsumoUnidadeBaseEnum; label: string }> = [
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "l", label: "L" },
  { value: "ml", label: "mL" },
  { value: "un", label: "un" },
  { value: "dose", label: "dose" },
];

const unidadeCompraOptions: Array<{
  value: InsumoUnidadeCompraEnum;
  label: string;
}> = [
  { value: "saco", label: "Saco" },
  { value: "frasco", label: "Frasco" },
  { value: "bombona", label: "Bombona" },
  { value: "caixa", label: "Caixa" },
  { value: "unidade", label: "Unidade" },
  { value: "dose", label: "Dose" },
  { value: "outro", label: "Outro" },
];

const loteStatusOptions: Array<{ value: InsumoLoteStatusEnum; label: string }> = [
  { value: "ativo", label: "Ativo" },
  { value: "esgotado", label: "Esgotado" },
  { value: "vencido", label: "Vencido" },
  { value: "bloqueado", label: "Bloqueado" },
];

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Sem validade";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function buildSourceOptions(snapshot: InventorySnapshot): SourceOption[] {
  const sanitarioByEvento = new Map(
    snapshot.sanitario.map((detail) => [detail.evento_id, detail]),
  );
  const nutricaoByEvento = new Map(
    snapshot.nutricao.map((detail) => [detail.evento_id, detail]),
  );
  const pastoByEvento = new Map(
    snapshot.pasto.map((detail) => [detail.evento_id, detail]),
  );

  return snapshot.eventos
    .flatMap((event): SourceOption[] => {
      if (event.deleted_at) return [];

      if (event.dominio === "sanitario") {
        const detail = sanitarioByEvento.get(event.id);
        const readiness = evaluateSanitaryInventoryConsumptionReadiness({
          event,
          sanitaryDetail: detail,
        });
        if (!readiness.canCreateManualMovement) return [];

        return [
          {
            key: `${event.id}:sanitario`,
            eventoId: event.id,
            dominio: "sanitario",
            label: `${formatEventDate(event.occurred_at)} · Sanitario · ${readiness.productName}`,
            quantityBase: null,
            unidadeBase: null,
            animalId: event.animal_id,
            rebanhoLoteId: event.lote_id,
            pastoId: null,
          },
        ];
      }

      if (event.dominio === "nutricao") {
        const readiness = evaluateNutritionalInventoryConsumptionReadiness({
          event,
          nutricaoDetail: nutricaoByEvento.get(event.id),
        });
        if (!readiness.canCreateManualMovement || !readiness.quantityBase) return [];

        return [
          {
            key: `${event.id}:nutricao`,
            eventoId: event.id,
            dominio: "nutricao",
            label: `${formatEventDate(event.occurred_at)} · Nutricao · ${formatNumber(readiness.quantityBase)} kg`,
            quantityBase: readiness.quantityBase,
            unidadeBase: readiness.unidadeBase,
            animalId: event.animal_id,
            rebanhoLoteId: event.lote_id,
            pastoId: null,
          },
        ];
      }

      if (event.dominio === "pastagem") {
        const detail = pastoByEvento.get(event.id);
        const readiness = evaluateNutritionalInventoryConsumptionReadiness({
          event,
          pastoDetail: detail,
        });
        if (!readiness.canCreateManualMovement || !readiness.quantityBase) return [];

        return [
          {
            key: `${event.id}:pastagem`,
            eventoId: event.id,
            dominio: "pastagem",
            label: `${formatEventDate(event.occurred_at)} · Pasto · ${formatNumber(readiness.quantityBase)} kg`,
            quantityBase: readiness.quantityBase,
            unidadeBase: readiness.unidadeBase,
            animalId: event.animal_id,
            rebanhoLoteId: event.lote_id ?? detail?.lote_id ?? null,
            pastoId: detail?.pasto_id ?? null,
          },
        ];
      }

      return [];
    })
    .sort((a, b) => b.eventoId.localeCompare(a.eventoId));
}

function computeLotBalance(
  lot: InsumoLote,
  movements: InsumoMovimentacao[],
  pendingTxIds: Set<string>,
) {
  const pendingMovements = movements.filter(
    (movement) =>
      movement.insumo_lote_id === lot.id &&
      movement.client_tx_id &&
      pendingTxIds.has(movement.client_tx_id),
  );

  return projectInventoryLotBalance({
    saldoAtualBase: lot.saldo_atual_base,
    movements: pendingMovements,
  });
}

function buildLotEditForm(
  lot: InsumoLote,
  insumo: Insumo | undefined,
  apresentacao: InsumoApresentacao | undefined,
): LotEditForm {
  return {
    lotId: lot.id,
    insumoNome: insumo?.nome ?? "",
    categoria: insumo?.categoria ?? "",
    ativo: insumo?.ativo ?? true,
    apresentacaoNome: apresentacao?.nome ?? "",
    apresentacaoFabricante: apresentacao?.fabricante ?? "",
    identificacaoLote: lot.identificacao_lote ?? "",
    validade: lot.validade ?? "",
    fabricante: lot.fabricante ?? "",
    localArmazenamento: lot.local_armazenamento ?? "",
    status: lot.status,
  };
}

export default function Insumos() {
  const { activeFarmId, role } = useAuth();
  const canManage = role === "owner" || role === "manager";
  const [search, setSearch] = useState("");
  const [entryForm, setEntryForm] = useState<EntryForm>(EMPTY_ENTRY_FORM);
  const [consumptionForm, setConsumptionForm] = useState<ConsumptionForm>(
    EMPTY_CONSUMPTION_FORM,
  );
  const [manualMovementForm, setManualMovementForm] =
    useState<ManualMovementForm>(EMPTY_MANUAL_MOVEMENT_FORM);
  const [savingEntry, setSavingEntry] = useState(false);
  const [savingManualMovement, setSavingManualMovement] = useState(false);
  const [savingConsumption, setSavingConsumption] = useState(false);

  useEffect(() => {
    refreshVeterinaryProductsCatalog().catch((error) => {
      console.warn("[insumos] Falha ao atualizar catalogo veterinario", error);
    });
  }, []);

  useEffect(() => {
    if (!activeFarmId) return;

    pullDataForFarm(
      activeFarmId,
      [
        "eventos",
        "eventos_sanitario",
        "eventos_nutricao",
        "eventos_pasto_avaliacao",
      ],
      { mode: "merge" },
    ).catch((error) => {
      console.warn("[insumos] Falha ao atualizar eventos fonte", error);
    });
  }, [activeFarmId]);

  const snapshot =
    useLiveQuery<InventorySnapshot | null>(async () => {
      if (!activeFarmId) return null;
      const [
        insumos,
        lotes,
        movimentacoes,
        eventos,
        sanitario,
        nutricao,
        pasto,
        produtos,
        gestures,
      ] = await Promise.all([
        db.state_insumos.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_insumo_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_insumo_movimentacoes
          .where("fazenda_id")
          .equals(activeFarmId)
          .toArray(),
        db.event_eventos.where("fazenda_id").equals(activeFarmId).toArray(),
        db.event_eventos_sanitario
          .where("fazenda_id")
          .equals(activeFarmId)
          .toArray(),
        db.event_eventos_nutricao
          .where("fazenda_id")
          .equals(activeFarmId)
          .toArray(),
        db.event_eventos_pasto_avaliacao
          .where("fazenda_id")
          .equals(activeFarmId)
          .toArray(),
        db.catalog_produtos_veterinarios.toArray(),
        db.queue_gestures.where("fazenda_id").equals(activeFarmId).toArray(),
      ]);

      return {
        insumos: insumos.filter((item) => !item.deleted_at),
        lotes: lotes.filter((item) => !item.deleted_at),
        movimentacoes: movimentacoes.filter((item) => !item.deleted_at),
        eventos,
        sanitario: sanitario.filter((item) => !item.deleted_at),
        nutricao: nutricao.filter((item) => !item.deleted_at),
        pasto: pasto.filter((item) => !item.deleted_at),
        produtos,
        pendingTxIds: new Set(
          gestures
            .filter(
              (gesture) =>
                gesture.status !== "DONE" && gesture.status !== "SYNCED",
            )
            .map((gesture) => gesture.client_tx_id),
        ),
      };
    }, [activeFarmId]) ?? null;

  const insumoById = useMemo(
    () => new Map((snapshot?.insumos ?? []).map((item) => [item.id, item])),
    [snapshot?.insumos],
  );

  const sourceOptions = useMemo(
    () => (snapshot ? buildSourceOptions(snapshot) : []),
    [snapshot],
  );

  const lotRows = useMemo(() => {
    if (!snapshot) return [];
    const searchLower = search.trim().toLowerCase();

    return snapshot.lotes
      .map((lot) => {
        const insumo = insumoById.get(lot.insumo_id);
        const saldoOperacional = computeLotBalance(
          lot,
          snapshot.movimentacoes,
          snapshot.pendingTxIds,
        );
        return { lot, insumo, saldoOperacional };
      })
      .filter(({ lot, insumo }) => {
        if (!searchLower) return true;
        return [
          insumo?.nome ?? "",
          insumo?.categoria ?? "",
          lot.identificacao_lote ?? "",
          lot.fabricante ?? "",
          lot.local_armazenamento ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchLower);
      })
      .sort((a, b) => (a.insumo?.nome ?? "").localeCompare(b.insumo?.nome ?? ""));
  }, [insumoById, search, snapshot]);

  const selectedSource = sourceOptions.find(
    (source) => source.key === consumptionForm.sourceKey,
  );
  const selectedLot = snapshot?.lotes.find(
    (lot) => lot.id === consumptionForm.insumoLoteId,
  );
  const selectedLotBalance = selectedLot
    ? computeLotBalance(
        selectedLot,
        snapshot?.movimentacoes ?? [],
        snapshot?.pendingTxIds ?? new Set(),
      )
    : null;
  const selectedManualMovementLot = snapshot?.lotes.find(
    (lot) => lot.id === manualMovementForm.insumoLoteId,
  );
  const selectedManualMovementLotBalance = selectedManualMovementLot
    ? computeLotBalance(
        selectedManualMovementLot,
        snapshot?.movimentacoes ?? [],
        snapshot?.pendingTxIds ?? new Set(),
      )
    : null;

  const filteredLotesForConsumption = useMemo(() => {
    if (!snapshot || !selectedSource) return [];
    const expectedType =
      selectedSource.dominio === "sanitario" ? "sanitario" : "nutricional";

    return snapshot.lotes.filter((lot) => {
      const insumo = insumoById.get(lot.insumo_id);
      return lot.status === "ativo" && insumo?.tipo === expectedType;
    });
  }, [insumoById, selectedSource, snapshot]);

  function setEntryField<K extends keyof EntryForm>(field: K, value: EntryForm[K]) {
    setEntryForm((prev) => ({ ...prev, [field]: value }));
  }

  function setConsumptionField<K extends keyof ConsumptionForm>(
    field: K,
    value: ConsumptionForm[K],
  ) {
    setConsumptionForm((prev) => ({ ...prev, [field]: value }));
  }

  function setManualMovementField<K extends keyof ManualMovementForm>(
    field: K,
    value: ManualMovementForm[K],
  ) {
    setManualMovementForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreateEntry() {
    if (savingEntry) return;
    if (!activeFarmId) {
      showError("Selecione uma fazenda ativa.");
      return;
    }
    if (!canManage) {
      showError("Apenas owner/manager pode cadastrar insumos e entradas.");
      return;
    }
    if (!entryForm.nome.trim()) {
      showError("Nome do insumo e obrigatorio.");
      return;
    }
    if (
      entryForm.tipo === "sanitario" &&
      entryForm.produtoVeterinarioId === NONE_VALUE
    ) {
      showError("Insumo sanitario exige produto veterinario catalogado.");
      return;
    }

    const quantidadePorApresentacao = parsePositiveNumber(
      entryForm.quantidadePorApresentacao,
    );
    const quantidadeEntrada = parsePositiveNumber(entryForm.quantidadeEntrada);

    if (!quantidadePorApresentacao || !quantidadeEntrada) {
      showError("Quantidade de entrada e apresentacao devem ser maiores que zero.");
      return;
    }

    const quantidadeBase = convertPresentationQuantityToBase({
      presentationQuantity: quantidadeEntrada,
      presentationBaseQuantity: quantidadePorApresentacao,
    });
    const now = new Date().toISOString();
    const insumoId = crypto.randomUUID();
    const apresentacaoId = crypto.randomUUID();
    const loteId = crypto.randomUUID();
    const movimentoId = crypto.randomUUID();

    setSavingEntry(true);
    try {
      await createGesture(activeFarmId, [
        {
          table: "insumos",
          action: "INSERT",
          record: {
            id: insumoId,
            nome: entryForm.nome.trim(),
            tipo: entryForm.tipo,
            categoria: entryForm.categoria.trim() || null,
            produto_veterinario_id:
              entryForm.tipo === "sanitario"
                ? entryForm.produtoVeterinarioId
                : null,
            unidade_base: entryForm.unidadeBase,
            ativo: true,
            payload: { origem: "inventario_ui_mvp" },
          },
        },
        {
          table: "insumo_apresentacoes",
          action: "INSERT",
          record: {
            id: apresentacaoId,
            insumo_id: insumoId,
            nome:
              entryForm.apresentacaoNome.trim() ||
              `${entryForm.unidadeCompra} ${formatNumber(quantidadePorApresentacao)} ${entryForm.unidadeBase}`,
            unidade_compra: entryForm.unidadeCompra,
            quantidade_base: quantidadePorApresentacao,
            unidade_base: entryForm.unidadeBase,
            codigo_barras: null,
            fabricante: entryForm.fabricante.trim() || null,
            payload: { origem: "inventario_ui_mvp" },
          },
        },
        {
          table: "insumo_lotes",
          action: "INSERT",
          record: {
            id: loteId,
            insumo_id: insumoId,
            apresentacao_id: apresentacaoId,
            identificacao_lote: entryForm.identificacaoLote.trim() || null,
            validade: entryForm.validade || null,
            fabricante: entryForm.fabricante.trim() || null,
            local_armazenamento: entryForm.localArmazenamento.trim() || null,
            quantidade_inicial_base: quantidadeBase,
            saldo_atual_base: 0,
            unidade_base: entryForm.unidadeBase,
            status: "ativo",
            payload: { origem: "inventario_ui_mvp" },
          },
        },
        {
          table: "insumo_movimentacoes",
          action: "INSERT",
          record: {
            id: movimentoId,
            insumo_id: insumoId,
            insumo_lote_id: loteId,
            tipo: "entrada",
            quantidade_base: quantidadeBase,
            unidade_base: entryForm.unidadeBase,
            occurred_at: now,
            source_evento_id: null,
            source_evento_dominio: null,
            animal_id: null,
            rebanho_lote_id: null,
            pasto_id: null,
            observacoes: "Entrada inicial",
            payload: {
              origem: "inventario_ui_mvp",
              quantidade_apresentacoes: quantidadeEntrada,
              unidade_compra: entryForm.unidadeCompra,
              quantidade_por_apresentacao: quantidadePorApresentacao,
            },
          },
        },
      ]);

      setEntryForm(EMPTY_ENTRY_FORM);
      showSuccess("Entrada de insumo criada. Sincronizacao pendente.");
    } catch {
      showError("Falha ao criar entrada de insumo.");
    } finally {
      setSavingEntry(false);
    }
  }

  async function handleCreateManualMovement() {
    if (savingManualMovement) return;
    if (!activeFarmId) {
      showError("Selecione uma fazenda ativa.");
      return;
    }
    if (!canManage) {
      showError("Apenas owner/manager pode registrar entradas e ajustes.");
      return;
    }
    if (!selectedManualMovementLot) {
      showError("Selecione um lote de estoque.");
      return;
    }

    const quantidadeBase = parsePositiveNumber(manualMovementForm.quantidadeBase);
    if (!quantidadeBase) {
      showError("Quantidade da movimentacao deve ser maior que zero.");
      return;
    }

    const saldoAtualBase =
      selectedManualMovementLotBalance ??
      selectedManualMovementLot.saldo_atual_base;
    const movementCheck = evaluateInventoryLotManualMovement({
      lot: {
        ...selectedManualMovementLot,
        saldo_atual_base: saldoAtualBase,
      },
      tipo: manualMovementForm.tipo,
      quantidadeBase,
      unidadeBase: selectedManualMovementLot.unidade_base,
    });

    if (!movementCheck.canRegister) {
      showError(movementCheck.reason);
      return;
    }

    setSavingManualMovement(true);
    try {
      await createGesture(activeFarmId, [
        {
          table: "insumo_movimentacoes",
          action: "INSERT",
          record: {
            id: crypto.randomUUID(),
            insumo_id: selectedManualMovementLot.insumo_id,
            insumo_lote_id: selectedManualMovementLot.id,
            tipo: manualMovementForm.tipo,
            quantidade_base: quantidadeBase,
            unidade_base: selectedManualMovementLot.unidade_base,
            occurred_at: new Date().toISOString(),
            source_evento_id: null,
            source_evento_dominio: null,
            animal_id: null,
            rebanho_lote_id: null,
            pasto_id: null,
            observacoes: manualMovementForm.observacoes.trim() || null,
            payload: { origem: "inventario_ui_mvp", fluxo: "movimentacao_manual" },
          },
        },
      ]);

      setManualMovementForm(EMPTY_MANUAL_MOVEMENT_FORM);
      showSuccess("Movimentacao de estoque registrada. Sincronizacao pendente.");
    } catch {
      showError("Falha ao registrar movimentacao de estoque.");
    } finally {
      setSavingManualMovement(false);
    }
  }

  async function handleCreateConsumption() {
    if (savingConsumption) return;
    if (!activeFarmId) {
      showError("Selecione uma fazenda ativa.");
      return;
    }
    if (!selectedSource) {
      showError("Selecione um evento confirmado.");
      return;
    }
    if (!selectedLot) {
      showError("Selecione um lote de estoque.");
      return;
    }

    const quantidadeBase = parsePositiveNumber(consumptionForm.quantidadeBase);
    if (!quantidadeBase) {
      showError("Quantidade de consumo deve ser maior que zero.");
      return;
    }

    const saldoAtualBase = selectedLotBalance ?? selectedLot.saldo_atual_base;
    const lotCheck = evaluateInventoryLotConsumption({
      lot: { ...selectedLot, saldo_atual_base: saldoAtualBase },
      quantidadeBase,
      unidadeBase: selectedLot.unidade_base,
    });

    if (!lotCheck.canConsume) {
      showError(lotCheck.reason);
      return;
    }

    setSavingConsumption(true);
    try {
      await createGesture(activeFarmId, [
        {
          table: "insumo_movimentacoes",
          action: "INSERT",
          record: {
            id: crypto.randomUUID(),
            insumo_id: selectedLot.insumo_id,
            insumo_lote_id: selectedLot.id,
            tipo:
              selectedSource.dominio === "sanitario"
                ? "consumo_sanitario"
                : "consumo_nutricao",
            quantidade_base: quantidadeBase,
            unidade_base: selectedLot.unidade_base,
            occurred_at: new Date().toISOString(),
            source_evento_id: selectedSource.eventoId,
            source_evento_dominio: selectedSource.dominio,
            animal_id: selectedSource.animalId,
            rebanho_lote_id: selectedSource.rebanhoLoteId,
            pasto_id: selectedSource.pastoId,
            observacoes: consumptionForm.observacoes.trim() || null,
            payload: { origem: "inventario_ui_mvp" },
          },
        },
      ]);

      setConsumptionForm(EMPTY_CONSUMPTION_FORM);
      showSuccess("Consumo de insumo registrado. Sincronizacao pendente.");
    } catch {
      showError("Falha ao registrar consumo de insumo.");
    } finally {
      setSavingConsumption(false);
    }
  }

  if (!activeFarmId) {
    return (
      <EmptyState
        icon={Boxes}
        title="Selecione uma fazenda"
        description="O inventario depende de uma fazenda ativa."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageIntro
        variant="plain"
        eyebrow="Gestao"
        title="Inventario"
        meta={
          <>
            <StatusBadge tone="neutral">
              {snapshot?.insumos.length ?? 0} insumo(s)
            </StatusBadge>
            <StatusBadge tone="info">
              {snapshot?.lotes.length ?? 0} lote(s)
            </StatusBadge>
            <StatusBadge tone="success">
              {sourceOptions.length} evento(s) elegivel(is)
            </StatusBadge>
          </>
        }
      />

      <FormSection
        title="Entrada inicial"
        actions={
          !canManage ? <StatusBadge tone="warning">Somente leitura</StatusBadge> : null
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={entryForm.tipo}
              onValueChange={(value) =>
                setEntryField("tipo", value as InsumoTipoEnum)
              }
              disabled={!canManage}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nutricional">Nutricional</SelectItem>
                <SelectItem value="sanitario">Sanitario</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Insumo</Label>
            <Input
              value={entryForm.nome}
              onChange={(event) => setEntryField("nome", event.target.value)}
              disabled={!canManage}
              placeholder="Ex.: Sal mineral, vacina, vermifugo"
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Input
              value={entryForm.categoria}
              onChange={(event) =>
                setEntryField("categoria", event.target.value)
              }
              disabled={!canManage}
              placeholder="Ex.: suplemento, vacina"
            />
          </div>

          {entryForm.tipo === "sanitario" ? (
            <div className="space-y-2">
              <Label>Produto veterinario</Label>
              <Select
                value={entryForm.produtoVeterinarioId}
                onValueChange={(value) =>
                  setEntryField("produtoVeterinarioId", value)
                }
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Selecionar</SelectItem>
                  {(snapshot?.produtos ?? []).map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Unidade base</Label>
            <Select
              value={entryForm.unidadeBase}
              onValueChange={(value) =>
                setEntryField("unidadeBase", value as InsumoUnidadeBaseEnum)
              }
              disabled={!canManage}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unidadeBaseOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Unidade de compra</Label>
            <Select
              value={entryForm.unidadeCompra}
              onValueChange={(value) =>
                setEntryField("unidadeCompra", value as InsumoUnidadeCompraEnum)
              }
              disabled={!canManage}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unidadeCompraOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Apresentacao</Label>
            <Input
              value={entryForm.apresentacaoNome}
              onChange={(event) =>
                setEntryField("apresentacaoNome", event.target.value)
              }
              disabled={!canManage}
              placeholder="Ex.: Saco 25 kg"
            />
          </div>

          <div className="space-y-2">
            <Label>Qtd. por apresentacao</Label>
            <Input
              inputMode="decimal"
              value={entryForm.quantidadePorApresentacao}
              onChange={(event) =>
                setEntryField("quantidadePorApresentacao", event.target.value)
              }
              disabled={!canManage}
            />
          </div>

          <div className="space-y-2">
            <Label>Qtd. entrada</Label>
            <Input
              inputMode="decimal"
              value={entryForm.quantidadeEntrada}
              onChange={(event) =>
                setEntryField("quantidadeEntrada", event.target.value)
              }
              disabled={!canManage}
            />
          </div>

          <div className="space-y-2">
            <Label>Lote</Label>
            <Input
              value={entryForm.identificacaoLote}
              onChange={(event) =>
                setEntryField("identificacaoLote", event.target.value)
              }
              disabled={!canManage}
              placeholder="Ex.: fabricante/partida"
            />
          </div>

          <div className="space-y-2">
            <Label>Validade</Label>
            <Input
              type="date"
              value={entryForm.validade}
              onChange={(event) =>
                setEntryField("validade", event.target.value)
              }
              disabled={!canManage}
            />
          </div>

          <div className="space-y-2">
            <Label>Fabricante</Label>
            <Input
              value={entryForm.fabricante}
              onChange={(event) =>
                setEntryField("fabricante", event.target.value)
              }
              disabled={!canManage}
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label>Local</Label>
            <Input
              value={entryForm.localArmazenamento}
              onChange={(event) =>
                setEntryField("localArmazenamento", event.target.value)
              }
              disabled={!canManage}
              placeholder="Ex.: deposito, sala de medicamentos"
            />
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              className="w-full gap-2"
              onClick={handleCreateEntry}
              disabled={!canManage || savingEntry}
            >
              <PackagePlus className="h-4 w-4" />
              Registrar entrada
            </Button>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Entrada ou ajuste de lote"
        actions={
          selectedManualMovementLot ? (
            <StatusBadge tone="neutral">
              Saldo {formatNumber(selectedManualMovementLotBalance ?? 0)}{" "}
              {selectedManualMovementLot.unidade_base}
            </StatusBadge>
          ) : null
        }
      >
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="space-y-2 lg:col-span-2">
            <Label>Lote existente</Label>
            <Select
              value={manualMovementForm.insumoLoteId}
              onValueChange={(value) =>
                setManualMovementField("insumoLoteId", value)
              }
              disabled={!canManage}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Selecionar</SelectItem>
                {lotRows.map(({ lot, insumo, saldoOperacional }) => (
                  <SelectItem key={lot.id} value={lot.id}>
                    {insumo?.nome ?? "Insumo"} ·{" "}
                    {lot.identificacao_lote || "sem lote"} ·{" "}
                    {formatNumber(saldoOperacional)} {lot.unidade_base}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Movimento</Label>
            <Select
              value={manualMovementForm.tipo}
              onValueChange={(value) =>
                setManualMovementField(
                  "tipo",
                  value as ManualMovementForm["tipo"],
                )
              }
              disabled={!canManage}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="ajuste_positivo">Ajuste positivo</SelectItem>
                <SelectItem value="ajuste_negativo">Ajuste negativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantidade</Label>
            <Input
              inputMode="decimal"
              value={manualMovementForm.quantidadeBase}
              onChange={(event) =>
                setManualMovementField("quantidadeBase", event.target.value)
              }
              disabled={!canManage}
              placeholder={selectedManualMovementLot?.unidade_base ?? ""}
            />
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              className="w-full gap-2"
              onClick={handleCreateManualMovement}
              disabled={
                !canManage ||
                savingManualMovement ||
                !selectedManualMovementLot
              }
            >
              <SlidersHorizontal className="h-4 w-4" />
              Registrar movimento
            </Button>
          </div>

          <div className="space-y-2 lg:col-span-4">
            <Label>Observacao</Label>
            <Input
              value={manualMovementForm.observacoes}
              onChange={(event) =>
                setManualMovementField("observacoes", event.target.value)
              }
              disabled={!canManage}
              placeholder="Ex.: compra complementar, quebra, inventario fisico"
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Consumo por evento">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label>Evento</Label>
            <Select
              value={consumptionForm.sourceKey}
              onValueChange={(value) => {
                const source = sourceOptions.find((item) => item.key === value);
                setConsumptionForm((prev) => ({
                  ...prev,
                  sourceKey: value,
                  insumoLoteId: NONE_VALUE,
                  quantidadeBase: source?.quantityBase
                    ? String(source.quantityBase)
                    : prev.quantidadeBase,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Selecionar</SelectItem>
                {sourceOptions.map((source) => (
                  <SelectItem key={source.key} value={source.key}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Lote de estoque</Label>
            <Select
              value={consumptionForm.insumoLoteId}
              onValueChange={(value) => setConsumptionField("insumoLoteId", value)}
              disabled={!selectedSource}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Selecionar</SelectItem>
                {filteredLotesForConsumption.map((lot) => {
                  const insumo = insumoById.get(lot.insumo_id);
                  const saldo = computeLotBalance(
                    lot,
                    snapshot?.movimentacoes ?? [],
                    snapshot?.pendingTxIds ?? new Set(),
                  );
                  return (
                    <SelectItem key={lot.id} value={lot.id}>
                      {insumo?.nome ?? "Insumo"} · {formatNumber(saldo)}{" "}
                      {lot.unidade_base}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantidade</Label>
            <Input
              inputMode="decimal"
              value={consumptionForm.quantidadeBase}
              onChange={(event) =>
                setConsumptionField("quantidadeBase", event.target.value)
              }
              placeholder={selectedLot?.unidade_base ?? ""}
            />
          </div>

          <div className="space-y-2 lg:col-span-3">
            <Label>Observacao</Label>
            <Input
              value={consumptionForm.observacoes}
              onChange={(event) =>
                setConsumptionField("observacoes", event.target.value)
              }
            />
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              className="w-full gap-2"
              onClick={handleCreateConsumption}
              disabled={savingConsumption || !selectedSource}
            >
              <ShoppingCart className="h-4 w-4" />
              Registrar consumo
            </Button>
          </div>
        </div>
      </FormSection>

      <Toolbar>
        <ToolbarGroup className="w-full">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar insumo, lote, local"
              className="pl-9"
            />
          </div>
        </ToolbarGroup>
      </Toolbar>

      {lotRows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Sem lotes de estoque"
          description="As entradas registradas aparecem aqui."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lotRows.map(({ lot, insumo, saldoOperacional }) => (
            <Card key={lot.id} className="rounded-lg shadow-none">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-foreground">
                        {insumo?.nome ?? "Insumo sem cadastro"}
                      </h2>
                      <StatusBadge tone={insumo?.tipo === "sanitario" ? "info" : "success"}>
                        {insumo?.tipo === "sanitario" ? "Sanitario" : insumo?.tipo === "nutricional" ? "Nutricional" : "Outro"}
                      </StatusBadge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lot.identificacao_lote || "Lote sem identificacao"} ·{" "}
                      {formatDate(lot.validade)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2">
                    <Syringe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">
                      {formatNumber(saldoOperacional)} {lot.unidade_base}
                    </span>
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                  <span>{lot.status}</span>
                  <span>{lot.fabricante || "Sem fabricante"}</span>
                  <span>{lot.local_armazenamento || "Sem local"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
