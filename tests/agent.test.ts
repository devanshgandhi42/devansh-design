// Run: node --experimental-strip-types --test tests/agent.test.ts
// Covers the agent-facing behavior: Markdown negotiation, Markdown 404s,
// llms.txt, sitemap, robots, trust pages and Vercel config.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import middleware, { KNOWN_PATHS, wantsMarkdown, NOT_FOUND_MD } from '../middleware.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');
const SITE = 'https://www.devansh.design';

// Serve local files for the middleware's fetch of /llms.txt
function stubFetch(ok = true) {
  globalThis.fetch = (async (input: any) => {
    const path = new URL(String(input)).pathname;
    if (!ok) return new Response('nope', { status: 500 });
    return new Response(read(path.slice(1)), { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }) as typeof fetch;
}
const req = (path: string, accept?: string) =>
  new Request(SITE + path, { headers: accept ? { Accept: accept } : {} });
const passesThrough = (r: Response) => r.headers.get('x-middleware-next') === '1';

// ---------- Markdown content negotiation ----------

test('homepage serves llms.txt as Markdown for Accept: text/markdown', async () => {
  stubFetch();
  const r = await middleware(req('/', 'text/markdown'));
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /^text\/markdown/);
  assert.match(r.headers.get('vary') || '', /\bAccept\b/);
  const body = await r.text();
  assert.ok(body.trim().length > 0);
  assert.equal(body, read('llms.txt'));
});

test('homepage stays HTML for browsers and plain requests', async () => {
  stubFetch();
  for (const accept of [
    undefined,
    'text/html',
    '*/*',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  ]) {
    assert.ok(passesThrough(await middleware(req('/', accept))), `accept=${accept}`);
  }
});

test('q-values decide between Markdown and HTML', () => {
  assert.equal(wantsMarkdown('text/markdown'), true);
  assert.equal(wantsMarkdown('text/markdown, text/html;q=0.5'), true);
  assert.equal(wantsMarkdown('text/html, text/markdown;q=0.5'), false);
  assert.equal(wantsMarkdown('text/markdown;q=0'), false);
  assert.equal(wantsMarkdown(null), false);
});

test('/index.html also negotiates Markdown', async () => {
  stubFetch();
  const r = await middleware(req('/index.html', 'text/markdown'));
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /^text\/markdown/);
});

test('falls back to HTML if llms.txt cannot be fetched', async () => {
  stubFetch(false);
  assert.ok(passesThrough(await middleware(req('/', 'text/markdown'))));
});

// ---------- Agent-friendly 404s ----------

test('unknown path returns a Markdown 404 for Accept: text/markdown', async () => {
  const r = await middleware(req('/__probe-does-not-exist', 'text/markdown'));
  assert.equal(r.status, 404);
  assert.match(r.headers.get('content-type') || '', /^text\/markdown/);
  assert.match(r.headers.get('vary') || '', /\bAccept\b/);
  const body = await r.text();
  assert.ok(body.length >= 20);
  assert.match(body, /llms\.txt/);
  assert.match(body, /sitemap\.xml/);
  assert.equal(body, NOT_FOUND_MD);
});

test('unknown path for browsers is left to the static 404 page', async () => {
  assert.ok(passesThrough(await middleware(req('/nope', 'text/html'))));
  assert.match(read('404.html'), /href="\/llms\.txt"/);
});

test('real files are never turned into 404s', async () => {
  for (const p of KNOWN_PATHS) {
    if (p === '/' || p === '/index.html') continue;
    assert.ok(passesThrough(await middleware(req(p, 'text/markdown'))), p);
  }
});

test('KNOWN_PATHS matches every deployed file', () => {
  const ignored = read('.vercelignore').split('\n').map((s) => s.trim()).filter(Boolean);
  const skip = (rel: string) =>
    rel.startsWith('.') || rel === 'middleware.ts' || rel === 'vercel.json' ||
    ignored.some((i) => (i.endsWith('/') ? rel.startsWith(i) : rel === i));
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = relative(ROOT, full);
      if (skip(rel)) continue;
      statSync(full).isDirectory() ? walk(full) : files.push('/' + rel);
    }
  };
  walk(ROOT);
  for (const f of files) assert.ok(KNOWN_PATHS.has(f), `missing from KNOWN_PATHS: ${f}`);
  for (const p of KNOWN_PATHS) {
    if (p === '/') continue;
    const file = /\.[a-z0-9]+$/.test(p) ? p : p + '.html';
    assert.ok(files.includes(file), `KNOWN_PATHS lists a file that doesn't exist: ${p}`);
  }
});

// ---------- llms.txt ----------

test('llms.txt follows the llms.txt layout and says when to use the site', () => {
  const t = read('llms.txt');
  assert.match(t, /^# .+\n\n> .+/);
  assert.match(t, /^## When to use this$/m);
  const when = t.split(/^## When to use this$/m)[1].split(/^## /m)[0];
  assert.ok(when.length > 400, 'when-to-use section should be specific');
  for (const p of ['/about', '/contact', '/privacy', '/sitemap.xml', '/resume.pdf']) {
    assert.ok(t.includes(SITE + p), `llms.txt links ${p}`);
  }
});

// ---------- Sitemap and robots ----------

test('sitemap lists every page with lastmod dates', () => {
  const xml = read('sitemap.xml');
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const urls = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>\s*<\/url>/g)].map((m) => m[1]);
  for (const p of ['/', '/about', '/contact', '/privacy', '/resume.pdf']) assert.ok(urls.includes(SITE + p), p);
  assert.equal(urls.length, (xml.match(/<url>/g) || []).length, 'every <url> has loc + lastmod');
});

test('robots.txt allows crawling and points to the sitemap', () => {
  const r = read('robots.txt');
  assert.match(r, /^User-agent: \*$/m);
  assert.match(r, /^Allow: \/$/m);
  assert.match(r, new RegExp(`^Sitemap: ${SITE}/sitemap\\.xml$`, 'm'));
});

// ---------- Trust anchor pages ----------

const visibleText = (htmlSrc: string) =>
  htmlSrc.replace(/<head>[\s\S]*?<\/head>/, '').replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();

for (const page of ['about', 'contact', 'privacy']) {
  test(`/${page} is a real page with 500+ characters`, () => {
    const h = read(`${page}.html`);
    assert.match(h, /^<!doctype html>/i);
    assert.match(h, /<html lang="en">/);
    assert.match(h, new RegExp(`<link rel="canonical" href="${SITE}/${page}">`));
    assert.match(h, /<h1>[^<]+<\/h1>/);
    assert.ok(visibleText(h).length >= 500, `${page}: ${visibleText(h).length} chars`);
    assert.match(h, /href="\/"/, 'links back home');
  });
}

test('contact and privacy pages give a way to reach Dev', () => {
  for (const p of ['contact', 'privacy']) assert.match(read(`${p}.html`), /href="mailto:[^"@]+@[^"]+"/);
});

// ---------- Vercel config ----------

test('vercel.json enables clean URLs and Vary: Accept on the homepage', () => {
  const cfg = JSON.parse(read('vercel.json'));
  assert.equal(cfg.cleanUrls, true);
  const home = cfg.headers.find((h: any) => h.source === '/');
  assert.ok(home.headers.some((h: any) => h.key === 'Vary' && /Accept/.test(h.value)));
});
