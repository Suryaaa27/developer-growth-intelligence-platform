-- ====================================================================
-- Developer Growth Intelligence Platform — Database Initialization
-- ====================================================================

-- 1. Create database if it does not already exist
CREATE DATABASE IF NOT EXISTS developer_growth_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2. Switch to the newly created database
USE developer_growth_db;

-- Verification output
SELECT 'Database developer_growth_db is ready.' AS status;
