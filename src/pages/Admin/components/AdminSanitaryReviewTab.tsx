import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { listCatalogReviewsV2, previewCatalogReviewV2, submitCatalogReviewV2,
  savePendingCatalogReviewV2, listPendingCatalogReviewsV2, clearPendingCatalogReviewV2,
  type CatalogReviewOptionV2, type CatalogReviewPreviewV2, type CatalogReviewCommandV2 } from "@/lib/sanitario/catalog/sanitaryCatalogReviewV2";

export function AdminSanitaryReviewTab({ userId }: { userId: string | null }) {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => false);
  const [options, setOptions] = useState<CatalogReviewOptionV2[]>([]);
  const [selected, setSelected] = useState("");
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<CatalogReviewPreviewV2 | null>(null);
  const [decision, setDecision] = useState({ reason: "", confirmed: false });
  const { reason, confirmed } = decision;
  const [pending, setPending] = useState<CatalogReviewCommandV2[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const protocol = options.find((option) => option.id === selected);
  const decisionDisabled = busy || !userId || !confirmed || reason.trim().length < 10 || !online;
  useEffect(() => {
    let active = true;
    if (!userId) { setPending([]); return; }
    try { setPending(listPendingCatalogReviewsV2(userId)); }
    catch { setMessage("Armazenamento local indisponível. A decisão só será enviada quando a intenção puder ser preservada."); }
    void listCatalogReviewsV2().then((data) => { if (active) setOptions(data); })
      .catch((error) => { if (active) setMessage(String(error.message ?? error)); });
    return () => { active = false; };
  }, [userId]);

  async function loadPreview() {
    if (!protocol) return;
    setBusy(true); setPreview(null); setDecision({ reason: "", confirmed: false }); setMessage("");
    try { setPreview(await previewCatalogReviewV2(protocol, itemIds)); }
    catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function send(command: CatalogReviewCommandV2) {
    if (!userId || busy) return;
    setBusy(true); setMessage("");
    try {
      savePendingCatalogReviewV2(userId, command);
      setPending(listPendingCatalogReviewsV2(userId));
      const receipt = await submitCatalogReviewV2(command);
      clearPendingCatalogReviewV2(userId, command.requestId);
      setPending(listPendingCatalogReviewsV2(userId));
      setPreview(null); setDecision({ reason: "", confirmed: false });
      setMessage(`Decisão ${receipt.result === "approved" ? "aprovada e publicada" : "rejeitada"}: ${receipt.decision_reference}.`);
      setOptions(await listCatalogReviewsV2());
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  function decide(result: "approved" | "rejected") {
    if (!preview || !confirmed) return;
    void send({ requestId: crypto.randomUUID(), protocolId: preview.protocol_id, expectedVersion: preview.expected_version,
      itemIds: preview.item_ids, digest: preview.reviewed_content_digest, result, justification: reason });
  }

  return <Card>
    <CardHeader><CardTitle>Curadoria sanitária global</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p>A decisão usa sua identidade autenticada. Não exige fazenda ou veterinário executor. Produto e comprovação permanecem requisitos da execução quando aplicáveis.</p>
      {message && <p role="status">{message}</p>}
      {pending.map((command) => <div key={command.requestId} className="space-x-2">
        <span>Decisão com confirmação pendente: {command.requestId}</span>
        <Button disabled={busy || !online} onClick={() => void send(command)}>Retomar decisão</Button>
      </div>)}
      <Label htmlFor="sanitary-review-protocol">Protocolo</Label>
      <select id="sanitary-review-protocol" value={selected} disabled={busy} onChange={(event) => {
        setSelected(event.target.value); setItemIds([]); setPreview(null); setDecision({ reason: "", confirmed: false });
      }} className="w-full rounded-md border border-input bg-background p-2">
        <option value="">Selecione uma versão</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name} — v{option.version}</option>)}
      </select>
      {protocol?.items.map((item) => <Label key={item.id} className="flex items-center gap-2">
        <Checkbox checked={itemIds.includes(item.id)} disabled={busy} onCheckedChange={(checked) => {
          setItemIds((ids) => checked ? [...ids, item.id] : ids.filter((id) => id !== item.id)); setPreview(null); setDecision({ reason: "", confirmed: false });
        }} />{item.logical_item_key} — v{item.version}
      </Label>)}
      <Button onClick={() => void loadPreview()} disabled={busy || !userId || !itemIds.length || !online}>Revisar conteúdo e fontes</Button>
      {preview && <div className="space-y-3">
        <ReviewEvidence preview={preview} />
        <Label htmlFor="sanitary-review-reason">Justificativa da decisão</Label>
        <Textarea id="sanitary-review-reason" value={reason} maxLength={2000} onChange={(event) => setDecision({ ...decision, reason: event.target.value })} disabled={busy} />
        <Label className="flex items-center gap-2"><Checkbox checked={confirmed} onCheckedChange={(value) => setDecision(current => ({ ...current, confirmed: value === true }))} disabled={busy} />Confirmo a decisão sobre o conteúdo e as versões selecionadas</Label>
        <div className="flex gap-2">
          <Button disabled={decisionDisabled || preview.blockers.length > 0} onClick={() => decide("approved")}>Aprovar e publicar versão</Button>
          <Button variant="outline" disabled={decisionDisabled} onClick={() => decide("rejected")}>Registrar rejeição</Button>
        </div>
      </div>}
    </CardContent>
  </Card>;
}

function ReviewEvidence({ preview }: { preview: CatalogReviewPreviewV2 }) {
  return <>
    <p>Hash do conteúdo revisado: <code className="break-all">{preview.reviewed_content_digest}</code></p>
    {preview.blockers.length > 0 && <div role="alert">Publicação bloqueada: {preview.blockers.join("; ")}</div>}
    <details><summary>Regras, versões e evidências registradas</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(preview.content, null, 2)}</pre></details>
  </>;
}

function subscribeOnline(notify: () => void) {
  window.addEventListener("online", notify); window.addEventListener("offline", notify);
  return () => { window.removeEventListener("online", notify); window.removeEventListener("offline", notify); };
}

function errorMessage(error: unknown) {
  const value = error as { code?: string; message?: string };
  if (value.code === "42501") return "Sem permissão para revisão global. A sessão ou o acesso deve ser verificado.";
  if (value.code === "40001") return "O conteúdo, a versão ou a decisão mudou. Revise o estado atual antes de uma nova decisão.";
  return value.message ?? "Não foi possível confirmar a decisão. A intenção local foi preservada para retomada.";
}
