-- Fix create_fazenda for users that already have an active primary farm.
-- A user can have only one active primary membership, so new farms after the
-- first one must not be inserted with is_primary=true.

create or replace function public.create_fazenda(
  _nome text,
  _codigo text default null,
  _municipio text default null,
  _estado public.estado_uf_enum default null,
  _cep text default null,
  _area_total_ha numeric default null,
  _tipo_producao public.tipo_producao_enum default null,
  _sistema_manejo public.sistema_manejo_enum default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fazenda_id uuid;
  v_is_primary boolean;
begin
  if auth.uid() is null then
    raise exception 'Forbidden';
  end if;

  if not public.can_create_farm() then
    raise exception 'Forbidden';
  end if;

  v_is_primary := not exists (
    select 1
    from public.user_fazendas uf
    where uf.user_id = auth.uid()
      and uf.is_primary = true
      and uf.deleted_at is null
  );

  insert into public.fazendas(
    nome,
    codigo,
    municipio,
    estado,
    cep,
    area_total_ha,
    tipo_producao,
    sistema_manejo,
    created_by
  )
  values (
    _nome,
    _codigo,
    _municipio,
    _estado,
    _cep,
    _area_total_ha,
    _tipo_producao,
    _sistema_manejo,
    auth.uid()
  )
  returning id into v_fazenda_id;

  insert into public.user_fazendas(user_id, fazenda_id, role, is_primary, accepted_at)
  values (auth.uid(), v_fazenda_id, 'owner', v_is_primary, now());

  insert into public.fazenda_sanidade_config(fazenda_id, uf, aptidao, sistema)
  values (
    v_fazenda_id,
    _estado,
    case
      when _tipo_producao = 'mista' then 'misto'
      when _tipo_producao is null then 'all'
      else _tipo_producao::text
    end,
    case
      when _sistema_manejo = 'pastagem' then 'extensivo'
      when _sistema_manejo = 'semi_confinamento' then 'semi_intensivo'
      when _sistema_manejo = 'confinamento' then 'intensivo'
      else 'all'
    end
  )
  on conflict (fazenda_id) do nothing;

  return v_fazenda_id;
end;
$$;

grant execute on function public.create_fazenda(
  text,
  text,
  text,
  public.estado_uf_enum,
  text,
  numeric,
  public.tipo_producao_enum,
  public.sistema_manejo_enum
) to authenticated;
