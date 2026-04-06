import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { newDb } from "pg-mem";
import type { Animal } from "@/lib/offline/types";
import { deriveAnimalTaxonomy } from "../taxonomy";

function dateDaysAgo(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function dateDaysAhead(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function buildAnimal(overrides: Partial<Animal>): Animal {
  const now = new Date().toISOString();
  return {
    id: "animal-1",
    fazenda_id: "farm-1",
    identificacao: "A-001",
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: dateDaysAgo(500),
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
    client_tx_id: "tx-1",
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

function toPgMemJsonPathQuery(sql: string) {
  const normalized = sql
    .replaceAll(
      "f.metadata #>> '{animal_lifecycle,stage_classification_basis}'",
      "((f.metadata -> 'animal_lifecycle') ->> 'stage_classification_basis')",
    )
    .replaceAll(
      "f.metadata #>> '{animal_lifecycle,weaning_days}'",
      "((f.metadata -> 'animal_lifecycle') ->> 'weaning_days')",
    )
    .replaceAll(
      "f.metadata #>> '{animal_lifecycle,weaning_weight_kg}'",
      "((f.metadata -> 'animal_lifecycle') ->> 'weaning_weight_kg')",
    )
    .replaceAll(
      "f.metadata #>> '{animal_lifecycle,male_adult_days}'",
      "((f.metadata -> 'animal_lifecycle') ->> 'male_adult_days')",
    )
    .replaceAll(
      "f.metadata #>> '{animal_lifecycle,male_adult_weight_kg}'",
      "((f.metadata -> 'animal_lifecycle') ->> 'male_adult_weight_kg')",
    )
    .replaceAll(
      "a.payload #>> '{weaning,completed_at}'",
      "((a.payload -> 'weaning') ->> 'completed_at')",
    )
    .replaceAll(
      "a.payload #>> '{metrics,last_weight_kg}'",
      "((a.payload -> 'metrics') ->> 'last_weight_kg')",
    )
    .replaceAll(
      "a.payload #>> '{taxonomy_facts,schema_version}'",
      "((a.payload -> 'taxonomy_facts') ->> 'schema_version')",
    )
    .replaceAll(
      "a.payload #>> '{taxonomy_facts,castrado}'",
      "((a.payload -> 'taxonomy_facts') ->> 'castrado')",
    )
    .replaceAll(
      "a.payload #>> '{taxonomy_facts,puberdade_confirmada}'",
      "((a.payload -> 'taxonomy_facts') ->> 'puberdade_confirmada')",
    )
    .replaceAll(
      "a.payload #>> '{taxonomy_facts,secagem_realizada}'",
      "((a.payload -> 'taxonomy_facts') ->> 'secagem_realizada')",
    )
    .replaceAll(
      "a.payload #>> '{taxonomy_facts,em_lactacao}'",
      "((a.payload -> 'taxonomy_facts') ->> 'em_lactacao')",
    )
    .replaceAll(
      "a.payload #>> '{taxonomy_facts,prenhez_confirmada}'",
      "((a.payload -> 'taxonomy_facts') ->> 'prenhez_confirmada')",
    )
    .replaceAll(
      "a.payload #>> '{taxonomy_facts,data_prevista_parto}'",
      "((a.payload -> 'taxonomy_facts') ->> 'data_prevista_parto')",
    )
    .replaceAll(
      "a.payload #>> '{taxonomy_facts,data_ultimo_parto}'",
      "((a.payload -> 'taxonomy_facts') ->> 'data_ultimo_parto')",
    )
    .replaceAll(
      "a.payload #>> '{lifecycle,destino_produtivo}'",
      "((a.payload -> 'lifecycle') ->> 'destino_produtivo')",
    )
    .replaceAll(
      "a.payload #>> '{male_profile,status_reprodutivo}'",
      "((a.payload -> 'male_profile') ->> 'status_reprodutivo')",
    )
    .replaceAll(
      "(current_date - a.data_nascimento::date)",
      "date_diff_days(current_date, a.data_nascimento::date)",
    )
    .replaceAll(
      "(current_date - f.data_ultimo_parto) <= 210",
      "date_diff_days(current_date, f.data_ultimo_parto) <= 210",
    )
    .replaceAll(
      "(current_date - n.data_ultimo_parto) <= 60",
      "date_diff_days(current_date, n.data_ultimo_parto) <= 60",
    )
    .replaceAll(
      "(current_date - c.data_ultimo_parto) <= 15",
      "date_diff_days(current_date, c.data_ultimo_parto) <= 15",
    )
    .replaceAll(
      "(c.data_prevista_parto - current_date) <= 30",
      "date_diff_days(c.data_prevista_parto, current_date) <= 30",
    );

  const schemaVersionCaseStart =
    "case\n      when ((a.payload -> 'taxonomy_facts') ->> 'schema_version') ~ '^\\d+$'";
  const schemaVersionCaseEnd = "    end as taxonomy_facts_schema_version,";
  const startIndex = normalized.indexOf(schemaVersionCaseStart);
  const endIndex = normalized.indexOf(schemaVersionCaseEnd, startIndex);

  if (startIndex >= 0 && endIndex >= 0) {
    return `${normalized.slice(0, startIndex)}coalesce(nullif(((a.payload -> 'taxonomy_facts') ->> 'schema_version'), '')::int, 1) as taxonomy_facts_schema_version,\n${normalized.slice(endIndex + schemaVersionCaseEnd.length)}`;
  }

  return normalized;
}

const fixtures = [
  buildAnimal({
    id: "f-bezerra",
    sexo: "F",
    data_nascimento: dateDaysAgo(10),
  }),
  buildAnimal({
    id: "f-novilha-prenhe",
    sexo: "F",
    data_nascimento: dateDaysAgo(500),
    payload: {
      weaning: {
        completed_at: dateDaysAgo(250),
      },
      taxonomy_facts: {
        schema_version: 1,
        puberdade_confirmada: true,
        prenhez_confirmada: true,
        data_prevista_parto: dateDaysAhead(90),
      },
    },
  }),
  buildAnimal({
    id: "f-vaca-seca",
    sexo: "F",
    data_nascimento: dateDaysAgo(1600),
    payload: {
      weaning: {
        completed_at: dateDaysAgo(1300),
      },
      taxonomy_facts: {
        schema_version: 1,
        data_ultimo_parto: dateDaysAgo(180),
        prenhez_confirmada: true,
        data_prevista_parto: dateDaysAhead(20),
        secagem_realizada: true,
      },
    },
  }),
  buildAnimal({
    id: "f-vaca-parida",
    sexo: "F",
    data_nascimento: dateDaysAgo(1600),
    payload: {
      weaning: {
        completed_at: dateDaysAgo(1300),
      },
      taxonomy_facts: {
        schema_version: 1,
        data_ultimo_parto: dateDaysAgo(5),
        em_lactacao: true,
      },
    },
  }),
  buildAnimal({
    id: "f-vaca-lactacao",
    sexo: "F",
    data_nascimento: dateDaysAgo(1600),
    payload: {
      weaning: {
        completed_at: dateDaysAgo(1300),
      },
      taxonomy_facts: {
        schema_version: 1,
        data_ultimo_parto: dateDaysAgo(120),
        em_lactacao: true,
      },
    },
  }),
  buildAnimal({
    id: "m-garrote",
    sexo: "M",
    data_nascimento: dateDaysAgo(400),
  }),
  buildAnimal({
    id: "m-touro",
    sexo: "M",
    data_nascimento: dateDaysAgo(1200),
    payload: {
      lifecycle: {
        destino_produtivo: "reprodutor",
      },
      male_profile: {
        status_reprodutivo: "apto",
      },
    },
  }),
  buildAnimal({
    id: "m-boi",
    sexo: "M",
    data_nascimento: dateDaysAgo(1200),
    payload: {
      lifecycle: {
        destino_produtivo: "abate",
      },
      taxonomy_facts: {
        schema_version: 1,
        castrado: true,
      },
    },
  }),
];

async function createParityDb() {
  const db = newDb();
  db.public.registerFunction({
    name: "current_date",
    returns: "date" as never,
    implementation: () => new Date().toISOString().slice(0, 10),
  });
  db.public.registerFunction({
    name: "nullif",
    args: ["text", "text"] as never,
    returns: "text" as never,
    implementation: (left: string | null, right: string | null) =>
      left === right ? null : left,
  });
  db.public.registerFunction({
    name: "date_diff_days",
    args: ["date", "date"] as never,
    returns: "int4" as never,
    implementation: (left: string | Date, right: string | Date) => {
      const leftDate = new Date(left);
      const rightDate = new Date(right);
      const diffMs = leftDate.getTime() - rightDate.getTime();
      return Math.round(diffMs / (1000 * 60 * 60 * 24));
    },
  });

  const { Client } = db.adapters.createPg();
  const client = new Client();
  await client.connect();

  await client.query(`
    create type public.categoria_zootecnica_canonica_enum as enum (
      'bezerra',
      'novilha',
      'vaca',
      'bezerro',
      'garrote',
      'boi_terminacao',
      'touro'
    );
    create type public.fase_veterinaria_enum as enum (
      'neonatal',
      'pre_desmama',
      'pos_desmama',
      'pre_pubere',
      'pubere',
      'gestante',
      'puerperio'
    );
    create type public.estado_produtivo_reprodutivo_enum as enum (
      'vazia',
      'prenhe',
      'pre_parto_imediato',
      'seca',
      'recem_parida',
      'lactacao',
      'inteiro',
      'castrado',
      'reprodutor',
      'terminacao'
    );
    create table public.fazendas (
      id text primary key,
      metadata jsonb,
      deleted_at timestamp null
    );
    create table public.animais (
      id text primary key,
      fazenda_id text not null,
      sexo text not null,
      status text not null,
      data_nascimento date null,
      payload jsonb not null default '{}'::jsonb,
      papel_macho text null,
      habilitado_monta boolean not null default false,
      deleted_at timestamp null
    );
    create table public.eventos (
      id text primary key,
      fazenda_id text not null,
      animal_id text null,
      dominio text not null,
      occurred_at timestamp not null,
      deleted_at timestamp null
    );
    create table public.eventos_reproducao (
      evento_id text primary key,
      fazenda_id text not null,
      tipo text not null,
      macho_id text null,
      payload jsonb not null default '{}'::jsonb,
      deleted_at timestamp null
    );
    create view public.vw_repro_status_animal as
    select
      null::text as animal_id,
      null::text as fazenda_id,
      null::timestamp as last_event_date,
      null::text as last_event_type,
      null::text as status_estimado
    where false;
  `);

  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "0038_animais_taxonomia_canonica.sql",
    ),
    "utf8",
  );
  const normalizedMigration = migration.replace(
    /do \$\$[\s\S]*?end \$\$;\s*/i,
    "",
  )
    .replace(/^--.*$/gm, "")
    .replace(/drop view if exists public\.vw_animais_taxonomia;\s*/i, "")
    .replace(/comment on view[\s\S]*?;\s*$/i, "");
  const statements = normalizedMigration
    ? toPgMemJsonPathQuery(normalizedMigration)
        .split(/;\s*\n/)
        .map((statement) => statement.trim())
        .filter(Boolean)
    : [];
  for (const statement of statements) {
    await client.query(statement);
  }
  await client.query(
    `insert into public.fazendas (id, metadata, deleted_at) values ($1, $2::jsonb, null)`,
    [
      "farm-1",
      JSON.stringify({
        animal_lifecycle: {
          stage_classification_basis: "idade",
          weaning_days: 210,
          weaning_weight_kg: 180,
          male_adult_days: 731,
          male_adult_weight_kg: 450,
        },
      }),
    ],
  );

  for (const animal of fixtures) {
    await client.query(
      `
        insert into public.animais (
          id, fazenda_id, sexo, status, data_nascimento, payload,
          papel_macho, habilitado_monta, deleted_at
        ) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, null)
      `,
      [
        animal.id,
        animal.fazenda_id,
        animal.sexo,
        animal.status,
        animal.data_nascimento,
        JSON.stringify(animal.payload),
        animal.papel_macho,
        animal.habilitado_monta,
      ],
    );
  }

  return client;
}

describe("taxonomy parity TS vs SQL projection", () => {
  it("matches vw_animais_taxonomia for canonical fixture scenarios", async () => {
    const client = await createParityDb();

    try {
      const sqlRows = await client.query(`
        select
          animal_id,
          categoria_zootecnica::text as categoria_zootecnica,
          fase_veterinaria::text as fase_veterinaria,
          estado_produtivo_reprodutivo::text as estado_produtivo_reprodutivo
        from public.vw_animais_taxonomia
        where fazenda_id = 'farm-1'
        order by animal_id
      `);

      const sqlByAnimal = new Map(
        sqlRows.rows.map((row) => [row.animal_id as string, row]),
      );

      for (const animal of fixtures) {
        const ts = deriveAnimalTaxonomy(animal, { now: new Date() });
        const sql = sqlByAnimal.get(animal.id);

        expect(sql).toBeTruthy();
        expect(sql?.categoria_zootecnica).toBe(ts.categoria_zootecnica);
        expect(sql?.fase_veterinaria).toBe(ts.fase_veterinaria);
        expect(sql?.estado_produtivo_reprodutivo).toBe(
          ts.estado_produtivo_reprodutivo,
        );
      }
    } finally {
      await client.end();
    }
  });
});
