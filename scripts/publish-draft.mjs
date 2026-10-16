#!/usr/bin/env node
// Publish a draft post from the Obsidian drafts vault into this repo, then build, commit, and push.
//
// Usage:
//   npm run publish-draft -- <draft>            # file name ("my-post") or path to the .md/.mdx file
//   npm run publish-draft -- <draft> --dry-run  # show what would happen, change nothing
//   npm run publish-draft -- <draft> --no-push  # copy, build, and commit, but don't push or archive
//
// The drafts folder mirrors src/: posts in content/blog/, images in assets/, so relative image
// links like ../../assets/foo.png work in both places. Set BLOG_DRAFTS_DIR to override the default.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DRAFTS_DIR = path.join(
	os.homedir(),
	'Library/Mobile Documents/iCloud~md~obsidian/Documents/Blog Drafts/jordanbrong-dev',
);
const PUBLISH_BRANCH = 'master';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(repoRoot, 'src');
const draftsRoot = process.env.BLOG_DRAFTS_DIR || DEFAULT_DRAFTS_DIR;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const noPush = args.includes('--no-push');
const draftArg = args.find((a) => !a.startsWith('--'));

function fail(message) {
	console.error(`✗ ${message}`);
	process.exit(1);
}

function run(cmd, cmdArgs, opts = {}) {
	return execFileSync(cmd, cmdArgs, { cwd: repoRoot, encoding: 'utf8', ...opts });
}

function git(...gitArgs) {
	return run('git', gitArgs, { stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Lowercase, no spaces or odd characters: "Pasted image 2026.PNG" -> "pasted-image-2026.png"
function safeFileName(name) {
	const ext = path.extname(name).toLowerCase();
	const base = path
		.basename(name, path.extname(name))
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return (base || 'image') + ext;
}

// --- Locate the draft ---------------------------------------------------------------------------

if (!draftArg) fail('Usage: npm run publish-draft -- <draft name or path> [--dry-run] [--no-push]');

let draftPath = path.resolve(draftArg);
if (!fs.existsSync(draftPath)) {
	const base = path.join(draftsRoot, 'content/blog', draftArg);
	draftPath = [base, `${base}.md`, `${base}.mdx`].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
	if (!draftPath) fail(`Draft not found: ${draftArg}\n  Looked in ${path.join(draftsRoot, 'content/blog')}`);
}
if (!/\.mdx?$/.test(draftPath)) fail(`Not a Markdown file: ${draftPath}`);

const draftDir = path.dirname(draftPath);
const postFileName = safeFileName(path.basename(draftPath));
const slug = postFileName.replace(/\.mdx?$/, '');
const targetPost = path.join(srcDir, 'content/blog', postFileName);
let content = fs.readFileSync(draftPath, 'utf8');

// --- Validate frontmatter -----------------------------------------------------------------------

const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
if (!fm) fail('Missing frontmatter (the --- block at the top of the file).');
for (const field of ['title', 'description', 'pubDate']) {
	const m = fm[1].match(new RegExp(`^${field}:\\s*(.*)$`, 'm'));
	const value = m?.[1].trim().replace(/^['"]|['"]$/g, '');
	if (!value) fail(`Frontmatter field "${field}" is missing or empty.`);
}

// --- Find images and plan copies ----------------------------------------------------------------

if (/!\[\[[^\]]+\]\]/.test(content)) {
	fail('Found an Obsidian ![[wikilink]] embed. Turn off "Use [[Wikilinks]]" and re-insert the image.');
}

const copies = []; // { from, to }
const rewrites = []; // [oldRef, newRef]

function planImage(ref) {
	const clean = decodeURI(ref.replace(/^<|>$/g, ''));
	if (/^[a-z]+:\/\//i.test(clean) || clean.startsWith('//')) {
		fail(`External image ${clean}\n  The CSP only allows same-origin images. Save it into assets/ instead.`);
	}
	if (clean.startsWith('/')) return; // site-absolute path (public/), nothing to copy
	const from = path.resolve(draftDir, clean);
	if (!fs.existsSync(from)) fail(`Image not found: ${clean}\n  (resolved to ${from})`);
	const rel = path.relative(draftsRoot, from);
	if (rel.startsWith('..') || !rel.startsWith(`assets${path.sep}`)) {
		fail(`Image must be inside the drafts assets/ folder: ${clean}`);
	}
	const to = path.join(srcDir, path.dirname(rel), safeFileName(path.basename(rel)));
	if (!copies.some((c) => c.to === to)) copies.push({ from, to });
	const newRef = path.relative(path.dirname(targetPost), to).split(path.sep).join('/');
	if (newRef !== ref) rewrites.push([ref, newRef]);
}

for (const m of content.matchAll(/!\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/g)) planImage(m[1]);
const hero = fm[1].match(/^heroImage:\s*['"]?([^'"\n]+?)['"]?\s*$/m);
if (hero) planImage(hero[1]);

for (const [oldRef, newRef] of rewrites) content = content.split(oldRef).join(newRef);
// Publishing = dropping the draft flag.
content = content.replace(/^draft:\s*true\s*\r?\n/m, '');

// --- Check the repo state -----------------------------------------------------------------------

const branch = git('branch', '--show-current');
if (branch !== PUBLISH_BRANCH) fail(`On branch "${branch}"; switch to ${PUBLISH_BRANCH} first.`);

const repoRel = (p) => path.relative(repoRoot, p);
const tracked = (p) => {
	try {
		git('ls-files', '--error-unmatch', repoRel(p));
		return true;
	} catch {
		return false;
	}
};
if (tracked(targetPost)) {
	fail(`${repoRel(targetPost)} is already published. Edit it in the repo instead.`);
}
for (const { from, to } of copies) {
	if (fs.existsSync(to) && !fs.readFileSync(to).equals(fs.readFileSync(from))) {
		fail(`${repoRel(to)} already exists with different content. Rename the image in the draft.`);
	}
}

console.log(`Publishing "${slug}"`);
console.log(`  post   ${repoRel(targetPost)}`);
for (const { to } of copies) console.log(`  image  ${repoRel(to)}`);
for (const [a, b] of rewrites) console.log(`  link   ${a} -> ${b}`);
if (dryRun) {
	console.log('Dry run: nothing changed.');
	process.exit(0);
}

if (!noPush) {
	console.log(`\n→ git pull --ff-only`);
	run('git', ['pull', '--ff-only', '--quiet'], { stdio: 'inherit' });
}

// --- Copy, build, commit, push ------------------------------------------------------------------

const created = [];
fs.writeFileSync(targetPost, content);
created.push(targetPost);
for (const { from, to } of copies) {
	if (fs.existsSync(to)) continue;
	fs.mkdirSync(path.dirname(to), { recursive: true });
	fs.copyFileSync(from, to);
	created.push(to);
}

console.log('\n→ npm run build');
try {
	// Captured, and only shown if the build fails.
	run('npm', ['run', 'build', '--silent'], { stdio: 'pipe' });
} catch (err) {
	process.stderr.write(`${err.stdout ?? ''}${err.stderr ?? ''}`);
	for (const p of created) fs.rmSync(p, { force: true });
	fail('Build failed; removed the copied files. Fix the draft and try again.');
}

const paths = [targetPost, ...copies.map((c) => c.to)].map(repoRel);
const title = fm[1].match(/^title:\s*['"]?(.*?)['"]?\s*$/m)[1];
git('add', '--', ...paths);
// Commit only these paths, so anything else staged in the repo is left alone.
git('commit', '--quiet', '-m', `Publish: ${title}`, '--', ...paths);
console.log(`\n✓ Committed ${git('log', '--oneline', '-1')}`);

if (noPush) {
	console.log('--no-push: not pushed, draft not archived. Run `git push` when ready.');
	process.exit(0);
}

console.log('\n→ git push');
run('git', ['push', '--quiet'], { stdio: 'inherit' });

const archiveDir = path.join(draftsRoot, '_published');
fs.mkdirSync(archiveDir, { recursive: true });
fs.renameSync(draftPath, path.join(archiveDir, path.basename(draftPath)));

console.log(`\n✓ Pushed. Cloudflare will deploy https://jordanbrong.dev/blog/${slug}/ in a minute or two.`);
console.log(`✓ Moved the draft to ${path.relative(draftsRoot, archiveDir)}/`);
