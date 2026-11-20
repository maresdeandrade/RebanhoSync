import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateProductClassPublicationV2(p) {
  assert.equal(p.artifact, "sanitario_product_class_publication_v2");
  assert.equal(p.classification_only, true);
  assert.equal(p.operational_authorization, false);
  assert(p.decision_reference?.length >= 10);
  assert.equal(p.classes.length, 8);
  assert.equal(
    new Set(p.links.map((l) => `${l.product_id}:${l.class_id}`)).size,
    p.links.length,
  );
  for (const c of p.classes) {
    assert(
      uuid.test(c.id) && c.definition?.length > 10 && c.references?.length,
    );
  }
  for (const l of p.links) {
    assert(uuid.test(l.id) && uuid.test(l.product_id) && uuid.test(l.class_id));
    assert.equal(l.status_curatorial, "ativo");
    assert(
      p.classes.some((c) => c.id === l.class_id && c.class_key === l.class_key),
    );
    assert(
      l.source_refs.length &&
        l.source_refs.every(
          (r) =>
            uuid.test(r.id) &&
            r.field === "product_class" &&
            r.basedOnField === "composition",
        ),
    );
  }
  for (const s of p.sources) {
    assert(uuid.test(s.id) && s.scope === "global" && s.strength === "forte");
    assert(
      ["SIM_BULA", "SIM_COMPOSICAO_FABRICANTE"].includes(s.evidence_status),
    );
    if (s.evidence_status === "SIM_COMPOSICAO_FABRICANTE")
      assert(
        s.kind === "registro_produto" &&
          s.metadata.classification_only === true,
      );
    assert(
      s.coverage.field_key === "composition" &&
        s.coverage.coverage_status === "covers",
    );
  }
  return p;
}

// Fixed, additive SQL: no product recuration, clinical rule, history or rollout write.
export function compileProductClassPublicationV2(packet) {
  const p = validateProductClassPublicationV2(packet);
  const encoded = Buffer.from(JSON.stringify(p), "utf8").toString("base64");
  return `begin;
select pg_advisory_xact_lock(hashtextextended('sanitario:product-class-publication-v2',0));
do $publication$
declare p jsonb := convert_from(decode(${quote(encoded)},'base64'),'UTF8')::jsonb; r jsonb; s jsonb; existing record; refs jsonb;
begin
  if current_user <> 'postgres' then raise exception 'PRODUCT_CLASS_CURATOR_REQUIRED'; end if;
  for r in select value from jsonb_array_elements(p->'classes') loop
    select * into existing from public.sanitario_product_classes_v2 where id=(r->>'id')::uuid for update;
    if not found or existing.class_key is distinct from r->>'class_key' or existing.scope <> 'global' or existing.deleted_at is not null
      or existing.curation_status not in ('needs_review','approved_for_catalog') or existing.metadata->>'can_validate_execution' is distinct from 'false' then
      raise exception 'PRODUCT_CLASS_PUBLICATION_CLASS_CONFLICT: %',r->>'class_key'; end if;
    update public.sanitario_product_classes_v2 set curation_status='approved_for_catalog',
      metadata=metadata || jsonb_build_object('classification_review',jsonb_build_object('decision_reference',p->>'decision_reference','definition',r->>'definition','references',r->'references','classification_only',true,'execution_authorized',false))
      where id=(r->>'id')::uuid and (curation_status <> 'approved_for_catalog' or metadata->'classification_review'->>'decision_reference' is distinct from p->>'decision_reference');
  end loop;
  for s in select value from jsonb_array_elements(p->'sources') loop
    select * into existing from public.sanitario_fontes_tecnicas_v2 where id=(s->>'id')::uuid or source_key=s->>'source_key' for update;
    if found and (existing.id::text <> s->>'id' or existing.url is distinct from s->>'url' or existing.evidence_status::text is distinct from s->>'evidence_status' or existing.deleted_at is not null) then
      raise exception 'PRODUCT_CLASS_PUBLICATION_SOURCE_CONFLICT'; end if;
    insert into public.sanitario_fontes_tecnicas_v2(id,source_key,kind,scope,title,issuer,version,url,strength,evidence_status,accessed_at,limitations,metadata)
      values((s->>'id')::uuid,s->>'source_key',(s->>'kind')::public.sanitario_source_kind_v2_enum,'global',s->>'title',s->>'issuer',s->>'version',s->>'url','forte',(s->>'evidence_status')::public.sanitario_evidence_status_v2_enum,'2026-11-20',s->'limitations',s->'metadata') on conflict(id) do nothing;
    insert into public.sanitario_fonte_cobertura_campos_v2(id,source_id,field_key,coverage_status,notes)
      values((s->'coverage'->>'id')::uuid,(s->>'id')::uuid,'composition','covers',s->'coverage'->>'notes') on conflict(source_id,field_key) do nothing;
    insert into public.sanitario_produto_fontes_v2(product_id,source_id,field_key)
      values((s->>'product_id')::uuid,(s->>'id')::uuid,'composition') on conflict do nothing;
  end loop;
  for r in select value from jsonb_array_elements(p->'links') loop
    if not exists(select 1 from public.sanitario_produtos_v2 where id=(r->>'product_id')::uuid and nome_comercial=r->>'product_name' and status_curatorial='ativo' and deleted_at is null) then
      raise exception 'PRODUCT_CLASS_PUBLICATION_PRODUCT_CONFLICT'; end if;
    select * into existing from public.sanitario_produto_class_links_v2 where product_id=(r->>'product_id')::uuid and class_id=(r->>'class_id')::uuid and deleted_at is null for update;
    if found and (existing.status_curatorial in ('bloqueado','arquivado') or existing.source_refs is distinct from r->'source_refs') then
      raise exception 'PRODUCT_CLASS_PUBLICATION_LINK_CONFLICT'; end if;
    insert into public.sanitario_produto_class_links_v2(id,product_id,class_id,status_curatorial,source_refs,limitations,metadata)
      values((r->>'id')::uuid,(r->>'product_id')::uuid,(r->>'class_id')::uuid,'ativo',r->'source_refs','[]',jsonb_build_object('decision_reference',p->>'decision_reference','classification_only',true,'operational_authorization',false))
      on conflict(product_id,class_id) where deleted_at is null do update set status_curatorial='ativo',metadata=excluded.metadata
      where sanitario_produto_class_links_v2.status_curatorial <> 'ativo';
  end loop;
end;
$publication$;
commit;\n`;
}

export async function productClassPublicationMainV2(args) {
  const at = args.indexOf("--product-class-links");
  assert(at >= 0 && args[at + 1]);
  const packet = validateProductClassPublicationV2(
    JSON.parse(readFileSync(args[at + 1], "utf8")),
  );
  const sql = compileProductClassPublicationV2(packet);
  const digest = createHash("sha256").update(sql).digest("hex");
  if (args.includes("--emit-sql")) {
    assert(
      process.env.SANITARIO_PRODUCT_CLASS_CONFIRM === digest,
      "PRODUCT_CLASS_DIGEST_CONFIRM_REQUIRED",
    );
    writeFileSync(args[args.indexOf("--emit-sql") + 1], sql, { flag: "wx" });
  } else if (args.includes("--apply-local")) {
    const url = new URL(process.env.DB_URL);
    assert(
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
      "LOCAL_TARGET_REQUIRED",
    );
    assert(
      process.env.SANITARIO_PRODUCT_CLASS_CONFIRM === digest,
      "PRODUCT_CLASS_DIGEST_CONFIRM_REQUIRED",
    );
    const client = new pg.Client({ connectionString: url.href });
    await client.connect();
    try {
      const marker = (
        await client.query(
          "select shobj_description(oid,'pg_database') marker from pg_database where datname=current_database()",
        )
      ).rows[0].marker;
      assert.equal(marker, "PRODUCT_CLASS_DISPOSABLE_LOCAL_ONLY");
      await client.query(sql);
    } finally {
      await client.end();
    }
  } else
    assert(
      args.includes("--validate"),
      "VALIDATE_APPLY_LOCAL_OR_EMIT_REQUIRED",
    );
  console.log(
    JSON.stringify({
      digest,
      products: new Set(packet.links.map((l) => l.product_id)).size,
      links: packet.links.length,
      classes: packet.classes.length,
    }),
  );
}
