import { describe, expect, it, vi } from "vitest";
import { executeObitoAgenda, isObitoAgendaOperation } from "./obito-agenda";

const farmId = crypto.randomUUID();
const transactionId = crypto.randomUUID();
const actorId = crypto.randomUUID();
const context = { fazendaId: farmId, clientTxId: transactionId, clientId: "test-client", actorUserId: actorId };
const command = () => ({ domain: "obito_agenda_v1", client_op_id: crypto.randomUUID(), agenda_id: crypto.randomUUID(), animal_id: crypto.randomUUID(), death_event_id: crypto.randomUUID(), fazenda_id: farmId });

describe("transporte do cancelamento por óbito", () => {
  it.each([
    ["applied", "APPLIED"], ["conflict", "CONFLICT"], ["not_found", "REJECTED"], ["dependency", "RETRYABLE"],
  ])("classifica %s sem confundir zero linhas com aplicação", async (outcome, status) => {
    const operation = command();
    const rpc = vi.fn(async () => ({ data: { outcome, agenda_id: operation.agenda_id }, error: null }));
    expect(isObitoAgendaOperation(operation)).toBe(true);
    expect(await executeObitoAgenda({ rpc }, operation, context)).toMatchObject({ op_id: operation.client_op_id, status });
    expect(rpc).toHaveBeenCalledWith("internal_obito_agenda_cancel", {
      actor_user_id: actorId, fazenda_id: farmId, agenda_id: operation.agenda_id,
      animal_id: operation.animal_id, death_event_id: operation.death_event_id,
      client_op_id: operation.client_op_id, client_tx_id: transactionId, client_id: "test-client",
    });
  });
  it("rejeita fazenda divergente antes de chamar RPC", async () => {
    const rpc = vi.fn();
    expect(await executeObitoAgenda({ rpc }, { ...command(), fazenda_id: crypto.randomUUID() }, context)).toMatchObject({ status: "REJECTED" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("preserva identidade e retenta após falha ou resposta desconhecida", async () => {
    const operation = command();
    const rpc = vi.fn(async () => ({ data: null, error: { message: "unavailable" } }));
    expect(await executeObitoAgenda({ rpc }, operation, context)).toMatchObject({ op_id: operation.client_op_id, status: "RETRYABLE" });
  });
  it.each([["23505", "CONFLICT"], ["42501", "REJECTED"], ["22004", "REJECTED"]])("terminaliza erro SQL %s como %s", async (code, status) => {
    const rpc = vi.fn(async () => ({ data: null, error: { code, message: "terminal" } }));
    expect(await executeObitoAgenda({ rpc }, command(), context)).toMatchObject({ status, retryable: false });
  });
});
