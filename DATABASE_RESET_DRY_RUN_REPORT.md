# Database Reset Dry-Run Report

**Execution Target:** `developer_growth_db`  
**Preserved Administrator ID:** 23 (`suryaa@gmail.com`)  
**Mode:** Dry Run (`--preserve-admin-id 23 --dry-run`)  
**Date:** 2026-10-30  
**Status:** Verification Successful — Awaiting User Approval  

---

## 1. Preflight Backup Verification

A complete, uncompressed logical backup of the entire MySQL database was created and verified prior to running the dry run.

- **Backup File:** [`d:\Projects\developer-growth-platform\backup_pre_reset.sql`](file:///d:/Projects/developer-growth-platform/backup_pre_reset.sql)
- **File Size:** **135,278 bytes (135 KB)**
- **Verification Status:** Verified non-empty, contains complete DDL schema definitions and table data for all 7 database tables (`users`, `repositories`, `skill_evidence`, `analysis_snapshots`, `user_roadmap_progress`, `role_requirements`, `recommendation_templates`), and concludes with `-- Dump completed on 2026-10-30 23:31:10`.

---

## 2. Preserved Administrator Account

The target administrator account was verified live in MySQL:

| Field | Verified Value |
|---|---|
| **User ID** | **23** |
| **Name** | `Suryaa` |
| **Email** | `suryaa@gmail.com` |
| **Role** | `ADMIN` |
| **Active Status** | `1` (Active) |
| **Target Role** | `Java Backend Developer` |
| **Target Role ID** | `1` |
| **GitHub Linked** | `null` |
| **Account Preservation** | **Strictly Preserved** |

---

## 3. Accounts Targeted for Deletion

A total of **17 user accounts** will be deleted:

### Unselected Administrator (1 account)
- **ID 19:** `super.admin@example.com` (`Super Admin Updated`) — Role: `ADMIN`

### Developer / Test Accounts (16 accounts)
| ID | Name | Email | Role |
|---|---|---|---|
| 1 | Alex Johnson | `alex.test@example.com` | USER |
| 2 | Hacker | `hacker@example.com` | USER |
| 3 | Diagnostic Test | `diag1791832658148@example.com` | USER |
| 4 | Suryaa Test | `suryaa.test@example.com` | USER |
| 5 | Test | `test123@example.com` | USER |
| 6 | Verify User | `verify_test_1791927791187@example.com` | USER |
| 7 | Tester1 | `tester1@gmail.com` | USER |
| 8 | Test User | `testuser_probe@example.com` | USER |
| 9 | Dev Alex | `alex.test.1760413300@example.com` | USER |
| 24 | Alex Test | `alex.test99@example.com` | USER |
| 109 | Pranali | `pranali@gmail.com` | USER |
| 263 | Pranalii | `pranali11@gmail.com` | USER |
| 300 | Progress Tester | `progress_test_1793353914454@example.com` | USER |
| 301 | Progress Tester | `progress_test_1793353927910@example.com` | USER |
| 313 | Roadmap Alice | `roadmap_user1_1793356866744@example.com` | USER |
| 314 | Roadmap Bob | `roadmap_user2_1793356866744@example.com` | USER |

---

## 4. Exact Table Impact and Affected Row Counts

| Table Name | Current Rows | Rows to Delete | Final Row Count | Notes |
|---|---|---|---|---|
| `users` | 18 | **17** | **1** | Only preserved Admin ID 23 remains |
| `repositories` | 46 | **46** | **0** | 38 developer repos + 8 mock repos owned by Admin 23 |
| `skill_evidence` | 105 | **105** | **0** | All 105 evidence records belong to developer repos |
| `analysis_snapshots` | 170 | **170** | **0** | All 170 snapshot records belong to developer users |
| `user_roadmap_progress` | 1 | **1** | **0** | 1 progress record belongs to developer user 7 |
| `role_requirements` | 34 | **0** | **34** | **Preserved Unchanged** (Global Role Catalog) |
| `recommendation_templates` | 5 | **0** | **5** | **Preserved Unchanged** (Admin Learning Templates) |

---

## 5. Deletion Order Enforcing Foreign Key Integrity

To guarantee referential integrity and avoid deadlocks, the reset script executes deletions in bottom-up leaf-to-parent order:

```text
Step 1: DELETE FROM skill_evidence;
        (Leaf records referencing repositories.id)

Step 2: DELETE FROM repositories;
        (Parent of skill_evidence, child of users.id; deletes all 46 repos including Admin 23's mock repos)

Step 3: DELETE FROM analysis_snapshots;
        (Child records referencing users.id)

Step 4: DELETE FROM user_roadmap_progress;
        (Child records referencing users.id)

Step 5: DELETE FROM users WHERE id != 23;
        (Parent user records; purges 16 developer users + unselected Admin 19)
```

---

## 6. Preserved Shared Catalogs and Infrastructure

- **`role_requirements`:** All 34 standard engineering roles across 7 disciplines remain intact.
- **`recommendation_templates`:** All 5 recommendation templates remain intact.
- **`AUTO_INCREMENT` Counters:** Sequence numbers are not reset, preventing ID collisions with previous audit logs.
- **Table Schema DDL:** No tables are dropped, altered, or truncated.

---

## 7. Dry-Run Verification Conclusion

The dry run completed with **zero errors and zero database modifications**.

The reset script [`server/scripts/resetTestData.js`](file:///d:/Projects/developer-growth-platform/server/scripts/resetTestData.js) is armed and ready to execute the live transaction upon user approval.

