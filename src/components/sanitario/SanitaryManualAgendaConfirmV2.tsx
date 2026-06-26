import { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createManualSanitaryAgendaV2,
  type CreateManualSanitaryAgendaInputV2,
  type ManualSanitaryAgendaResultV2,
} from "@/lib/sanitario/agenda/sanitaryManualAgendaV2";
import type {
  SanitaryProtocolPrecheckResultV2,
  SanitaryProtocolPrecheckV2,
} from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";
import { formatSanitaryPrecheckStatusV2 } from "@/lib/sanitario/checks/sanitaryPrecheckPresentationV2";

export type SanitaryManualAgendaTargetV2 = {
  fazendaId: string;
  createdBy?: string;
  animalIds?: string[];
};

export type SanitaryManualAgendaConfirmV2Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  precheck: SanitaryProtocolPrecheckV2;
  item: SanitaryProtocolPrecheckResultV2 | null;
  target: SanitaryManualAgendaTargetV2;
  createAgenda?: (
    input: CreateManualSanitaryAgendaInputV2,
  ) => Promise<ManualSanitaryAgendaResultV2>;
  clientOpIdFactory?: () => string;
};

function defaultClientOpIdFactory() {
  return crypto.randomUUID();
}

function mainText(item: SanitaryProtocolPrecheckResultV2) {
  return (
    item.blockers[0] ??
    item.reasons[0] ??
    item.warnings[0] ??
    "Sem motivo resumido informado."
  );
}

function productRequirementWarning(item: SanitaryProtocolPrecheckResultV2) {
  if (item.productRequirementKind === "product_class_group") {
    return "Grupo técnico não define produto, dose nem carência. Esses dados só serão definidos na execução.";
  }
  if (item.productRequirementKind === "product_class") {
    return "Classe técnica não substitui o produto real. O produto executado será informado somente na execução.";
  }
  return null;
}

export function SanitaryManualAgendaConfirmV2({
  open,
  onOpenChange,
  precheck,
  item,
  target,
  createAgenda = createManualSanitaryAgendaV2,
  clientOpIdFactory = defaultClientOpIdFactory,
}: SanitaryManualAgendaConfirmV2Props) {
  const [plannedFor, setPlannedFor] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [clientOpId, setClientOpId] = useState("");
  const [result, setResult] = useState<ManualSanitaryAgendaResultV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlannedFor("");
    setNotes("");
    setConfirmed(false);
    setResult(null);
    setError(null);
    setClientOpId(clientOpIdFactory());
  }, [clientOpIdFactory, open]);

  if (!item) return null;

  const requirementWarning = productRequirementWarning(item);
  const canSubmit = Boolean(plannedFor) && confirmed && !isSubmitting;

  async function handleSubmit() {
    if (!plannedFor || !confirmed) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const created = await createAgenda({
        target: {
          scope: precheck.scope,
          id: precheck.animalOrLotId,
          fazendaId: target.fazendaId,
          animalIds: target.animalIds,
        },
        source: {
          kind: "sanitary_precheck_preview_v2",
          protocolId: item.protocolId,
          familyCode: item.familyCode,
          itemKey: item.itemKey,
          itemLabel: item.itemLabel,
          protocolName: item.protocolName,
          precheckStatus: item.status,
          reasons: item.reasons,
          blockers: item.blockers,
          warnings: item.warnings,
          productRequirementKind: item.productRequirementKind,
          productClass: item.productClass,
          productClassGroupId: item.productClassGroupId,
          productClassGroupName: item.productClassGroupName,
        },
        plannedFor,
        notes,
        createdBy: target.createdBy,
        clientOpId,
        confirmed,
      });
      setResult(created);
    } catch {
      setError("Não foi possível criar a agenda manual com os dados informados.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Confirmar agenda manual
          </DialogTitle>
          <DialogDescription>
            Agenda é uma intenção futura. Não registra execução, não movimenta
            estoque e não calcula carência.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
            <p className="font-semibold text-foreground">{item.protocolName}</p>
            <p className="mt-1 text-muted-foreground">{item.itemLabel}</p>
            <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
              <p>Alvo: {precheck.scope === "lote" ? "Lote" : "Animal"}</p>
              <p>Status: {formatSanitaryPrecheckStatusV2(item.status)}</p>
              <p>Motivo: {mainText(item)}</p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sanitary-manual-agenda-date">Data planejada</Label>
            <Input
              id="sanitary-manual-agenda-date"
              type="date"
              value={plannedFor}
              onChange={(event) => setPlannedFor(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sanitary-manual-agenda-notes">Observação</Label>
            <Textarea
              id="sanitary-manual-agenda-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>Isso cria uma agenda futura, não registra execução.</p>
            <p>
              Produto real, dose, estoque e carência serão definidos somente na
              execução.
            </p>
            {requirementWarning ? <p>{requirementWarning}</p> : null}
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border/70 p-3 text-sm">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              aria-label="Confirmo que esta agenda manual não registra execução"
            />
            <span>
              Confirmo que estou criando apenas uma agenda futura, sem execução,
              estoque ou carência ativa.
            </span>
          </label>

          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {result ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
              Agenda manual criada como intenção futura.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Confirmar agenda manual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
