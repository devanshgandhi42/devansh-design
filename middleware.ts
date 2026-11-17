// Password gate for devansh.design (Vercel Routing Middleware).
//
// The password lives in a Vercel environment variable, never in this repo:
//   Vercel → Project → Settings → Environment Variables → SITE_PASSWORD
// Change it there and redeploy to rotate it; everyone has to re-enter.
//
// Link-preview assets (og-image, favicons) stay public so iMessage/Slack
// previews still show the name card.

export const config = {
  matcher: ['/((?!og-image\\.png|favicon\\.svg|favicon-32\\.png|apple-touch-icon\\.png).*)'],
};

const COOKIE = 'dg_access';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function tokenFor(password: string) {
  const data = new TextEncoder().encode('devansh.design:' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

// Equivalent of next() from @vercel/functions, without adding a dependency
function next() {
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}

export default async function middleware(request: Request) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return next(); // not configured yet: site stays open

  const expected = await tokenFor(password);
  if (readCookie(request, COOKIE) === expected) return next();

  const url = new URL(request.url);

  if (request.method === 'POST') {
    let given = '';
    try { given = String((await request.formData()).get('password') || ''); } catch (e) {}
    if (given && (await tokenFor(given)) === expected) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: url.pathname + url.search,
          'Set-Cookie': `${COOKIE}=${expected}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
          'Cache-Control': 'no-store',
        },
      });
    }
    return page(true, 401);
  }

  return page(false, 401);
}

function page(wrong: boolean, status: number) {
  return new Response(gateHtml(wrong), {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

function gateHtml(wrong: boolean) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dev Gandhi — Product Designer</title>
<meta name="description" content="5+ years designing consumer and growth products. Currently at Toast, previously Duolingo, DoorDash, and Meta.">
<meta name="robots" content="noindex">
<meta property="og:title" content="Dev Gandhi — Product Designer">
<meta property="og:description" content="5+ years designing consumer and growth products. Currently at Toast, previously Duolingo, DoorDash, and Meta.">
<meta property="og:image" content="https://devansh.design/og-image.png">
<meta property="og:url" content="https://devansh.design">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { --bg:#FFFFFF; --ink:#121212; --muted:#5F6368; --surface:#F1F1EE; --rule:#ECECE8; --focus:#2F5BEA; --error:#C2362B; color-scheme: light; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#111111; --ink:#F2F2F0; --muted:#A1A1A6; --surface:#1E1E1E; --rule:#2A2A2A; --focus:#7C9BFF; --error:#FF7A6E; color-scheme: dark; }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    background: var(--bg); color: var(--ink);
    font-family: "Hanken Grotesk", Inter, system-ui, sans-serif; font-size: 15px; line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    display: grid; place-items: center; padding: 24px 16px;
  }
  main { width: 100%; max-width: 320px; }
  h1 { margin: 0; font-size: 15px; font-weight: 600; }
  .role { margin: 2px 0 28px; color: var(--muted); }
  label { display: block; margin-bottom: 8px; color: var(--muted); font-size: 13px; }
  .row { display: flex; gap: 8px; }
  input {
    flex: 1; min-width: 0; height: 44px; padding: 0 14px;
    border: 1px solid var(--rule); border-radius: 10px; background: var(--surface); color: var(--ink);
    font: inherit;
  }
  input:focus { outline: 2px solid var(--focus); outline-offset: 1px; }
  button {
    height: 44px; padding: 0 18px; border: 0; border-radius: 10px;
    background: var(--ink); color: var(--bg); font: inherit; font-weight: 500; cursor: pointer;
  }
  button:hover { opacity: .88; }
  .error { margin: 10px 0 0; color: var(--error); font-size: 13px; }
  .note { margin: 28px 0 0; color: var(--muted); font-size: 13px; }
  .note a { color: inherit; }
</style>
</head>
<body>
<main>
  <h1>Dev Gandhi</h1>
  <p class="role">Product designer</p>
  <form method="post">
    <label for="password">This portfolio is password protected</label>
    <div class="row">
      <input id="password" name="password" type="password" autocomplete="current-password" required autofocus${wrong ? ' aria-describedby="err" aria-invalid="true"' : ''}>
      <button type="submit">Enter</button>
    </div>
    ${wrong ? '<p class="error" id="err" role="alert">That password didn’t work. Try again.</p>' : ''}
  </form>
  <p class="note">Need access? <a href="mailto:devanshgandhi42@gmail.com">Email me</a> or find me on <a href="https://www.linkedin.com/in/devanshg42/">LinkedIn</a>.</p>
</main>
</body>
</html>`;
}
