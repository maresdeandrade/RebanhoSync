import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PlanContextFields } from "./SanitaryPlanContextFieldsV2";
import { SanitaryRuleContextEditorV2 } from "./SanitaryRuleContextEditorV2";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  readSanitaryAutomationPlanV2,
  resolveSanitaryAutomationRuleV2,
  saveSanitaryAutomationPlanV2,
  selectSanitaryAutomationRuleV2,
  type SanitaryAutomationDraftV2,
} from "@/lib/sanitario/agenda/sanitaryAutomationPlanV2";
import { previewSanitaryAutomaticPlanV2 } from "@/lib/sanitario/agenda/sanitaryAutomaticGenerationV2";
import { sanitaryPlanningBlockersV2 } from "@/lib/sanitario/preview/sanitaryWindowPlanningPreviewV2";
import { formatSanitaryProtocolItemLabelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import {
  EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
  type SanitaryProtocolWindowSourceV2,
} from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import {
  sanitaryAutomationTodayV2,
  useSanitaryAutomaticGenerationV2,
} from "@/pages/ProtocolosSanitarios/helpers/useSanitaryAutomaticGenerationV2";

type Props = {
  fazendaId: string;
  actorId: string;
  source: SanitaryProtocolWindowSourceV2 | undefined;
};
const emptyDraft: SanitaryAutomationDraftV2 = {
  rules: [],
  context: EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
};

export function SanitaryAutomaticPlanPanelV2({
  fazendaId,
  actorId,
  source,
}: Props) {
  const config = source?.farmConfig;
  const plan = readSanitaryAutomationPlanV2(config);
  const revision = plan?.revision ?? 0;
  const active = plan?.enabled === true;
  const serializedPlan = JSON.stringify(plan);
  const [draft, setDraft] = useState<SanitaryAutomationDraftV2>(
    plan ?? emptyDraft,
  );
  const [confirmed, setConfirmed] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { reevaluate, message, busy } = useSanitaryAutomaticGenerationV2(
    fazendaId,
    source,
  );
  useEffect(() => {
    setDraft(
      serializedPlan === "null" ? emptyDraft : JSON.parse(serializedPlan),
    );
    setConfirmed(false);
    setOpen(false);
  }, [serializedPlan, fazendaId]);
  const preview = useMemo(
    () =>
      open && source
        ? previewSanitaryAutomaticPlanV2(
            source,
            draft,
            sanitaryAutomationTodayV2(),
          )
        : { entries: [], toCreate: 0 },
    [source, draft, open],
  );
  const options = useMemo(() => open ? planRuleOptions(source, fazendaId) : [], [source, fazendaId, open]);
  const unavailable = draft.rules.filter((rule) => !options.some((option) =>
    option.rule.itemId === rule.itemId && source && resolveSanitaryAutomationRuleV2(source.catalog, rule),
  ));
  const updateDraft: React.Dispatch<React.SetStateAction<SanitaryAutomationDraftV2>> = (value) => {
    setConfirmed(false);
    setDraft(value);
  };
  async function save(enabled: boolean) {
    setSaving(true);
    setError(null);
    try {
      await saveSanitaryAutomationPlanV2({
        fazendaId,
        actorId,
        draft,
        enabled,
        confirmed,
        expectedRevision: revision,
      });
      setConfirmed(false);
      await reevaluate();
    } catch (cause) {
      setError(planSaveError(cause));
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      aria-label="Plano de geração automática"
      className="space-y-4 rounded-lg border border-border p-4"
    >
      <h2 className="text-lg font-semibold">Plano de geração automática</h2>
      <p className="text-sm text-muted-foreground">
        Configure as regras autorizadas para gerar tarefas neste dispositivo.
        Planejar não registra aplicação, estoque ou carência.
      </p>
      <p role="status">
        {active
          ? "Plano automático ativo"
          : "Plano automático desativado"}
      </p>
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer font-medium">Configurar plano automático</summary>
        {open ? <fieldset disabled={saving} className="space-y-4 pt-4">
            <legend className="sr-only">Configuração do plano automático</legend>
            <p className="text-sm text-muted-foreground">O contexto geral vale para todas as regras selecionadas. Ajuste uma regra somente quando necessário.</p>
            <PlanContextFields
              context={draft.context}
              onChange={(context) =>
                updateDraft((previous) => ({ ...previous, context }))
              }
            />
            <PlanRuleChoices
              options={options}
              source={source}
              draft={draft}
              saving={saving}
              setDraft={updateDraft}
            />
            {unavailable.length ? <div role="alert" className="space-y-2 text-sm">
              <p>{unavailable.length} regra(s) do plano salvo estão indisponíveis ou com versão alterada. Remova-as antes de ativar uma revisão.</p>
              <details><summary>Revisar seleções indisponíveis</summary>
                <ul>{unavailable.map((rule) => <li key={rule.itemId}>
                  {formatSanitaryProtocolItemLabelV2(source?.catalog.items.find((item) => item.id === rule.itemId)?.logicalItemKey ?? rule.itemId)} · versão {rule.itemVersion}
                  <Button type="button" variant="outline" size="sm" onClick={() => updateDraft((previous) => ({
                    ...previous, rules: previous.rules.filter((entry) => entry.itemId !== rule.itemId),
                  }))}>Remover seleção</Button>
                </li>)}</ul>
              </details>
            </div> : null}
            <p className="text-sm text-muted-foreground">Regras pendentes, restrições e justificativas técnicas: <Link className="underline" to="/protocolos-sanitarios/catalogo-v2">Consultar catálogo sanitário</Link>.</p>
            <PlanPreview preview={preview} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                aria-label="Confirmar ativação do plano"
                checked={confirmed}
                onCheckedChange={(value) => setConfirmed(value === true)}
              />
              Revisei o plano e autorizo a geração automática das regras selecionadas.
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={saving || !confirmed || !draft.rules.length || unavailable.length > 0}
                onClick={() => save(true)}
              >
                {active
                  ? "Salvar revisão do plano"
                  : "Ativar plano automático"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving || !active}
                onClick={() => save(false)}
              >
                Desativar plano automático
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || saving}
                onClick={() => reevaluate()}
              >
                Reavaliar plano
              </Button>
            </div>
            <GeneratedPlanAgendas source={source} />
        </fieldset> : null}
      </details>
      <PlanFeedback message={message} error={error} />
    </section>
  );
}

function planSaveError(cause: unknown) {
  return cause instanceof Error ? cause.message : "Não foi possível salvar o plano.";
}

function PlanFeedback({ message, error }: { message: string | null; error: string | null }) {
  return <>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </>;
}

function PlanPreview({ preview }: {
  preview: ReturnType<typeof previewSanitaryAutomaticPlanV2>;
}) {
  return <>
    <p><strong>{preview.toCreate}</strong> Agenda(s) serão criadas com as condições atuais.</p>
    <details>
      <summary className="cursor-pointer text-sm font-medium">Revisar animais e exclusões</summary>
      <ul className="space-y-2 pt-2 text-sm">
        {preview.entries.map((entry) => <li key={`${entry.itemId}:${entry.animalId}`}>
          {entry.animalLabel}: {entry.eligible ? "Será agendado" : "Não será agendado"} — {entry.reason}
        </li>)}
      </ul>
    </details>
  </>;
}

function GeneratedPlanAgendas({ source }: { source: Props["source"] }) {
  const agendas =
    source?.agendas.filter(
      (agenda) => typeof agenda.metadata.automationKey === "string",
    ) ?? [];
  return (
    <details>
      <summary>Agendas geradas automaticamente ({agendas.length})</summary>
      <ul className="space-y-2 pt-2 text-sm">
        {agendas.map((agenda) => (
          <li key={agenda.id}>
            {String(agenda.metadata.itemLabel)} · {agenda.data_programada} ·{" "}
            {agenda.status}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Consulte e gerencie estas intenções na aba Agenda sanitária.
      </p>
    </details>
  );
}

function PlanRuleChoices({
  source,
  options,
  draft,
  saving,
  setDraft,
}: {
  source: Props["source"];
  options: ReturnType<typeof planRuleOptions>;
  draft: SanitaryAutomationDraftV2;
  saving: boolean;
  setDraft: React.Dispatch<React.SetStateAction<SanitaryAutomationDraftV2>>;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">Regras do plano</legend>
      {!options.length ? <p className="text-sm text-muted-foreground">Nenhuma regra elegível para ativação no catálogo disponível.</p> : null}
      {options.map(({ rule, item, label }) => {
        const checked = draft.rules.some(
          (entry) => entry.itemId === rule.itemId && source && resolveSanitaryAutomationRuleV2(source.catalog, entry),
        );
        return (
          <div key={rule.itemId} className="space-y-1 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox
                aria-label={`Automatizar ${label}`}
                checked={checked}
                disabled={saving}
                onCheckedChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    rules:
                      value === true
                        ? [
                            ...previous.rules.filter(
                              (entry) => entry.itemId !== rule.itemId,
                            ),
                            rule,
                          ]
                        : previous.rules.filter(
                            (entry) => entry.itemId !== rule.itemId,
                          ),
                  }))
                }
              />
              {label}
            </label>
            {checked ? <SanitaryRuleContextEditorV2 item={item} source={source} context={draft.ruleContexts?.[rule.itemId] ?? draft.context}
              hasOverride={Boolean(draft.ruleContexts?.[rule.itemId])}
              onReset={() => setDraft((previous) => {
                const ruleContexts = { ...previous.ruleContexts };
                delete ruleContexts[rule.itemId];
                return { ...previous, ruleContexts };
              })}
              onChange={(context) => setDraft((previous) => ({ ...previous, ruleContexts: { ...previous.ruleContexts, [rule.itemId]: context } }))} /> : null}
          </div>
        );
      })}
    </fieldset>
  );
}

function planRuleOptions(source: Props["source"], fazendaId: string) {
  if (!source) return [];
  return source.catalog.items.flatMap((item) => {
    const protocol = source.catalog.protocols.find(
      (entry) => entry.id === item.protocolId,
    );
    return protocol && (!protocol.fazendaId || protocol.fazendaId === fazendaId)
      && !sanitaryPlanningBlockersV2(protocol, item, "automatic").length
      ? [
          {
            rule: selectSanitaryAutomationRuleV2(protocol, item),
            item,
            label: `${protocol.name} — ${formatSanitaryProtocolItemLabelV2(item.logicalItemKey)}`,
          },
        ]
      : [];
  });
}
