import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { showError, showSuccess } from "@/utils/toast";

const NULL_VALUE = "null";

const LoteEditar = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const lote = useLiveQuery(
    () => (id ? db.state_lotes.get(id) : undefined),
    [id],
  );
  const animaisNoLote = useLiveQuery(
    () => (id ? db.state_animais.where("lote_id").equals(id).count() : 0),
    [id],
  );
  const pastoAtual = useLiveQuery(
    () => (lote?.pasto_id ? db.state_pastos.get(lote.pasto_id) : null),
    [lote?.pasto_id],
  );
  const touroAtual = useLiveQuery(
    () => (lote?.touro_id ? db.state_animais.get(lote.touro_id) : null),
    [lote?.touro_id],
  );

  const [nome, setNome] = useState("");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");
  const [touroId, setTouroId] = useState<string>(NULL_VALUE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Pastos não são editados aqui — use a ação "Mudar pasto" no detalhe do lote.
  const touros = useLiveQuery(
    () =>
      lote?.fazenda_id
        ? db.state_animais
            .where("fazenda_id")
            .equals(lote.fazenda_id)
            .filter(
              (animal) =>
                animal.sexo === "M" &&
                (!animal.deleted_at || animal.deleted_at === null),
            )
            .toArray()
        : [],
    [lote?.fazenda_id],
  );

  useEffect(() => {
    if (lote && !isLoaded) {
      setNome(lote.nome ?? "");
      setStatus(lote.status ?? "ativo");
      setTouroId(lote.touro_id ?? NULL_VALUE);
      setIsLoaded(true);
    }
  }, [isLoaded, lote]);

  const touroOptions = [
    { value: NULL_VALUE, label: "Nenhum" },
    ...(touros?.map((t) => ({ value: t.id, label: t.identificacao })) ?? [])
  ];

  const handleSave = async () => {
    if (!lote || !id) {
      showError("Lote nao encontrado.");
      return;
    }

    if (!nome.trim()) {
      showError("Nome do lote e obrigatorio.");
      return;
    }

    setIsSaving(true);
    const op = {
      table: "lotes",
      action: "UPDATE" as const,
      record: {
        id,
        nome: nome.trim(),
        status,
        touro_id: touroId === NULL_VALUE ? null : touroId,
      },
    };

    try {
      await createGesture(lote.fazenda_id, [op]);
      showSuccess("Lote atualizado localmente!");
      navigate(`/lotes/${id}`);
    } catch {
      showError("Erro ao atualizar lote.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!lote || !isLoaded) {
    return (
      <div className="space-y-5 pb-16">
        <PageIntro
          variant="plain"
          eyebrow="Estrutura do rebanho"
          title="Editar lote"
          actions={
            <Button variant="outline" onClick={() => navigate("/lotes")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-16">
      <PageIntro
        variant="plain"
        eyebrow="Estrutura do rebanho"
        title={`Editar ${lote.nome}`}
        meta={
          <>
            <StatusBadge tone="neutral">
              {animaisNoLote ?? 0} animal(is)
            </StatusBadge>
            <StatusBadge tone="neutral">
              {pastoAtual?.nome ?? "Sem pasto"}
            </StatusBadge>
            <StatusBadge tone="neutral">
              {touroAtual?.identificacao ?? "Sem reprodutor"}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(`/lotes/${id}`)} disabled={isSaving}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSaving ? "Salvando..." : "Salvar alteracoes"}
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
                placeholder="Ex: lote de recria, vacas em servico..."
                className="h-12 text-body rounded-xl"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(value: "ativo" | "inativo") => setStatus(value)}
                disabled={isSaving}
              >
                <SelectTrigger id="status" className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>

        <FormSection title="Vinculos operacionais">
          <div className="grid gap-4 md:grid-cols-1">
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
            onClick={() => navigate(`/lotes/${id}`)}
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
            {isSaving ? "Salvando..." : "Salvar alteracoes"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LoteEditar;

