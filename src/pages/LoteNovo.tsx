import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Save, Loader2 } from "lucide-react";

import { FormSection } from "@/components/ui/form-section";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldCombobox } from "@/components/ui/field-combobox";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { getActiveFarmId } from "@/lib/storage";
import { showError, showSuccess } from "@/utils/toast";

const NULL_VALUE = "null";

const LoteNovo = () => {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");
  const [pastoId, setPastoId] = useState<string>(NULL_VALUE);
  const [touroId, setTouroId] = useState<string>(NULL_VALUE);
  const [isSaving, setIsSaving] = useState(false);

  const activeFarmId = getActiveFarmId();

  const pastos = useLiveQuery(
    () =>
      activeFarmId
        ? db.state_pastos.where("fazenda_id").equals(activeFarmId).toArray()
        : [],
    [activeFarmId],
  );
  const touros = useLiveQuery(
    () =>
      activeFarmId
        ? db.state_animais
            .filter(
              (animal) =>
                animal.sexo === "M" &&
                animal.fazenda_id === activeFarmId &&
                (!animal.deleted_at || animal.deleted_at === null),
            )
            .toArray()
        : [],
    [activeFarmId],
  );

  const pastoOptions = [
    { value: NULL_VALUE, label: "Nenhum" },
    ...(pastos?.map((p) => ({ value: p.id, label: p.nome })) ?? [])
  ];

  const touroOptions = [
    { value: NULL_VALUE, label: "Nenhum" },
    ...(touros?.map((t) => ({ value: t.id, label: t.identificacao })) ?? [])
  ];

  const handleSave = async () => {
    const fazendaId = activeFarmId || "";

    if (!fazendaId) {
      showError("Fazenda nao identificada.");
      return;
    }

    if (!nome.trim()) {
      showError("Nome do lote e obrigatorio.");
      return;
    }

    setIsSaving(true);
    const loteId = crypto.randomUUID();
    const now = new Date().toISOString();

    const op = {
      client_op_id: crypto.randomUUID(),
      client_tx_id: crypto.randomUUID(),
      table: "lotes",
      action: "INSERT" as const,
      record: {
        id: loteId,
        fazenda_id: fazendaId,
        nome: nome.trim(),
        status,
        pasto_id: pastoId === NULL_VALUE ? null : pastoId,
        touro_id: touroId === NULL_VALUE ? null : touroId,
        created_at: now,
        updated_at: now,
      },
    };

    try {
      await createGesture(fazendaId, [op]);
      showSuccess("Lote cadastrado localmente!");
      navigate("/lotes");
    } catch {
      showError("Erro ao cadastrar lote.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-16">
      <PageIntro
        variant="plain"
        eyebrow="Estrutura do rebanho"
        title="Novo lote"
        meta={
          <>
            <StatusBadge tone="neutral">
              {pastos?.length ?? 0} pasto(s)
            </StatusBadge>
            <StatusBadge tone="neutral">
              {touros?.length ?? 0} macho(s)
            </StatusBadge>
            <StatusBadge tone={status === "ativo" ? "success" : "neutral"}>
              {status === "ativo" ? "Ativo" : "Inativo"}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/lotes")} disabled={isSaving}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSaving ? "Salvando..." : "Salvar lote"}
            </Button>
          </>
        }
      />

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <FormSection title="Identidade do lote">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome do lote</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Ex: lote A, desmame 2024, matriz norte..."
                className="h-12 text-body rounded-xl"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <div className="grid grid-cols-2 gap-2" id="status">
                <Button
                  type="button"
                  variant={status === "ativo" ? "default" : "outline"}
                  className="h-12 text-base rounded-xl border-2"
                  onClick={() => setStatus("ativo")}
                  disabled={isSaving}
                >
                  Ativo
                </Button>
                <Button
                  type="button"
                  variant={status === "inativo" ? "default" : "outline"}
                  className="h-12 text-base rounded-xl border-2"
                  onClick={() => setStatus("inativo")}
                  disabled={isSaving}
                >
                  Inativo
                </Button>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection title="Contexto inicial">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pasto">Pasto</Label>
              <FieldCombobox
                id="pasto"
                options={pastoOptions}
                value={pastoId}
                onValueChange={(value) => setPastoId(value || NULL_VALUE)}
                placeholder="Nenhum"
                searchPlaceholder="Buscar pasto..."
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="touro">Reprodutor vinculado</Label>
              <FieldCombobox
                id="touro"
                options={touroOptions}
                value={touroId}
                onValueChange={(value) => setTouroId(value || NULL_VALUE)}
                placeholder="Nenhum"
                searchPlaceholder="Buscar touro..."
                disabled={isSaving}
              />
            </div>
          </div>
        </FormSection>

        {/* Rodapé fixo para mobile (DS §7.3) */}
        <div className="sticky bottom-0 inset-x-0 -mx-4 -mb-16 mt-5 border-t-2 border-border bg-card p-4 flex items-center justify-between gap-4 md:hidden z-30 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
          <Button
            type="button"
            variant="outline"
            className="h-14 flex-1 text-base rounded-xl"
            onClick={() => navigate("/lotes")}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-14 flex-1 text-base rounded-xl"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            {isSaving ? "Salvando..." : "Salvar lote"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LoteNovo;

