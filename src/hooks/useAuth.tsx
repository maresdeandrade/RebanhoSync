import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
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
import { checkIsSuperAdmin } from "@/lib/admin/adminApi";
import {
  establishLocalOwnership,
  getLocalOwnership,
  type LocalOwnershipDecision,
} from "@/lib/offline/ownership";
import { forgetOfflineFarms, isConnectivityFailure, recoverOfflineFarm, rememberVerifiedFarm } from "@/lib/offline/farmAccess";


// Role schema for runtime validation
const RoleSchema = z.enum(["cowboy", "manager", "owner"]);
type UserRole = z.infer<typeof RoleSchema>;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  localOwnership: LocalOwnershipDecision | null;
  loading: boolean;
  isSuperAdmin: boolean | null;
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

function farmMetadata(data: { metadata?: unknown } | null) {
  return data?.metadata && typeof data.metadata === "object"
    ? data.metadata as Record<string, unknown> : null;
}

async function recoverFarmMetadata(error: unknown, identity: string | null, farmId: string) {
  if (!isConnectivityFailure(error) || !identity) return null;
  return (await recoverOfflineFarm(identity, farmId))?.metadata ?? null;
}

async function rememberFarmMetadata(identity: string | null, farmId: string, metadata: Record<string, unknown> | null, isCurrent: () => boolean) {
  if (!identity) return;
  const access = (await getLocalOwnership())?.verified_farms?.[farmId];
  if (isCurrent() && access?.role) {
    await rememberVerifiedFarm(identity, farmId, access.role, metadata, isCurrent);
  }
}

async function fetchMembershipRole(userId: string, farmId: string, isCurrent: () => boolean) {
  const { data: membership, error } = await supabase
    .from("user_fazendas")
    .select("role")
    .eq("user_id", userId)
    .eq("fazenda_id", farmId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!isCurrent()) return null;

  if (error) {
    console.warn("[useAuth] Error fetching role:", error);
    if (isConnectivityFailure(error)) return (await recoverOfflineFarm(userId, farmId))?.role ?? null;
    await rememberVerifiedFarm(userId, farmId, null, undefined, isCurrent);
    return null;
  }

  const roleResult = RoleSchema.safeParse(membership?.role);
  if (!roleResult.success) {
    console.warn("[useAuth] Invalid role from database:", membership?.role);
    await rememberVerifiedFarm(userId, farmId, null, undefined, isCurrent);
    return null;
  }

  await rememberVerifiedFarm(userId, farmId, roleResult.data, undefined, isCurrent);
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
  // Invalidate in-flight settings/role/metadata reads on an explicit farm or session change.
  const farmContextRevision = useRef(0);
  const pendingFarmSelection = useRef<number | null>(null);
  const currentIdentity = useRef<string | null>(null);
  const [changingFarm, setChangingFarm] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [localOwnership, setLocalOwnership] =
    useState<LocalOwnershipDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
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
    const request = farmContextRevision.current;
    const nextRole = await fetchMembershipRole(userId, farmId, () => request === farmContextRevision.current);
    if (request !== farmContextRevision.current) return;
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
    const request = farmContextRevision.current;
    const { data, error } = await supabase
      .from("fazendas")
      .select("metadata")
      .eq("id", farmId)
      .is("deleted_at", null)
      .maybeSingle();

    if (request !== farmContextRevision.current) return;
    if (error) {
      console.warn("[useAuth] Error fetching farm metadata:", error);
      const metadata = await recoverFarmMetadata(error, currentIdentity.current, farmId);
      if (request !== farmContextRevision.current) return;
      setFarmExperienceMode(resolveFarmExperienceMode(metadata));
      setFarmLifecycleConfig(resolveFarmLifecycleConfig(metadata));
      setFarmMeasurementConfig(resolveFarmMeasurementConfig(metadata));
      return;
    }

    const metadata = farmMetadata(data);

    setFarmExperienceMode(resolveFarmExperienceMode(metadata));
    setFarmLifecycleConfig(resolveFarmLifecycleConfig(metadata));
    setFarmMeasurementConfig(resolveFarmMeasurementConfig(metadata));
    // Metadata belongs to the same verified membership, never another farm.
    await rememberFarmMetadata(currentIdentity.current, farmId, metadata, () => request === farmContextRevision.current);
  }, []);

  const loadFarmContext = useCallback(
    async (userId: string, farmId: string) => {
      const request = farmContextRevision.current;
      await loadRoleForFarm(userId, farmId);
      if (request !== farmContextRevision.current) return;
      await loadFarmExperienceForFarm(farmId);
    },
    [loadFarmExperienceForFarm, loadRoleForFarm],
  );

  const refreshSettings = useCallback(async () => {
    // An explicit selection owns the context until its role/settings settle.
    if (pendingFarmSelection.current !== null) return;
    const request = farmContextRevision.current;
    const isCurrent = () => request === farmContextRevision.current;
    const restoreOfflineContext = async () => {
      const identity = currentIdentity.current;
      const farmId = getActiveFarmId();
      const access = identity && farmId ? await recoverOfflineFarm(identity, farmId) : null;
      if (!isCurrent()) return;
      setRole(access?.role ?? null);
      setIsSuperAdmin(false);
      const metadata = access?.metadata ?? null;
      setFarmExperienceMode(resolveFarmExperienceMode(metadata));
      setFarmLifecycleConfig(resolveFarmLifecycleConfig(metadata));
      setFarmMeasurementConfig(resolveFarmMeasurementConfig(metadata));
    };
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (!isCurrent()) return;
      if (isConnectivityFailure(userError) && currentIdentity.current) {
        await restoreOfflineContext();
        return;
      }
      if (!user) {
        setRole(null);
        if (currentIdentity.current) await forgetOfflineFarms(currentIdentity.current);
        setIsSuperAdmin(false);
        setFarmExperienceMode(DEFAULT_FARM_EXPERIENCE_MODE);
        setFarmLifecycleConfig(DEFAULT_FARM_LIFECYCLE_CONFIG);
        setFarmMeasurementConfig(DEFAULT_FARM_MEASUREMENT_CONFIG);
        setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
        return;
      }

      // Avaliar SuperAdmin de forma defensiva e assíncrona
      const adminStatus = await checkIsSuperAdmin(supabase);
      if (!isCurrent()) return;
      setIsSuperAdmin(adminStatus);

      const localFarmId = getActiveFarmId();

      const { data: settings, error } = await supabase
        .from("user_settings")
        .select("active_fazenda_id, theme, notifications")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isCurrent()) return;
      if (error && error.code !== "PGRST116") {
        console.warn("[useAuth] Error fetching user_settings:", error);
        if (isConnectivityFailure(error)) await restoreOfflineContext();
        return;
      }

      setNotificationPreferences(
        resolveNotificationPreferences(settings?.notifications ?? null),
      );

      const resolvedFarmId = settings?.active_fazenda_id ?? localFarmId ?? null;
      let persistLocalFarmId: string | null = null;

      if (resolvedFarmId) {
        const nextRole = await fetchMembershipRole(user.id, resolvedFarmId, isCurrent);
        if (!isCurrent()) return;

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
          if (!isCurrent()) return;
          if (!settings?.active_fazenda_id && localFarmId === resolvedFarmId) {
            persistLocalFarmId = localFarmId;
          }
        } else {
          const fallbackFarmId = await fetchFirstAccessibleFarmId(user.id);
          if (!isCurrent()) return;

          if (fallbackFarmId) {
            storeActiveFarmId(fallbackFarmId);
            setActiveFarmId(fallbackFarmId);
            await persistActiveFarmToRemote(user.id, fallbackFarmId);
            if (!isCurrent()) return;
            await loadFarmContext(user.id, fallbackFarmId);
            if (!isCurrent()) return;
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
        if (!isCurrent()) return;
      }

      // Apply theme preference
      if (settings?.theme) {
        applyTheme(settings.theme);
      } else {
        applyTheme("system");
      }
    } catch (e) {
      console.error("[useAuth] Error in refreshSettings:", e);
      if (isConnectivityFailure(e)) await restoreOfflineContext();
    }
  }, [loadFarmContext, loadFarmExperienceForFarm, persistActiveFarmToRemote]);

  const setActiveFarm = async (farmId: string) => {
    const request = ++farmContextRevision.current;
    pendingFarmSelection.current = request;
    setChangingFarm(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || request !== farmContextRevision.current) return;
      // Also supersede refreshes begun while getUser was resolving this selection.
      ++farmContextRevision.current;

      setRole(null);
      setActiveFarmId(farmId);
      storeActiveFarmId(farmId);

      await Promise.all([
        persistActiveFarmToRemote(user.id, farmId),
        loadFarmContext(user.id, farmId),
      ]);
    } finally {
      if (pendingFarmSelection.current === request) {
        pendingFarmSelection.current = null;
        setChangingFarm(false);
      }
    }
  };

  const applyAuthenticatedSession = useCallback(
    async (nextSession: Session) => {
      const request = farmContextRevision.current;
      const ownership = await establishLocalOwnership(nextSession);
      if (request !== farmContextRevision.current) return;
      setLocalOwnership(ownership);
      if (ownership.status !== "OWNED") {
        ++farmContextRevision.current;
        pendingFarmSelection.current = null;
        setChangingFarm(false);
        currentIdentity.current = null;
        setRole(null);
        setActiveFarmId(null);
        setSession(null);
        return;
      }

      currentIdentity.current = nextSession.user.id;
      setSession(nextSession);
      await refreshSettings();
    },
    [refreshSettings],
  );

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          await applyAuthenticatedSession(session);
        } else {
          setSession(null);
          setLocalOwnership(null);
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
      if (session) {
        void applyAuthenticatedSession(session).finally(() => setLoading(false));
        return;
      } else {
        const previousIdentity = currentIdentity.current;
        currentIdentity.current = null;
        if (previousIdentity) void forgetOfflineFarms(previousIdentity);
        ++farmContextRevision.current;
        pendingFarmSelection.current = null;
        setChangingFarm(false);
        setSession(null);
        setLocalOwnership(null);
        setActiveFarmId(null);
        setRole(null);
        setIsSuperAdmin(false);
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
  }, [applyAuthenticatedSession]);

  const signOut = async () => {
    const previousIdentity = currentIdentity.current;
    currentIdentity.current = null;
    ++farmContextRevision.current;
    pendingFarmSelection.current = null;
    setChangingFarm(false);
    setSession(null);
    setRole(null);
    setActiveFarmId(null);
    removeActiveFarmId();
    if (previousIdentity) await forgetOfflineFarms(previousIdentity);
    try {
      await supabase.auth.signOut();
      setLocalOwnership(null);
      setActiveFarmId(null);
      setRole(null);
      setIsSuperAdmin(false);
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
        localOwnership,
        loading: loading || changingFarm,
        isSuperAdmin,
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
