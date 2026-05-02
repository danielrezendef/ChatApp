SET @add_last_seen_at = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `User` ADD COLUMN `lastSeenAt` DATETIME(3) NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'User'
    AND COLUMN_NAME = 'lastSeenAt'
);

PREPARE stmt FROM @add_last_seen_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_read_at = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `Message` ADD COLUMN `readAt` DATETIME(3) NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Message'
    AND COLUMN_NAME = 'readAt'
);

PREPARE stmt FROM @add_read_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_read_at_index = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX `Message_readAt_idx` ON `Message`(`readAt`)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Message'
    AND INDEX_NAME = 'Message_readAt_idx'
);

PREPARE stmt FROM @add_read_at_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
