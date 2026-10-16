import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  readSanitaryAutomationPlanV2,
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
  }, [serializedPlan, fazendaId]);
  const preview = useMemo(
    () =>
      source
        ? previewSanitaryAutomaticPlanV2(
            source,
            draft,
            sanitaryAutomationTodayV2(),
          )
        : { entries: [], toCreate: 0 },
    [source, draft],
  );
  const options = planRuleOptions(source);
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
        Confirme uma vez o plano. Regras autorizadas passam a gerar tarefas
        neste dispositivo ao abrir a Central, atualizar os dados e reconectar.
        Planejar não registra aplicação, estoque ou carência.
      </p>
      <p role="status">
        {active
          ? "Plano automático ativo"
          : "Plano automático desativado"}
      </p>
      <PlanContextFields
        context={draft.context}
        onChange={(context) =>
          setDraft((previous) => ({ ...previous, context }))
        }
      />
      <PlanRuleChoices
        options={options}
        draft={draft}
        saving={saving}
        setDraft={setDraft}
      />
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
          disabled={saving || !confirmed || !draft.rules.length}
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
  options,
  draft,
  saving,
  setDraft,
}: {
  options: ReturnType<typeof planRuleOptions>;
  draft: SanitaryAutomationDraftV2;
  saving: boolean;
  setDraft: React.Dispatch<React.SetStateAction<SanitaryAutomationDraftV2>>;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">Regras do plano</legend>
      {options.map(({ rule, label, blockers }) => {
        const checked = draft.rules.some(
          (entry) => entry.itemId === rule.itemId,
        );
        return (
          <div key={rule.itemId} className="space-y-1 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox
                aria-label={`Automatizar ${label}`}
                checked={checked}
                disabled={saving || (blockers.length > 0 && !checked)}
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
            {blockers.length ? (
              <p className="text-muted-foreground">{blockers.join(" ")}</p>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}

function planRuleOptions(source: Props["source"]) {
  if (!source) return [];
  return source.catalog.items.flatMap((item) => {
    const protocol = source.catalog.protocols.find(
      (entry) => entry.id === item.protocolId,
    );
    return protocol
      ? [
          {
            rule: selectSanitaryAutomationRuleV2(protocol, item),
            label: `${protocol.name} — ${formatSanitaryProtocolItemLabelV2(item.logicalItemKey)}`,
            blockers: sanitaryPlanningBlockersV2(protocol, item, "automatic"),
          },
        ]
      : [];
  });
}

const contextFields = [
  {
    key: "rabiesRiskArea",
    label: "Área de risco do plano",
    options: [
      ["true", "Sim"],
      ["false", "Não"],
    ],
  },
  {
    key: "sanitaryCadence",
    label: "Cadência do plano",
    options: [
      ["annual", "Anual"],
      ["semiannual", "Semestral"],
    ],
  },
  {
    key: "reproductiveContext",
    label: "Contexto reprodutivo do plano",
    options: [
      ["prepartum", "Pré-parto"],
      ["peripartum", "Periparto"],
    ],
  },
  {
    key: "management",
    label: "Manejo do plano",
    options: [
      ["pre_weaning", "Pré-desmama"],
      ["rearing", "Recria"],
      ["pre_feedlot", "Pré-confinamento"],
      ["deferred_pasture", "Pasto vedado"],
    ],
  },
] as const;

function PlanContextFields({
  context,
  onChange,
}: {
  context: SanitaryAutomationDraftV2["context"];
  onChange: (value: SanitaryAutomationDraftV2["context"]) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {contextFields.map((field) => (
        <label key={field.key} className="space-y-1 text-sm">
          <span>{field.label}</span>
          <select
            aria-label={field.label}
            className="h-11 w-full rounded-xl border border-border bg-background px-3"
            value={String(context[field.key] ?? "")}
            onChange={(event) => {
              const value = event.target.value;
              onChange({
                ...context,
                [field.key]: contextFieldValue(field.key, value),
              });
            }}
          >
            <option value="">Não informado</option>
            {field.options.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

function contextFieldValue(key: string, value: string) {
  if (!value) return null;
  return key === "rabiesRiskArea" ? value === "true" : value;
}
