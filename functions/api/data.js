import { repoConfig, readJsonFile, json } from '../../lib/github.js';

// Returns the latest site data. Reads from GitHub when connected so freshly
// published changes show even before the new build finishes.
export async function onRequestGet({ env, request }) {
  const cfg = repoConfig(env);
  if (cfg) {
    try {
      const [settings, categories, products, articles] = await Promise.all([
        readJsonFile(cfg, 'data/settings.json'),
        readJsonFile(cfg, 'data/categories.json'),
        readJsonFile(cfg, 'data/products.json'),
        readJsonFile(cfg, 'data/articles.json').catch(() => []),
      ]);
      return json({ connected: true, settings, categories, products, articles });
    } catch (e) {
      return json({ connected: false, error: `Could not read from GitHub. Check GITHUB_TOKEN and GITHUB_REPO. ${e.message}` }, 502);
    }
  }
  // Not connected yet: fall back to the copy baked into the last build.
  const url = new URL('/admin/data.json', request.url);
  const res = await env.ASSETS.fetch(url.toString());
  if (!res.ok) return json({ connected: false, error: 'No site data found.' }, 500);
  const data = await res.json();
  return json({ connected: false, ...data });
}
