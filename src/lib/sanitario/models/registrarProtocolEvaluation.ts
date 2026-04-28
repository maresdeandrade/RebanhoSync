import type {
  Animal,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import {
  evaluateSanitaryProtocolEligibility,
  type SanitaryProtocolEligibilitySummary,
} from "@/lib/sanitario/engine/protocolRules";

export type RegistrarProtocolItemEvaluation = {
  item: ProtocoloSanitarioItem;
  protocolo: ProtocoloSanitario | null;
  eligibility: SanitaryProtocolEligibilitySummary;
};

export function evaluateRegistrarProtocolItems(input: {
  items: ProtocoloSanitarioItem[];
  protocolsById: Map<string, ProtocoloSanitario>;
  selectedAnimals: Array<
    Pick<Animal, "identificacao" | "sexo" | "data_nascimento">
  >;
}) {
  return input.items
    .map((item) => {
      const protocolo = input.protocolsById.get(item.protocolo_id) ?? null;
      const eligibility = evaluateSanitaryProtocolEligibility(
        item,
        input.selectedAnimals,
        protocolo,
      );

      return {
        item,
        protocolo,
        eligibility,
      };
    })
    .sort((left, right) => {
      if (
        left.eligibility.compatibleWithAll !==
        right.eligibility.compatibleWithAll
      ) {
        return left.eligibility.compatibleWithAll ? -1 : 1;
      }

      return (left.item.dose_num ?? 0) - (right.item.dose_num ?? 0);
    });
}

export function findRegistrarProtocolItemEvaluation(input: {
  protocolItemId: string | null;
  evaluations: RegistrarProtocolItemEvaluation[];
}) {
  if (!input.protocolItemId) return null;
  return (
    input.evaluations.find(({ item }) => item.id === input.protocolItemId) ??
    null
  );
}
