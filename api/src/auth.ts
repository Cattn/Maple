import { betterAuth } from "better-auth";
import { createPool } from "mysql2/promise";
import { username } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";

export const auth = betterAuth({
    database: createPool({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "admin",
        database: process.env.DB_NAME || "maple_auth",
        connectionLimit: 10,
        waitForConnections: true,
        queueLimit: 0,
    }),
    emailAndPassword: { enabled: true },
    plugins: [
        username(),
        passkey({
            rpID: process.env.RP_ID || "localhost",
            rpName: process.env.RP_NAME || "Maple",
            origin: process.env.ORIGIN || "http://localhost:3000",
        }),
    ],
})