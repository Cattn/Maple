import { Elysia } from "elysia";

export const getRoute = new Elysia()
    .get("/get", () => {
        return { message: "TODO" };
    });
