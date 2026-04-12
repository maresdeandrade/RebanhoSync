begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'dominio_enum') then
    raise exception 'dominio_enum not found';
  end if;

  begin
    alter type public.dominio_enum add value if not exists 'alerta_sanitario';
  exception
    when duplicate_object then null;
  end;
end $$;

commit;
