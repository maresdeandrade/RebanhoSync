import { describe, expect, it } from "vitest";

import type { Animal } from "@/lib/offline/types";
import type { RegulatoryOperationalReadModel } from "@/lib/sanitario/compliance/regulatoryReadModel";
import {
  buildAnimalRegulatoryExportCsv,
  buildAnimalRegulatoryProfile,
  getAnimalRegulatoryImpactLabel,
  matchesAnimalRegulatoryFilters,
} from "@/lib/sanitario/compliance/regulatoryAnimals";

const baseAnimal = {
  fazenda_id: "farm-1",
  lote_id: "lote-1",
  data_nascimento: null,
  data_entrada: null,
  data_saida: null,
  pai_id: null,
  mae_id: null,
  nome: null,
  rfid: null,
  origem: null,
  raca: null,
  papel_macho: null,
  habilitado_monta: false,
  observacoes: null,
  payload: {},
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-04-11T10:00:00.000Z",
  server_received_at: "2026-04-11T10:00:00.000Z",
  created_at: "2026-04-11T10:00:00.000Z",
  updated_at: "2026-04-11T10:00:00.000Z",
  deleted_at: null,
} satisfies Omit<Animal, "id" | "identificacao" | "sexo" | "status">;

function makeAnimal(
  overrides: Partial<Animal> & Pick<Animal, "id" | "identificacao" | "sexo">,
): Animal {
  return {
    ...baseAnimal,
    id: overrides.id,
    identificacao: overrides.identificacao,
    sexo: overrides.sexo,
    status: "ativo",
    ...overrides,
  };
}

function buildReadModel(): RegulatoryOperationalReadModel {
  return {
    entries: [],
    attention: {
      total: 2,
      openCount: 2,
      pendingCount: 1,
      adjustmentCount: 1,
      blockingCount: 2,
      feedBanOpenCount: 1,
      criticalChecklistCount: 1,
      badges: [],
      topItems: [],
      groupBadge: null,
    },
    flows: {
      nutrition: {
        blockers: [],
        warnings: [],
        totalCount: 1,
        blockerCount: 1,
        warningCount: 0,
        firstBlockerMessage: "Feed-ban aberto para o rebanho ruminante.",
        firstWarningMessage: null,
        hasIssues: true,
        tone: "danger",
      },
      movementInternal: {
        blockers: [],
        warnings: [],
        totalCount: 0,
        blockerCount: 0,
        warningCount: 0,
        firstBlockerMessage: null,
        firstWarningMessage: null,
        hasIssues: false,
        tone: "success",
      },
      movementExternal: {
        blockers: [],
        warnings: [],
        totalCount: 1,
        blockerCount: 1,
        warningCount: 0,
        firstBlockerMessage: "Checklist documental bloqueia o transito externo.",
        firstWarningMessage: null,
        hasIssues: true,
        tone: "danger",
      },
      sale: {
        blockers: [],
        warnings: [],
        totalCount: 1,
        blockerCount: 1,
        warningCount: 0,
        firstBlockerMessage: "Checklist documental bloqueia o transito externo.",
        firstWarningMessage: null,
        hasIssues: true,
        tone: "danger",
      },
    },
    analytics: {
      subareas: [
        {
          key: "feed_ban",
          label: "Feed-ban",
          openCount: 1,
          blockerCount: 1,
          warningCount: 0,
          adjustmentCount: 0,
          pendingCount: 1,
          tone: "danger",
          affectedImpacts: ["nutrition"],
          recommendation: "Revisar formulacao.",
        },
        {
          key: "documental",
          label: "Documental",
          openCount: 1,
          blockerCount: 1,
          warningCount: 0,
          adjustmentCount: 0,
          pendingCount: 1,
          tone: "danger",
          affectedImpacts: ["sale"],
          recommendation: "Regularizar checklist.",
        },
      ],
      impacts: [
        {
          key: "nutrition",
          label: "Impacta nutricao",
          blockerCount: 1,
          warningCount: 0,
          totalCount: 1,
          tone: "danger",
          message: "Feed-ban aberto para o rebanho ruminante.",
        },
        {
          key: "movementInternal",
          label: "Impacta lote",
          blockerCount: 0,
          warningCount: 0,
          totalCount: 0,
          tone: "success",
          message: "Sem restricao.",
        },
        {
          key: "sale",
          label: "Impacta transito/venda",
          blockerCount: 1,
          warningCount: 0,
          totalCount: 1,
          tone: "danger",
          message: "Checklist documental bloqueia o transito externo.",
        },
      ],
    },
    hasOpenIssues: true,
    hasBlockingIssues: true,
  };
}

describe("regulatoryAnimals", () => {
  it("builds an animal-centric regulatory profile from the shared read model", () => {
    const animal = makeAnimal({
      id: "animal-1",
      identificacao: "BR-001",
      sexo: "F",
    });

    const profile = buildAnimalRegulatoryProfile(animal, buildReadModel());

    expect(profile.hasIssues).toBe(true);
    expect(profile.hasBlockingIssues).toBe(true);
    expect(profile.restrictions.map((restriction) => restriction.label)).toEqual([
      "Nutricao bloqueada",
      "Venda/transito bloqueados",
    ]);
    expect(profile.activeSubareas).toEqual(["feed_ban", "documental"]);
    expect(
      matchesAnimalRegulatoryFilters(profile, {
        impact: "sale",
        subarea: "all",
      }),
    ).toBe(true);
    expect(
      matchesAnimalRegulatoryFilters(profile, {
        impact: "movementInternal",
        subarea: "all",
      }),
    ).toBe(false);
  });

  it("ignores sold animals in the regulatory profile", () => {
    const animal = makeAnimal({
      id: "animal-2",
      identificacao: "BR-002",
      sexo: "M",
      status: "vendido",
    });

    const profile = buildAnimalRegulatoryProfile(animal, buildReadModel());

    expect(profile.hasIssues).toBe(false);
    expect(profile.restrictions).toEqual([]);
  });

  it("exports the impacted animals as a dedicated CSV cut", () => {
    const activeAnimal = makeAnimal({
      id: "animal-1",
      identificacao: "BR-001",
      sexo: "F",
      lote_id: "lote-1",
    });
    const soldAnimal = makeAnimal({
      id: "animal-2",
      identificacao: "BR-002",
      sexo: "M",
      status: "vendido",
      lote_id: "lote-2",
    });
    const readModel = buildReadModel();
    const profilesByAnimalId = new Map([
      [activeAnimal.id, buildAnimalRegulatoryProfile(activeAnimal, readModel)],
      [soldAnimal.id, buildAnimalRegulatoryProfile(soldAnimal, readModel)],
    ]);

    const csv = buildAnimalRegulatoryExportCsv({
      animals: [activeAnimal, soldAnimal],
      profilesByAnimalId,
      resolveLoteName: (loteId) => (loteId === "lote-1" ? "Matrizes" : "Sem lote"),
      resolveCategoryLabel: () => "Vaca",
    });

    expect(csv).toContain("animal_id;identificacao;sexo;status;lote;categoria;restricoes;subareas;mensagem_critica");
    expect(csv).toContain("BR-001");
    expect(csv).toContain("Nutricao bloqueada | Venda/transito bloqueados");
    expect(csv).toContain("Feed-ban | Documental");
    expect(csv).not.toContain("BR-002");
  });

  it("returns operational labels for each impact", () => {
    expect(getAnimalRegulatoryImpactLabel("nutrition", "danger")).toBe(
      "Nutricao bloqueada",
    );
    expect(getAnimalRegulatoryImpactLabel("movementInternal", "warning")).toBe(
      "Movimentacao sob revisao",
    );
  });
});
