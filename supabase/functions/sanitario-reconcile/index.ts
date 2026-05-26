import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

/**
 * sanitario-reconcile (F7)
 *
 * Periodic Edge Function that reconciles sanitary agenda for all eligible farms.
 * Intended to run as a daily cron job.
 *
 * For each fazenda with active animals and pending sanitary agenda:
 * - Skip if last reconcile was within 24h (via fazenda_sanidade_config.payload.last_reconcile_at)
 * - Call sanitario_recompute_agenda_for_fazenda(fazenda_id)
 * - Update last_reconcile_at timestamp
 *
 * Schedule: daily via pg_cron or external scheduler
 *   select cron.schedule('sanitario-reconcile-daily', '0 3 * * *',
 *     $$ select net.http_post(url := '<FUNCTION_URL>', ...) $$);
 */

const RECONCILE_COOLDOWN_HOURS = 24

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase configuration' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

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
    return new Response(
      JSON.stringify({ error: 'Query failed', detail: queryError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const farms: Array<{ fazenda_id: string }> = eligibleFarms ?? []
  const results: Array<{ fazenda_id: string; inserted: number | null; error: string | null }> = []

  for (const farm of farms) {
    try {
      const { data: inserted, error: recomputeError } = await supabase.rpc(
        'sanitario_recompute_agenda_for_fazenda',
        { _fazenda_id: farm.fazenda_id },
      )

      if (recomputeError) {
        results.push({
          fazenda_id: farm.fazenda_id,
          inserted: null,
          error: recomputeError.message,
        })
        continue
      }

      // Update last_reconcile_at in fazenda_sanidade_config.payload
      await supabase
        .from('fazenda_sanidade_config')
        .update({
          payload: supabase.rpc('jsonb_set_last_reconcile', {
            _fazenda_id: farm.fazenda_id,
            _ts: new Date().toISOString(),
          }),
        })
        .eq('fazenda_id', farm.fazenda_id)

      // Simpler approach: direct SQL update via RPC
      await supabase.rpc('sanitario_reconcile_touch', {
        _fazenda_id: farm.fazenda_id,
      })

      results.push({
        fazenda_id: farm.fazenda_id,
        inserted: inserted as number | null,
        error: null,
      })
    } catch (err) {
      results.push({
        fazenda_id: farm.fazenda_id,
        inserted: null,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const reconciled = results.filter((r) => r.error === null).length
  const failed = results.filter((r) => r.error !== null).length

  console.log(
    `sanitario-reconcile: ${reconciled} reconciled, ${failed} failed out of ${farms.length} eligible`,
  )

  return new Response(
    JSON.stringify({
      reconciled,
      failed,
      total: farms.length,
      results,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
