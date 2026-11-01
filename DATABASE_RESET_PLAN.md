# Database Reset and Test Data Cleanup Plan

**Target Database:** `developer_growth_db`  
**Phase:** Phase 1 — Database Inspection and Reset Planning Only  
**Execution Mode:** Inspection Only (No data deleted, truncated, or modified)  
**Date:** 2026-10-30  
**Status:** Plan Ready for Review  

---

## 1. Executive Summary

This document specifies a safe, transaction-bound reset plan to purge all developer and test accounts and their associated downstream records (repositories, skill evidence, analysis snapshots, roadmap progress) while preserving **exactly one administrator account** alongside all shared application catalogs, recommendation templates, and schema configurations.

No destructive operations have been performed during this phase. Execution requires explicit operator review, backup verification, and manual confirmation in Phase 2.

---

## 2. Current Database State & Inventory

A live schema inspection of MySQL database `developer_growth_db` identified **7 tables** with the following row distribution:

### Table Summary & Data Classification

| Table Name | Total Rows | Classification | Affected by Reset? | Notes |
|---|---|---|---|---|
| `users` | **18** | User Identity | **YES** | 16 developer test users to delete; 1 Admin preserved; 1 Admin evaluated |
| `repositories` | **46** | User-Owned Data | **YES** | 38 developer repositories to delete; 8 owned by Admin ID 23 |
| `skill_evidence` | **105** | User-Owned Data | **YES** | All 105 rows belong to developer repos; 0 belong to admins |
| `analysis_snapshots` | **170** | User-Owned Data | **YES** | All 170 rows belong to developer users (7 and 263) |
| `user_roadmap_progress` | **1** | User-Owned Data | **YES** | Belongs to developer user 7 |
| `role_requirements` | **34** | Shared Catalog | **NO (PRESERVE)** | Global engineering role taxonomy across 7 disciplines |
| `recommendation_templates` | **5** | Shared Catalog | **NO (PRESERVE)** | Admin-managed learning recommendations |

### User Distribution Breakdown
- **Total Registered Accounts:** 18
- **Administrator Accounts (`role = 'ADMIN'`):** 2
- **Developer / Test Accounts (`role = 'USER'`):** 16

---

## 3. Administrator Candidate Analysis

The database currently contains two accounts with the `ADMIN` role. In accordance with task requirements, neither account has been selected or modified automatically.

### Administrator Profiles

| Attribute | Candidate A (Recommended) | Candidate B |
|---|---|---|
| **User ID** | **19** | **23** |
| **Display Name** | `Super Admin Updated` | `Suryaa` |
| **Email Address** | `super.admin@example.com` | `suryaa@gmail.com` |
| **Account Status** | `is_active = 1` (Active) | `is_active = 1` (Active) |
| **Target Role** | Java Backend Developer | Java Backend Developer |
| **Created At** | 2026-10-20 11:18:29 UTC | 2026-10-20 11:33:23 UTC |
| **Updated At** | 2026-10-30 05:20:52 UTC | 2026-10-30 05:20:52 UTC |
| **GitHub Connected?** | No (`github_username = null`) | No (`github_username = null`) |
| **Repositories Owned** | **0** | **8** (`octocat/*` test fixtures) |
| **Skill Evidence Owned** | 0 | 0 |
| **Snapshots Owned** | 0 | 0 |
| **Roadmap Progress** | 0 | 0 |

### Recommendation
- **Primary Recommendation: Preserve Candidate A (User ID 19 — `super.admin@example.com`)**  
  *Rationale:* User 19 is a dedicated system administrator account with zero extraneous test repositories, test artifacts, or developer baggage. Preserving User 19 provides the cleanest administrative baseline.
- **Alternative: Candidate B (User ID 23 — `suryaa@gmail.com`)**  
  *Rationale:* If Suryaa is the primary human operator and intends to log in using their personal email, User 23 can be preserved instead. However, the operator must decide whether to retain or purge the 8 mock `octocat` repositories currently linked to User 23.

---

## 4. All Developer / Test Accounts to be Removed

The following 16 `USER` accounts and their downstream data will be deleted during the reset:

| ID | Name | Email | Active | GitHub Username | Downstream Records |
|---|---|---|---|---|---|
| 1 | Alex Johnson | `alex.test@example.com` | Yes | None | 0 repos, 0 snaps |
| 2 | Hacker | `hacker@example.com` | Yes | None | 0 repos, 0 snaps |
| 3 | Diagnostic Test | `diag1791832658148@example.com` | Yes | None | 0 repos, 0 snaps |
| 4 | Suryaa Test | `suryaa.test@example.com` | Yes | None | 0 repos, 0 snaps |
| 5 | Test | `test123@example.com` | Yes | None | 0 repos, 0 snaps |
| 6 | Verify User | `verify_test_1791927791187@example.com` | Yes | None | 0 repos, 0 snaps |
| 7 | Tester1 | `tester1@gmail.com` | Yes | `Suryaaa27` | 16 repos, 44 evidence, 136 snapshots, 1 roadmap |
| 8 | Test User | `testuser_probe@example.com` | Yes | None | 0 repos, 0 snaps |
| 9 | Dev Alex | `alex.test.1760413300@example.com` | Yes | None | 0 repos, 0 snaps |
| 24 | Alex Test | `alex.test99@example.com` | Yes | None | 0 repos, 0 snaps |
| 109 | Pranali | `pranali@gmail.com` | Yes | `pranali11-11` | 4 repos, 17 evidence, 0 snaps |
| 263 | Pranalii | `pranali11@gmail.com` | Yes | None | 16 repos, 44 evidence, 34 snapshots |
| 300 | Progress Tester | `progress_test_1793353914454@example.com` | Yes | None | 0 repos, 0 snaps |
| 301 | Progress Tester | `progress_test_1793353927910@example.com` | Yes | None | 1 repo, 0 snaps |
| 313 | Roadmap Alice | `roadmap_user1_1793356866744@example.com` | Yes | None | 1 repo, 0 snaps |
| 314 | Roadmap Bob | `roadmap_user2_1793356866744@example.com` | Yes | None | 0 repos, 0 snaps |

*Note on Unselected Admin:* Whichever administrator is NOT selected for preservation will also be safely removed or demoted as part of the reset to guarantee that exactly one administrator account remains.

---

## 5. Foreign-Key Considerations & Dependencies

Live inspection of `information_schema.REFERENTIAL_CONSTRAINTS` confirmed the foreign key structure:

```mermaid
graph TD
    users["users (Parent)"]
    role_requirements["role_requirements (Parent)"]
    
    repositories["repositories"] -->|fk_repositories_user_id (CASCADE)| users
    skill_evidence["skill_evidence"] -->|fk_skill_evidence_repository_id (CASCADE)| repositories
    analysis_snapshots["analysis_snapshots"] -->|fk_snapshots_user_id (CASCADE)| users
    analysis_snapshots -.->|fk_snapshots_target_role_id (RESTRICT)| role_requirements
    user_roadmap_progress["user_roadmap_progress"] -->|fk_roadmap_user_id (CASCADE)| users
    user_roadmap_progress -.->|fk_roadmap_role_id (CASCADE)| role_requirements
    recommendation_templates["recommendation_templates"]
```

### Dependency Rules & Observations
1. **`skill_evidence` -> `repositories` (`ON DELETE CASCADE`):**  
   Deleting a repository cascades to all its associated skill evidence records.
2. **`repositories` -> `users` (`ON DELETE CASCADE`):**  
   Deleting a user cascades to all repositories owned by that user.
3. **`analysis_snapshots` -> `users` (`ON DELETE CASCADE`):**  
   Deleting a user cascades to all their snapshots.
4. **`analysis_snapshots` -> `role_requirements` (`ON DELETE RESTRICT`):**  
   Snapshots cannot block role deletion if the user's snapshots are already purged.
5. **`user_roadmap_progress` -> `users` (`ON DELETE CASCADE`):**  
   Deleting a user cascades to all roadmap task progress rows.

### Defensive Deletion Hierarchy
Although MySQL foreign keys are configured with `CASCADE`, the cleanup script will explicitly delete child records before parent records in strict bottom-up order to:
- Guarantee transaction predictability across storage engines.
- Allow precise audit logging of affected row counts per table.
- Eliminate locks or deadlocks during multi-table cascading deletes.

---

## 6. Exact Deletion Order

Given a target preserved administrator ID `$PRESERVED_ADMIN_ID` (e.g., 19), the deletion script will execute the following sequence inside a single ACID transaction:

### Step 1: Pre-Condition Checks & Target Identification
- Assert `$PRESERVED_ADMIN_ID` exists in `users`.
- Assert `role = 'ADMIN'` and `is_active = 1` for `$PRESERVED_ADMIN_ID`.
- Compile the set of target user IDs to purge:
  ```sql
  SELECT id FROM users WHERE id != ?;
  ```
  *(Expected: 17 users: 16 developers + 1 unselected admin).*

### Step 2: Delete Skill Evidence (Leaf Records)
```sql
DELETE se FROM skill_evidence se
JOIN repositories r ON se.repository_id = r.id
WHERE r.user_id != ?;
```
*(Expected affected rows: 105 rows).*

### Step 3: Delete Repositories (Parent of Evidence, Child of Users)
```sql
DELETE FROM repositories WHERE user_id != ?;
```
*(Expected affected rows: 38 rows if Admin 23 is preserved; 46 rows if Admin 19 is preserved).*

### Step 4: Delete Analysis Snapshots (Child of Users)
```sql
DELETE FROM analysis_snapshots WHERE user_id != ?;
```
*(Expected affected rows: 170 rows).*

### Step 5: Delete User Roadmap Progress (Child of Users)
```sql
DELETE FROM user_roadmap_progress WHERE user_id != ?;
```
*(Expected affected rows: 1 row).*

### Step 6: Delete Target Users (Parent Records)
```sql
DELETE FROM users WHERE id != ?;
```
*(Expected affected rows: 17 rows).*

### Step 7: Post-Condition Assertions
- Verify `SELECT COUNT(*) FROM users` equals **1**.
- Verify `SELECT id, role, is_active FROM users` matches `$PRESERVED_ADMIN_ID`, `ADMIN`, `1`.
- Verify `SELECT COUNT(*) FROM role_requirements` equals **34** (unmodified).
- Verify `SELECT COUNT(*) FROM recommendation_templates` equals **5** (unmodified).

---

## 7. Data Preservation & Shared Catalogs

The following tables and system configurations will be strictly preserved:

1. **`role_requirements` (34 rows):**  
   All engineering roles across Backend, Frontend, Full Stack, Mobile, Cloud/DevOps, Data, and Quality Assurance disciplines remain completely untouched.
2. **`recommendation_templates` (5 rows):**  
   Admin-managed learning recommendation templates remain completely untouched.
3. **Preserved Administrator Record:**  
   The selected administrator's `id`, `name`, `email`, `password_hash`, `role`, `target_role`, `target_role_id`, and `is_active` state remain intact.
4. **AUTO_INCREMENT Counters:**  
   AUTO_INCREMENT counters will **NOT** be reset to avoid key collisions or ID confusion with external logs.

---

## 8. Backup and Recovery Procedure

Prior to executing any record deletion in Phase 2, the operator must execute and verify a complete database backup.

### Step 1: Create Complete Backup
Using the full MySQL Server `mysqldump` utility:

```powershell
# From project root:
$mysqldump = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe"
& $mysqldump -h localhost -u root -proot --routines --triggers --single-transaction developer_growth_db | Out-File -FilePath "backup_pre_reset_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql" -Encoding utf8
```

### Step 2: Verify Backup Integrity
Verify the generated backup file:
1. File size is greater than 50 KB:
   ```powershell
   Get-Item backup_pre_reset_*.sql | Select-Object Name, Length, LastWriteTime
   ```
2. Verify the backup ends with the successful dump marker:
   ```powershell
   Get-Content backup_pre_reset_*.sql | Select-Object -Last 5
   # Must display: -- Dump completed on YYYY-MM-DD HH:MM:SS
   ```
3. Verify that table schemas and row data exist in the dump:
   ```powershell
   Select-String -Path backup_pre_reset_*.sql -Pattern "CREATE TABLE \`users\`|INSERT INTO \`users\`"
   ```

### Step 3: Disaster Recovery / Restore Procedure
If the reset encounters an unexpected error or needs to be rolled back:

```powershell
# Restore from backup file:
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
Get-Content "backup_pre_reset_<timestamp>.sql" | & $mysql -h localhost -u root -proot developer_growth_db
```

### Step 4: Post-Restore Authentication Verification
Verify that the preserved administrator can authenticate and obtain a valid session:
```powershell
# Run verify admin login check:
node --env-file=server/.env -e "
import pool from './server/src/config/db.js';
const [rows] = await pool.query(\"SELECT id, name, email, role, is_active FROM users WHERE role = 'ADMIN'\");
console.log('Restored Admins:', rows);
await pool.end();
"
```

---

## 9. Proposed Reset Script Design (`server/scripts/resetTestData.js`)

In Phase 2, the reset logic will be packaged into a standalone, safe CLI tool:

### Script Capabilities & Safety Controls
1. **Mandatory Admin ID Argument:**  
   Requires `--preserve-admin-id <id>` or interactive prompt. It will never proceed with a default or inferred admin.
2. **Admin Validation Guard:**  
   Asserts that the provided ID exists, has `role = 'ADMIN'`, and has `is_active = 1`. If an invalid ID or a developer user ID is provided, it immediately aborts.
3. **Single Transaction Boundary:**  
   Wraps all deletion steps in `await connection.beginTransaction()`. Any error triggers an immediate `await connection.rollback()`.
4. **Dry-Run Mode (`--dry-run`):**  
   Supports running with `--dry-run` to output exact counts of records that *would* be deleted without executing `COMMIT`.
5. **No Secret Logging:**  
   Logs only table names and affected row counts; passwords, hashes, and tokens are never printed.
6. **Post-Deletion Verification:**  
   Automatically queries all tables after deletion to confirm the expected final counts before committing.

---

## 10. Risks, Edge Cases & Unresolved Questions

1. **Which Administrator Account to Preserve?**  
   - Candidate A (ID 19 — `super.admin@example.com`): Pure admin with zero test data.
   - Candidate B (ID 23 — `suryaa@gmail.com`): Named admin with 8 mock `octocat` repositories.  
   *Decision Required:* The user/operator must select which admin to preserve before running Phase 2.
2. **Handling Admin 23's 8 Mock Repositories:**  
   If Admin 23 is preserved, should its 8 `octocat` repositories be preserved or deleted? (Deleting them leaves Admin 23 in a clean state identical to a freshly provisioned admin).
3. **Session Token Invalidation:**  
   Active JWTs held by deleted users in browser `sessionStorage` will immediately fail upon their next request because `authMiddleware.js` queries `SELECT id FROM users WHERE id = ? LIMIT 1` on every request. No orphaned sessions can persist.

---

## 11. Conclusion & Next Steps

Phase 1 inspection and planning is complete. No records have been modified.

**To proceed to Phase 2:**
1. User reviews this plan and confirms which Administrator account to preserve (ID 19 or ID 23).
2. Execute Step 1 of the backup plan to create `backup_pre_reset.sql`.
3. Implement `server/scripts/resetTestData.js` following the design in Section 9.
4. Run `--dry-run` first, then execute the live reset transaction.
5. Verify post-reset health checks and admin login.

