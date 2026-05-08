export type RegistrarContextKind = "agenda" | "animal" | "lote" | "pasto";

export type RegistrarContextRecord = {
  id: string;
};

export type RegistrarContextAnimal = RegistrarContextRecord & {
  identificacao?: string | null;
  nome?: string | null;
  status?: string | null;
};

export type RegistrarContextLote = RegistrarContextRecord & {
  nome?: string | null;
  status?: string | null;
};

export type RegistrarContextPasto = RegistrarContextRecord & {
  nome?: string | null;
  tipo_pasto?: string | null;
};

export type RegistrarContextAgendaItem = RegistrarContextRecord & {
  dominio?: string | null;
  tipo?: string | null;
  status?: string | null;
  data_prevista?: string | null;
};

export type RegistrarContextResolverInput = {
  sourceTaskId: string | null;
  animalId: string | null;
  loteId: string | null;
  pastoId: string | null;
  records: {
    agendaItem?: RegistrarContextAgendaItem | null;
    animal?: RegistrarContextAnimal | null;
    lote?: RegistrarContextLote | null;
    pasto?: RegistrarContextPasto | null;
  };
};

export type RegistrarResolvedContextEntry = {
  kind: RegistrarContextKind;
  id: string;
  title: string;
  description: string;
  found: boolean;
};

function shortId(value: string) {
  return value.slice(0, 8);
}

function labelize(value?: string | null) {
  return value ? value.replaceAll("_", " ") : "Nao informado";
}

function missingContext(kind: RegistrarContextKind, id: string): RegistrarResolvedContextEntry {
  return {
    kind,
    id,
    title: "Contexto nao encontrado",
    description: `${labelize(kind)} ${shortId(id)}`,
    found: false,
  };
}

export function resolveRegistrarDisplayContext(
  input: RegistrarContextResolverInput,
): RegistrarResolvedContextEntry[] {
  const entries: RegistrarResolvedContextEntry[] = [];

  if (input.sourceTaskId) {
    const item = input.records.agendaItem;
    entries.push(
      item
        ? {
            kind: "agenda",
            id: input.sourceTaskId,
            title: `Agenda: ${labelize(item.tipo)}`,
            description: `Status ${labelize(item.status)}${
              item.data_prevista ? ` | Previsto ${item.data_prevista}` : ""
            }`,
            found: true,
          }
        : missingContext("agenda", input.sourceTaskId),
    );
  }

  if (input.animalId) {
    const animal = input.records.animal;
    entries.push(
      animal
        ? {
            kind: "animal",
            id: input.animalId,
            title: `Animal: ${animal.identificacao ?? animal.nome ?? shortId(animal.id)}`,
            description: `Status ${labelize(animal.status)}`,
            found: true,
          }
        : missingContext("animal", input.animalId),
    );
  }

  if (input.loteId) {
    const lote = input.records.lote;
    entries.push(
      lote
        ? {
            kind: "lote",
            id: input.loteId,
            title: `Lote: ${lote.nome ?? shortId(lote.id)}`,
            description: `Status ${labelize(lote.status)}`,
            found: true,
          }
        : missingContext("lote", input.loteId),
    );
  }

  if (input.pastoId) {
    const pasto = input.records.pasto;
    entries.push(
      pasto
        ? {
            kind: "pasto",
            id: input.pastoId,
            title: `Pasto: ${pasto.nome ?? shortId(pasto.id)}`,
            description: "Contexto informativo; nenhum animal e inferido automaticamente.",
            found: true,
          }
        : missingContext("pasto", input.pastoId),
    );
  }

  return entries;
}
