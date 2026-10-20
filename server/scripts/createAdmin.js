import 'dotenv/config';
import readline from 'readline';
import bcrypt from 'bcryptjs';
import pool from '../src/config/db.js';

/**
 * CLI Tool: Secure Admin Provisioning
 *
 * Safely provisions an initial administrator account or elevates an existing user
 * to the ADMIN role without exposing any public HTTP registration endpoint,
 * without hardcoding credentials, and without storing plaintext passwords.
 *
 * Usage:
 *   Interactive mode:
 *     node scripts/createAdmin.js
 *
 *   Automated CLI arguments mode:
 *     node scripts/createAdmin.js --name "Admin Name" --email "admin@example.com" --password "SecurePassword123!"
 */

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      parsed.name = args[++i];
    } else if (args[i] === '--email' && args[i + 1]) {
      parsed.email = args[++i];
    } else if (args[i] === '--password' && args[i + 1]) {
      parsed.password = args[++i];
    }
  }
  return parsed;
};

const promptQuestion = (rl, question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
};

const run = async () => {
  console.log('====================================================');
  console.log('🛡️  Developer Growth Platform — Admin Provisioning Tool');
  console.log('====================================================\n');

  const cliArgs = parseArgs();
  let { name, email, password } = cliArgs;

  if (!email || !password) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (!name) {
      name = await promptQuestion(rl, 'Enter Admin Full Name [Platform Administrator]: ');
      if (!name) name = 'Platform Administrator';
    }

    if (!email) {
      email = await promptQuestion(rl, 'Enter Admin Email Address: ');
    }

    if (!password) {
      password = await promptQuestion(rl, 'Enter Admin Password (min 8 chars): ');
    }

    rl.close();
  }

  name = (name || 'Platform Administrator').trim();
  email = (email || '').trim().toLowerCase();
  password = (password || '').trim();

  // Validate inputs
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    console.error('❌ Error: A valid email address is required.');
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error('❌ Error: Password must be at least 8 characters in length.');
    process.exit(1);
  }

  try {
    console.log(`\n⏳ Connecting to database: ${process.env.DB_NAME || 'developer_growth_db'}...`);

    // Verify DB connectivity
    await pool.query('SELECT 1');

    console.log(`🔐 Hashing administrator password with bcrypt (10 rounds)...`);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT id, name, email, role, is_active FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existingUsers.length > 0) {
      const existing = existingUsers[0];
      console.log(`ℹ️  User already exists with ID: ${existing.id} (Current role: ${existing.role}).`);
      console.log(`🔄 Elevating account to ADMIN and updating password...`);

      await pool.query(
        'UPDATE users SET name = ?, password_hash = ?, role = "ADMIN", is_active = TRUE WHERE id = ?',
        [name || existing.name, passwordHash, existing.id]
      );

      console.log('\n====================================================');
      console.log(`✅ SUCCESS: User '${email}' (ID: ${existing.id}) has been elevated to role: ADMIN`);
      console.log('====================================================\n');
    } else {
      console.log(`➕ Creating new administrator account...`);

      const [insertResult] = await pool.query(
        'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, "ADMIN", TRUE)',
        [name, email, passwordHash]
      );

      console.log('\n====================================================');
      console.log(`✅ SUCCESS: Administrator account created with ID: ${insertResult.insertId}`);
      console.log(`👤 Name: ${name}`);
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Role: ADMIN`);
      console.log('====================================================\n');
    }

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Admin provisioning failed:', err.message);
    process.exit(1);
  } finally {
    try {
      await pool.end();
    } catch (_) {}
  }
};

run();
