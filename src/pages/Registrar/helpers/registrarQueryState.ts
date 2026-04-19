import type { EventDomain } from "@/lib/events/types";
import type { ReproTipoEnum } from "@/lib/offline/types";

const REGISTRAR_QUERY_DOMAINS: EventDomain[] = [
  "sanitario",
  "pesagem",
  "movimentacao",
  "nutricao",
  "financeiro",
  "reproducao",
];

export function isRegistrarQueryDomain(value: string | null): value is EventDomain {
  if (!value) return false;
  return REGISTRAR_QUERY_DOMAINS.includes(value as EventDomain);
}

export type RegistrarParsedQueryState<QuickActionKey extends string> = {
  sourceTaskId: string | null;
  domain: EventDomain | null;
  natureza: string | null;
  quickAction: QuickActionKey | null;
  animalId: string | null;
  loteId: string | null;
  sanitaryPrefill: {
    protocoloId: string | null;
    protocoloItemId: string | null;
    produto: string | null;
    sanitarioTipo: string | null;
  };
  reproTipo: ReproTipoEnum | null;
  shouldOpenChooseActionStep: boolean;
};

export function parseRegistrarQueryState<QuickActionKey extends string>(input: {
  searchParams: URLSearchParams;
  isQuickActionKey: (value: string | null) => value is QuickActionKey;
  isReproTipoEnum: (value: string | null) => value is ReproTipoEnum;
}): RegistrarParsedQueryState<QuickActionKey> {
  const sourceTaskId = input.searchParams.get("sourceTaskId");
  const domainParam = input.searchParams.get("dominio");
  const quickParam = input.searchParams.get("quick");
  const animalId = input.searchParams.get("animalId");

  const domain = isRegistrarQueryDomain(domainParam) ? domainParam : null;
  const quickAction = input.isQuickActionKey(quickParam) ? quickParam : null;
  const reproTipoRaw = input.searchParams.get("reproTipo");
  const reproTipo = input.isReproTipoEnum(reproTipoRaw) ? reproTipoRaw : null;

  return {
    sourceTaskId,
    domain,
    natureza: input.searchParams.get("natureza"),
    quickAction,
    animalId,
    loteId: input.searchParams.get("loteId"),
    sanitaryPrefill: {
      protocoloId: input.searchParams.get("protocoloId"),
      protocoloItemId: input.searchParams.get("protocoloItemId"),
      produto: input.searchParams.get("produto"),
      sanitarioTipo: input.searchParams.get("sanitarioTipo"),
    },
    reproTipo,
    shouldOpenChooseActionStep: Boolean((domain && animalId) || (quickAction && animalId)),
  };
}
