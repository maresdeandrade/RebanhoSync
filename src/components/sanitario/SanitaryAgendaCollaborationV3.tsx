import { useRef, useState } from "react";
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
  const data = useLiveQuery(async () => {
    if (!user || activeFarmId !== fazendaId) return;
    const ownership = await getCurrentLocalReadOwnership();
    if (ownership.status !== "OWNED" || ownership.currentUserId !== user.id)
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
      sync
        ? currentParticipationV3({
            fazendaId,
            agendaId,
            actorUserId: user.id,
            clientId: sync.clientId,
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
      actorUserId: user.id,
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
  }, [agendaId, fazendaId, user?.id, activeFarmId, sync?.clientId]);
  if (
    !data ||
    !user ||
    data.actorUserId !== user.id ||
    activeFarmId !== fazendaId
  )
    return null;
  const animalLabel = (id: string) =>
    `Animal ${data.animalNames.get(id) ?? id.slice(0, 8)}`;
  const managerial = role === "owner" || role === "manager";
  const open = data.agenda.status === "programada";
  const outstanding = data.animals.filter(
    (x) => x.planned_status !== "executado",
  );
  const animalsWithReasons = outstanding.map((x) => ({
    animal_id: x.animal_id,
    reason: reasons[x.animal_id] ?? x.not_executed_reason ?? "",
  }));
  const send = async (
    action: SanitaryActionV3,
    fields: Record<string, unknown> = {},
  ) => {
    if (!sync) {
      setNotice("Sincronização sanitária indisponível neste ambiente.");
      return;
    }
    const userId = user.id;
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
              current.current.farm !== fazendaId ||
              current.current.userId !== userId
            )
              throw Error("Contexto de fazenda ou usuário alterado.");
          },
        },
        action,
        fields,
      );
      if (
        current.current.farm === fazendaId &&
        current.current.userId === userId
      )
        setNotice("Salvo localmente · pendente de confirmação do servidor.");
    } catch (error) {
      setNotice(operationalMessage(error));
    } finally {
      setBusy(false);
    }
  };
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
      <div className="flex flex-wrap gap-2">
        {open && (!data.draft || data.draft.completed) && (
          <Button
            size="sm"
            disabled={busy || !sync}
            onClick={() => send("participate")}
          >
            Iniciar participação
          </Button>
        )}
        {open && data.draft && !data.draft.completed && (
          <Button
            size="sm"
            disabled={busy || !sync}
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
              p.actor_user_id === user.id &&
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
                disabled={busy || !sync || !finalSequences[p.id]}
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
      {data.queue.map((op) => (
        <p key={op.client_op_id} className="text-xs">
          {op.record.payload?.action ?? "Execução"}:{" "}
          {data.declarations.some(
            (d) => d.id === op.client_op_id && d.resolution,
          )
            ? "Reconciliado · declaração original preservada"
            : op.sync_state === "REJECTED"
              ? `Conflitante/rejeitado · ${operationalMessage(op.blocked_reason ?? "Verifique a sincronização")}`
              : "Pendente de confirmação"}
        </p>
      ))}
      {data.events.map((event) => (
        <p key={event.id} className="text-xs">
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
      ))}
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
      {managerial && (
        <label className="block text-xs">
          Justificativa da decisão
          <Input
            aria-label="Justificativa da decisão"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      )}
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
            disabled={
              busy || !sync || animalsWithReasons.some((x) => !x.reason.trim())
            }
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
                disabled={busy || !sync}
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
                disabled={busy || !sync}
                onClick={() => send("cancel_preparation")}
              >
                Cancelar preparação
              </Button>
            </div>
          )}
        </>
      )}
      {managerial &&
        open &&
        Boolean(data.agenda.metadata?.continuation_request_id) && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !sync || !reason.trim()}
            onClick={() => send("cancel_continuation", { reason })}
          >
            Cancelar continuidade sem execução
          </Button>
        )}
      {data.agenda.status === "fechada" && data.result && (
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
            <div key={request.id} className="text-xs">
              <p>
                Solicitação {request.id} · {request.reason} ·{" "}
                {request.decision ?? "aguardando decisão"}{" "}
                {request.decision_reason}{" "}
                {request.continuation_id &&
                  `· Agenda de continuidade ${request.continuation_id}`}
              </p>
              {managerial && !request.decision && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy || !sync || !reason.trim() || !date}
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
                    disabled={busy || !sync || !reason.trim()}
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
          ))}
        </>
      )}
      {notice && (
        <p role="status" className="text-xs">
          {notice}
        </p>
      )}
    </section>
  );
}
