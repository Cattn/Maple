import { Elysia } from "elysia";
import { cors } from '@elysiajs/cors'
import { auth } from "./auth";
import { getRoute, publicGetRoute, userFriendsRoute, peerjsRoute } from "./routes";

const app = new Elysia()
    .use(
        cors({
            origin: 'http://localhost:3001',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization']
        })
    )
    .all("/api/auth/*", (c) => auth.handler(c.request))
    .use(getRoute)
    .use(publicGetRoute)
    .use(userFriendsRoute)
    .use(peerjsRoute)
    .listen(3000)

console.log(
`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);