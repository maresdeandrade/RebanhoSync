import { db } from "@/lib/offline/db";
import type {
  Animal,
  Contraparte,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
  SanitarioTipoEnum,
  ProdutoVeterinarioCatalogEntry,
} from "@/lib/offline/types";
import { loadRegulatorySurfaceSource } from "@/lib/sanitario/compliance/regulatoryReadModel";

export async function loadRegistrarBullByIdEffect(input: {
  machoId: string;
  loadBullById?: (machoId: string) => Promise<Animal | undefined>;
}) {
  const loadBullById =
    input.loadBullById ?? ((machoId: string) => db.state_animais.get(machoId));
  return (await loadBullById(input.machoId)) ?? null;
}

export async function loadRegistrarRegulatorySurfaceSourceEffect(input: {
  activeFarmId: string | null;
  loadSource?: (fazendaId: string) => ReturnType<typeof loadRegulatorySurfaceSource>;
}) {
  if (!input.activeFarmId) {
    return null;
  }

  const loadSource = input.loadSource ?? loadRegulatorySurfaceSource;
  return await loadSource(input.activeFarmId);
}

export async function loadRegistrarAnimaisNoLoteEffect(input: {
  selectedLoteId: string;
  semLoteOption: string;
  loadSemLoteAnimais?: () => Promise<Animal[]>;
  loadAnimaisByLote?: (loteId: string) => Promise<Animal[]>;
}) {
  if (!input.selectedLoteId) {
    return [];
  }

  const loadSemLoteAnimais =
    input.loadSemLoteAnimais ??
    (() =>
      db.state_animais
        .filter((animal) => animal.lote_id === null && (!animal.deleted_at || animal.deleted_at === null))
        .toArray());

  const loadAnimaisByLote =
    input.loadAnimaisByLote ??
    ((loteId: string) =>
      db.state_animais
        .where("lote_id")
        .equals(loteId)
        .filter((animal) => !animal.deleted_at || animal.deleted_at === null)
        .toArray());

  if (input.selectedLoteId === input.semLoteOption) {
    return await loadSemLoteAnimais();
  }

  return await loadAnimaisByLote(input.selectedLoteId);
}

export async function loadRegistrarProtocolosEffect(input: {
  activeFarmId: string | null;
  loadProtocolosByFarm?: (fazendaId: string) => Promise<ProtocoloSanitario[]>;
}) {
  if (!input.activeFarmId) {
    return [];
  }

  const loadProtocolosByFarm =
    input.loadProtocolosByFarm ??
    ((fazendaId: string) =>
      db.state_protocolos_sanitarios
        .where("fazenda_id")
        .equals(fazendaId)
        .filter((protocolo) => protocolo.ativo && (!protocolo.deleted_at || protocolo.deleted_at === null))
        .toArray());

  return await loadProtocolosByFarm(input.activeFarmId);
}

export async function loadRegistrarContrapartesEffect(input: {
  activeFarmId: string | null;
  loadContrapartesByFarm?: (fazendaId: string) => Promise<Contraparte[]>;
}) {
  if (!input.activeFarmId) {
    return [];
  }

  const loadContrapartesByFarm =
    input.loadContrapartesByFarm ??
    ((fazendaId: string) =>
      db.state_contrapartes
        .where("fazenda_id")
        .equals(fazendaId)
        .filter((contraparte) => !contraparte.deleted_at || contraparte.deleted_at === null)
        .toArray());

  return await loadContrapartesByFarm(input.activeFarmId);
}

export async function loadRegistrarProtocoloItensEffect(input: {
  protocoloId: string;
  activeFarmId: string | null;
  sanitaryType: SanitarioTipoEnum;
  loadItensByProtocolo?: (protocoloId: string) => Promise<ProtocoloSanitarioItem[]>;
}) {
  if (!input.protocoloId || !input.activeFarmId) {
    return [];
  }

  const loadItensByProtocolo =
    input.loadItensByProtocolo ??
    ((protocoloId: string) =>
      db.state_protocolos_sanitarios_itens
        .where("protocolo_id")
        .equals(protocoloId)
        .filter(
          (item) =>
            item.fazenda_id === input.activeFarmId &&
            item.tipo === input.sanitaryType &&
            (!item.deleted_at || item.deleted_at === null),
        )
        .toArray());

  return await loadItensByProtocolo(input.protocoloId);
}

export async function loadRegistrarVeterinaryProductsEffect(input?: {
  loadProducts?: () => Promise<ProdutoVeterinarioCatalogEntry[]>;
}) {
  const loadProducts =
    input?.loadProducts ?? (() => db.catalog_produtos_veterinarios.orderBy("nome").toArray());
  return await loadProducts();
}

export async function loadRegistrarSingleActiveBullInLoteEffect(input: {
  tipoManejo: string | null;
  selectedLoteId: string;
  semLoteOption: string;
  selectedBullId: string | null | undefined;
  loadBullsInLote?: (loteId: string) => Promise<Animal[]>;
}) {
  if (input.tipoManejo !== "reproducao") {
    return null;
  }
  if (!input.selectedLoteId || input.selectedLoteId === input.semLoteOption) {
    return null;
  }
  if (input.selectedBullId) {
    return null;
  }

  const loadBullsInLote =
    input.loadBullsInLote ??
    ((loteId: string) =>
      db.state_animais
        .where("lote_id")
        .equals(loteId)
        .filter((animal) => animal.sexo === "M" && animal.status === "ativo" && !animal.deleted_at)
        .toArray());

  const bullsInLote = await loadBullsInLote(input.selectedLoteId);
  if (bullsInLote.length !== 1) {
    return null;
  }

  return {
    id: bullsInLote[0].id,
    identificacao: bullsInLote[0].identificacao,
  };
}
