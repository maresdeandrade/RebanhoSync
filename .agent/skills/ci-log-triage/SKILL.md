---
name: ci-log-triage
description: Use when CI/CD fails, deployment errors occur, or asking "CI failed", "build error", "deployment failed", "GitHub Actions error", "Vercel deploy failed".
---

# Skill: ci-log-triage

## Mission

Diagnose and triage CI/CD failures for Gestão Agro, covering build errors, deployment failures, and automated pipeline issues.

## When to Use

- CI/CD pipeline fails
- User asks: "CI falhou", "build error", "deployment failed"
- GitHub Actions / Vercel / Supabase deployment errors
- Pre-deployment troubleshooting

## Context

**Current State**: Project does NOT have CI/CD configured yet (no `.github/workflows/` files).

> [!NOTE]
> This skill will become useful once CI/CD is set up (planned for future sprint).
> For now, focus on local builds and linting (`pnpm run build`, `pnpm run lint`).
> **Future State**: Will use GitHub Actions for CI + Vercel for frontend deployment + Supabase CLI for DB migrations.

---

## Common Failure Scenarios

### 1. TypeScript Compilation Errors

**Symptom**: `tsc` or `vite build` fails.

**Triage**:

```bash
# Local repro
pnpm exec tsc --noEmit

# Check for type errors
pnpm run build
```

**Common Causes**:

- Missing type definitions (`@types/*` packages)
- Import path errors (wrong `@/` alias)
- Strict mode violations (`strictNullChecks`, `noImplicitAny`)

**Fix**: Resolve type errors locally first, then push.

---

### 2. Linter Failures

**Symptom**: ESLint fails in CI.

**Triage**:

```bash
# Run linter locally
pnpm run lint

# Auto-fix
pnpm run lint --fix
```

**Common Causes**:

- Unused variables
- Missing dependencies in `useEffect`
- Console.log statements (if `no-console` enabled)

---

### 3. Build Output Too Large

**Symptom**: Vercel deploy warns about bundle size.

**Triage**:

```bash
# Analyze bundle
pnpm run build
# Check dist/ folder size
```

**Solutions**:

- Code splitting (React.lazy, dynamic imports)
- Remove unused dependencies
- Use tree-shaking-friendly imports

---

### 4. Environment Variables Missing

**Symptom**: Build succeeds but app crashes with "Missing VITE_SUPABASE_URL".

**Triage**:

- Check Vercel dashboard → Environment Variables
- Ensure all `VITE_*` vars are set for production

---

### 5. Supabase Migration Failures

**Symptom**: `supabase db push` fails in CI.

**Triage**:

```bash
# Test migrations locally
pnpm dlx supabase db reset

# Check migration order
ls -l supabase/migrations/
```

**Common Causes**:

- Migrations out of order (wrong filenames)
- FK constraints fail (missing parent records)
- Syntax errors in SQL

---

## Definition of Done

- [ ] Identify failing step in CI logs
- [ ] Reproduce error locally
- [ ] Fix applied and verified
- [ ] CI passes on re-run

---

## References

- `docs/TESTING_OFFLINE.md` - Local validation before CI
- `package.json` - Available scripts
