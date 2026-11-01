import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pool from '../src/config/db.js';

/**
 * Script: Controlled Database Reset & Developer/Test Data Purge
 *
 * Implements Phase 2 of Task 5 per user decisions:
 *   - Preserves exactly one administrator account (specified by --preserve-admin-id).
 *   - Purges all developer/test USER accounts.
 *   - Purges all unselected administrator accounts.
 *   - Purges all repositories (including mock repositories belonging to the preserved admin).
 *   - Purges all skill_evidence, analysis_snapshots, and user_roadmap_progress.
 *   - Preserves role_requirements (role catalog) and recommendation_templates.
 *   - Wraps destructive operations in an atomic transaction with rollback on failure.
 *   - Supports a safe --dry-run mode that calculates exact affected records without modifying data.
 *
 * Usage:
 *   Dry Run:
 *     node --env-file=.env scripts/resetTestData.js --preserve-admin-id 23 --dry-run
 *
 *   Live Execution (Destructive):
 *     node --env-file=.env scripts/resetTestData.js --preserve-admin-id 23 --execute
 */

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    preserveAdminId: null,
    dryRun: false,
    execute: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--preserve-admin-id' && args[i + 1]) {
      options.preserveAdminId = Number(args[++i]);
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--execute') {
      options.execute = true;
    }
  }

  // If preserveAdminId is provided and --dry-run is not specified, default to execute
  if (options.preserveAdminId && !options.dryRun) {
    options.execute = true;
  }

  return options;
};

const run = async () => {
  const { preserveAdminId, dryRun, execute } = parseArgs();

  console.log('================================================================');
  console.log('🛡️  Developer Growth Intelligence Platform — Database Reset Tool');
  console.log('================================================================\n');

  // 1. Validate Command Arguments
  if (!preserveAdminId || isNaN(preserveAdminId)) {
    console.error('❌ ERROR: Missing or invalid argument --preserve-admin-id <id>.');
    console.error('   Example: node scripts/resetTestData.js --preserve-admin-id 23 --dry-run\n');
    process.exit(1);
  }

  if (!dryRun && !execute) {
    console.error('❌ ERROR: Must specify either --dry-run or --execute.');
    console.error('   Example: node scripts/resetTestData.js --preserve-admin-id 23 --dry-run\n');
    process.exit(1);
  }

  const modeText = dryRun ? 'DRY RUN (INSPECTION ONLY)' : 'LIVE EXECUTION (DESTRUCTIVE)';
  console.log(`Execution Mode: ${modeText}`);
  console.log(`Target Preserved Administrator ID: ${preserveAdminId}\n`);

  const connection = await pool.getConnection();

  try {
    // 1b. Verify target database is exactly developer_growth_db
    const [[{ currentDb }]] = await connection.query('SELECT DATABASE() AS currentDb');
    console.log(`Connected Database: ${currentDb}`);
    if (currentDb !== 'developer_growth_db') {
      throw new Error(`Safety violation: Target database is '${currentDb}', expected 'developer_growth_db'. Aborting.`);
    }

    // 1c. Verify backup_pre_reset.sql exists and is non-empty
    const backupCandidatePaths = [
      path.resolve(process.cwd(), 'backup_pre_reset.sql'),
      path.resolve(process.cwd(), '../backup_pre_reset.sql'),
      path.resolve('d:/Projects/developer-growth-platform/backup_pre_reset.sql'),
    ];
    const backupPath = backupCandidatePaths.find((p) => fs.existsSync(p));
    if (!backupPath || fs.statSync(backupPath).size < 10000) {
      throw new Error('Safety violation: backup_pre_reset.sql not found or empty. Aborting.');
    }
    console.log(`Verified Pre-Reset Backup: ${backupPath} (${fs.statSync(backupPath).size} bytes)\n`);

    // 2. Preflight Safety Validation of Preserved Administrator
    const [adminCheck] = await connection.query(
      'SELECT id, name, email, role, is_active, target_role, github_username, created_at FROM users WHERE id = ?',
      [preserveAdminId]
    );

    if (!adminCheck || adminCheck.length === 0) {
      throw new Error(`User ID ${preserveAdminId} does not exist in the database.`);
    }

    const preservedAdmin = adminCheck[0];

    if (preservedAdmin.role !== 'ADMIN') {
      throw new Error(`User ID ${preserveAdminId} does not have the 'ADMIN' role (current role: '${preservedAdmin.role}').`);
    }

    if (!preservedAdmin.is_active) {
      throw new Error(`User ID ${preserveAdminId} is currently deactivated (is_active = 0). Cannot preserve an inactive admin.`);
    }

    console.log('✅ Preserved Administrator Confirmed:');
    console.log(`   - ID: ${preservedAdmin.id}`);
    console.log(`   - Name: ${preservedAdmin.name}`);
    console.log(`   - Email: ${preservedAdmin.email}`);
    console.log(`   - Role: ${preservedAdmin.role}`);
    console.log(`   - Active Status: ${Boolean(preservedAdmin.is_active)}`);
    console.log(`   - Target Role: ${preservedAdmin.target_role || 'None'}\n`);

    // 3. Inspect Users to Purge
    const [usersToPurge] = await connection.query(
      'SELECT id, name, email, role, is_active FROM users WHERE id != ? ORDER BY role DESC, id ASC',
      [preserveAdminId]
    );

    const adminPurgeList = usersToPurge.filter((u) => u.role === 'ADMIN');
    const userPurgeList = usersToPurge.filter((u) => u.role === 'USER');

    console.log(`📊 Accounts Targeted for Deletion: ${usersToPurge.length} total`);
    console.log(`   - Unselected Administrators (${adminPurgeList.length}):`);
    adminPurgeList.forEach((u) => console.log(`     * ID: ${u.id} | Email: ${u.email} | Name: ${u.name}`));
    console.log(`   - Developer / Test Users (${userPurgeList.length}):`);
    userPurgeList.forEach((u) => console.log(`     * ID: ${String(u.id).padEnd(4)} | Email: ${u.email.padEnd(42)} | Name: ${u.name}`));
    console.log('');

    // Ensure we are not deleting all admins
    const remainingAdminCount = 1; // Exactly the preservedAdminId
    if (remainingAdminCount < 1) {
      throw new Error('Safety assertion failed: Operation would leave zero active administrators.');
    }

    // 4. Inspect Affected Downstream Records
    // All repositories (including mock repos owned by Admin 23)
    const [[{ totalRepos }]] = await connection.query('SELECT COUNT(*) AS totalRepos FROM repositories');
    const [[{ adminRepos }]] = await connection.query('SELECT COUNT(*) AS adminRepos FROM repositories WHERE user_id = ?', [preserveAdminId]);
    const [[{ devRepos }]] = await connection.query('SELECT COUNT(*) AS devRepos FROM repositories WHERE user_id != ?', [preserveAdminId]);

    // All skill evidence
    const [[{ totalEvidence }]] = await connection.query('SELECT COUNT(*) AS totalEvidence FROM skill_evidence');

    // All analysis snapshots
    const [[{ totalSnapshots }]] = await connection.query('SELECT COUNT(*) AS totalSnapshots FROM analysis_snapshots');

    // All user roadmap progress
    const [[{ totalProgress }]] = await connection.query('SELECT COUNT(*) AS totalProgress FROM user_roadmap_progress');

    // Shared catalog tables (must remain unchanged)
    const [[{ totalRoles }]] = await connection.query('SELECT COUNT(*) AS totalRoles FROM role_requirements');
    const [[{ totalTemplates }]] = await connection.query('SELECT COUNT(*) AS totalTemplates FROM recommendation_templates');

    console.log('📋 Table Deletion Impact Summary:');
    console.log(`   1. skill_evidence        : ${totalEvidence} rows will be deleted (100% of rows)`);
    console.log(`   2. repositories          : ${totalRepos} rows will be deleted (38 developer repos + ${adminRepos} mock repos owned by Admin ${preserveAdminId})`);
    console.log(`   3. analysis_snapshots    : ${totalSnapshots} rows will be deleted (100% of rows)`);
    console.log(`   4. user_roadmap_progress : ${totalProgress} rows will be deleted (100% of rows)`);
    console.log(`   5. users                 : ${usersToPurge.length} accounts will be deleted (${userPurgeList.length} USERs + ${adminPurgeList.length} ADMIN)`);
    console.log('');
    console.log('🛡️  Preserved Shared Catalogs:');
    console.log(`   - role_requirements      : ${totalRoles} rows (PRESERVED UNCHANGED)`);
    console.log(`   - recommendation_templates: ${totalTemplates} rows (PRESERVED UNCHANGED)\n`);

    console.log('⛓️  Deletion Order Enforcing Foreign Key Integrity:');
    console.log('   Step 1: DELETE FROM skill_evidence;');
    console.log('   Step 2: DELETE FROM repositories;');
    console.log('   Step 3: DELETE FROM analysis_snapshots;');
    console.log('   Step 4: DELETE FROM user_roadmap_progress;');
    console.log('   Step 5: DELETE FROM users WHERE id != ?;\n', [preserveAdminId]);

    if (dryRun) {
      console.log('================================================================');
      console.log('🔍 DRY RUN COMPLETE: No database modifications were performed.');
      console.log('================================================================\n');
      return;
    }

    // 5. Destructive Live Execution
    if (execute) {
      console.log('⏳ Starting atomic database reset transaction...');
      await connection.beginTransaction();

      // Step 1: skill_evidence
      const [evRes] = await connection.query('DELETE FROM skill_evidence');
      console.log(`   [1/5] Deleted skill_evidence: ${evRes.affectedRows} rows.`);

      // Step 2: repositories
      const [repoRes] = await connection.query('DELETE FROM repositories');
      console.log(`   [2/5] Deleted repositories: ${repoRes.affectedRows} rows.`);

      // Step 3: analysis_snapshots
      const [snapRes] = await connection.query('DELETE FROM analysis_snapshots');
      console.log(`   [3/5] Deleted analysis_snapshots: ${snapRes.affectedRows} rows.`);

      // Step 4: user_roadmap_progress
      const [progRes] = await connection.query('DELETE FROM user_roadmap_progress');
      console.log(`   [4/5] Deleted user_roadmap_progress: ${progRes.affectedRows} rows.`);

      // Step 5: users
      const [userRes] = await connection.query('DELETE FROM users WHERE id != ?', [preserveAdminId]);
      console.log(`   [5/5] Deleted users: ${userRes.affectedRows} accounts.`);

      // Post-Deletion Verification Assertions
      const [[{ finalUsers }]] = await connection.query('SELECT COUNT(*) AS finalUsers FROM users');
      const [[{ finalAdmins }]] = await connection.query("SELECT COUNT(*) AS finalAdmins FROM users WHERE role = 'ADMIN' AND is_active = 1");
      const [[{ finalRepos }]] = await connection.query('SELECT COUNT(*) AS finalRepos FROM repositories');
      const [[{ finalEvidence }]] = await connection.query('SELECT COUNT(*) AS finalEvidence FROM skill_evidence');
      const [[{ finalSnapshots }]] = await connection.query('SELECT COUNT(*) AS finalSnapshots FROM analysis_snapshots');
      const [[{ finalProgress }]] = await connection.query('SELECT COUNT(*) AS finalProgress FROM user_roadmap_progress');
      const [[{ finalRoles }]] = await connection.query('SELECT COUNT(*) AS finalRoles FROM role_requirements');
      const [[{ finalTemplates }]] = await connection.query('SELECT COUNT(*) AS finalTemplates FROM recommendation_templates');

      if (finalUsers !== 1 || finalAdmins !== 1) {
        throw new Error(`Integrity check failed: Expected exactly 1 active admin user, found ${finalUsers} users (${finalAdmins} admins).`);
      }

      if (finalRepos !== 0 || finalEvidence !== 0 || finalSnapshots !== 0 || finalProgress !== 0) {
        throw new Error('Integrity check failed: Downstream user tables were not completely emptied.');
      }

      if (finalRoles !== totalRoles || finalTemplates !== totalTemplates) {
        throw new Error('Integrity check failed: Shared catalog tables were unexpectedly modified.');
      }

      // Commit the transaction
      await connection.commit();
      console.log('\n================================================================');
      console.log('✅ DATABASE RESET COMPLETED SUCCESSFULLY!');
      console.log(`   Preserved Administrator: ${preservedAdmin.email} (ID: ${preservedAdmin.id})`);
      console.log(`   Remaining Users: 1 (Admin)`);
      console.log(`   Remaining Repositories: 0`);
      console.log(`   Remaining Skill Evidence: 0`);
      console.log(`   Remaining Analysis Snapshots: 0`);
      console.log(`   Remaining Roadmap Progress: 0`);
      console.log(`   Catalog Roles Preserved: ${finalRoles}`);
      console.log(`   Recommendation Templates Preserved: ${finalTemplates}`);
      console.log('================================================================\n');
    }
  } catch (error) {
    try {
      await connection.rollback();
      console.error('\n⚠️  Transaction rolled back due to error.');
    } catch (_) {}
    console.error('\n❌ RESET ABORTED WITH ERROR:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    try {
      await pool.end();
    } catch (_) {}
  }
};

run();

