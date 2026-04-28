import type { EventDomain } from "@/lib/events/types";
import { db } from "@/lib/offline/db";
import type { ProtocoloSanitarioItem, SanitarioTipoEnum } from "@/lib/offline/types";
import type { VeterinaryProductSelection } from "@/lib/sanitario/catalog/products";
import type { TransitChecklistDraft } from "@/lib/sanitario/compliance/transit";
import { resolveRegistrarSanitaryFinalizeContext } from "@/pages/Registrar/helpers/sanitaryFinalize";

type ProtocolItemLike = Pick<
  ProtocoloSanitarioItem,
  "id" | "protocolo_id" | "produto" | "tipo" | "payload"
>;

type LoadProtocolItemFn = (id: string) => Promise<ProtocolItemLike | null | undefined>;

export async function loadRegistrarSanitaryFinalizeContext(input: {
  tipoManejo: EventDomain;
  protocoloItemId: string;
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
  loadProtocolItem?: LoadProtocolItemFn;
}) {
  const loadProtocolItem =
    input.loadProtocolItem ??
    ((id: string) => db.state_protocolos_sanitarios_itens.get(id));

  const protocoloItem =
    input.tipoManejo === "sanitario" && input.protocoloItemId
      ? ((await loadProtocolItem(input.protocoloItemId)) ?? null)
      : null;

  const sanitaryContext = resolveRegistrarSanitaryFinalizeContext({
    tipoManejo: input.tipoManejo,
    protocoloItem,
    sanitaryTypedProduct: input.sanitaryTypedProduct,
    selectedVeterinaryProductSelection: input.selectedVeterinaryProductSelection,
    resolveProtocolProductSelection: input.resolveProtocolProductSelection,
    showsTransitChecklist: input.showsTransitChecklist,
    transitChecklist: input.transitChecklist,
    officialTransitChecklistEnabled: input.officialTransitChecklistEnabled,
  });

  return {
    protocoloItem,
    ...sanitaryContext,
  };
}
