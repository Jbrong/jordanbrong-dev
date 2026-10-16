// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://jordanbrong.dev',
	integrations: [mdx(), sitemap()],
	build: {
		// Emit all CSS as external files so the CSP can use style-src 'self' without 'unsafe-inline'.
		inlineStylesheets: 'never',
	},
	markdown: {
		// Prism highlights with CSS classes (themed in global.css). Shiki, the default, emits inline
		// style attributes on every token, which a strict CSP blocks.
		syntaxHighlight: 'prism',
	},
});
