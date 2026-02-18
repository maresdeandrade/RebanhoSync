import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Session, User } from "@supabase/supabase-js";
import { z } from "zod";
import { STORAGE_PREFIX } from "./auth-constants";

// Role schema for runtime validation
const RoleSchema = z.enum(["cowboy", "manager", "owner"]);
type UserRole = z.infer<typeof RoleSchema>;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  activeFarmId: string | null;
  role: UserRole | null;
  loadRoleForFarm: (userId: string, farmId: string) => Promise<void>;
  setActiveFarm: (farmId: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`${STORAGE_PREFIX}active_fazenda_id`);
    } catch (e) {
      return null;
    }
  });
  const [role, setRole] = useState<UserRole | null>(null);

  // Helper function to apply theme
  const applyTheme = (themeValue: string) => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (themeValue === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(themeValue);
    }
  };

  const loadRoleForFarm = useCallback(async (userId: string, farmId: string) => {
    const { data: membership, error } = await supabase
      .from("user_fazendas")
      .select("role")
      .eq("user_id", userId)
      .eq("fazenda_id", farmId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.warn("[useAuth] Error fetching role:", error);
      setRole(null);
      return;
    }

    const roleResult = RoleSchema.safeParse(membership?.role);
    setRole(roleResult.success ? roleResult.data : null);

    if (!roleResult.success) {
      console.warn("[useAuth] Invalid role from database:", membership?.role);
    }
  }, []);

  const persistActiveFarmToRemote = useCallback(async (userId: string, farmId: string) => {
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        active_fazenda_id: farmId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    );

    if (error) {
      console.warn("[useAuth] Failed to persist farm to remote:", error);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Load from localStorage first
      const localFarmId = localStorage.getItem(
        `${STORAGE_PREFIX}active_fazenda_id`,
      );

      if (localFarmId) {
        setActiveFarmId(localFarmId);
        await loadRoleForFarm(user.id, localFarmId);
      }

      // Fetch remote settings
      const { data: settings, error } = await supabase
        .from("user_settings")
        .select("active_fazenda_id, theme")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.warn("[useAuth] Error fetching user_settings:", error);
        return;
      }

      if (
        settings?.active_fazenda_id &&
        settings.active_fazenda_id !== localFarmId
      ) {
        if (import.meta.env.DEV) {
          console.debug(
            "[useAuth] Syncing farm from remote:",
            settings.active_fazenda_id,
          );
        }
        setActiveFarmId(settings.active_fazenda_id);
        try {
          localStorage.setItem(
            `${STORAGE_PREFIX}active_fazenda_id`,
            settings.active_fazenda_id,
          );
        } catch (e) {
          console.error("[useAuth] Error updating localStorage:", e);
        }
        await loadRoleForFarm(user.id, settings.active_fazenda_id);
      }

      if (!settings?.active_fazenda_id && localFarmId) {
        if (import.meta.env.DEV) {
          console.debug(
            "[useAuth] Persisting local farm to remote:",
            localFarmId,
          );
        }
        await persistActiveFarmToRemote(user.id, localFarmId);
      }

      // Apply theme preference
      if (settings?.theme) {
        applyTheme(settings.theme);
      } else {
        applyTheme("system");
      }
    } catch (e) {
      console.error("[useAuth] Error in refreshSettings:", e);
    }
  }, [loadRoleForFarm, persistActiveFarmToRemote]);

  const setActiveFarm = async (farmId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setActiveFarmId(farmId);

    try {
      localStorage.setItem(`${STORAGE_PREFIX}active_fazenda_id`, farmId);
    } catch (e) {
      console.error("[useAuth] Error saving to localStorage:", e);
    }

    await persistActiveFarmToRemote(user.id, farmId);
    await loadRoleForFarm(user.id, farmId);
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        if (session) {
          await refreshSettings();
        } else {
          applyTheme("system");
        }
      } catch (e) {
        console.error("[useAuth] Error getting session:", e);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        refreshSettings();
      } else {
        setActiveFarmId(null);
        setRole(null);
        try {
          localStorage.removeItem(`${STORAGE_PREFIX}active_fazenda_id`);
        } catch (e) {
          console.error("[useAuth] Error removing from localStorage:", e);
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshSettings]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setActiveFarmId(null);
      setRole(null);
      try {
        localStorage.removeItem(`${STORAGE_PREFIX}active_fazenda_id`);
      } catch (e) {
        console.error("[useAuth] Error removing from localStorage:", e);
      }
    } catch (e) {
      console.error("[useAuth] Error signing out:", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        activeFarmId,
        role,
        setActiveFarm,
        loadRoleForFarm,
        refreshSettings,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
