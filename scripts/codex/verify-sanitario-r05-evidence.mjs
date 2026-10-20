// Offline verification of observed R05 artifacts. No network, credentials or data writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const directory='docs/review/evidence/';
const loadClient=client=>JSON.parse(gunzipSync(readFileSync(`${directory}SANITARIO_V2_R05_CLIENT_${client}_20261020.json.gz`)));
const a=loadClient('A'),b=loadClient('B');
const remote=JSON.parse(readFileSync(`${directory}SANITARIO_V2_R05_REMOTE_20261020.json`,'utf8'));
const farm='2d8a30d9-bd9c-41b4-a71d-93d2d293058f';
const actor='0f00a75c-32a9-4555-a840-cb0f13f2d3f7';
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([x],[y])=>x.localeCompare(y))):v);
const step=(client,action)=>client.steps.find(s=>s.action===action&&s.status==='OBSERVED');
const last=(client,action)=>client.steps.filter(s=>s.action===action&&s.status==='OBSERVED').at(-1);
const checks={};
function verify(name,condition){assert(condition,name);checks[name]=true;}
verify('two_real_independent_clients',a.client_id!==b.client_id&&a.actor===actor&&b.actor===actor);
for(const client of [a,b]){
  const initial=step(client,'inventory').result.inventory;
  verify(`initial_queue_preserved_${client.label}`,initial.ops.length===0&&initial.obligations.length===0);
  const prepared=step(client,'prepare').result;
  verify(`canonical_cutover_${client.label}`,prepared.after.inventory.cutovers.some(c=>c.fazenda_id===farm&&c.contract_version===2&&c.status==='APPLIED')&&prepared.before.queue_digest===prepared.after.inventory.queue_digest);
}
const offlinePlan=step(a,'save-plan').result;
verify('offline_plan_and_queue',offlinePlan.plan.revision===1&&offlinePlan.state.inventory.ops.length===1&&remote.offline_remote.plan===null&&remote.offline_remote.agendas===0);
const generated=step(a,'generate').result;
verify('offline_planning_without_facts',generated.generation.created===7&&generated.generation.failures.length===0&&generated.state.events===0&&generated.state.stock===0);
verify('generic_agendas_without_execution',generated.state.agendas.every(row=>row.execution_evento_id==null&&row.produto_veterinario_id==null));
const initialSync=step(a,'sync').result.state;
const converged=b.steps.filter(s=>s.action==='pull'&&s.status==='OBSERVED').find(s=>s.result.plan?.revision===1)?.result;
verify('reconnect_and_B_convergence',initialSync.plan.revision===1&&initialSync.inventory.ops.length===0&&initialSync.inventory.obligations.length===0&&converged?.agendas.length===7&&canonical(initialSync.agendas.map(x=>x.id).sort())===canonical(converged.agendas.map(x=>x.id).sort()));
const oldOp=offlinePlan.state.inventory.ops[0];
const mapped=a.transport.flatMap(t=>t.request.ops).find(o=>o.client_op_id===oldOp.id);
verify('legacy_plan_queue_identity_preserved',oldOp.table==='fazenda_sanidade_config'&&mapped?.command==='set_automation_plan'&&mapped.client_tx_id===oldOp.tx&&mapped.domain_op_id===oldOp.id);
const withheld=a.transport.find(t=>t.fault==='lostack');
const replay=a.transport.find(t=>t!==withheld&&t.request.client_tx_id===withheld.request.client_tx_id);
verify('lost_ACK_exact_request_and_receipt',canonical(withheld.request)===canonical(replay.request)&&canonical(withheld.response)===canonical(replay.response)&&remote.lost_ack_remote.ledger.length===1);
const conflict=a.transport.flatMap(t=>t.response?.results??[]).find(r=>r.reason_code==='SANITARIO_PLAN_REVISION_CONFLICT');
verify('concurrent_stale_write_rejected',conflict?.status==='CONFLICT'&&a.steps.some(s=>s.action==='sync'&&s.result?.state?.plan?.revision===3));
const cancelled=last(a,'pull').result.agendas.find(row=>row.status==='cancelada');
verify('cancellation_not_recreated',!!cancelled&&last(a,'generate').result.generation.created===0);
const rescheduled=last(a,'pull').result.agendas.find(row=>row.protocol_item_version_id==='0aa8fb30-fe4f-5a37-a100-ead8f568d5e3');
verify('canonical_reschedule',rescheduled?.data_programada==='2026-10-23');
const switched=step(a,'switch-farm').result;
verify('farm_switch_preserves_pending_queue',switched.before.queue_digest===switched.after.queue_digest&&switched.before.active_farm===farm&&switched.after.active_farm!==farm);
const interrupted=a.transport.find(t=>t.fault==='interrupted');
const recovered=a.transport.find(t=>t!==interrupted&&t.request.client_tx_id===interrupted.request.client_tx_id);
verify('restart_and_idempotent_recovery',canonical(interrupted.request)===canonical(recovered.request)&&canonical(interrupted.response)===canonical(recovered.response)&&remote.interrupted_remote.ledger.length===1&&last(a,'recover').result.state.inventory.ops.length===0);
const denial=a.transport.find(t=>t.fault==='authorization_header_deliberately_omitted_not_natural_JWT_expiry');
const authenticated=a.transport.find(t=>t!==denial&&t.request.client_tx_id===denial.request.client_tx_id);
verify('real_HTTP_401_refresh_and_retry',denial.http_status===401&&authenticated.http_status===200&&canonical(denial.request)===canonical(authenticated.request));
const rls=step(b,'rls').result;
verify('authenticated_RLS_read_isolation',rls.own.data.some(m=>m.user_id===actor&&m.role==='owner')&&rls.outsider_membership.data.length===0&&rls.outsider_farm.data.length===0);
const preview=step(a,'preview').result;
verify('all_seven_rules_exercised',new Set(preview.real.entries.map(e=>e.itemId)).size===7);
verify('regional_and_restricted_negatives',preview.sc_simulation_only.toCreate===0&&preview.restricted.length===13&&preview.restricted.every(i=>i.preview.toCreate===0));
const resumed=last(b,'expiry-resume')?.result;
const expiryOp=b.natural_expiry.queue_before.ops[0].id;
const expiryReceipts=remote.natural_expiry_remote.operation;
// Another canonical worker may complete after the resume snapshot. Require eventual
// convergence AND the unique server receipt for the original pre-expiry operation.
verify('natural_JWT_expiry_refresh_and_resume',resumed&&Date.parse(resumed.observed_expired_at)>resumed.original_jwt_expired_at*1000&&resumed.auth_events.some(e=>e.event==='TOKEN_REFRESHED'&&Date.parse(e.at)>resumed.original_jwt_expired_at*1000)&&resumed.pending_ids_before.includes(expiryOp)&&last(b,'disable').result.inventory.ops.length===0&&expiryReceipts.length===1&&expiryReceipts[0].client_op_id===expiryOp&&expiryReceipts[0].actor_user_id===actor&&Date.parse(expiryReceipts[0].created_at)>resumed.original_jwt_expired_at*1000&&expiryReceipts[0].canonical_result.revision===6);
verify('final_gate_OFF',remote.final.gates.every(g=>g.enabled===false));
verify('other_farms_unchanged',canonical(remote.other_farms_before)===canonical(remote.other_farms_after));
verify('no_factual_side_effects',remote.final.events===0&&remote.final.stock===0&&remote.final.withdrawal_active===0);
verify('catalog_and_backend_preserved',remote.final.automatic_items===7&&remote.final.unapproved_items===13&&remote.final.catalog_decisions===5&&remote.final.migrations===63&&remote.final.sync_batch_version===28);
for(const client of [a,b])verify(`final_local_containment_${client.label}`,last(client,'disable').result.inventory.push_enabled===false&&last(client,'disable').result.inventory.ops.length===0&&last(client,'disable').result.inventory.obligations.length===0);
const finalA=last(a,'disable').result,finalB=last(b,'disable').result;
const agendaState=state=>state.agendas.map(({id,status,data_programada,revision})=>({id,status,data_programada,revision})).sort((x,y)=>x.id.localeCompare(y.id));
verify('final_A_B_and_remote_convergence',finalA.plan.revision===6&&finalB.plan.revision===6&&canonical(agendaState(finalA))===canonical(agendaState(finalB))&&canonical(agendaState(finalA))===canonical(agendaState(remote.final)));
verify('unique_remote_agendas_and_operations',remote.final_recheck.agenda_count===7&&remote.final_recheck.agenda_unique===7&&remote.final_recheck.ledger_count===15&&remote.final_recheck.ledger_unique===15);
verify('complete_catalog_unchanged_from_R04',remote.final_recheck.catalog_unchanged_from_r04===true);
verify('final_recheck_gate_and_domain',remote.final_recheck.gates.every(g=>g.enabled===false)&&remote.final_recheck.events===0&&remote.final_recheck.stock===0&&remote.final_recheck.withdrawal_active===0&&remote.final_recheck.plan_revision===6);
for(const client of ['A','B']){
 const bytes=readFileSync(`${directory}SANITARIO_V2_R05_CLIENT_${client}_20261020.json.gz`),artifact=remote.client_artifacts[client];
 verify(`artifact_integrity_${client}`,createHash('sha256').update(bytes).digest('hex')===artifact.gzip_sha256&&createHash('sha256').update(gunzipSync(bytes)).digest('hex')===artifact.raw_sha256);
}
console.log(JSON.stringify({classification:'R05_VERIFIED',checks,remote_operations:0},null,2));
