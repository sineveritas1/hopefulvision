# trippingtoy.com

A single-page WebGL2 toy: a quarter-million GPU particles advected through a
curl-noise field, painted with a spectral (wavelength → RGB) palette. Touch or
mouse input injects vortices — up to ten pointers, each its own hue. There is a
generative ambient audio bed, and aphorisms fade in and out over the top.

The whole thing is one hand-written HTML file with no dependencies and no build
step. Open it in a browser and it runs.

## Layout

```
public/            <- the ONLY directory that gets served
  index.html         the entire site: markup, CSS, GLSL, JS, audio
  _headers           Cloudflare Pages response headers
  404.html           not-found page, same palette
functions/         <- serverless API and request middleware
  _middleware.js     redirects www -> apex on every request
  api/health.js      answers GET /api/health
wrangler.toml      <- project name, output dir, resource bindings
package.json       <- wrangler only; the site itself has no dependencies
```

Nothing outside `public/` is uploaded to the CDN. That separation is the reason
the page lives in `public/` rather than at the repo root.

## Working on the page

`public/index.html` is hand-tuned generative art, not ordinary application
code. **Do not reformat, modularise, split into files, or "clean up" this file.**
The dense one-line GLSL, the terse variable names (`pSim`, `accF`, `uPtr`), and
the specific magic numbers are all deliberate and load-bearing. Someone tuned
those constants by eye against a running canvas.

When changing it:

- Change the smallest number of characters that achieves the goal.
- Treat every numeric literal in a shader as calibrated. Adjusting `0.0135` in
  the curl-field lookup or `0.9938` in the trail-fade pass visibly changes the
  whole piece. Say what a constant does before touching it, and never tune one
  as a side effect of another change.
- Keep it a single self-contained file. No bundler, no npm packages, no
  extracted `.js` or `.css`. The only external requests are the two Google
  Fonts (Courier Prime, Saira Condensed).
- After any visual change, actually look at it. `npm run dev` and open the page;
  a shader that fails to compile logs to the console and renders black rather
  than throwing, so a silent regression is entirely possible.

Architecture of the render loop, for orientation:

1. **Sim pass** — a fragment shader over a 512×512 (384² on small screens)
   float texture pair, ping-ponged. Each texel is one particle: `uPos` holds
   xy/age/seed, `uVel` holds velocity + "heat". Pointers add tangential force.
2. **Fade pass** — the accumulation buffer is blurred slightly and multiplied
   by `uK` (0.9938), which is what produces the long light trails.
3. **Draw pass** — particles and pointer rings are drawn additively into that
   buffer as GL points.
4. **Post pass** — desaturation, tone mapping, vignette, film grain, gamma.

The gate overlay (`#gate`) runs its own separate WebGL1 context drawing a
rotating 4-D tesseract projected to 2-D. It is independent of the main sim; the
`Click me` button starts audio (browsers require a gesture) and the main loop.

## Local development

```bash
npm install          # only needed for wrangler / the API; the page runs without it
npm run dev          # serves public/ + functions/ at http://localhost:8788
```

For a pure HTML tweak you do not need any of that — open `public/index.html`
directly in a browser. You do need `npm run dev` to exercise anything under
`functions/`, because that is where the bindings get simulated.

Note that WebGL2 is required. If the canvas is black, check the console for
shader compile errors before assuming the logic is wrong.

## Deploying

Deployment is automatic: **pushing to the default branch publishes the site.**
Cloudflare Pages watches this repository, builds nothing (there is no build
step), uploads `public/`, and serves it at trippingtoy.com. Pull requests get
their own preview URL.

There is no deploy script to run and no secret to hold. If a deploy needs to be
inspected, it is in the Cloudflare dashboard under Workers & Pages →
trippingtoy → Deployments.

## Growing the backend

The API layer is already wired — `functions/api/health.js` is a working
endpoint and the pattern to copy. A file's path is its URL: `functions/api/
scores.js` serves `/api/scores`. Export `onRequestGet`, `onRequestPost`, and so
on per method.

Resources are attached the same way every time: create it once on the account,
then record the binding in `wrangler.toml`. Each block is already stubbed out
there, commented, waiting for its id.

**Database (D1, SQLite):**

```bash
npx wrangler d1 create trippingtoy-db          # prints database_id
# uncomment the [[d1_databases]] block in wrangler.toml, paste the id

npx wrangler d1 migrations create trippingtoy-db add_scores
# edit the generated file in migrations/
npx wrangler d1 migrations apply trippingtoy-db --local    # test first
npx wrangler d1 migrations apply trippingtoy-db --remote   # then production
```

```js
const { results } = await env.DB.prepare(
  "SELECT name, score FROM scores ORDER BY score DESC LIMIT ?"
).bind(10).all();
```

Always parameterise with `.bind()`; never build SQL by string concatenation.
Schema changes go through migration files so that local and production stay in
step — do not hand-edit the remote database.

**File storage (R2):**

```bash
npx wrangler r2 bucket create trippingtoy-media
# uncomment the [[r2_buckets]] block in wrangler.toml
```

```js
await env.MEDIA.put(key, request.body);
const object = await env.MEDIA.get(key);
```

**Key/value (KV)** — counters, feature flags, cached fragments:

```bash
npx wrangler kv namespace create CACHE          # prints id
# uncomment the [[kv_namespaces]] block in wrangler.toml
```

Secrets (API keys and the like) never go in `wrangler.toml`. Locally they live
in `.dev.vars`, which is gitignored; in production they are set in the
Cloudflare dashboard under the Pages project's environment variables, encrypted.

After adding any binding, `GET /api/health` reports which ones actually
attached — the fastest way to confirm a resource is really wired up.

## Conventions

- Two-space indent, semicolons, single quotes in Functions code.
- Functions are plain ES modules on the Workers runtime, not Node. There is no
  `fs`, no `process`, no `Buffer` unless explicitly polyfilled. Use the Web
  APIs: `fetch`, `Request`, `Response`, `crypto.subtle`, `URL`.
- Return JSON with `Response.json(...)`.
- Keep dependencies at zero. This project earns a lot of its reliability from
  having nothing to update; adding a package should be a deliberate decision,
  not a convenience.
