import { supabase } from "@/lib/supabase";

/** Full-metadata writers must not replace a snapshot changed by another save. */
export interface FarmWriteSnapshot { farmId: string; updatedAt: string; }
export async function updateFarmFromSnapshot(farmId: string, snapshot: FarmWriteSnapshot | null, changes: Record<string, unknown>) {
  if (!snapshot?.updatedAt || snapshot.farmId !== farmId) throw new Error("Recarregue os dados da fazenda antes de salvar.");
  const { data, error } = await supabase.from("fazendas").update(changes)
    .eq("id", farmId).eq("updated_at", snapshot.updatedAt).select("metadata, updated_at").single();
  if (error?.code === "PGRST116" || (!error && !data)) {
    throw new Error("A fazenda foi alterada ou seu acesso mudou. Recarregue os dados antes de salvar novamente.");
  }
  if (error) throw error;
  return data;
}
