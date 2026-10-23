import type { FazendaSanidadeConfig } from "@/lib/offline/types";
import type { SanitaryProtocolV2ReadModel } from "../catalog/sanitaryProtocolCatalogV2";
import { sanitaryScheduledDateValidV2 } from "./sanitaryContextualPlanningV2";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

// The versioned protocol already owns official overlays; farm config owns adoption.
// A known UF does not prove focus/perifocus, obligation or individual eligibility.
type RegionalContextInput = {
  protocol: SanitaryProtocolV2ReadModel; config?: FazendaSanidadeConfig | null;
  fazendaId?: string; municipality?: string | null; evaluatedAt: string;
};

function scopedFarmConfig(input: RegionalContextInput) {
  if (!input.fazendaId || !input.config || input.config.deleted_at) return null;
  return input.config.fazenda_id === input.fazendaId ? input.config : null;
}

function adoptedRabiesProtocol(config: FazendaSanidadeConfig | null) {
  const slugs = config?.payload?.activated_template_slugs;
  return Array.isArray(slugs) && slugs.some(slug => typeof slug === "string" && slug.includes("raiva"));
}

function overlayDate(value: unknown) {
  return typeof value === "string" && sanitaryScheduledDateValidV2(value) ? value : null;
}

function overlayCoversMunicipality(overlay: Record<string, unknown>, municipality: string | null | undefined) {
  return typeof overlay.source_ref === "string" &&
    (!Array.isArray(overlay.municipalities) || overlay.municipalities.includes(municipality));
}

function applicableOverlay(overlay: Record<string, unknown>, input: RegionalContextInput) {
  if (!sanitaryScheduledDateValidV2(input.evaluatedAt)) return false;
  const from = overlayDate(overlay.valid_from ?? overlay.valid_as_of);
  const until = overlayDate(overlay.valid_until ?? overlay.review_due);
  if (!from || !until) return false;
  if (from > input.evaluatedAt || until < input.evaluatedAt) return false;
  return overlayCoversMunicipality(overlay, input.municipality);
}

export function resolveSanitaryRabiesRegionalContextV2(input: RegionalContextInput) {
  const config = scopedFarmConfig(input);
  const overlays = record(input.protocol.metadata.official_overlays_materialized);
  const overlay = record(overlays[config?.uf ?? ""]);
  const valid = applicableOverlay(overlay, input);
  return {
    adopted: adoptedRabiesProtocol(config), uf: config?.uf ?? null, municipality: input.municipality ?? null,
    rule: valid ? overlay : null,
    coverage: valid ? "contextual_rule_available" as const : "unresolved" as const,
    mandatory: null, allowsAgendaAuto: false as const,
    explanation: valid ? "Regra regional identificada; condições epidemiológicas e decisão técnica continuam necessárias. Não comprova obrigação individual."
      : "Cobertura regional não comprovada. Consulta e planejamento manual disponíveis, sem inferir obrigação ou autorizar automação.",
  };
}
