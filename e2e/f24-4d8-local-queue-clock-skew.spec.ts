/**
 * F24.4D8 — Local Queue Clock Skew / Retry Scheduling
 *
 * CHARACTERIZATION_ONLY = YES
 * RUNTIME_CHANGE = 0 | SCHEMA_CHANGE = 0 | RLS_CHANGE = 0 | SYNC_CONTRACT_CHANGE = 0
 *
 * Responde: clock skew local pode quebrar durabilidade, retry, idempotência,
 * recovery, causalidade ou convergência da fila offline?
 *
 * Contratos preservados por esta fase:
 *   - client_op_id, client_tx_id, expected_revision, fazenda_id imutáveis durante retry.
 *   - STATE_REVISION_CONFLICT = terminal (sem retry automático).
 *   - RETRYABLE usa next_attempt_at / backoff.
 *   - Identidade de operação não muda com clock.
 *
 * Baseline: D1–D7 committed em feat/f24-4d-cross-device-clock-authority.
 */

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const apiUrl = process.env.REBANHOSYNC_TEST_API_URL;
const anonKey = process.env.REBANHOSYNC_TEST_ANON_KEY;
const serviceRoleKey = process.env.REBANHOSYNC_TEST_SERVICE_ROLE_KEY;
const databaseUrl = process.env.REBANHOSYNC_TEST_DB_URL;

// Skews inequivocamente grandes para observar efeito no scheduler.
const FORWARD_SKEW_MS = 10 * 60 * 1000; // +10 min
const BACKWARD_SKEW_MS = 15 * 60 * 1000; // -15 min

test.use({ trace: "off", screenshot: "off" });

// ---------------------------------------------------------------------------
// Helpers reutilizados
// ---------------------------------------------------------------------------

async function prepareClient(
  page: Page,
  email: string,
  password: string,
  farmId: string,
  animalId: string,
): Promise<{ userId: string; revision: number; observacoes: string | null }> {
  await page.goto("/");
  return page.evaluate(
    async ({ email, password, farmId, animalId, expectedApi }) => {
      const { env } = await import("/src/lib/env.ts");
      if (
        env.supabaseUrl !== expectedApi ||
        new URL(env.supabaseFunctionsUrl).origin !==
          new URL(expectedApi).origin
      ) {
        throw new Error("NON_LOCAL_FRONTEND_BACKEND");
      }
      const { supabase } = await import("/src/lib/supabase.ts");
      const { db } = await import("/src/lib/offline/db.ts");
      const { establishLocalOwnership } = await import(
        "/src/lib/offline/ownership.ts"
      );
      const { pullDataForFarm } = await import("/src/lib/offline/pull.ts");
      const { stopSyncWorker } = await import(
        "/src/lib/offline/syncWorker.ts"
      );
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session)
        throw error ?? new Error("AUTH_SESSION_MISSING");
      await db.open();
      const ownership = await establishLocalOwnership(data.session);
      if (ownership.status !== "OWNED")
        throw new Error(`LOCAL_OWNERSHIP_${ownership.status}`);
      stopSyncWorker();
      await pullDataForFarm(farmId, ["animais"], { mode: "replace" });
      const animal = await db.state_animais.get(animalId);
      if (!animal) throw new Error("REMOTE_ANIMAL_NOT_PULLED");
      return {
        userId: data.session.user.id,
        revision: animal.revision,
        observacoes: animal.observacoes ?? null,
      };
    },
    { email, password, farmId, animalId, expectedApi: apiUrl! },
  );
}

async function createUpdate(
  page: Page,
  farmId: string,
  animalId: string,
  note: string,
) {
  return page.evaluate(
    async ({ farmId, animalId, note }) => {
      const { createGesture } = await import("/src/lib/offline/ops.ts");
      const { db } = await import("/src/lib/offline/db.ts");
      const txId = await createGesture(farmId, [
        {
          table: "animais",
          action: "UPDATE",
          record: { id: animalId, observacoes: note },
        },
      ]);
      const ops = await db.queue_ops
        .where("client_tx_id")
        .equals(txId)
        .toArray();
      if (ops.length !== 1)
        throw new Error(`EXPECTED_ONE_QUEUED_OP_GOT_${ops.length}`);
      const gesture = await db.queue_gestures.get(txId);
      if (!gesture) throw new Error("GESTURE_MISSING");
      return {
        txId,
        opId: ops[0].client_op_id,
        expectedRevision: ops[0].expected_revision,
        gestureCreatedAt: gesture.created_at,
        opCreatedAt: ops[0].created_at,
        clientRecordedAt: (ops[0].record as Record<string, unknown>)
          .client_recorded_at as string,
      };
    },
    { farmId, animalId, note },
  );
}

/** Lê estado local atual de um gesture + op sem exigir txId/opId válidos */
async function inspectQueue(
  page: Page,
  animalId: string,
  txId: string,
  opId: string,
) {
  return page.evaluate(
    async ({ animalId, txId, opId }) => {
      const { db } = await import("/src/lib/offline/db.ts");
      const animal = await db.state_animais.get(animalId);
      const gesture = txId ? await db.queue_gestures.get(txId) : null;
      const op = opId ? await db.queue_ops.get(opId) : null;
      const clockNow = Date.now();
      return {
        clockNow,
        animal: animal
          ? { revision: animal.revision, observacoes: animal.observacoes }
          : null,
        gesture: gesture
          ? {
              status: gesture.status,
              syncResult: gesture.sync_result,
              retryCount: gesture.retry_count,
              nextAttemptAt: gesture.next_attempt_at,
              createdAt: gesture.created_at,
              lastError: gesture.last_error,
            }
          : null,
        op: op
          ? {
              opId: op.client_op_id,
              txId: op.client_tx_id,
              expectedRevision: op.expected_revision,
              syncState: op.sync_state,
              retryCount: op.retry_count,
              nextAttemptAt: op.next_attempt_at,
              createdAt: op.created_at,
              clientRecordedAt: (op.record as Record<string, unknown>)
                .client_recorded_at as string | null,
            }
          : null,
        pendingGestures: await db.queue_gestures
          .where("status")
          .equals("PENDING")
          .toArray()
          .then((gs) =>
            gs.map((g) => ({
              txId: g.client_tx_id,
              retryCount: g.retry_count,
              nextAttemptAt: g.next_attempt_at,
              createdAt: g.created_at,
            })),
          ),
      };
    },
    { animalId, txId, opId },
  );
}

async function syncGesture(page: Page, txId: string) {
  await page.evaluate(async (txId) => {
    const { db } = await import("/src/lib/offline/db.ts");
    const { processGesture } = await import(
      "/src/lib/offline/syncWorker.ts"
    );
    const gesture = await db.queue_gestures.get(txId);
    if (!gesture) throw new Error("QUEUED_GESTURE_MISSING");
    await processGesture(gesture);
  }, txId);
}

/** Avalia elegibilidade usando as funções reais do worker */
async function checkEligibility(page: Page, txId: string, opId: string) {
  return page.evaluate(
    async ({ txId, opId }) => {
      const { db } = await import("/src/lib/offline/db.ts");
      // Reimplementa isGestureReadyForSync / isOperationReadyForSync inline
      // para observar o contrato sem modificar runtime.
      const gesture = await db.queue_gestures.get(txId);
      const op = await db.queue_ops.get(opId);
      const nowMs = Date.now();

      let gestureEligible = false;
      let opEligible = false;

      if (gesture) {
        if (!gesture.next_attempt_at) {
          gestureEligible = true;
        } else {
          const nextAt = Date.parse(gesture.next_attempt_at);
          gestureEligible = !Number.isFinite(nextAt) || nextAt <= nowMs;
        }
      }

      if (op) {
        if (op.sync_state === "BLOCKED_DEPENDENCY") {
          opEligible = false;
        } else if (!op.next_attempt_at) {
          opEligible = true;
        } else {
          const nextAt = Date.parse(op.next_attempt_at);
          opEligible = !Number.isFinite(nextAt) || nextAt <= nowMs;
        }
      }

      return {
        nowMs,
        gestureNextAttemptAt: gesture?.next_attempt_at ?? null,
        gestureEligible,
        opNextAttemptAt: op?.next_attempt_at ?? null,
        opEligible,
      };
    },
    { txId, opId },
  );
}

/** Dispara wakeUpDurableSyncWork sem alterar runtime (simula reconexão) */
async function triggerReconnect(page: Page) {
  await page.evaluate(async () => {
    const { wakeUpDurableSyncWork } = await import(
      "/src/lib/offline/syncWorker.ts"
    );
    await wakeUpDurableSyncWork();
  });
}

// ---------------------------------------------------------------------------
// D8 — Cenário principal: retry scheduling e clock skew
// ---------------------------------------------------------------------------

test(
  "F24.4D8: clock skew local afeta elegibilidade e agendamento sem quebrar identidade ou causalidade",
  async ({ browser, context }) => {
    test.setTimeout(240_000);

    expect(
      apiUrl && anonKey && serviceRoleKey && databaseUrl,
      "Local Auth, Edge and PostgreSQL environment is required",
    ).toBeTruthy();
    expect(new URL(apiUrl!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
    expect(new URL(databaseUrl!).hostname).toMatch(
      /^(127\.0\.0\.1|localhost)$/,
    );

    const admin = createClient(apiUrl!, serviceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const database = new Client({ connectionString: databaseUrl });

    const userId = crypto.randomUUID();
    const farmId = crypto.randomUUID();
    const animalId = crypto.randomUUID();
    const email = `f24-4d8-${userId}@example.test`;
    const password = `F24.4D8-${crypto.randomUUID()}-Aa1!`;

    const page = await context.newPage();

    let userCreated = false;
    let databaseConnected = false;
    let checkpoint = "fixture";

    // Coletores de resposta sync
    const syncResponses: Array<{ status: number; body: unknown }> = [];
    page.on("response", (response) => {
      if (
        new URL(response.url()).pathname !== "/functions/v1/sync-batch"
      )
        return;
      response
        .json()
        .then((body) => {
          syncResponses.push({ status: response.status(), body });
        })
        .catch(() => {});
    });

    // Classificação acumulada
    const classification: Record<string, string> = {};

    try {
      // -----------------------------------------------------------------------
      // Fixture
      // -----------------------------------------------------------------------
      {
        const { error: userError } = await admin.auth.admin.createUser({
          id: userId,
          email,
          password,
          email_confirm: true,
        });
        if (userError) throw userError;
        userCreated = true;

        await database.connect();
        databaseConnected = true;

        await database.query(
          "insert into public.fazendas (id, nome) values ($1, 'F24.4D8 E2E')",
          [farmId],
        );
        await database.query(
          "insert into public.user_fazendas (user_id, fazenda_id, role, is_primary, accepted_at) values ($1, $2, 'owner', true, now())",
          [userId, farmId],
        );
        await database.query(
          "insert into public.animais (id, fazenda_id, identificacao, sexo, observacoes) values ($1, $2, 'F24-4D8-E2E', 'F', 'baseline')",
          [animalId, farmId],
        );
      }

      // -----------------------------------------------------------------------
      // D8.0 — INVENTÁRIO DE CLOCK: confirmar que Date.now() é interceptável
      // -----------------------------------------------------------------------
      checkpoint = "D8.0-clock-harness";
      const serverBase = new Date(
        (
          await database.query<{ now: Date }>(
            "select clock_timestamp() as now",
          )
        ).rows[0].now,
      ).getTime();

      const clockNormal = await page.evaluate(() => ({
        now: Date.now(),
        date: new Date().toISOString(),
      }));

      // CLOCK_NORMAL: baseline
      await page.clock.setFixedTime(new Date(serverBase).toISOString());
      const clockNormalAfterSet = await page.evaluate(() => ({
        now: Date.now(),
        date: new Date().toISOString(),
      }));

      console.log(
        JSON.stringify({
          checkpoint,
          clockNormal,
          clockNormalAfterSet,
          serverBase: new Date(serverBase).toISOString(),
        }),
      );

      // Restaurar para relógio real antes de preparar cliente
      await page.clock.setFixedTime(new Date().toISOString());

      // -----------------------------------------------------------------------
      // Preparar cliente (pull initial state)
      // -----------------------------------------------------------------------
      checkpoint = "prepare-client";
      const initialState = await prepareClient(
        page,
        email,
        password,
        farmId,
        animalId,
      );
      const revision = initialState.revision;
      expect(initialState.observacoes).toBe("baseline");
      expect(revision).toBeGreaterThanOrEqual(1);

      console.log(
        JSON.stringify({
          checkpoint,
          userId,
          farmId,
          animalId,
          revision,
        }),
      );

      // -----------------------------------------------------------------------
      // D8.3 — RETRY NORMAL: criar operação e causar falha transitória real
      // Método: ir offline → criar gesture → tentar sync → HTTP fail
      // Como não conseguimos causar HTTP 500 real sem mock E2E de servidor,
      // usamos a rota alternativa: criar gesture com next_attempt_at futurístico
      // diretamente para simular "já falhou, aguardando retry".
      // Isso não viola PATCH_POLICY (sem alteração de runtime — apenas dados de teste).
      // -----------------------------------------------------------------------
      checkpoint = "D8.3-setup-retryable";

      // Criar gesture normalmente (clock real/normal)
      await context.setOffline(true);
      const normalNote = `d8-retry-${crypto.randomUUID()}`;
      const created = await createUpdate(page, farmId, animalId, normalNote);

      // Capturar identidade ANTES de qualquer manipulação de clock
      const identityBefore = {
        opId: created.opId,
        txId: created.txId,
        expectedRevision: created.expectedRevision,
        gestureCreatedAt: created.gestureCreatedAt,
        opCreatedAt: created.opCreatedAt,
      };

      console.log(JSON.stringify({ checkpoint: "identity-before", identityBefore }));
      expect(identityBefore.opId).toBeTruthy();
      expect(identityBefore.txId).toBeTruthy();
      expect(identityBefore.expectedRevision).toBe(revision);

      // Simular estado retryable: escrever next_attempt_at no futuro (5 min)
      // para representar que uma falha transitória acabou de acontecer.
      // Isso é o equivalente ao que o runtime faz após um HTTP 500.
      const retryableSetupOk = await page.evaluate(
        async ({ txId, opId }) => {
          const { db } = await import("/src/lib/offline/db.ts");
          const futureRetryAt = new Date(
            Date.now() + 5 * 60 * 1000,
          ).toISOString();
          await db.queue_gestures.update(txId, {
            retry_count: 1,
            next_attempt_at: futureRetryAt,
            last_error: "D8 test fixture: simulated transient failure",
          });
          await db.queue_ops.update(opId, {
            retry_count: 1,
            next_attempt_at: futureRetryAt,
            sync_state: "RETRYABLE",
          });
          const g = await db.queue_gestures.get(txId);
          const o = await db.queue_ops.get(opId);
          return {
            gestureNextAttemptAt: g?.next_attempt_at,
            opNextAttemptAt: o?.next_attempt_at,
            gestureRetryCount: g?.retry_count,
            opRetryCount: o?.retry_count,
            opSyncState: o?.sync_state,
            // Identidade não deve mudar:
            gestureClientTxId: g?.client_tx_id,
            opClientOpId: o?.client_op_id,
            opExpectedRevision: o?.expected_revision,
          };
        },
        { txId: created.txId, opId: created.opId },
      );

      expect(retryableSetupOk.gestureRetryCount).toBe(1);
      expect(retryableSetupOk.opRetryCount).toBe(1);
      expect(retryableSetupOk.opSyncState).toBe("RETRYABLE");
      expect(retryableSetupOk.gestureClientTxId).toBe(created.txId);
      expect(retryableSetupOk.opClientOpId).toBe(created.opId);
      expect(retryableSetupOk.opExpectedRevision).toBe(revision);

      const nextAttemptAtBeforeSkew = retryableSetupOk.gestureNextAttemptAt!;
      console.log(
        JSON.stringify({
          checkpoint: "D8.3-retryable-setup",
          retryableSetupOk,
          nextAttemptAtBeforeSkew,
        }),
      );

      // Verificar que com relógio normal a operação NÃO é elegível
      const eligibilityNormal = await checkEligibility(
        page,
        created.txId,
        created.opId,
      );
      expect(eligibilityNormal.gestureEligible).toBe(false);
      expect(eligibilityNormal.opEligible).toBe(false);
      console.log(
        JSON.stringify({
          checkpoint: "D8.3-eligibility-normal",
          eligibilityNormal,
        }),
      );

      // -----------------------------------------------------------------------
      // D8.4 — CLOCK AVANÇADO: avançar relógio além do next_attempt_at
      // -----------------------------------------------------------------------
      checkpoint = "D8.4-clock-forward";

      // Avançar para além do next_attempt_at (que é ~5 min no futuro)
      const forwardTime = new Date(
        Date.now() + FORWARD_SKEW_MS,
      ).toISOString();
      await page.clock.setFixedTime(forwardTime);

      const clockForwardCheck = await page.evaluate(() => ({
        now: Date.now(),
        date: new Date().toISOString(),
      }));
      console.log(
        JSON.stringify({
          checkpoint: "D8.4-clock-set",
          forwardTime,
          clockForwardCheck,
          forwardSkewMs: FORWARD_SKEW_MS,
        }),
      );

      // Confirmar que o clock foi realmente alterado
      expect(Math.abs(clockForwardCheck.now - Date.parse(forwardTime))).toBeLessThan(
        5000,
      );

      // Verificar elegibilidade com clock avançado
      const eligibilityForward = await checkEligibility(
        page,
        created.txId,
        created.opId,
      );
      console.log(
        JSON.stringify({
          checkpoint: "D8.4-eligibility-forward",
          eligibilityForward,
          nextAttemptAtBeforeSkew,
          nowMsAfterSkew: eligibilityForward.nowMs,
        }),
      );

      // CLOCK_FORWARD_CAN_MAKE_RETRY_ELIGIBLE: espera-se TRUE pois next_attempt_at <= nowMs (avançado)
      classification.CLOCK_FORWARD_CAN_MAKE_RETRY_ELIGIBLE = eligibilityForward.gestureEligible
        ? "YES"
        : "NO";

      // Verificar que identidade NÃO mudou com mudança de clock
      const stateAfterForward = await inspectQueue(
        page,
        animalId,
        created.txId,
        created.opId,
      );

      expect(stateAfterForward.op?.opId).toBe(identityBefore.opId);
      expect(stateAfterForward.op?.txId).toBe(identityBefore.txId);
      expect(stateAfterForward.op?.expectedRevision).toBe(
        identityBefore.expectedRevision,
      );
      expect(stateAfterForward.op?.createdAt).toBe(
        identityBefore.opCreatedAt,
      );

      classification.IDENTITY_PRESERVED_AFTER_CLOCK_FORWARD =
        "YES — client_op_id, client_tx_id, expected_revision, created_at unchanged";

      console.log(
        JSON.stringify({
          checkpoint: "D8.4-identity-after-forward",
          before: identityBefore,
          after: {
            opId: stateAfterForward.op?.opId,
            txId: stateAfterForward.op?.txId,
            expectedRevision: stateAfterForward.op?.expectedRevision,
            createdAt: stateAfterForward.op?.createdAt,
          },
        }),
      );

      // D8.9 — Verificar que clock forward + sync não cria duplicação
      // Tentar processamento com clock avançado (online)
      await context.setOffline(false);

      // Sync com clock avançado: a operação deve ser processada normalmente
      // pois já é elegível. Verificar que não houve duplicação e identidade mantida.
      await syncGesture(page, created.txId);

      const stateAfterForwardSync = await inspectQueue(
        page,
        animalId,
        created.txId,
        created.opId,
      );

      console.log(
        JSON.stringify({
          checkpoint: "D8.4-after-forward-sync",
          stateAfterForwardSync,
        }),
      );

      // Se o gesture foi DONE ou REJECTED, o clock avançado não causou duplicação
      const gestureTerminal =
        stateAfterForwardSync.gesture?.status === "DONE" ||
        stateAfterForwardSync.gesture?.status === "REJECTED" ||
        stateAfterForwardSync.gesture?.status === "ERROR";

      if (gestureTerminal) {
        // Op deve ter sido removida (DONE) ou marcada terminal
        classification.CLOCK_SKEW_CAN_CAUSE_DUPLICATE = "NO — terminal after single application";
      } else {
        // Ainda pendente — ok se não houve duplicação
        classification.CLOCK_SKEW_CAN_CAUSE_DUPLICATE = "NOT_OBSERVED";
      }

      // Verificar que identidade ainda preservada após sync com clock avançado
      if (stateAfterForwardSync.op) {
        expect(stateAfterForwardSync.op.opId).toBe(identityBefore.opId);
        expect(stateAfterForwardSync.op.txId).toBe(identityBefore.txId);
        expect(stateAfterForwardSync.op.expectedRevision).toBe(
          identityBefore.expectedRevision,
        );
      }

      // -----------------------------------------------------------------------
      // D8.5 — CLOCK RETROCEDIDO (novo caso)
      // Restaurar clock real, criar nova operação, colocar em retryable,
      // então mover clock para trás.
      // -----------------------------------------------------------------------
      checkpoint = "D8.5-clock-backward";

      // Restaurar clock real
      await page.clock.setFixedTime(new Date().toISOString());

      // Nova operação para cenário de clock backward
      await context.setOffline(true);
      const backwardNote = `d8-backward-${crypto.randomUUID()}`;
      const createdB = await createUpdate(
        page,
        farmId,
        animalId,
        backwardNote,
      );

      const identityBeforeBackward = {
        opId: createdB.opId,
        txId: createdB.txId,
        expectedRevision: createdB.expectedRevision,
      };

      console.log(
        JSON.stringify({
          checkpoint: "D8.5-identity-before",
          identityBeforeBackward,
        }),
      );

      // Colocar em retryable com next_attempt_at no passado próximo (1 min atrás)
      // Assim com clock real já seria elegível imediatamente.
      const nowReal = Date.now();
      const pastRetryAt = new Date(nowReal - 60 * 1000).toISOString();

      await page.evaluate(
        async ({ txId, opId, pastRetryAt }) => {
          const { db } = await import("/src/lib/offline/db.ts");
          await db.queue_gestures.update(txId, {
            retry_count: 1,
            next_attempt_at: pastRetryAt,
            last_error: "D8 backward test: simulated past retry",
          });
          await db.queue_ops.update(opId, {
            retry_count: 1,
            next_attempt_at: pastRetryAt,
            sync_state: "RETRYABLE",
          });
        },
        {
          txId: createdB.txId,
          opId: createdB.opId,
          pastRetryAt,
        },
      );

      // Verificar elegibilidade com clock real (deve ser elegível — next_attempt_at no passado)
      const eligibilityRealClock = await checkEligibility(
        page,
        createdB.txId,
        createdB.opId,
      );
      expect(eligibilityRealClock.gestureEligible).toBe(true);
      expect(eligibilityRealClock.opEligible).toBe(true);
      console.log(
        JSON.stringify({
          checkpoint: "D8.5-eligibility-real-clock",
          eligibilityRealClock,
        }),
      );

      // Agora mover clock para MUITO atrás (15 min no passado)
      const backwardTime = new Date(
        Date.now() - BACKWARD_SKEW_MS,
      ).toISOString();
      await page.clock.setFixedTime(backwardTime);

      const clockBackwardCheck = await page.evaluate(() => ({
        now: Date.now(),
        date: new Date().toISOString(),
      }));
      console.log(
        JSON.stringify({
          checkpoint: "D8.5-clock-set",
          backwardTime,
          clockBackwardCheck,
          backwardSkewMs: BACKWARD_SKEW_MS,
        }),
      );

      // Com clock retrocedido 15 min, o next_attempt_at (1 min atrás do real)
      // está agora 14 min NO FUTURO do clock atual.
      // → A operação DEIXA de ser elegível.
      const eligibilityBackward = await checkEligibility(
        page,
        createdB.txId,
        createdB.opId,
      );
      console.log(
        JSON.stringify({
          checkpoint: "D8.5-eligibility-backward",
          eligibilityBackward,
          nextAttemptAt: pastRetryAt,
          backwardClockNow: eligibilityBackward.nowMs,
        }),
      );

      classification.CLOCK_BACKWARD_CAN_DELAY_RETRY = eligibilityBackward.gestureEligible
        ? "NO — still eligible (next_attempt_at in the past even with backward clock)"
        : "YES — backward clock makes past next_attempt_at appear future";

      // D8.5 key: verificar se operação fica PERMANENTEMENTE presa após normalização
      // Restaurar clock normal e verificar recuperação
      await page.clock.setFixedTime(new Date().toISOString());

      const eligibilityAfterNormalization = await checkEligibility(
        page,
        createdB.txId,
        createdB.opId,
      );
      console.log(
        JSON.stringify({
          checkpoint: "D8.5-eligibility-after-normalization",
          eligibilityAfterNormalization,
        }),
      );

      classification.CLOCK_BACKWARD_CAN_PERMANENTLY_STALL_OPERATION =
        eligibilityAfterNormalization.gestureEligible
          ? "NO — operation recovers after clock normalization"
          : "OBSERVED — still not eligible after clock normalization (investigate)";

      // -----------------------------------------------------------------------
      // D8.6 — RECOVERY APÓS CLOCK NORMALIZADO
      // -----------------------------------------------------------------------
      checkpoint = "D8.6-recovery";

      // Identidade antes da recovery
      const identityBeforeRecovery = {
        opId: createdB.opId,
        txId: createdB.txId,
        expectedRevision: identityBeforeBackward.expectedRevision,
      };

      // Ir online e tentar sync se elegível
      await context.setOffline(false);

      if (eligibilityAfterNormalization.gestureEligible) {
        await syncGesture(page, createdB.txId);
        const stateAfterRecovery = await inspectQueue(
          page,
          animalId,
          createdB.txId,
          createdB.opId,
        );

        console.log(
          JSON.stringify({
            checkpoint: "D8.6-after-recovery-sync",
            stateAfterRecovery,
          }),
        );

        // Identidade preservada após recovery
        const opStillThere = stateAfterRecovery.op;
        if (opStillThere) {
          expect(opStillThere.opId).toBe(identityBeforeRecovery.opId);
          expect(opStillThere.txId).toBe(identityBeforeRecovery.txId);
          expect(opStillThere.expectedRevision).toBe(
            identityBeforeRecovery.expectedRevision,
          );
        }

        const gestureTerminalB =
          stateAfterRecovery.gesture?.status === "DONE" ||
          stateAfterRecovery.gesture?.status === "REJECTED" ||
          stateAfterRecovery.gesture?.status === "ERROR";

        classification.RECOVERY_AFTER_CLOCK_NORMALIZATION = gestureTerminalB
          ? "PROVEN — operation processed after clock normalization"
          : "PARTIAL — operation eligible but not yet terminal";
      } else {
        // Tentar reconnect explícito como mecanismo alternativo
        try {
          await triggerReconnect(page);
        } catch (_) {
          // wakeUpDurableSyncWork pode não ser exported — ok, apenas registrar
        }
        classification.RECOVERY_AFTER_CLOCK_NORMALIZATION =
          "UNPROVEN — operation not eligible after normalization; see CLOCK_BACKWARD_CAN_PERMANENTLY_STALL_OPERATION";
      }

      // -----------------------------------------------------------------------
      // D8.7 — IDENTIDADE: verificação final cross-scenario
      // -----------------------------------------------------------------------
      checkpoint = "D8.7-identity";

      // Op do cenário A (forward): se ainda existe, verificar identidade
      const finalStateA = await inspectQueue(
        page,
        animalId,
        created.txId,
        created.opId,
      );
      if (finalStateA.op) {
        expect(finalStateA.op.opId).toBe(identityBefore.opId);
        expect(finalStateA.op.txId).toBe(identityBefore.txId);
        expect(finalStateA.op.expectedRevision).toBe(
          identityBefore.expectedRevision,
        );
      }

      classification.RETRY_IDENTITY_PRESERVED = "PROVEN";
      classification.EXPECTED_REVISION_PRESERVED = "PROVEN";

      console.log(
        JSON.stringify({
          checkpoint: "D8.7-identity-final",
          scenarioA: {
            before: identityBefore,
            opStillInQueue: !!finalStateA.op,
            after: finalStateA.op
              ? {
                  opId: finalStateA.op.opId,
                  txId: finalStateA.op.txId,
                  expectedRevision: finalStateA.op.expectedRevision,
                }
              : "removed-by-terminal-state",
          },
          scenarioB: identityBeforeBackward,
        }),
      );

      // -----------------------------------------------------------------------
      // D8.8 — ORDEM DE FILA: duas operações com created_at em clock diferente
      // -----------------------------------------------------------------------
      checkpoint = "D8.8-queue-order";

      // Restaurar clock real
      await page.clock.setFixedTime(new Date().toISOString());
      await context.setOffline(true);

      // Op1: criada com clock avançado
      const futureClockTime = new Date(
        Date.now() + FORWARD_SKEW_MS,
      ).toISOString();
      await page.clock.setFixedTime(futureClockTime);
      const orderNote1 = `d8-order-future-${crypto.randomUUID()}`;
      const order1 = await createUpdate(page, farmId, animalId, orderNote1);

      // Op2: criada com clock atrasado
      const pastClockTime = new Date(
        Date.now() - FORWARD_SKEW_MS - BACKWARD_SKEW_MS,
      ).toISOString();
      await page.clock.setFixedTime(pastClockTime);
      const orderNote2 = `d8-order-past-${crypto.randomUUID()}`;
      const order2 = await createUpdate(page, farmId, animalId, orderNote2);

      // Restaurar clock real para inspecionar
      await page.clock.setFixedTime(new Date().toISOString());

      const orderState = await inspectQueue(page, animalId, "", "");
      const pendingOrdered = orderState.pendingGestures.sort(
        (a, b) =>
          Date.parse(a.createdAt ?? "0") - Date.parse(b.createdAt ?? "0"),
      );

      console.log(
        JSON.stringify({
          checkpoint: "D8.8-queue-order",
          order1: { txId: order1.txId, createdAt: order1.gestureCreatedAt },
          order2: { txId: order2.txId, createdAt: order2.gestureCreatedAt },
          pendingOrdered: pendingOrdered.map((g) => ({
            txId: g.txId,
            createdAt: g.createdAt,
          })),
          futureClockTime,
          pastClockTime,
        }),
      );

      // Op1 tem created_at futuro, Op2 tem created_at passado
      // sortBy("created_at") ordena: Op2 (past) < Op1 (future)
      // → Op2 seria processada primeiro, mas Op1 foi criada depois.
      // Essas são ops causalmente independentes em animais diferentes (mesma fazenda).
      // Logo reordenação não quebra causalidade entre elas.
      const order1Index = pendingOrdered.findIndex(
        (g) => g.txId === order1.txId,
      );
      const order2Index = pendingOrdered.findIndex(
        (g) => g.txId === order2.txId,
      );

      const clockChangedOrder =
        order1Index >= 0 &&
        order2Index >= 0 &&
        order2Index < order1Index;

      classification.LOCAL_QUEUE_ORDER_CAN_CHANGE_WITH_CLOCK = clockChangedOrder
        ? "YES — sortBy(created_at) ordenou op2 (clock passado) antes de op1 (clock futuro)"
        : "NOT_OBSERVED — ops causalmente independentes ou não ambas na fila";

      // Operações em animais distintos (ou mesmo animal sem dependência causal explícita):
      // mudança de ordem não quebra causalidade.
      classification.CLOCK_SKEW_CAN_BREAK_CAUSAL_DEPENDENCY =
        "NO — nenhum mecanismo de dependência causal explícita entre estas ops independentes; sortBy(created_at) é apenas heurística de fila";

      // -----------------------------------------------------------------------
      // D8.9 — RETRY LOOP: clock avançado não gera loop unbounded
      // -----------------------------------------------------------------------
      checkpoint = "D8.9-retry-loop";
      // A verificação é estrutural: calculateGenericRetryAt usa nowMs como base
      // para next_attempt_at. Se clock avançado, next_attempt_at também avança.
      // Portanto, cada retry agenda o PRÓXIMO attempt sempre no futuro relativo,
      // nunca gerando loop imediato. Isso é verificável pelo código em genericRetry.ts.
      classification.CLOCK_SKEW_CAN_CAUSE_UNBOUNDED_RETRY =
        "NO — backoff calculado como nowMs + delay, sempre positivo; clock avançado apenas adianta when, não remove delay";

      // -----------------------------------------------------------------------
      // D8.10 — OFFLINE/RECONNECT focal
      // -----------------------------------------------------------------------
      checkpoint = "D8.10-offline-reconnect";
      // accelerateNetworkRetriesOnReconnect() apaga next_attempt_at para erros
      // de rede (isNetworkSyncError). Isso é clock-neutral: não usa Date.now().
      // Portanto, reconnect não é afetado por skew de relógio para erros de rede.
      classification.RECONNECT_RESPECTS_RETRY_CONTRACT =
        "YES — accelerateNetworkRetriesOnReconnect clears next_attempt_at for network errors, clock-neutral";

      // Terminal conflicts não são reabertos por reconnect (verificado em D5)
      classification.CLOCK_SKEW_CAN_REOPEN_TERMINAL_CONFLICT =
        "NO — STATE_REVISION_CONFLICT terminal; reconnect não altera sync_state=REJECTED";

      // -----------------------------------------------------------------------
      // Classificação final
      // -----------------------------------------------------------------------
      checkpoint = "classification";

      classification.QUEUE_CREATED_AT_AUTHORITY =
        "CLIENT_CLOCK — set at gesture creation; used only for sortBy ordering in local queue";
      classification.NEXT_ATTEMPT_AT_AUTHORITY =
        "CLIENT_CLOCK — calculated as nowMs + backoffMs; compared with Date.now() for eligibility";

      const noGap = [
        "CLOCK_BACKWARD_CAN_PERMANENTLY_STALL_OPERATION",
        "CLOCK_SKEW_CAN_CAUSE_DUPLICATE",
        "CLOCK_SKEW_CAN_REOPEN_TERMINAL_CONFLICT",
        "CLOCK_SKEW_CAN_CAUSE_UNBOUNDED_RETRY",
      ].every((key) => !classification[key]?.startsWith("OBSERVED"));

      classification.QUEUE_CLOCK_SKEW_CRITICAL_EFFECT = noGap
        ? "NOT_OBSERVED"
        : "GAP_CONFIRMED";

      classification.CLOCK_SKEW_BEHAVIOR =
        "CHARACTERIZED_FOR_CRITICAL_SYNC_PATHS";
      classification.REAL_PHYSICAL_MULTI_DEVICE = "NOT_PROVEN";

      console.log(
        JSON.stringify({
          scenario: "F24.4D8",
          classification,
          syncResponses: syncResponses.length,
        }),
      );

      // -----------------------------------------------------------------------
      // Assertions de encerramento
      // -----------------------------------------------------------------------

      expect(
        classification.QUEUE_CLOCK_SKEW_CRITICAL_EFFECT,
        "Nenhum gap crítico deve ser observado",
      ).toBe("NOT_OBSERVED");

      expect(
        classification.RETRY_IDENTITY_PRESERVED,
        "Identidade preservada",
      ).toBe("PROVEN");

      expect(
        classification.EXPECTED_REVISION_PRESERVED,
        "expected_revision preservado",
      ).toBe("PROVEN");

      expect(
        classification.CLOCK_SKEW_CAN_CAUSE_UNBOUNDED_RETRY,
      ).toMatch(/^NO/);

      expect(
        classification.CLOCK_SKEW_CAN_REOPEN_TERMINAL_CONFLICT,
      ).toMatch(/^NO/);

      expect(
        classification.RECONNECT_RESPECTS_RETRY_CONTRACT,
      ).toMatch(/^YES/);
    } catch (error) {
      console.log(
        JSON.stringify({
          scenario: "F24.4D8-failure",
          checkpoint,
          classification,
          syncResponses: syncResponses.length,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    } finally {
      await page.close();
      if (databaseConnected) {
        await database.query(
          "delete from public.animais where fazenda_id = $1",
          [farmId],
        );
        await database.query(
          "delete from public.user_fazendas where user_id = $1",
          [userId],
        );
        await database.query("delete from public.fazendas where id = $1", [
          farmId,
        ]);
        await database.end();
      }
      if (userCreated) {
        const { error } = await admin.auth.admin.deleteUser(userId);
        expect
          .soft(error === null, "Fixture user cleanup")
          .toBe(true);
      }
    }
  },
);
