import { buildTransitChecklistPayload, type TransitChecklistDraft } from "@/lib/sanitario/compliance/transit";

type FinanceiroPayloadNatureza =
  | "compra"
  | "venda"
  | "sociedade_entrada"
  | "sociedade_saida"
  | "doacao_entrada"
  | "doacao_saida"
  | "arrendamento";

export function resolveRegistrarTransitChecklistPayload(input: {
  showsTransitChecklist: boolean;
  transitChecklist: TransitChecklistDraft;
  officialTransitChecklistEnabled: boolean;
}) {
  if (!input.showsTransitChecklist) return {};

  return buildTransitChecklistPayload(input.transitChecklist, {
    officialPackEnabled: input.officialTransitChecklistEnabled,
  });
}

export function buildRegistrarFinanceiroPayloadBase(input: {
  natureza: FinanceiroPayloadNatureza;
  hasAnimalId: boolean;
  createdAnimalIds: string[];
}) {
  if (input.natureza === "sociedade_entrada") {
    return { kind: "sociedade_entrada", origem: "registrar_manejo" as const };
  }
  if (input.natureza === "sociedade_saida") {
    return { kind: "sociedade_saida", origem: "registrar_manejo" as const };
  }
  if (input.natureza === "doacao_entrada") {
    return { kind: "doacao_entrada", origem: "registrar_manejo" as const };
  }
  if (input.natureza === "doacao_saida") {
    return { kind: "doacao_saida", origem: "registrar_manejo" as const };
  }
  if (input.natureza === "arrendamento") {
    return { kind: "arrendamento", origem: "registrar_manejo" as const };
  }
  if (input.natureza === "venda") {
    return { kind: "venda_animal", origem: "registrar_manejo" as const };
  }
  if (input.hasAnimalId) {
    return { kind: "compra_animal", origem: "registrar_manejo" as const };
  }
  if (input.createdAnimalIds.length > 0) {
    return {
      kind: "compra_lote_com_animais",
      origem: "registrar_manejo" as const,
      animal_ids: input.createdAnimalIds,
      animais_cadastrados: input.createdAnimalIds.length,
    };
  }

  return { kind: "compra_lote", origem: "registrar_manejo" as const };
}
