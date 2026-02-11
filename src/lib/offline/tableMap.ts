/**
 * Mapeamento entre o nome da tabela no Supabase e o store correspondente no Dexie.
 */
export const TABLE_MAP: Record<string, string> = {
  // State Rails
  animais: "state_animais",
  lotes: "state_lotes",
  pastos: "state_pastos",
  agenda_itens: "state_agenda_itens",
  contrapartes: "state_contrapartes",
  animais_sociedade: "state_animais_sociedade", // FASE 2.2
  categorias_zootecnicas: "state_categorias_zootecnicas", // FASE 2.3
  protocolos_sanitarios: "state_protocolos_sanitarios",
  protocolos_sanitarios_itens: "state_protocolos_sanitarios_itens",

  // Event Rails (Append-Only)
  eventos: "event_eventos",
  eventos_sanitario: "event_eventos_sanitario",
  eventos_pesagem: "event_eventos_pesagem",
  eventos_nutricao: "event_eventos_nutricao",
  eventos_movimentacao: "event_eventos_movimentacao",
  eventos_reproducao: "event_eventos_reproducao",
  eventos_financeiro: "event_eventos_financeiro",
};

// Reverse map (localStore -> remoteTable) calculado 1x
const REVERSE_TABLE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TABLE_MAP).map(([remote, local]) => [local, remote]),
);

/**
 * Retorna o nome do store local baseado no nome da tabela remota.
 * Se já vier no formato local (state_/event_), retorna como está (sem warning).
 */
export const getLocalStoreName = (remoteTable: string): string => {
  if (remoteTable.startsWith("state_") || remoteTable.startsWith("event_")) {
    return remoteTable; // já é local
  }
  const localName = TABLE_MAP[remoteTable];
  if (!localName) {
    console.warn(
      `[table-map] No local store found for remote table: ${remoteTable}. Using as-is.`,
    );
    return remoteTable;
  }
  return localName;
};

/**
 * Retorna o nome da tabela remota baseado no nome do store local.
 * - Se já vier remoto (chave em TABLE_MAP), retorna como está (sem warning).
 * - Se vier local (state_/event_), traduz via reverse map.
 * - Só emite warning quando parece local e não está mapeado.
 */
export const getRemoteTableName = (storeOrRemote: string): string => {
  if (TABLE_MAP[storeOrRemote]) {
    return storeOrRemote; // já é remoto
  }
  const remote = REVERSE_TABLE_MAP[storeOrRemote];
  if (remote) return remote;

  if (
    storeOrRemote.startsWith("state_") ||
    storeOrRemote.startsWith("event_")
  ) {
    console.warn(
      `[table-map] No remote table found for local store: ${storeOrRemote}. Using as-is.`,
    );
  }
  return storeOrRemote;
};
