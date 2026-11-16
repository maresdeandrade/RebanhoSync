-- Sanitário V3: vínculo canônico opcional entre estoque sanitário e produto técnico V2.
-- Mudança aditiva; preserva produto_veterinario_id legado durante a transição.

alter table public.insumos
  add column if not exists sanitario_produto_v2_id uuid null;

alter table public.insumos
  drop constraint if exists fk_insumos_sanitario_produto_v2;

alter table public.insumos
  add constraint fk_insumos_sanitario_produto_v2
  foreign key (sanitario_produto_v2_id)
  references public.sanitario_produtos_v2(id)
  on delete set null;

alter table public.insumos
  drop constraint if exists ck_insumos_sanitario_produto_v2_tipo;

alter table public.insumos
  add constraint ck_insumos_sanitario_produto_v2_tipo
  check (sanitario_produto_v2_id is null or tipo = 'sanitario');

create index if not exists idx_insumos_sanitario_produto_v2
  on public.insumos(fazenda_id, sanitario_produto_v2_id)
  where sanitario_produto_v2_id is not null and deleted_at is null;

comment on column public.insumos.sanitario_produto_v2_id is
  'Vínculo técnico canônico opcional do estoque sanitário ao catálogo sanitario_produtos_v2; produto_veterinario_id permanece legado.';
