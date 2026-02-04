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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { client_id, fazenda_id, client_tx_id, ops } = await req.json()
    console.log(`[sync-batch] Processing TX ${client_tx_id} for farm ${fazenda_id}`);

    const results = [];
    
    // Iniciamos uma transação via RPC (PostgreSQL function que executa o batch)
    // Para simplificar no MVP, usaremos uma abordagem sequencial com controle de erro,
    // mas em produção o ideal é um RPC customizado para garantir atomicidade total.
    
    // Validação Anti-Teleporte (Simplificada)
    const hasMovimentacao = ops.some((o: any) => o.table === 'eventos' && o.record.dominio === 'movimentacao');
    const hasLoteUpdate = ops.some((o: any) => o.table === 'animais' && o.action === 'UPDATE' && o.record.lote_id !== undefined);

    for (const op of ops) {
      // Regra Anti-Teleporte
      if (op.table === 'animais' && op.action === 'UPDATE' && op.record.lote_id !== undefined && !hasMovimentacao) {
        results.push({ op_id: op.client_op_id, status: 'REJECTED', reason_code: 'ANTI_TELEPORTE', reason_message: 'Update de lote exige evento de movimentação no mesmo batch.' });
        continue;
      }

      try {
        let query;
        if (op.action === 'INSERT') {
          query = supabase.from(op.table).insert({ ...op.record, fazenda_id, client_id, client_op_id: op.client_op_id, client_tx_id });
        } else if (op.action === 'UPDATE') {
          query = supabase.from(op.table).update(op.record).match({ id: op.record.id, fazenda_id });
        } else if (op.action === 'DELETE') {
          query = supabase.from(op.table).update({ deleted_at: new Date().toISOString() }).match({ id: op.record.id, fazenda_id });
        }

        const { error, data } = await query!;

        if (error) {
          // Tratamento de Dedup Agenda (Unique Constraint)
          if (error.code === '23505' && op.table === 'agenda_itens') {
            results.push({ op_id: op.client_op_id, status: 'APPLIED_ALTERED', altered: { dedup: 'collision_noop' } });
          } else if (error.code === '23505') {
            // Idempotência: Se já existe o client_op_id, consideramos aplicado
            results.push({ op_id: op.client_op_id, status: 'APPLIED' });
          } else {
            results.push({ op_id: op.client_op_id, status: 'REJECTED', reason_code: error.code, reason_message: error.message });
          }
        } else {
          results.push({ op_id: op.client_op_id, status: 'APPLIED' });
        }
      } catch (e) {
        results.push({ op_id: op.client_op_id, status: 'REJECTED', reason_code: 'INTERNAL_ERROR', reason_message: e.message });
      }
    }

    return new Response(JSON.stringify({ server_tx_id: `srv-${client_tx_id.slice(0,8)}`, client_tx_id, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})