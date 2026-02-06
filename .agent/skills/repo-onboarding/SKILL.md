---
name: repo-onboarding
description: Use when onboarding to the GestaoAgro project, setting up development environment, or asking "how do I get started", "setup project", "install dependencies", "configure environment".
---

# Repo Onboarding - GestaoAgro

## Mission

Guide new developers through the complete setup of the GestaoAgro development environment, ensuring all dependencies, environment variables, and local services are properly configured.

## When to Use

- First-time project setup
- User asks: "how do I start", "setup the project", "onboard", "getting started"
- After cloning the repository
- Setting up a new development machine
- Troubleshooting broken dev environment

## Inputs

- Repository already cloned
- Node.js/pnpm installed (check with `node --version`, `pnpm --version`)
- Git configured

## Procedure

### 1. Verify Prerequisites

```bash
# Check Node.js (required: >=18)
node --version

# Check pnpm (if not installed: npm install -g pnpm)
pnpm --version

# Verify you're in project root
ls package.json
```

### 2. Install Dependencies

```bash
pnpm install
```

**Expected**: ~2-3 minutes, creates `node_modules/` and `pnpm-lock.yaml`

### 3. Configure Environment Variables

```bash
# Copy example if exists, or create new
cp .env.example .env  # OR create .env from scratch
```

**Required variables** (check `.env`):

```plaintext
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...your-anon-key
```

> **TODO**: Confirm actual env var names from codebase (check `src/integrations/supabase/client.ts`)

### 4. Setup Supabase (Local or Remote)

#### Option A: Remote Supabase (Easiest)

1. Get URL and anon key from project owner or [Supabase Dashboard](https://app.supabase.com)
2. Add to `.env` (see step 3)

#### Option B: Local Supabase (Advanced)

```bash
# Install Supabase CLI
pnpm dlx supabase --version

# Init local project (if not already)
pnpm dlx supabase init

# Start local services (Docker required)
pnpm dlx supabase start

# Note the API URL and anon key from output
```

**Expected**: Local Supabase runs on `http://localhost:54321`

### 5. Link Supabase Project (First Time Only)

**⚠️ CRITICAL**: Before running migrations, verify Supabase project is linked.

```bash
# Check if .supabase/ directory exists
ls .supabase/

# If NOT FOUND, link project first:
pnpm dlx supabase link --project-ref <your-project-ref>

# Get project ref from Supabase Dashboard → Settings → General → Reference ID
```

**Current Status**: ❌ `.supabase/` directory does NOT exist  
**Action Required**: Link project before running `db reset`

### 6. Apply Migrations

```bash
# Remote
pnpm dlx supabase db push

# Local (migrations auto-applied on start)
pnpm dlx supabase migration list
```

**Expected**: 7 migrations applied (0001_init through 0006_invite_system)

### 6. Start Development Server

```bash
pnpm run dev
```

**Expected**:

- Vite dev server starts on `http://localhost:5173`
- Browser auto-opens (or navigate manually)
- App loads login page without errors

### 7. Verify Setup

- ✅ Navigate to `/login` → login page renders
- ✅ Check browser console → no errors (warnings OK)
- ✅ Open Dexie DevTools (if installed) → see `PecuariaOfflineDB`
- ✅ Hot reload works (edit `src/App.tsx`, save, see changes)

### 8. Read Project Documentation

Essential reads (in `/docs`):

1. **AI_RULES.md** - Domain architecture rules, MVP scope
2. **ARCHITECTURE.md** - Tech stack, offline-first, sync flow
3. **DB.md** - Database schema, tables, RPCs
4. **OFFLINE.md** - Dexie stores, gesture-based sync

## Guardrails

- ❌ Never commit `.env` (check `.gitignore` includes it)
- ❌ Don't apply migrations to production DB without review
- ⚠️ If using local Supabase, Docker must be running
- ⚠️ Migrations applied locally cannot be easily rolled back (backup first)

## Failure Modes & Troubleshooting

### Issue: `pnpm install` fails

- **Cause**: Network issues,corrupted cache
- **Fix**: `pnpm store prune && pnpm install --force`

### Issue: Vite server fails to start

- **Cause**: Port 5173 in use
- **Fix**: Kill process on port or set different port: `pnpm run dev -- --port 3000`

### Issue: "Failed to fetch" on login

- **Cause**: Wrong VITE_SUPABASE_URL or network issue
- **Fix**: Verify `.env`, check Supabase project status

### Issue: Blank page / white screen

- **Cause**: Build errors, missing dependencies
- **Fix**: Check browser console, run `pnpm run lint`, clear `dist/` and rebuild

## Examples

### Complete Fresh Setup

```bash
# 1. Clone repo
git clone <repo-url> GestaoAgro
cd GestaoAgro

# 2. Install
pnpm install

# 3. Configure
echo "VITE_SUPABASE_URL=https://xxxxx.supabase.co" > .env
echo "VITE_SUPABASE_ANON_KEY=eyJhbG..." >> .env

# 4. Start
pnpm run dev
```

### Local Supabase Setup

```bash
# 1. Start services
pnpm dlx supabase start

# Output example:
#   API URL: http://localhost:54321
#   anon key: eyJhbG...local-key

# 2. Update .env
echo "VITE_SUPABASE_URL=http://localhost:54321" > .env
echo "VITE_SUPABASE_ANON_KEY=<anon-key-from-output>" >> .env

# 3. Check migration status
pnpm dlx supabase migration list

# 4. Start dev
pnpm run dev
```

## Definition of Done

- [ ] `pnpm install` completed without errors
- [ ] `.env` file exists with valid Supabase credentials
- [ ] Database has 7 migrations applied (check via Supabase Dashboard or `pnpm dlx supabase migration list`)
- [ ] `pnpm run dev` starts Vite server successfully
- [ ] App loads at `http://localhost:5173` showing login page
- [ ] No console errors in browser (warnings acceptable)
- [ ] Hot reload functional (edit file, see changes)
- [ ] Developer has read AI_RULES.md and ARCHITECTURE.md

## References

- [AI_RULES.md](../../../AI_RULES.md) - Project rules
- [ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) - System architecture
- [package.json](../../../package.json) - Available scripts
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
