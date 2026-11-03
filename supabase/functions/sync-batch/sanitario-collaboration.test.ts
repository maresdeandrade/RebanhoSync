import { expect, it } from "vitest";
import {
  buildSanitarioSyncV2RpcCall,
  executeSanitarioSyncV2Operation,
  validateSanitarioSyncV2Operation,
} from "./sanitario-v2";

const farm = crypto.randomUUID(),
  tx = crypto.randomUUID();
const context = {
  actorUserId: crypto.randomUUID(),
  fazendaId: farm,
  clientId: "device",
  clientTxId: tx,
  membershipRole: "cowboy",
};
const op = (action = "participate") => ({
  domain: "sanitario_v2",
  contract_version: 3,
  client_op_id: crypto.randomUUID(),
  domain_op_id: crypto.randomUUID(),
  client_tx_id: tx,
  fazenda_id: farm,
  command: "manage_agenda",
  payload: {
    agenda_id: crypto.randomUUID(),
    action,
    participation_id: crypto.randomUUID(),
  },
});
it("routes operational participation through the existing admission", () => {
  const v = validateSanitarioSyncV2Operation(op(), context);
  expect(v.ok).toBe(true);
  if (v.ok)
    expect(
      buildSanitarioSyncV2RpcCall(v.operation, context).args,
    ).toMatchObject({
      payload: { action: "participate" },
      client_id: "device",
    });
});
it("rejects unknown actions and invalid final sequences", () => {
  expect(validateSanitarioSyncV2Operation(op("force_close"), context).ok).toBe(
    false,
  );
  expect(validateSanitarioSyncV2Operation(op("complete"), context).ok).toBe(
    false,
  );
});
it("denies managerial actions to cowboy before RPC", async () => {
  const result = await executeSanitarioSyncV2Operation(
    op("prepare_close"),
    context,
    {
      callRpc: async () => {
        throw Error("must not reach backend");
      },
    } as never,
  );
  expect(result.reason_code).toBe("SANITARIO_ROLE_NOT_ALLOWED");
});
