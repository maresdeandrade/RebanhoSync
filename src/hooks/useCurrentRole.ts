import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type UserRole = "owner" | "manager" | "cowboy";

export function useCurrentRole(fazendaId: string | null): UserRole | null {
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (!fazendaId) {
      setRole(null);
      return;
    }

    loadRole();

    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_fazendas")
        .select("role")
        .eq("user_id", user.id)
        .eq("fazenda_id", fazendaId!)
        .is("deleted_at", null)
        .maybeSingle();

      setRole(data?.role as UserRole);
    }
  }, [fazendaId]);

  return role;
}
