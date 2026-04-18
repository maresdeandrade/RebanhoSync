import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "@/lib/offline/db";
import { pullDataForFarm } from "@/lib/offline/pull";
import { refreshVeterinaryProductsCatalog } from "@/lib/sanitario/products";

type UseProtocolosDataInput = {
  activeFarmId: string | null;
};

export function useProtocolosData({ activeFarmId }: UseProtocolosDataInput) {
  useEffect(() => {
    if (!activeFarmId) return;

    pullDataForFarm(
      activeFarmId,
      [
        "protocolos_sanitarios",
        "protocolos_sanitarios_itens",
        "fazenda_sanidade_config",
      ],
      { mode: "merge" },
    ).catch((error) => {
      console.warn("[protocolos-sanitarios] failed to refresh protocols", error);
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

  return {
    catalogProducts: catalogProducts ?? [],
    protocolosExistentes: protocolosExistentes ?? [],
    protocolosItensExistentes: protocolosItensExistentes ?? [],
  };
}
