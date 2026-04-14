import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ClipboardList,
  Info,
  Link2,
  PencilLine,
  Pill,
  Plus,
  Syringe,
  Trash2,
} from "lucide-react";

import { FormSection } from "@/components/ui/form-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FarmExperienceMode } from "@/lib/farms/experienceMode";
import { createGesture } from "@/lib/offline/ops";
import { pullDataForFarm } from "@/lib/offline/pull";
import type {
  OperationInput,
  ProdutoVeterinarioCatalogEntry,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
  SanitarioTipoEnum,
} from "@/lib/offline/types";
import {
  buildProtocolInsertRecord,
  buildProtocolItemInsertRecord,
  buildProtocolItemUpdateRecord,
  buildProtocolUpdateRecord,
  createEmptyProtocolDraft,
  createEmptyProtocolItemDraft,
  readProtocolDraft,
  readProtocolItemDraft,
  type SanitaryProtocolDraft,
  type SanitaryProtocolItemDraft,
  validateProtocolDraft,
  validateProtocolItemDraft,
} from "@/lib/sanitario/customization";
import {
  STANDARD_PROTOCOLS,
  buildStandardProtocolItemPayload,
  buildStandardProtocolPayload,
  normalizeStandardProtocolInterval,
  type StandardProtocol,
  type StandardProtocolCategory,
  type StandardProtocolLegalStatus,
} from "@/lib/sanitario/baseProtocols";
import {
  buildVeterinaryProductMetadataPatch,
  buildVeterinaryProductMetadata,
  normalizeVeterinaryProductText,
  readVeterinaryProductSelection,
  resolveVeterinaryProductByName,
  searchVeterinaryProducts,
  type VeterinaryProductSelection,
} from "@/lib/sanitario/products";
import {
  describeSanitaryCalendarSchedule,
  type SanitaryBaseCalendarAnchor,
  type SanitaryBaseCalendarMode,
} from "@/lib/sanitario/calendar";
import {
  buildSanitaryRegimenDedupTemplate,
  inferSanitaryRegimenMilestone,
} from "@/lib/sanitario/regimen";
import {
  buildSanitaryFamilyCoverageIndex,
  findSanitaryFamilyConflict,
  hasOfficialFamilyCoverage,
  normalizeSanitaryFamilyCode,
  readSanitaryProtocolFamilyCode,
  resolveSanitaryProtocolLayer,
  type SanitaryFamilyConflict,
  type SanitaryProtocolLayer,
} from "@/lib/sanitario/protocolLayers";
import { showError, showSuccess } from "@/utils/toast";

interface FarmProtocolManagerProps {
  activeFarmId: string;
  farmExperienceMode: FarmExperienceMode;
  catalogProducts: ProdutoVeterinarioCatalogEntry[];
  protocols: ProtocoloSanitario[];
  protocolItems: ProtocoloSanitarioItem[];
  canManage: boolean;
}

interface ProtocolEditorState {
  protocol: ProtocoloSanitario | null;
  draft: SanitaryProtocolDraft;
}

interface ItemEditorState {
  item: ProtocoloSanitarioItem | null;
  protocolId: string;
  draft: SanitaryProtocolItemDraft;
  selectedProduct: VeterinaryProductSelection | null;
}

const SEX_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "F", label: "Femeas" },
  { value: "M", label: "Machos" },
] as const;

const CALENDAR_MODE_OPTIONS: Array<{
  value: SanitaryBaseCalendarMode;
  label: string;
}> = [
  { value: "rotina_recorrente", label: "Rotina recorrente" },
  { value: "campanha", label: "Campanha" },
  { value: "janela_etaria", label: "Janela etaria" },
  { value: "procedimento_imediato", label: "Procedimento imediato" },
  { value: "nao_estruturado", label: "Nao estruturado" },
];

const CALENDAR_ANCHOR_OPTIONS: Array<{
  value: SanitaryBaseCalendarAnchor;
  label: string;
}> = [
  { value: "sem_ancora", label: "Sem ancora" },
  { value: "nascimento", label: "Nascimento" },
  { value: "desmama", label: "Desmama" },
  { value: "parto_previsto", label: "Parto previsto" },
  { value: "entrada_fazenda", label: "Entrada na fazenda" },
  { value: "movimentacao", label: "Movimentacao" },
  { value: "diagnostico_evento", label: "Diagnostico de evento" },
  { value: "conclusao_etapa_dependente", label: "Conclusao de etapa anterior" },
  { value: "ultima_conclusao_mesma_familia", label: "Ultima conclusao da mesma familia" },
];

const TYPE_META: Record<
  SanitarioTipoEnum,
  { label: string; icon: typeof Syringe; tone: string }
> = {
  vacinacao: {
    label: "Vacinacao",
    icon: Syringe,
    tone: "bg-blue-50 text-blue-700 border-blue-200",
  },
  vermifugacao: {
    label: "Vermifugacao",
    icon: Bug,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  medicamento: {
    label: "Medicamento",
    icon: Pill,
    tone: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

const TEMPLATE_CATEGORY_META: Record<
  StandardProtocolCategory,
  {
    label: string;
    description: string;
    icon: typeof Syringe;
  }
> = {
  vacinas: {
    label: "Vacinas tecnicas",
    description:
      "Protocolos preventivos recomendados que nao pertencem ao pack oficial.",
    icon: Syringe,
  },
  vermifugacao: {
    label: "Parasitas",
    description:
      "Rotinas de controle estrategico por categoria, estacao e pressao parasitaria.",
    icon: Bug,
  },
  medicamentos: {
    label: "Protocolos clinicos e de manejo",
    description:
      "Fluxos terapeuticos e boas praticas operacionais materializados como protocolo.",
    icon: Pill,
  },
};

type FarmProtocolSourceGroup = SanitaryProtocolLayer;

function readString(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getStandardProtocolLegalStatusLabel(status: StandardProtocolLegalStatus) {
  return status === "boa_pratica" ? "Boa pratica" : "Recomendado";
}

function getStandardProtocolLegalStatusVariant(
  status: StandardProtocolLegalStatus,
): "outline" | "secondary" {
  return status === "boa_pratica" ? "outline" : "secondary";
}

function resolveProtocolSourceGroup(
  protocol: Pick<ProtocoloSanitario, "payload">,
): FarmProtocolSourceGroup {
  return resolveSanitaryProtocolLayer(protocol.payload);
}

function getProtocolSourceMeta(group: FarmProtocolSourceGroup) {
  if (group === "official") {
    return {
      label: "Pack oficial",
      description:
        "Materializados da base oficial e ajustados localmente pela fazenda.",
    };
  }

  if (group === "standard") {
    return {
      label: "Template canonico",
      description:
        "Importados da biblioteca canonica de protocolos operacionais da fazenda.",
    };
  }

  return {
    label: "Customizado",
    description:
      "Criados diretamente pela fazenda para cobrir rotinas proprias ou locais.",
  };
}

function getProtocolSourceOrder(protocol: Pick<ProtocoloSanitario, "payload">) {
  const group = resolveProtocolSourceGroup(protocol);
  if (group === "official") return 0;
  if (group === "standard") return 1;
  return 2;
}

function getFamilyConflictMessage(
  group: SanitaryProtocolLayer,
  familyCode: string,
  conflict?: Pick<SanitaryFamilyConflict, "reason"> | null,
) {
  if (conflict?.reason === "official_family_already_active") {
    if (group === "standard") {
      return `A familia protocolar "${familyCode}" ja esta coberta pelo Pack oficial. O template canonico nao pode duplicar esse tronco regulatorio.`;
    }

    if (group === "custom") {
      return `A familia protocolar "${familyCode}" ja esta coberta pelo Pack oficial. Crie apenas o complemento operacional com outra familia, sem abrir agenda paralela para a mesma obrigacao oficial.`;
    }
  }

  if (group === "standard") {
    return `A familia protocolar "${familyCode}" ja esta coberta na fazenda. O template canonico nao pode duplicar esse tronco.`;
  }

  if (group === "custom") {
    return `A familia protocolar "${familyCode}" ja esta ativa na fazenda. Use um complemento operacional com outra familia, em vez de duplicar a mesma agenda central.`;
  }

  return `A familia protocolar "${familyCode}" ja esta ativa.`;
}

function buildDefaultMilestoneCode(sequenceOrder: number | string | null | undefined) {
  const numeric =
    typeof sequenceOrder === "number"
      ? sequenceOrder
      : typeof sequenceOrder === "string" && sequenceOrder.trim().length > 0
        ? Number(sequenceOrder)
        : NaN;

  if (!Number.isFinite(numeric) || numeric < 1) {
    return "dose_1";
  }

  return `dose_${Math.trunc(numeric)}`;
}

function resolveDraftMilestoneCode(
  draft: Pick<SanitaryProtocolItemDraft, "itemCode" | "doseNum">,
) {
  return (
    normalizeSanitaryFamilyCode(draft.itemCode) ??
    buildDefaultMilestoneCode(draft.doseNum)
  );
}

function resolveDraftProtocolFamilyCode(
  draft: Pick<SanitaryProtocolDraft, "familyCode" | "nome">,
) {
  return (
    normalizeSanitaryFamilyCode(draft.familyCode) ??
    normalizeSanitaryFamilyCode(draft.nome)
  );
}

function summarizeTarget(
  sexoAlvo: string,
  idadeMinDias: string,
  idadeMaxDias: string,
) {
  const sexLabel =
    sexoAlvo === "F"
      ? "Femeas"
      : sexoAlvo === "M"
        ? "Machos"
        : sexoAlvo === "todos"
          ? "Todos"
          : "Sem restricao";

  const hasAgeMin = idadeMinDias.trim().length > 0;
  const hasAgeMax = idadeMaxDias.trim().length > 0;
  if (!hasAgeMin && !hasAgeMax) {
    return sexLabel;
  }

  return `${sexLabel} | ${idadeMinDias || "0"} a ${idadeMaxDias || "sem limite"} dias`;
}

function summarizeInterval(
  intervaloDias: number,
  geraAgenda: boolean,
  payload: Record<string, unknown>,
) {
  return describeSanitaryCalendarSchedule({
    intervalDays: intervaloDias,
    geraAgenda,
    payload,
  });
}

function createProductSelection(
  product: ProdutoVeterinarioCatalogEntry,
  matchMode: VeterinaryProductSelection["matchMode"],
): VeterinaryProductSelection {
  return {
    id: product.id,
    nome: product.nome,
    categoria: product.categoria,
    origem: "catalogo_automatico",
    matchMode,
  };
}

function resolveProductSelection(
  draft: SanitaryProtocolItemDraft,
  selectedProduct: VeterinaryProductSelection | null,
  catalogProducts: ProdutoVeterinarioCatalogEntry[],
) {
  const trimmedName = draft.produto.trim();
  if (selectedProduct) {
    return {
      selection: selectedProduct,
      metadata: buildVeterinaryProductMetadataPatch({
        selectedProduct,
        typedName: trimmedName,
        source: selectedProduct.origem,
        matchMode: selectedProduct.matchMode ?? null,
      }),
    };
  }

  const resolved = resolveVeterinaryProductByName(trimmedName, catalogProducts, {
    sanitaryType: draft.tipo,
  });

  const automaticSelection = resolved.product
    ? createProductSelection(resolved.product, resolved.matchMode)
    : null;

  return {
    selection: automaticSelection,
    metadata: buildVeterinaryProductMetadataPatch({
      selectedProduct: automaticSelection,
      typedName: trimmedName,
      source: automaticSelection?.origem,
      matchMode: automaticSelection?.matchMode ?? null,
    }),
  };
}

function nextDoseNumber(items: ProtocoloSanitarioItem[]) {
  const lastDose = items.reduce((max, item) => {
    if (!item.dose_num || item.dose_num <= max) return max;
    return item.dose_num;
  }, 0);

  return String(lastDose > 0 ? lastDose + 1 : 1);
}

function sortProtocolItems(items: ProtocoloSanitarioItem[]) {
  return [...items].sort((left, right) => {
    const leftDose = left.dose_num ?? Number.MAX_SAFE_INTEGER;
    const rightDose = right.dose_num ?? Number.MAX_SAFE_INTEGER;
    if (leftDose !== rightDose) return leftDose - rightDose;
    if (left.intervalo_dias !== right.intervalo_dias) {
      return left.intervalo_dias - right.intervalo_dias;
    }
    return left.produto.localeCompare(right.produto);
  });
}

function ProtocolBadges({
  draft,
}: {
  draft: Pick<
    SanitaryProtocolDraft,
    | "obrigatorio"
    | "obrigatorioPorRisco"
    | "requiresVet"
    | "requiresComplianceDocument"
  >;
}) {
  return (
    <>
      {draft.obrigatorio ? <Badge variant="destructive">Obrigatorio</Badge> : null}
      {draft.obrigatorioPorRisco ? (
        <Badge variant="secondary">Sensivel a risco</Badge>
      ) : null}
      {draft.requiresVet ? <Badge variant="outline">Requer veterinario</Badge> : null}
      {draft.requiresComplianceDocument ? (
        <Badge variant="outline">Exige documento</Badge>
      ) : null}
    </>
  );
}

export function FarmProtocolManager({
  activeFarmId,
  farmExperienceMode,
  catalogProducts,
  protocols,
  protocolItems,
  canManage,
}: FarmProtocolManagerProps) {
  const [protocolEditor, setProtocolEditor] = useState<ProtocolEditorState | null>(
    null,
  );
  const [itemEditor, setItemEditor] = useState<ItemEditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProtocoloSanitario | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeProtocols = useMemo(
    () =>
      [...protocols]
        .filter((protocol) => !protocol.deleted_at)
        .sort((left, right) => {
          const sourceOrder = getProtocolSourceOrder(left) - getProtocolSourceOrder(right);
          if (sourceOrder !== 0) return sourceOrder;
          return left.nome.localeCompare(right.nome);
        }),
    [protocols],
  );

  const groupedStandardTemplates = useMemo(() => {
    return Object.entries(TEMPLATE_CATEGORY_META).map(([category, meta]) => ({
      category: category as StandardProtocolCategory,
      meta,
      protocols: STANDARD_PROTOCOLS.filter((protocol) => protocol.categoria === category),
    }));
  }, []);

  const itemsByProtocol = useMemo(() => {
    const grouped = new Map<string, ProtocoloSanitarioItem[]>();

    for (const item of protocolItems) {
      if (item.deleted_at) continue;
      const current = grouped.get(item.protocolo_id) ?? [];
      current.push(item);
      grouped.set(item.protocolo_id, current);
    }

    for (const [protocolId, items] of grouped.entries()) {
      grouped.set(protocolId, sortProtocolItems(items));
    }

    return grouped;
  }, [protocolItems]);

  const protocolById = useMemo(() => {
    return new Map(activeProtocols.map((protocol) => [protocol.id, protocol]));
  }, [activeProtocols]);

  const familyCoverage = useMemo(
    () => buildSanitaryFamilyCoverageIndex(activeProtocols),
    [activeProtocols],
  );

  const protocolEditorLayer = protocolEditor?.protocol
    ? resolveProtocolSourceGroup(protocolEditor.protocol)
    : ("custom" as const);

  const protocolEditorEffectiveFamilyCode = protocolEditor
    ? resolveDraftProtocolFamilyCode(protocolEditor.draft)
    : null;

  const protocolEditorFamilyConflict = useMemo(() => {
    if (!protocolEditor) return null;

    return findSanitaryFamilyConflict({
      protocols: activeProtocols,
      candidateFamilyCode: protocolEditor.draft.familyCode || protocolEditor.draft.nome,
      candidateLayer: protocolEditorLayer,
      ignoreProtocolId: protocolEditor.protocol?.id ?? null,
    });
  }, [activeProtocols, protocolEditor, protocolEditorLayer]);

  const itemEditorProtocol = itemEditor
    ? protocolById.get(itemEditor.protocolId) ?? null
    : null;

  const itemEditorProtocolDraft = itemEditorProtocol
    ? readProtocolDraft(itemEditorProtocol)
    : null;

  const itemEditorSiblingItems = itemEditor
    ? itemsByProtocol.get(itemEditor.protocolId) ?? []
    : [];

  const groupedActiveProtocols = useMemo(
    () =>
      [
        {
          key: "official" as const,
          meta: getProtocolSourceMeta("official"),
          protocols: activeProtocols.filter(
            (protocol) => resolveProtocolSourceGroup(protocol) === "official",
          ),
        },
        {
          key: "standard" as const,
          meta: getProtocolSourceMeta("standard"),
          protocols: activeProtocols.filter(
            (protocol) => resolveProtocolSourceGroup(protocol) === "standard",
          ),
        },
        {
          key: "custom" as const,
          meta: getProtocolSourceMeta("custom"),
          protocols: activeProtocols.filter(
            (protocol) => resolveProtocolSourceGroup(protocol) === "custom",
          ),
        },
      ].filter((group) => group.protocols.length > 0),
    [activeProtocols],
  );

  const importedStandardTemplateIds = useMemo(() => {
    return new Set(
      activeProtocols
        .map((protocol) => readString(protocol.payload, "standard_id"))
        .filter((value): value is string => Boolean(value)),
    );
  }, [activeProtocols]);

  const itemSuggestions = useMemo(() => {
    if (!itemEditor) return [];

    return searchVeterinaryProducts(catalogProducts, {
      query: itemEditor.draft.produto,
      sanitaryType: itemEditor.draft.tipo,
      limit: 5,
    });
  }, [catalogProducts, itemEditor]);

  const hasAdvancedFields = farmExperienceMode === "completo";

  const openCreateProtocol = () => {
    setProtocolEditor({
      protocol: null,
      draft: createEmptyProtocolDraft(),
    });
  };

  const openEditProtocol = (protocol: ProtocoloSanitario) => {
    setProtocolEditor({
      protocol,
      draft: readProtocolDraft(protocol),
    });
  };

  const openCreateItem = (protocolId: string) => {
    const protocol = activeProtocols.find((item) => item.id === protocolId);
    const protocolDraft = protocol ? readProtocolDraft(protocol) : null;
    const currentItems = itemsByProtocol.get(protocolId) ?? [];
    const previousItem = currentItems.at(-1) ?? null;
    const previousItemDraft = previousItem ? readProtocolItemDraft(previousItem) : null;
    const nextDose = nextDoseNumber(currentItems);

    setItemEditor({
      item: null,
      protocolId,
      selectedProduct: null,
      draft: createEmptyProtocolItemDraft({
        doseNum: nextDose,
        itemCode: buildDefaultMilestoneCode(nextDose),
        dependsOnItemCode: previousItemDraft
          ? resolveDraftMilestoneCode(previousItemDraft)
          : "",
        sexoAlvo: protocolDraft?.sexoAlvo ?? "",
        idadeMinDias: protocolDraft?.idadeMinDias ?? "",
        idadeMaxDias: protocolDraft?.idadeMaxDias ?? "",
        obrigatorio: protocolDraft?.obrigatorio ?? false,
        obrigatorioPorRisco: protocolDraft?.obrigatorioPorRisco ?? false,
      }),
    });
  };

  const openEditItem = (item: ProtocoloSanitarioItem) => {
    setItemEditor({
      item,
      protocolId: item.protocolo_id,
      selectedProduct: readVeterinaryProductSelection(item.payload),
      draft: readProtocolItemDraft(item),
    });
  };

  const handleImportStandardTemplate = async (protocol: StandardProtocol) => {
    if (!canManage) {
      showError("Apenas manager e owner podem importar templates canonicos.");
      return;
    }

    if (importedStandardTemplateIds.has(protocol.id)) {
      showError("Este template canonico ja foi importado para a fazenda.");
      return;
    }

    const familyConflict = findSanitaryFamilyConflict({
      protocols: activeProtocols,
      candidateFamilyCode: protocol.family_code,
      candidateLayer: "standard",
    });
    if (familyConflict) {
      showError(
        getFamilyConflictMessage("standard", familyConflict.familyCode, familyConflict),
      );
      return;
    }

    const protocolId = crypto.randomUUID();

    const protocolOperation: OperationInput = {
      table: "protocolos_sanitarios",
      action: "INSERT",
      record: {
        id: protocolId,
        nome: protocol.nome,
        descricao: protocol.descricao,
        ativo: true,
        payload: buildStandardProtocolPayload(protocol),
      },
    };

    const itemOperations: OperationInput[] = protocol.itens.map((item) => {
      const resolvedProduct = resolveVeterinaryProductByName(
        item.produto,
        catalogProducts,
        {
          sanitaryType: item.tipo,
        },
      );
      const automaticSelection = resolvedProduct.product
        ? createProductSelection(resolvedProduct.product, resolvedProduct.matchMode)
        : null;

      return {
        table: "protocolos_sanitarios_itens",
        action: "INSERT",
        record: {
          id: crypto.randomUUID(),
          protocolo_id: protocolId,
          protocol_item_id: crypto.randomUUID(),
          version: 1,
          tipo: item.tipo,
          produto: item.produto,
          intervalo_dias: normalizeStandardProtocolInterval(item),
          dose_num: item.dose_num,
          gera_agenda: item.gera_agenda,
          dedup_template: item.dedup_template ?? null,
          payload: {
            ...buildStandardProtocolItemPayload(protocol, item),
            ...buildVeterinaryProductMetadata({
              selectedProduct: automaticSelection,
              typedName: item.produto,
              source: automaticSelection?.origem,
              matchMode: automaticSelection?.matchMode ?? null,
            }),
          },
        },
      };
    });

    setIsSaving(true);
    try {
      await createGesture(activeFarmId, [protocolOperation, ...itemOperations]);
      showSuccess(`Template "${protocol.nome}" importado para a fazenda.`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(err);
      showError("Nao foi possivel importar o template canonico.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProtocol = async () => {
    if (!protocolEditor) return;

    const validationError = validateProtocolDraft(protocolEditor.draft);
    if (validationError) {
      showError(validationError);
      return;
    }

    const candidateLayer = protocolEditorLayer;
    const familyConflict = protocolEditorFamilyConflict;
    if (familyConflict) {
      showError(
        getFamilyConflictMessage(candidateLayer, familyConflict.familyCode, familyConflict),
      );
      return;
    }

    const nextProtocolId =
      protocolEditor.protocol?.id ?? crypto.randomUUID();
    const operation: OperationInput = protocolEditor.protocol
      ? {
          table: "protocolos_sanitarios",
          action: "UPDATE",
          record: buildProtocolUpdateRecord(
            protocolEditor.protocol,
            protocolEditor.draft,
          ),
        }
      : {
          table: "protocolos_sanitarios",
          action: "INSERT",
          record: buildProtocolInsertRecord(
            nextProtocolId,
            protocolEditor.draft,
          ),
        };

    setIsSaving(true);
    try {
      await createGesture(activeFarmId, [operation]);
      showSuccess(
        protocolEditor.protocol
          ? "Protocolo sanitário atualizado."
          : "Protocolo customizado criado.",
      );
      if (!protocolEditor.protocol) {
        setItemEditor({
          item: null,
          protocolId: nextProtocolId,
          selectedProduct: null,
          draft: createEmptyProtocolItemDraft({
            doseNum: "1",
            itemCode: "dose_1",
            sexoAlvo: protocolEditor.draft.sexoAlvo,
            idadeMinDias: protocolEditor.draft.idadeMinDias,
            idadeMaxDias: protocolEditor.draft.idadeMaxDias,
            obrigatorio: protocolEditor.draft.obrigatorio,
            obrigatorioPorRisco: protocolEditor.draft.obrigatorioPorRisco,
            requiresVet: protocolEditor.draft.requiresVet,
            requiresComplianceDocument:
              protocolEditor.draft.requiresComplianceDocument,
          }),
        });
      }
      setProtocolEditor(null);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      showError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveItem = async () => {
    if (!itemEditor) return;

    const validationError = validateProtocolItemDraft(itemEditor.draft);
    if (validationError) {
      showError(validationError);
      return;
    }

    const resolvedProduct = resolveProductSelection(
      itemEditor.draft,
      itemEditor.selectedProduct,
      catalogProducts,
    );
    const protocol = protocolById.get(itemEditor.protocolId) ?? null;

    const operation: OperationInput = itemEditor.item
      ? {
          table: "protocolos_sanitarios_itens",
          action: "UPDATE",
          record: buildProtocolItemUpdateRecord(
            itemEditor.item,
            itemEditor.draft,
            resolvedProduct.metadata,
            {
              protocolPayload: protocol?.payload ?? null,
            },
          ),
        }
      : {
          table: "protocolos_sanitarios_itens",
          action: "INSERT",
          record: buildProtocolItemInsertRecord({
            itemId: crypto.randomUUID(),
            protocoloId: itemEditor.protocolId,
            protocolItemId: crypto.randomUUID(),
            draft: itemEditor.draft,
            extraPayload: resolvedProduct.metadata,
            protocolPayload: protocol?.payload ?? null,
          }),
        };

    setIsSaving(true);
    try {
      await createGesture(activeFarmId, [operation]);
      showSuccess(
        itemEditor.item
          ? "Etapa sanitária atualizada."
          : "Etapa sanitária adicionada ao protocolo.",
      );
      setItemEditor(null);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      showError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProtocol = async () => {
    if (!deleteTarget) return;

    const protocolOps: OperationInput[] = [
      ...(itemsByProtocol.get(deleteTarget.id) ?? []).map((item) => ({
        table: "protocolos_sanitarios_itens",
        action: "DELETE",
        record: { id: item.id },
      })),
      {
        table: "protocolos_sanitarios",
        action: "DELETE",
        record: { id: deleteTarget.id },
      },
    ];

    setIsDeleting(true);
    try {
      await createGesture(activeFarmId, protocolOps);
      showSuccess("Protocolo removido da fazenda.");
      setDeleteTarget(null);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      showError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const managementHint = canManage
    ? hasAdvancedFields
      ? "Modo completo: inclui familia protocolar, dependencias, deduplicacao e exigencias regulatorias."
      : "Modo essencial: edite o necessario para a rotina sem expor campos tecnicos."
    : "Apenas manager e owner podem customizar protocolos da fazenda.";

  return (
    <>
      <FormSection
        title="Protocolos operacionais da fazenda"
        description="Customizado = como a fazenda escolhe operar em cima da base regulatoria, sem duplicar o mesmo tronco oficial por familia protocolar."
        actions={
          <>
            <Badge variant="outline">{activeProtocols.length} protocolos</Badge>
            <Badge variant="outline">
              {protocolItems.filter((item) => !item.deleted_at).length} etapas
            </Badge>
            <Button onClick={openCreateProtocol} disabled={!canManage}>
              <Plus className="mr-2 h-4 w-4" />
              Novo protocolo
            </Button>
          </>
        }
        contentClassName="space-y-4"
      >
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
          {managementHint}
        </div>

        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardHeader className="space-y-3">
            <div className="space-y-1">
              <CardTitle className="text-lg">
                Templates canonicos da fazenda
              </CardTitle>
              <CardDescription>
                Template canonico = modelos padrao recomendados pelo sistema.
                Eles entram direto na camada ativa da fazenda, mas nao podem
                duplicar familias ja cobertas pelo pack oficial.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
              Esta biblioteca nao cria uma quarta camada. Cada importacao vira
              um `protocolo_sanitario` normal da fazenda, mas a familia
              protocolar continua unica para evitar agendas paralelas da mesma
              obrigacao central.
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {groupedStandardTemplates.map((group) => {
                const GroupIcon = group.meta.icon;

                return (
                  <div
                    key={group.category}
                    className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <GroupIcon className="h-4 w-4 text-primary" />
                        <p className="font-medium text-foreground">
                          {group.meta.label}
                        </p>
                        <Badge variant="outline">{group.protocols.length}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {group.meta.description}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {group.protocols.map((template) => {
                        const alreadyImported = importedStandardTemplateIds.has(
                          template.id,
                        );
                        const templateFamilyCovered = familyCoverage.has(
                          template.family_code,
                        );
                        const coveredByOfficialPack = hasOfficialFamilyCoverage(
                          familyCoverage,
                          template.family_code,
                        );
                        const importBlocked =
                          alreadyImported || templateFamilyCovered;

                        return (
                          <Card key={template.id} className="border-border/70 shadow-none">
                            <CardHeader className="space-y-3 pb-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <CardTitle className="text-base">
                                    {template.nome}
                                  </CardTitle>
                                  <CardDescription className="text-sm">
                                    {template.descricao}
                                  </CardDescription>
                                </div>

                                <Button
                                  variant={importBlocked ? "outline" : "default"}
                                  size="sm"
                                  onClick={() =>
                                    handleImportStandardTemplate(template)
                                  }
                                  disabled={!canManage || importBlocked || isSaving}
                                >
                                  {alreadyImported
                                    ? "Ja importado"
                                    : templateFamilyCovered
                                      ? "Familia ativa"
                                      : "Importar"}
                                </Button>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Badge
                                  variant={getStandardProtocolLegalStatusVariant(
                                    template.status_legal,
                                  )}
                                >
                                  {getStandardProtocolLegalStatusLabel(
                                    template.status_legal,
                                  )}
                                </Badge>
                                <Badge variant="outline">
                                  {template.calendario_base.label}
                                </Badge>
                                <Badge variant="outline">
                                  {template.itens.length} etapa(s)
                                </Badge>
                                <Badge variant="outline">
                                  familia: {template.family_code}
                                </Badge>
                                {coveredByOfficialPack ? (
                                  <Badge variant="destructive">
                                    Coberta pelo pack oficial
                                  </Badge>
                                ) : null}
                                {templateFamilyCovered && !coveredByOfficialPack ? (
                                  <Badge variant="secondary">
                                    Familia ja ativa na fazenda
                                  </Badge>
                                ) : null}
                              </div>
                            </CardHeader>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {activeProtocols.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  Nenhum protocolo operacional ativo ainda
                </p>
                <p className="text-sm text-muted-foreground">
                  Ative a base regulatoria oficial acima, importe um template
                  canonico ou crie um calendario operacional proprio para a
                  fazenda.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-6">
          {groupedActiveProtocols.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{group.meta.label}</p>
                  <Badge variant="outline">{group.protocols.length}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {group.meta.description}
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {group.protocols.map((protocol) => {
                  const draft = readProtocolDraft(protocol);
                  const protocolItemsList = itemsByProtocol.get(protocol.id) ?? [];
                  const sourceGroup = resolveProtocolSourceGroup(protocol);
                  const sourceMeta = getProtocolSourceMeta(sourceGroup);
                  const legalStatus = readString(protocol.payload, "status_legal");
                  const familyCode =
                    readSanitaryProtocolFamilyCode(protocol.payload) ??
                    draft.familyCode;
                  const duplicatesOfficialFamily =
                    sourceGroup !== "official" &&
                    hasOfficialFamilyCoverage(familyCoverage, familyCode);

                  return (
                    <Card key={protocol.id} className="border-border/70">
                      <CardHeader className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <CardTitle className="text-lg">{protocol.nome}</CardTitle>
                            <CardDescription>
                              {protocol.descricao || "Sem descricao operacional."}
                            </CardDescription>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge variant={protocol.ativo ? "secondary" : "outline"}>
                              {protocol.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditProtocol(protocol)}
                              disabled={!canManage}
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(protocol)}
                              disabled={!canManage}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{sourceMeta.label}</Badge>
                          {familyCode ? (
                            <Badge variant="outline">familia: {familyCode}</Badge>
                          ) : null}
                          {legalStatus ? (
                            <Badge variant="outline">
                              {legalStatus.replaceAll("_", " ")}
                            </Badge>
                          ) : null}
                          {duplicatesOfficialFamily ? (
                            <Badge variant="destructive">
                              Tronco oficial ja coberto
                            </Badge>
                          ) : null}
                          <ProtocolBadges draft={draft} />
                          <Badge variant="outline">
                            {summarizeTarget(
                              draft.sexoAlvo,
                              draft.idadeMinDias,
                              draft.idadeMaxDias,
                            )}
                          </Badge>
                          {draft.validoDe || draft.validoAte ? (
                            <Badge variant="outline">
                              Vigencia {draft.validoDe || "..."} ate {draft.validoAte || "..."}
                            </Badge>
                          ) : null}
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/10 px-4 py-3">
                          <div className="text-sm">
                            <p className="font-medium text-foreground">
                              {protocolItemsList.length} etapas configuradas
                            </p>
                            <p className="text-muted-foreground">
                              Produtos, deduplicacao e elegibilidade ficam por etapa.
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCreateItem(protocol.id)}
                            disabled={!canManage}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Nova etapa
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {protocolItemsList.map((item) => {
                            const itemDraft = readProtocolItemDraft(item);
                            const typeMeta = TYPE_META[item.tipo];
                            const TypeIcon = typeMeta.icon;
                            const linkedProduct = readVeterinaryProductSelection(
                              item.payload,
                            );
                            const milestoneCode = resolveDraftMilestoneCode(itemDraft);

                            return (
                              <div
                                key={item.id}
                                className="rounded-2xl border border-border/70 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${typeMeta.tone}`}
                                      >
                                        <TypeIcon className="h-3.5 w-3.5" />
                                        {typeMeta.label}
                                      </span>
                                      {item.dose_num ? (
                                        <Badge variant="outline">Dose {item.dose_num}</Badge>
                                      ) : null}
                                      {milestoneCode ? (
                                        <Badge variant="outline">
                                          milestone: {milestoneCode}
                                        </Badge>
                                      ) : null}
                                      {itemDraft.dependsOnItemCode ? (
                                        <Badge variant="outline">
                                          apos {itemDraft.dependsOnItemCode}
                                        </Badge>
                                      ) : null}
                                      {item.gera_agenda ? (
                                        <Badge variant="secondary">Gera agenda</Badge>
                                      ) : (
                                        <Badge variant="outline">Sem agenda</Badge>
                                      )}
                                      {linkedProduct ? (
                                        <Badge variant="outline">
                                          Catalogo vinculado
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <div>
                                      <p className="font-medium text-foreground">
                                        {item.produto}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {summarizeInterval(
                                          item.intervalo_dias,
                                          item.gera_agenda,
                                          item.payload,
                                        )}
                                      </p>
                                    </div>
                                  </div>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditItem(item)}
                                    disabled={!canManage}
                                  >
                                    <PencilLine className="h-4 w-4" />
                                  </Button>
                                </div>

                                <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                                  <p>{itemDraft.indicacao || "Sem indicacao operacional."}</p>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">
                                      {summarizeTarget(
                                        itemDraft.sexoAlvo,
                                        itemDraft.idadeMinDias,
                                        itemDraft.idadeMaxDias,
                                      )}
                                    </Badge>
                                    {itemDraft.obrigatorio ? (
                                      <Badge variant="destructive">Obrigatorio</Badge>
                                    ) : null}
                                    {itemDraft.obrigatorioPorRisco ? (
                                      <Badge variant="secondary">Por risco</Badge>
                                    ) : null}
                                    {itemDraft.requiresVet ? (
                                      <Badge variant="outline">Veterinario</Badge>
                                    ) : null}
                                    {itemDraft.dedupTemplate ? (
                                      <Badge variant="outline">
                                        Dedup {itemDraft.dedupTemplate}
                                      </Badge>
                                    ) : null}
                                    {linkedProduct ? (
                                      <Badge variant="outline">
                                        <Link2 className="mr-1 h-3 w-3" />
                                        {linkedProduct.nome}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  {itemDraft.observacoes ? (
                                    <p className="rounded-xl bg-muted/20 p-3 text-xs leading-6">
                                      {itemDraft.observacoes}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </FormSection>

      <ProtocolEditorDialog
        open={Boolean(protocolEditor)}
        onOpenChange={(open) => {
          if (!open) setProtocolEditor(null);
        }}
        draft={protocolEditor?.draft ?? createEmptyProtocolDraft()}
        effectiveFamilyCode={protocolEditorEffectiveFamilyCode}
        familyConflict={protocolEditorFamilyConflict}
        familyConflictMessage={
          protocolEditorFamilyConflict
            ? getFamilyConflictMessage(
                protocolEditorLayer,
                protocolEditorFamilyConflict.familyCode,
                protocolEditorFamilyConflict,
              )
            : null
        }
        onDraftChange={(draft) =>
          setProtocolEditor((current) => (current ? { ...current, draft } : current))
        }
        isSaving={isSaving}
        hasAdvancedFields={hasAdvancedFields}
        isEditing={Boolean(protocolEditor?.protocol)}
        onSave={handleSaveProtocol}
      />

      <ItemEditorDialog
        open={Boolean(itemEditor)}
        onOpenChange={(open) => {
          if (!open) setItemEditor(null);
        }}
        draft={itemEditor?.draft ?? createEmptyProtocolItemDraft()}
        selectedProduct={itemEditor?.selectedProduct ?? null}
        suggestions={itemSuggestions}
        siblingItems={itemEditorSiblingItems}
        currentItemId={itemEditor?.item?.id ?? null}
        protocolName={itemEditorProtocol?.nome ?? "Protocolo"}
        protocolFamilyCode={itemEditorProtocolDraft?.familyCode ?? null}
        protocolRegimenVersion={itemEditorProtocolDraft?.regimenVersion ?? "1"}
        hasAdvancedFields={hasAdvancedFields}
        isSaving={isSaving}
        isEditing={Boolean(itemEditor?.item)}
        onDraftChange={(draft) =>
          setItemEditor((current) => (current ? { ...current, draft } : current))
        }
        onSelectedProductChange={(selectedProduct) =>
          setItemEditor((current) =>
            current ? { ...current, selectedProduct } : current,
          )
        }
        onSave={handleSaveItem}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Remover protocolo?</DialogTitle>
            <DialogDescription>
              O protocolo e todas as etapas locais serao marcados como removidos.
              Os eventos ja realizados permanecem no historico.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              {deleteTarget?.nome ?? "Protocolo"}
            </p>
            <p className="mt-1">
              {itemsByProtocol.get(deleteTarget?.id ?? "")?.length ?? 0} etapas serao
              desativadas junto com o cabecalho do protocolo.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteProtocol} disabled={isDeleting}>
              {isDeleting ? "Removendo..." : "Remover protocolo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ProtocolEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: SanitaryProtocolDraft;
  effectiveFamilyCode: string | null;
  familyConflict: SanitaryFamilyConflict | null;
  familyConflictMessage: string | null;
  onDraftChange: (draft: SanitaryProtocolDraft) => void;
  isSaving: boolean;
  hasAdvancedFields: boolean;
  isEditing: boolean;
  onSave: () => void;
}

function ProtocolEditorDialog({
  open,
  onOpenChange,
  draft,
  effectiveFamilyCode,
  familyConflict,
  familyConflictMessage,
  onDraftChange,
  isSaving,
  hasAdvancedFields,
  isEditing,
  onSave,
}: ProtocolEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar protocolo" : "Novo protocolo customizado"}
          </DialogTitle>
          <DialogDescription>
            Customizado = como sua fazenda escolhe operar. Use outra familia
            protocolar para complementos locais e nao duplique o mesmo tronco
            oficial em paralelo.
          </DialogDescription>
        </DialogHeader>

        <Alert
          variant={familyConflict ? "destructive" : "default"}
          className={
            familyConflict
              ? "border-destructive/30 bg-destructive/5"
              : "border-border/70 bg-muted/20"
          }
        >
          {familyConflict ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4" />
          )}
          <AlertTitle>Familia protocolar efetiva</AlertTitle>
          <AlertDescription>
            <p>
              {effectiveFamilyCode
                ? `Esta rotina sera tratada como familia "${effectiveFamilyCode}" para agenda, deduplicacao e bloqueio de duplicatas.`
                : "Se voce deixar a familia em branco, o sistema vai deriva-la do nome do protocolo ao salvar."}
            </p>
            <p className="mt-2">
              {familyConflictMessage ??
                "Use familia nova para complemento operacional. Se a obrigacao principal ja estiver no pack oficial, este protocolo deve cobrir apenas o processo local da fazenda."}
            </p>
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="protocol-name">Nome</Label>
            <Input
              id="protocol-name"
              value={draft.nome}
              onChange={(event) =>
                onDraftChange({ ...draft, nome: event.target.value })
              }
              placeholder="Ex: Calendario reprodutivo regional"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="protocol-description">Descricao</Label>
            <Textarea
              id="protocol-description"
              value={draft.descricao}
              onChange={(event) =>
                onDraftChange({ ...draft, descricao: event.target.value })
              }
              placeholder="Como esse protocolo deve ser aplicado na rotina da fazenda."
              rows={3}
            />
          </div>

          {hasAdvancedFields ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="protocol-family-code">Familia protocolar</Label>
                <Input
                  id="protocol-family-code"
                  value={draft.familyCode}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      familyCode: event.target.value,
                    })
                  }
                  placeholder="Ex: vermifugacao_entrada"
                />
                <p className="text-xs text-muted-foreground">
                  Familia unica por tronco sanitario. Se ficar vazia, o nome do
                  protocolo vira a base da familia.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="protocol-regimen-version">Versao do regime</Label>
                <Input
                  id="protocol-regimen-version"
                  inputMode="numeric"
                  value={draft.regimenVersion}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      regimenVersion: sanitizeNumberInput(event.target.value),
                    })
                  }
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">
                  Use a mesma versao enquanto o tronco continuar semanticamente o
                  mesmo. Mude apenas quando a sequencia ou regra do regime mudar.
                </p>
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <Label>Sexo alvo</Label>
            <Select
              value={draft.sexoAlvo || "__empty__"}
              onValueChange={(value) =>
                onDraftChange({
                  ...draft,
                  sexoAlvo: value === "__empty__" ? "" : (value as "M" | "F" | "todos"),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem restricao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty__">Sem restricao</SelectItem>
                {SEX_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="protocol-age-min">Idade minima (dias)</Label>
              <Input
                id="protocol-age-min"
                inputMode="numeric"
                value={draft.idadeMinDias}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    idadeMinDias: sanitizeNumberInput(event.target.value),
                  })
                }
                placeholder="Ex: 90"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="protocol-age-max">Idade maxima (dias)</Label>
              <Input
                id="protocol-age-max"
                inputMode="numeric"
                value={draft.idadeMaxDias}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    idadeMaxDias: sanitizeNumberInput(event.target.value),
                  })
                }
                placeholder="Ex: 240"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/70 p-4 md:col-span-2">
            <SwitchRow
              label="Ativo"
              description="Protocolos inativos deixam de ser usados para novas configuracoes."
              checked={draft.ativo}
              onCheckedChange={(checked) =>
                onDraftChange({ ...draft, ativo: checked })
              }
            />
            <SwitchRow
              label="Obrigatorio"
              description="Use para regra legal ou sanitariamente mandataria."
              checked={draft.obrigatorio}
              onCheckedChange={(checked) =>
                onDraftChange({ ...draft, obrigatorio: checked })
              }
            />
            <SwitchRow
              label="Obrigatorio por risco"
              description="Ative quando o protocolo so se torna mandatorio em regioes ou cenarios especificos."
              checked={draft.obrigatorioPorRisco}
              onCheckedChange={(checked) =>
                onDraftChange({ ...draft, obrigatorioPorRisco: checked })
              }
            />
            {hasAdvancedFields ? (
              <>
                <SwitchRow
                  label="Requer veterinario"
                  description="Marca o protocolo como dependente de supervisao tecnica."
                  checked={draft.requiresVet}
                  onCheckedChange={(checked) =>
                    onDraftChange({ ...draft, requiresVet: checked })
                  }
                />
                <SwitchRow
                  label="Exige documento"
                  description="Usado quando ha certificado, receita ou comprovacao obrigatoria."
                  checked={draft.requiresComplianceDocument}
                  onCheckedChange={(checked) =>
                    onDraftChange({
                      ...draft,
                      requiresComplianceDocument: checked,
                    })
                  }
                />
              </>
            ) : null}
          </div>

          {hasAdvancedFields ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="protocol-valid-from">Valido de</Label>
                <Input
                  id="protocol-valid-from"
                  type="date"
                  value={draft.validoDe}
                  onChange={(event) =>
                    onDraftChange({ ...draft, validoDe: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="protocol-valid-to">Valido ate</Label>
                <Input
                  id="protocol-valid-to"
                  type="date"
                  value={draft.validoAte}
                  onChange={(event) =>
                    onDraftChange({ ...draft, validoAte: event.target.value })
                  }
                />
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={isSaving || Boolean(familyConflict)}>
            {isSaving ? "Salvando..." : isEditing ? "Salvar protocolo" : "Criar protocolo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ItemEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: SanitaryProtocolItemDraft;
  selectedProduct: VeterinaryProductSelection | null;
  suggestions: ProdutoVeterinarioCatalogEntry[];
  siblingItems: ProtocoloSanitarioItem[];
  currentItemId: string | null;
  protocolName: string;
  protocolFamilyCode: string | null;
  protocolRegimenVersion: string;
  hasAdvancedFields: boolean;
  isSaving: boolean;
  isEditing: boolean;
  onDraftChange: (draft: SanitaryProtocolItemDraft) => void;
  onSelectedProductChange: (selection: VeterinaryProductSelection | null) => void;
  onSave: () => void;
}

function ItemEditorDialog({
  open,
  onOpenChange,
  draft,
  selectedProduct,
  suggestions,
  siblingItems,
  currentItemId,
  protocolName,
  protocolFamilyCode,
  protocolRegimenVersion,
  hasAdvancedFields,
  isSaving,
  isEditing,
  onDraftChange,
  onSelectedProductChange,
  onSave,
}: ItemEditorDialogProps) {
  const normalizedSelected = selectedProduct
    ? normalizeVeterinaryProductText(selectedProduct.nome)
    : null;

  const dependencyOptions = useMemo(() => {
    return siblingItems
      .filter((item) => item.id !== currentItemId)
      .map((item) => {
        const itemDraft = readProtocolItemDraft(item);
        const code = resolveDraftMilestoneCode(itemDraft);
        return {
          code,
          label: `${item.produto}${item.dose_num ? ` (Dose ${item.dose_num})` : ""}`,
        };
      })
      .filter((opt) => opt.code.length > 0);
  }, [currentItemId, siblingItems]);

  const dependencySelectOptions = useMemo(() => {
    if (
      draft.dependsOnItemCode.trim().length > 0 &&
      !dependencyOptions.some((option) => option.code === draft.dependsOnItemCode)
    ) {
      return [
        {
          code: draft.dependsOnItemCode,
          label: `${draft.dependsOnItemCode} (configurado manualmente)`,
        },
        ...dependencyOptions,
      ];
    }

    return dependencyOptions;
  }, [dependencyOptions, draft.dependsOnItemCode]);

  const effectiveMilestoneCode = useMemo(
    () => resolveDraftMilestoneCode(draft),
    [draft],
  );

  const regimenPreview = useMemo(() => {
    return inferSanitaryRegimenMilestone({
      familyCode: protocolFamilyCode,
      regimenVersion: Number(protocolRegimenVersion || "1"),
      milestoneCode: draft.itemCode || null,
      sequenceOrder:
        draft.doseNum.trim().length > 0 ? Number(draft.doseNum) : 1,
      dependsOnMilestone: draft.dependsOnItemCode || null,
      sexoAlvo: draft.sexoAlvo,
      idadeMinDias:
        draft.idadeMinDias.trim().length > 0 ? Number(draft.idadeMinDias) : null,
      idadeMaxDias:
        draft.idadeMaxDias.trim().length > 0 ? Number(draft.idadeMaxDias) : null,
      requiresComplianceDocument: draft.requiresComplianceDocument,
      payload:
        draft.calendarMode && draft.calendarAnchor
          ? {
              calendario_base: {
                mode: draft.calendarMode,
                anchor: draft.calendarAnchor,
                interval_days:
                  draft.intervaloDias.trim().length > 0
                    ? Number(draft.intervaloDias)
                    : null,
                age_start_days:
                  draft.idadeMinDias.trim().length > 0
                    ? Number(draft.idadeMinDias)
                    : null,
                age_end_days:
                  draft.idadeMaxDias.trim().length > 0
                    ? Number(draft.idadeMaxDias)
                    : null,
              },
            }
          : null,
    });
  }, [
    draft.calendarAnchor,
    draft.calendarMode,
    draft.dependsOnItemCode,
    draft.doseNum,
    draft.idadeMaxDias,
    draft.idadeMinDias,
    draft.intervaloDias,
    draft.itemCode,
    draft.requiresComplianceDocument,
    draft.sexoAlvo,
    protocolFamilyCode,
    protocolRegimenVersion,
  ]);

  const dedupPreview = regimenPreview
    ? buildSanitaryRegimenDedupTemplate(regimenPreview)
    : draft.dedupTemplate.trim() || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar etapa" : "Nova etapa sanitaria"}</DialogTitle>
          <DialogDescription>
            Configure produto, agenda, alvo e vinculo ao catalogo global de
            produtos veterinarios.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-border/70 bg-muted/20">
          <Info className="h-4 w-4" />
          <AlertTitle>Contexto da etapa</AlertTitle>
          <AlertDescription>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{protocolName}</Badge>
              {protocolFamilyCode ? (
                <Badge variant="outline">familia: {protocolFamilyCode}</Badge>
              ) : (
                <Badge variant="outline">familia nao definida no protocolo</Badge>
              )}
              <Badge variant="outline">regime v{protocolRegimenVersion || "1"}</Badge>
              <Badge variant="outline">milestone: {effectiveMilestoneCode}</Badge>
              {draft.dependsOnItemCode ? (
                <Badge variant="outline">depende de: {draft.dependsOnItemCode}</Badge>
              ) : null}
            </div>
            <p className="mt-2">
              A agenda materializa so o proximo milestone pendente. Quando esta
              etapa depende de outra, ela so aparece depois da conclusao real da
              anterior.
            </p>
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo sanitario</Label>
            <Select
              value={draft.tipo}
              onValueChange={(value) =>
                onDraftChange({ ...draft, tipo: value as SanitarioTipoEnum })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-product">Produto</Label>
            <Input
              id="item-product"
              value={draft.produto}
              onChange={(event) => {
                const nextValue = event.target.value;
                const normalizedValue = normalizeVeterinaryProductText(nextValue);
                const keepSelection =
                  selectedProduct && normalizedSelected === normalizedValue
                    ? selectedProduct
                    : null;

                onSelectedProductChange(keepSelection);
                onDraftChange({ ...draft, produto: nextValue });
              }}
              placeholder="Ex: Vacina Brucelose B19"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex flex-wrap gap-2">
              {selectedProduct ? (
                <Badge variant="secondary">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Catalogo: {selectedProduct.nome}
                </Badge>
              ) : (
                <Badge variant="outline">Texto livre</Badge>
              )}
              {selectedProduct?.categoria ? (
                <Badge variant="outline">{selectedProduct.categoria}</Badge>
              ) : null}
            </div>

            {suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-muted/10 p-3">
                {suggestions.map((product) => (
                  <Button
                    key={product.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onSelectedProductChange({
                        id: product.id,
                        nome: product.nome,
                        categoria: product.categoria,
                        origem: "catalogo",
                        matchMode: "contains",
                      });
                      onDraftChange({ ...draft, produto: product.nome });
                    }}
                  >
                    {product.nome}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3 md:col-span-2">
            <div className="space-y-2">
              <Label htmlFor="item-interval">Intervalo (dias)</Label>
              <Input
                id="item-interval"
                inputMode="numeric"
                value={draft.intervaloDias}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    intervaloDias: sanitizeNumberInput(event.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-dose">Ordem / dose</Label>
              <Input
                id="item-dose"
                inputMode="numeric"
                value={draft.doseNum}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    doseNum: sanitizeNumberInput(event.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Sexo alvo</Label>
              <Select
                value={draft.sexoAlvo || "__empty__"}
                onValueChange={(value) =>
                  onDraftChange({
                    ...draft,
                    sexoAlvo: value === "__empty__" ? "" : (value as "M" | "F" | "todos"),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem restricao" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__">Sem restricao</SelectItem>
                  {SEX_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
            <div className="space-y-2">
              <Label htmlFor="item-age-min">Idade minima (dias)</Label>
              <Input
                id="item-age-min"
                inputMode="numeric"
                value={draft.idadeMinDias}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    idadeMinDias: sanitizeNumberInput(event.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-age-max">Idade maxima (dias)</Label>
              <Input
                id="item-age-max"
                inputMode="numeric"
                value={draft.idadeMaxDias}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    idadeMaxDias: sanitizeNumberInput(event.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4 md:col-span-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Milestone final: {effectiveMilestoneCode}</Badge>
              {regimenPreview?.schedule_rule.kind ? (
                <Badge variant="outline">
                  agenda: {regimenPreview.schedule_rule.kind.replaceAll("_", " ")}
                </Badge>
              ) : null}
              {dedupPreview ? (
                <Badge variant="outline">dedup sugerido: {dedupPreview}</Badge>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Se voce nao alterar o codigo da etapa, o sistema usa o milestone
              derivado da ordem/dose e mantem a mesma identidade logica da
              pendencia nos recomputes.
            </p>
          </div>

          {hasAdvancedFields ? (
            <div className="space-y-4 rounded-2xl border border-border/70 p-4 md:col-span-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Calendario-base da etapa
                </p>
                <p className="text-xs text-muted-foreground">
                  Estruture a logica base da agenda para diferenciar campanha,
                  janela etaria, rotina recorrente ou procedimento imediato.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Modo do calendario</Label>
                  <Select
                    value={draft.calendarMode || "__empty__"}
                    onValueChange={(value) =>
                      onDraftChange({
                        ...draft,
                        calendarMode:
                          value === "__empty__"
                            ? ""
                            : (value as SanitaryBaseCalendarMode),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nao estruturado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">Nao estruturado</SelectItem>
                      {CALENDAR_MODE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ancora do calendario</Label>
                  <Select
                    value={draft.calendarAnchor || "__empty__"}
                    onValueChange={(value) =>
                      onDraftChange({
                        ...draft,
                        calendarAnchor:
                          value === "__empty__"
                            ? ""
                            : (value as SanitaryBaseCalendarAnchor),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem ancora" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">Sem ancora</SelectItem>
                      {CALENDAR_ANCHOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="item-calendar-label">Rotulo operacional</Label>
                  <Input
                    id="item-calendar-label"
                    value={draft.calendarLabel}
                    onChange={(event) =>
                      onDraftChange({
                        ...draft,
                        calendarLabel: event.target.value,
                      })
                    }
                    placeholder="Ex: Dose unica entre 90 e 240 dias"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item-calendar-months">Meses da campanha</Label>
                  <Input
                    id="item-calendar-months"
                    value={draft.calendarMonths}
                    onChange={(event) =>
                      onDraftChange({
                        ...draft,
                        calendarMonths: sanitizeMonthListInput(
                          event.target.value,
                        ),
                      })
                    }
                    placeholder="Ex: 5, 11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-calendar-notes">Notas do calendario</Label>
                <Textarea
                  id="item-calendar-notes"
                  value={draft.calendarNotes}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      calendarNotes: event.target.value,
                    })
                  }
                  rows={2}
                  placeholder="Ex: campanha oficial estadual, revisar janela por regiao."
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="item-indication">Indicacao operacional</Label>
            <Textarea
              id="item-indication"
              value={draft.indicacao}
              onChange={(event) =>
                onDraftChange({ ...draft, indicacao: event.target.value })
              }
              rows={3}
              placeholder="Ex: Aplicar em bezerras de 3 a 8 meses antes do lote de reproducao."
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="item-notes">Observacoes</Label>
            <Textarea
              id="item-notes"
              value={draft.observacoes}
              onChange={(event) =>
                onDraftChange({ ...draft, observacoes: event.target.value })
              }
              rows={3}
              placeholder="Detalhes de carencia, reforco, preparo ou excecoes."
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-border/70 p-4 md:col-span-2">
            <SwitchRow
              label="Gera agenda"
              description="Desative para procedimento imediato sem proxima tarefa automatica."
              checked={draft.geraAgenda}
              onCheckedChange={(checked) =>
                onDraftChange({ ...draft, geraAgenda: checked })
              }
            />
            <SwitchRow
              label="Obrigatorio"
              description="Marca a etapa como mandataria no fluxo da fazenda."
              checked={draft.obrigatorio}
              onCheckedChange={(checked) =>
                onDraftChange({ ...draft, obrigatorio: checked })
              }
            />
            <SwitchRow
              label="Obrigatorio por risco"
              description="Ative para janelas condicionais de surto, regiao ou lote."
              checked={draft.obrigatorioPorRisco}
              onCheckedChange={(checked) =>
                onDraftChange({ ...draft, obrigatorioPorRisco: checked })
              }
            />
            {hasAdvancedFields ? (
              <>
                <SwitchRow
                  label="Requer veterinario"
                  description="Usado quando a etapa nao pode ser executada sem responsavel tecnico."
                  checked={draft.requiresVet}
                  onCheckedChange={(checked) =>
                    onDraftChange({ ...draft, requiresVet: checked })
                  }
                />
                <SwitchRow
                  label="Exige documento"
                  description="Ative para certificado, receita ou comprovacao."
                  checked={draft.requiresComplianceDocument}
                  onCheckedChange={(checked) =>
                    onDraftChange({
                      ...draft,
                      requiresComplianceDocument: checked,
                    })
                  }
                />
              </>
            ) : null}
          </div>

          {hasAdvancedFields ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="item-dedup">Template de deduplicacao</Label>
                <Input
                  id="item-dedup"
                  value={draft.dedupTemplate}
                  onChange={(event) =>
                    onDraftChange({ ...draft, dedupTemplate: event.target.value })
                  }
                  placeholder="Ex: vacina:brucelose:{animal_id}"
                />
                <p className="text-xs text-muted-foreground">
                  Se ficar vazio, sera usado o dedup semantico do regime:
                  {dedupPreview ? ` ${dedupPreview}` : " defina familia no protocolo."}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-code">Codigo da etapa</Label>
                <Input
                  id="item-code"
                  value={draft.itemCode}
                  onChange={(event) =>
                    onDraftChange({ ...draft, itemCode: event.target.value })
                  }
                  placeholder="Ex: dose-1"
                />
                <p className="text-xs text-muted-foreground">
                  Milestone canonico desta etapa. Se ficar vazio, o sistema usa{" "}
                  <span className="font-medium text-foreground">
                    {effectiveMilestoneCode}
                  </span>
                  .
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="item-dependency">Depende de</Label>
                <Select
                  value={draft.dependsOnItemCode || "__empty__"}
                  onValueChange={(value) =>
                    onDraftChange({
                      ...draft,
                      dependsOnItemCode: value === "__empty__" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id="item-dependency">
                    <SelectValue placeholder="Sem dependencia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty__">Sem dependencia</SelectItem>
                    {dependencySelectOptions.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Use dependencia apenas quando esta etapa deve nascer apos a
                  conclusao real do milestone anterior.
                </p>
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : isEditing ? "Salvar etapa" : "Criar etapa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function sanitizeNumberInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function sanitizeMonthListInput(value: string) {
  return value.replace(/[^\d,\s]/g, "");
}

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
