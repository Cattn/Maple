import bcrypt from 'bcrypt';
import { hashPassword, verifyPassword } from 'better-auth/crypto';

export const password = {
	hash: hashPassword,
	verify: ({ hash, password }: { hash: string; password: string }) =>
		/^\$2[aby]\$/.test(hash) ? bcrypt.compare(password, hash) : verifyPassword({ hash, password })
};
