import { supabase } from "@/lib/supabase";
import { db } from "./db";

export const pullInitialData = async (fazenda_id: string) => {
  console.log(`[pull] Starting initial pull for farm ${fazenda_id}`);
  
  const tables = [
    { remote: 'pastos', local: 'state_pastos' },
    { remote: 'lotes', local: 'state_lotes' },
    { remote: 'animais', local: 'state_animais' },
    { remote: 'agenda_itens', local: 'state_agenda_itens' },
    { remote: 'protocolos_sanitarios', local: 'state_protocolos_sanitarios' },
    { remote: 'protocolos_sanitarios_itens', local: 'state_protocolos_sanitarios_itens' },
    { remote: 'contrapartes', local: 'state_contrapartes' },
  ];

  for (const t of tables) {
    const { data, error } = await supabase
      .from(t.remote)
      .select('*')
      .eq('fazenda_id', fazenda_id)
      .is('deleted_at', null);

    if (error) {
      console.error(`[pull] Error pulling ${t.remote}:`, error);
      continue;
    }

    if (data) {
      const store = (db as any)[t.local];
      await store.clear();
      await store.bulkAdd(data);
      console.log(`[pull] Synced ${data.length} records for ${t.remote}`);
    }
  }
};