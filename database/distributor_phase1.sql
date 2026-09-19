CREATE TABLE IF NOT EXISTS distributors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    distributor_code VARCHAR(30) NOT NULL UNIQUE,
    status ENUM('pending','active','suspended','inactive') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_distributor_user (user_id),
    INDEX idx_distributor_status (status)
);
