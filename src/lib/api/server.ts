import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';

export const SERVER =
	env.PUBLIC_API_URL || (dev ? 'http://localhost:3000' : 'https://api.maple.music');
