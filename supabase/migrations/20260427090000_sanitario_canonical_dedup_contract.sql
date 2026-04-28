begin;

create or replace function public.render_sanitario_canonical_dedup_key(
  _scope_type text,
  _scope_id uuid,
  _family_code text,
  _item_code text,
  _regimen_version int,
  _period_mode text,
  _period_key text,
  _jurisdiction text default null
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_key text;
begin
  if nullif(_scope_type, '') is null
    or _scope_id is null
    or nullif(_family_code, '') is null
    or nullif(_item_code, '') is null
    or coalesce(_regimen_version, 0) < 1
    or nullif(_period_mode, '') is null
    or nullif(_period_key, '') is null then
    return null;
  end if;

  v_key := concat_ws(
    ':',
    'sanitario',
    lower(trim(_scope_type)),
    _scope_id::text,
    lower(trim(_family_code)),
    lower(trim(_item_code)),
    format('v%s', coalesce(_regimen_version, 1)),
    lower(trim(_period_mode)),
    trim(_period_key)
  );

  if nullif(_jurisdiction, '') is not null then
    v_key := concat(v_key, ':', upper(trim(_jurisdiction)));
  end if;

  return v_key;
end;
$$;

comment on function public.render_sanitario_canonical_dedup_key(
  text,
  uuid,
  text,
  text,
  int,
  text,
  text,
  text
)
is 'Gera dedup_key canonica da agenda sanitaria no mesmo contrato estruturado do TypeScript.';

create or replace function public.sanitario_dedup_period_mode(
  _calendar_mode text,
  _schedule_kind text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case lower(coalesce(nullif(_calendar_mode, ''), 'legacy'))
    when 'campaign' then 'campaign'
    when 'age_window' then 'window'
    when 'rolling_interval' then 'interval'
    when 'immediate' then 'event'
    when 'clinical_protocol' then 'unstructured'
    else
      case lower(coalesce(nullif(_schedule_kind, ''), 'calendar_base'))
        when 'after_previous_completion' then 'interval'
        when 'rolling_from_last_completion' then 'interval'
        else 'unstructured'
      end
    end;
$$;

comment on function public.sanitario_dedup_period_mode(text, text)
is 'Normaliza modo de calendario/regime para periodMode canonico usado em dedup sanitario.';

create or replace function public.render_dedup_key(
  _template text,
  _animal_id uuid,
  _dose_num integer,
  _protocolo_id uuid default null::uuid,
  _ref_date date default null::date
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_family_code text;
  v_item_code text;
  v_regimen_version int;
  v_calendar_mode text;
  v_schedule_kind text;
  v_age_start_days int;
  v_birth_date date;
  v_period_mode text;
  v_period_key text;
begin
  /*
    Wrapper legado.

    Importante:
    - manter a assinatura antiga para evitar erro 42P13;
    - _protocolo_id é nome legado do parâmetro;
    - semanticamente, nesta função ele representa protocolos_sanitarios_itens.protocol_item_id;
    - _template é ignorado de propósito.
  */

  select
    coalesce(
      nullif(i.payload ->> 'family_code', ''),
      nullif(p.payload ->> 'family_code', '')
    ),
    coalesce(
      nullif(i.payload ->> 'item_code', ''),
      nullif(i.payload #>> '{regime_sanitario,milestone_code}', ''),
      case when _dose_num is not null then format('dose_%s', _dose_num) end
    ),
    coalesce(
      public.sanitario_safe_int(nullif(i.payload ->> 'regimen_version', '')),
      public.sanitario_safe_int(nullif(p.payload ->> 'regimen_version', '')),
      1
    ),
    nullif(i.payload #>> '{calendario_base,mode}', ''),
    coalesce(
      nullif(i.payload #>> '{regime_sanitario,schedule_kind}', ''),
      nullif(i.payload ->> 'schedule_kind', '')
    ),
    public.sanitario_safe_int(
      nullif(i.payload #>> '{calendario_base,age_start_days}', '')
    )
  into
    v_family_code,
    v_item_code,
    v_regimen_version,
    v_calendar_mode,
    v_schedule_kind,
    v_age_start_days
  from public.protocolos_sanitarios_itens i
  join public.protocolos_sanitarios p
    on p.id = i.protocolo_id
   and p.fazenda_id = i.fazenda_id
  where i.protocol_item_id = _protocolo_id
    and i.deleted_at is null
    and p.deleted_at is null
  order by i.version desc, i.created_at desc
  limit 1;

  if _animal_id is not null then
    select a.data_nascimento
    into v_birth_date
    from public.animais a
    where a.id = _animal_id
    limit 1;
  end if;

  v_period_mode := public.sanitario_dedup_period_mode(
    v_calendar_mode,
    v_schedule_kind
  );

  v_period_key := case
    when v_period_mode = 'campaign'
      and _ref_date is not null then
      to_char(_ref_date, 'YYYY-MM')

    when v_period_mode = 'window'
      and v_birth_date is not null
      and v_age_start_days is not null then
      (v_birth_date + v_age_start_days)::text

    when _ref_date is not null then
      _ref_date::text

    else null
  end;

  return public.render_sanitario_canonical_dedup_key(
    'animal',
    _animal_id,
    v_family_code,
    v_item_code,
    v_regimen_version,
    v_period_mode,
    v_period_key,
    null
  );
end;
$$;

comment on function public.render_dedup_key(
  text,
  uuid,
  integer,
  uuid,
  date
)
is 'Wrapper legado mantido por assinatura; ignora templates livres. O parametro _protocolo_id representa protocol_item_id e renderiza o contrato canonico sanitario TS/SQL.';

update public.protocolos_sanitarios_itens
set dedup_template = null,
    updated_at = now()
where dedup_template is not null;

update public.catalogo_protocolos_oficiais_itens
set payload = payload - 'dedup_template',
    updated_at = now()
where payload ? 'dedup_template';

commit;