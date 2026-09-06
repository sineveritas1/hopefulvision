/**
 * Canonical-host redirect.
 *
 * Both trippingtoy.com and www.trippingtoy.com are attached to this Pages
 * project, so without this the identical site answers on two hostnames.
 *
 * This lives in a Function rather than in public/_redirects because Pages
 * matches _redirects rules on the PATH only — a hostname in the `from` field
 * is ignored, and the file applies to every hostname serving the project, so
 * it cannot tell the two apart. A root _middleware.js sees the real Host.
 *
 * The tradeoff is that this runs on every request, static assets included.
 * A Cloudflare Redirect Rule (dashboard: Rules -> Redirect Rules) would do the
 * same job at the edge without invoking a Function; if one is ever added, this
 * file becomes redundant and should be deleted.
 */
export function onRequest({ request, next }) {
  const url = new URL(request.url);

  // Strip a leading "www." from any host, so this keeps working if the domain
  // changes and does not need a second rule for preview hostnames.
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
    return Response.redirect(url.toString(), 301);
  }

  return next();
}
