import { pullDataForFarm } from "@/lib/offline/pull";
import { refreshVeterinaryProductsCatalog } from "@/lib/sanitario/products";

type PullDataForFarmFn = typeof pullDataForFarm;
type RefreshVeterinaryProductsCatalogFn = typeof refreshVeterinaryProductsCatalog;

export async function refreshRegistrarSanitaryProtocolsEffect(input: {
  activeFarmId: string | null;
  pullDataForFarmFn?: PullDataForFarmFn;
}) {
  if (!input.activeFarmId) {
    return;
  }

  const pullFn = input.pullDataForFarmFn ?? pullDataForFarm;
  await pullFn(input.activeFarmId, [
    "protocolos_sanitarios",
    "protocolos_sanitarios_itens",
  ]);
}

export async function refreshRegistrarVeterinaryProductsEffect(input: {
  activeFarmId: string | null;
  refreshCatalogFn?: RefreshVeterinaryProductsCatalogFn;
}) {
  if (!input.activeFarmId) {
    return;
  }

  const refreshCatalogFn = input.refreshCatalogFn ?? refreshVeterinaryProductsCatalog;
  await refreshCatalogFn();
}
