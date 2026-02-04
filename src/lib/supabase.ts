import { createClient } from '@supabase/supabase-js';
import { env, validateEnv } from './env';

// Validar envs no momento da importação para falha rápida
validateEnv();

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);