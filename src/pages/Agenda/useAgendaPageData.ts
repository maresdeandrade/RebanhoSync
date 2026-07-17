import { useLiveQuery } from "dexie-react-hooks";

import { db } from "@/lib/offline/db";
import type {
  AgendaItem,
  Animal,
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  FazendaSanidadeConfig,
  Gesture,
  Lote,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
} from "@/lib/offline/types";
import type { AgendaPageData } from "@/pages/Agenda/helpers/derivations";
import {
  formatSanitaryProductClassLabelV2,
} from "@/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2";

type AgendaPageDataRaw = {
  itens?: AgendaItem[] | null;
  animais?: Animal[] | null;
  lotes?: Lote[] | null;
  protocolos?: ProtocoloSanitario[] | null;
  protocoloItens?: ProtocoloSanitarioItem[] | null;
  gestos?: Gesture[] | null;
  sanidadeConfig?: FazendaSanidadeConfig | null;
  officialTemplates?: CatalogoProtocoloOficial[] | null;
  officialTemplateItems?: CatalogoProtocoloOficialItem[] | null;
  sanitaryAgendasV2?: SanitarioAgendaLocalV2[] | null;
  sanitaryAgendaAnimalsV2?: SanitarioAgendaAnimalLocalV2[] | null;
};

function readText(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapSanitaryAgendaStatus(status: SanitarioAgendaLocalV2["status"]) {
  if (status === "cancelada" || status === "dispensada") return "cancelado";
  if (status === "executada" || status === "fechada") return "concluido";
  return "agendado";
}

function buildSanitaryAgendaV2AdapterItems(input: {
  agendas: SanitarioAgendaLocalV2[];
  agendaAnimals: SanitarioAgendaAnimalLocalV2[];
  animals: Animal[];
  lots: Lote[];
}): AgendaItem[] {
  const animalsById = new Map(input.animals.map((animal) => [animal.id, animal]));
  const lotsById = new Map(input.lots.map((lot) => [lot.id, lot]));
  const agendaAnimalsById = new Map<string, SanitarioAgendaAnimalLocalV2[]>();

  for (const entry of input.agendaAnimals) {
    const current = agendaAnimalsById.get(entry.agenda_id) ?? [];
    current.push(entry);
    agendaAnimalsById.set(entry.agenda_id, current);
  }

  return input.agendas
    .filter((agenda) => !agenda.deleted_at)
    .map((agenda): AgendaItem => {
      const entries = agendaAnimalsById.get(agenda.id) ?? [];
      const firstAnimalId = entries.length === 1 ? entries[0].animal_id : null;
      const firstAnimal = firstAnimalId ? animalsById.get(firstAnimalId) : null;
      const lot = agenda.lote_id ? lotsById.get(agenda.lote_id) : null;
      const protocolLabel =
        readText(agenda.metadata, "protocolName") ??
        readText(agenda.protocol_item_snapshot, "protocolName") ??
        "Protocolo sanitário";
      const itemLabel =
        readText(agenda.metadata, "itemLabel") ??
        readText(agenda.protocol_item_snapshot, "itemLabel") ??
        "Manejo sanitário";
      const productClass =
        agenda.produto_classe ??
        readText(agenda.metadata, "productClass") ??
        readText(agenda.protocol_item_snapshot, "productClass") ??
        readText(agenda.protocol_item_snapshot, "product_class");
      const productLabel =
        readText(agenda.produto_snapshot, "productName") ??
        readText(agenda.produto_snapshot, "nome_comercial") ??
        formatSanitaryProductClassLabelV2(productClass) ??
        "Produto definido na execução";
      const animalTargetLabel =
        entries.length === 1
          ? firstAnimal?.identificacao ?? "Animal não encontrado"
          : entries.length > 1
            ? `${entries.length} animais`
            : null;
      const targetScope = readText(agenda.metadata, "targetAnimalScope");
      const targetLabel =
        animalTargetLabel ??
        (agenda.lote_id && targetScope === "lote_sem_animais_explicitos"
          ? "Lote inteiro"
          : lot?.nome ?? "Alvo sanitário");

      return {
        id: `sanitario-v2:${agenda.id}`,
        fazenda_id: agenda.fazenda_id,
        dominio: "sanitario",
        tipo: itemLabel,
        status: mapSanitaryAgendaStatus(agenda.status),
        data_prevista: agenda.data_programada,
        animal_id: firstAnimalId,
        lote_id: agenda.lote_id ?? firstAnimal?.lote_id ?? null,
        dedup_key: agenda.dedup_key,
        source_kind: "manual",
        source_ref: {
          agenda_v2_id: agenda.id,
          protocolo_id: agenda.protocolo_id,
          protocolo: protocolLabel,
          produto: productLabel,
          target_label: targetLabel,
          lote_label: lot?.nome ?? null,
          indicacao: `${protocolLabel} · ${targetLabel}`,
        },
        source_client_op_id: agenda.client_op_id,
        source_tx_id: agenda.client_tx_id,
        source_evento_id: agenda.execution_evento_id,
        protocol_item_version_id: agenda.protocol_item_version_id,
        protocol_item_logical_key:
          readText(agenda.metadata, "itemKey") ??
          readText(agenda.protocol_item_snapshot, "logicalItemKey") ??
          readText(agenda.protocol_item_snapshot, "logical_item_key"),
        protocol_item_version:
          typeof agenda.protocol_item_snapshot.version === "number"
            ? agenda.protocol_item_snapshot.version
            : null,
        protocol_item_code: readText(agenda.protocol_item_snapshot, "itemCode"),
        interval_days_applied: null,
        payload: {
          ...agenda.metadata,
          agenda_v2_id: agenda.id,
          targetLabel,
          protocolLabel,
          itemLabel,
          source: "ops_sanitario_agenda_v2",
        },
        client_id: agenda.client_id,
        client_op_id: agenda.client_op_id,
        client_tx_id: agenda.client_tx_id,
        client_recorded_at: agenda.client_recorded_at,
        server_received_at: agenda.server_received_at,
        created_at: agenda.created_at,
        updated_at: agenda.updated_at,
        deleted_at: agenda.deleted_at,
      };
    });
}

export function normalizeAgendaPageData(
  raw: AgendaPageDataRaw | null | undefined,
): AgendaPageData {
  const activeAnimals = (raw?.animais ?? []).filter((animal) => !animal.deleted_at);
  const activeLots = (raw?.lotes ?? []).filter((lote) => !lote.deleted_at);
  return {
    itens: [
      ...(raw?.itens ?? []).filter((item) => !item.deleted_at),
      ...buildSanitaryAgendaV2AdapterItems({
        agendas: raw?.sanitaryAgendasV2 ?? [],
        agendaAnimals: raw?.sanitaryAgendaAnimalsV2 ?? [],
        animals: activeAnimals,
        lots: activeLots,
      }),
    ],
    animais: activeAnimals,
    lotes: activeLots,
    protocolos: (raw?.protocolos ?? []).filter(
      (protocolo) => !protocolo.deleted_at,
    ),
    protocoloItens: (raw?.protocoloItens ?? []).filter(
      (item) => !item.deleted_at,
    ),
    gestos: raw?.gestos ?? [],
    sanidadeConfig:
      raw?.sanidadeConfig && !raw.sanidadeConfig.deleted_at
        ? raw.sanidadeConfig
        : null,
    officialTemplates: raw?.officialTemplates ?? [],
    officialTemplateItems: raw?.officialTemplateItems ?? [],
  };
}

export function useAgendaPageData(activeFarmId: string | null) {
  return useLiveQuery(async () => {
    if (!activeFarmId) {
      return normalizeAgendaPageData(null);
    }

    const [
      itens,
      animais,
      lotes,
      protocolos,
      protocoloItens,
      gestos,
      sanidadeConfig,
      officialTemplates,
      officialTemplateItems,
      sanitaryAgendasV2,
      sanitaryAgendaAnimalsV2,
    ] = await Promise.all([
      db.state_agenda_itens.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_protocolos_sanitarios
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.state_protocolos_sanitarios_itens
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.queue_gestures.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_fazenda_sanidade_config.get(activeFarmId),
      db.catalog_protocolos_oficiais.toArray(),
      db.catalog_protocolos_oficiais_itens.toArray(),
      db.ops_sanitario_agenda_v2.where("fazenda_id").equals(activeFarmId).toArray(),
      db.ops_sanitario_agenda_animais_v2
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
    ]);

    return normalizeAgendaPageData({
      itens,
      animais,
      lotes,
      protocolos,
      protocoloItens,
      gestos,
      sanidadeConfig,
      officialTemplates,
      officialTemplateItems,
      sanitaryAgendasV2,
      sanitaryAgendaAnimalsV2,
    });
  }, [activeFarmId]);
}
