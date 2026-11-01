import { FACTUAL_SANITARY_NOTICE, SANITARY_CASE_COVERAGE_WARNINGS, type AnimalSanitaryRestriction } from "@/lib/sanitario/compliance/animalRestrictions";

type SanitaryRestrictionNoticeProps = {
  restrictions: readonly AnimalSanitaryRestriction[];
  isLoading?: boolean;
  isUnavailable?: boolean;
  regulatoryMessage?: string | null;
};

function SanitaryCaseNotice({ restrictions, isLoading = false, isUnavailable = false }: SanitaryRestrictionNoticeProps) {
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

export function SanitaryRestrictionNotice({ regulatoryMessage, ...sanitary }: SanitaryRestrictionNoticeProps) {
  return <>
    <SanitaryCaseNotice {...sanitary} />
    {regulatoryMessage ? (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {regulatoryMessage}
      </div>
    ) : null}
  </>;
}
