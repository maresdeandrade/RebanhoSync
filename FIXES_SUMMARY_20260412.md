# QUICK REFERENCE — Changes Made (2026-04-12)

## ✅ What Was Fixed

### Issue #1: Brucelose + Raiva Duplication
**Problem:** Legacy MAPA seed templates stayed active while official templates were also active → duplicates  
**Fix:** Modified `officialCatalog.ts` to ALWAYS deactivate MAPA_* legacy templates, not just when selected  
**File:** `src/lib/sanitario/officialCatalog.ts` (lines 623-642)

### Issue #2: Raiva D2 Not Generating Auto-Agendas
**Problem:** Raiva D2 (reforço) had `gera_agenda = false`, preventing automatic agenda generation  
**Fix:** Created migration to set `gera_agenda = true` retroactively + added payload marker  
**File:** `supabase/migrations/20260412200000_fix_sanitario_gera_agenda_materialize_standards.sql`

### Issue #3: Standard Protocols Not Materialized
**Problem:** Clostridioses, Reprodução, Controle Estratégico templates never auto-created  
**Fix:** Added RPC function to materialize draft templates when official pack is activated  
**Files:** 
- Migration SQL (RPC definition)
- `src/lib/sanitario/officialCatalog.ts` (lines 753-765 — integration hook)

---

## 🧪 Verification

All changes verified:
- ✅ TypeScript compile: 0 errors
- ✅ Lint: 0 warnings
- ✅ Unit tests: 3/3 passing (including new test for legacy deactivation)
- ✅ No breaking changes to sync contract

---

## 📚 Documentation

Full details available in: [`docs/FIXES_APPLIED_20260412.md`](FIXES_APPLIED_20260412.md)

---

## 🚀 Next: Deploy to Test Farm

1. **Push migration** → DB will run `20260412200000_*` automatically
2. **Sync code** → Users' clients get new `officialCatalog.ts` logic
3. **Test flow:**
   - Create new farm or re-activate pack on existing farm
   - Verify legacy MAPA templates are deactivated ✅
   - Verify Raiva D2 has `gera_agenda = true` ✅
   - Verify Standard protocols appear as DRAFT ✅

---

## ❓ Questions?

- **Overlay payload error (P1):** Not yet investigated — use default regulatory scope for now
- **STANDARD_PROTOCOLS activation:** Draft templates created but user must activate manually in UI
- **Rollback:** Safe — all changes are idempotent and can be undone via SQL
