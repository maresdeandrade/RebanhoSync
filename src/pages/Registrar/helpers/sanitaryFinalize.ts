import type { EventDomain } from "@/lib/events/types";
import type { ProtocoloSanitarioItem, SanitarioTipoEnum } from "@/lib/offline/types";
import type { VeterinaryProductSelection } from "@/lib/sanitario/products";
import { buildVeterinaryProductMetadata } from "@/lib/sanitario/products";
import { readSanitaryRegimen } from "@/lib/sanitario/regimen";
import type { TransitChecklistDraft } from "@/lib/sanitario/transit";
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
  resolveProtocolProductSelection: (
    payload: Record<string, unknown> | null | undefined,
    productName: string,
    sanitaryType: SanitarioTipoEnum,
  ) => VeterinaryProductSelection | null;
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

  const sanitaryProductName =
    input.sanitaryTypedProduct.trim() || input.protocoloItem?.produto || "";
  const protocolRegimen = input.protocoloItem
    ? readSanitaryRegimen(input.protocoloItem.payload)
    : null;
  const protocolProductSelection = input.protocoloItem
    ? input.resolveProtocolProductSelection(
        input.protocoloItem.payload,
        input.protocoloItem.produto,
        input.protocoloItem.tipo,
      )
    : null;
  const sanitaryProductSelection =
    input.selectedVeterinaryProductSelection ?? protocolProductSelection;

  const sanitaryProductMetadata = {
    ...buildVeterinaryProductMetadata({
      selectedProduct: sanitaryProductSelection,
      typedName: sanitaryProductName,
      source: sanitaryProductSelection?.origem,
      matchMode: sanitaryProductSelection?.matchMode ?? null,
    }),
    ...(input.protocoloItem
      ? {
          protocolo_item_id: input.protocoloItem.id,
          protocolo_id: input.protocoloItem.protocolo_id,
        }
      : {}),
    ...(protocolRegimen
      ? {
          family_code: protocolRegimen.family_code,
          regimen_version: protocolRegimen.regimen_version,
          milestone_code: protocolRegimen.milestone_code,
          regime_sanitario: protocolRegimen,
        }
      : {}),
  };

  return {
    sanitaryProductName,
    sanitaryProductSelection,
    sanitaryProductMetadata,
    transitChecklistPayload,
  };
}
