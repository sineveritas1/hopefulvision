/**
 * Canonical-host redirect.
 *
 * Several hostnames are attached to this Pages project, including retired ones
 * kept alive so old links still work, and they all serve identical content. Left alone that splits search ranking signals across addresses and
 * gives the site no single canonical home.
 *
 * Rather than one rule per domain, anything that is not the canonical host is
 * sent there. Adding another domain later needs no change here.
 *
 * This lives in a Function rather than public/_redirects because Pages matches
 * _redirects rules on the PATH only — a hostname in the `from` field is
 * ignored, and the file applies to every hostname serving the project, so it
 * cannot tell them apart. A root _middleware.js sees the real Host.
 *
 * The tradeoff is that this runs on every request, static assets included. A
 * Cloudflare Redirect Rule (dashboard: Rules -> Redirect Rules) would do the
 * same job at the edge without invoking a Function; if one is ever added, this
 * file becomes redundant and should be deleted.
 */
// Verified attached and serving before this was switched over: pointing this
// at a domain that is not yet on the project 301s every visitor into a dead
// name and takes the site down.
const CANONICAL = 'hopeful.vision';

export function onRequest({ request, next }) {
  const url = new URL(request.url);
  const host = url.hostname;

  // Preview deployments (<hash>.<project>.pages.dev) and local development must
  // keep their own hostname. Redirecting them to production would send every PR
  // preview to the live site and make it impossible to test a change.
  const canonical =
    host === CANONICAL ||
    host.endsWith('.pages.dev') ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local');

  if (!canonical) {
    url.hostname = CANONICAL;
    url.protocol = 'https:';
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }

  return next();
}
