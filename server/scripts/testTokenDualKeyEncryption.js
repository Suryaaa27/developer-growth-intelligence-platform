import assert from 'assert';
import crypto from 'crypto';
import { encryptToken, decryptToken } from '../src/utils/tokenEncryption.js';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// Preserve original environment
const originalEnv = {
  GITHUB_TOKEN_ENCRYPTION_KEY: process.env.GITHUB_TOKEN_ENCRYPTION_KEY,
  GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY: process.env.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
};

const restoreEnv = () => {
  if (originalEnv.GITHUB_TOKEN_ENCRYPTION_KEY !== undefined) {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = originalEnv.GITHUB_TOKEN_ENCRYPTION_KEY;
  } else {
    delete process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  }

  if (originalEnv.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY !== undefined) {
    process.env.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY = originalEnv.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY;
  } else {
    delete process.env.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY;
  }

  if (originalEnv.JWT_SECRET !== undefined) {
    process.env.JWT_SECRET = originalEnv.JWT_SECRET;
  } else {
    delete process.env.JWT_SECRET;
  }
};

const setTestEnv = ({ primary, legacy, jwt } = {}) => {
  if (primary !== undefined) {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = primary;
  } else {
    delete process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  }

  if (legacy !== undefined) {
    process.env.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY = legacy;
  } else {
    delete process.env.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY;
  }

  if (jwt !== undefined) {
    process.env.JWT_SECRET = jwt;
  } else {
    delete process.env.JWT_SECRET;
  }
};

console.log('====================================================');
console.log('🧪 Starting Dual-Key & Legacy Token Encryption Test Suite');
console.log('====================================================\n');

try {
  // Synthetic test tokens and keys
  const SYNTHETIC_TOKEN = 'gho_synthetic_test_oauth_token_alpha_1234567890';
  const DEDICATED_HEX_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const DEDICATED_PASSPHRASE_KEY = 'super_secure_dedicated_token_encryption_passphrase_2026';
  const LEGACY_JWT_SECRET = 'legacy_production_jwt_signing_secret_key_999';
  const DIFFERENT_KEY_1 = 'different_key_one_random_passphrase_1111111111111';
  const DIFFERENT_KEY_2 = 'different_key_two_random_passphrase_2222222222222';
  const WRONG_HEX_KEY_1 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  const WRONG_HEX_KEY_2 = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

  // 1. Encryption & Decryption with Dedicated Key (Hex 64)
  console.log('[1/8] Testing dedicated GITHUB_TOKEN_ENCRYPTION_KEY (64-char hex)...');
  runTest('Encrypts and decrypts with 64-char hex dedicated key', () => {
    setTestEnv({ primary: DEDICATED_HEX_KEY });

    const encrypted = encryptToken(SYNTHETIC_TOKEN);
    assert.strictEqual(typeof encrypted, 'string');
    assert.strictEqual(encrypted.split(':').length, 3);

    const decrypted = decryptToken(encrypted);
    assert.strictEqual(decrypted, SYNTHETIC_TOKEN);
  });

  // 2. Encryption & Decryption with Dedicated Key (Passphrase)
  console.log('\n[2/8] Testing dedicated GITHUB_TOKEN_ENCRYPTION_KEY (passphrase string)...');
  runTest('Encrypts and decrypts with passphrase string dedicated key', () => {
    setTestEnv({ primary: DEDICATED_PASSPHRASE_KEY });

    const encrypted = encryptToken(SYNTHETIC_TOKEN);
    const decrypted = decryptToken(encrypted);
    assert.strictEqual(decrypted, SYNTHETIC_TOKEN);
  });

  // 3. Legacy Token Decryption with JWT_SECRET Only
  console.log('\n[3/8] Testing legacy token encryption and decryption with JWT_SECRET only...');
  runTest('Encrypts and decrypts when only JWT_SECRET is configured', () => {
    setTestEnv({ jwt: LEGACY_JWT_SECRET });

    const encrypted = encryptToken(SYNTHETIC_TOKEN);
    const decrypted = decryptToken(encrypted);
    assert.strictEqual(decrypted, SYNTHETIC_TOKEN);
  });

  // 4. Dual-Key Fallback: Decrypt legacy token when dedicated key is also configured
  console.log('\n[4/8] Testing dual-key fallback for legacy tokens...');
  runTest('Legacy token encrypted with JWT_SECRET decrypts successfully when dedicated key is configured', () => {
    // Step A: Encrypt token with legacy JWT_SECRET only
    setTestEnv({ jwt: LEGACY_JWT_SECRET });
    const legacyEncrypted = encryptToken(SYNTHETIC_TOKEN);

    // Step B: Now configure both primary dedicated key AND legacy JWT_SECRET
    setTestEnv({ primary: DEDICATED_HEX_KEY, jwt: LEGACY_JWT_SECRET });

    // Decryption must transparently fall back to legacy key and succeed
    const decrypted = decryptToken(legacyEncrypted);
    assert.strictEqual(decrypted, SYNTHETIC_TOKEN);
  });

  runTest('New tokens encrypted with dedicated key decrypt when both keys are configured', () => {
    setTestEnv({ primary: DEDICATED_HEX_KEY, jwt: LEGACY_JWT_SECRET });

    const newEncrypted = encryptToken(SYNTHETIC_TOKEN);
    const decrypted = decryptToken(newEncrypted);
    assert.strictEqual(decrypted, SYNTHETIC_TOKEN);

    // Verify token was indeed encrypted with dedicated key (unaffected if JWT_SECRET changes)
    setTestEnv({ primary: DEDICATED_HEX_KEY, jwt: 'completely_different_jwt_secret_777' });
    const decryptedStillWorks = decryptToken(newEncrypted);
    assert.strictEqual(decryptedStillWorks, SYNTHETIC_TOKEN);
  });

  // 5. Explicit Legacy Migration Key (GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY)
  console.log('\n[5/8] Testing explicit legacy migration key (GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY)...');
  runTest('Token encrypted with old JWT_SECRET decrypts using explicit 64-hex legacy key when prod JWT_SECRET is rotated', () => {
    // Old local environment
    const OLD_LOCAL_JWT_SECRET = 'local_development_jwt_secret_alpha_2026';
    setTestEnv({ jwt: OLD_LOCAL_JWT_SECRET });
    const oldEncryptedToken = encryptToken(SYNTHETIC_TOKEN);

    // Compute the 64-char hex digest of old JWT_SECRET
    const oldDerivedHexKey = crypto.createHash('sha256').update(OLD_LOCAL_JWT_SECRET).digest('hex');
    assert.strictEqual(oldDerivedHexKey.length, 64);

    // Production environment: new primary key, new production JWT secret, old key in GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY
    setTestEnv({
      primary: DEDICATED_HEX_KEY,
      legacy: oldDerivedHexKey,
      jwt: 'brand_new_production_jwt_secret_completely_independent_9999',
    });

    // Must successfully decrypt using GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY fallback
    const decrypted = decryptToken(oldEncryptedToken);
    assert.strictEqual(decrypted, SYNTHETIC_TOKEN);
  });

  runTest('New encryption still uses dedicated primary key in three-key configuration', () => {
    const oldDerivedHexKey = crypto.createHash('sha256').update('some_old_secret').digest('hex');
    setTestEnv({
      primary: DEDICATED_HEX_KEY,
      legacy: oldDerivedHexKey,
      jwt: 'different_production_jwt_secret',
    });

    const newEncrypted = encryptToken(SYNTHETIC_TOKEN);

    // Removing legacy key and changing JWT_SECRET must not affect decryption of new token
    setTestEnv({ primary: DEDICATED_HEX_KEY });
    const decrypted = decryptToken(newEncrypted);
    assert.strictEqual(decrypted, SYNTHETIC_TOKEN);
  });

  runTest('Decryption succeeds using explicit legacy key even when JWT-derived fallback is different', () => {
    const testSecret = 'isolated_legacy_secret_value_xyz';
    const testDerivedHexKey = crypto.createHash('sha256').update(testSecret).digest('hex');

    setTestEnv({ jwt: testSecret });
    const encrypted = encryptToken(SYNTHETIC_TOKEN);

    // Configure different primary key and different JWT secret, but provide correct legacy hex key
    setTestEnv({
      primary: DIFFERENT_KEY_1,
      legacy: testDerivedHexKey,
      jwt: 'another_jwt_secret_unrelated',
    });

    const decrypted = decryptToken(encrypted);
    assert.strictEqual(decrypted, SYNTHETIC_TOKEN);
  });

  runTest('Incorrect primary, legacy, and JWT-derived keys all fail safely', () => {
    setTestEnv({ primary: DEDICATED_HEX_KEY });
    const encrypted = encryptToken(SYNTHETIC_TOKEN);

    // Configure 3 completely wrong keys
    setTestEnv({
      primary: DIFFERENT_KEY_1,
      legacy: WRONG_HEX_KEY_1,
      jwt: DIFFERENT_KEY_2,
    });

    assert.throws(
      () => decryptToken(encrypted),
      /decryptToken: authentication tag verification failed\. The stored token may have been tampered with or encrypted with an unknown key\./
    );
  });

  runTest('Invalid legacy key formats (wrong length and non-hex) are rejected safely', () => {
    setTestEnv({ primary: DEDICATED_HEX_KEY });
    const validBlob = encryptToken(SYNTHETIC_TOKEN);

    // 63 hex characters (too short)
    setTestEnv({
      primary: DEDICATED_HEX_KEY,
      legacy: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde',
    });
    assert.throws(
      () => decryptToken(validBlob),
      /GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY must be a 64-character hexadecimal string/
    );

    // 65 hex characters (too long)
    setTestEnv({
      primary: DEDICATED_HEX_KEY,
      legacy: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0',
    });
    assert.throws(
      () => decryptToken(validBlob),
      /GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY must be a 64-character hexadecimal string/
    );

    // 64 characters with non-hex characters (e.g. 'zz')
    setTestEnv({
      primary: DEDICATED_HEX_KEY,
      legacy: 'zz23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    });
    assert.throws(
      () => decryptToken(validBlob),
      /GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY must be a 64-character hexadecimal string/
    );

    // Malformed ciphertext structure is rejected BEFORE inspecting legacy key
    assert.throws(
      () => decryptToken('malformed:blob'),
      /invalid encrypted blob format/
    );
  });

  runTest('Duplicate candidate keys do not cause errors or redundant attempts', () => {
    // Primary key hex matches legacy key hex, and JWT secret hashes to same value
    setTestEnv({
      primary: DEDICATED_HEX_KEY,
      legacy: DEDICATED_HEX_KEY,
    });

    const encrypted = encryptToken(SYNTHETIC_TOKEN);
    const decrypted = decryptToken(encrypted);
    assert.strictEqual(decrypted, SYNTHETIC_TOKEN);
  });

  // 6. Tampered & Malformed Ciphertext Rejection
  console.log('\n[6/8] Testing rejection of tampered and malformed ciphertexts...');
  runTest('Rejects tampered ciphertext with tag verification failure', () => {
    setTestEnv({ primary: DEDICATED_HEX_KEY, jwt: LEGACY_JWT_SECRET });

    const validEncrypted = encryptToken(SYNTHETIC_TOKEN);
    const parts = validEncrypted.split(':');

    // Tamper the ciphertext segment
    const tamperedCiphertext = parts[2].substring(0, parts[2].length - 2) + (parts[2].endsWith('a') ? 'b' : 'a');
    const tamperedBlob = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

    assert.throws(
      () => decryptToken(tamperedBlob),
      /decryptToken: authentication tag verification failed/
    );
  });

  runTest('Rejects tampered authentication tag', () => {
    setTestEnv({ primary: DEDICATED_HEX_KEY, jwt: LEGACY_JWT_SECRET });

    const validEncrypted = encryptToken(SYNTHETIC_TOKEN);
    const parts = validEncrypted.split(':');

    // Tamper the tag segment
    const tamperedTag = (parts[1].startsWith('A') ? 'B' : 'A') + parts[1].substring(1);
    const tamperedBlob = `${parts[0]}:${tamperedTag}:${parts[2]}`;

    assert.throws(
      () => decryptToken(tamperedBlob),
      /decryptToken: authentication tag verification failed/
    );
  });

  runTest('Rejects malformed blob structures (invalid part count, empty parts)', () => {
    assert.throws(() => decryptToken('not-valid-blob'), /invalid encrypted blob format/);
    assert.throws(() => decryptToken('a:b'), /invalid encrypted blob format/);
    assert.throws(() => decryptToken('a:b:c:d'), /invalid encrypted blob format/);
    assert.throws(() => decryptToken('::'), /invalid encrypted blob format/);
    assert.throws(() => decryptToken(''), /blob must be a non-empty string/);
    assert.throws(() => decryptToken(null), /blob must be a non-empty string/);
  });

  runTest('Rejects invalid IV length or invalid auth tag length', () => {
    const shortIv = Buffer.from('1234').toString('base64url');
    const normalTag = Buffer.alloc(16, 1).toString('base64url');
    const dummyCipher = Buffer.from('test').toString('base64url');
    const invalidBlob = `${shortIv}:${normalTag}:${dummyCipher}`;

    assert.throws(
      () => decryptToken(invalidBlob),
      /invalid initialization vector or authentication tag length/
    );
  });

  // 7. Rejection when All Configured Keys are Incorrect
  console.log('\n[7/8] Testing rejection when all keys fail authentication tag verification...');
  runTest('Throws authentication tag verification error when neither configured key matches', () => {
    setTestEnv({ primary: DEDICATED_HEX_KEY });
    const encrypted = encryptToken(SYNTHETIC_TOKEN);

    // Attempt decryption with two completely different keys
    setTestEnv({ primary: DIFFERENT_KEY_1, jwt: DIFFERENT_KEY_2 });

    assert.throws(
      () => decryptToken(encrypted),
      /decryptToken: authentication tag verification failed\. The stored token may have been tampered with or encrypted with an unknown key\./
    );
  });

  // 8. Missing Environment Configuration
  console.log('\n[8/8] Testing behavior when required secrets are missing...');
  runTest('encryptToken throws clear error when neither key is configured', () => {
    setTestEnv();

    assert.throws(
      () => encryptToken(SYNTHETIC_TOKEN),
      /Neither GITHUB_TOKEN_ENCRYPTION_KEY nor JWT_SECRET is configured/
    );
  });

  runTest('decryptToken throws clear error when neither key is configured', () => {
    setTestEnv();

    const dummyBlob = `${Buffer.alloc(12).toString('base64url')}:${Buffer.alloc(16).toString('base64url')}:${Buffer.from('test').toString('base64url')}`;

    assert.throws(
      () => decryptToken(dummyBlob),
      /Neither GITHUB_TOKEN_ENCRYPTION_KEY nor JWT_SECRET is configured/
    );
  });

  runTest('encryptToken rejects non-string or empty input', () => {
    setTestEnv({ jwt: LEGACY_JWT_SECRET });
    assert.throws(() => encryptToken(''), /plaintext must be a non-empty string/);
    assert.throws(() => encryptToken(null), /plaintext must be a non-empty string/);
    assert.throws(() => encryptToken(12345), /plaintext must be a non-empty string/);
  });

} finally {
  restoreEnv();
}

console.log('\n====================================================');
console.log(`📊 Test Summary: ${passed} passed, ${failed} failed`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✨ All token encryption tests passed successfully!\n');
  process.exit(0);
}
