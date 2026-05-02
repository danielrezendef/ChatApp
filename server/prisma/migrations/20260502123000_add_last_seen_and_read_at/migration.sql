ALTER TABLE `User`
  ADD COLUMN `lastSeenAt` DATETIME(3) NULL;

ALTER TABLE `Message`
  ADD COLUMN `readAt` DATETIME(3) NULL;

CREATE INDEX `Message_readAt_idx` ON `Message`(`readAt`);
