ALTER TABLE `user` MODIFY COLUMN `image` MEDIUMTEXT;

UPDATE `user` u
JOIN `users` old ON u.id = old.id
SET u.image = CONCAT('data:image/png;base64,', TO_BASE64(old.pfp))
WHERE old.pfp IS NOT NULL;
