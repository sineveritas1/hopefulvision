# Are You Tripping?

A quarter million motes drifting on a curl field. Touch anywhere and paint
spills where your finger is. Ten fingers, each its own colour.

Live at **[trippingtoy.com](https://trippingtoy.com)**.

One self-contained HTML file — WebGL2 particle simulation, generative ambient
audio, no dependencies, no build step. Works on desktop and mobile; add it to a
phone home screen and it runs fullscreen as a web app.

## Run it

Open `public/index.html` in any browser with WebGL2. That's it.

To also run the API layer locally:

```bash
npm install
npm run dev        # http://localhost:8788
```

## Deploying

Pushing to the default branch publishes the site. Cloudflare Pages watches this
repo and uploads `public/`; pull requests get their own preview URL.

## First-time setup

Everything in the repo is ready. These are the one-time account steps that have
to happen in a browser, in order.

**1. Create the Pages project** — Cloudflare dashboard → Workers & Pages →
Create → Pages → Connect to Git → pick `sineveritas1/tripping`.

Build settings:

| Field | Value |
| --- | --- |
| Framework preset | None |
| Build command | *(leave empty)* |
| Build output directory | `public` |

**2. Point the domain at it.** `trippingtoy.com` needs to be on Cloudflare —
either registered there, or registered elsewhere with its nameservers changed
to the pair Cloudflare gives you. Then, in the Pages project → Custom domains →
Set up a domain → add `trippingtoy.com` and `www.trippingtoy.com`. The DNS
records are created automatically and the certificate is issued within a few
minutes.

**3. Optional, for later** — a database, file storage, or a cache. Nothing
needs them yet and the site runs fine without. `wrangler.toml` has a commented
block for each, and `CLAUDE.md` has the commands.

## Layout

```
public/index.html    the entire site
public/_headers      response headers
public/_redirects    www -> apex canonical redirect
public/404.html      not-found page
functions/api/       serverless endpoints (one example: /api/health)
wrangler.toml        project config and resource bindings
CLAUDE.md            working notes and conventions
```

`public/index.html` is hand-tuned generative art. The compressed formatting and
the specific constants in the shaders are deliberate — see `CLAUDE.md` before
editing it.
