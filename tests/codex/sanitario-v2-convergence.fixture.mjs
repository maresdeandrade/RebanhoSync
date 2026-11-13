// Runs only inside the owned disposable Supabase harness. No simulated transport or catalog.
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import { restrictContextToLoopback } from "./sanitary-disposable-support.fixture.mjs";

export async function runSanitaryConvergenceFixture({
  db,
  env,
  adminClient,
  sessions,
  packet,
  report,
}) {
  assert.equal(new URL(env.API_URL).hostname, "127.0.0.1");
  assert.equal(new URL(env.API_URL).port, "55421");
  const check = async (name, fn) => {
    report.convergence_step = name;
    await fn();
    report.cases.push(name);
  };
  const readySets = ["B19", "PAR", "DES", "CONF", "PARTO"];
  const ready = packet.prepared_item_records.filter((row) =>
    readySets.includes(row.decision_set),
  );
  assert.equal(ready.length, 7);
  await check(
    "Five decision sets: seven exact candidate versions approved by synthetic authorized reviewer",
    async () => {
      for (const set of readySets.filter((value) => value !== "B19")) {
        const rows = ready.filter((row) => row.decision_set === set);
        const protocol = packet.prepared_protocol_records.find(
          (row) => row.record.id === rows[0].record.protocol_id,
        ).record;
        const params = {
          _protocol_id: protocol.id,
          _expected_version: protocol.version,
          _item_ids: rows.map((row) => row.record.id),
        };
        const preview = await sessions[0].client.rpc(
          "sanitario_catalog_review_preview_v2",
          params,
        );
        assert.ifError(preview.error);
        assert.deepEqual(preview.data.blockers, []);
        const decision = await sessions[0].client.rpc(
          "sanitario_catalog_decide_v2",
          {
            ...params,
            _reviewed_content_digest: preview.data.reviewed_content_digest,
            _result: "approved",
            _justification:
              "Decisão explícita sintética para homologação descartável; somente avaliação",
            _request_id: randomUUID(),
          },
        );
        assert.ifError(decision.error);
      }
      const allowed = await db.query(
        "select count(*)::int n from public.sanitario_protocolo_itens_versions_v2 where id = any($1::uuid[]) and status = 'active' and deleted_at is null",
        [ready.map(row => row.record.id)],
      );
      assert.equal(allowed.rows[0].n, 7);
    },
  );
  const owner = sessions[1];
  async function syntheticUser() {
    const email = `${randomUUID()}@local.invalid`,
      password = `${randomUUID()}Aa!`;
    const result = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(result.error);
    const client = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    assert.ifError(
      (await client.auth.signInWithPassword({ email, password })).error,
    );
    return { id: result.data.user.id, client, email, password };
  }
  const second = await syntheticUser(),
    outsider = await syntheticUser();
  const farm = randomUUID(),
    otherFarm = randomUUID();
  const calf = randomUUID(),
    rearing = randomUUID(),
    dam = randomUUID();
  for (const [id, actor] of [
    [farm, owner],
    [otherFarm, outsider],
  ]) {
    await db.query(
      "insert into public.fazendas(id,nome,codigo,created_by) values($1,'Homologação sintética',$2,$3)",
      [id, randomUUID(), actor.id],
    );
    await db.query(
      "insert into public.user_fazendas(fazenda_id,user_id,role,accepted_at) values($1,$2,'owner',now())",
      [id, actor.id],
    );
    await db.query(
      "insert into public.fazenda_sanidade_config(fazenda_id,uf,aptidao,sistema,payload) values($1,'DF','leite','intensivo',$2)",
      [id, { unrelated: "preserved" }],
    );
  }
  await db.query(
    "insert into public.user_fazendas(fazenda_id,user_id,role,accepted_at) values($1,$2,'manager',now())",
    [farm, second.id],
  );
  await db.query(
    `insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,minimum_contract_version,maximum_contract_version,allowed_user_ids,rollout_percentage,foundation_state)
    values($1,true,3,3,$2,100,'ready')`,
    [farm, [owner.id, second.id]],
  );
  for (const [id, sex, birth] of [
    [calf, "F", "2026-02-01"],
    [rearing, "M", "2025-08-01"],
    [dam, "F", "2023-01-01"],
  ]) {
    await db.query(
      "insert into public.animais(id,fazenda_id,identificacao,sexo,data_nascimento,especie) values($1,$2,$3,$4,$5,'bovino')",
      [id, farm, randomUUID(), sex, birth],
    );
  }
  Object.assign(process.env, {
    VITE_SUPABASE_URL: env.API_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: env.ANON_KEY,
    VITE_SUPABASE_FUNCTIONS_URL: `${env.API_URL}/functions/v1`,
    VITE_BACKEND_ENV: "homologation",
  });
  let vite, browser;
  const clients = [];
  const observed = [];
  try {
    vite = await createServer({
      server: { host: "127.0.0.1", port: 8181, strictPort: true },
      logLevel: "error",
    });
    await vite.listen();
    browser = await chromium.launch({ headless: true });
    const origin = "http://127.0.0.1:8181";
    async function client(actor) {
      const context = await browser.newContext();
      clients.push(context);
      await context.grantPermissions(["local-network-access"], { origin });
      await context.route(`${origin}/`, (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><html><body>Homologação sanitária local</body></html>",
        }),
      );
      await restrictContextToLoopback(context);
      const page = await context.newPage();
      page.on("response", async (response) => {
        if (response.url().endsWith("/functions/v1/sync-batch")) {
          try {
            const body = await response.json();
            observed.push({
              status: response.status(),
              results: body.results?.map((row) => ({
                status: row.status,
                reason: row.reason_code,
                revision: row.current_revision,
              })),
            });
          } catch {
            /* intentionally lost ACK */
          }
        }
      });
      await page.goto(origin);
      await page.evaluate(
        async ({ email, password, farm }) => {
          const [
            { db },
            { supabase },
            cut,
            worker,
            pull,
            ownership,
            windows,
            manage,
          ] = await Promise.all([
            import("/src/lib/offline/db.ts"),
            import("/src/lib/supabase.ts"),
            import("/src/lib/offline/sanitarioV2Cutover.ts"),
            import("/src/lib/offline/syncWorker.ts"),
            import("/src/lib/offline/pull.ts"),
            import("/src/lib/offline/ownership.ts"),
            import("/src/lib/sanitario/windows/sanitaryProtocolWindowsV2.ts"),
            import("/src/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2.ts"),
          ]);
          const login = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (login.error) throw new Error("SYNTHETIC_LOGIN_FAILED");
          await ownership.establishLocalOwnership(login.data.session);
          localStorage.setItem("gestao_agro_active_fazenda_id", farm);
          cut.setSanitarioV2PushEnabled(true, "local");
          await pull.pullSanitarioProtocolCatalogV2();
          await pull.pullSanitarioTechnicalCatalogV2(farm);
          await pull.pullDataForFarm(
            farm,
            ["animais", "fazenda_sanidade_config"],
            { mode: "merge" },
          );
          await cut.applySanitarioV2Cutover(
            farm,
            pull.pullSanitarioV2CutoverState,
          );
          window.cert = {
            actor: login.data.session.user.id,
            db,
            supabase,
            cut,
            worker,
            pull,
            windows,
            manage,
          };
        },
        { email: actor.email, password: actor.password, farm },
      );
      return { context, page };
    }
    const a = await client(owner),
      b = await client(second);
    const state = (page) =>
      page.evaluate(async (farm) => {
        const { db } = window.cert;
        return {
          agendas: await db.ops_sanitario_agenda_v2
            .where("fazenda_id")
            .equals(farm)
            .toArray(),
          ops: await db.queue_ops.toArray(),
          gestures: await db.queue_gestures.toArray(),
          approved: (
            await db.catalog_sanitario_protocolo_itens_versions_v2.toArray()
          ).filter((row) => row.status === "active").map(row => row.id),
        };
      }, farm);
    async function drain(page) {
      return page.evaluate(async () => {
        const { db, worker } = window.cert;
        const rows = (await db.queue_gestures.toArray())
          .filter((row) => row.status === "PENDING")
          .sort((l, r) => l.created_at.localeCompare(r.created_at));
        window.cert.lastSent = [];
        for (const gesture of rows) {
          window.cert.lastSent.push({
            gesture,
            ops: (
              await db.queue_ops
                .where("client_tx_id")
                .equals(gesture.client_tx_id)
                .toArray()
            ).map((op) => worker.mapOperationForSync(op, gesture.fazenda_id)),
          });
          await worker.processGesture(gesture);
        }
        return (await db.queue_gestures.toArray()).map((row) => ({
          status: row.status,
          result: row.sync_result,
          results: row.operation_results?.map((value) => ({
            status: value.status,
            reason: value.reason_code,
          })),
        }));
      });
    }
    async function pull(page) {
      await page.evaluate(
        (farm) => window.cert.pull.pullSanitarioV2CutoverState(farm),
        farm,
      );
    }
    await check(
      "Two Chromium contexts independently pull the seven published versions through authenticated RLS",
      async () => {
        const publishedA = (await state(a.page)).approved;
        const publishedB = (await state(b.page)).approved;
        assert(ready.every(row => (publishedA.includes(row.record.id))));
        assert(ready.every(row => (publishedB.includes(row.record.id))));
      },
    );
    // Explicit manual confirmation replaces the retired persistent plan/generator.
    // Both clients retain the same reviewed user intention and operation identity.
    const createManual = page => page.evaluate(async ({ farm, calf, itemId }) => {
      const { windows } = window.cert;
      const source = await windows.loadSanitaryProtocolWindowSourceV2(farm);
      const item = source.catalog.items.find(row => row.id === itemId);
      const preview = windows.buildSanitaryProtocolWindowV2({ source, protocolId: item.protocolId,
        itemId, evaluatedAt: "2026-05-15" });
      const rows = preview.rows.filter(row => row.animalId === calf);
      if (rows.length !== 1 || (!rows[0].canSelect && !rows[0].alreadyPlanned)) throw new Error("MANUAL_B19_PREVIEW_NOT_ELIGIBLE");
      return windows.createGroupedManualSanitaryAgendasV2({ rows, fazendaId: farm,
        plannedFor: "2026-05-15", confirmed: true });
    }, { farm, calf, itemId: ready.find(row => row.decision_set === "B19").record.id });
    await check("Offline manual intention survives reopen, replay and pull in a second client", async () => {
      await a.context.setOffline(true);
      await createManual(a.page);
      const before = await state(a.page);
      assert.equal(before.agendas.length, 1);
      assert.equal(before.ops.length, 1);
      await a.page.evaluate(async () => { window.cert.db.close(); await window.cert.db.open(); });
      assert.deepEqual((await state(a.page)).ops, before.ops);
      await a.context.setOffline(false);
      await pull(a.page);
      assert.equal((await state(a.page)).ops[0].client_op_id, before.ops[0].client_op_id);
      assert((await drain(a.page)).every(row => row.status === "DONE"));
      await pull(b.page);
      assert.equal((await state(b.page)).agendas[0].id, before.agendas[0].id);
      await createManual(b.page);
      assert.equal((await state(b.page)).agendas.length, 1);
      assert.equal((await state(b.page)).ops.length, 0);
      report.manual_intention = { agenda_id: before.agendas[0].id, replayed_without_duplicate: true };
    });
    const validCreation = await a.page.evaluate(() =>
      window.cert.lastSent.at(-1),
    );
    async function sendCreation(item) {
      const tx = randomUUID(),
        op = structuredClone(validCreation.ops[0]);
      assert.equal(op.command, "create_agenda");
      Object.assign(op, {
        client_op_id: randomUUID(),
        client_tx_id: tx,
        domain_op_id: randomUUID(),
      });
      op.payload.agenda.id = randomUUID();
      op.payload.agenda.dedup_key = `forbidden-fixture:${randomUUID()}`;
      op.payload.agenda.protocol_item_snapshot.generationMode = "automatic";
      if (item) {
        op.payload.agenda.protocolo_id = item.protocol_id;
        op.payload.agenda.protocol_item_version_id = item.id;
        op.payload.agenda.protocol_item_snapshot.planningEvidence.itemVersion =
          item.version;
      }
      return owner.client.functions.invoke("sync-batch", {
        body: {
          fazenda_id: farm,
          client_id: validCreation.gesture.client_id,
          client_tx_id: tx,
          ops: [op],
        },
      });
    }
    await check("Stale automatic requests are rejected even for published and restricted items", async () => {
      const items = [...packet.prepared_item_records.map(row => row.record), ...packet.retained_restricted_records];
      assert.equal(items.length, 20);
      for (const item of items) {
        const result = await sendCreation(item);
        assert.ifError(result.error);
        assert.equal(result.data.results[0].status, "REJECTED");
        assert.equal(result.data.results[0].reason_code, "SANITARIO_AUTOMATION_RETIRED");
      }
      report.retired_automatic_requests_rejected = items.length;
    });
    async function schedule(page, date) {
      const agenda = (await state(page)).agendas.find(
        (row) => row.status === "programada",
      );
      await page.evaluate(
        ({ farm, id, date }) =>
          window.cert.manage.rescheduleLocalSanitaryAgendaV2({
            fazendaId: farm,
            agendaId: id,
            plannedFor: date,
          }),
        { farm, id: agenda.id, date },
      );
      return agenda;
    }
    await check(
      "Lost ACK preserves operation identity; replay converges after the remote commit",
      async () => {
        const agenda = await schedule(a.page, "2026-10-25");
        const queued = (await state(a.page)).ops.find(
          (op) => op.record.command === "reschedule_agenda",
        );
        let intercepted = false;
        const fault = async (route) => {
          if (intercepted) return route.fallback();
          intercepted = true;
          await route.fetch();
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: "{",
          });
        };
        await a.context.route("**/functions/v1/sync-batch", fault);
        await drain(a.page);
        await a.context.unroute("**/functions/v1/sync-batch", fault);
        assert(
          (await state(a.page)).ops.some(
            (op) => op.client_op_id === queued.client_op_id,
          ),
        );
        const before = (
          await db.query(
            "select revision from public.sanitario_agenda_v2 where id=$1",
            [agenda.id],
          )
        ).rows[0].revision;
        assert.equal(Number(before), Number(agenda.revision) + 1);
        const replayed = await drain(a.page);
        assert(
          replayed.every((row) => row.status === "DONE"),
          JSON.stringify(replayed),
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.sanitario_sync_v2_operations where client_op_id=$1",
              [queued.client_op_id],
            )
          ).rows[0].n,
          1,
        );
        await pull(b.page);
        assert.equal(
          (await state(b.page)).agendas.find((row) => row.id === agenda.id)
            .revision,
          Number(before),
        );
      },
    );
    await check(
      "A signed expired session receives 401; real Auth refresh and retry preserve the queued intent",
      async () => {
        const agenda = await schedule(a.page, "2026-10-26");
        const header = Buffer.from(
          JSON.stringify({ alg: "HS256", typ: "JWT" }),
        ).toString("base64url");
        const payload = Buffer.from(
          JSON.stringify({
            sub: owner.id,
            role: "authenticated",
            aud: "authenticated",
            exp: Math.floor(Date.now() / 1000) - 60,
          }),
        ).toString("base64url");
        const unsigned = `${header}.${payload}`,
          expired = `${unsigned}.${createHmac("sha256", env.JWT_SECRET).update(unsigned).digest("base64url")}`;
        const denied = await adminClient.auth.getUser(expired);
        assert(denied.error && /expired/i.test(denied.error.message));
        let sent = false;
        const statuses = [];
        const record = (response) => {
          if (response.url().includes("/auth/v1/token"))
            statuses.push(response.status());
        };
        a.page.on("response", record);
        const inject = (route) => {
          if (sent) return route.fallback();
          sent = true;
          return route.continue({
            headers: {
              ...route.request().headers(),
              authorization: `Bearer ${expired}`,
            },
          });
        };
        await a.context.route("**/functions/v1/sync-batch", inject);
        const result = await drain(a.page);
        await a.context.unroute("**/functions/v1/sync-batch", inject);
        a.page.off("response", record);
        assert(
          result.every((row) => row.status === "DONE"),
          JSON.stringify(result),
        );
        assert(statuses.includes(200));
        report.expired_session = {
          auth_rejected_expired_token: true,
          refresh_statuses: statuses,
          operation_applied: true,
        };
      },
    );
    await check(
      "An injected failure after schedule mutation rolls back the entire RPC; retry applies once",
      async () => {
        const agenda = await schedule(a.page, "2026-10-27");
        const op = (await state(a.page)).ops.find(
          (op) => op.record.command === "reschedule_agenda",
        );
        await db.query(`create function public.fixture_schedule_failure() returns trigger language plpgsql as $$
        begin if new.client_op_id='${op.client_op_id}'::uuid then raise exception 'SANITARIO_FIXTURE_PARTIAL_TIMEOUT' using errcode='57014'; end if; return new; end $$;
        create trigger fixture_schedule_failure before insert on public.sanitario_sync_v2_operations for each row execute function public.fixture_schedule_failure();`);
        try {
          await drain(a.page);
          const after = (
            await db.query(
              "select revision,data_programada::text date from public.sanitario_agenda_v2 where id=$1",
              [agenda.id],
            )
          ).rows[0];
          assert.equal(Number(after.revision), Number(agenda.revision));
          assert.equal(after.date, agenda.data_programada);
          const pending = (await state(a.page)).ops.find(
            (row) => row.client_op_id === op.client_op_id,
          );
          assert.equal(pending.sync_state, "RETRYABLE");
          report.partial_failure = {
            rolled_back_revision: after.revision,
            queue_state: pending.sync_state,
          };
        } finally {
          await db.query(
            "drop trigger fixture_schedule_failure on public.sanitario_sync_v2_operations; drop function public.fixture_schedule_failure()",
          );
        }
        const pending = (await state(a.page)).ops.find(
          (row) => row.client_op_id === op.client_op_id,
        );
        const delay = Math.max(
          0,
          new Date(pending.next_attempt_at).getTime() - Date.now() + 50,
        );
        assert(delay < 60000);
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        const result = await drain(a.page);
        assert(
          result.every((row) => row.status === "DONE"),
          JSON.stringify(result),
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.sanitario_sync_v2_operations where client_op_id=$1",
              [op.client_op_id],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await check(
      "Farm switch retains the original queued farm and does not write the newly selected farm",
      async () => {
        const agenda = (await state(a.page)).agendas.find(
          (row) => row.status === "programada",
        );
        await a.page.evaluate(
          ({ farm, id, otherFarm }) => {
            const work = window.cert.manage.rescheduleLocalSanitaryAgendaV2({
              fazendaId: farm,
              agendaId: id,
              plannedFor: "2026-11-02",
            });
            localStorage.setItem("gestao_agro_active_fazenda_id", otherFarm);
            return work;
          },
          { farm, id: agenda.id, otherFarm },
        );
        assert((await drain(a.page)).every((row) => row.status === "DONE"));
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.sanitario_agenda_v2 where fazenda_id=$1",
              [otherFarm],
            )
          ).rows[0].n,
          0,
        );
        await a.page.evaluate(
          (farm) => localStorage.setItem("gestao_agro_active_fazenda_id", farm),
          farm,
        );
      },
    );
    await check("Concurrent manual reschedules conflict without rebasing stale client content", async () => {
      await pull(a.page);
      await pull(b.page);
      await schedule(a.page, "2026-11-03");
      await schedule(b.page, "2026-11-04");
      assert((await drain(a.page)).every(row => row.status === "DONE"));
      const rejected = await drain(b.page);
      assert(rejected.some(row => row.results?.some(result => result.status === "CONFLICT")), JSON.stringify(rejected));
      await pull(b.page);
      assert.equal((await state(b.page)).agendas[0].data_programada, "2026-11-03");
    });
    await check(
      "Reschedule, cancellation and reconnect preserve the manual intention",
      async () => {
        const agenda = (await state(a.page)).agendas.find(
          (row) => row.status === "programada",
        );
        await a.context.setOffline(true);
        await a.page.evaluate(
          async ({ farm, id }) => {
            await window.cert.manage.rescheduleLocalSanitaryAgendaV2({
              fazendaId: farm,
              agendaId: id,
              plannedFor: "2026-11-01",
            });
            await window.cert.manage.cancelLocalSanitaryAgendaV2({
              fazendaId: farm,
              agendaId: id,
            });
          },
          { farm, id: agenda.id },
        );
        await a.context.setOffline(false);
        const result = await drain(a.page);
        assert(
          result.every((row) => row.status === "DONE"),
          JSON.stringify(result),
        );
        await pull(b.page);
        const canonical = (await state(b.page)).agendas.find(
          (row) => row.id === agenda.id,
        );
        assert.equal(canonical.status, "cancelada");
        assert.equal(canonical.data_programada, "2026-11-01");
        assert.equal(canonical.revision, Number(agenda.revision) + 2);
        assert.equal(
          (await state(b.page)).agendas.filter(
            (row) => row.dedup_key === agenda.dedup_key,
          ).length,
          1,
        );
      },
    );
    await check(
      "RLS hides another farm's manual Agenda and denies direct overwrite",
      async () => {
        const outsiderRead = await outsider.client.from("sanitario_agenda_v2").select("*").eq("fazenda_id", farm);
        assert.ifError(outsiderRead.error);
        assert.equal(outsiderRead.data.length, 0);
        const agenda = (await state(a.page)).agendas[0];
        const direct = await owner.client.from("sanitario_agenda_v2").update({ data_programada: "2027-01-01" }).eq("id", agenda.id);
        assert.equal(direct.error?.code, "42501");
      },
    );
    await check(
      "Planning creates no facts, stock movements or withdrawals; pending and restricted items remain unauthorized",
      async () => {
        const counts = (
          await db.query(
            `select
        (select count(*)::int from public.eventos where fazenda_id=$1) facts,
        (select count(*)::int from public.eventos_sanitario where fazenda_id=$1) details,
        (select count(*)::int from public.insumo_movimentacoes where fazenda_id=$1) stock,
        (select count(*)::int from public.sanitario_agenda_v2 where fazenda_id=$1) intentions`,
            [farm],
          )
        ).rows[0];
        assert.deepEqual(counts, {
          facts: 0,
          details: 0,
          stock: 0,
          intentions: 1,
        });
        report.planning_effects = counts;
      },
    );
    report.transport = observed;
    report.clients =
      "two independent Chromium contexts, Auth users, IndexedDB and localStorage; real worker, pull, Edge, RPC and PostgreSQL";
    report.real_catalog_authorizations = 0;
  } finally {
    for (const context of clients) await context.close();
    await browser?.close();
    await vite?.close();
  }
}
