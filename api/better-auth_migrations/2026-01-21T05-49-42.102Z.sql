create table `passkey` (`id` varchar(36) not null primary key, `name` text, `publicKey` text not null, `userId` varchar(36) not null references `user` (`id`) on delete cascade, `credentialID` varchar(255) not null, `counter` integer not null, `deviceType` text not null, `backedUp` boolean not null, `transports` text, `createdAt` timestamp(3), `aaguid` text);

create index `passkey_userId_idx` on `passkey` (`userId`);

create index `passkey_credentialID_idx` on `passkey` (`credentialID`);