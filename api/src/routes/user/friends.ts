import { Elysia } from "elysia";

export const userFriendsRoute = new Elysia({ prefix: "/user" })
    .get("/friends", () => {
        return { message: "TODO" };
    });
