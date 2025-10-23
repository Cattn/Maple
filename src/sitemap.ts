import type { RO_Sitemap } from 'sveltekit-sitemap';

export const sitemap = (<const>{
   "/": true,
   "/albums": true,
   "/albums/album/[slug]": false,
   "/albums/album": true,
   "/artists": true,
   "/artists/artist/[slug]": false,
   "/artists/artist": true,
   "/friends": false,
   "/login": false,
   "/playlists": true,
   "/playlists/playlist/[slug]": false,
   "/playlists/playlist": true,
   "/register": false,
   "/settings": false,
   "/tracks": false,
   "/upload": false
}) satisfies RO_Sitemap

export type Sitemap = typeof sitemap
