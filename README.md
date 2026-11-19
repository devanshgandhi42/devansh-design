# devansh.design

Personal portfolio of Dev Gandhi. A single static page: no build step, no framework.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole site: markup, styles, scripts, and the tennis-ball hit sounds |
| `resume.pdf` | Linked from "Resume" in the sidebar |
| `images/` | Put your work here (images, GIFs, MP4s) |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | "DG" icons for the browser tab (adapts to dark tabs) and phone home screens |
| `og-image.png` | Preview card shown when the link is shared |

## Adding work

Each project in `index.html` is a `<figure class="shot">`. Replace its placeholder
`<div class="media placeholder" ...>` with one of these:

```html
<!-- Image or GIF -->
<img class="media" src="images/daily-refresh.png" alt="Daily Refresh on the Duolingo path" loading="lazy">

<!-- Video: much lighter than a GIF, and it only plays while on screen -->
<video class="media" src="images/daily-refresh.mp4" muted loop playsinline preload="metadata" aria-label="Daily Refresh on the Duolingo path"></video>
```

Then update the figure's `data-title`, `data-company` and `data-co`
(`toast`, `duolingo`, `doordash` or `meta`), plus the caption pill text.
Images are cropped to 16:10.

## For AI agents

- `llms.txt`: plain-Markdown summary of Dev and the work, including a "When to use this" section for agents. Update it when projects change.
- `middleware.ts`: when a request sends `Accept: text/markdown`, the homepage answers with `llms.txt` as Markdown (`Vary: Accept`), and unknown paths answer 404 with a short Markdown error. Browsers always get the normal HTML. If you add a file to the site, add its path to `KNOWN_PATHS` (the tests will remind you).
- `about.html`, `contact.html`, `privacy.html`: plain pages served at `/about`, `/contact`, `/privacy` (clean URLs via `vercel.json`).
- `sitemap.xml`, `robots.txt`, `404.html`.

Tests (no install needed): `node --experimental-strip-types --test tests/agent.test.ts`

## Deploying on Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project**, import the repo. Framework preset: **Other**. No build command, no output directory.
3. **Settings → Domains**: add `devansh.design` (and `www.devansh.design`), then set the DNS records Vercel shows wherever the domain is registered.

Every push to `main` redeploys automatically.

## Credits

Tennis hit sound: WolfOWI on Freesound (freesound.org/s/587395). Its license does not require attribution.
