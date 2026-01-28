-- 1. Drop existing Better Auth tables (if any)
DROP TABLE IF EXISTS `account`;
DROP TABLE IF EXISTS `session`;
DROP TABLE IF EXISTS `verification`;
DROP TABLE IF EXISTS `user`;
DROP TABLE IF EXISTS `passkey`;
DROP TABLE IF EXISTS `session`;
DROP TABLE IF EXISTS `account`;
DROP TABLE IF EXISTS `verification`;

-- 2. Create Better Auth tables
CREATE TABLE `user` (
    `id` VARCHAR(36) NOT NULL PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `emailVerified` BOOLEAN NOT NULL,
    `image` TEXT,
    `createdAt` TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    `username` VARCHAR(255) UNIQUE,
    `displayUsername` TEXT
);

CREATE TABLE `session` (
    `id` VARCHAR(36) NOT NULL PRIMARY KEY,
    `expiresAt` TIMESTAMP(3) NOT NULL,
    `token` VARCHAR(255) NOT NULL UNIQUE,
    `createdAt` TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,
    `ipAddress` TEXT,
    `userAgent` TEXT,
    `userId` VARCHAR(36) NOT NULL,
    FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
);

CREATE TABLE `account` (
    `id` VARCHAR(36) NOT NULL PRIMARY KEY,
    `accountId` TEXT NOT NULL,
    `providerId` TEXT NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `accessToken` TEXT,
    `refreshToken` TEXT,
    `idToken` TEXT,
    `accessTokenExpiresAt` TIMESTAMP(3),
    `refreshTokenExpiresAt` TIMESTAMP(3),
    `scope` TEXT,
    `password` TEXT,
    `createdAt` TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,
    FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
);

CREATE TABLE `verification` (
    `id` VARCHAR(36) NOT NULL PRIMARY KEY,
    `identifier` VARCHAR(255) NOT NULL,
    `value` TEXT NOT NULL,
    `expiresAt` TIMESTAMP(3) NOT NULL,
    `createdAt` TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) NOT NULL
);

CREATE INDEX `session_userId_idx` ON `session` (`userId`);
CREATE INDEX `account_userId_idx` ON `account` (`userId`);
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);

ALTER TABLE `users` ADD COLUMN `last_login` DATETIME DEFAULT CURRENT_TIMESTAMP;

-- 3. Migrate existing users
INSERT INTO `user` (`id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt`, `username`, `displayUsername`)
SELECT 
    `id`,
    COALESCE(`name`, `username`),
    CONCAT(`username`, '@maple.local'),
    FALSE,
    NULL,
    COALESCE(`creation_date`, NOW()),
    COALESCE(`last_login`, NOW()),
    LOWER(`username`),
    `username`
FROM `users`;

-- 4. Migrate passwords to account table
INSERT INTO `account` (`id`, `accountId`, `providerId`, `userId`, `password`, `createdAt`, `updatedAt`)
SELECT 
    UUID(),
    `id`,
    'credential',
    `id`,
    `password`,
    COALESCE(`creation_date`, NOW()),
    COALESCE(`last_login`, NOW())
FROM `users`;

create table `passkey` (`id` varchar(36) not null primary key, `name` text, `publicKey` text not null, `userId` varchar(36) not null references `user` (`id`) on delete cascade, `credentialID` varchar(255) not null, `counter` integer not null, `deviceType` text not null, `backedUp` boolean not null, `transports` text, `createdAt` timestamp(3), `aaguid` text);

create index `passkey_userId_idx` on `passkey` (`userId`);

create index `passkey_credentialID_idx` on `passkey` (`credentialID`);