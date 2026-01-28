import { Elysia } from "elysia";

export const publicGetRoute = new Elysia({ prefix: "/public" })
    .get("/get", () => {
        return { message: "TODO" };
    });
