/**
 * Mapeamento entre o nome da tabela no Supabase e o store correspondente no Dexie.
 * Isso permite que a UI use nomes simples (ex: 'animais') enquanto o Dexie
 * utiliza stores prefixados (ex: 'state_animais').
 */
export const TABLE_MAP: Record<string, string> = {
  // State Rails
  'animais': 'state_animais',
  'lotes': 'state_lotes',
  'pastos': 'state_pastos',
  'agenda_itens': 'state_agenda_itens',
  'contrapartes': 'state_contrapartes',
  'protocolos_sanitarios': 'state_protocolos_sanitarios',
  'protocolos_sanitarios_itens': 'state_protocolos_sanitarios_itens',

  // Event Rails (Append-Only)
  'eventos': 'event_eventos',
  'eventos_sanitario': 'event_eventos_sanitario',
  'eventos_pesagem': 'event_eventos_pesagem',
  'eventos_nutricao': 'event_eventos_nutricao',
  'eventos_movimentacao': 'event_eventos_movimentacao',
  'eventos_reproducao': 'event_event_reproducao',
  'eventos_financeiro': 'event_eventos_financeiro',
};

/**
 * Retorna o nome do store local baseado no nome da tabela remota.
 */
export const getLocalStoreName = (remoteTable: string): string => {
  const localName = TABLE_MAP[remoteTable];
  if (!localName) {
    console.warn(`[table-map] No local store found for remote table: ${remoteTable}. Using as-is.`);
    return remoteTable;
  }
  return localName;
};