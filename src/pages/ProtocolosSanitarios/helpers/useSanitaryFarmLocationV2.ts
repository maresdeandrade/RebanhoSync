import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Read the registered farm location; no second persisted location or offline writer.
export function useSanitaryFarmLocationV2(fazendaId: string | null) {
  const [location, setLocation] = useState<{ fazendaId: string; municipio: string | null } | null>(null);
  useEffect(() => {
    let current = true;
    if (!fazendaId) return () => { current = false; };
    void supabase.from("fazendas").select("municipio").eq("id", fazendaId).is("deleted_at", null).maybeSingle()
      .then(({ data, error }) => {
        if (current) setLocation(error || !data ? null : { fazendaId, municipio: data.municipio });
      }, () => { if (current) setLocation(null); });
    return () => { current = false; };
  }, [fazendaId]);
  // Never expose the previous farm while a new request is pending or offline.
  return location?.fazendaId === fazendaId ? location : null;
}
