import type { SanitaryAutomationDraftV2 } from "@/lib/sanitario/agenda/sanitaryAutomationPlanV2";
const contextFields = [
  { key: "riskContext", label: "Contexto de risco sanitário", options: [["true", "Confirmado"], ["false", "Não confirmado"]] },
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

export function PlanContextFields({
  context,
  onChange,
  prefix = "",
}: {
  prefix?: string;
  context: SanitaryAutomationDraftV2["context"];
  onChange: (value: SanitaryAutomationDraftV2["context"]) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {contextFields.map((field) => (
        <label key={field.key} className="space-y-1 text-sm">
          <span>{field.label}</span>
          <select
            aria-label={`${prefix}${field.label}`}
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
  return (key === "rabiesRiskArea" || key === "riskContext") ? value === "true" : value;
}
