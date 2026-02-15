## 2026-02-15 - [Authorization Bypass via LocalStorage]
**Vulnerability:** Protected routes (`RequireFarm`) relied solely on the presence of `activeFarmId` in `localStorage` to grant access to farm-specific views, without validating if the user was actually a member of that farm.
**Learning:** Client-side state (especially `localStorage`) is untrusted input. Users can manipulate it to bypass simple "presence" checks. Authentication hooks must validate permissions against server-side data (via RLS or fetched roles) before granting access.
**Prevention:** In client-side route guards, always combine "context existence" checks (e.g., `activeFarmId`) with "permission" checks (e.g., `role`).
