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
} from "@/lib/offline/types";
import type { AgendaPageData } from "@/pages/Agenda/helpers/derivations";

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
};

export function normalizeAgendaPageData(
  raw: AgendaPageDataRaw | null | undefined,
): AgendaPageData {
  return {
    itens: (raw?.itens ?? []).filter((item) => !item.deleted_at),
    animais: (raw?.animais ?? []).filter((animal) => !animal.deleted_at),
    lotes: (raw?.lotes ?? []).filter((lote) => !lote.deleted_at),
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
    });
  }, [activeFarmId]);
}
