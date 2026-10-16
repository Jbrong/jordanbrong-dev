import { getCollection } from 'astro:content';

// Posts with `draft: true` show up in `npm run dev` but are excluded from production builds,
// so they get no page, and don't appear in listings, RSS, or the sitemap.
export function getPosts() {
	return getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
}
