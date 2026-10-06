-- Import into a NEW, dedicated database. Never select the exhibition site's DB.
CREATE TABLE circle_posts (
 id CHAR(32) PRIMARY KEY,
 request_key CHAR(32) NOT NULL UNIQUE,
 nickname VARCHAR(60) NOT NULL,
 caption VARCHAR(500) NOT NULL DEFAULT '',
 pattern_type VARCHAR(30) NOT NULL,
 location_label VARCHAR(150) NOT NULL,
 exact_lat DOUBLE NOT NULL,
 exact_lng DOUBLE NOT NULL,
 public_lat DOUBLE NOT NULL,
 public_lng DOUBLE NOT NULL,
 location_source VARCHAR(20) NOT NULL,
 image_name VARCHAR(80) NOT NULL,
 thumb_name VARCHAR(80) NOT NULL,
 status ENUM('pending','approved','rejected','hidden') NOT NULL DEFAULT 'pending',
 consent_version VARCHAR(20) NOT NULL DEFAULT '2026-10-v1',
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 approved_at DATETIME(6) NULL,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 INDEX circle_public (status, created_at),
 INDEX circle_geo (status, public_lat, public_lng)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE circle_limits (
 bucket CHAR(64) PRIMARY KEY,
 attempts INT NOT NULL DEFAULT 1,
 expires_at DATETIME NOT NULL,
 INDEX circle_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
