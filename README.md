# jordanbrong.dev

Source for [jordanbrong.dev](https://jordanbrong.dev): a static [Astro](https://astro.build) blog served by Cloudflare Workers static assets.

## Local development

Requires Node 24 (see `.nvmrc`).

```bash
npm ci
npm run dev       # dev server with hot reload at http://localhost:4321
npm run build     # static build into ./dist
npm run preview   # build, then serve ./dist with wrangler (applies _headers, 404 handling)
```

Use `npm run preview` when you want to check production behavior such as security headers:

```bash
curl -I http://localhost:8787/
```

## Writing a post

1. Create `src/content/blog/<slug>.md` (or `.mdx` to use components). The filename becomes the URL: `/blog/<slug>/`.
2. Add frontmatter:

   ```markdown
   ---
   title: 'Post title'
   description: 'One-sentence summary, used for the meta description and RSS.'
   pubDate: 2026-10-16
   # updatedDate: 2026-10-20          # optional
   # heroImage: ../../assets/foo.jpg  # optional, also used as the social preview image
   ---

   Post body in Markdown.
   ```

3. Put images in `src/assets/` and reference them with a relative path so Astro optimizes them.
4. Run `npm run dev` and check the post at `http://localhost:4321/blog/<slug>/`.

The schema is in `src/content.config.ts`. If the frontmatter is missing a field or has the wrong type, the build fails.

## Publishing

Open a PR. GitHub Actions runs `npm ci && npm run build`, and Cloudflare Workers Builds posts a preview URL for the branch. Merge to `master` to deploy to production.

Don't run `npm run deploy` by hand unless Workers Builds is unavailable.

## Security headers

`public/_headers` sets HSTS, CSP, and related headers on every response. The CSP is same-origin only, with no `'unsafe-inline'`, which depends on two settings in `astro.config.mjs`:

- `build.inlineStylesheets: 'never'`: all CSS is emitted as files.
- `markdown.syntaxHighlight: 'prism'`: code blocks are colored with CSS classes (theme in `src/styles/global.css`) instead of inline styles.

If you embed something external (a video, an image host, a script), the CSP will block it until you add that origin to the relevant directive in `public/_headers`. Leave a comment there explaining why.

After a deploy, check the headers with:

```bash
curl -sI https://jordanbrong.dev/ | grep -iE 'strict-transport|content-security|x-content-type|referrer|permissions'
```

## Layout

```
public/_headers          security headers (copied into dist/)
src/consts.ts            site title, description, author, social links
src/content/blog/        posts
src/pages/               routes (home, blog index, about, 404, rss.xml)
src/styles/global.css    typography, light/dark palette, code block theme
wrangler.jsonc           Workers static assets config
```
