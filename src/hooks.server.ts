// src/hooks.server.ts
import type { Handle } from "@sveltejs/kit";
import { sitemapHook } from "sveltekit-sitemap";
import { sitemap } from "./sitemap";
import { SERVER } from "$lib/api/server";

export const handle: Handle = async ({ event, resolve }) => {
    const token = event.cookies.get('token');
    event.locals.user = null;
    if (token) {
        try {
            const res = await fetch(`${SERVER}/get/user/0`, {
                headers: {
                    cookie: `token=${token}`
                },
                credentials: 'include',
                method: 'GET'
            });
            if (res.ok) {
                const user = await res.json();
                event.locals.user = user;
            }
        } catch (_error) {
            event.locals.user = null;
        }
    }

    return sitemapHook(sitemap)({ event, resolve });
};