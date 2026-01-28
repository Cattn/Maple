import { Elysia } from "elysia";

export const peerjsRoute = new Elysia()
    .get("/peerjs", () => {
        return { message: "TODO" };
    });
