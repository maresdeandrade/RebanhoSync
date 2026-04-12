import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Session, User } from "@supabase/supabase-js";
import { z } from "zod";
import { getActiveFarmId, setActiveFarmId as storeActiveFarmId, removeActiveFarmId } from "../lib/storage";
import { applyTheme } from "../lib/theme";
import {
  DEFAULT_FARM_EXPERIENCE_MODE,
  type FarmExperienceMode,
  resolveFarmExperienceMode,
} from "@/lib/farms/experienceMode";
import {
  DEFAULT_FARM_LIFECYCLE_CONFIG,
  type FarmLifecycleConfig,
  resolveFarmLifecycleConfig,
} from "@/lib/farms/lifecycleConfig";
import {
  DEFAULT_FARM_MEASUREMENT_CONFIG,
  type FarmMeasurementConfig,
  resolveFarmMeasurementConfig,
} from "@/lib/farms/measurementConfig";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  resolveNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications/sanitaryReminders";


// Role schema for runtime validation
const RoleSchema = z.enum(["cowboy", "manager", "owner"]);
type UserRole = z.infer<typeof RoleSchema>;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  activeFarmId: string | null;
  role: UserRole | null;
  farmExperienceMode: FarmExperienceMode;
  farmLifecycleConfig: FarmLifecycleConfig;
  farmMeasurementConfig: FarmMeasurementConfig;
  notificationPreferences: NotificationPreferences;
  loadRoleForFarm: (userId: string, farmId: string) => Promise<void>;
  setActiveFarm: (farmId: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchMembershipRole(userId: string, farmId: string) {
  const { data: membership, error } = await supabase
    .from("user_fazendas")
    .select("role")
    .eq("user_id", userId)
    .eq("fazenda_id", farmId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.warn("[useAuth] Error fetching role:", error);
    return null;
  }

  const roleResult = RoleSchema.safeParse(membership?.role);
  if (!roleResult.success) {
    console.warn("[useAuth] Invalid role from database:", membership?.role);
    return null;
  }

  return roleResult.data;
}

async function fetchFirstAccessibleFarmId(userId: string) {
  const { data, error } = await supabase
    .from("user_fazendas")
    .select("fazenda_id, role")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(20);

  if (error) {
    console.warn("[useAuth] Error fetching memberships:", error);
    return null;
  }

  const membership = (data ?? []).find((item) =>
    RoleSchema.safeParse(item.role).success,
  );

  return membership?.fazenda_id ?? null;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(() => {
    return getActiveFarmId();
  });
  const [role, setRole] = useState<UserRole | null>(null);
  const [farmExperienceMode, setFarmExperienceMode] = useState<FarmExperienceMode>(
    DEFAULT_FARM_EXPERIENCE_MODE,
  );
  const [farmLifecycleConfig, setFarmLifecycleConfig] =
    useState<FarmLifecycleConfig>(DEFAULT_FARM_LIFECYCLE_CONFIG);
  const [farmMeasurementConfig, setFarmMeasurementConfig] =
    useState<FarmMeasurementConfig>(DEFAULT_FARM_MEASUREMENT_CONFIG);
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);

  const loadRoleForFarm = useCallback(async (userId: string, farmId: string) => {
    const nextRole = await fetchMembershipRole(userId, farmId);
    setRole(nextRole);
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

  const loadFarmExperienceForFarm = useCallback(async (farmId: string) => {
    const { data, error } = await supabase
      .from("fazendas")
      .select("metadata")
      .eq("id", farmId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.warn("[useAuth] Error fetching farm metadata:", error);
      setFarmExperienceMode(DEFAULT_FARM_EXPERIENCE_MODE);
      setFarmLifecycleConfig(DEFAULT_FARM_LIFECYCLE_CONFIG);
      setFarmMeasurementConfig(DEFAULT_FARM_MEASUREMENT_CONFIG);
      return;
    }

    const metadata =
      data?.metadata && typeof data.metadata === "object"
        ? (data.metadata as Record<string, unknown>)
        : null;

    setFarmExperienceMode(resolveFarmExperienceMode(metadata));
    setFarmLifecycleConfig(resolveFarmLifecycleConfig(metadata));
    setFarmMeasurementConfig(resolveFarmMeasurementConfig(metadata));
  }, []);

  const loadFarmContext = useCallback(
    async (userId: string, farmId: string) => {
      await Promise.all([
        loadRoleForFarm(userId, farmId),
        loadFarmExperienceForFarm(farmId),
      ]);
    },
    [loadFarmExperienceForFarm, loadRoleForFarm],
  );

  const refreshSettings = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setFarmExperienceMode(DEFAULT_FARM_EXPERIENCE_MODE);
        setFarmLifecycleConfig(DEFAULT_FARM_LIFECYCLE_CONFIG);
        setFarmMeasurementConfig(DEFAULT_FARM_MEASUREMENT_CONFIG);
        setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
        return;
      }

      const localFarmId = getActiveFarmId();

      const { data: settings, error } = await supabase
        .from("user_settings")
        .select("active_fazenda_id, theme, notifications")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.warn("[useAuth] Error fetching user_settings:", error);
        return;
      }

      setNotificationPreferences(
        resolveNotificationPreferences(settings?.notifications ?? null),
      );

      const resolvedFarmId = settings?.active_fazenda_id ?? localFarmId ?? null;
      let persistLocalFarmId: string | null = null;

      if (resolvedFarmId) {
        const nextRole = await fetchMembershipRole(user.id, resolvedFarmId);

        if (nextRole) {
          if (resolvedFarmId !== localFarmId) {
            if (import.meta.env.DEV) {
              console.debug("[useAuth] Syncing farm from remote:", resolvedFarmId);
            }
            storeActiveFarmId(resolvedFarmId);
          }

          setActiveFarmId(resolvedFarmId);
          setRole(nextRole);
          await loadFarmExperienceForFarm(resolvedFarmId);
          if (!settings?.active_fazenda_id && localFarmId === resolvedFarmId) {
            persistLocalFarmId = localFarmId;
          }
        } else {
          const fallbackFarmId = await fetchFirstAccessibleFarmId(user.id);

          if (fallbackFarmId) {
            storeActiveFarmId(fallbackFarmId);
            setActiveFarmId(fallbackFarmId);
            await persistActiveFarmToRemote(user.id, fallbackFarmId);
            await loadFarmContext(user.id, fallbackFarmId);
          } else {
            removeActiveFarmId();
            setActiveFarmId(null);
            setRole(null);
            setFarmExperienceMode(DEFAULT_FARM_EXPERIENCE_MODE);
            setFarmLifecycleConfig(DEFAULT_FARM_LIFECYCLE_CONFIG);
            setFarmMeasurementConfig(DEFAULT_FARM_MEASUREMENT_CONFIG);
            setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
          }
        }
      } else {
        setActiveFarmId(null);
        setRole(null);
        setFarmExperienceMode(DEFAULT_FARM_EXPERIENCE_MODE);
        setFarmLifecycleConfig(DEFAULT_FARM_LIFECYCLE_CONFIG);
        setFarmMeasurementConfig(DEFAULT_FARM_MEASUREMENT_CONFIG);
        setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      }

      if (persistLocalFarmId) {
        if (import.meta.env.DEV) {
          console.debug(
            "[useAuth] Persisting local farm to remote:",
            persistLocalFarmId,
          );
        }
        await persistActiveFarmToRemote(user.id, persistLocalFarmId);
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
  }, [loadFarmContext, loadFarmExperienceForFarm, persistActiveFarmToRemote]);

  const setActiveFarm = async (farmId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setActiveFarmId(farmId);
    storeActiveFarmId(farmId);

    await Promise.all([
      persistActiveFarmToRemote(user.id, farmId),
      loadFarmContext(user.id, farmId),
    ]);
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
        setFarmExperienceMode(DEFAULT_FARM_EXPERIENCE_MODE);
        setFarmLifecycleConfig(DEFAULT_FARM_LIFECYCLE_CONFIG);
        setFarmMeasurementConfig(DEFAULT_FARM_MEASUREMENT_CONFIG);
        setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
        removeActiveFarmId();
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
      setFarmExperienceMode(DEFAULT_FARM_EXPERIENCE_MODE);
      setFarmLifecycleConfig(DEFAULT_FARM_LIFECYCLE_CONFIG);
      setFarmMeasurementConfig(DEFAULT_FARM_MEASUREMENT_CONFIG);
      setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      removeActiveFarmId();
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
        farmExperienceMode,
        farmLifecycleConfig,
        farmMeasurementConfig,
        notificationPreferences,
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
