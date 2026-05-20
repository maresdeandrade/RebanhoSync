import type { CatalogoProtocoloOficialItem } from "@/lib/offline/types";
import type { SelectedOfficialTemplate } from "@/lib/sanitario/catalog/officialCatalog";
import type { SanitaryItemOperationalClass } from "@/lib/sanitario/models/domain";
import {
  getSanitaryItemOperationalClassLabel,
  resolveSanitaryItemOperationalClass,
} from "@/lib/sanitario/models/taxonomy";

export interface OfficialPackClassCount {
  key: SanitaryItemOperationalClass;
  label: string;
  count: number;
}

export interface OfficialPackTemplatePresentation {
  agendaOperationalCount: number;
  nonAgendaCounts: OfficialPackClassCount[];
}

export interface OfficialPackSelectionPresentation {
  agendaOperationalCount: number;
  nonAgendaCounts: OfficialPackClassCount[];
}

function resolveOfficialItemOperationalClass(
  item: CatalogoProtocoloOficialItem,
): SanitaryItemOperationalClass {
  return resolveSanitaryItemOperationalClass({
    tipo: item.area,
    gera_agenda: item.gera_agenda,
    payload: {
      ...item.payload,
      area: item.area,
      item_code: item.codigo,
      requires_official_notification:
        item.area === "notificacao" ||
        item.payload.requires_official_notification === true,
      compliance_kind:
        typeof item.payload.compliance_kind === "string"
          ? item.payload.compliance_kind
          : item.area === "biosseguranca" ||
              item.requires_gta ||
              item.payload.requires_compliance_document === true
            ? "checklist"
            : null,
    },
  });
}

function incrementClassCount(
  counts: Map<SanitaryItemOperationalClass, OfficialPackClassCount>,
  operationalClass: SanitaryItemOperationalClass,
) {
  const current = counts.get(operationalClass);
  if (current) {
    current.count += 1;
    return;
  }

  counts.set(operationalClass, {
    key: operationalClass,
    label: getSanitaryItemOperationalClassLabel(operationalClass),
    count: 1,
  });
}

function sortClassCounts(
  counts: Map<SanitaryItemOperationalClass, OfficialPackClassCount>,
) {
  return Array.from(counts.values()).sort(
    (left, right) => right.count - left.count || left.label.localeCompare(right.label),
  );
}

export function summarizeOfficialPackTemplatePresentation(
  template: Pick<
    SelectedOfficialTemplate,
    "materializableItems" | "skippedItems"
  >,
): OfficialPackTemplatePresentation {
  const nonAgendaCounts = new Map<
    SanitaryItemOperationalClass,
    OfficialPackClassCount
  >();

  for (const item of template.skippedItems) {
    incrementClassCount(nonAgendaCounts, resolveOfficialItemOperationalClass(item));
  }

  return {
    agendaOperationalCount: template.materializableItems.length,
    nonAgendaCounts: sortClassCounts(nonAgendaCounts),
  };
}

export function summarizeOfficialPackSelectionPresentation(
  templates: Array<
    Pick<SelectedOfficialTemplate, "materializableItems" | "skippedItems">
  >,
): OfficialPackSelectionPresentation {
  const nonAgendaCounts = new Map<
    SanitaryItemOperationalClass,
    OfficialPackClassCount
  >();
  let agendaOperationalCount = 0;

  for (const template of templates) {
    agendaOperationalCount += template.materializableItems.length;
    for (const item of template.skippedItems) {
      incrementClassCount(nonAgendaCounts, resolveOfficialItemOperationalClass(item));
    }
  }

  return {
    agendaOperationalCount,
    nonAgendaCounts: sortClassCounts(nonAgendaCounts),
  };
}
