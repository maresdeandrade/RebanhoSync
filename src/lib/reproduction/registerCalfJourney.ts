import { db, LOCAL_OWNERSHIP_KEY } from "@/lib/offline/db";
import { getCurrentLocalReadOwnership } from "@/lib/offline/localReadBoundary";
import { createGesture } from "@/lib/offline/ops";
import type { AgendaItem, Gesture } from "@/lib/offline/types";
import { buildCalfJourneyCompletionOps, getCalfJourneyMilestoneKey } from "./calfJourney";
import { deterministicUuidFromText } from "./deterministicUuid";
import type { PostPartumContext } from "./registerPostPartum";

type CalfJourneyCommandInput = {
  fazendaId: string;
  calfId: string;
  agendaId: string;
  pesoKg?: number | null;
  destinationLoteId?: string | null;
};

function assertContext(expected: PostPartumContext, current: PostPartumContext, farmId: string) {
  if (!expected.userId || !expected.role || expected.fazendaId !== farmId || current.fazendaId !== farmId ||
    current.userId !== expected.userId || current.role !== expected.role) {
    throw new Error("O contexto da fazenda ou da sessão mudou. Reabra a ficha da cria.");
  }
}

function assertFarm(record: { fazenda_id: string; deleted_at?: string | null } | undefined, farmId: string) {
  if (!record || record.fazenda_id !== farmId || record.deleted_at)
    throw new Error("Registro indisponível nesta fazenda. Atualize os dados antes de executar.");
}

async function assertLocalOwner(userId: string | null) {
  if ((await db.local_ownership.get(LOCAL_OWNERSHIP_KEY))?.owner_user_id !== userId)
    throw new Error("A sessão não corresponde ao responsável pelos dados locais.");
}

async function assertCommandOutcome(gesture: Gesture, farmId: string) {
  assertFarm(gesture, farmId);
  const ops = await db.queue_ops.where("client_tx_id").equals(gesture.client_tx_id).toArray();
  if (["REJECTED", "ERROR"].includes(gesture.status) || ["REJECTED", "ERROR"].includes(gesture.sync_result ?? "") ||
      ops.some(op => op.sync_state === "REJECTED") ||
      gesture.operation_results?.some(result => ["REJECTED", "CONFLICT"].includes(result.status))) {
    throw new Error("O comando anterior exige revisão na Sincronização. Nenhum novo Evento foi criado.");
  }
  if (!ops.length && gesture.status !== "DONE" && gesture.status !== "SYNCED")
    throw new Error("O comando anterior está incompleto. Consulte a Sincronização antes de executar novamente.");
}

async function legacyQueuedExecutions(item: AgendaItem, input: CalfJourneyCommandInput) {
  const queued = await db.queue_ops.filter(op => op.table === "eventos" &&
    op.record.source_task_id === item.id && op.record.dominio === item.dominio).toArray();
  const candidates = new Map<string, string | null>();
  for (const op of queued) {
    const gesture = await db.queue_gestures.get(op.client_tx_id);
    if (!gesture || gesture.fazenda_id !== input.fazendaId || op.record.animal_id !== input.calfId ||
        (op.record.fazenda_id !== undefined && op.record.fazenda_id !== input.fazendaId))
      throw new Error("A execução anterior pertence a um contexto incompatível.");
    await assertCommandOutcome(gesture, input.fazendaId);
    candidates.set(String(op.record.id), op.client_tx_id);
  }
  return candidates;
}

/** Recognize pre-upgrade facts/queue entries without translating or re-enqueuing them. */
async function previousExecution(item: AgendaItem, input: CalfJourneyCommandInput) {
  const candidates = await legacyQueuedExecutions(item, input);
  const events = await db.event_eventos.where("fazenda_id").equals(input.fazendaId)
    .filter(event => event.source_task_id === item.id && event.dominio === item.dominio).toArray();
  for (const event of events) {
    if (event.animal_id !== input.calfId || event.deleted_at) throw new Error("A execução anterior exige revisão factual.");
    candidates.set(event.id, event.client_tx_id);
  }
  if (candidates.size > 1) throw new Error("Há execuções divergentes para esta intenção. Consulte a Sincronização.");
  const existing = [...candidates][0];
  if (!existing) return null;
  const [eventId, txId] = existing;
  const gesture = txId ? await db.queue_gestures.get(txId) : undefined;
  if (gesture) await assertCommandOutcome(gesture, input.fazendaId);
  return { txId, eventId, replayed: true };
}

async function readCommandScope(input: CalfJourneyCommandInput) {
  const calf = await db.state_animais.get(input.calfId);
  const item = await db.state_agenda_itens.get(input.agendaId);
  assertFarm(calf, input.fazendaId);
  assertFarm(item, input.fazendaId);
  if (item!.animal_id !== calf!.id) throw new Error("A intenção não pertence a esta cria.");
  const key = getCalfJourneyMilestoneKey(item!);
  if (key !== "pesagem_d7" && key !== "pesagem_d30" && key !== "desmame")
    throw new Error("Marco indisponível neste fluxo. Use a Central Sanitária para manejo neonatal.");
  if (item!.dominio !== (key === "desmame" ? "nutricao" : "pesagem"))
    throw new Error("A intenção possui domínio incompatível com o marco da cria.");
  return { calf: calf!, item: item!, key };
}

async function replayCommand(previous: Gesture, scope: Awaited<ReturnType<typeof readCommandScope>>, farmId: string) {
  const command = previous.calf_journey_command;
  if (!command || command.version !== 1 || command.agenda_id !== scope.item.id || command.animal_id !== scope.calf.id ||
      command.event_id !== deterministicUuidFromText(`${previous.client_tx_id}:event`))
    throw new Error("A identidade do comando já está ocupada por outro conteúdo.");
  await assertCommandOutcome(previous, farmId);
  return { txId: previous.client_tx_id, eventId: command.event_id, replayed: true };
}

async function assertDestination(input: CalfJourneyCommandInput, scope: Awaited<ReturnType<typeof readCommandScope>>) {
  const { calf, key } = scope;
  if (key === "desmame" && input.destinationLoteId && input.destinationLoteId !== calf.lote_id) {
    const lot = await db.state_lotes.get(input.destinationLoteId);
    assertFarm(lot, input.fazendaId);
    if (lot!.status !== "ativo") throw new Error("O lote de destino não está ativo.");
  }
}

async function readCompletionMother(input: CalfJourneyCommandInput, scope: Awaited<ReturnType<typeof readCommandScope>>) {
  const { calf, item } = scope;
  if (item.status !== "agendado" || item.source_evento_id)
    throw new Error("Esta intenção não está disponível para nova execução. Confira o histórico e a Sincronização.");
  await assertDestination(input, scope);
  const mother = calf.mae_id ? await db.state_animais.get(calf.mae_id) : null;
  // The mother is optional in this caller; a historical/deleted mother does not
  // prevent a new weight. A materialized row must still belong to this farm.
  if (mother && mother.fazenda_id !== input.fazendaId)
    throw new Error("A matriz pertence a outra fazenda.");
  return mother ?? null;
}

async function createCommand(input: CalfJourneyCommandInput, scope: Awaited<ReturnType<typeof readCommandScope>>, txId: string, validateContext: () => void) {
  const mother = await readCompletionMother(input, scope);
  const eventId = deterministicUuidFromText(`${txId}:event`);
  if (await db.event_eventos.get(eventId)) throw new Error("A identidade do Evento já está ocupada. Confira o histórico.");
  const occurredAt = new Date().toISOString();
  const built = buildCalfJourneyCompletionOps({ ...input, destinationLoteId: input.destinationLoteId ?? scope.calf.lote_id,
    calf: scope.calf, mother, agendaItem: scope.item, eventId, occurredAt });
  await createGesture(input.fazendaId, built.ops, { clientTxId: txId, validateContext });
  // Same outer transaction: no worker can observe a gesture without its command identity.
  await db.queue_gestures.update(txId, { calf_journey_command: {
    version: 1, agenda_id: scope.item.id, animal_id: scope.calf.id, event_id: eventId, occurred_at: occurredAt,
  } });
  return { txId, eventId, replayed: false };
}

/** One durable command per Agenda intention, committed with createGesture's effects. */
export async function registerCalfJourneyGesture(input: CalfJourneyCommandInput, readContext: () => PostPartumContext) {
  const context = { ...readContext() };
  const validateContext = () => assertContext(context, readContext(), input.fazendaId);
  validateContext();
  // getSession may refresh; finish auth before opening any IndexedDB transaction.
  const ownership = await getCurrentLocalReadOwnership();
  if (ownership.status !== "OWNED" || ownership.currentUserId !== context.userId)
    throw new Error("Sessão indisponível ou incompatível com os dados locais. Entre novamente para registrar.");
  validateContext();
  const txId = deterministicUuidFromText(JSON.stringify(["calf-journey-command-v1", input.fazendaId, input.agendaId]));
  const stores = [db.local_ownership, db.queue_gestures, db.queue_ops, db.state_animais, db.state_lotes,
    db.state_agenda_itens, db.event_eventos, db.event_eventos_pesagem, db.event_eventos_nutricao, db.event_eventos_movimentacao];
  return db.transaction("rw", stores, async () => {
    validateContext();
    await assertLocalOwner(context.userId);
    const scope = await readCommandScope(input);
    const previous = await db.queue_gestures.get(txId);
    const existing = previous
      ? await replayCommand(previous, scope, input.fazendaId)
      : await previousExecution(scope.item, input);
    validateContext();
    if (existing) return existing;
    const created = await createCommand(input, scope, txId, validateContext);
    await assertLocalOwner(context.userId);
    validateContext();
    return created;
  });
}
