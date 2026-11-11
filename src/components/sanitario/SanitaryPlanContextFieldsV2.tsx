import type { SanitaryProtocolItemV2ReadModel } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import type { SanitaryOperationalContextV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
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
    key: "management",
    label: "Manejo do plano",
    options: [
      ["pre_feedlot", "Pré-confinamento"],
      ["deferred_pasture", "Pasto vedado"],
    ],
  },
] as const;

export function PlanContextFields({
  items,
  context,
  onChange,
  prefix = "",
}: {
  items: SanitaryProtocolItemV2ReadModel[];
  prefix?: string;
  context: SanitaryOperationalContextV2;
  onChange: (value: SanitaryOperationalContextV2) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {contextFields.filter(field => items.some(item => pertinentField(field.key, item))).map((field) => (
        <label key={field.key} className="space-y-1 text-sm">
          <span>{field.label}</span>
          <select
            aria-label={`${prefix}${field.label}`}
            className="h-11 w-full rounded-xl border border-border bg-background px-3"
            value={field.key === "management" && !["pre_feedlot", "deferred_pasture"].includes(context.management ?? "") ? "" : String(context[field.key] ?? "")}
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

// Presentation only: never project/filter the context value passed to onChange.
function pertinentField(key: typeof contextFields[number]["key"], item: SanitaryProtocolItemV2ReadModel) {
  const recurrence = item.boosterRule.recurrenceRule as { kind?: string } | undefined;
  switch (key) {
    case "riskContext": return item.eligibilityRule.requires_risk_context === true;
    case "rabiesRiskArea": return item.eligibilityRule.requires_risk_area_overlay === true;
    case "sanitaryCadence": return ["annual", "annual_if_risk_area", "annual_or_semester_by_risk"].includes(recurrence?.kind ?? "");
    case "management": return item.eligibilityRule.requires_destination_context === true;
  }
}

function contextFieldValue(key: string, value: string) {
  if (!value) return null;
  return (key === "rabiesRiskArea" || key === "riskContext") ? value === "true" : value;
}
