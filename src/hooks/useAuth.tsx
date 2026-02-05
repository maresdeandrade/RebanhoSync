import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { z } from 'zod';

// Role schema for runtime validation
const RoleSchema = z.enum(['cowboy', 'manager', 'owner']);
type UserRole = z.infer<typeof RoleSchema>;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  activeFarmId: string | null;
  role: UserRole | null;
  refreshSettings: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// localStorage namespace to prevent collision
const STORAGE_PREFIX = 'gestao_agro_';

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

      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('active_fazenda_id')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('[useAuth] Error fetching user settings:', error);
        return;
      }

      if (settings?.active_fazenda_id) {
        setActiveFarmId(settings.active_fazenda_id);
        try {
          localStorage.setItem(`${STORAGE_PREFIX}active_fazenda_id`, settings.active_fazenda_id);
        } catch (e) {
          console.error('[useAuth] Error saving to localStorage:', e);
        }

        const { data: membership, error: membershipError } = await supabase
          .from('user_fazendas')
          .select('role')
          .eq('user_id', user.id)
          .eq('fazenda_id', settings.active_fazenda_id)
          .is('deleted_at', null)
          .single();

        if (membershipError) {
          console.error('[useAuth] Error fetching membership:', membershipError);
          setRole(null);
          return;
        }

        // Validate role with Zod schema
        const roleResult = RoleSchema.safeParse(membership?.role);
        setRole(roleResult.success ? roleResult.data : null);
        
        if (!roleResult.success) {
          console.error('[useAuth] Invalid role from database:', membership?.role);
        }
      }
    } catch (e) {
      console.error('[useAuth] Error in refreshSettings:', e);
    }
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