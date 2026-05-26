import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "@/lib/offline/db";
import { pullDataForFarm } from "@/lib/offline/pull";
import { refreshVeterinaryProductsCatalog } from "@/lib/sanitario/catalog/products";

type UseProtocolosDataInput = {
  activeFarmId: string | null;
};

export function useProtocolosData({ activeFarmId }: UseProtocolosDataInput) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFarmId) return;

    setIsRefreshing(true);
    setRefreshError(null);
    pullDataForFarm(
      activeFarmId,
      [
        "agenda_itens",
        "animais",
        "protocolos_sanitarios",
        "protocolos_sanitarios_itens",
        "fazenda_sanidade_config",
      ],
      { mode: "merge" },
    ).catch((error) => {
      console.warn("[protocolos-sanitarios] failed to refresh protocols", error);
      setRefreshError("Falha ao atualizar protocolos locais.");
    }).finally(() => {
      setIsRefreshing(false);
    });
  }, [activeFarmId]);

  useEffect(() => {
    refreshVeterinaryProductsCatalog().catch((error) => {
      console.warn(
        "[protocolos-sanitarios] failed to refresh veterinary products",
        error,
      );
    });
  }, []);

  const catalogProducts = useLiveQuery(() => {
    return db.catalog_produtos_veterinarios.orderBy("nome").toArray();
  }, []);

  const protocolosExistentes = useLiveQuery(() => {
    if (!activeFarmId) return [];

    return db.state_protocolos_sanitarios
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((protocol) => !protocol.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const protocolosItensExistentes = useLiveQuery(() => {
    if (!activeFarmId) return [];

    return db.state_protocolos_sanitarios_itens
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((item) => !item.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const agendaItens = useLiveQuery(() => {
    if (!activeFarmId) return [];

    return db.state_agenda_itens
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((item) => !item.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const animais = useLiveQuery(() => {
    if (!activeFarmId) return [];

    return db.state_animais
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((animal) => !animal.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const sanidadeConfig = useLiveQuery(() => {
    if (!activeFarmId) return null;

    return db.state_fazenda_sanidade_config.get(activeFarmId);
  }, [activeFarmId]);

  return {
    catalogProducts: catalogProducts ?? [],
    protocolosExistentes: protocolosExistentes ?? [],
    protocolosItensExistentes: protocolosItensExistentes ?? [],
    agendaItens: agendaItens ?? [],
    animais: animais ?? [],
    sanidadeConfig: sanidadeConfig ?? null,
    isRefreshing,
    refreshError,
    isLoading:
      catalogProducts === undefined ||
      protocolosExistentes === undefined ||
      protocolosItensExistentes === undefined ||
      agendaItens === undefined ||
      animais === undefined ||
      sanidadeConfig === undefined,
  };
}
