import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Operation type for sync batch
interface Operation {
  client_op_id: string;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  record: Record<string, unknown>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[sync-batch] Request received');
    
    // Validate and extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('[sync-batch] Authorization header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[sync-batch] Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.slice('Bearer '.length).trim();
    console.log('[sync-batch] JWT extracted, length:', jwt.length);

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate JWT signature and claims against GoTrue.
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
      console.error('[sync-batch] JWT validation failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user_id = user.id;
    console.log(`[sync-batch] JWT validated for user ${user_id}`);
    
    // Create user-scoped client with JWT (RLS enforced by user context).
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
    
    console.log('[sync-batch] Supabase client created');

    const { client_id, fazenda_id, client_tx_id, ops } = await req.json();
    console.log(`[sync-batch] Processing TX ${client_tx_id} for farm ${fazenda_id}`);

    // P0: Verify user has membership in this fazenda (using user client)
    const { data: membership, error: membershipError } = await supabase
      .from('user_fazendas')
      .select('role')
      .eq('user_id', user_id)
      .eq('fazenda_id', fazenda_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (membershipError || !membership) {
      console.error(`[sync-batch] User ${user_id} has no membership in farm ${fazenda_id}`);
      return new Response(
        JSON.stringify({ error: 'Forbidden - no access to this farm' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-batch] User has role: ${membership.role}`);

    // PRE-VALIDATION: Anti-Teleport (BEFORE applying any ops)
    function prevalidateAntiTeleport(ops: Operation[]) {
      // map animalId -> eventoId do evento base de movimentacao
      const movBaseByAnimal = new Map<string, string>();

      for (const o of ops) {
        if (
          o.table === "eventos" &&
          o.action === "INSERT" &&
          o.record?.dominio === "movimentacao" &&
          o.record?.animal_id &&
          o.record?.id
        ) {
          movBaseByAnimal.set(o.record.animal_id as string, o.record.id as string);
        }
      }

      const movDetalhesEventoIds = new Set<string>();
      for (const o of ops) {
        if (
          o.table === "eventos_movimentacao" &&
          o.action === "INSERT" &&
          o.record?.evento_id
        ) {
          movDetalhesEventoIds.add(o.record.evento_id as string);
        }
      }

      for (const o of ops) {
        if (
          o.table === "animais" &&
          o.action === "UPDATE" &&
          o.record?.id &&
          Object.prototype.hasOwnProperty.call(o.record, "lote_id")
        ) {
          const animalId = o.record.id as string;
          const eventoId = movBaseByAnimal.get(animalId);

          if (!eventoId) {
            return {
              ok: false,
              op_id: o.client_op_id,
              reason_code: "ANTI_TELEPORTE",
              reason_message: "UPDATE animais.lote_id sem evento base de movimentacao no mesmo tx",
            };
          }

          if (!movDetalhesEventoIds.has(eventoId)) {
            return {
              ok: false,
              op_id: o.client_op_id,
              reason_code: "ANTI_TELEPORTE",
              reason_message: "Evento de movimentacao sem detalhe correlato (evento_id mismatch) no mesmo tx",
            };
          }
        }
      }

      return { ok: true };
    }

    const anti = prevalidateAntiTeleport(ops);
    if (!anti.ok) {
      // Abort entire batch (atomicity: reject all ops if anti-teleport fails)
      return new Response(
        JSON.stringify({
          results: ops.map((o: Operation) => ({
            op_id: o.client_op_id,
            status: "REJECTED",
            reason_code: anti.reason_code,
            reason_message: anti.reason_message,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // P0: Ready to process operations (user authenticated + authorized)
    // Define security boundaries
    const BLOCKED_TABLES = new Set([
      'user_fazendas',  // Membership only via security definer RPC
      'user_profiles',  // Self-only via RLS
      'user_settings'   // Self-only via RLS
    ]);

    const TABLES_WITH_FAZENDA = new Set([
      'animais', 'lotes', 'pastos', 'agenda_itens', 'eventos',
      'contrapartes', 'protocolos_sanitarios', 'protocolos_sanitarios_itens',
      'eventos_sanitario', 'eventos_pesagem', 'eventos_nutricao',
      'eventos_movimentacao', 'eventos_reproducao', 'eventos_financeiro'
    ]);

    const results = [];
    
    for (const op of ops) {
      try {
        // P0: Block sensitive tables
        if (BLOCKED_TABLES.has(op.table)) {
          console.warn(`[sync-batch] Blocked table: ${op.table}`);
          results.push({
            op_id: op.client_op_id,
            status: 'REJECTED',
            reason_code: 'BLOCKED_TABLE',
            reason_message: `Table ${op.table} cannot be modified via sync`
          });
          continue;
        }

        // P0: Force tenant consistency (server is authoritative)
        const record = { ...op.record };
        if (TABLES_WITH_FAZENDA.has(op.table)) {
          record.fazenda_id = fazenda_id; // Always use request fazenda_id
        }

        // P0: Execute with user client (RLS enforced)
        let query;
        if (op.action === 'INSERT') {
          query = supabase.from(op.table)
            .insert({ 
              ...record, 
              fazenda_id, 
              client_id, 
              client_op_id: op.client_op_id, 
              client_tx_id 
            })
            .select(); // Request representation to avoid PGRST204
        } else if (op.action === 'UPDATE') {
          query = supabase.from(op.table)
            .update(record)
            .match({ id: op.record.id, fazenda_id })
            .select(); // Request representation to avoid PGRST204
        } else if (op.action === 'DELETE') {
          query = supabase.from(op.table)
            .update({ deleted_at: new Date().toISOString() })
            .match({ id: op.record.id, fazenda_id })
            .select(); // Request representation to avoid PGRST204
        }

        const { error, data } = await query!;

        if (error) {
          // Tratamento de Dedup Agenda (Unique Constraint)
          if (error.code === '23505' && op.table === 'agenda_itens') {
            results.push({ op_id: op.client_op_id, status: 'APPLIED_ALTERED', altered: { dedup: 'collision_noop' } });
          } else if (error.code === '23505') {
            // Idempotencia: se ja existe o client_op_id, consideramos aplicado
            results.push({ op_id: op.client_op_id, status: 'APPLIED' });
          } else {
            results.push({ op_id: op.client_op_id, status: 'REJECTED', reason_code: error.code, reason_message: error.message });
          }
        } else {
          results.push({ op_id: op.client_op_id, status: 'APPLIED' });
        }
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        results.push({ op_id: op.client_op_id, status: 'REJECTED', reason_code: 'INTERNAL_ERROR', reason_message: error.message });
      }
    }

    return new Response(JSON.stringify({ server_tx_id: `srv-${client_tx_id.slice(0,8)}`, client_tx_id, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error('[sync-batch] Fatal error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
