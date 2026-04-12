import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type {
  CatalogoDoencaNotificavel,
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  EstadoUFEnum,
  FazendaSanidadeConfig,
  FazendaSanitaryCalendarModeEnum,
  FazendaSanitaryRiskLevelEnum,
  OperationInput,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
  SanitarioTipoEnum,
  SanitaryOfficialAptidaoEnum,
  SanitaryOfficialLegalStatusEnum,
  SanitaryOfficialSistemaEnum,
  SistemaManejoEnum,
  TipoProducaoEnum,
} from "@/lib/offline/types";
import { supabase } from "@/lib/supabase";
import { buildSanitaryBaseCalendarPayload } from "@/lib/sanitario/calendar";

const OFFICIAL_PROTOCOL_SOURCE = "catalogo_oficial";
const OFFICIAL_PROTOCOL_SCOPE = "oficial";
const OFFICIAL_PROTOCOL_ACTIVATION_MODE = "materializar_protocolo";

type CachedOfficialCatalog = {
  templates: CatalogoProtocoloOficial[];
  items: CatalogoProtocoloOficialItem[];
  diseases: CatalogoDoencaNotificavel[];
};

export interface OfficialSanitaryPackConfigInput {
  uf: EstadoUFEnum | null;
  aptidao: SanitaryOfficialAptidaoEnum;
  sistema: SanitaryOfficialSistemaEnum;
  zonaRaivaRisco: FazendaSanitaryRiskLevelEnum;
  pressaoCarrapato: FazendaSanitaryRiskLevelEnum;
  pressaoHelmintos: FazendaSanitaryRiskLevelEnum;
  modoCalendario: FazendaSanitaryCalendarModeEnum;
}

export interface SelectedOfficialTemplate {
  template: CatalogoProtocoloOficial;
  items: CatalogoProtocoloOficialItem[];
  materializableItems: CatalogoProtocoloOficialItem[];
  skippedItems: CatalogoProtocoloOficialItem[];
}

export interface OfficialPackSelection {
  templates: SelectedOfficialTemplate[];
  diseases: CatalogoDoencaNotificavel[];
}

function readString(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readBoolean(
  record: Record<string, unknown> | null | undefined,
  key: string,
): boolean {
  return record?.[key] === true;
}

function readNumber(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNumberList(
  record: Record<string, unknown> | null | undefined,
  key: string,
): number[] | undefined {
  const raw = record?.[key];
  if (!Array.isArray(raw)) return undefined;

  const values = raw
    .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
    .map((entry) => Math.trunc(entry))
    .filter((entry) => entry >= 1 && entry <= 12);

  return values.length > 0 ? Array.from(new Set(values)) : undefined;
}

function resolveLegalStatuses(
  modoCalendario: FazendaSanitaryCalendarModeEnum,
): Set<SanitaryOfficialLegalStatusEnum> {
  if (modoCalendario === "minimo_legal") {
    return new Set(["obrigatorio"]);
  }
  if (modoCalendario === "tecnico_recomendado") {
    return new Set(["obrigatorio", "recomendado"]);
  }
  return new Set(["obrigatorio", "recomendado", "boa_pratica"]);
}

function matchesTemplateAptidao(
  template: CatalogoProtocoloOficial,
  aptidao: SanitaryOfficialAptidaoEnum,
) {
  return template.aptidao === "all" || template.aptidao === aptidao;
}

function matchesTemplateSistema(
  template: CatalogoProtocoloOficial,
  sistema: SanitaryOfficialSistemaEnum,
) {
  return template.sistema === "all" || template.sistema === sistema;
}

function matchesTemplateScope(
  template: CatalogoProtocoloOficial,
  uf: EstadoUFEnum | null,
) {
  if (template.escopo === "federal") return true;
  return template.uf !== null && uf !== null && template.uf === uf;
}

function resolveRiskValue(
  riskField: string,
  config: OfficialSanitaryPackConfigInput,
): FazendaSanitaryRiskLevelEnum | null {
  if (riskField === "zona_raiva_risco") return config.zonaRaivaRisco;
  if (riskField === "pressao_carrapato") return config.pressaoCarrapato;
  if (riskField === "pressao_helmintos") return config.pressaoHelmintos;
  return null;
}

function itemMatchesRisk(
  item: CatalogoProtocoloOficialItem,
  config: OfficialSanitaryPackConfigInput,
) {
  if (item.gatilho_tipo !== "risco") return true;

  const riskField = readString(item.gatilho_json, "risk_field");
  if (!riskField) return true;

  const expectedValues = (item.gatilho_json?.risk_values ?? null) as unknown;
  if (!Array.isArray(expectedValues) || expectedValues.length === 0) return true;

  const currentRisk = resolveRiskValue(riskField, config);
  if (!currentRisk) return false;

  return expectedValues.some((entry) => entry === currentRisk);
}

function resolveMaterializableSanitaryType(
  item: CatalogoProtocoloOficialItem,
): SanitarioTipoEnum | null {
  if (item.area === "vacinacao") return "vacinacao";
  if (item.area === "parasitas") return "vermifugacao";
  if (item.area === "medicamentos") return "medicamento";
  return null;
}

function isMaterializableItem(item: CatalogoProtocoloOficialItem) {
  return Boolean(resolveMaterializableSanitaryType(item));
}

function normalizeIntervalDays(item: CatalogoProtocoloOficialItem) {
  const intervalDays = readNumber(item.frequencia_json, "interval_days");
  return intervalDays && intervalDays > 0 ? Math.trunc(intervalDays) : 1;
}

function normalizeDoseNumber(item: CatalogoProtocoloOficialItem) {
  const doseNum = readNumber(item.frequencia_json, "dose_num");
  return doseNum && doseNum > 0 ? Math.trunc(doseNum) : null;
}

function buildCalendarPayload(item: CatalogoProtocoloOficialItem) {
  const label =
    readString(item.payload, "calendario_label") ??
    readString(item.payload, "label") ??
    item.codigo;

  if (item.gatilho_tipo === "idade") {
    return buildSanitaryBaseCalendarPayload({
      mode: "age_window",
      anchor: "birth",
      label,
      ageStartDays: readNumber(item.gatilho_json, "age_start_days"),
      ageEndDays: readNumber(item.gatilho_json, "age_end_days"),
      intervalDays:
        readBoolean(item.payload, "requer_reforco") || normalizeIntervalDays(item) > 1
          ? normalizeIntervalDays(item)
          : null,
      notes: readString(item.payload, "notes") ?? undefined,
    });
  }

  if (item.gatilho_tipo === "calendario") {
    return buildSanitaryBaseCalendarPayload({
      mode: "campaign",
      anchor: "calendar_month",
      label,
      months: readNumberList(item.gatilho_json, "months"),
      intervalDays: normalizeIntervalDays(item),
      notes: readString(item.payload, "notes") ?? undefined,
    });
  }

  if (item.gatilho_tipo === "risco") {
    return buildSanitaryBaseCalendarPayload({
      mode: "rolling_interval",
      anchor: "calendar_month",
      label,
      intervalDays: normalizeIntervalDays(item),
      ageStartDays: readNumber(item.gatilho_json, "age_start_days"),
      ageEndDays: readNumber(item.gatilho_json, "age_end_days"),
      notes: readString(item.payload, "notes") ?? undefined,
    });
  }

  if (item.gatilho_tipo === "uso_produto") {
    return buildSanitaryBaseCalendarPayload({
      mode: "clinical_protocol",
      anchor: "clinical_need",
      label,
      notes: readString(item.payload, "notes") ?? undefined,
    });
  }

  return buildSanitaryBaseCalendarPayload({
    mode: "immediate",
    anchor: "clinical_need",
    label,
    notes: readString(item.payload, "notes") ?? undefined,
  });
}

function resolveOfficialFamilyCode(template: CatalogoProtocoloOficial) {
  if (template.slug.includes("brucelose")) return "brucelose";
  if (template.slug.includes("raiva")) return "raiva_herbivoros";
  if (template.slug.includes("medicamentos")) return "medicamentos_rastreabilidade";
  if (template.slug.includes("parasitas")) return "controle_parasitario";
  if (template.slug.includes("transito")) return "transito_documental";
  if (template.slug.includes("quarentena")) return "quarentena_entrada";
  if (template.slug.includes("agua-limpeza")) return "agua_limpeza";
  if (template.slug.includes("feed-ban")) return "feed_ban_ruminantes";
  if (template.slug.includes("notificacao")) return "notificacao_suspeita";
  return template.slug.replaceAll("-", "_");
}

function resolveLegacySeedFamilyCode(
  protocol: Pick<ProtocoloSanitario, "payload">,
) {
  const familyCode = readString(protocol.payload, "family_code");
  if (familyCode) return familyCode;

  const templateCode = readString(protocol.payload, "template_code");
  if (!templateCode) return null;

  if (templateCode.startsWith("MAPA_RAIVA_")) return "raiva_herbivoros";
  if (templateCode.startsWith("MAPA_BRUCELOSE_")) return "brucelose";
  return null;
}

function buildOfficialProtocolPayload(
  template: CatalogoProtocoloOficial,
  config: OfficialSanitaryPackConfigInput,
  selection: SelectedOfficialTemplate,
): Record<string, unknown> {
  return {
    origem: OFFICIAL_PROTOCOL_SOURCE,
    source_origin: OFFICIAL_PROTOCOL_SOURCE,
    scope: OFFICIAL_PROTOCOL_SCOPE,
    activation_mode: OFFICIAL_PROTOCOL_ACTIVATION_MODE,
    family_code: resolveOfficialFamilyCode(template),
    canonical_key: template.slug,
    official_pack_active: true,
    official_template_id: template.id,
    official_slug: template.slug,
    official_versao: template.versao,
    official_scope: template.escopo,
    official_uf: template.uf,
    status_legal: template.status_legal,
    obrigatorio: template.status_legal === "obrigatorio",
    base_legal_json: template.base_legal_json,
    regulatory_overlay: template.escopo === "estadual" ? config.uf : "federal",
    materialized_item_count: selection.materializableItems.length,
    skipped_item_count: selection.skippedItems.length,
    ...template.payload,
  };
}

function buildOfficialProtocolItemPayload(
  template: CatalogoProtocoloOficial,
  item: CatalogoProtocoloOficialItem,
): Record<string, unknown> {
  return {
    origem: OFFICIAL_PROTOCOL_SOURCE,
    source_origin: OFFICIAL_PROTOCOL_SOURCE,
    scope: OFFICIAL_PROTOCOL_SCOPE,
    activation_mode: OFFICIAL_PROTOCOL_ACTIVATION_MODE,
    family_code: resolveOfficialFamilyCode(template),
    canonical_key: `${template.slug}:${item.codigo}`,
    official_template_id: template.id,
    official_item_id: item.id,
    official_item_code: item.codigo,
    official_area: item.area,
    status_legal: template.status_legal,
    categoria_animal: item.categoria_animal,
    gatilho_tipo: item.gatilho_tipo,
    gatilho_json: item.gatilho_json,
    frequencia_json: item.frequencia_json,
    requires_vet: item.requires_vet,
    requires_gta: item.requires_gta,
    carencia_regra_json: item.carencia_regra_json,
    ...buildCalendarPayload(item),
    ...item.payload,
  };
}

export function resolveOfficialAptidao(
  tipoProducao: TipoProducaoEnum | null | undefined,
): SanitaryOfficialAptidaoEnum {
  if (tipoProducao === "corte") return "corte";
  if (tipoProducao === "leite") return "leite";
  if (tipoProducao === "mista") return "misto";
  return "all";
}

export function resolveOfficialSistema(
  sistemaManejo: SistemaManejoEnum | null | undefined,
): SanitaryOfficialSistemaEnum {
  if (sistemaManejo === "pastagem") return "extensivo";
  if (sistemaManejo === "semi_confinamento") return "semi_intensivo";
  if (sistemaManejo === "confinamento") return "intensivo";
  return "all";
}

export async function refreshOfficialSanitaryCatalog(): Promise<CachedOfficialCatalog> {
  const [templatesResult, itemsResult, diseasesResult] = await Promise.all([
    supabase
      .from("catalogo_protocolos_oficiais")
      .select("*")
      .order("escopo", { ascending: true })
      .order("uf", { ascending: true })
      .order("nome", { ascending: true }),
    supabase
      .from("catalogo_protocolos_oficiais_itens")
      .select("*")
      .order("template_id", { ascending: true })
      .order("codigo", { ascending: true }),
    supabase
      .from("catalogo_doencas_notificaveis")
      .select("*")
      .order("nome", { ascending: true }),
  ]);

  if (templatesResult.error) throw new Error(templatesResult.error.message);
  if (itemsResult.error) throw new Error(itemsResult.error.message);
  if (diseasesResult.error) throw new Error(diseasesResult.error.message);

  const templates = (templatesResult.data ?? []) as CatalogoProtocoloOficial[];
  const items = (itemsResult.data ?? []) as CatalogoProtocoloOficialItem[];
  const diseases = (diseasesResult.data ?? []) as CatalogoDoencaNotificavel[];

  await db.transaction(
    "rw",
    db.catalog_protocolos_oficiais,
    db.catalog_protocolos_oficiais_itens,
    db.catalog_doencas_notificaveis,
    async () => {
      await db.catalog_protocolos_oficiais.clear();
      await db.catalog_protocolos_oficiais_itens.clear();
      await db.catalog_doencas_notificaveis.clear();

      if (templates.length > 0) {
        await db.catalog_protocolos_oficiais.bulkPut(templates);
      }
      if (items.length > 0) {
        await db.catalog_protocolos_oficiais_itens.bulkPut(items);
      }
      if (diseases.length > 0) {
        await db.catalog_doencas_notificaveis.bulkPut(diseases);
      }
    },
  );

  return { templates, items, diseases };
}

export async function readCachedOfficialSanitaryCatalog(): Promise<CachedOfficialCatalog> {
  const [templates, items, diseases] = await Promise.all([
    db.catalog_protocolos_oficiais.toArray(),
    db.catalog_protocolos_oficiais_itens.toArray(),
    db.catalog_doencas_notificaveis.toArray(),
  ]);

  return { templates, items, diseases };
}

export function selectOfficialSanitaryPack(
  catalog: CachedOfficialCatalog,
  config: OfficialSanitaryPackConfigInput,
): OfficialPackSelection {
  const allowedStatuses = resolveLegalStatuses(config.modoCalendario);
  const itemsByTemplate = new Map<string, CatalogoProtocoloOficialItem[]>();

  for (const item of catalog.items) {
    const group = itemsByTemplate.get(item.template_id) ?? [];
    group.push(item);
    itemsByTemplate.set(item.template_id, group);
  }

  const templates = catalog.templates
    .filter((template) => allowedStatuses.has(template.status_legal))
    .filter((template) => matchesTemplateScope(template, config.uf))
    .filter((template) => matchesTemplateAptidao(template, config.aptidao))
    .filter((template) => matchesTemplateSistema(template, config.sistema))
    .map((template) => {
      const matchingItems = (itemsByTemplate.get(template.id) ?? []).filter((item) =>
        itemMatchesRisk(item, config),
      );

      const materializableItems = matchingItems.filter(isMaterializableItem);
      const skippedItems = matchingItems.filter((item) => !isMaterializableItem(item));

      return {
        template,
        items: matchingItems,
        materializableItems,
        skippedItems,
      } satisfies SelectedOfficialTemplate;
    })
    .filter((selection) => selection.items.length > 0)
    .sort((left, right) => {
      if (left.template.escopo !== right.template.escopo) {
        return left.template.escopo === "federal" ? -1 : 1;
      }
      return left.template.nome.localeCompare(right.template.nome);
    });

  return {
    templates,
    diseases: catalog.diseases,
  };
}

export async function buildOfficialSanitaryPackOps(input: {
  fazendaId: string;
  config: OfficialSanitaryPackConfigInput;
  selection: OfficialPackSelection;
}): Promise<OperationInput[]> {
  const [existingConfig, existingProtocols, existingProtocolItems] = await Promise.all([
    db.state_fazenda_sanidade_config.get(input.fazendaId),
    db.state_protocolos_sanitarios
      .where("fazenda_id")
      .equals(input.fazendaId)
      .filter((record) => !record.deleted_at)
      .toArray(),
    db.state_protocolos_sanitarios_itens
      .where("fazenda_id")
      .equals(input.fazendaId)
      .filter((record) => !record.deleted_at)
      .toArray(),
  ]);

  const existingProtocolByOfficialId = new Map<string, ProtocoloSanitario>();
  for (const protocol of existingProtocols) {
    const officialTemplateId = readString(protocol.payload, "official_template_id");
    if (officialTemplateId) {
      existingProtocolByOfficialId.set(officialTemplateId, protocol);
    }
  }

  const existingItemByOfficialId = new Map<string, ProtocoloSanitarioItem>();
  for (const item of existingProtocolItems) {
    const officialItemId = readString(item.payload, "official_item_id");
    if (officialItemId) {
      existingItemByOfficialId.set(officialItemId, item);
    }
  }

  const activationPayload = {
    activated_template_ids: input.selection.templates.map((entry) => entry.template.id),
    activated_template_slugs: input.selection.templates.map((entry) => entry.template.slug),
    activated_disease_codes: input.selection.diseases.map((entry) => entry.codigo),
    non_materialized_template_ids: input.selection.templates
      .filter((entry) => entry.materializableItems.length === 0)
      .map((entry) => entry.template.id),
    non_materialized_template_slugs: input.selection.templates
      .filter((entry) => entry.materializableItems.length === 0)
      .map((entry) => entry.template.slug),
    updated_at_context: new Date().toISOString(),
  };
  const selectedTemplateIds = new Set(
    input.selection.templates.map((entry) => entry.template.id),
  );
  const selectedFamilyCodes = new Set(
    input.selection.templates.map((entry) => resolveOfficialFamilyCode(entry.template)),
  );

  const configRecord = {
    fazenda_id: input.fazendaId,
    uf: input.config.uf,
    aptidao: input.config.aptidao,
    sistema: input.config.sistema,
    zona_raiva_risco: input.config.zonaRaivaRisco,
    pressao_carrapato: input.config.pressaoCarrapato,
    pressao_helmintos: input.config.pressaoHelmintos,
    modo_calendario: input.config.modoCalendario,
    payload: {
      ...(existingConfig?.payload ?? {}),
      ...activationPayload,
    },
  };

  const ops: OperationInput[] = [
    {
      table: "fazenda_sanidade_config",
      action: existingConfig ? "UPDATE" : "INSERT",
      record: configRecord,
    },
  ];

  for (const existingProtocol of existingProtocols) {
    const officialTemplateId = readString(
      existingProtocol.payload,
      "official_template_id",
    );
    if (officialTemplateId) {
      if (selectedTemplateIds.has(officialTemplateId)) {
        continue;
      }

      ops.push({
        table: "protocolos_sanitarios",
        action: "UPDATE",
        record: {
          id: existingProtocol.id,
          ativo: false,
          payload: {
            ...(existingProtocol.payload ?? {}),
            official_pack_active: false,
            official_pack_disabled_at: new Date().toISOString(),
            official_pack_disabled_reason:
              "template_removed_from_current_official_selection",
          },
        },
      });

      continue;
    }

    const legacyFamilyCode = resolveLegacySeedFamilyCode(existingProtocol);
    if (!legacyFamilyCode || !selectedFamilyCodes.has(legacyFamilyCode)) {
      continue;
    }

    ops.push({
      table: "protocolos_sanitarios",
      action: "UPDATE",
      record: {
        id: existingProtocol.id,
        ativo: false,
        payload: {
          ...(existingProtocol.payload ?? {}),
          official_pack_active: false,
          official_pack_disabled_at: new Date().toISOString(),
          official_pack_disabled_reason:
            "legacy_seed_replaced_by_current_official_family",
        },
      },
    });
  }

  for (const selection of input.selection.templates) {
    if (selection.materializableItems.length === 0) continue;

    const existingProtocol = existingProtocolByOfficialId.get(selection.template.id) ?? null;
    const protocolId = existingProtocol?.id ?? crypto.randomUUID();

    ops.push({
      table: "protocolos_sanitarios",
      action: existingProtocol ? "UPDATE" : "INSERT",
      record: {
        id: protocolId,
        nome: selection.template.nome,
        descricao:
          readString(selection.template.payload, "descricao_operacional") ??
          readString(selection.template.payload, "descricao") ??
          selection.template.nome,
        ativo: true,
        payload: buildOfficialProtocolPayload(
          selection.template,
          input.config,
          selection,
        ),
      },
    });

    for (const item of selection.materializableItems) {
      const existingItem = existingItemByOfficialId.get(item.id) ?? null;
      const itemPayload = buildOfficialProtocolItemPayload(selection.template, item);
      const trigger = item.gatilho_json;
      const sanitaryType = resolveMaterializableSanitaryType(item);
      if (!sanitaryType) continue;

      ops.push({
        table: "protocolos_sanitarios_itens",
        action: existingItem ? "UPDATE" : "INSERT",
        record: {
          id: existingItem?.id ?? crypto.randomUUID(),
          protocolo_id: protocolId,
          protocol_item_id: existingItem?.protocol_item_id ?? crypto.randomUUID(),
          version: existingItem?.version ?? 1,
          tipo: sanitaryType,
          produto: readString(item.payload, "produto") ?? item.codigo,
          intervalo_dias: normalizeIntervalDays(item),
          dose_num: normalizeDoseNumber(item),
          gera_agenda: item.gera_agenda,
          dedup_template:
            readString(item.payload, "dedup_template") ??
            `${selection.template.slug}:{animal_id}:${item.codigo}`,
          payload: {
            ...itemPayload,
            indicacao:
              readString(item.payload, "indicacao") ??
              readString(item.payload, "label") ??
              item.codigo,
            sexo_alvo: readString(trigger, "sexo_alvo") ?? null,
            idade_min_dias: readNumber(trigger, "age_start_days") ?? null,
            idade_max_dias: readNumber(trigger, "age_end_days") ?? null,
            obrigatorio: selection.template.status_legal === "obrigatorio",
          },
        },
      });
    }
  }

  return ops;
}

export async function activateOfficialSanitaryPack(input: {
  fazendaId: string;
  config: OfficialSanitaryPackConfigInput;
}) {
  let catalog = await readCachedOfficialSanitaryCatalog();
  if (catalog.templates.length === 0) {
    catalog = await refreshOfficialSanitaryCatalog();
  }

  const selection = selectOfficialSanitaryPack(catalog, input.config);
  const ops = await buildOfficialSanitaryPackOps({
    fazendaId: input.fazendaId,
    config: input.config,
    selection,
  });

  const clientTxId =
    ops.length > 0 ? await createGesture(input.fazendaId, ops) : null;

  return {
    clientTxId,
    selection,
    operationCount: ops.length,
  };
}
