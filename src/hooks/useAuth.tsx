import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { z } from 'zod';
import { STORAGE_PREFIX } from './auth-constants';

// Role schema for runtime validation
const RoleSchema = z.enum(['cowboy', 'manager', 'owner']);
type UserRole = z.infer<typeof RoleSchema>;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  activeFarmId: string | null;
  role: UserRole | null;
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


  const refreshSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // ✅ POLÍTICA DE LEITURA (fonte única, offline-first)
      // 1. Lê localStorage imediatamente (cache local, funciona offline)
      const localFarmId = localStorage.getItem(`${STORAGE_PREFIX}active_fazenda_id`);
      
      // 2. Se tem localStorage, usa imediatamente (UX instantâneo)
      if (localFarmId) {
        setActiveFarmId(localFarmId);
        // Carrega role para esse farm
        await loadRoleForFarm(user.id, localFarmId);
      }

      // 3. Tenta buscar user_settings (quando online) para sincronizar
      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('active_fazenda_id')
        .eq('user_id', user.id)
        .maybeSingle(); // ✅ Defensivo: não quebra se não existir

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.warn('[useAuth] Error fetching user_settings:', error);
        // Continua com localStorage (já setado acima)
        return;
      }

      // 4. Se remoto difere de local, atualiza local (consistência multi-device)
      if (settings?.active_fazenda_id && settings.active_fazenda_id !== localFarmId) {
        console.log('[useAuth] Syncing farm from remote:', settings.active_fazenda_id);
        setActiveFarmId(settings.active_fazenda_id);
        try {
          localStorage.setItem(`${STORAGE_PREFIX}active_fazenda_id`, settings.active_fazenda_id);
        } catch (e) {
          console.error('[useAuth] Error updating localStorage:', e);
        }
        await loadRoleForFarm(user.id, settings.active_fazenda_id);
      }

      // 5. Se remoto não existe mas local existe, persiste local → remoto
      if (!settings?.active_fazenda_id && localFarmId) {
        console.log('[useAuth] Persisting local farm to remote:', localFarmId);
        await persistActiveFarmToRemote(user.id, localFarmId);
      }
    } catch (e) {
      console.error('[useAuth] Error in refreshSettings:', e);
    }
  };

  // Helper: Carrega role para um fazenda_id específico
  const loadRoleForFarm = async (userId: string, farmId: string) => {
    const { data: membership, error } = await supabase
      .from('user_fazendas')
      .select('role')
      .eq('user_id', userId)
      .eq('fazenda_id', farmId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.warn('[useAuth] Error fetching role:', error);
      setRole(null);
      return;
    }

    const roleResult = RoleSchema.safeParse(membership?.role);
    setRole(roleResult.success ? roleResult.data : null);
    
    if (!roleResult.success) {
      console.warn('[useAuth] Invalid role from database:', membership?.role);
    }
  };

  // Helper: Persiste fazenda ativa no user_settings (quando online)
  const persistActiveFarmToRemote = async (userId: string, farmId: string) => {
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        active_fazenda_id: farmId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.warn('[useAuth] Failed to persist farm to remote:', error);
      // Não é crítico - localStorage já tem
    }
  };

  // ✅ POLÍTICA DE ESCRITA (exposta para SelectFazenda)
  const setActiveFarm = async (farmId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Atualiza estado local imediatamente
    setActiveFarmId(farmId);
    
    // 2. Salva em localStorage (sempre, offline-first)
    try {
      localStorage.setItem(`${STORAGE_PREFIX}active_fazenda_id`, farmId);
    } catch (e) {
      console.error('[useAuth] Error saving to localStorage:', e);
    }

    // 3. Tenta persistir remoto (quando online)
    await persistActiveFarmToRemote(user.id, farmId);

    // 4. Carrega role para esse farm
    await loadRoleForFarm(user.id, farmId);
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session) {
          await refreshSettings();
        }
      } catch (e) {
        console.error('[useAuth] Error getting session:', e);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        refreshSettings();
      } else {
        setActiveFarmId(null);
        setRole(null);
        try {
          localStorage.removeItem(`${STORAGE_PREFIX}active_fazenda_id`);
        } catch (e) {
          console.error('[useAuth] Error removing from localStorage:', e);
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setActiveFarmId(null);
      setRole(null);
      try {
        localStorage.removeItem(`${STORAGE_PREFIX}active_fazenda_id`);
      } catch (e) {
        console.error('[useAuth] Error removing from localStorage:', e);
      }
    } catch (e) {
      console.error('[useAuth] Error signing out:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user: session?.user ?? null, 
      loading, 
      activeFarmId, 
      role,
      setActiveFarm,
      refreshSettings, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};