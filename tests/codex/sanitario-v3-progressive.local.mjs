// Real SQL, local disposable V3.1 baseline only. Fixtures retained, no cleanup.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import pg from 'pg';

test('V3.2 real SQL', async t => {
  const env = process.env;
  assert.equal(env.V31_ALLOW_LOCAL_FIXTURES, '1');
  const url = new URL(env.V31_LOCAL_DB_URL);
  assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
  assert.equal(url.pathname, '/v31_disposable_1793409359191_3953c3e8');
  assert(!url.search && !url.hash);
  const db = new pg.Client({ connectionString: url.href });
  const peer = new pg.Client({ connectionString: url.href });
  await db.connect(); await peer.connect();
  const role = async (conn, fn, actor) => {
    await conn.query('begin');
    try {
      await conn.query('set local role service_role');
      const result = await fn(); await conn.query('commit'); return result;
    } catch (error) { await conn.query('rollback'); throw error; }
  };
  try {
    const identity = (await db.query("select current_database() name, shobj_description(oid,'pg_database') marker from pg_database where datname=current_database()" )).rows[0];
    assert.equal(identity.name,url.pathname.slice(1));
    assert.equal(identity.marker,`V31_DISPOSABLE:${env.V31_LOCAL_DISPOSABLE_TOKEN}`);
    assert((await db.query("select to_regprocedure('public.internal_sanitario_admit_v3(uuid,uuid,text,jsonb,boolean)') f")).rows[0].f);
    if (env.V32_APPLY === '1') {
      await db.query(await readFile('supabase/migrations/20261031130000_sanitario_v3_progressive.sql','utf8'));
    }
    if(env.V32_EFFECTS_APPLY==='1') await db.query(await readFile('supabase/migrations/20261031131000_sanitario_v3_progressive_effects.sql','utf8'));
    if(env.V32_READERS_APPLY==='1') await db.query(await readFile('supabase/migrations/20261031132000_sanitario_v3_effects_readers.sql','utf8'));
    if(env.V32_ACL_APPLY==='1') await db.query(await readFile('supabase/migrations/20261031133000_sanitario_v3_inventory_privileges.sql','utf8'));
    const farm=randomUUID(), otherFarm=randomUUID(), actor=randomUUID(), outsider=randomUUID(), cowboy=randomUUID();
    const animals=Array.from({length:30},()=>randomUUID()); const foreignAnimal=randomUUID();
    for (const id of [actor,outsider,cowboy]) await db.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated',$2)",[id,`${id}@v32.invalid`]);
    await db.query('insert into public.fazendas(id,nome) values($1,$2),($3,$4)',[farm,`V32 ${farm}`,otherFarm,`V32 ${otherFarm}`]);
    for(const [id,f,roleName] of [[actor,farm,'owner'],[cowboy,farm,'cowboy'],[outsider,otherFarm,'owner']]) await db.query('insert into public.user_fazendas(user_id,fazenda_id,role) values($1,$2,$3)',[id,f,roleName]);
    for(const id of animals) await db.query("insert into public.animais(id,fazenda_id,identificacao,sexo) values($1::uuid,$2::uuid,$1::text,'F')",[id,farm]);
    await db.query("insert into public.animais(id,fazenda_id,identificacao,sexo) values($1::uuid,$2::uuid,$1::text,'F')",[foreignAnimal,otherFarm]);
    await db.query("insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,minimum_contract_version,maximum_contract_version,foundation_state) values($1,true,3,3,'ready')",[farm]);
    const args = extra=>({actor_user_id:actor,fazenda_id:farm,contract_version:3,client_op_id:randomUUID(),domain_op_id:randomUUID(),...extra});
    const admit = (a, command='apply_factual_core', conn=db, user=actor, lookup=false)=>role(conn,async()=> (await conn.query('select public.internal_sanitario_admit_v3($1,$2,$3,$4,$5) r',[user,farm,command,a,lookup])).rows[0].r);
    const agendaId=randomUUID();
    await admit(args({payload:{id:agendaId,dedup_key:agendaId,janela_inicio:'2026-10-31',data_programada:'2026-10-31',acao_sanitaria:'vacinacao',client_id:'v32-test',client_recorded_at:new Date().toISOString()},animal_ids:animals}), 'create_agenda');
    const group=(ids, product='A', dose=2)=>args({expected_revision:0,event_payload:{id:randomUUID(),natureza:'primary_execution',source_sanitario_agenda_v2_id:agendaId,occurred_at:new Date().toISOString(),client_id:'v32-test',client_recorded_at:new Date().toISOString(),client_tx_id:randomUUID(),payload:{sanitario_v3_progressive:true}},detail_payload:{tipo:'vacinacao',produto_nome_snapshot:`Produto ${product}`,dose_quantidade:dose,dose_unidade:'mL',via_aplicacao:'SC'},event_animals:ids.map(animal_id=>({id:randomUUID(),animal_id}))});
    let first;
    await t.test('30_animals_3_events_25_attendances_5_pending_open',async()=>{
      const groups=[group(animals.slice(0,15)),group(animals.slice(15,20),'A',5),group(animals.slice(20,25),'B',2)];
      for(const g of groups) { const r=await admit(g); assert.equal(r.confirmed,true); assert.equal(r.agenda_status,'programada'); }
      first=groups[0];
      assert.equal((await db.query('select count(*)::int n from public.sanitario_atendimentos where fazenda_id=$1',[farm])).rows[0].n,25);
      assert.equal((await db.query('select count(*)::int n from public.eventos where source_sanitario_agenda_v2_id=$1',[agendaId])).rows[0].n,3);
      assert.equal((await db.query('select status from public.sanitario_agenda_v2 where id=$1',[agendaId])).rows[0].status,'programada');
      assert.equal((await db.query("select count(*)::int n from public.sanitario_agenda_animais_v2 where agenda_id=$1 and planned_status='planejado'",[agendaId])).rows[0].n,5);
    });
    if (!first) return; // The first behavioral failure is sufficient on the V3.1 baseline.
    await t.test('lost_ack_replay_after_new_connection_and_off_gate',async()=>{
      await db.query('update public.sanitario_sync_v2_gates set enabled=false where fazenda_id=$1',[farm]);
      const r=await admit(first,'apply_factual_core',peer); assert.equal(r.evento_id,first.event_payload.id);
      assert.equal(r.confirmed,true);
      await assert.rejects(()=>admit({...first,detail_payload:{...first.detail_payload,dose_quantidade:99}}), e=>e.code==='23505');
      await db.query('update public.sanitario_sync_v2_gates set enabled=true where fazenda_id=$1',[farm]);
    });
    await t.test('overlap_preserves_whole_declaration_without_second_attendance',async()=>{
      const g=group([animals[0],animals[25]],'B',5); const r=await admit(g);
      assert.equal(r.confirmed,false); assert.equal(r.outcome,'collision'); assert.deepEqual(r.collision_animal_ids,[animals[0]]);
      assert.equal((await db.query('select count(*)::int n from public.eventos_animais where evento_id=$1',[g.event_payload.id])).rows[0].n,2);
      assert.equal((await db.query('select count(*)::int n from public.sanitario_atendimentos where fazenda_id=$1',[farm])).rows[0].n,25);
      assert.equal((await db.query('select em_disputa from public.sanitario_atendimentos where fazenda_id=$1 and animal_id=$2',[farm,animals[0]])).rows[0].em_disputa,true);
      assert.deepEqual(await admit(g),r);
    });
    await t.test('disjoint_concurrent_groups_ignore_global_cas',async()=>{
      const a=group([animals[26]]),b=group([animals[27]]);
      const results=await Promise.all([admit(a),admit(b,'apply_factual_core',peer)]);
      assert(results.every(r=>r.confirmed));
    });
    await t.test('concurrent_overlap_has_one_claim_and_durable_collision',async()=>{
      const a=group([animals[28]]),b=group([animals[28]],'B');
      const results=await Promise.all([admit(a),admit(b,'apply_factual_core',peer)]);
      assert.equal(results.filter(r=>r.confirmed).length,1); assert.equal(results.filter(r=>r.outcome==='collision').length,1);
    });
    await t.test('tenant_role_invalid_target_and_partial_failure_roll_back',async()=>{
      await assert.rejects(()=>admit(group([foreignAnimal])),e=>e.code==='23503');
      await assert.rejects(()=>admit({...group([animals[29]]),actor_user_id:outsider},'apply_factual_core',db,outsider),e=>e.code==='42501');
      const g=group([animals[29]]); g.detail_payload.tipo='invalid';
      await assert.rejects(()=>admit(g));
      assert.equal((await db.query('select count(*)::int n from public.eventos where id=$1',[g.event_payload.id])).rows[0].n,0);
      const cow=group([animals[29]]);cow.actor_user_id=cowboy;
      assert.equal((await admit(cow,'apply_factual_core',db,cowboy)).confirmed,true);
    });
    await t.test('direct_writer_and_authenticated_bypass_denied',async()=>{
      await db.query('begin'); await db.query('set local role authenticated');
      try { await assert.rejects(()=>db.query("insert into public.eventos(id,fazenda_id,dominio,occurred_at,sanitario_contract_version) values($1,$2,'sanitario',now(),3)",[randomUUID(),farm]),e=>e.code==='42501'); }
      finally { await db.query('rollback'); }
    });
    await t.test('confirmed_event_consumes_once_collision_consumes_nothing_and_stock_failure_is_atomic',async()=>{
      const supply=randomUUID(), lot=randomUUID(), stockAgenda=randomUUID();
      await db.query("insert into public.insumos(id,fazenda_id,nome,tipo,unidade_base) values($1,$2,'V32 stock','sanitario','ml')",[supply,farm]);
      await db.query("insert into public.insumo_lotes(id,fazenda_id,insumo_id,unidade_base,quantidade_inicial_base,saldo_atual_base) values($1,$2,$3,'ml',100,100)",[lot,farm,supply]);
      await admit(args({payload:{id:stockAgenda,dedup_key:stockAgenda,janela_inicio:'2026-10-31',data_programada:'2026-10-31',acao_sanitaria:'vacinacao',client_id:'v32-test',client_recorded_at:new Date().toISOString()},animal_ids:animals.slice(0,2)}),'create_agenda');
      const stocked=(ids,quantity)=>{
        const g=group(ids);g.event_payload.source_sanitario_agenda_v2_id=stockAgenda;
        g.detail_payload.insumo_id=supply;g.detail_payload.estoque_lote_id=lot;
        g.event_payload.payload.inventory_movement={id:g.event_payload.id,insumo_id:supply,insumo_lote_id:lot,quantidade_base:quantity,unidade_base:'ml',domain_op_id:randomUUID(),client_op_id:randomUUID()};
        return g;
      };
      const a=stocked([animals[0]],30);const duplicate=await Promise.all([admit(a),admit(a,'apply_factual_core',peer)]);assert(duplicate.every(r=>r.confirmed && r.evento_id===a.event_payload.id));assert.deepEqual(duplicate[0],duplicate[1]);await admit(a);
      assert.equal(Number((await db.query('select saldo_atual_base from public.insumo_lotes where id=$1',[lot])).rows[0].saldo_atual_base),70);
      const coll=stocked([animals[0]],20);assert.equal((await admit(coll)).confirmed,false);
      assert.equal((await db.query('select count(*)::int n from public.insumo_movimentacoes where insumo_lote_id=$1',[lot])).rows[0].n,1);
      const failing=stocked([animals[1]],200);await assert.rejects(()=>admit(failing));
      assert.equal((await db.query('select count(*)::int n from public.eventos where id=$1',[failing.event_payload.id])).rows[0].n,0);
      assert.equal((await db.query('select count(*)::int n from public.sanitario_atendimentos where evento_id=$1',[failing.event_payload.id])).rows[0].n,0);
    });
    await t.test('real_RLS_hides_other_farm_receipts_and_events',async()=>{
      await db.query('begin');await db.query('set local role authenticated');
      try {
        await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[outsider,JSON.stringify({sub:outsider,role:'authenticated'})]);
        assert.equal((await db.query('select count(*)::int n from public.eventos where fazenda_id=$1',[farm])).rows[0].n,0);
        assert.equal((await db.query('select count(*)::int n from public.sanitario_atendimentos where fazenda_id=$1',[farm])).rows[0].n,0);
      } finally {await db.query('rollback');}
    });
    await t.test('foundation_transition_validates_replacement_index_without_activation',async()=>{
      const f=randomUUID(),tx=randomUUID();
      await db.query('insert into public.fazendas(id,nome) values($1,$2)',[f,`V32 transition ${f}`]);
      await db.query("insert into public.user_fazendas(user_id,fazenda_id,role) values($1,$2,'owner')",[actor,f]);
      await db.query('insert into public.sanitario_sync_v2_gates(fazenda_id,enabled) values($1,false)',[f]);
      await role(db,()=>db.query("select public.internal_sanitario_transition_foundation($1,$2,'inactive','frozen',$3,0,null)",[actor,f,tx]));
      const digest=(await db.query('select public.internal_sanitario_v3_guards_digest() d')).rows[0].d;
      const evidence={frozen_revision:1,schema_revision:'20261031131000',guards_digest:digest,consumer_build:'v32-test',checks:{admission:true,consumers:true,inventory:true},inventory_disposition:'empty'};
      const r=(await role(db,()=>db.query("select public.internal_sanitario_transition_foundation($1,$2,'frozen','ready',$3,1,$4) r",[actor,f,tx,evidence]))).rows[0].r;
      assert.equal(r.foundation_state,'ready');assert.equal(r.enabled,false);
    });
    console.log('SCENARIO_30=3_EVENTS_25_RECOGNIZED_5_PENDING; GATES_ONLY_FIXTURES; NO_REMOTE');
  } finally { await db.end(); await peer.end(); }
});
