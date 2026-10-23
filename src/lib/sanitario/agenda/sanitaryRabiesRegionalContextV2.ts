import type { FazendaSanidadeConfig } from "@/lib/offline/types";
import type { SanitaryProtocolV2ReadModel } from "../catalog/sanitaryProtocolCatalogV2";
import { sanitaryScheduledDateValidV2 } from "./sanitaryContextualPlanningV2";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

// The versioned protocol already owns official overlays; farm config owns adoption.
// A known UF does not prove focus/perifocus, obligation or individual eligibility.
export function resolveSanitaryRabiesRegionalContextV2(input: {
  protocol: SanitaryProtocolV2ReadModel; config?: FazendaSanidadeConfig | null;
  fazendaId?: string; municipality?: string | null; evaluatedAt: string;
}) {
  const config = input.fazendaId && input.config && !input.config.deleted_at && input.config.fazenda_id === input.fazendaId ? input.config : null;
  const slugs = config?.payload?.activated_template_slugs;
  const adopted = Array.isArray(slugs) && slugs.some(slug => typeof slug === "string" && slug.includes("raiva"));
  const overlays = record(input.protocol.metadata.official_overlays_materialized);
  const overlay = record(overlays[config?.uf ?? ""]);
  const from = overlay.valid_from ?? overlay.valid_as_of;
  const until = overlay.valid_until ?? overlay.review_due;
  const municipalities = overlay.municipalities;
  const valid = sanitaryScheduledDateValidV2(input.evaluatedAt) && typeof from === "string" &&
    sanitaryScheduledDateValidV2(from) && from <= input.evaluatedAt && typeof until === "string" &&
    sanitaryScheduledDateValidV2(until) && until >= input.evaluatedAt && typeof overlay.source_ref === "string" &&
    (!Array.isArray(municipalities) || municipalities.includes(input.municipality));
  return {
    adopted, uf: config?.uf ?? null, municipality: input.municipality ?? null,
    rule: valid ? overlay : null,
    coverage: valid ? "contextual_rule_available" as const : "unresolved" as const,
    mandatory: null, allowsAgendaAuto: false as const,
    explanation: valid ? "Regra regional identificada; condições epidemiológicas e decisão técnica continuam necessárias. Não comprova obrigação individual."
      : "Cobertura regional não comprovada. Consulta e planejamento manual disponíveis, sem inferir obrigação ou autorizar automação.",
  };
}
