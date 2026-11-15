// Protects /admin and /api with the username and password set in Cloudflare Pages
// (Settings > Variables and Secrets: ADMIN_USER, ADMIN_PASSWORD).

const enc = new TextEncoder();

async function sameSecret(a, b) {
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b))),
  ]);
  const ax = new Uint8Array(x), by = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ax.length; i++) diff |= ax[i] ^ by[i];
  return diff === 0;
}

function isProtected(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/');
}

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (!isProtected(url.pathname)) return next();

  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD) {
    return new Response(
      'The admin panel is not set up yet. In Cloudflare Pages, open Settings > Variables and Secrets and add ADMIN_USER and ADMIN_PASSWORD, then redeploy.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } }
    );
  }

  const header = request.headers.get('Authorization') || '';
  const [scheme, token] = header.split(' ');
  let ok = false;
  if (scheme === 'Basic' && token) {
    let decoded = '';
    try { decoded = new TextDecoder().decode(Uint8Array.from(atob(token), (c) => c.charCodeAt(0))); } catch (_) {}
    const i = decoded.indexOf(':');
    if (i > -1) {
      const [u, p] = [decoded.slice(0, i), decoded.slice(i + 1)];
      const [uOk, pOk] = await Promise.all([sameSecret(u, env.ADMIN_USER), sameSecret(p, env.ADMIN_PASSWORD)]);
      ok = uOk && pOk;
    }
  }
  if (!ok) {
    return new Response('Sign in with your admin username and password.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Vijayalaxmi Textiles admin", charset="UTF-8"',
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  // API calls that change data must come from the admin page itself.
  if (url.pathname.startsWith('/api/') && request.method !== 'GET') {
    const origin = request.headers.get('Origin');
    if (request.headers.get('X-Admin') !== '1' || (origin && origin !== url.origin)) {
      return new Response('Request blocked.', { status: 403 });
    }
  }

  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'no-store');
  out.headers.set('X-Robots-Tag', 'noindex');
  return out;
}
