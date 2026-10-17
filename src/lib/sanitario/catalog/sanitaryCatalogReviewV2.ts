import { supabase } from "@/lib/supabase";
import { z } from "zod";

const commandSchema = z.object({
  requestId: z.string().uuid(), protocolId: z.string().uuid(), expectedVersion: z.number().int().positive(),
  itemIds: z.array(z.string().uuid()).min(1).max(20), digest: z.string().regex(/^[a-f0-9]{64}$/),
  result: z.enum(["approved", "rejected"]), justification: z.string().trim().min(10).max(2000),
});
export type CatalogReviewCommandV2 = z.infer<typeof commandSchema>;
export type CatalogReviewPreviewV2 = {
  protocol_id: string; expected_version: number; item_ids: string[]; reviewed_content_digest: string;
  blockers: string[]; content: Record<string, unknown>;
};
export type CatalogReviewReceiptV2 = { decision_reference: string; actor_id: string; result: string; approved_at: string | null; reviewed_content_digest: string };
export type CatalogReviewOptionV2 = { id: string; name: string; version: number; items: { id: string; logical_item_key: string; version: number }[] };

export async function listCatalogReviewsV2(): Promise<CatalogReviewOptionV2[]> {
  const protocols = await supabase.from("sanitario_protocolos_v2").select("id,name,version").eq("scope", "global").is("deleted_at", null).order("name");
  if (protocols.error) throw protocols.error;
  const items = await supabase.from("sanitario_protocolo_itens_versions_v2").select("id,protocol_id,logical_item_key,version").eq("status", "draft").is("deleted_at", null);
  if (items.error) throw items.error;
  return (protocols.data ?? []).map((p) => ({ ...p, items: (items.data ?? []).filter((i) => i.protocol_id === p.id) }));
}

export async function previewCatalogReviewV2(protocol: CatalogReviewOptionV2, itemIds: string[]): Promise<CatalogReviewPreviewV2> {
  const response = await supabase.rpc("sanitario_catalog_review_preview_v2", { _protocol_id: protocol.id, _expected_version: protocol.version, _item_ids: itemIds });
  if (response.error) throw response.error;
  return response.data as CatalogReviewPreviewV2;
}

export async function submitCatalogReviewV2(command: CatalogReviewCommandV2): Promise<CatalogReviewReceiptV2> {
  const c = commandSchema.parse(command);
  // Identity and trusted time are exclusively resolved inside the authenticated RPC.
  const response = await supabase.rpc("sanitario_catalog_decide_v2", { _protocol_id: c.protocolId,
    _expected_version: c.expectedVersion, _item_ids: c.itemIds, _reviewed_content_digest: c.digest,
    _result: c.result, _justification: c.justification, _request_id: c.requestId });
  if (response.error) throw response.error;
  return response.data as CatalogReviewReceiptV2;
}

const pendingPrefix = (userId: string) => `sanitary-catalog-review-v1:${userId}:`;
// This is a recoverable explicit review intention, not an offline catalog writer.
export function savePendingCatalogReviewV2(userId: string, command: CatalogReviewCommandV2, storage: Storage = localStorage) {
  const parsed = commandSchema.parse(command);
  storage.setItem(pendingPrefix(userId) + parsed.requestId, JSON.stringify(parsed));
}

export function listPendingCatalogReviewsV2(userId: string, storage: Storage = localStorage): CatalogReviewCommandV2[] {
  const result: CatalogReviewCommandV2[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(pendingPrefix(userId))) continue;
    try {
      const parsed = commandSchema.safeParse(JSON.parse(storage.getItem(key) ?? "null"));
      if (parsed.success && key === pendingPrefix(userId) + parsed.data.requestId) result.push(parsed.data);
    } catch { /* Invalid local state cannot create an approval or remove other pending intentions. */ }
  }
  return result;
}

export function clearPendingCatalogReviewV2(userId: string, requestId: string, storage: Storage = localStorage) {
  storage.removeItem(pendingPrefix(userId) + requestId);
}
