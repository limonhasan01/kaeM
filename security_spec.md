# Security Specification — Bachelor Mess & Meal Manager (`firestore.rules`)

## 1. Data Invariants & Master Source of Truth

1. **Default-Deny Catch-All**: Every path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity Gate**: Every standard read/write requires `request.auth != null` AND `request.auth.token.email_verified == true`. Bootstrapped admin privileges (`mdraihanrahmanlimon01@gmail.com`) strictly enforce `request.auth.token.email_verified == true` alongside `/admins/{uid}` lookup.
3. **Master Gate (Relational Sync)**:
   - `/workspaces/{workspaceId}` is the Master Source of Truth for mess data.
   - Every subcollection (`members`, `mealEntries`, `bazarEntries`, `bazarRequests`, `deposits`, `fines`, `pendingRequests`) verifies via `get(/databases/$(database)/documents/workspaces/$(workspaceId)).data.ownerId == request.auth.uid` (or `isAdmin()`) on single-document operations (`get`, `create`, `update`, `delete`).
   - Additionally, `MealEntry`, `DepositRecord`, `FineRecord`, `BazarRecord`, and `BazarRequisitionRecord` verify `exists(/databases/$(database)/documents/workspaces/$(workspaceId)/members/...)` on creation to prevent orphaned relational records.
4. **PII Isolation**:
   - `MessMember` documents contain `phone` and `whatsapp` numbers. Both `get` and `list` are strictly restricted to the workspace owner (`resource.data.ownerId == request.auth.uid`) or verified `isAdmin()`. Blanket `isSignedIn()` reads are forbidden.
5. **Cost-Optimized Secure List Queries**:
   - All `allow list` rules enforce `isSignedIn() && isVerified() && resource.data.ownerId == request.auth.uid && resource.data.workspaceId == workspaceId` (or `resource.data.ownerId == request.auth.uid` on `/workspaces`) with **zero** `get()` or `exists()` calls inside `list`.
6. **Anti-Update-Gap & Strict Schema Blueprints**:
   - Every `create` and `update` invokes `isValid[Entity](incoming())` checking `keys().hasAll(...)`, `keys().hasOnly(...)`, exact field types, regex patterns, string `.size()` bounds, numeric boundaries, and bounded array constraints.
   - Every `update` partitions mutations into explicit action branches using `incoming().diff(existing()).affectedKeys().hasOnly([...])`, enforces immutable `ownerId`, `workspaceId`, and `createdAt`, and mandates `incoming().updatedAt == request.time`.
7. **Terminal State Locking & Anti-Tamper Permanent Bazar Ledger**:
   - `DepositRecord` locks further non-admin updates once `existing().status == 'approved'`.
   - `BazarRequisitionRecord` locks further non-admin updates once `existing().status == 'completed'`.
   - `PendingRequestRecord` locks further non-admin updates once `existing().status != 'pending'`.
   - `BazarRecord` (`bazarEntries`) is permanently non-deletable (`allow delete: if false;`) so recorded market expenses can never be erased, and any edit must preserve a monotonic `incoming().editCount >= existing().editCount` audit trail (`previousAmount`, `editCount`, `editedAt`).

---

## 2. The "Dirty Dozen" Adversarial Payloads

All 12 payloads below are verified in `firestore.rules.test.ts` to return `PERMISSION_DENIED`:

1. **Payload 1 — Identity Spoofing on Workspace Creation**:
   Authenticated user `uid_attacker` creates `/workspaces/ws_1` with `"ownerId": "uid_victim"`.
2. **Payload 2 — Unverified Email Admin Spoof**:
   Attacker authenticates with `"email": "mdraihanrahmanlimon01@gmail.com"` and `"email_verified": false`, attempting to read/write `/workspaces/ws_victim`.
3. **Payload 3 — Shadow / Ghost Field Injection**:
   Owner updates `/workspaces/ws_1` with all valid fields plus `"isSuperAdmin": true`.
4. **Payload 4 — PII Blanket Read Attack**:
   Signed-in verified user `uid_other` attempts `get` on `/workspaces/ws_1/members/m1` containing `phone: "01711112222"`.
5. **Payload 5 — Unscoped Collection List Scraping**:
   Signed-in verified user `uid_other` executes `list` query on `/workspaces/ws_1/deposits` without owning `resource.data.ownerId`.
6. **Payload 6 — Path Variable / ID Poisoning (1.5KB Junk ID)**:
   Owner attempts `create` on `/workspaces/ws_1/members/{1500_char_malicious_id$@#}`.
7. **Payload 7 — Unbounded Shopper Array Resource Exhaustion**:
   Owner creates `/workspaces/ws_1/bazarEntries/b_overflow` with 25 elements in `shopperIds` (exceeds max 20).
8. **Payload 8 — Terminal State Reversal / Tampering**:
   Non-admin owner attempts `update` on `/workspaces/ws_1/deposits/d1` where `existing().status == 'approved'` to alter `amount` from `3000` to `999999`.
9. **Payload 9 — Value Poisoning on Whitelisted Update Key**:
   Owner updates whitelisted `name` field on `/workspaces/ws_1` with a boolean `true` or 500-character string (exceeds `maxLength: 100`).
10. **Payload 10 — Temporal Forgery (Client-Backdated `createdAt` / `updatedAt`)**:
    Owner creates `/workspaces/ws_1/fines/f1` with a forged past timestamp `createdAt != request.time`.
11. **Payload 11 — Immutable Field Mutation (`ownerId` / `createdAt` Swap)**:
    Owner updates `/workspaces/ws_1/members/m1` attempting to mutate `createdAt` or `ownerId`.
12. **Payload 12 — Orphaned Relational Write**:
    Owner creates `/workspaces/ws_1/mealEntries/2026-10-25_nonexistent` referencing a `memberId` that does not exist in `/workspaces/ws_1/members/{memberId}`, or under a nonexistent `/workspaces/ws_ghost`.
