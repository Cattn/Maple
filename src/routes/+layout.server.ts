import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    const loggedIn = Boolean(locals.user);
    return {
        loggedIn,
        user: locals.user
    };
};