import { createClient } from '@supabase/supabase-js'
import {
  type Operation,
  buildMutationMatch,
  normalizeDbError,
  prevalidateAntiTeleport,
} from './rules.ts'
import { resolveEventFeatureFlags } from './flags.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
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

    const { client_id, fazenda_id, client_tx_id, ops: rawOps } = await req.json();
    const ops: Operation[] = Array.isArray(rawOps) ? rawOps : [];
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

    const { data: fazendaConfig, error: fazendaConfigError } = await supabase
      .from('fazendas')
      .select('metadata')
      .eq('id', fazenda_id)
      .maybeSingle();

    if (fazendaConfigError) {
      console.warn(
        `[sync-batch] Could not load fazenda.metadata for ${fazenda_id}. Falling back to strict defaults.`,
        fazendaConfigError.message,
      );
    }

    const featureFlags = resolveEventFeatureFlags(fazendaConfig?.metadata);
    console.log(
      `[sync-batch] Feature flags strict_rules_enabled=${featureFlags.strictRulesEnabled} strict_anti_teleporte=${featureFlags.strictAntiTeleport}`,
    );

    if (featureFlags.strictAntiTeleport) {
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
    } else {
      console.warn(
        `[sync-batch] strict_anti_teleporte disabled for farm ${fazenda_id} - skipping anti-teleport prevalidation`,
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
            reason_code: 'SECURITY_BLOCKED_TABLE',
            reason_message: `Table ${op.table} cannot be modified via sync`
          });
          continue;
        }

        // P0: Force tenant consistency (server is authoritative)
        const record = { ...op.record };
        if (TABLES_WITH_FAZENDA.has(op.table)) {
          record.fazenda_id = fazenda_id; // Always use request fazenda_id
        }
        
        // P1: Validate Reproduction Events
        if (op.table === 'eventos_reproducao' && op.action === 'INSERT') {
          if ((record.tipo === 'cobertura' || record.tipo === 'IA') && !record.macho_id) {
            results.push({
              op_id: op.client_op_id,
              status: 'REJECTED',
              reason_code: 'VALIDATION_ERROR',
              reason_message: 'Macho_id is required for Cobertura/IA'
            });
            continue;
          }
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
          const match = buildMutationMatch(op, fazenda_id);
          if (!match) {
            results.push({
              op_id: op.client_op_id,
              status: 'REJECTED',
              reason_code: 'VALIDATION_MISSING_PRIMARY_KEY',
              reason_message: `Operation UPDATE on ${op.table} missing id/evento_id/user_id`,
            });
            continue;
          }
          query = supabase.from(op.table)
            .update(record)
            .match(match)
            .select(); // Request representation to avoid PGRST204
        } else if (op.action === 'DELETE') {
          const match = buildMutationMatch(op, fazenda_id);
          if (!match) {
            results.push({
              op_id: op.client_op_id,
              status: 'REJECTED',
              reason_code: 'VALIDATION_MISSING_PRIMARY_KEY',
              reason_message: `Operation DELETE on ${op.table} missing id/evento_id/user_id`,
            });
            continue;
          }
          query = supabase.from(op.table)
            .update({ deleted_at: new Date().toISOString() })
            .match(match)
            .select(); // Request representation to avoid PGRST204
        }

        const { error } = await query!;

        if (error) {
          const normalized = normalizeDbError(error, op);
          if (normalized.status === 'APPLIED_ALTERED') {
            results.push({
              op_id: op.client_op_id,
              status: 'APPLIED_ALTERED',
              altered: normalized.altered,
            });
          } else if (normalized.status === 'APPLIED') {
            results.push({ op_id: op.client_op_id, status: 'APPLIED' });
          } else {
            results.push({
              op_id: op.client_op_id,
              status: 'REJECTED',
              reason_code: normalized.reason_code,
              reason_message: normalized.reason_message,
            });
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
