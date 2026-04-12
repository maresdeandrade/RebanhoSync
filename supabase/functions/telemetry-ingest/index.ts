import { createClient } from '@supabase/supabase-js'

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  Deno.env.get('APP_ORIGIN') || '',
]

function getCorsHeaders(origin: string | null) {
  let allowOrigin = allowedOrigins[0]
  if (origin) {
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      allowOrigin = origin
    }
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.slice('Bearer '.length).trim();

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar cliente anon apenas para validar o user (evitar Bypass) e depois criar cliente em contexto do user.
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente instanciado com o JWT do usuário. O RLS se encarregará do resto (has_membership).
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: `Bearer ${jwt}` },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { events } = await req.json();

    if (!Array.isArray(events) || events.length === 0) {
       return new Response(
          JSON.stringify({ success: true, inserted: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
       );
    }

    if (events.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Batch de telemetria excede o limite de 100 eventos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limpar o array para garantir que tem o que queremos
    const eventsToInsert = events.map(e => ({
       id: e.id,
       fazenda_id: e.fazenda_id,
       event_name: e.event_name,
       status: e.status ?? 'info',
       route: e.route,
       entity: e.entity,
       quantity: e.quantity,
       reason_code: e.reason_code,
       payload: e.payload ?? {},
       created_at: e.created_at ?? new Date().toISOString()
    }));

    // Inserir. Se houver falha de RLS (tenant mismatch), a query retornará erro ou ignorará os registros bloqueados.
    const { error: insertError, data } = await supabase
       .from('metrics_events')
       .upsert(eventsToInsert, { onConflict: 'id', ignoreDuplicates: true })
       .select('id');

    if (insertError) {
       console.error('[telemetry-ingest] Insert error:', insertError);
       return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
    }

    return new Response(JSON.stringify({ success: true, inserted: data?.length || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error('[telemetry-ingest] Fatal error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
