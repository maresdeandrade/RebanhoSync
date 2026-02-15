# Supabase Security Review

**Date:** 2026-02-11
**Reviewer:** Jules (AI Agent)
**Scope:** Database Schema (RLS, Policies, RPCs), Client Initialization.

## Executive Summary

The application demonstrates a strong security posture with a consistent "Offline-First + Two Rails" architecture. Row Level Security (RLS) is enabled on all business tables, enforcing strict tenant isolation via `fazenda_id`. Role-Based Access Control (RBAC) is implemented via `user_fazendas` and helper functions, distinguishing between `owner`, `manager`, and `cowboy` roles.

One **Critical** vulnerability was identified in an RPC function (`get_user_emails`) which allows potential PII enumeration. All other RPCs follow best practices (explicit `search_path`, strict input validation).

## 1. RLS & Policy Coverage

### Findings
*   **RLS Enabled:** Confirmed on all core tables (`fazendas`, `pastos`, `lotes`, `animais`, `eventos`, `agenda_itens`, `user_profiles`, `user_settings`) and newer extensions (`animais_sociedade`, `categorias_zootecnicas`).
*   **Tenant Isolation:** All policies consistently use `public.has_membership(fazenda_id)` or equivalent checks, preventing cross-tenant data access.
*   **RBAC:**
    *   **Read:** Generally allowed for all farm members (`cowboy`, `manager`, `owner`).
    *   **Write:** Restricted based on business rules (e.g., `owner`/`manager` for critical settings, `cowboy` allowed for daily operations like `eventos`).
*   **Views:** Newer views (e.g., `vw_sanitario_pendencias`) use `security_invoker = true`, correctly respecting the underlying table RLS.

### Recommendations
*   Ensure any future tables created via migration automatically enable RLS.
*   Maintain the pattern of `security_invoker` for views to avoid bypassing RLS.

## 2. RPC Security (Functions)

### Findings
*   **`create_fazenda` (0017):** **Safe**. Uses `SECURITY DEFINER` with `SET search_path = public`. explicitly validates `auth.uid()` and business permissions (`can_create_farm`).
*   **`sanitario_*` (0028):** **Safe**. Complex logic is encapsulated in `SECURITY DEFINER` functions with `SET search_path = public`.
*   **`get_user_emails` (0015):** 🔴 **VULNERABLE**.
    *   **Issue:** The function accepts a list of `user_ids` and returns emails without verifying if the requester has a legitimate relationship (e.g., same farm) with those users.
    *   **Risk:** An attacker could enumerate user IDs to harvest email addresses.
    *   **Fix:** Restrict the query to return emails *only* for users who share a valid farm membership with the requester.

## 3. Client-Side Security

### Findings
*   **Initialization:** `src/lib/supabase.ts` correctly uses `VITE_SUPABASE_ANON_KEY`.
*   **Secrets:** No `service_role` keys were found in the source code.
*   **Env:** Sensitive environment variables are properly excluded from version control.

## 4. Action Plan

1.  **Remediate `get_user_emails`**: Modify the function to enforce a "shared farm" check.
2.  **Hardening Migration**: Apply a new migration to ensure RLS is active on all tables (idempotent check) and apply the RPC fix.
3.  **Testing:** Verify the fix by attempting to fetch an email of a non-related user.

## 5. Proposed Security Tests

*   **Negative Test:** Attempt to `SELECT * FROM fazendas WHERE id = 'target-uuid'` as a user who is NOT a member. Should return 0 rows.
*   **Negative Test (RPC):** Call `get_user_emails` with a random UUID. Should return an empty set.
*   **Role Test:** Attempt to `DELETE FROM fazendas` as a `cowboy`. Should trigger a policy violation.
