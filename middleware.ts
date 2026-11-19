// Markdown for AI agents (Vercel Routing Middleware).
//
// Browsers are untouched: anything that doesn't ask for Markdown goes straight
// to the static site. When a client sends `Accept: text/markdown`:
//   • the homepage answers with llms.txt as Markdown (one source of truth)
//   • a path that doesn't exist answers 404 with a short Markdown error
//   • every other real file (pages, images, resume) is served as usual
// Both Markdown responses carry `Vary: Accept` so caches keep the HTML and
// Markdown versions apart. See README → "For AI agents".

export const config = { matcher: '/:path*' };

// Every public URL on the site. tests/agent.test.ts fails if this drifts
// from the files in the repo, so add new files here too.
export const KNOWN_PATHS = new Set([
  '/', '/index.html',
  '/about', '/about.html',
  '/contact', '/contact.html',
  '/privacy', '/privacy.html',
  '/404.html',
  '/resume.pdf', '/llms.txt', '/robots.txt', '/sitemap.xml',
  '/og-image.png', '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png',
  '/images/account-switching.webp', '/images/daily-refresh.webp',
  '/images/delight-on-path.mp4', '/images/delight-on-path.webp',
  '/images/event-ticketing.webp', '/images/icebreakers.webp',
  '/images/surprise-bags.webp',
]);

const HOME_PATHS = new Set(['/', '/index.html']);

// q-value for a media type in an Accept header (0 when it isn't listed)
function qFor(accept: string, type: string) {
  let best = 0;
  for (const part of accept.toLowerCase().split(',')) {
    const [media, ...params] = part.trim().split(';').map((s) => s.trim());
    if (media !== type) continue;
    let q = 1;
    for (const p of params) if (p.startsWith('q=')) q = parseFloat(p.slice(2)) || 0;
    best = Math.max(best, q);
  }
  return best;
}

// Markdown wins only when it's asked for explicitly and ranked at least as
// high as HTML, so browsers (which never list text/markdown) always get HTML.
export function wantsMarkdown(accept: string | null) {
  if (!accept) return false;
  const md = qFor(accept, 'text/markdown');
  return md > 0 && md >= qFor(accept, 'text/html');
}

// Equivalent of next() from @vercel/functions, without adding a dependency
function next() {
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}

function markdown(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
      'Cache-Control': status === 200 ? 'public, max-age=0, must-revalidate' : 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

export const NOT_FOUND_MD = `# Page not found (404)

There's no page at this address. devansh.design is a one-page portfolio for Dev Gandhi, product designer.

- [Portfolio summary for agents (llms.txt)](https://www.devansh.design/llms.txt)
- [Sitemap](https://www.devansh.design/sitemap.xml)
- [Homepage](https://www.devansh.design/)
`;

export default async function middleware(request: Request) {
  if (!wantsMarkdown(request.headers.get('accept'))) return next();

  const path = new URL(request.url).pathname;

  if (HOME_PATHS.has(path)) {
    try {
      const res = await fetch(new URL('/llms.txt', request.url), { headers: { Accept: 'text/plain' } });
      if (res.ok) {
        const body = await res.text();
        if (body.trim()) return markdown(body, 200);
      }
    } catch (e) {}
    return next(); // llms.txt unavailable: fall back to the normal HTML page
  }

  if (KNOWN_PATHS.has(path)) return next();
  return markdown(NOT_FOUND_MD, 404);
}
