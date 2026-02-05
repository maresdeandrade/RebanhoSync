-- 0002_user_auto_provision.sql
-- =========================================================
-- Auto-provisioning: cria user_profiles e user_settings quando um auth.users é criado
-- =========================================================

-- Função executada pelo trigger (security definer)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- user_profiles
  insert into public.user_profiles (
    user_id,
    display_name,
    phone,
    avatar_url,
    locale,
    timezone,
    client_id,
    client_op_id,
    client_tx_id,
    client_recorded_at,
    server_received_at,
    deleted_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'avatar_url',
    'pt-BR',
    'America/Sao_Paulo',
    'server',
    gen_random_uuid(),
    null,
    now(),
    now(),
    null
  )
  on conflict (user_id) do nothing;

  -- user_settings
  insert into public.user_settings (
    user_id,
    theme,
    date_format,
    number_format,
    notifications,
    sync_prefs,
    active_fazenda_id,
    client_id,
    client_op_id,
    client_tx_id,
    client_recorded_at,
    server_received_at,
    deleted_at
  )
  values (
    new.id,
    'system',
    'DD/MM/YYYY',
    'pt-BR',
    '{
      "enabled": true,
      "agenda_reminders": true,
      "days_before": [7,3,1],
      "quiet_hours": {"start":"22:00","end":"06:00"}
    }'::jsonb,
    '{
      "wifi_only": false,
      "background_sync": true,
      "max_batch_size": 500
    }'::jsonb,
    null,
    'server',
    gen_random_uuid(),
    null,
    now(),
    now(),
    null
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Trigger no auth.users
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
