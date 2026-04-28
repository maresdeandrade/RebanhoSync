import type { EventDomain } from "@/lib/events/types";
import type { ProtocoloSanitarioItem } from "@/lib/offline/types";
import type { VeterinaryProductSelection } from "@/lib/sanitario/catalog/products";
import type { TransitChecklistDraft } from "@/lib/sanitario/compliance/transit";
import {
  buildSanitaryExecutionPayload,
  type ResolveSanitaryProtocolProductSelection,
} from "@/lib/sanitario/models/executionPayload";
import { resolveRegistrarTransitChecklistPayload } from "@/pages/Registrar/helpers/payload";

type ProtocolItemLike = Pick<
  ProtocoloSanitarioItem,
  "id" | "protocolo_id" | "produto" | "tipo" | "payload"
>;

export function resolveRegistrarSanitaryFinalizeContext(input: {
  tipoManejo: EventDomain;
  protocoloItem: ProtocolItemLike | null;
  sanitaryTypedProduct: string;
  selectedVeterinaryProductSelection: VeterinaryProductSelection | null;
  resolveProtocolProductSelection: ResolveSanitaryProtocolProductSelection;
  showsTransitChecklist: boolean;
  transitChecklist: TransitChecklistDraft;
  officialTransitChecklistEnabled: boolean;
}) {
  const transitChecklistPayload = resolveRegistrarTransitChecklistPayload({
    showsTransitChecklist: input.showsTransitChecklist,
    transitChecklist: input.transitChecklist,
    officialTransitChecklistEnabled: input.officialTransitChecklistEnabled,
  });

  if (input.tipoManejo !== "sanitario") {
    return {
      sanitaryProductName: "",
      sanitaryProductSelection: null,
      sanitaryProductMetadata: {},
      transitChecklistPayload,
    };
  }

  const sanitaryPayload = buildSanitaryExecutionPayload({
    protocoloItem: input.protocoloItem,
    typedProductName: input.sanitaryTypedProduct,
    selectedVeterinaryProductSelection:
      input.selectedVeterinaryProductSelection,
    resolveProtocolProductSelection: input.resolveProtocolProductSelection,
  });

  return {
    ...sanitaryPayload,
    transitChecklistPayload,
  };
}
