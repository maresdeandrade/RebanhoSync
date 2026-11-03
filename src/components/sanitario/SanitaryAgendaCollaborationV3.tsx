import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentLocalReadOwnership } from "@/lib/offline/localReadBoundary";
import { db } from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  manageSanitaryAgendaV3,
  currentParticipationV3,
} from "@/lib/sanitario/execution/sanitaryCollaborationV3";
import { readSanitaryPlanningSyncContextV2 } from "@/lib/sanitario/agenda/sanitaryPlanningSyncV2";
import type { SanitaryActionV3 } from "@/lib/sanitario/execution/sanitaryCollaborationTypesV3";

function operationalMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error ?? "");
  const messages: Record<string, string> = {
    SANITARIO_PARTICIPANTS_INCOMPLETE:
      "Há participantes sem conclusão ou operações ainda não recebidas. Aguarde a sincronização e a conclusão de cada atuação conhecida.",
    SANITARIO_UNRESOLVED_EVIDENCE:
      "Resolva as evidências conflitantes antes de preparar o fechamento.",
    SANITARIO_CLOSING_SNAPSHOT_STALE:
      "A revisão mudou. Prepare e confira novamente o fechamento.",
    SANITARIO_CONTINUATION_DEPENDENCY:
      "Há uma continuidade vinculada. Revise a dependência; uma continuidade sem execução pode ser cancelada após a conclusão dos participantes.",
    SANITARIO_CONTINUATION_RESULT_STALE:
      "O resultado mudou. Revise o resultado atual e faça uma nova solicitação.",
    SANITARIO_CONTINUATION_ALREADY_DECIDED:
      "Esta solicitação já recebeu uma decisão. Atualize os resultados.",
    SANITARIO_CONTINUATION_OUTSIDE_WINDOW:
      "A data proposta está fora da janela original da obrigação.",
    SANITARIO_CONTINUATION_SOURCE_NOT_ACTIVE:
      "A fonte original não está ativa para esta continuidade. Revise a configuração sanitária.",
    SANITARIO_HISTORICAL_COMPLEMENT_REQUIRED:
      "A evidência histórica não preserva todos os parâmetros. Registre evidência factual completa para reconhecer outra aplicação.",
    SANITARIO_ROLE_NOT_ALLOWED:
      "Esta decisão exige Owner ou Manager da fazenda.",
  };
  return (
    Object.entries(messages).find(([code]) => text.includes(code))?.[1] ??
    (text.startsWith("SANITARIO_")
      ? "A operação requer revisão. Consulte os detalhes na sincronização."
      : text)
  );
}

function useCollaborationDataV3(
  agendaId: string,
  fazendaId: string,
  userId: string | undefined,
  activeFarmId: string | null | undefined,
  clientId: string | undefined,
) {
  return useLiveQuery(async () => {
    if (!userId || activeFarmId !== fazendaId) return;
    const ownership = await getCurrentLocalReadOwnership();
    if (ownership.status !== "OWNED" || ownership.currentUserId !== userId)
      return;
    const [
      agenda,
      participants,
      declarations,
      results,
      requests,
      animals,
      events,
      queue,
      draft,
    ] = await Promise.all([
      db.ops_sanitario_agenda_v2.get(agendaId),
      db.ops_sanitario_participacoes
        .where("agenda_id")
        .equals(agendaId)
        .filter((x) => x.fazenda_id === fazendaId)
        .toArray(),
      db.ops_sanitario_participacao_operacoes
        .where("agenda_id")
        .equals(agendaId)
        .filter((x) => x.fazenda_id === fazendaId)
        .toArray(),
      db.ops_sanitario_agenda_resultados
        .where("agenda_id")
        .equals(agendaId)
        .filter((x) => x.fazenda_id === fazendaId)
        .toArray(),
      db.ops_sanitario_continuidade_solicitacoes
        .where("agenda_id")
        .equals(agendaId)
        .filter((x) => x.fazenda_id === fazendaId)
        .toArray(),
      db.ops_sanitario_agenda_animais_v2
        .where("agenda_id")
        .equals(agendaId)
        .filter((x) => x.fazenda_id === fazendaId)
        .toArray(),
      db.event_eventos
        .where("fazenda_id")
        .equals(fazendaId)
        .filter((x) => x.source_sanitario_agenda_v2_id === agendaId)
        .toArray(),
      db.queue_ops
        .filter(
          (x) =>
            x.record.fazenda_id === fazendaId &&
            (x.record.payload?.agenda_id === agendaId ||
              x.record.payload?.event?.source_sanitario_agenda_v2_id ===
                agendaId),
        )
        .toArray(),
      clientId
        ? currentParticipationV3({
            fazendaId,
            agendaId,
            actorUserId: userId,
            clientId: clientId,
          })
        : undefined,
    ]);
    if (agenda?.fazenda_id !== fazendaId) return;
    const animalRecords = await db.state_animais.bulkGet(
      animals.map((entry) => entry.animal_id),
    );
    const animalNames = new Map(
      animalRecords
        .filter((animal) => animal?.fazenda_id === fazendaId)
        .map((animal) => [
          animal!.id,
          animal!.identificacao?.trim() || animal!.id.slice(0, 8),
        ]),
    );
    return {
      animalNames,
      actorUserId: userId,
      agenda,
      participants,
      declarations,
      result: results.sort((a, b) => b.revision - a.revision)[0],
      requests,
      animals,
      events,
      queue,
      draft,
    };
  }, [agendaId, fazendaId, userId, activeFarmId, clientId]);
}

type CollaborationViewDataV3 = NonNullable<
  ReturnType<typeof useCollaborationDataV3>
>;
type CollaborationSendV3 = (
  action: SanitaryActionV3,
  fields?: Record<string, unknown>,
) => Promise<void>;

function sameContext(
  actorUserId: string | undefined,
  activeFarmId: string | null | undefined,
  userId: string,
  farmId: string,
) {
  return actorUserId === userId && activeFarmId === farmId;
}

function isManagerialRoleV3(role: string | null | undefined) {
  return role === "owner" || role === "manager";
}
function hasClosedResultV3(data: CollaborationViewDataV3) {
  return data.agenda.status === "fechada" && Boolean(data.result);
}

export function SanitaryAgendaCollaborationV3({
  agendaId,
  fazendaId,
}: {
  agendaId: string;
  fazendaId: string;
}) {
  const { user, activeFarmId, role } = useAuth();
  const current = useRef({ userId: user?.id, farm: activeFarmId });
  current.current = { userId: user?.id, farm: activeFarmId };
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [finalSequences, setFinalSequences] = useState<Record<string, string>>(
    {},
  );
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const sync = readSanitaryPlanningSyncContextV2();
  const data = useCollaborationDataV3(
    agendaId,
    fazendaId,
    user?.id,
    activeFarmId,
    sync?.clientId,
  );
  if (!data || !user) return null;
  if (!sameContext(data.actorUserId, activeFarmId, user.id, fazendaId))
    return null;
  const animalLabel = (id: string) =>
    `Animal ${data.animalNames.get(id) ?? id.slice(0, 8)}`;
  const managerial = isManagerialRoleV3(role);
  const open = data.agenda.status === "programada";
  const outstanding = data.animals.filter(
    (x) => x.planned_status !== "executado",
  );
  const animalsWithReasons = outstanding.map((x) => ({
    animal_id: x.animal_id,
    reason: reasons[x.animal_id] ?? x.not_executed_reason ?? "",
  }));
  const send: CollaborationSendV3 = (action, fields = {}) =>
    sendCollaborationV3(
      {
        sync,
        fazendaId,
        agendaId,
        userId: user.id,
        current,
        setNotice,
        setBusy,
      },
      action,
      fields,
    );
  return (
    <section
      className="col-span-full space-y-3 rounded border p-3"
      aria-label="Colaboração e fechamento sanitário"
    >
      <p className="font-medium">Atuação compartilhada e revisão</p>
      <p className="text-xs text-muted-foreground">
        Concluir sua atuação mantém a Agenda aberta. Somente o fechamento
        gerencial confirmado consolida o resultado.
      </p>
      <ParticipationControlsV3
        data={data}
        open={open}
        busy={busy}
        sync={sync}
        userId={user.id}
        finalSequences={finalSequences}
        setFinalSequences={setFinalSequences}
        send={send}
      />
      {data.queue.map((op) => (
        <QueueRecordV3 key={op.client_op_id} op={op} data={data} />
      ))}
      {data.events.map((event) => (
        <EventRecordV3 key={event.id} event={event} data={data} />
      ))}
      <AnimalResultsV3 data={data} animalLabel={animalLabel} />
      <DecisionReasonV3
        managerial={managerial}
        reason={reason}
        setReason={setReason}
      />
      <HistoricalEvidenceV3
        data={data}
        managerial={managerial}
        busy={busy}
        sync={sync}
        reason={reason}
        send={send}
      />
      {data.declarations
        .filter((x) => x.outcome !== "confirmed")
        .map((declaration) => (
          <div
            key={declaration.id}
            className="space-y-2 border-l-2 pl-2 text-xs"
          >
            <p>
              {declaration.outcome === "late"
                ? "Registro tardio"
                : declaration.outcome === "dependency"
                  ? "Declaração bloqueada por dependência"
                  : "Evidência conflitante"}{" "}
              {declaration.id} ·{" "}
              {declaration.resolution
                ? `Reconciliado: ${declaration.resolution.decision} · ${declaration.resolution.reason}`
                : "Aguardando decisão gerencial"}
            </p>
            {managerial && !declaration.resolution && (
              <div className="flex flex-wrap gap-2">
                {(["late", "dependency"].includes(declaration.outcome)
                  ? ["accepted", "additional", "duplicate", "rejected"]
                  : ["additional", "duplicate", "rejected"]
                ).map((decision) => (
                  <Button
                    key={decision}
                    size="sm"
                    variant="outline"
                    disabled={busy || !reason.trim() || !sync}
                    onClick={() =>
                      send(
                        declaration.outcome === "late"
                          ? "reconcile_late"
                          : "resolve",
                        { declaration_id: declaration.id, decision, reason },
                      )
                    }
                  >
                    {
                      (
                        {
                          accepted:
                            declaration.outcome === "late"
                              ? "Reconhecer fato tardio"
                              : "Reconhecer execução declarada",
                          additional: "Reconhecer aplicação adicional",
                          duplicate: "Classificar duplicidade",
                          rejected: "Rejeitar evidência",
                        } as Record<string, string>
                      )[decision]
                    }
                  </Button>
                ))}
              </div>
            )}
          </div>
        ))}
      {managerial && open && (
        <>
          <ClosureControlsV3
            data={data}
            outstanding={outstanding}
            animalLabel={animalLabel}
            busy={busy}
            sync={sync}
            reasons={reasons}
            setReasons={setReasons}
            animalsWithReasons={animalsWithReasons}
            send={send}
          />
          <CancelContinuationV3
            data={data}
            busy={busy}
            sync={sync}
            reason={reason}
            send={send}
          />
        </>
      )}
      {hasClosedResultV3(data) && (
        <ContinuationControlsV3
          data={data}
          managerial={managerial}
          busy={busy}
          sync={sync}
          reason={reason}
          date={date}
          setReason={setReason}
          setDate={setDate}
          outstanding={outstanding}
          animalsWithReasons={animalsWithReasons}
          send={send}
        />
      )}
      {notice && (
        <p role="status" className="text-xs">
          {notice}
        </p>
      )}
    </section>
  );
}

interface ContinuationControlsV3 {
  data: CollaborationViewDataV3;
  managerial: boolean;
  busy: boolean;
  sync: ReturnType<typeof readSanitaryPlanningSyncContextV2>;
  reason: string;
  date: string;
  setReason: (value: string) => void;
  setDate: (value: string) => void;
  outstanding: CollaborationViewDataV3["animals"];
  animalsWithReasons: { animal_id: string; reason: string }[];
  send: CollaborationSendV3;
}
function ContinuationRequestV3({
  request,
  managerial,
  busy,
  sync,
  reason,
  date,
  send,
}: Pick<
  ContinuationControlsV3,
  "managerial" | "busy" | "sync" | "reason" | "date" | "send"
> & { request: CollaborationViewDataV3["requests"][number] }) {
  const disabled = busy || !sync || !reason.trim();
  return (
    <div className="text-xs">
      <p>
        Solicitação {request.id} · {request.reason} ·{" "}
        {request.decision ?? "aguardando decisão"} {request.decision_reason}{" "}
        {request.continuation_id &&
          `· Agenda de continuidade ${request.continuation_id}`}
      </p>
      {managerial && !request.decision && (
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={disabled || !date}
            onClick={() =>
              send("decide_continuation", {
                request_id: request.id,
                decision: "approved",
                reason,
                planned_for: date,
              })
            }
          >
            Aprovar continuidade
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() =>
              send("decide_continuation", {
                request_id: request.id,
                decision: "rejected",
                reason,
              })
            }
          >
            Rejeitar continuidade
          </Button>
        </div>
      )}
    </div>
  );
}
function ContinuationControlsV3({
  data,
  managerial,
  busy,
  sync,
  reason,
  date,
  setReason,
  setDate,
  outstanding,
  animalsWithReasons,
  send,
}: ContinuationControlsV3) {
  return (
    <>
      {!managerial && (
        <label className="block text-xs">
          Justificativa da solicitação
          <Input
            aria-label="Justificativa da solicitação"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      )}
      <Button
        size="sm"
        disabled={busy || !sync || !reason.trim() || !outstanding.length}
        onClick={() =>
          send("request_continuation", {
            result_id: data.result!.id,
            reason,
            animals: animalsWithReasons,
          })
        }
      >
        Solicitar continuidade dos não executados
      </Button>
      {managerial && (
        <label className="block text-xs">
          Data da continuidade
          <Input
            type="date"
            aria-label="Data da continuidade"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      )}
      {data.requests.map((request) => (
        <ContinuationRequestV3
          key={request.id}
          request={request}
          managerial={managerial}
          busy={busy}
          sync={sync}
          reason={reason}
          date={date}
          send={send}
        />
      ))}
    </>
  );
}

function QueueRecordV3({
  op,
  data,
}: {
  op: CollaborationViewDataV3["queue"][number];
  data: CollaborationViewDataV3;
}) {
  return (
    <p className="text-xs">
      {op.record.payload?.action ?? "Execução"}:{" "}
      {data.declarations.some((d) => d.id === op.client_op_id && d.resolution)
        ? "Reconciliado · declaração original preservada"
        : op.sync_state === "REJECTED"
          ? `Conflitante/rejeitado · ${operationalMessage(op.blocked_reason ?? "Verifique a sincronização")}`
          : "Pendente de confirmação"}
    </p>
  );
}
function EventRecordV3({
  event,
  data,
}: {
  event: CollaborationViewDataV3["events"][number];
  data: CollaborationViewDataV3;
}) {
  return (
    <p className="text-xs">
      Evento {event.id}:{" "}
      {data.declarations.some(
        (d) =>
          (d.evento_id === event.id || d.id === event.client_op_id) &&
          d.resolution,
      )
        ? "Reconciliado · evidência original preservada"
        : event.sanitario_v3_confirmation === "confirmed"
          ? "Confirmado"
          : event.sanitario_v3_confirmation === "collision"
            ? "Conflitante"
            : event.sanitario_v3_confirmation === "late"
              ? "Registro tardio · requer reconciliação"
              : data.queue.some(
                    (op) => op.record.payload?.event?.id === event.id,
                  )
                ? "Pendente"
                : "Salvo localmente"}
    </p>
  );
}

function ParticipationControlsV3({
  data,
  open,
  busy,
  sync,
  userId,
  finalSequences,
  setFinalSequences,
  send,
}: {
  data: CollaborationViewDataV3;
  open: boolean;
  busy: boolean;
  sync: ReturnType<typeof readSanitaryPlanningSyncContextV2>;
  userId: string;
  finalSequences: Record<string, string>;
  setFinalSequences: Dispatch<SetStateAction<Record<string, string>>>;
  send: CollaborationSendV3;
}) {
  const disabled = busy || !sync;
  return (
    <>
      {" "}
      <div className="flex flex-wrap gap-2">
        {open && (!data.draft || data.draft.completed) && (
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => send("participate")}
          >
            Iniciar participação
          </Button>
        )}
        {open && data.draft && !data.draft.completed && (
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => send("complete")}
          >
            Concluir minha atuação
          </Button>
        )}
      </div>
      <ul className="text-xs">
        {data.participants.map((p) => (
          <li key={p.id}>
            Participante {p.actor_user_id} · dispositivo {p.client_id} ·{" "}
            {p.final_sequence === null
              ? "atuação em andamento"
              : `sequência final ${p.final_sequence}`}{" "}
            ·{" "}
            {
              data.declarations.filter((o) => o.participation_id === p.id)
                .length
            }{" "}
            operação(ões) recebida(s)
          </li>
        ))}
      </ul>
      {open &&
        data.participants
          .filter(
            (p) =>
              p.actor_user_id === userId &&
              p.client_id === sync?.clientId &&
              p.final_sequence === null &&
              p.id !== data.draft?.id,
          )
          .map((p) => (
            <div key={p.id} className="space-y-2 text-xs">
              <label>
                Sequência final da participação anterior {p.id}
                <Input
                  aria-label={`Sequência final ${p.id}`}
                  type="number"
                  min="0"
                  max="100000"
                  value={finalSequences[p.id] ?? ""}
                  onChange={(e) =>
                    setFinalSequences((x) => ({ ...x, [p.id]: e.target.value }))
                  }
                />
              </label>
              <Button
                size="sm"
                disabled={disabled || !finalSequences[p.id]}
                onClick={() =>
                  send("complete", {
                    participation_id: p.id,
                    final_sequence: Number(finalSequences[p.id]),
                  })
                }
              >
                Concluir participação anterior
              </Button>
            </div>
          ))}
    </>
  );
}

function AnimalResultsV3({
  data,
  animalLabel,
}: {
  data: CollaborationViewDataV3;
  animalLabel: (id: string) => string;
}) {
  return (
    <details>
      <summary>Resultados por animal e por Evento</summary>
      <ul className="text-xs">
        {data.animals.map((animal) => (
          <li key={animal.animal_id}>
            {animalLabel(animal.animal_id)}: {animal.planned_status}{" "}
            {animal.not_executed_reason}{" "}
            {animal.execution_evento_id &&
              `· Evento ${animal.execution_evento_id}`}
          </li>
        ))}
      </ul>
      {data.result && (
        <p className="text-xs">
          Resultado confirmado · revisão {data.result.revision} ·{" "}
          {data.result.snapshot.events.length} Evento(s) e evidência(s) ·{" "}
          {
            data.result.snapshot.animals.filter(
              (x) => x.planned_status === "executado",
            ).length
          }{" "}
          animais atendidos ·{" "}
          {
            data.result.snapshot.animals.filter(
              (x) => x.planned_status === "nao_executado",
            ).length
          }{" "}
          não executados. Snapshot {data.result.id}.
        </p>
      )}
    </details>
  );
}

function ClosureControlsV3({
  data,
  outstanding,
  animalLabel,
  busy,
  sync,
  reasons,
  setReasons,
  animalsWithReasons,
  send,
}: {
  data: CollaborationViewDataV3;
  outstanding: CollaborationViewDataV3["animals"];
  animalLabel: (id: string) => string;
  busy: boolean;
  sync: ReturnType<typeof readSanitaryPlanningSyncContextV2>;
  reasons: Record<string, string>;
  setReasons: Dispatch<SetStateAction<Record<string, string>>>;
  animalsWithReasons: { animal_id: string; reason: string }[];
  send: CollaborationSendV3;
}) {
  const disabled = busy || !sync;
  return (
    <>
      {outstanding.map((animal) => (
        <label key={animal.animal_id} className="block text-xs">
          Motivo da não execução · {animalLabel(animal.animal_id)}
          <Input
            aria-label={`Motivo da não execução ${animal.animal_id}`}
            value={
              reasons[animal.animal_id] ?? animal.not_executed_reason ?? ""
            }
            onChange={(e) =>
              setReasons((x) => ({
                ...x,
                [animal.animal_id]: e.target.value,
              }))
            }
          />
        </label>
      ))}
      <Button
        size="sm"
        disabled={disabled || animalsWithReasons.some((x) => !x.reason.trim())}
        onClick={() =>
          send("prepare_close", { not_executed: animalsWithReasons })
        }
      >
        Preparar fechamento gerencial
      </Button>
      {data.agenda.closing_barrier && (
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={disabled}
            onClick={() =>
              send("confirm_close", {
                barrier_id: data.agenda.closing_barrier!.barrier_id,
              })
            }
          >
            Confirmar fechamento revisado
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => send("cancel_preparation")}
          >
            Cancelar preparação
          </Button>
        </div>
      )}
    </>
  );
}

function CancelContinuationV3({
  data,
  busy,
  sync,
  reason,
  send,
}: Pick<ContinuationControlsV3, "data" | "busy" | "sync" | "reason" | "send">) {
  if (!data.agenda.metadata?.continuation_request_id) return null;
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy || !sync || !reason.trim()}
      onClick={() => send("cancel_continuation", { reason })}
    >
      Cancelar continuidade sem execução
    </Button>
  );
}

function HistoricalEvidenceV3({
  data,
  managerial,
  busy,
  sync,
  reason,
  send,
}: Pick<
  ContinuationControlsV3,
  "data" | "managerial" | "busy" | "sync" | "reason" | "send"
>) {
  return (
    <>
      {" "}
      {data.events
        .filter(
          (e) =>
            e.sanitario_v3_confirmation === "collision" &&
            !data.declarations.some((d) => d.evento_id === e.id),
        )
        .map((event) => (
          <div key={event.id} className="space-y-2 border-l-2 pl-2 text-xs">
            <p>
              Evidência conflitante anterior · Evento {event.id} · aguardando
              classificação explícita. Para reconhecer outra aplicação, registre
              evidência factual completa; a projeção histórica não preserva
              todos os parâmetros de efeitos.
            </p>
            {managerial && (
              <div className="flex flex-wrap gap-2">
                {["duplicate", "rejected"].map((decision) => (
                  <Button
                    key={decision}
                    size="sm"
                    variant="outline"
                    disabled={busy || !reason.trim() || !sync}
                    onClick={() =>
                      send("resolve", {
                        declaration_id: event.client_op_id,
                        event_id: event.id,
                        decision,
                        reason,
                      })
                    }
                  >
                    {
                      (
                        {
                          additional: "Reconhecer aplicação adicional",
                          duplicate: "Classificar duplicidade",
                          rejected: "Rejeitar evidência",
                        } as Record<string, string>
                      )[decision]
                    }
                  </Button>
                ))}
              </div>
            )}
          </div>
        ))}
    </>
  );
}

async function sendCollaborationV3(
  {
    sync,
    fazendaId,
    agendaId,
    userId,
    current,
    setNotice,
    setBusy,
  }: {
    sync: ReturnType<typeof readSanitaryPlanningSyncContextV2>;
    fazendaId: string;
    agendaId: string;
    userId: string;
    current: {
      current: { userId: string | undefined; farm: string | null | undefined };
    };
    setNotice: (value: string) => void;
    setBusy: (value: boolean) => void;
  },
  action: SanitaryActionV3,
  fields: Record<string, unknown>,
) {
  if (!sync) {
    setNotice("Sincronização sanitária indisponível neste ambiente.");
    return;
  }
  setBusy(true);
  setNotice("");
  try {
    await manageSanitaryAgendaV3(
      {
        fazendaId,
        agendaId,
        actorUserId: userId,
        ...sync,
        assertCurrentContext: () => {
          if (
            !sameContext(
              current.current.userId,
              current.current.farm,
              userId,
              fazendaId,
            )
          )
            throw Error("Contexto de fazenda ou usuário alterado.");
        },
      },
      action,
      fields,
    );
    if (
      sameContext(
        current.current.userId,
        current.current.farm,
        userId,
        fazendaId,
      )
    )
      setNotice("Salvo localmente · pendente de confirmação do servidor.");
  } catch (error) {
    setNotice(operationalMessage(error));
  } finally {
    setBusy(false);
  }
}

function DecisionReasonV3({
  managerial,
  reason,
  setReason,
}: Pick<ContinuationControlsV3, "managerial" | "reason" | "setReason">) {
  if (!managerial) return null;
  return (
    <label className="block text-xs">
      Justificativa da decisão
      <Input
        aria-label="Justificativa da decisão"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </label>
  );
}
