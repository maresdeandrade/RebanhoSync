import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

/**
 * sanitario-reconcile (F7)
 *
 * Periodic Edge Function that reconciles sanitary agenda for all eligible farms.
 * Intended to run as a daily cron job.
 *
 * For each fazenda with active animals and pending sanitary agenda:
 * - Skip if last reconcile was within 24h (via fazenda_sanidade_config.payload.last_reconcile_at)
 * - Call internal_sanitario_recompute_agenda_for_fazenda(fazenda_id)
 * - Update last_reconcile_at timestamp
 *
 * Schedule: daily via pg_cron or external scheduler
 *   select cron.schedule('sanitario-reconcile-daily', '0 3 * * *',
 *     $$ select net.http_post(url := '<FUNCTION_URL>', ...) $$);
 */

const RECONCILE_COOLDOWN_HOURS = 24

type ReconcileClient = ReturnType<typeof createClient>
type ReconcileResult = {
  fazenda_id: string
  inserted: number | null
  error: string | null
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getVerifiedJwtRole(authHeader: string | null): string | null {
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return null

  try {
    const payloadSegment = token.split('.')[1]
    if (!payloadSegment) return null

    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as { role?: unknown }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

async function reconcileFarm(
  supabase: ReconcileClient,
  farm: { fazenda_id: string },
): Promise<ReconcileResult> {
  try {
    const { data: inserted, error: recomputeError } = await supabase.rpc(
      'internal_sanitario_recompute_agenda_for_fazenda',
      { _fazenda_id: farm.fazenda_id },
    )

    if (recomputeError) {
      return {
        fazenda_id: farm.fazenda_id,
        inserted: null,
        error: recomputeError.message,
      }
    }

    await supabase
      .from('fazenda_sanidade_config')
      .update({
        payload: supabase.rpc('jsonb_set_last_reconcile', {
          _fazenda_id: farm.fazenda_id,
          _ts: new Date().toISOString(),
        }),
      })
      .eq('fazenda_id', farm.fazenda_id)

    await supabase.rpc('sanitario_reconcile_touch', {
      _fazenda_id: farm.fazenda_id,
    })

    return {
      fazenda_id: farm.fazenda_id,
      inserted: inserted as number | null,
      error: null,
    }
  } catch (err) {
    return {
      fazenda_id: farm.fazenda_id,
      inserted: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function reconcileEligibleFarms(
  supabase: ReconcileClient,
): Promise<Response> {
  const cutoff = new Date(
    Date.now() - RECONCILE_COOLDOWN_HOURS * 60 * 60 * 1000,
  ).toISOString()

  // Find fazendas with active animals and pending sanitary agenda
  // that haven't been reconciled in the last 24h
  const { data: eligibleFarms, error: queryError } = await supabase.rpc(
    'sanitario_reconcile_eligible_fazendas',
    { _cooldown_cutoff: cutoff },
  )

  if (queryError) {
    console.error('Failed to query eligible farms:', queryError.message)
    return jsonResponse({ error: 'Query failed', detail: queryError.message }, 500)
  }

  const farms: Array<{ fazenda_id: string }> = eligibleFarms ?? []
  const results: ReconcileResult[] = []
  for (const farm of farms) {
    results.push(await reconcileFarm(supabase, farm))
  }

  const reconciled = results.filter((r) => r.error === null).length
  const failed = results.filter((r) => r.error !== null).length

  console.log(
    `sanitario-reconcile: ${reconciled} reconciled, ${failed} failed out of ${farms.length} eligible`,
  )

  return jsonResponse({ reconciled, failed, total: farms.length, results }, 200)
}

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase configuration' }, 500)
  }

  // The platform verifies this JWT before invoking the handler. Authorize the
  // verified role claim because the gateway may replace the original token.
  if (getVerifiedJwtRole(authHeader) !== 'service_role') {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  return reconcileEligibleFarms(supabase)
})
