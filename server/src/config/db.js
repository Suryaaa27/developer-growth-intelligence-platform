import fs from 'fs';
import mysql from 'mysql2/promise';

/**
 * Builds SSL/TLS configuration options for remote MySQL connections.
 *
 * Hardening & Security Rules:
 * - When DB_SSL is 'true', enables TLS encryption.
 * - When DB_SSL is 'false', empty, or unset, returns undefined (plain TCP for local development).
 * - Enforces strict certificate verification (rejectUnauthorized: true); cannot be disabled via environment variables.
 * - Supports custom CA certificates via DB_SSL_CA_PATH (file path) or DB_SSL_CA (inline PEM or file path).
 * - If a CA path is configured but cannot be read or found, fails fast with a descriptive error.
 */
export const getSslConfig = () => {
  if (process.env.DB_SSL !== 'true') {
    return undefined;
  }

  const ssl = {
    rejectUnauthorized: true,
  };

  // 1. Explicit CA certificate file path via DB_SSL_CA_PATH
  if (process.env.DB_SSL_CA_PATH) {
    const caPath = process.env.DB_SSL_CA_PATH.trim();
    if (!fs.existsSync(caPath)) {
      throw new Error(`[db.js] Configured DB_SSL_CA_PATH file does not exist: "${caPath}"`);
    }
    try {
      ssl.ca = fs.readFileSync(caPath, 'utf8');
    } catch (err) {
      throw new Error(`[db.js] Failed to read CA certificate from DB_SSL_CA_PATH "${caPath}": ${err.message}`);
    }
    return ssl;
  }

  // 2. Custom CA certificate via DB_SSL_CA (inline PEM string or file path)
  if (process.env.DB_SSL_CA) {
    const caVal = process.env.DB_SSL_CA.trim();

    // Check if provided as inline PEM content
    if (caVal.includes('-----BEGIN CERTIFICATE-----') || caVal.includes('-----BEGIN')) {
      ssl.ca = caVal;
      return ssl;
    }

    // Check if provided as an existing file path
    if (fs.existsSync(caVal)) {
      try {
        ssl.ca = fs.readFileSync(caVal, 'utf8');
        return ssl;
      } catch (err) {
        throw new Error(`[db.js] Failed to read CA certificate from DB_SSL_CA file "${caVal}": ${err.message}`);
      }
    }

    // If it neither contains PEM headers nor resolves to an existing file, fail fast
    throw new Error(
      `[db.js] Configured DB_SSL_CA is neither an existing file path nor a valid PEM certificate: "${caVal}"`
    );
  }

  return ssl;
};

/**
 * MySQL Connection Pool Configuration
 * Reads credentials securely from environment variables.
 * Provides a reusable promise-based pool for controllers and services.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'developer_growth_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ssl: getSslConfig(),
});

export default pool;
