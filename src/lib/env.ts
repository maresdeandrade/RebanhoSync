export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  supabaseFunctionsUrl: import.meta.env.VITE_SUPABASE_FUNCTIONS_URL,
};

const requiredEnvVars = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_FUNCTIONS_URL",
] as const;

export function validateEnv() {
  for (const key of requiredEnvVars) {
    if (!import.meta.env[key]) {
      throw new Error(
        `Missing environment variable: ${key}. Please check your .env file.`,
      );
    }
  }
}
