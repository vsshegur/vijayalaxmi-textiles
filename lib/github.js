// Minimal GitHub helper for Cloudflare Pages Functions.
// Needs GITHUB_TOKEN (fine-grained token with Contents: read and write on this repo)
// and GITHUB_REPO ("owner/name"). GITHUB_BRANCH defaults to "main".

export function repoConfig(env) {
  const repo = env.GITHUB_REPO;
  const token = env.GITHUB_TOKEN;
  if (!repo || !token) return null;
  return { repo, token, branch: env.GITHUB_BRANCH || 'main' };
}

export async function gh(cfg, path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${cfg.repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'vijayalaxmi-admin',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`GitHub ${res.status} on ${path}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export async function readJsonFile(cfg, filePath) {
  const data = await gh(cfg, `/contents/${filePath}?ref=${encodeURIComponent(cfg.branch)}`);
  const bin = atob(String(data.content || '').replace(/\n/g, ''));
  const text = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  return JSON.parse(text);
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
