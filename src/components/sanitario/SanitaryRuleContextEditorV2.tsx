import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatSanitaryProtocolItemLabelV2, type SanitaryProtocolItemV2ReadModel } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import type { SanitaryOperationalContextV2, SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import { PlanContextFields } from "./SanitaryPlanContextFieldsV2";
import { sanitaryRequiresScheduledContextV2 } from "@/lib/sanitario/agenda/sanitaryContextualPlanningV2";

type Props = {
  item: SanitaryProtocolItemV2ReadModel;
  source: SanitaryProtocolWindowSourceV2 | undefined;
  context: SanitaryOperationalContextV2;
  onChange: (context: SanitaryOperationalContextV2) => void;
  hasOverride: boolean;
  onReset: () => void;
};

export function SanitaryRuleContextEditorV2({ item, source, context, onChange, hasOverride, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const months = item.operationalWindowRule.calendar_months;
  const dated = sanitaryRequiresScheduledContextV2(item);
  const label = formatSanitaryProtocolItemLabelV2(item.logicalItemKey);
  return <details className="pl-6" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>{hasOverride ? "Contexto específico desta regra" : "Usando contexto geral · ajustar esta regra"}</summary>
    {open ? <div className="space-y-2 py-2">
      <p className="text-muted-foreground">{hasOverride ? "Esta regra possui contexto próprio e não acompanha alterações no contexto geral." : "O contexto geral é herdado até você alterar um campo desta regra."}</p>
      {hasOverride ? <Button type="button" variant="outline" size="sm" onClick={onReset}>Usar contexto geral</Button> : null}
      <PlanContextFields prefix={`${label}: `} context={context} onChange={onChange} />
      {item.eligibilityRule.requires_mv_or_management_context ? <PreWeaningBasisFields context={context} onChange={onChange} /> : null}
      {Array.isArray(months) ? <RegionalCalendarField source={source} context={context} onChange={onChange} months={months} label={label} /> : null}
      {dated ? <ScheduledContextFields source={source} context={context} onChange={onChange} /> : null}
    </div> : null}
  </details>;
}

function RegionalCalendarField({ source, context, onChange, months, label }:
  Pick<Props, "source" | "context" | "onChange"> & { months: unknown[]; label: string }) {
  return <label className="flex items-center gap-2 py-2">
    <Checkbox aria-label={`Adotar calendário regional ${label}`}
      checked={Boolean(context.regionalCalendar)}
      onCheckedChange={(checked) => onChange({ ...context, regionalCalendar: checked === true
        ? { uf: source?.farmUf ?? "", months: months.filter((value): value is number => typeof value === "number") } : undefined })} />
    Adotar nesta fazenda o calendário da versão técnica, mês(es) {months.join(", ")}, UF {source?.farmUf ?? "não informada"}.
  </label>;
}

function PreWeaningBasisFields({ context, onChange }: Pick<Props, "context" | "onChange">) {
  const basis = context.preWeaningBasis;
  return <fieldset className="space-y-2 py-2"><legend>Indicação pré-desmama</legend>
    <label className="block">Sistema ou orientação<select aria-label="Indicação pré-desmama" value={basis?.kind ?? ""}
      onChange={(event) => onChange({ ...context, preWeaningBasis: event.target.value
        ? { kind: event.target.value as "intensive_dairy" | "veterinarian", reference: basis?.reference ?? "" } : undefined })}
      className="ml-2 rounded border border-border bg-background p-2">
      <option value="">Não informado</option><option value="intensive_dairy">Sistema intensivo/leiteiro</option><option value="veterinarian">Orientação veterinária</option>
    </select></label>
    {basis ? <label className="block">Referência<input aria-label="Referência da indicação pré-desmama" value={basis.reference}
      onChange={(event) => onChange({ ...context, preWeaningBasis: { ...basis, reference: event.target.value } })}
      className="ml-2 rounded border border-border bg-background p-2" /></label> : null}
  </fieldset>;
}

function ScheduledContextFields({ source, context, onChange }: Pick<Props, "source" | "context" | "onChange">) {
  const scheduled = context.scheduledContext ?? { date: "", reference: "", animalIds: [] };
  const update = (value: Partial<typeof scheduled>) => onChange({ ...context, scheduledContext: { ...scheduled, ...value } });
  return <fieldset className="space-y-2 py-2">
    <legend>Entrada/manejo ou avaliação pré-parto programada</legend>
    <p className="text-muted-foreground">A data representa a tarefa de manejo/avaliação. Não comprova gestação, parto ou intervenção executada.</p>
    <label className="block">Data programada<input aria-label="Data do contexto programado" type="date" value={scheduled.date}
      onChange={(event) => update({ date: event.target.value })} className="ml-2 rounded border border-border bg-background p-2" /></label>
    <label className="block">Referência do contexto<input aria-label="Referência do contexto programado" value={scheduled.reference}
      onChange={(event) => update({ reference: event.target.value })} className="ml-2 rounded border border-border bg-background p-2" /></label>
    <label className="block">Animais deste contexto<select multiple aria-label="Animais do contexto programado" value={scheduled.animalIds}
      onChange={(event) => update({ animalIds: Array.from(event.target.selectedOptions, (option) => option.value) })}
      className="block min-h-24 w-full rounded border border-border bg-background p-2">
      {source?.animals.filter((animal) => animal.status === "ativo" && !animal.deleted_at).map((animal) =>
        <option key={animal.id} value={animal.id}>{animal.nome || animal.identificacao}</option>)}
    </select></label>
  </fieldset>;
}
