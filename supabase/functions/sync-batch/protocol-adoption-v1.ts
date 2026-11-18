type Client = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{
  data: unknown; error: { code?: string; message?: string } | null;
}> };
type Envelope = Record<string, unknown>;
export function isProtocolAdoptionV1(value: unknown): value is Envelope {
  return !!value && typeof value === "object" &&
    (String((value as Envelope).domain ?? "").startsWith("sanitary_protocol_adoption") || String((value as Envelope).domain ?? "").startsWith("sanitary_strategic_calendar"));
}
export async function executeProtocolAdoptionV1(
  client: Client, op: Envelope, context: { fazendaId: string; clientTxId: string },
) {
  const result = (status: string, reason: string, receipt?: unknown) => ({
    op_id: op.client_op_id, status, reason_code: reason,
    retryable: status === "RETRYABLE", terminal: status !== "RETRYABLE",
    reconciliation_required: true, ...(receipt ? { canonical_result: receipt } : {}),
  });
  const calendar = op.domain === "sanitary_strategic_calendar_v1";
  if ((!calendar && op.domain !== "sanitary_protocol_adoption_v1") || op.contract_version !== 1 ||
      op.fazenda_id !== context.fazendaId || op.client_tx_id !== context.clientTxId)
    return result("REJECTED", "PROTOCOL_ADOPTION_ENVELOPE_INVALID");
  let response;
  try { response = await client.rpc(calendar ? "set_sanitary_strategic_calendar_v1" : "set_sanitary_protocol_adoption_v1", { p_command: op }); }
  catch { return result("RETRYABLE", "PROTOCOL_ADOPTION_RPC_UNCONFIRMED"); }
  if (response.error) {
    const error = response.error;
    if (["PGRST202", "42883"].includes(error.code ?? ""))
      return result("RETRYABLE", "PROTOCOL_ADOPTION_RPC_UNAVAILABLE");
    if (/(PROTOCOL_ADOPTION|STRATEGIC_CALENDAR)_(FORBIDDEN|UNAUTHENTICATED|IDENTITY_REUSE|INVALID|CONFIG_UNAVAILABLE)/.test(error.message ?? ""))
      return result("REJECTED", error.message!);
    return result("RETRYABLE", "PROTOCOL_ADOPTION_RPC_UNCONFIRMED");
  }
  const receipt = response.data as Envelope | null;
  if (!receipt || !["APPLIED", "CONFLICT"].includes(String(receipt.status)))
    return result("RETRYABLE", "PROTOCOL_ADOPTION_RECEIPT_INVALID");
  return result(String(receipt.status), String(receipt.reason_code), receipt);
}
