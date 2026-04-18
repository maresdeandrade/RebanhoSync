import type { ReproductionEventData } from "@/components/events/ReproductionForm";
import { deriveAnimalTaxonomy } from "@/lib/animals/taxonomy";
import { isFemaleReproductionEligible } from "@/lib/animals/presentation";
import type { Animal, OperationInput } from "@/lib/offline/types";
import type { FarmLifecycleConfig } from "@/lib/farms/lifecycleConfig";
import { prepareReproductionGesture } from "@/lib/reproduction/register";
import { buildRegistrarReproducaoIneligibleIssue } from "@/pages/Registrar/helpers/finalizeGuards";

type PrepareReproductionGestureFn = typeof prepareReproductionGesture;

export type RegistrarPostPartoRedirect = {
  motherId: string;
  eventId: string;
  calfIds: string[];
};

export async function runRegistrarReproductionFinalizeEffect(input: {
  fazendaId: string;
  animalId: string;
  animal: Animal;
  occurredAt: string;
  sourceTaskId: string | null;
  targetLoteId: string | null;
  reproducaoData: ReproductionEventData;
  farmLifecycleConfig: FarmLifecycleConfig;
  prepareReproduction?: PrepareReproductionGestureFn;
}): Promise<
  | {
      issue: string;
      eventId: null;
      ops: [];
      postPartoRedirect: null;
    }
  | {
      issue: null;
      eventId: string;
      ops: OperationInput[];
      postPartoRedirect: RegistrarPostPartoRedirect | null;
    }
> {
  const categoriaLabel = deriveAnimalTaxonomy(input.animal, {
    config: input.farmLifecycleConfig,
  }).display.categoria;

  if (!isFemaleReproductionEligible(input.animal, categoriaLabel)) {
    return {
      issue: buildRegistrarReproducaoIneligibleIssue({
        animalIdentificacao: input.animal.identificacao,
        categoriaLabel,
      }),
      eventId: null,
      ops: [],
      postPartoRedirect: null,
    };
  }

  const prepare = input.prepareReproduction ?? prepareReproductionGesture;
  const built = await prepare({
    fazendaId: input.fazendaId,
    animalId: input.animalId,
    occurredAt: input.occurredAt,
    sourceTaskId: input.sourceTaskId,
    animalIdentificacao: input.animal.identificacao,
    loteId: input.targetLoteId,
    data: input.reproducaoData,
  });

  return {
    issue: null,
    eventId: built.eventId,
    ops: built.ops,
    postPartoRedirect:
      input.reproducaoData.tipo === "parto" && built.calfIds.length > 0
        ? {
            motherId: input.animalId,
            eventId: built.eventId,
            calfIds: built.calfIds,
          }
        : null,
  };
}
