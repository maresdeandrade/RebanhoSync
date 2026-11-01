import type { Animal, SanitarioCaso } from "@/lib/offline/types";
import { readAnimalSanitaryAlert, type AnimalSanitaryAlertState } from "./alerts";

export type SanitaryRestrictionAnimal = Pick<Animal, "id" | "fazenda_id" | "identificacao" | "payload">;
export type AnimalSanitaryRestriction<T extends SanitaryRestrictionAnimal = SanitaryRestrictionAnimal> = {
  animal: T;
  alert: AnimalSanitaryAlertState;
  caseIds: string[];
};

export const FACTUAL_SANITARY_NOTICE =
  "Avisos sanitarios nao impedem o registro de fato ocorrido. Registrar nao autoriza transito nem comprova conformidade; a leitura usa os dados locais disponiveis.";

export type SanitaryCaseCoverage = "loading" | "unavailable" | "local";
export const SANITARY_CASE_COVERAGE_WARNINGS = {
  loading: "Consulta de casos locais em andamento; cobertura ainda desconhecida.",
  unavailable: "Consulta de casos locais indisponivel; cobertura desconhecida. Sinais ja conhecidos permanecem informativos.",
} as const;

export function buildSanitaryMovementBlockIssues(input: {
  showsTransitChecklist: boolean;
  blockedAnimals: readonly { animal: { identificacao: string } }[];
}) {
  if (!input.showsTransitChecklist || input.blockedAnimals.length === 0) return [];
  const firstBlocked = input.blockedAnimals[0];
  if (!firstBlocked) return [];
  return [input.blockedAnimals.length === 1
    ? `${firstBlocked.animal.identificacao} possui restricao sanitaria informada; confira os casos e requisitos aplicaveis.`
    : `${input.blockedAnimals.length} animal(is) do recorte atual possuem restricoes sanitarias informadas.`];
}

// Read model only: never mutates a case, projection, queue or sanitary decision.
export function listAnimalSanitaryRestrictions<T extends SanitaryRestrictionAnimal>(
  farmId: string | null | undefined,
  animals: readonly T[],
  cases: readonly SanitarioCaso[] = [],
): AnimalSanitaryRestriction<T>[] {
  if (!farmId) return [];
  const byAnimal = new Map<string, SanitarioCaso[]>();
  for (const item of cases) {
    if (item.fazenda_id !== farmId || item.deleted_at || !item.movement_blocked ||
      (item.status !== "aberto" && item.status !== "em_acompanhamento")) continue;
    // An inconsistent open case is still a known restriction, never silent clearance.
    const rows = byAnimal.get(item.animal_id) ?? [];
    rows.push(item);
    byAnimal.set(item.animal_id, rows);
  }
  return [...new Map(animals.filter(a => a.fazenda_id === farmId).map(a => [a.id, a])).values()].flatMap(animal => {
    const legacy = readAnimalSanitaryAlert(animal.payload);
    const active = [...new Map((byAnimal.get(animal.id) ?? []).map(c => [c.id, c])).values()];
    const legacyRestriction = legacy?.status === "suspeita_aberta" && legacy.movementBlocked;
    if (!active.length && !legacyRestriction) return [];
    const names = [...new Set([
      ...active.map(c => `${c.disease_name ?? "caso sanitario aberto"}${c.closed_at ? " (estado divergente; confira o caso)" : ""}`),
      ...(legacyRestriction ? [legacy.diseaseName ?? "suspeita informada no animal"] : []),
    ])];
    // Do not select a clinical winner by timestamp or overwrite the legacy projection.
    const alert = readAnimalSanitaryAlert({ sanidade_alerta: {
      status: "suspeita_aberta", movement_blocked: true, disease_name: names.join("; "),
    } })!;
    return [{ animal, alert, caseIds: active.map(c => c.id).sort() }];
  });
}
