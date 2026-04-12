import { describe, expect, it } from "vitest";

import type {
  CatalogoDoencaNotificavel,
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
} from "@/lib/offline/types";
import {
  resolveOfficialAptidao,
  resolveOfficialSistema,
  selectOfficialSanitaryPack,
} from "@/lib/sanitario/officialCatalog";

const templates: CatalogoProtocoloOficial[] = [
  {
    id: "tpl-bruc",
    slug: "brucelose-pncebt",
    nome: "Brucelose",
    versao: 1,
    escopo: "federal",
    uf: null,
    aptidao: "all",
    sistema: "all",
    status_legal: "obrigatorio",
    base_legal_json: {},
    payload: {},
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "tpl-raiva",
    slug: "raiva-herbivoros-risco",
    nome: "Raiva",
    versao: 1,
    escopo: "federal",
    uf: null,
    aptidao: "all",
    sistema: "all",
    status_legal: "recomendado",
    base_legal_json: {},
    payload: {},
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "tpl-sp",
    slug: "sp-atualizacao-rebanho",
    nome: "SP Atualizacao",
    versao: 1,
    escopo: "estadual",
    uf: "SP",
    aptidao: "all",
    sistema: "all",
    status_legal: "obrigatorio",
    base_legal_json: {},
    payload: {},
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "tpl-bpa",
    slug: "agua-limpeza-checklist",
    nome: "Agua e limpeza",
    versao: 1,
    escopo: "federal",
    uf: null,
    aptidao: "all",
    sistema: "all",
    status_legal: "boa_pratica",
    base_legal_json: {},
    payload: {},
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
];

const items: CatalogoProtocoloOficialItem[] = [
  {
    id: "item-bruc",
    template_id: "tpl-bruc",
    area: "vacinacao",
    codigo: "brucelose-b19",
    categoria_animal: "bezerra",
    gatilho_tipo: "idade",
    gatilho_json: { sexo_alvo: "F", age_start_days: 90, age_end_days: 240 },
    frequencia_json: { dose_num: 1 },
    requires_vet: true,
    requires_gta: false,
    carencia_regra_json: {},
    gera_agenda: true,
    payload: { produto: "Vacina Brucelose B19", label: "Brucelose B19" },
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "item-raiva",
    template_id: "tpl-raiva",
    area: "vacinacao",
    codigo: "raiva-d1",
    categoria_animal: "bezerro",
    gatilho_tipo: "risco",
    gatilho_json: {
      risk_field: "zona_raiva_risco",
      risk_values: ["medio", "alto"],
      age_start_days: 90,
    },
    frequencia_json: { dose_num: 1, interval_days: 30 },
    requires_vet: false,
    requires_gta: false,
    carencia_regra_json: {},
    gera_agenda: true,
    payload: { produto: "Vacina Antirrabica", label: "Raiva - dose inicial" },
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "item-sp",
    template_id: "tpl-sp",
    area: "biosseguranca",
    codigo: "sp-maio",
    categoria_animal: "all",
    gatilho_tipo: "calendario",
    gatilho_json: { months: [5] },
    frequencia_json: {},
    requires_vet: false,
    requires_gta: false,
    carencia_regra_json: {},
    gera_agenda: false,
    payload: { label: "Atualizacao SP - maio" },
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
  {
    id: "item-bpa",
    template_id: "tpl-bpa",
    area: "biosseguranca",
    codigo: "agua-checklist",
    categoria_animal: "all",
    gatilho_tipo: "calendario",
    gatilho_json: { months: [1] },
    frequencia_json: {},
    requires_vet: false,
    requires_gta: false,
    carencia_regra_json: {},
    gera_agenda: false,
    payload: { label: "Checklist agua" },
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
];

const diseases: CatalogoDoencaNotificavel[] = [
  {
    codigo: "notif-generica",
    nome: "Suspeita notificavel",
    especie_alvo: "bovinos",
    tipo_notificacao: "imediata",
    sinais_alerta_json: {},
    acao_imediata_json: {},
    base_legal_json: {},
    created_at: "2026-04-09T00:00:00.000Z",
    updated_at: "2026-04-09T00:00:00.000Z",
  },
];

describe("official sanitary catalog selection", () => {
  it("keeps the app animal-centric while resolving farm aptitude and system", () => {
    expect(resolveOfficialAptidao("corte")).toBe("corte");
    expect(resolveOfficialAptidao("mista")).toBe("misto");
    expect(resolveOfficialSistema("pastagem")).toBe("extensivo");
    expect(resolveOfficialSistema("confinamento")).toBe("intensivo");
  });

  it("selects only hard legal obligations in minimo_legal mode and applies state overlay", () => {
    const selection = selectOfficialSanitaryPack(
      { templates, items, diseases },
      {
        uf: "SP",
        aptidao: "corte",
        sistema: "extensivo",
        zonaRaivaRisco: "baixo",
        pressaoCarrapato: "baixo",
        pressaoHelmintos: "baixo",
        modoCalendario: "minimo_legal",
      },
    );

    expect(selection.templates.map((entry) => entry.template.slug)).toEqual([
      "brucelose-pncebt",
      "sp-atualizacao-rebanho",
    ]);
  });

  it("adds recommended templates only when mode and farm risk allow them", () => {
    const selection = selectOfficialSanitaryPack(
      { templates, items, diseases },
      {
        uf: "GO",
        aptidao: "corte",
        sistema: "extensivo",
        zonaRaivaRisco: "alto",
        pressaoCarrapato: "baixo",
        pressaoHelmintos: "baixo",
        modoCalendario: "tecnico_recomendado",
      },
    );

    expect(selection.templates.map((entry) => entry.template.slug)).toEqual([
      "brucelose-pncebt",
      "raiva-herbivoros-risco",
    ]);

    const raivaSelection = selection.templates.find(
      (entry) => entry.template.slug === "raiva-herbivoros-risco",
    );
    expect(raivaSelection?.materializableItems.map((entry) => entry.codigo)).toEqual([
      "raiva-d1",
    ]);
  });

  it("includes good practices only in complete mode", () => {
    const selection = selectOfficialSanitaryPack(
      { templates, items, diseases },
      {
        uf: "SP",
        aptidao: "corte",
        sistema: "extensivo",
        zonaRaivaRisco: "baixo",
        pressaoCarrapato: "baixo",
        pressaoHelmintos: "baixo",
        modoCalendario: "completo",
      },
    );

    expect(selection.templates.some((entry) => entry.template.slug === "agua-limpeza-checklist")).toBe(
      true,
    );
  });
});
