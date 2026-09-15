import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const edgeSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
const migrationSource = readFileSync(
  new URL(
    '../../migrations/20260914014309_f24_1a1_sanitario_reconcile_backend_wrapper.sql',
    import.meta.url,
  ),
  'utf8',
)
const supabaseConfig = readFileSync(
  new URL('../../config.toml', import.meta.url),
  'utf8',
)

describe('sanitario-reconcile backend authorization contract', () => {
  it('versions the gateway JWT verification trust boundary', () => {
    expect(supabaseConfig).toMatch(
      /\[functions\.sanitario-reconcile\]\s+verify_jwt\s*=\s*true/,
    )
  })

  it('requires the incoming service-role credential before using the backend client', () => {
    expect(edgeSource).toContain("req.headers.get('Authorization')")
    expect(edgeSource).toContain(
      "getVerifiedJwtRole(authHeader) !== 'service_role'",
    )
    expect(edgeSource).not.toContain("req.headers.get('apikey')")
    expect(edgeSource).not.toContain(
      'authHeader !== `Bearer ${serviceRoleKey}`',
    )
  })

  it('calls only the server-side recompute wrapper', () => {
    expect(edgeSource).toMatch(
      /supabase\.rpc\(\s*['"]internal_sanitario_recompute_agenda_for_fazenda['"]/,
    )
  })

  it('keeps the internal core client-inaccessible and validates role plus target farm', () => {
    expect(migrationSource).toContain(
      "current_setting('role', true) is distinct from 'service_role'",
    )
    expect(migrationSource).toMatch(
      /where f\.id = _fazenda_id\s+and f\.deleted_at is null/,
    )
    expect(migrationSource).toMatch(
      /revoke execute on function public\.internal_sanitario_recompute_agenda_core\(uuid, uuid, date\)[\s\S]*from public, anon, authenticated, service_role/,
    )
    expect(migrationSource).toMatch(
      /grant execute on function public\.internal_sanitario_recompute_agenda_for_fazenda\(uuid, date\)\s+to service_role/,
    )
  })
})
