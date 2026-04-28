import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const seedSql = readFileSync(resolve(process.cwd(), "supabase/seed.sql"), "utf8");

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sqlTupleStartingWith(value: string) {
  const match = seedSql.match(
    new RegExp(`\\(\\s*'${escapeRegExp(value)}',[\\s\\S]*?\\n\\s*\\)`, "m"),
  );
  expect(match, `seed tuple not found for ${value}`).not.toBeNull();
  return match?.[0] ?? "";
}

function sqlItemTuple(slug: string, code: string) {
  const match = seedSql.match(
    new RegExp(
      `\\(\\s*'${escapeRegExp(slug)}',[\\s\\S]*?'${escapeRegExp(code)}',[\\s\\S]*?\\n\\s*\\)`,
      "m",
    ),
  );
  expect(match, `seed item tuple not found for ${slug}:${code}`).not.toBeNull();
  return match?.[0] ?? "";
}

function compact(value: string) {
  return value.replace(/\s+/g, " ");
}

describe("P6.1 conservative sanitary seed catalog", () => {
  it("keeps brucellosis PNCEBT mandatory and agenda-enabled only for the age window", () => {
    expect(sqlTupleStartingWith("brucelose-pncebt")).toContain("'obrigatorio'");

    const item = sqlItemTuple("brucelose-pncebt", "brucelose-b19-dose-unica");
    expect(item).toContain('"age_start_days":90');
    expect(item).toContain('"age_end_days":240');
    expect(item).toContain('"sexo_alvo":"F"');
    expect(item).toContain('"dose_label":"dose_unica"');
    expect(compact(item)).toContain("true, false, '{}'::jsonb, true,");
  });

  it("keeps rabies risk/configuration-driven and not agenda-enabled by seed", () => {
    expect(sqlTupleStartingWith("raiva-herbivoros-risco")).toContain("'recomendado'");

    const item = sqlItemTuple("raiva-herbivoros-risco", "raiva-vigilancia-risco");
    expect(item).toContain('"risk_field":"zona_raiva_risco"');
    expect(item).toContain('"requires_explicit_activation":true');
    expect(compact(item)).toContain("false, false, '{}'::jsonb, false,");
  });

  it("keeps PNEFA/aftosa as vesicular-syndrome vigilance, not routine vaccination", () => {
    const item = sqlItemTuple("pnefa-sindrome-vesicular", "sindrome-vesicular-alerta");
    expect(item).toContain("'notificacao'");
    expect(item).toContain('"nao_criar_vacinacao_rotineira":true');
    expect(item).toContain('"bloqueia_movimentacao":true');
    expect(item).toContain('"requires_technical_guidance":true');
    expect(item).toContain('"requires_official_notification":true');
    expect(compact(item)).toContain("false, false, '{}'::jsonb, false,");
    expect(seedSql).not.toMatch(/aftosa[^']*vacinacao-rotineira/i);
  });

  it("keeps notifiable diseases and GTA/checklists out of automatic agenda", () => {
    const in50 = sqlItemTuple("in50-doencas-notificaveis", "doencas-notificaveis-alerta");
    const gta = sqlItemTuple("transito-gta-precheck", "gta-egta-precheck");
    const biosseguranca = sqlItemTuple("biosseguranca-operacional", "biosseguranca-checklist");

    expect(in50).toContain('"bloqueia_movimentacao":true');
    expect(in50).toContain('"requires_technical_guidance":true');
    expect(in50).toContain('"requires_official_notification":true');
    expect(compact(in50)).toContain("false, false, '{}'::jsonb, false,");
    expect(compact(gta)).toContain("false, true, '{}'::jsonb, false,");
    expect(compact(biosseguranca)).toContain("false, false, '{}'::jsonb, false,");
    expect(seedSql).toContain("insert into public.catalogo_doencas_notificaveis");
  });

  it("does not mark technical practices as legal obligations", () => {
    const technicalSlugs = [
      "clostridioses-tecnico",
      "reprodutiva-ibr-bvd-lepto",
      "vermifugacao-estrategica",
      "controle-carrapato",
      "biosseguranca-operacional",
      "medicamentos-rastreabilidade",
    ];

    for (const slug of technicalSlugs) {
      expect(sqlTupleStartingWith(slug)).not.toContain("'obrigatorio'");
    }
  });

  it("keeps all seed sections idempotent", () => {
    expect(seedSql).toContain("where lower(p.nome) = lower(v.nome)");
    expect(seedSql).toContain("on conflict (slug) do update");
    expect(seedSql).toContain("on conflict (template_id, codigo) do update");
    expect(seedSql).toContain("on conflict (codigo) do update");
  });
});
