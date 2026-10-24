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
        "select count(*)::int n from public.sanitario_protocolo_itens_versions_v2 where allows_agenda_auto and deleted_at is null",
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
    `insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,minimum_contract_version,maximum_contract_version,allowed_user_ids,rollout_percentage)
    values($1,true,2,2,$2,100)`,
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
            plan,
            generator,
            windows,
            manage,
          ] = await Promise.all([
            import("/src/lib/offline/db.ts"),
            import("/src/lib/supabase.ts"),
            import("/src/lib/offline/sanitarioV2Cutover.ts"),
            import("/src/lib/offline/syncWorker.ts"),
            import("/src/lib/offline/pull.ts"),
            import("/src/lib/offline/ownership.ts"),
            import("/src/lib/sanitario/agenda/sanitaryAutomationPlanV2.ts"),
            import("/src/lib/sanitario/agenda/sanitaryAutomaticGenerationV2.ts"),
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
            plan,
            generator,
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
        const { db, plan } = window.cert;
        return {
          plan: plan.readSanitaryAutomationPlanV2(
            await db.state_fazenda_sanidade_config.get(farm),
          ),
          agendas: await db.ops_sanitario_agenda_v2
            .where("fazenda_id")
            .equals(farm)
            .toArray(),
          ops: await db.queue_ops.toArray(),
          gestures: await db.queue_gestures.toArray(),
          approved: (
            await db.catalog_sanitario_protocolo_itens_versions_v2.toArray()
          ).filter((row) => row.allows_agenda_auto).length,
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
        assert.equal((await state(a.page)).approved, 7);
        assert.equal((await state(b.page)).approved, 7);
      },
    );
    const createPlan = (page) =>
      page.evaluate(
        async ({ farm, calf, rearing, dam, ready }) => {
          const { db, plan, windows } = window.cert;
          const source = await windows.loadSanitaryProtocolWindowSourceV2(farm);
          const rules = ready.map((row) => {
            const item = source.catalog.items.find(
              (item) => item.id === row.record.id,
            );
            return plan.selectSanitaryAutomationRuleV2(
              source.catalog.protocols.find((p) => p.id === item.protocolId),
              item,
            );
          });
          const base = windows.EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2;
          const contexts = Object.fromEntries(
            ready.map((row) => {
              const context = { ...base };
              if (row.decision_set === "PAR") {
                context.management = "rearing";
                context.regionalCalendar = {
                  uf: "DF",
                  months: row.record.operational_window_rule.calendar_months,
                };
              }
              if (row.decision_set === "DES") {
                context.management = "pre_weaning";
                context.preWeaningBasis = {
                  kind: "intensive_dairy",
                  reference: "Calendário sintético leiteiro",
                };
              }
              if (row.decision_set === "CONF")
                context.management = "pre_feedlot";
              if (row.decision_set === "PARTO")
                context.reproductiveContext = "prepartum";
              if (["CONF", "PARTO"].includes(row.decision_set))
                context.scheduledContext = {
                  date: "2026-05-15",
                  animalIds: [row.decision_set === "PARTO" ? dam : rearing],
                  reference: "Manejo futuro sintético",
                };
              return [row.record.id, context];
            }),
          );
          const current = plan.readSanitaryAutomationPlanV2(
            await db.state_fazenda_sanidade_config.get(farm),
          );
          return plan.saveSanitaryAutomationPlanV2({
            fazendaId: farm,
            actorId: window.cert.actor,
            expectedRevision: current?.revision ?? 0,
            draft: { rules, context: base, ruleContexts: contexts },
            enabled: true,
            confirmed: true,
          });
        },
        { farm, calf, rearing, dam, ready },
      );
    await check(
      "Offline plan is durable in A, then canonical in PostgreSQL and received in B",
      async () => {
        // The authenticated session is already established; block only network transport.
        await a.context.setOffline(true);
        const offlineDraft = await createPlan(a.page);
        assert.equal(offlineDraft.revision, 1);
        assert.equal((await state(b.page)).plan, null);
        await a.page.evaluate(async () => {
          window.cert.db.close();
          await window.cert.db.open();
        });
        assert.equal((await state(a.page)).plan.revision, 1);
        await a.context.setOffline(false);
        await pull(a.page);
        assert.equal(
          (await state(a.page)).plan?.revision,
          1,
          "Reconnect pull must preserve the pending local plan",
        );
        const result = await drain(a.page);
        report.plan_roundtrip_transport = result;
        if (result.some((row) => row.status !== "DONE")) {
          const sent = await a.page.evaluate(() => window.cert.lastSent[0]);
          const op = sent.ops[0];
          await db.query("begin");
          try {
            await db.query("set local role service_role");
            await db.query(
              "select public.internal_sanitario_sync_v2_set_automation_plan($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
              [
                owner.id,
                farm,
                2,
                op.client_op_id,
                op.domain_op_id,
                op.expected_revision,
                sent.gesture.client_id,
                op.client_tx_id,
                op.payload.plan,
                op.payload.expected_plan,
              ],
            );
          } catch (error) {
            report.plan_rpc_diagnostic = {
              code: error.code,
              message: error.message,
            };
          } finally {
            await db.query("rollback");
          }
        }
        assert(
          result.every((row) => row.status === "DONE"),
          JSON.stringify(result),
        );
        await pull(b.page);
        assert.equal(
          (await state(b.page)).plan?.revision,
          1,
          "B must parse the canonical transaction timestamp",
        );
        assert.equal(
          (
            await db.query(
              "select payload->>'unrelated' value from public.fazenda_sanidade_config where fazenda_id=$1",
              [farm],
            )
          ).rows[0].value,
          "preserved",
        );
      },
    );
    const generate = (page, date) =>
      page.evaluate(
        ({ farm, date }) =>
          window.cert.generator.generateSanitaryAutomaticAgendasV2({
            fazendaId: farm,
            referenceDate: date,
          }),
        { farm, date },
      );
    await check(
      "Offline automatic Agendas from A and B converge without duplicates across seven candidate items",
      async () => {
        await a.context.setOffline(true);
        await b.context.setOffline(true);
        const ga = await generate(a.page, "2026-05-15"),
          gb = await generate(b.page, "2026-05-15");
        report.generation_first = { a: ga, b: gb };
        assert.deepEqual(ga.failures, []);
        assert.deepEqual(gb.failures, []);
        assert(ga.created > 1);
        const idsA = (await state(a.page)).agendas.map((row) => row.id).sort(),
          idsB = (await state(b.page)).agendas.map((row) => row.id).sort();
        assert.deepEqual(idsA, idsB);
        // Older canonical queue entries lack the optional root farm field.
        // Their immutable UUIDs and trusted gesture farm must still work.
        await b.page.evaluate(async () => {
          await window.cert.db.queue_ops.toCollection().modify((op) => {
            if (op.record.command === "create_agenda")
              delete op.record.fazenda_id;
          });
        });
        await a.context.setOffline(false);
        await b.context.setOffline(false);
        const competing = await Promise.all([drain(a.page), drain(b.page)]);
        assert(
          competing.every((rows) => rows.every((row) => row.status === "DONE")),
          JSON.stringify(competing),
        );
        await pull(a.page);
        await pull(b.page);
        assert.deepEqual(
          (await state(a.page)).agendas,
          (await state(b.page)).agendas,
        );
        for (const date of ["2026-07-15", "2026-09-15"]) {
          const result = await generate(a.page, date);
          assert.deepEqual(result.failures, []);
          assert((await drain(a.page)).every((row) => row.status === "DONE"));
          await pull(b.page);
        }
        const remote = (
          await db.query(
            "select distinct catalog_protocol_item_version_v2_id id from public.sanitario_agenda_v2 where fazenda_id=$1",
            [farm],
          )
        ).rows
          .map((row) => row.id)
          .sort();
        report.automatically_generated_item_ids = remote;
        assert.deepEqual(remote, ready.map((row) => row.record.id).sort());
      },
    );
    const validCreation = await a.page.evaluate(() =>
      window.cert.lastSent.at(-1),
    );
    async function sendCreation(item, keepDedup = false) {
      const tx = randomUUID(),
        op = structuredClone(validCreation.ops[0]);
      assert.equal(op.command, "create_agenda");
      Object.assign(op, {
        client_op_id: randomUUID(),
        client_tx_id: tx,
        domain_op_id: randomUUID(),
      });
      op.payload.agenda.id = randomUUID();
      if (!keepDedup)
        op.payload.agenda.dedup_key = `forbidden-fixture:${randomUUID()}`;
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
    await check(
      "Another UUID cannot duplicate an existing automatic intent",
      async () => {
        const result = await sendCreation(null, true);
        assert.ifError(result.error);
        assert.equal(
          result.data.results[0].reason_code,
          "SANITARIO_AUTOMATIC_IDENTITY_CONFLICT",
        );
      },
    );
    await check(
      "All seven pending commercial items and all six protected items reject automatic creation",
      async () => {
        const blocked = [
          ...packet.prepared_item_records
            .filter((row) => !readySets.includes(row.decision_set))
            .map((row) => row.record),
          ...packet.retained_restricted_records,
        ];
        assert.equal(blocked.length, 13);
        for (const item of blocked) {
          const result = await sendCreation(item);
          assert.ifError(result.error);
          assert.equal(
            result.data.results[0].status,
            "REJECTED",
            item.logical_item_key,
          );
          assert.equal(
            result.data.results[0].reason_code,
            "SANITARIO_AUTOMATIC_RULE_NOT_APPROVED_OR_ACTIVATED",
            item.logical_item_key,
          );
        }
        report.restricted_automatic_creation_attempts_rejected = 13;
      },
    );
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
      "Reschedule, cancellation and reconnect converge; later generation does not recreate the same intent",
      async () => {
        const agenda = (await state(a.page)).agendas.find(
          (row) => row.metadata.automationKey && row.status === "programada",
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
        await generate(b.page, "2026-05-15");
        assert.equal(
          (await state(b.page)).agendas.filter(
            (row) => row.dedup_key === agenda.dedup_key,
          ).length,
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
    await check(
      "Concurrent farm plan revisions conflict; the rejected client receives the canonical version",
      async () => {
        await Promise.all([createPlan(a.page), createPlan(b.page)]);
        const ar = await drain(a.page),
          br = await drain(b.page);
        assert(ar.every((row) => row.status === "DONE"));
        assert(
          br.some((row) =>
            row.results?.some(
              (result) => result.reason === "SANITARIO_PLAN_REVISION_CONFLICT",
            ),
          ),
          JSON.stringify(br),
        );
        await pull(b.page);
        assert.equal((await state(b.page)).plan.revision, 2);
        const current = (
          await owner.client
            .from("fazenda_sanidade_config")
            .select("payload")
            .eq("fazenda_id", farm)
            .single()
        ).data.payload.sanitary_agenda_automation_v2;
        const wrongBase = structuredClone(current);
        wrongBase.context.sanitaryCadence = "annual";
        const tx = randomUUID(),
          operation = {
            domain: "sanitario_v2",
            command: "set_automation_plan",
            contract_version: 2,
            client_op_id: randomUUID(),
            client_tx_id: tx,
            domain_op_id: randomUUID(),
            expected_revision: 2,
            payload: {
              plan: { ...current, revision: 3 },
              expected_plan: wrongBase,
            },
          };
        const stale = await owner.client.functions.invoke("sync-batch", {
          body: {
            fazenda_id: farm,
            client_id: "synthetic-plan-content-conflict",
            client_tx_id: tx,
            ops: [operation],
          },
        });
        assert.ifError(stale.error);
        assert.equal(
          stale.data.results[0].reason_code,
          "SANITARIO_PLAN_REVISION_CONFLICT",
        );
      },
    );
    await check(
      "RLS denies another farm; direct plan overwrite cannot bypass the canonical writer",
      async () => {
        const outsiderRead = await outsider.client
          .from("fazenda_sanidade_config")
          .select("*")
          .eq("fazenda_id", farm);
        assert.ifError(outsiderRead.error);
        assert.equal(outsiderRead.data.length, 0);
        const actual = await owner.client
          .from("fazenda_sanidade_config")
          .select("payload")
          .eq("fazenda_id", farm)
          .single();
        assert.ifError(actual.error);
        const direct = await owner.client
          .from("fazenda_sanidade_config")
          .update({
            payload: {
              ...actual.data.payload,
              sanitary_agenda_automation_v2: {
                ...actual.data.payload.sanitary_agenda_automation_v2,
                enabled: false,
              },
            },
          })
          .eq("fazenda_id", farm);
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
        (select count(*)::int from public.sanitario_protocolo_itens_versions_v2 where allows_agenda_auto) authorized`,
            [farm],
          )
        ).rows[0];
        assert.deepEqual(counts, {
          facts: 0,
          details: 0,
          stock: 0,
          authorized: 7,
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
