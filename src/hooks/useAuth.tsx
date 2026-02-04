import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  activeFarmId: string | null;
  role: 'cowboy' | 'manager' | 'owner' | null;
  refreshSettings: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(localStorage.getItem('active_fazenda_id'));
  const [role, setRole] = useState<'cowboy' | 'manager' | 'owner' | null>(null);

  const refreshSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: settings } = await supabase
      .from('user_settings')
      .select('active_fazenda_id')
      .eq('user_id', user.id)
      .single();

    if (settings?.active_fazenda_id) {
      setActiveFarmId(settings.active_fazenda_id);
      localStorage.setItem('active_fazenda_id', settings.active_fazenda_id);
      
      const { data: membership } = await supabase
        .from('user_fazendas')
        .select('role')
        .eq('user_id', user.id)
        .eq('fazenda_id', settings.active_fazenda_id)
        .is('deleted_at', null)
        .single();
      
      setRole(membership?.role as any || null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) refreshSettings();
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) refreshSettings();
      else {
        setActiveFarmId(null);
        setRole(null);
        localStorage.removeItem('active_fazenda_id');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
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
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};