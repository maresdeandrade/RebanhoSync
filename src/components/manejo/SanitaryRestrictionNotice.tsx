import { FACTUAL_SANITARY_NOTICE, SANITARY_CASE_COVERAGE_WARNINGS, type AnimalSanitaryRestriction } from "@/lib/sanitario/compliance/animalRestrictions";

export function SanitaryRestrictionNotice({ restrictions, isLoading = false, isUnavailable = false }: {
  restrictions: readonly AnimalSanitaryRestriction[];
  isLoading?: boolean;
  isUnavailable?: boolean;
}) {
  if (!restrictions.length && !isLoading && !isUnavailable) return null;
  return (
    <div role="status" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">Alertas sanitarios informados</p>
      <ul className="list-disc pl-5">
        {restrictions.map(({ animal, alert, caseIds }) => (
          <li key={animal.id}>
            {animal.identificacao}: {alert.diseaseName}
            {caseIds.length > 0 ? ` (${caseIds.length} caso(s) ${isUnavailable ? "na ultima leitura local" : "aberto(s)"})` : " (sinal no cadastro)"}
          </li>
        ))}
      </ul>
      {isLoading ? <p>{SANITARY_CASE_COVERAGE_WARNINGS.loading}</p> : null}
      {isUnavailable ? <p>{SANITARY_CASE_COVERAGE_WARNINGS.unavailable}</p> : null}
      <p>{FACTUAL_SANITARY_NOTICE}</p>
    </div>
  );
}
