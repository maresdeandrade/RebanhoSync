import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildInternalErrorResult,
  buildMutationMatch,
  inferAgendaSourceTaskIdForEventInsert,
  isPersistedOperationReplay,
  normalizeDbError,
  resolveOperationPrimaryKey,
  type Operation,
  prevalidateAntiTeleport,
  readLinkedReproductionType,
  readReproductionPayload,
  sameSanitarioInventoryMovement,
  validateSanitarioAgendaClosurePush,
  validateSanitarioInventoryMovementRecord,
  validateSanitarioInventoryMovementSource,
} from "./rules.ts";
import { resolveEventFeatureFlags } from "./flags.ts";
import { validateAnimalTaxonomyFactsOperation } from "./taxonomy.ts";
import {
  executeSanitarioSyncV2Operation,
  isSanitarioSyncV2Operation,
  sanitarioSyncV2DependencyBlocked,
  sanitarioSyncV2EnvelopeRejected,
  type SanitarioSyncV2Gate,
  type SanitarioSyncV2Operation,
  validateSanitarioSyncV2Envelope,
  validateSanitaryCorrectionSourceConsistency,
} from "./sanitario-v2.ts";
import {
  validateSanitaryProductEvidenceCatalog,
  validateSanitaryProductEvidenceShape,
} from "./sanitary-product-evidence.ts";
import { normalizeTableMutationRecord } from "../_shared/mutationRecord.ts";
import {
  isSanitarioInventoryMovementOperation,
  resolveSanitarioInventoryFactualDependency,
} from "./inventory-dependency.ts";
import {
  findSyncedReproductionDetailForEvent,
  isAppliedResult,
  isBirthAgendaOperation,
  isBirthCalfOperation,
  isSyncedReproductionDetailOperation,
  readAgendaBirthEventId,
  readBirthEventId,
  resolveReproductionDiagnosisDependency,
  sameReproductionDiagnosisRecord,
  validateOptionalReproductionEpisode,
  validatePregnancyDiagnosis,
  validateReproductionCorrection,
} from "./reproduction-diagnosis.ts";
import {
  type CommercialPurchaseOperation,
  executeCommercialPurchaseOperation,
  isCommercialPurchaseOperation,
} from "./commercial-purchase.ts";
import {
  type CommercialOperationV2,
  executeCommercialOperationV2,
  isCommercialOperationV2,
} from "./commercial-operation-v2.ts";

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
  Deno.env.get("APP_ORIGIN") || "",
];

function isAllowedDevOrigin(origin: string) {
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function getCorsHeaders(origin: string | null) {
  let allowOrigin = allowedOrigins[0];
  if (origin) {
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith(".vercel.app") ||
      isAllowedDevOrigin(origin)
    ) {
      allowOrigin = origin;
    }
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("SANITARIO_RPC_TIMEOUT")),
      timeoutMs,
    );
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[sync-batch] Request received");

    // Validate and extract JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    console.log("[sync-batch] Authorization header present:", !!authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[sync-batch] Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - missing JWT" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const jwt = authHeader.slice("Bearer ".length).trim();
    console.log("[sync-batch] JWT extracted, length:", jwt.length);

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid JWT" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate JWT signature and claims against GoTrue.
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(jwt);

    if (authError || !user) {
      console.error("[sync-batch] JWT validation failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid JWT" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const user_id = user.id;
    console.log(`[sync-batch] JWT validated for user ${user_id}`);

    // Create user-scoped client with JWT (RLS enforced by user context).
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: `Bearer ${jwt}` },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    console.log("[sync-batch] Supabase client created");

    const {
      client_id,
      fazenda_id,
      client_tx_id,
      ops: rawOps,
    } = await req.json();
    const ops: Array<
      | Operation
      | SanitarioSyncV2Operation
      | CommercialPurchaseOperation
      | CommercialOperationV2
    > = Array.isArray(rawOps) ? rawOps : [];
    console.log(
      `[sync-batch] Processing TX ${client_tx_id} for farm ${fazenda_id}`,
    );

    const hasSanitarioSyncV2Operations = ops.some(isSanitarioSyncV2Operation);
    const sanitarioEnvelopeIssue = hasSanitarioSyncV2Operations
      ? validateSanitarioSyncV2Envelope({
          fazendaId: fazenda_id,
          clientId: client_id,
          clientTxId: client_tx_id,
        })
      : null;
    if (sanitarioEnvelopeIssue) {
      return new Response(
        JSON.stringify({
          client_tx_id,
          results: ops.map((op) =>
            isSanitarioSyncV2Operation(op)
              ? sanitarioSyncV2EnvelopeRejected(op, sanitarioEnvelopeIssue)
              : {
                  op_id: op.client_op_id,
                  status: "REJECTED",
                  reason_code: sanitarioEnvelopeIssue,
                },
          ),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // P0: Verify user has membership in this fazenda (using user client)
    const { data: membership, error: membershipError } = await supabase
      .from("user_fazendas")
      .select("role")
      .eq("user_id", user_id)
      .eq("fazenda_id", fazenda_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (membershipError || !membership) {
      console.error(
        `[sync-batch] User ${user_id} has no membership in farm ${fazenda_id}`,
      );
      return new Response(
        JSON.stringify({ error: "Forbidden - no access to this farm" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`[sync-batch] User has role: ${membership.role}`);

    const hasSanitarioInventoryMovements = ops.some(
      (op) =>
        !isCommercialPurchaseOperation(op) &&
        !isCommercialOperationV2(op) &&
        isSanitarioInventoryMovementOperation(op),
    );
    const serviceRoleKey =
      hasSanitarioSyncV2Operations || hasSanitarioInventoryMovements
        ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
        : null;
    const serviceSupabase = serviceRoleKey
      ? createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
      : null;

    const { data: fazendaConfig, error: fazendaConfigError } = await supabase
      .from("fazendas")
      .select("metadata")
      .eq("id", fazenda_id)
      .maybeSingle();

    if (fazendaConfigError) {
      console.warn(
        `[sync-batch] Could not load fazenda.metadata for ${fazenda_id}. Falling back to strict defaults.`,
        fazendaConfigError.message,
      );
    }

    const featureFlags = resolveEventFeatureFlags(fazendaConfig?.metadata);
    console.log(
      `[sync-batch] Feature flags strict_rules_enabled=${featureFlags.strictRulesEnabled} strict_anti_teleporte=${featureFlags.strictAntiTeleport}`,
    );

    const legacyOps = ops.filter(
      (op): op is Operation =>
        !isSanitarioSyncV2Operation(op) &&
        !isCommercialPurchaseOperation(op) &&
        !isCommercialOperationV2(op),
    );
    if (featureFlags.strictAntiTeleport) {
      const anti = prevalidateAntiTeleport(legacyOps);
      if (!anti.ok) {
        // Abort entire batch (atomicity: reject all ops if anti-teleport fails)
        return new Response(
          JSON.stringify({
            results: ops.map((o) => ({
              op_id: o.client_op_id,
              status: "REJECTED",
              reason_code: anti.reason_code,
              reason_message: anti.reason_message,
            })),
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }
    } else {
      console.warn(
        `[sync-batch] strict_anti_teleporte disabled for farm ${fazenda_id} - skipping anti-teleport prevalidation`,
      );
    }

    // P0: Ready to process operations (user authenticated + authorized)
    // Define security boundaries
    const BLOCKED_TABLES = new Set([
      "user_fazendas", // Membership only via security definer RPC
      "user_profiles", // Self-only via RLS
      "user_settings", // Self-only via RLS
    ]);

    const TABLES_WITH_FAZENDA = new Set([
      "animais",
      "lotes",
      "pastos",
      "agenda_itens",
      "eventos",
      "contrapartes",
      "protocolos_sanitarios",
      "protocolos_sanitarios_itens",
      "fazenda_sanidade_config",
      "sanitario_casos",
      "insumos",
      "insumo_apresentacoes",
      "insumo_lotes",
      "insumo_movimentacoes",
      "eventos_sanitario",
      "eventos_pesagem",
      "eventos_nutricao",
      "eventos_movimentacao",
      "eventos_reproducao",
      "eventos_financeiro",
      "eventos_ecc",
      "eventos_comercial",
      "finance_categories",
      "finance_transactions",
      "sociedades_pecuarias",
      "sociedade_animais",
      "sanitario_agenda_v2",
      "sanitario_agenda_animais_v2",
      "sanitario_agenda_closures_v2",
    ]);

    const results = [];
    const recomputeTablesTouched = new Set<string>();

    for (const rawOp of ops) {
      try {
        if (isCommercialOperationV2(rawOp)) {
          results.push(
            await executeCommercialOperationV2(supabase, rawOp, {
              fazendaId: fazenda_id,
              clientTxId: client_tx_id,
            }),
          );
          continue;
        }
        if (isCommercialPurchaseOperation(rawOp)) {
          results.push(
            await executeCommercialPurchaseOperation(supabase, rawOp, {
              fazendaId: fazenda_id,
              clientTxId: client_tx_id,
            }),
          );
          continue;
        }
        if (isSanitarioSyncV2Operation(rawOp)) {
          if (!serviceSupabase) {
            results.push(sanitarioSyncV2DependencyBlocked(rawOp));
            continue;
          }

          const sanitarioResult = await executeSanitarioSyncV2Operation(
            rawOp,
            {
              actorUserId: user_id,
              fazendaId: fazenda_id,
              clientId: client_id,
              clientTxId: client_tx_id,
              membershipRole: membership.role,
            },
            {
              loadGate: async (trustedFazendaId) => {
                const { data, error } = await serviceSupabase
                  .from("sanitario_sync_v2_gates")
                  .select(
                    "enabled, minimum_contract_version, maximum_contract_version, allowed_user_ids, allowed_client_ids, rollout_percentage, valid_from, valid_until",
                  )
                  .eq("fazenda_id", trustedFazendaId)
                  .maybeSingle();
                return {
                  data: data as SanitarioSyncV2Gate | null,
                  error,
                };
              },
              validateProductEvidence: async (operation, trustedFazendaId) => {
                const shapeIssue = validateSanitaryProductEvidenceShape({
                  event: operation.payload.event as unknown as Record<
                    string,
                    unknown
                  >,
                  detail: operation.payload.detail as unknown as Record<
                    string,
                    unknown
                  >,
                  eventAnimals: operation.payload.event_animals,
                });
                if (shapeIssue) return { reasonCode: shapeIssue, error: null };
                const correctionPayload = operation.payload.event.payload
                  ?.sanitary_correction as Record<string, unknown> | undefined;
                const validatesTechnicalCorrection =
                  operation.payload.event.natureza === "correction" &&
                  correctionPayload?.technical_correction === true;
                if (operation.payload.event.natureza === "correction") {
                  const correctedEventId = operation.payload.event
                    .corrige_evento_id as string;
                  const [
                    { data: sourceEvent, error: sourceEventError },
                    { data: sourceDetail, error: sourceDetailError },
                    { data: sourceAnimals, error: sourceAnimalsError },
                  ] = await Promise.all([
                    serviceSupabase
                      .from("eventos")
                      .select("id, animal_id, lote_id, payload")
                      .eq("fazenda_id", trustedFazendaId)
                      .eq("id", correctedEventId)
                      .is("deleted_at", null)
                      .maybeSingle(),
                    serviceSupabase
                      .from("eventos_sanitario")
                      .select(
                        "tipo, produto_sanitario_v2_id, insumo_id, estoque_lote_id, produto_nome_snapshot, produto_snapshot, estoque_lote_codigo_snapshot, lote_fabricante, validade_produto, dose_quantidade, dose_unidade, via_aplicacao, responsavel_nome, responsavel_tipo, custo_unitario_snapshot, custo_total_snapshot",
                      )
                      .eq("fazenda_id", trustedFazendaId)
                      .eq("evento_id", correctedEventId)
                      .is("deleted_at", null)
                      .maybeSingle(),
                    serviceSupabase
                      .from("eventos_animais")
                      .select("animal_id")
                      .eq("fazenda_id", trustedFazendaId)
                      .eq("evento_id", correctedEventId),
                  ]);
                  const sourceError =
                    sourceEventError ?? sourceDetailError ?? sourceAnimalsError;
                  if (sourceError) {
                    return { reasonCode: null, error: sourceError };
                  }
                  const sourceIssue =
                    validateSanitaryCorrectionSourceConsistency({
                      operation,
                      sourceEvent: sourceEvent as Record<
                        string,
                        unknown
                      > | null,
                      sourceDetail: sourceDetail as Record<
                        string,
                        unknown
                      > | null,
                      sourceAnimalIds: (sourceAnimals ?? []).map((entry) =>
                        String((entry as Record<string, unknown>).animal_id),
                      ),
                    });
                  if (sourceIssue) {
                    return { reasonCode: sourceIssue, error: null };
                  }
                }
                if (
                  (operation.payload.event.natureza !== "primary_execution" &&
                    !validatesTechnicalCorrection) ||
                  !operation.payload.detail.produto_sanitario_v2_id
                )
                  return { reasonCode: null, error: null };

                const { data: replay, error: replayError } =
                  await serviceSupabase
                    .from("sanitario_sync_v2_operations")
                    .select("id")
                    .eq("fazenda_id", trustedFazendaId)
                    .eq("operation_kind", "factual_core")
                    .or(
                      `client_op_id.eq.${operation.client_op_id},domain_op_id.eq.${operation.domain_op_id}`,
                    )
                    .limit(1)
                    .maybeSingle();
                if (replayError) {
                  return { reasonCode: null, error: replayError };
                }
                if (replay) return { reasonCode: null, error: null };

                const snapshot = operation.payload.detail
                  .produto_snapshot as Record<string, unknown>;
                const evidence = Array.isArray(snapshot.fieldEvidence)
                  ? snapshot.fieldEvidence
                  : [];
                const covered = evidence.filter(
                  (entry) =>
                    typeof entry === "object" &&
                    entry !== null &&
                    (entry as Record<string, unknown>).coverageStatus ===
                      "covers",
                ) as Record<string, unknown>[];
                const withdrawalSnapshot = snapshot.withdrawalSnapshot as
                  | Record<string, unknown>
                  | undefined;
                const withdrawalResults = Array.isArray(
                  withdrawalSnapshot?.results,
                )
                  ? (withdrawalSnapshot.results.filter((entry) => {
                      const state = (entry as Record<string, unknown>)?.state;
                      return (
                        typeof entry === "object" &&
                        entry !== null &&
                        [
                          "calculated",
                          "explicit_absence",
                          "not_permitted",
                        ].includes(String(state))
                      );
                    }) as Record<string, unknown>[])
                  : [];
                const sourceIds = [
                  ...new Set(
                    [...covered, ...withdrawalResults]
                      .map(
                        (entry) =>
                          (entry.sourceRef as Record<string, unknown> | null)
                            ?.id,
                      )
                      .filter((id): id is string => typeof id === "string"),
                  ),
                ];
                const coverageIds = [
                  ...new Set(
                    [...covered, ...withdrawalResults]
                      .map((entry) => entry.sourceCoverageId)
                      .filter((id): id is string => typeof id === "string"),
                  ),
                ];
                const doseRuleIds = [
                  ...new Set(
                    covered
                      .map(
                        (entry) =>
                          (
                            entry.technicalValue as Record<
                              string,
                              unknown
                            > | null
                          )?.doseRuleId,
                      )
                      .filter((id): id is string => typeof id === "string"),
                  ),
                ];
                const authorizationIds = [
                  ...new Set(
                    covered
                      .map(
                        (entry) =>
                          (
                            entry.technicalValue as Record<
                              string,
                              unknown
                            > | null
                          )?.authorizationId,
                      )
                      .filter((id): id is string => typeof id === "string"),
                  ),
                ];
                const withdrawalRuleIds = [
                  ...new Set(
                    withdrawalResults
                      .map((entry) => entry.ruleId)
                      .filter((id): id is string => typeof id === "string"),
                  ),
                ];
                const animalIds = operation.payload.event_animals.map(
                  (entry) => entry.animal_id,
                );
                const productId =
                  operation.payload.detail.produto_sanitario_v2_id;
                const empty = Promise.resolve({ data: [], error: null });
                const [
                  productResult,
                  sourcesResult,
                  coveragesResult,
                  linksResult,
                  doseRulesResult,
                  withdrawalRulesResult,
                  withdrawalRuleSourcesResult,
                  authorizationsResult,
                  animalsResult,
                ] = await Promise.all([
                  serviceSupabase
                    .from("sanitario_produtos_v2")
                    .select("*")
                    .eq("id", productId)
                    .maybeSingle(),
                  sourceIds.length
                    ? serviceSupabase
                        .from("sanitario_fontes_tecnicas_v2")
                        .select("*")
                        .in("id", sourceIds)
                    : empty,
                  coverageIds.length
                    ? serviceSupabase
                        .from("sanitario_fonte_cobertura_campos_v2")
                        .select("*")
                        .in("id", coverageIds)
                    : empty,
                  sourceIds.length
                    ? serviceSupabase
                        .from("sanitario_produto_fontes_v2")
                        .select("*")
                        .eq("product_id", productId)
                        .in("source_id", sourceIds)
                    : empty,
                  doseRuleIds.length
                    ? serviceSupabase
                        .from("sanitario_produto_dose_rules_v2")
                        .select("*")
                        .in("id", doseRuleIds)
                    : empty,
                  withdrawalRuleIds.length
                    ? serviceSupabase
                        .from("sanitario_produto_carencia_rules_v2")
                        .select("*")
                        .in("id", withdrawalRuleIds)
                    : empty,
                  withdrawalRuleIds.length
                    ? serviceSupabase
                        .from("sanitario_produto_carencia_fontes_v2")
                        .select("*")
                        .in("withdrawal_rule_id", withdrawalRuleIds)
                    : empty,
                  authorizationIds.length
                    ? serviceSupabase
                        .from("sanitario_produto_especie_autorizacao_v2")
                        .select("*")
                        .in("id", authorizationIds)
                    : empty,
                  serviceSupabase
                    .from("animais")
                    .select("id, fazenda_id, especie")
                    .eq("fazenda_id", trustedFazendaId)
                    .in("id", animalIds),
                ]);
                const lookupError = [
                  productResult,
                  sourcesResult,
                  coveragesResult,
                  linksResult,
                  doseRulesResult,
                  withdrawalRulesResult,
                  withdrawalRuleSourcesResult,
                  authorizationsResult,
                  animalsResult,
                ]
                  .map((result) => result.error)
                  .find(Boolean);
                if (lookupError) {
                  return { reasonCode: null, error: lookupError };
                }
                return {
                  reasonCode: validateSanitaryProductEvidenceCatalog(
                    snapshot,
                    trustedFazendaId,
                    {
                      product: productResult.data as Record<
                        string,
                        unknown
                      > | null,
                      sources: (sourcesResult.data ?? []) as Record<
                        string,
                        unknown
                      >[],
                      coverages: (coveragesResult.data ?? []) as Record<
                        string,
                        unknown
                      >[],
                      productSources: (linksResult.data ?? []) as Record<
                        string,
                        unknown
                      >[],
                      doseRules: (doseRulesResult.data ?? []) as Record<
                        string,
                        unknown
                      >[],
                      withdrawalRules: (withdrawalRulesResult.data ??
                        []) as Record<string, unknown>[],
                      withdrawalRuleSources:
                        (withdrawalRuleSourcesResult.data ?? []) as Record<
                          string,
                          unknown
                        >[],
                      speciesAuthorizations: (authorizationsResult.data ??
                        []) as Record<string, unknown>[],
                      animals: (animalsResult.data ?? []) as Record<
                        string,
                        unknown
                      >[],
                    },
                  ),
                  error: null,
                };
              },
              callRpc: async ({ functionName, args }) => {
                return await withTimeout(
                  serviceSupabase.rpc(functionName, args),
                  12_000,
                );
              },
            },
          );
          results.push(sanitarioResult);
          continue;
        }

        const op = rawOp as Operation;
        // P0: Block sensitive tables
        if (BLOCKED_TABLES.has(op.table)) {
          console.warn(`[sync-batch] Blocked table: ${op.table}`);
          results.push({
            op_id: op.client_op_id,
            status: "REJECTED",
            reason_code: "SECURITY_BLOCKED_TABLE",
            reason_message: `Table ${op.table} cannot be modified via sync`,
          });
          continue;
        }

        // P0: Force tenant consistency (server is authoritative)
        const record = normalizeTableMutationRecord(
          op.table,
          { ...op.record },
          TABLES_WITH_FAZENDA.has(op.table) ? fazenda_id : undefined,
        );
        if (TABLES_WITH_FAZENDA.has(op.table)) {
          record.fazenda_id = fazenda_id; // Always use request fazenda_id
        }

        const primaryKey = resolveOperationPrimaryKey({ ...op, record });
        if (primaryKey) {
          let replayQuery = supabase
            .from(op.table)
            .select("*")
            .eq(primaryKey.field, primaryKey.value);
          if (TABLES_WITH_FAZENDA.has(op.table)) {
            replayQuery = replayQuery.eq("fazenda_id", fazenda_id);
          }
          const { data: existingOperation, error: replayLookupError } =
            await replayQuery.maybeSingle();

          if (replayLookupError) {
            results.push({
              op_id: op.client_op_id,
              status: "RETRYABLE",
              retryable: true,
              reason_code: "OPERATION_REPLAY_LOOKUP_FAILED",
              reason_message: replayLookupError.message,
            });
            continue;
          }

          if (
            existingOperation &&
            isPersistedOperationReplay(
              existingOperation as Record<string, unknown>,
              op,
              client_tx_id,
            )
          ) {
            results.push({ op_id: op.client_op_id, status: "APPLIED" });
            continue;
          }

          if (existingOperation && op.action === "INSERT") {
            results.push({
              op_id: op.client_op_id,
              status: "REJECTED",
              reason_code: "OPERATION_IDENTITY_CONFLICT",
              reason_message:
                "Primary key already exists with different operation identity",
            });
            continue;
          }
        }

        if (op.table === "finance_categories" && op.action === "INSERT") {
          const { data: existingCat, error: existingCatError } = await supabase
            .from("finance_categories")
            .select("id, slug, is_default, tipo, grupo, ativo")
            .eq("fazenda_id", fazenda_id)
            .eq("slug", record.slug)
            .maybeSingle();

          if (existingCatError) {
            results.push({
              op_id: op.client_op_id,
              status: "RETRYABLE",
              retryable: true,
              reason_code: "FINANCE_CATEGORY_LOOKUP_FAILED",
              reason_message: existingCatError.message,
            });
            continue;
          }

          if (existingCat) {
            const incomingId = record.id;
            const incomingIsDefault = record.is_default;

            // Se o slug já existe, validamos a colisão.
            // Se for a mesma categoria canônica default (mesmo ID e is_default=true)
            if (existingCat.id === incomingId && existingCat.is_default === true && incomingIsDefault === true) {
              results.push({
                op_id: op.client_op_id,
                status: "APPLIED_ALTERED",
                altered: { dedup: "collision_noop" },
              });
              continue;
            }

            // Qualquer outra divergência de ID para o mesmo slug, ou se não for default
            results.push({
              op_id: op.client_op_id,
              status: "CONFLICT",
              reason_code: "finance_category_slug_already_exists",
              reason_message: "Categoria com o mesmo slug já existe com identidade ou contrato divergente.",
            });
            continue;
          }
        }

        const sanitaryMovementIssue = validateSanitarioInventoryMovementRecord(
          op,
          fazenda_id,
        );
        if (sanitaryMovementIssue) {
          results.push({
            op_id: op.client_op_id,
            client_op_id: op.client_op_id,
            domain_op_id:
              typeof op.record?.domain_op_id === "string"
                ? op.record.domain_op_id
                : undefined,
            status: "REJECTED",
            reason_code: sanitaryMovementIssue,
            reason_message:
              "Sanitary inventory movement failed conservative validation",
          });
          continue;
        }

        if (
          op.table === "insumo_movimentacoes" &&
          op.action === "INSERT" &&
          record.tipo === "consumo_sanitario"
        ) {
          const sourceEventId = String(record.source_evento_id);
          if (!serviceSupabase) {
            results.push({
              op_id: op.client_op_id,
              client_op_id: op.client_op_id,
              domain_op_id: String(record.domain_op_id),
              status: "BLOCKED_DEPENDENCY",
              reason_code: "SANITARIO_INVENTORY_LEDGER_UNAVAILABLE",
              reason_message:
                "Sanitary factual ledger is unavailable for inventory validation",
            });
            continue;
          }

          const dependencyDecision =
            await resolveSanitarioInventoryFactualDependency({
              operations: ops.filter(
                (
                  candidate,
                ): candidate is Operation | SanitarioSyncV2Operation =>
                  !isCommercialPurchaseOperation(candidate) &&
                  !isCommercialOperationV2(candidate),
              ),
              processedResults: results,
              fazendaId: fazenda_id,
              sourceEventId,
              loadAppliedLedger: async (trustedFazendaId, trustedEventId) => {
                const { data, error } = await serviceSupabase
                  .from("sanitario_sync_v2_operations")
                  .select("id")
                  .eq("fazenda_id", trustedFazendaId)
                  .eq("operation_kind", "factual_core")
                  .eq("entity_id", trustedEventId)
                  .maybeSingle();
                return { data, error };
              },
            });
          if (dependencyDecision.status === "RETRYABLE") {
            results.push({
              op_id: op.client_op_id,
              client_op_id: op.client_op_id,
              domain_op_id: String(record.domain_op_id),
              status: "RETRYABLE",
              retryable: true,
              reason_code: dependencyDecision.reason_code,
              reason_message: dependencyDecision.reason_message,
            });
            continue;
          }
          if (dependencyDecision.status === "BLOCKED_DEPENDENCY") {
            results.push({
              op_id: op.client_op_id,
              client_op_id: op.client_op_id,
              domain_op_id: String(record.domain_op_id),
              status: "BLOCKED_DEPENDENCY",
              reason_code: dependencyDecision.reason_code,
              reason_message:
                "Inventory movement requires a confirmed factual execution ledger",
            });
            continue;
          }

          const [
            { data: sourceEvent, error: eventError },
            { data: sourceDetail, error: detailError },
          ] = await Promise.all([
            supabase
              .from("eventos")
              .select(
                "id, fazenda_id, dominio, sanitario_sync_v2_nature, payload, deleted_at",
              )
              .eq("id", sourceEventId)
              .eq("fazenda_id", fazenda_id)
              .maybeSingle(),
            supabase
              .from("eventos_sanitario")
              .select(
                "evento_id, fazenda_id, produto_sanitario_v2_id, insumo_id, estoque_lote_id, deleted_at",
              )
              .eq("evento_id", sourceEventId)
              .eq("fazenda_id", fazenda_id)
              .maybeSingle(),
          ]);
          if (eventError || detailError) {
            results.push({
              op_id: op.client_op_id,
              client_op_id: op.client_op_id,
              domain_op_id: String(record.domain_op_id),
              status: "RETRYABLE",
              retryable: true,
              reason_code: "SANITARIO_INVENTORY_SOURCE_LOOKUP_FAILED",
              reason_message:
                eventError?.message ??
                detailError?.message ??
                "Sanitary inventory source lookup failed",
            });
            continue;
          }
          const sourceIssue = validateSanitarioInventoryMovementSource(
            record,
            sourceEvent as Record<string, unknown> | null,
            sourceDetail as Record<string, unknown> | null,
          );
          if (sourceIssue) {
            results.push({
              op_id: op.client_op_id,
              client_op_id: op.client_op_id,
              domain_op_id: String(record.domain_op_id),
              status: "REJECTED",
              reason_code: sourceIssue,
              reason_message:
                "Sanitary inventory movement does not match its factual execution",
            });
            continue;
          }

          const [byClientOp, byDomainOp, byLogicalMovement] = await Promise.all(
            [
              supabase
                .from("insumo_movimentacoes")
                .select("*")
                .eq("fazenda_id", fazenda_id)
                .eq("client_op_id", op.client_op_id)
                .is("deleted_at", null)
                .maybeSingle(),
              supabase
                .from("insumo_movimentacoes")
                .select("*")
                .eq("fazenda_id", fazenda_id)
                .eq("domain_op_id", String(record.domain_op_id))
                .is("deleted_at", null)
                .maybeSingle(),
              supabase
                .from("insumo_movimentacoes")
                .select("*")
                .eq("fazenda_id", fazenda_id)
                .eq("source_evento_id", sourceEventId)
                .eq("insumo_lote_id", String(record.insumo_lote_id))
                .eq("tipo", "consumo_sanitario")
                .is("deleted_at", null)
                .maybeSingle(),
            ],
          );
          const existingError =
            byClientOp.error ?? byDomainOp.error ?? byLogicalMovement.error;
          if (existingError) {
            results.push({
              op_id: op.client_op_id,
              client_op_id: op.client_op_id,
              domain_op_id: String(record.domain_op_id),
              status: "RETRYABLE",
              retryable: true,
              reason_code: "SANITARIO_INVENTORY_REPLAY_LOOKUP_FAILED",
              reason_message: existingError.message,
            });
            continue;
          }
          const existingMovements = [
            byClientOp.data,
            byDomainOp.data,
            byLogicalMovement.data,
          ].filter((entry): entry is Record<string, unknown> => Boolean(entry));
          if (existingMovements.length > 0) {
            const replay = existingMovements.every((existingMovement) =>
              sameSanitarioInventoryMovement(existingMovement, record),
            );
            results.push({
              op_id: op.client_op_id,
              client_op_id: op.client_op_id,
              domain_op_id: String(record.domain_op_id),
              status: replay ? "APPLIED" : "CONFLICT",
              reason_code: replay
                ? undefined
                : "SANITARIO_INVENTORY_IDENTITY_CONTENT_CONFLICT",
              reason_message: replay
                ? undefined
                : "Existing sanitary movement has divergent consumption content",
            });
            continue;
          }
        }

        const agendaClosureValidation = validateSanitarioAgendaClosurePush({
          ...op,
          record,
        });
        if (agendaClosureValidation) {
          results.push({
            op_id: op.client_op_id,
            status: agendaClosureValidation.status,
            reason_code: agendaClosureValidation.reason_code,
            reason_message: agendaClosureValidation.reason_message,
          });
          continue;
        }

        const taxonomyValidation = validateAnimalTaxonomyFactsOperation({
          ...op,
          record,
        });
        if (taxonomyValidation) {
          results.push({
            op_id: op.client_op_id,
            status: taxonomyValidation.status,
            reason_code: taxonomyValidation.reason_code,
            reason_message: taxonomyValidation.reason_message,
          });
          continue;
        }

        // P1.1: Reproduction Events Hardening (Payload v1 + Episode Linking)
        if (op.table === "eventos_reproducao" && op.action === "INSERT") {
          const { reproductionPayload, schemaVersion } =
            readReproductionPayload(record.payload);

          // 1. Validate Schema Version (Strict)
          if (schemaVersion !== 1) {
            results.push({
              op_id: op.client_op_id,
              status: "REJECTED",
              reason_code: "PAYLOAD_SCHEMA_VERSION_REQUIRED",
              reason_message: "Reproduction events must have schema_version: 1",
            });
            continue;
          }

          // 2. Validate Macho for Cobertura/IA
          if (
            (record.tipo === "cobertura" || record.tipo === "IA") &&
            !record.macho_id
          ) {
            results.push({
              op_id: op.client_op_id,
              status: "REJECTED",
              reason_code: "VALIDATION_ERROR",
              reason_message: "Macho_id is required for Cobertura/IA",
            });
            continue;
          }

          if (isSyncedReproductionDetailOperation({ ...op, record })) {
            const dependency = await resolveReproductionDiagnosisDependency({
              operation: { ...op, record },
              operations: legacyOps,
              processedResults: results,
              fazendaId: fazenda_id,
              loadRemoteEvent: async (trustedFazendaId, eventId) => {
                const { data, error } = await supabase
                  .from("eventos")
                  .select("id, fazenda_id, dominio, animal_id, occurred_at")
                  .eq("id", eventId)
                  .eq("fazenda_id", trustedFazendaId)
                  .maybeSingle();
                return { data, error };
              },
            });
            if (dependency.status !== "READY") {
              results.push({
                op_id: op.client_op_id,
                status: dependency.status,
                retryable: dependency.status === "RETRYABLE",
                reason_code: dependency.reason_code,
                reason_message: dependency.reason_message,
              });
              continue;
            }

            const episodeId =
              typeof reproductionPayload.episode_evento_id === "string"
                ? reproductionPayload.episode_evento_id
                : "";
            const { data: episode, error: episodeError } = episodeId
              ? await supabase
                  .from("eventos")
                  .select(
                    "id, fazenda_id, animal_id, occurred_at, eventos_reproducao(tipo)",
                  )
                  .eq("id", episodeId)
                  .eq("fazenda_id", fazenda_id)
                  .eq("animal_id", dependency.event.animal_id)
                  .maybeSingle()
              : { data: null, error: null };
            if (episodeError) {
              results.push({
                op_id: op.client_op_id,
                status: "REJECTED",
                reason_code: "INVALID_EPISODE_REFERENCE",
                reason_message: episodeError.message,
              });
              continue;
            }
            const episodeType = readLinkedReproductionType(
              episode?.eventos_reproducao,
            );
            const factualIssue =
              record.tipo === "diagnostico"
                ? validatePregnancyDiagnosis({
                    detail: record,
                    event: dependency.event,
                    episode,
                    episodeType,
                    fazendaId: fazenda_id,
                  })
                : validateOptionalReproductionEpisode({
                    detail: record,
                    event: dependency.event,
                    episode,
                    episodeType,
                    fazendaId: fazenda_id,
                  });
            if (factualIssue) {
              results.push({
                op_id: op.client_op_id,
                status: "REJECTED",
                reason_code: factualIssue,
                reason_message: "Reproduction detail failed factual validation",
              });
              continue;
            }
          }
        }

        const reproductionDetail =
          op.table === "eventos" &&
          op.action === "INSERT" &&
          typeof record.id === "string"
            ? findSyncedReproductionDetailForEvent(record.id, legacyOps)
            : null;
        if (reproductionDetail && record.corrige_evento_id != null) {
          const correctedId = String(record.corrige_evento_id);
          const [
            { data: correctedEvent, error: correctedError },
            { data: correctionChildren, error: childrenError },
          ] = await Promise.all([
            supabase
              .from("eventos")
              .select(
                "id, fazenda_id, dominio, animal_id, occurred_at, eventos_reproducao(tipo)",
              )
              .eq("id", correctedId)
              .eq("fazenda_id", fazenda_id)
              .maybeSingle(),
            supabase
              .from("eventos")
              .select("id")
              .eq("fazenda_id", fazenda_id)
              .eq("corrige_evento_id", correctedId)
              .is("deleted_at", null),
          ]);
          if (correctedError || childrenError) {
            results.push({
              op_id: op.client_op_id,
              status: "RETRYABLE",
              retryable: true,
              reason_code: "REPRODUCTION_CORRECTION_LOOKUP_FAILED",
              reason_message: correctedError?.message ?? childrenError?.message,
            });
            continue;
          }
          if (!correctedEvent) {
            results.push({
              op_id: op.client_op_id,
              status: "BLOCKED_DEPENDENCY",
              retryable: false,
              reason_code: "REPRODUCTION_CORRECTED_EVENT_NOT_APPLIED",
              reason_message:
                "Correction is blocked until the corrected event is available",
            });
            continue;
          }
          const correctionIssue = validateReproductionCorrection({
            event: { ...record, fazenda_id },
            detail: reproductionDetail.record,
            correctedEvent,
            correctedType: readLinkedReproductionType(
              correctedEvent.eventos_reproducao,
            ),
            directChildren: correctionChildren ?? [],
            fazendaId: fazenda_id,
          });
          if (correctionIssue) {
            results.push({
              op_id: op.client_op_id,
              status:
                correctionIssue === "REPRODUCTION_CORRECTION_BRANCH_CONFLICT"
                  ? "CONFLICT"
                  : "REJECTED",
              reason_code: correctionIssue,
              reason_message:
                "Reproductive correction failed append-only validation",
            });
            continue;
          }
          const rewritesBirthChildren =
            reproductionDetail.record.tipo === "parto" &&
            legacyOps.some(
              (candidate) =>
                (isBirthCalfOperation(candidate) &&
                  readBirthEventId(candidate.record) === record.id) ||
                (isBirthAgendaOperation(candidate) &&
                  readAgendaBirthEventId(candidate.record) === record.id),
            );
          if (rewritesBirthChildren) {
            results.push({
              op_id: op.client_op_id,
              status: "REJECTED",
              reason_code: "REPRODUCTION_CORRECTION_BIRTH_CHILDREN_UNSUPPORTED",
              reason_message:
                "Birth correction cannot recreate calves or neonatal agenda",
            });
            continue;
          }
        }

        const isBirthCalf = isBirthCalfOperation({ ...op, record });
        const isBirthAgenda = isBirthAgendaOperation({ ...op, record });
        if (isBirthCalf || isBirthAgenda) {
          const birthEventId = isBirthCalf
            ? readBirthEventId(record)
            : readAgendaBirthEventId(record);
          const birthEventOp = legacyOps.find(
            (candidate) =>
              candidate.table === "eventos" &&
              candidate.action === "INSERT" &&
              candidate.record?.id === birthEventId,
          );
          const birthDetailOp = birthEventId
            ? findSyncedReproductionDetailForEvent(birthEventId, legacyOps)
            : null;
          let parentEvent: Record<string, unknown> | null = null;
          let parentType: string | null = null;
          if (birthEventOp || birthDetailOp) {
            if (
              !birthEventOp ||
              !birthDetailOp ||
              birthDetailOp.record.tipo !== "parto" ||
              !isAppliedResult(results, birthEventOp.client_op_id) ||
              !isAppliedResult(results, birthDetailOp.client_op_id)
            ) {
              results.push({
                op_id: op.client_op_id,
                status: "BLOCKED_DEPENDENCY",
                retryable: false,
                reason_code: "REPRODUCTION_BIRTH_FACT_NOT_APPLIED",
                reason_message:
                  "Birth dependent is blocked until event and detail are applied",
              });
              continue;
            }
            parentEvent = { ...birthEventOp.record, fazenda_id };
            parentType = String(birthDetailOp.record.tipo);
          } else if (birthEventId) {
            const { data: remoteBirth, error: remoteBirthError } =
              await supabase
                .from("eventos")
                .select(
                  "id, fazenda_id, dominio, animal_id, eventos_reproducao(tipo)",
                )
                .eq("id", birthEventId)
                .eq("fazenda_id", fazenda_id)
                .maybeSingle();
            if (remoteBirthError) {
              results.push({
                op_id: op.client_op_id,
                status: "RETRYABLE",
                retryable: true,
                reason_code: "REPRODUCTION_BIRTH_LOOKUP_FAILED",
                reason_message: remoteBirthError.message,
              });
              continue;
            }
            parentEvent = remoteBirth;
            parentType = readLinkedReproductionType(
              remoteBirth?.eventos_reproducao,
            );
          }
          if (
            !parentEvent ||
            parentEvent.fazenda_id !== fazenda_id ||
            parentEvent.dominio !== "reproducao" ||
            parentType !== "parto"
          ) {
            results.push({
              op_id: op.client_op_id,
              status: "BLOCKED_DEPENDENCY",
              retryable: false,
              reason_code: "REPRODUCTION_BIRTH_FACT_NOT_APPLIED",
              reason_message: "Birth fact is missing or incompatible",
            });
            continue;
          }
          if (isBirthCalf && record.mae_id !== parentEvent.animal_id) {
            results.push({
              op_id: op.client_op_id,
              status: "REJECTED",
              reason_code: "REPRODUCTION_CALF_MOTHER_MISMATCH",
              reason_message: "Calf mother must match the birth event animal",
            });
            continue;
          }
          if (isBirthAgenda) {
            const calfId = record.animal_id;
            const calfOp = legacyOps.find(
              (candidate) =>
                isBirthCalfOperation(candidate) &&
                candidate.record.id === calfId &&
                readBirthEventId(candidate.record) === birthEventId,
            );
            if (calfOp && !isAppliedResult(results, calfOp.client_op_id)) {
              results.push({
                op_id: op.client_op_id,
                status: "BLOCKED_DEPENDENCY",
                retryable: false,
                reason_code: "REPRODUCTION_CALF_NOT_APPLIED",
                reason_message:
                  "Neonatal agenda is blocked until the calf is applied",
              });
              continue;
            }
            if (!calfOp && typeof calfId === "string") {
              const { data: remoteCalf, error: remoteCalfError } =
                await supabase
                  .from("animais")
                  .select("id, fazenda_id, payload")
                  .eq("id", calfId)
                  .eq("fazenda_id", fazenda_id)
                  .maybeSingle();
              if (remoteCalfError) {
                results.push({
                  op_id: op.client_op_id,
                  status: "RETRYABLE",
                  retryable: true,
                  reason_code: "REPRODUCTION_CALF_LOOKUP_FAILED",
                  reason_message: remoteCalfError.message,
                });
                continue;
              }
              if (
                !remoteCalf ||
                readBirthEventId(remoteCalf) !== birthEventId
              ) {
                results.push({
                  op_id: op.client_op_id,
                  status: "BLOCKED_DEPENDENCY",
                  retryable: false,
                  reason_code: "REPRODUCTION_CALF_NOT_APPLIED",
                  reason_message:
                    "Neonatal agenda requires a calf from the same birth event",
                });
                continue;
              }
            }
          }
        }

        const reproductionReplayTable = reproductionDetail
          ? "eventos"
          : isSyncedReproductionDetailOperation({ ...op, record })
            ? "eventos_reproducao"
            : isBirthCalf
              ? "animais"
              : isBirthAgenda
                ? "agenda_itens"
                : null;
        if (reproductionReplayTable) {
          const keyField =
            reproductionReplayTable === "eventos_reproducao"
              ? "evento_id"
              : "id";
          const keyValue = record[keyField];
          const { data: existing, error: existingError } = await supabase
            .from(reproductionReplayTable)
            .select("*")
            .eq(keyField, keyValue)
            .eq("fazenda_id", fazenda_id)
            .maybeSingle();
          if (existingError) {
            results.push({
              op_id: op.client_op_id,
              status: "REJECTED",
              reason_code: "REPRODUCTION_REPLAY_LOOKUP_FAILED",
              reason_message: existingError.message,
            });
            continue;
          }
          if (existing) {
            const incoming = {
              ...record,
              fazenda_id,
              client_id,
              client_op_id: op.client_op_id,
              client_tx_id,
            };
            if (
              sameReproductionDiagnosisRecord(
                reproductionReplayTable,
                existing,
                incoming,
              )
            ) {
              results.push({ op_id: op.client_op_id, status: "APPLIED" });
            } else {
              results.push({
                op_id: op.client_op_id,
                status: "CONFLICT",
                reason_code: "REPRODUCTION_IDENTITY_CONFLICT",
                reason_message:
                  "Reproduction identity already exists with divergent content",
              });
            }
            continue;
          }
        }

        if (op.table === "eventos" && op.action === "INSERT") {
          const agendaSourceTaskId = inferAgendaSourceTaskIdForEventInsert(
            { ...op, record },
            legacyOps,
          );

          if (agendaSourceTaskId) {
            const { data: agendaItem, error: agendaError } = await supabase
              .from("agenda_itens")
              .select("id, status, source_evento_id")
              .eq("id", agendaSourceTaskId)
              .eq("fazenda_id", fazenda_id)
              .is("deleted_at", null)
              .maybeSingle();

            if (agendaError) {
              results.push({
                op_id: op.client_op_id,
                status: "REJECTED",
                reason_code: "AGENDA_SOURCE_LOOKUP_FAILED",
                reason_message: agendaError.message,
              });
              continue;
            }

            if (
              agendaItem?.status === "concluido" &&
              typeof agendaItem.source_evento_id === "string" &&
              agendaItem.source_evento_id.length > 0
            ) {
              results.push({
                op_id: op.client_op_id,
                status: "REJECTED",
                reason_code: "agenda_already_completed_by_event",
                reason_message: `Agenda item already completed by event ${agendaItem.source_evento_id}`,
              });
              continue;
            }
          }
        }

        // P0: Execute with user client (RLS enforced)
        let query;
        if (op.action === "INSERT") {
          query = supabase
            .from(op.table)
            .insert({
              ...record,
              fazenda_id,
              client_id,
              client_op_id: op.client_op_id,
              client_tx_id,
            })
            .select(); // Request representation to avoid PGRST204
        } else if (op.action === "UPDATE") {
          const match = buildMutationMatch(op, fazenda_id);
          if (!match) {
            results.push({
              op_id: op.client_op_id,
              status: "REJECTED",
              reason_code: "VALIDATION_MISSING_PRIMARY_KEY",
              reason_message: `Operation UPDATE on ${op.table} missing id/evento_id/user_id`,
            });
            continue;
          }
          query = supabase.from(op.table).update(record).match(match).select(); // Request representation to avoid PGRST204
        } else if (op.action === "DELETE") {
          const match = buildMutationMatch(op, fazenda_id);
          if (!match) {
            results.push({
              op_id: op.client_op_id,
              status: "REJECTED",
              reason_code: "VALIDATION_MISSING_PRIMARY_KEY",
              reason_message: `Operation DELETE on ${op.table} missing id/evento_id/user_id`,
            });
            continue;
          }
          query = supabase
            .from(op.table)
            .update({
              deleted_at: new Date().toISOString(),
              client_id,
              client_op_id: op.client_op_id,
              client_tx_id,
            })
            .match(match)
            .select(); // Request representation to avoid PGRST204
        }

        const { error } = await query!;

        if (error) {
          const normalized = normalizeDbError(error, op);
          if (normalized.status === "APPLIED_ALTERED") {
            results.push({
              op_id: op.client_op_id,
              status: "APPLIED_ALTERED",
              altered: normalized.altered,
            });
          } else if (normalized.status === "APPLIED") {
            results.push({ op_id: op.client_op_id, status: "APPLIED" });
          } else {
            results.push({
              op_id: op.client_op_id,
              status: "REJECTED",
              reason_code: normalized.reason_code,
              reason_message: normalized.reason_message,
            });
          }
        } else {
          if (
            op.table === "protocolos_sanitarios" ||
            op.table === "protocolos_sanitarios_itens" ||
            op.table === "fazenda_sanidade_config"
          ) {
            recomputeTablesTouched.add(op.table);
          }
          results.push({ op_id: op.client_op_id, status: "APPLIED" });
        }
      } catch (e: unknown) {
        results.push(buildInternalErrorResult(rawOp, e));
      }
    }

    if (recomputeTablesTouched.size > 0) {
      const { error: recomputeError } = await supabase.rpc(
        "sanitario_recompute_agenda_for_fazenda",
        {
          _fazenda_id: fazenda_id,
          _as_of: new Date().toISOString().slice(0, 10),
        },
      );

      if (recomputeError) {
        console.warn(
          `[sync-batch] Failed to recompute sanitary agenda for farm ${fazenda_id}: ${recomputeError.message}`,
        );
      }
    }

    return new Response(
      JSON.stringify({
        server_tx_id: `srv-${client_tx_id.slice(0, 8)}`,
        client_tx_id,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error("[sync-batch] Fatal error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
