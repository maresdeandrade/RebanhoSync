import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { client_id, fazenda_id, client_tx_id, ops } = await req.json()
    const results = []

    // Inicia transação via RPC customizado ou sequência de comandos
    // Nota: No Supabase, transações complexas são melhor feitas via PL/pgSQL.
    // Aqui simulamos a lógica de validação.

    for (const op of ops) {
      try {
        // 1. Idempotência
        const { data: existing } = await supabase
          .from(op.table)
          .select('id')
          .eq('fazenda_id', fazenda_id)
          .eq('client_op_id', op.op_id)
          .maybeSingle()

        if (existing) {
          results.push({ op_id: op.op_id, status: 'APPLIED' })
          continue
        }

        // 2. Anti-teleporte (Exemplo simplificado)
        if (op.table === 'animais' && op.action === 'UPDATE' && op.record.lote_id) {
          const hasMovement = ops.find(o => o.table === 'eventos' && o.record.dominio === 'movimentacao')
          if (!hasMovement) {
            results.push({ 
              op_id: op.op_id, 
              status: 'REJECTED', 
              reason_code: 'ANTI_TELEPORTE', 
              reason_message: 'Alteração de lote exige evento de movimentação no mesmo batch.' 
            })
            continue
          }
        }

        // 3. Execução
        let query
        if (op.action === 'INSERT') {
          query = supabase.from(op.table).insert({ ...op.record, fazenda_id, client_op_id: op.op_id })
        } else if (op.action === 'UPDATE') {
          query = supabase.from(op.table).update(op.record).eq('id', op.record.id).eq('fazenda_id', fazenda_id)
        } else if (op.action === 'DELETE') {
          query = supabase.from(op.table).update({ deleted_at: new Date().toISOString() }).eq('id', op.record.id).eq('fazenda_id', fazenda_id)
        }

        const { error: dbError } = await query
        
        if (dbError) {
          // Dedup Agenda (Unique constraint colision)
          if (dbError.code === '23505' && op.table === 'agenda_itens') {
            results.push({ op_id: op.op_id, status: 'APPLIED_ALTERED', altered: { dedup: 'collision_noop' } })
          } else {
            throw dbError
          }
        } else {
          results.push({ op_id: op.op_id, status: 'APPLIED' })
        }

      } catch (err) {
        results.push({ 
          op_id: op.op_id, 
          status: 'REJECTED', 
          reason_code: 'DB_ERROR', 
          reason_message: err.message 
        })
      }
    }

    return new Response(
      JSON.stringify({ server_tx_id: `srv-${crypto.randomUUID().split('-')[0]}`, client_tx_id, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})