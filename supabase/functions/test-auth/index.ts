import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ step: 'no_auth_header', ok: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    
    // Tentar criar client com JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: `Bearer ${jwt}` }
        }
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    
    return new Response(JSON.stringify({
      step: 'auth_check',
      ok: !error,
      hasUser: !!user,
      userId: user?.id,
      error: error?.message,
      env: {
        hasUrl: !!Deno.env.get('SUPABASE_URL'),
        hasAnonKey: !!Deno.env.get('SUPABASE_ANON_KEY'),
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    return new Response(JSON.stringify({ step: 'exception', error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  }
})
