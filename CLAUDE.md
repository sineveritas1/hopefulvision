# hopeful.vision

A single-page WebGL2 toy: a quarter-million GPU particles advected through a
curl-noise field, painted with a spectral (wavelength → RGB) palette. Touch or
mouse input injects vortices — up to ten pointers, each its own hue. There is a
singing bowl struck on every touch, and aphorisms fade in and out over the
top.

The whole thing is one hand-written HTML file with no dependencies and no build
step. Open it in a browser and it runs.

## Layout

```
public/            <- the ONLY directory that gets served
  index.html         the entire site: markup, CSS, GLSL, JS, audio
  _headers           Cloudflare Pages response headers
  404.html           not-found page, same palette
functions/         <- serverless API and request middleware
  _middleware.js     sends every non-canonical host to hopeful.vision
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

**Resize must never touch the particles.** `seed()` runs once; `sizeTargets()`
runs on resize and reallocates only the accumulation buffers, which are the
only thing whose size depends on the canvas — the particle textures are
`SIDE x SIDE` and independent of the window. These were one routine called on
every resize, and the result was a visible glitch on phones: an iOS toolbar
sliding in and out changes `innerHeight` by a pixel, which was enough to
re-randomise all 262144 particles, re-upload 16MB of float textures, and clear
the accumulation buffer — wiping every trail on screen, repeatedly, mid-session.
`sizeTargets()` also returns immediately when the pixel dimensions are
unchanged, and copies the old accumulation into the new buffers so the trails
survive. Do not merge these two back together.

**A lost GPU context must be handled, and is.** `webglcontextlost` calls
`preventDefault()` — without it the browser never even attempts restoration and
the canvas stays blank forever — and `webglcontextrestored` reloads, because
every program, buffer and texture died with the context and reusing the old
handles would silently draw nothing. If the GPU *process* is what died, the
browser may then refuse a webgl2 context entirely on the next load; the failure
message says so and says to restart the browser, because reloading genuinely
cannot fix that state. The old message, "This needs WebGL2.", was a dead end
that misdescribed the usual cause.

`q` is a defensive guard on particle sprite size: sustained slow frames shrink
the sprite until they recover. On hardware that keeps up it stays at 1 and is a
no-op, so do not remove it to "restore quality". It reacts to two slow frames
running rather than one, because a lone slow frame is usually a GC pause or the
phone throttling, and none of those get better by shrinking sprites — an earlier
version cut on a single frame and pinned `q` at its floor for a whole session,
degrading the picture for a cause it could not fix.

**A caution about why this exists.** It was written to chase a freeze roughly
eleven seconds into a sustained press, reported on an Android device. The
reasoning at the time: `heat` decays as `exp(-uDt*0.20)`, a five second time
constant, so a held finger keeps raising heat across the field for ten to
fifteen seconds; `gl_PointSize` scales by `(1.0+1.5*heat)` and cost follows
sprite *area*, so that ramp grows fill load by up to 10.6x, and eleven seconds
is about 2.2 time constants. That story fits the timing, **but it was never
demonstrated** — the freeze was never reproduced here, since this container
renders in software. Two other hypotheses were tested and both failed.

The freeze was later reported resolved, without any throttle being applied. The
most likely actual cause is the one fixed in the meantime: **the gate's logo
loop never stopped**, so a full-screen 62-segment fragment shader ran every
frame alongside the main simulation for the entire session. That is a concrete,
verified bug; the heat ramp above is a hypothesis that happened to fit. Treat it
as such, and do not cite it as a measured finding.

The gate overlay (`#gate`) runs its own separate WebGL1 context drawing a
tesseract and a dodecahedron warped together into one body.

The figure is line segments handed to the fragment shader as a uniform array,
and **every pixel measures its distance to every segment** — so the segment
count is simultaneously the complexity budget and the per-pixel cost. 32
tesseract edges plus 30 dodecahedron edges is 62, in a 64 array. GLES2 only
guarantees 16 fragment uniform vectors, so `SEGN` is chosen at runtime from
`MAX_FRAGMENT_UNIFORM_VECTORS` and falls back to the tesseract alone on a device
that cannot take 64; the shader source is built around that number. The logo's
backing store is capped at 2x device pixels rather than 2.5x to pay for the
extra segments.

Dodecahedron vertices are the golden-ratio construction normalised onto the unit
sphere, and its **edges are found by distance, not a typed index table**: every
pair exactly one edge length apart. Verified — 20 vertices, 30 edges, every
vertex degree 3, and the next-nearest pair distance is 1.155 against an edge of
0.714, so the tolerance has a wide margin.

Both solids pass through the same `warp()`, which is what makes them read as one
body rather than two drawings stacked up: `br` breathes the whole figure
(Hoberman), `tw` rotates each point about the vertical in proportion to its
height (a half twist along the body, the Mobius part), and `kl` is a slow
lateral lobe that lets the form pass through itself instead of staying a
well-behaved solid (the Klein part). The dodecahedron counter-rotates and
breathes against the tesseract (`2-br`) so the two shear past each other. The
projection was replayed over 600s of animation: coordinates stay within
0.099-0.877 at rest, so it never clips the canvas unless pinched.

**The logo canvas is full bleed and out of flow.** It is `position:fixed` over
the whole gate at `z-index:3`, above the text, with `#logospace` holding the
resting footprint in `#gwrap` so the heading still sits where it did. That is
what lets the figure grow past its resting size and run off the screen edge
instead of being clipped into a box. Three things hold it together and are easy
to break:

- `pointer-events:none` on the canvas, and the gestures bound to `#gate`
  instead, or a full-screen canvas would swallow every tap meant for CLICK ME.
- **No `setPointerCapture`.** Capturing on the gate retargets the button's
  click and the gate stops opening.
- The shader maps canvas uv into the figure's own square via `uCen`/`uHalf`
  read off `#logospace`, and the vertex shader scales the quad to `uReach`
  rather than covering the screen. Without that scaling every pixel on the page
  would run the 62-segment loop.

**The logo loop stops when the gate is dismissed.** It used to keep shading a
hidden full-screen canvas underneath the main simulation for the entire session.

**Two fingers pinch it larger or smaller, and it springs back on release.**
Every live pointer is tracked in `lptr` so the gesture can be told apart from a
one-finger drag; zoom is measured against the finger spread at the moment the
second finger landed, so it tracks the hand instead of jumping. Dropping below
two fingers clears `pinchBase` and sets `zoomT` to 1 — the zoom is only held
while the gesture is actually being made. The easing rate differs by direction
on purpose: brisk (11) while following fingers, gentler (4.5) on the way home,
so the return reads as a spring settling rather than a snap. It is `dt` based,
so it takes about 0.7s at 60fps regardless of frame rate. Measured through a
probe build: 1 -> 2.07 pinched out -> back to 1.03, and 0.60 pinched in -> back
to 0.996.

**A finger down drags the figure around.** Pan is driven by the CENTROID of
whatever is currently down, which is what lets one finger carry the figure and
two fingers carry it *while also pinching*, with no separate code path for
either. `lastC` is re-seeded on every landing and lifting — without that, the
jump in the average as the finger count changes flings the figure across the
screen. Both re-seeds are covered by tests. Pan tracks near 1:1 while dragging
(rate 20) and springs home on the same gentle rate as the zoom once the last
finger lifts, so the gate always settles back to its composed layout. It is
bounded to about half the viewport so it can be carried well off centre but
never lost with no way to find it.

`at()` measures the warp point against where the figure *is* — `frame` plus
`pan` — not where it rests, or the deformation would detach from the finger
once the figure had been dragged.

**Beware `pr` in the logo IIFE: it is the shader program.** A local named `pr`
for the pan easing rate shadowed it, `lg.useProgram(pr)` was handed a number,
and the throw killed the render loop *and* the rest of the script — the gate
never opened. This file is deliberately terse, so check a short name is free
before reusing it.

While two fingers are down the warp point is left alone, or the figure would
also lurch toward whichever finger moved last. `touch-action:none` is what stops
the browser's own pinch competing. Zoomed past about 1.7 the figure runs off the
screen edge — intended, it reads as looking into the lattice.

Note when testing this: the rendered figure's width is **not** a proxy for zoom.
It changes constantly as the form rotates and breathes, so a width measurement
will report a return to rest as a failure. Probe the `zoom` variable instead.

**The halo is tuned against the segment count.** `m` is the MINIMUM distance to
any segment, so doubling the segments shrinks `m` across a much wider area and
the halo spreads with it — after adding the dodecahedron the old `exp(-m*26.0)`
at weight 0.62 washed the background back to grey. It is now `exp(-m*42.0)` at
0.46 with the discard threshold raised to 0.012, which cut washed pixels from
17.2% of the canvas to 9% and mean luminance from 21.5 to 16.3. **If the segment
count changes again, this needs retuning in the same direction.**

It is independent of the main sim; the `Click me` button creates the audio
context (browsers require a gesture) and starts the main loop.

Two things about the gate are easy to break:

- **No CSS `filter` on `#logo`, and the page is true `#000`.** A drop-shadow
  glows in one fixed colour whatever the lines are doing, and spreads it over
  ~130px of background, so the black stops being black — on an OLED phone those
  pixels are lit and the whole gate reads as a purple haze. The tesseract's glow
  belongs to the tesseract: the fragment shader's own halo, `exp(-m*26.0)`,
  already emits in each line's current colour and falls off tightly. The page,
  body, `#gate` and `theme-color` are `#000` rather than the old `#0b0a08` for
  the same reason. The icon data URIs still carry `#0b0a08` and should stay that
  way — that is the favicon's own background, not the page's.
- **The logo canvas must stay `position:static`.** The global `canvas` rule pins
  every canvas to `position:fixed;inset:0` for the fullscreen sim. Without the
  explicit override, `#logo` leaves the flex flow and floats at the top of the
  viewport, overlapping the title — and its margins silently stop doing
  anything.
- **The tesseract's rotation is an integrated phase, not a function of absolute
  time.** `phase += dt*(1.0+0.55*on)` is deliberate. The earlier form,
  `project(t*(1.0+0.55*on))`, scaled elapsed time by the interaction amount, so
  touching the logo moved an argument that grows all session: measured against
  the current build, a touch 20 seconds in produced a single-frame geometry jump
  48x the idle rate, and it got worse the longer the page stayed open. `dt` is
  clamped for the same reason — a backgrounded tab must not bank up seconds of
  rotation and spend them in one frame. Never reintroduce a term that multiplies
  absolute time by an interactive value.

## Sound

The page is silent until touched. Every touch on the field strikes one singing
bowl. There is no ambient bed, no mode selection, and no chords — earlier builds
had four selectable beds behind radio buttons, then four-note chords; both are
gone.

**Why any sequence is safe.** The notes come from C major pentatonic
(`SCALE`, C3-C6). A pentatonic set contains no semitone and no tritone, so *any
two of its notes sounded together are consonant*. That property is doing real
work here rather than being a nicety: a bowl rings for the better part of ten
seconds while the rate limit allows a new one every 240ms, so up to sixteen
notes overlap at once. Whatever anyone taps, however fast, what is still ringing
cannot clash with what was just struck. **Adding a note outside C D E G A breaks
this** — verified across 163 overlapping pairs in a real browser: zero
semitones, zero tritones, smallest interval 2 semitones.

**Motion.** `STEPS` is a weighted walk over scale degrees — mostly stepwise,
the odd small leap, and no zero, so a note never immediately repeats. Picking
uniformly from the scale is equally consonant but sounds aimless; stepwise
motion is what makes a line sound intended. The walk is unbiased (mean net
drift measured at -0.015 degrees per 20-note run) and settles in the middle of
the range about 73% of the time, so it neither wanders to an edge nor needs
recentring.

Touch height asks for a register and the walk supplies the motion; the two are
blended so the line follows the finger without becoming a keyboard. Touch side
sets the pan. Neither can create dissonance — every available pitch is already
in the safe set.

**Timbre** is the original struck singing bowl: inharmonic partials over a long
decay, each doubled and detuned. Ten oscillators per note.

**Two corner buttons, not one.** The bell mutes the tones; the one beside it
stops the aphorisms by adding `hushed` to `#glyph`, which hides the overlay
outright — the cycle keeps running and painting nothing, so switching the words
back on resumes at the next aphorism rather than mid-fade. Both are announced
twice: the gate says they exist (they are behind it at that point, so it has to
describe rather than point), and the opener aphorism names them once in-canvas.
The opener is the only message that ever explains anything; keep it that way.

**The rate limit is load-bearing.** Ten fingers land as ten `pointerdown` events
in one frame, and each note rings for seconds. `GAP` and `MAXACTIVE` are what
stop a drum-roll of taps from burying the audio thread. Muting returns before
scheduling anything, so a muted page schedules nothing at all — measured.

**iOS mutes Web Audio with the ring switch unless a media element is playing.**
Web Audio alone lands in the "ambient" audio session, which the hardware silent
switch silences — an iPhone with the ringer off hears nothing at all. A playing
`HTMLMediaElement` moves the session to "playback", which ignores that switch,
so `holdSession()` keeps a silent looping clip running. The clip is generated as
a WAV data URI rather than fetched, since the page has no dependencies and every
response is `no-store` anyway; it is checked to decode as 0.05s at peak
amplitude 0. Do not remove it because "nothing plays it" — that is the point.
`note()` also re-resumes the context on every strike, and a `visibilitychange`
handler resumes it on return, since iOS suspends it behind a lock screen.

Output is fixed at `LEVEL`; the device's volume is the volume and the corner
bell is only a mute. Mute must close **both** `master` and `wet` — the reverb
send bypasses master, so closing one leaves the tail ringing.

## Diagnosing a slow device

Three query flags exist so a device that stutters can be tested on the device
rather than guessed at from here. They are dormant otherwise and add nothing to
a normal visit.

- `?debug` — a live readout: GPU string, render scale, canvas size, particle
  count, fps, worst frame in the last second, the `q` guard, live pointers.
- `?dpr=1.2` — cap the render scale below the 1.75 default. This is the fill
  rate knob.
- `?n=256` — fewer particles; the simulation texture is n x n.

**The point of having both knobs is that they separate the two causes.** If
`?dpr=` low makes a stutter vanish, the device is fill-rate bound and the answer
is render scale. If only `?n=` helps, it is the particle count and vertex work.
Turning a knob at random and shipping the result teaches nothing; get the
distinction first, then set the default.

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
step), uploads `public/`, and serves it at hopeful.vision. Pull requests get
their own preview URL.

There is no deploy script to run and no secret to hold. If a deploy needs to be
inspected, it is in the Cloudflare dashboard under Workers & Pages, under the
Pages project → Deployments. That project's name in the dashboard is whatever
`name` says in wrangler.toml — it is not the domain, and the comment above that
line explains why it cannot be changed.

## Caching

Nothing this site serves is cacheable by a browser. `public/_headers` sets
`no-store` (plus the older no-cache/Pragma/Expires spellings) on `/*`, and
`functions/api/health.js` repeats it in code because `_headers` governs static
assets only — Function responses set their own headers and would otherwise be
cacheable.

This is deliberate and should not be "optimised" away. The site is one
unversioned file with no hashed asset names, so a cached copy pins a visitor to
an entire old build; a push must reach everyone on their next load, new visitor
or returning. The cost is one round trip per visit, served from Cloudflare's
edge (which is purged on every deploy), not from a cold origin.

If versioned assets are ever added — a hashed bundle, an image under a content
addressed name — those *should* get a long `max-age`, added as their own
`_headers` block. The blanket rule exists because today there is nothing whose
name changes when its content does.

One dashboard setting can silently override all of this: Cloudflare's Caching
-> Configuration -> Browser Cache TTL. It must stay on "Respect Existing
Headers". Anything else replaces the policy above with a fixed TTL.

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
npx wrangler d1 create hopeful-vision-db          # prints database_id
# uncomment the [[d1_databases]] block in wrangler.toml, paste the id

npx wrangler d1 migrations create hopeful-vision-db add_scores
# edit the generated file in migrations/
npx wrangler d1 migrations apply hopeful-vision-db --local    # test first
npx wrangler d1 migrations apply hopeful-vision-db --remote   # then production
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
npx wrangler r2 bucket create hopeful-vision-media
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
