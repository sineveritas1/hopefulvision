/**
 * GET /api/health
 *
 * The reference example for this project. It exists so that the API layer is
 * already wired and provable before there is anything real to serve.
 *
 * Two things worth copying from it:
 *
 *   1. File path == URL path. This file is functions/api/health.js, so it
 *      answers /api/health. A file at functions/api/scores.js would answer
 *      /api/scores. No router, no registration step.
 *
 *   2. `env` carries the bindings declared in wrangler.toml. Once a database
 *      or bucket is uncommented there, it shows up on `env` under the binding
 *      name — env.DB, env.MEDIA, env.CACHE — with no import and no
 *      connection string.
 *
 * Export onRequestGet / onRequestPost / onRequestDelete etc. to handle a
 * single method, or onRequest to handle all of them.
 */
export function onRequestGet({ env }) {
  // Explicit: _headers covers static assets, not Function responses, so the
  // no-store policy has to be repeated here or this endpoint would be cacheable.
  return Response.json({
    ok: true,
    time: new Date().toISOString(),
    // Flips to true as each binding is added in wrangler.toml. Handy for
    // confirming from the browser that a new resource actually attached.
    bindings: {
      db: Boolean(env.DB),
      media: Boolean(env.MEDIA),
      cache: Boolean(env.CACHE),
    },
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } });
}
