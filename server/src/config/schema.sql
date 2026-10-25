-- ====================================================================
-- Developer Growth Intelligence Platform — Database Schema
-- Database: developer_growth_db
-- Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ====================================================================

USE developer_growth_db;

-- --------------------------------------------------------------------
-- A. Table: users
-- Core authentication and identity table with role-based access control
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  github_id BIGINT UNSIGNED NULL,
  github_username VARCHAR(100) NULL,
  github_access_token TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT uq_users_github_id UNIQUE (github_id),
  INDEX idx_users_github_username (github_username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- B. Table: repositories
-- Synchronized GitHub repositories associated with users
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS repositories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  github_repo_id BIGINT UNSIGNED NOT NULL,
  repo_name VARCHAR(191) NOT NULL,
  full_name VARCHAR(191) NOT NULL,
  description TEXT NULL,
  primary_language VARCHAR(60) NULL,
  html_url VARCHAR(255) NOT NULL,
  last_analyzed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_repositories_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT uq_repositories_user_github UNIQUE (user_id, github_repo_id),
  INDEX idx_repositories_user_id (user_id),
  INDEX idx_repositories_primary_language (primary_language)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- C. Table: role_requirements
-- Targeted engineering roles with benchmarks and required skills (JSON)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_requirements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  required_skills JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_role_requirements_name UNIQUE (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- D. Table: skill_evidence
-- Concrete evidence detected within user repositories
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_evidence (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repository_id INT UNSIGNED NOT NULL,
  skill_name VARCHAR(100) NOT NULL,
  evidence_type VARCHAR(60) NOT NULL,
  evidence_details TEXT NOT NULL,
  evidence_file_path VARCHAR(255) NULL,
  confidence_score DECIMAL(5,2) NULL,
  detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_skill_evidence_repository_id FOREIGN KEY (repository_id) REFERENCES repositories (id) ON DELETE CASCADE,
  INDEX idx_skill_evidence_repo_skill (repository_id, skill_name),
  INDEX idx_skill_evidence_skill_name (skill_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- E. Table: analysis_snapshots
-- Historical snapshots of role readiness assessments
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_snapshots (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  target_role_id INT UNSIGNED NOT NULL,
  readiness_score DECIMAL(5,2) NULL,
  analysis_summary JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_snapshots_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_snapshots_target_role_id FOREIGN KEY (target_role_id) REFERENCES role_requirements (id) ON DELETE RESTRICT,
  INDEX idx_snapshots_user_role (user_id, target_role_id),
  INDEX idx_snapshots_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- F. Table: recommendations
-- Actionable growth recommendations linked to analysis snapshots
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  analysis_id INT UNSIGNED NOT NULL,
  skill_name VARCHAR(100) NOT NULL,
  recommendation_title VARCHAR(255) NOT NULL,
  recommendation_description TEXT NOT NULL,
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  status ENUM('PENDING', 'ACCEPTED', 'DISMISSED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_recommendations_analysis_id FOREIGN KEY (analysis_id) REFERENCES analysis_snapshots (id) ON DELETE CASCADE,
  INDEX idx_recommendations_analysis_id (analysis_id),
  INDEX idx_recommendations_skill (skill_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- G. Table: user_progress
-- Learning task tracking and milestone completion records
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_progress (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  recommendation_id INT UNSIGNED NOT NULL,
  status ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED') NOT NULL DEFAULT 'NOT_STARTED',
  started_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_progress_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_progress_rec_id FOREIGN KEY (recommendation_id) REFERENCES recommendations (id) ON DELETE CASCADE,
  CONSTRAINT uq_user_progress_user_rec UNIQUE (user_id, recommendation_id),
  INDEX idx_user_progress_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- H. Table: recommendation_templates
-- Reusable learning and growth recommendation templates managed by admins
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendation_templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  skill_name VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  resource_url VARCHAR(255) NULL,
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rec_templates_skill (skill_name),
  INDEX idx_rec_templates_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
