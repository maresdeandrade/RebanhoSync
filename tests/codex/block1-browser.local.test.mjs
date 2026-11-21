import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';
import pg from 'pg';

// Independent Chromium sessions and disposable backend; no journey sessions/data.
test('Block1 corrected screens persist, recover and enforce UI permissions in Chromium', {timeout:180000}, async()=>{
  const env=JSON.parse(execFileSync('supabase',['status','--workdir','.work/block1/disposable','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
  assert.equal(new URL(env.API_URL).port,'54421');assert.equal(new URL(env.DB_URL).port,'54422');
  const db=new pg.Client({connectionString:env.DB_URL});await db.connect();
  const admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const run=randomUUID(),password=randomUUID()+'-Aa1!',email=`block1-${run}@example.test`,otherEmail=`block1-other-${run}@example.test`;
  const must=result=>{if(result.error)throw Error(result.error.message);return result.data;};
  const user=must(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
  const other=must(await admin.auth.admin.createUser({email:otherEmail,password,email_confirm:true})).user;
  const own=createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  must(await own.auth.signInWithPassword({email,password}));
  const farm=must(await own.rpc('create_fazenda',{_nome:`Block1 browser ${run}`,_estado:'MG',_tipo_producao:'corte'}));
  must(await own.from('user_settings').upsert({user_id:user.id,active_fazenda_id:farm}));
  await db.query("insert into public.user_fazendas(user_id,fazenda_id,role,accepted_at) values($1,$2,'cowboy',now())",[other.id,farm]);
  await db.query('insert into public.user_settings(user_id,active_fazenda_id) values($1,$2) on conflict(user_id) do update set active_fazenda_id=excluded.active_fazenda_id',[other.id,farm]);
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4174','--strictPort'],{env:{...process.env,VITE_SUPABASE_URL:env.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:env.ANON_KEY,VITE_SUPABASE_FUNCTIONS_URL:env.API_URL+'/functions/v1'},stdio:'ignore',windowsHide:true});
  let browser;
  fs.mkdirSync('.work/block1/screens',{recursive:true});
  const captures=[];
  try{
    const deadline=Date.now()+20000;
    while(true){try{if((await fetch('http://127.0.0.1:4174')).ok)break;}catch{} if(Date.now()>deadline)throw Error('Isolated Vite did not start');await new Promise(r=>setTimeout(r,100));}
    browser=await chromium.launch({headless:true});
    async function login(page,loginEmail=email){
      await page.goto('http://127.0.0.1:4174/login');
      await page.getByLabel('E-mail',{exact:true}).fill(loginEmail);await page.getByLabel('Senha',{exact:true}).fill(password);
      await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(url=>!url.pathname.includes('login'));
      await page.goto('http://127.0.0.1:4174/perfil');await expect(page.getByLabel('Nome de exibicao')).toBeVisible();
    }
    const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.setDefaultTimeout(15000);
    await login(page);
    assert.equal((await db.query('select count(*)::int n from public.user_profiles where user_id=$1',[user.id])).rows[0].n,0);
    await page.getByLabel('Nome de exibicao').fill('Primeiro perfil');await page.getByLabel('Telefone',{exact:true}).fill('11999998888');
    await page.getByRole('button',{name:'Salvar perfil',exact:true}).click();await expect(page.getByText('Perfil atualizado com sucesso',{exact:true})).toBeVisible();
    assert.equal((await db.query('select display_name from public.user_profiles where user_id=$1',[user.id])).rows[0].display_name,'Primeiro perfil');
    await page.reload();await expect(page.getByLabel('Nome de exibicao')).toHaveValue('Primeiro perfil');
    await page.getByLabel('Nome de exibicao').fill('Perfil atualizado');await page.getByRole('button',{name:'Salvar perfil',exact:true}).click();await expect(page.getByText('Perfil atualizado com sucesso',{exact:true})).toBeVisible();
    const next=await browser.newContext({viewport:{width:390,height:844}}),newPage=await next.newPage();
    await login(newPage);await expect(newPage.getByLabel('Nome de exibicao')).toHaveValue('Perfil atualizado');
    await newPage.screenshot({path:'.work/block1/screens/profile-new-session-mobile.png',fullPage:true});captures.push('profile-new-session-mobile.png');
    await next.close();
    await page.reload();await page.getByLabel('Nome de exibicao').fill('Rascunho preservado');
    await page.route('**/rest/v1/user_profiles*',route=>['POST','PATCH'].includes(route.request().method())?route.abort('failed'):route.continue());
    await page.getByRole('button',{name:'Salvar perfil',exact:true}).click();await expect(page.getByText('Perfil atualizado com sucesso',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Salvar perfil',exact:true})).toBeEnabled();await expect(page.getByLabel('Nome de exibicao')).toHaveValue('Rascunho preservado');
    assert.equal((await db.query('select display_name from public.user_profiles where user_id=$1',[user.id])).rows[0].display_name,'Perfil atualizado');
    await page.screenshot({path:'.work/block1/screens/profile-network-error.png',fullPage:true});captures.push('profile-network-error.png');await page.unrouteAll();
    await page.reload();await page.getByRole('tab',{name:'Preferencias'}).click();
    const quiet=page.getByText('Horario de silencio',{exact:true}).locator('..').locator('..').getByRole('switch');await quiet.check();
    await page.getByLabel('Inicio',{exact:true}).fill('');await page.getByRole('button',{name:'Salvar preferencias',exact:true}).click();await expect(page.getByRole('alert')).toContainText('início e fim');
    await page.screenshot({path:'.work/block1/screens/quiet-hours-invalid.png',fullPage:true});captures.push('quiet-hours-invalid.png');
    await page.getByLabel('Inicio',{exact:true}).fill('22:00');await page.getByLabel('Fim',{exact:true}).fill('06:00');
    await page.getByRole('button',{name:'Salvar preferencias',exact:true}).click();await expect(page.getByText('Preferencias atualizadas com sucesso',{exact:true})).toBeVisible();
    assert.deepEqual((await db.query('select notifications from public.user_settings where user_id=$1',[user.id])).rows[0].notifications.quiet_hours,{start:'22:00',end:'06:00'});
    await page.reload();await page.getByRole('tab',{name:'Preferencias'}).click();await expect(page.getByLabel('Inicio',{exact:true})).toHaveValue('22:00');await expect(page.getByLabel('Fim',{exact:true})).toHaveValue('06:00');
    for(const [name,url]of [['create','criar-fazenda'],['onboarding','onboarding-inicial'],['edit','editar-fazenda'],['finance','financeiro']]){
      await page.goto('http://127.0.0.1:4174/'+url);
      if(name==='create'){
        await page.getByLabel('Nome da fazenda',{exact:true}).fill('Não deve criar');await page.getByLabel('Area total (ha)',{exact:true}).fill('-10');await page.getByRole('button',{name:'Criar fazenda',exact:true}).click();await expect(page.getByRole('alert')).toContainText('maior que zero');
      }else if(name==='onboarding'){
        await page.getByRole('button',{name:/Fazenda/}).click();await expect(page.getByText('Nome e localizacao revisados.',{exact:true})).toHaveCount(0);await expect(page.getByText('Municipio e estado opcionais; confira-os quando informados.',{exact:true})).toBeVisible();
      }else if(name==='edit')await expect(page.getByRole('button',{name:'Salvar fazenda',exact:true})).toBeVisible();
      else await expect(page.getByRole('button',{name:'Novo lançamento',exact:true})).toBeVisible();
      await page.screenshot({path:`.work/block1/screens/${name}-desktop.png`,fullPage:true});captures.push(`${name}-desktop.png`);
      await page.setViewportSize({width:390,height:844});await page.screenshot({path:`.work/block1/screens/${name}-mobile.png`,fullPage:true});captures.push(`${name}-mobile.png`);await page.setViewportSize({width:1440,height:900});
    }
    // Owner opened settings before another owner changed a protected value.
    await page.goto('http://127.0.0.1:4174/configuracoes');
    await expect(page.getByRole('button',{name:'Salvar unidade',exact:true})).toBeVisible();
    must(await own.from('fazendas').update({metadata:{eventos_rollout:{strict_rules_enabled:false,strict_anti_teleporte:false},keep:'concurrent'}}).eq('id',farm));
    await page.getByRole('button',{name:'Arroba',exact:true}).click();
    const staleResponse=page.waitForResponse(r=>r.url().includes('/rest/v1/fazendas')&&r.request().method()==='PATCH');
    await page.getByRole('button',{name:'Salvar unidade',exact:true}).click();await staleResponse;
    await expect(page.getByRole('button',{name:'Salvar unidade',exact:true})).toBeVisible();
    assert.equal((await db.query('select metadata from public.fazendas where id=$1',[farm])).rows[0].metadata.eventos_rollout?.strict_rules_enabled,false,'stale owner settings must not restore protected flags');
    await page.screenshot({path:'.work/block1/screens/stale-owner-settings.png',fullPage:true});captures.push('stale-owner-settings.png');
    await expect(page.getByText('A fazenda foi alterada ou seu acesso mudou. Recarregue os dados antes de salvar novamente.',{exact:true})).toBeVisible();
    await page.reload();await page.getByRole('button',{name:'Arroba',exact:true}).click();await page.getByRole('button',{name:'Salvar unidade',exact:true}).click();await expect(page.getByText('Unidade de peso atualizada.',{exact:true})).toBeVisible();
    const preserved=(await db.query('select metadata from public.fazendas where id=$1',[farm])).rows[0].metadata;
    assert.equal(preserved.eventos_rollout.strict_rules_enabled,false);assert.equal(preserved.keep,'concurrent');assert.equal(preserved.measurement_preferences.weight_unit,'arroba');
    await page.goto('http://127.0.0.1:4174/editar-fazenda');await page.getByRole('button',{name:'Salvar fazenda',exact:true}).click();await page.waitForURL('**/home');
    assert.equal((await db.query('select metadata from public.fazendas where id=$1',[farm])).rows[0].metadata.eventos_rollout.strict_rules_enabled,false);
    const workerContext=await browser.newContext(),worker=await workerContext.newPage();await login(worker,otherEmail);await worker.goto('http://127.0.0.1:4174/financeiro');
    await expect(worker.getByRole('heading',{name:'Lançamentos Financeiros Gerenciais',exact:true})).toBeVisible();await expect(worker.getByRole('button',{name:'Novo lançamento',exact:true})).toHaveCount(0);await expect(worker.getByRole('button',{name:'Nova categoria',exact:true})).toHaveCount(0);
    const otherClient=createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});must(await otherClient.auth.signInWithPassword({email:otherEmail,password}));assert.ok((await otherClient.from('user_profiles').upsert({user_id:user.id,display_name:'Spoof'})).error);
    assert.equal((await db.query('select display_name from public.user_profiles where user_id=$1',[user.id])).rows[0].display_name,'Perfil atualizado');
    await worker.screenshot({path:'.work/block1/screens/finance-cowboy.png',fullPage:true});captures.push('finance-cowboy.png');
    fs.writeFileSync('.work/block1/browser-result.json',JSON.stringify({status:'passed',backend:env.API_URL,frontend:'http://127.0.0.1:4174',farm,user:user.id,other:other.id,captures,checks:['profile first insert','profile update','reload','new authenticated Chromium session','structured network failure preserves draft/no false success','foreign identity rejected via real PostgREST','quiet hours incomplete rejection','overnight persistence and reload','negative farm area','onboarding criteria','owner/cowboy finance UI','desktop/mobile screenshots','stale owner settings rejected without flag reversal','reload and save preserve unrelated keys and flags','edit farm conditional save'],fixtures:'retained in isolated disposable backend; original sessions untouched'},null,2));
  }finally{if(browser)await browser.close();server.kill();await db.end();}
});
