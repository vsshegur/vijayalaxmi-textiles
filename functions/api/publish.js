import { repoConfig, gh, json } from '../../lib/github.js';

const IMG_DIR = 'static/images/products/';
const IMG_RE = /^\/images\/products\/[a-z0-9][a-z0-9-]{0,80}\.(webp|jpg|jpeg|png)$/;
const MAX_IMG_BYTES = 6 * 1024 * 1024;

const str = (v, max = 2000) => String(v ?? '').slice(0, max).trim();
const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

function cleanProducts(list) {
  if (!Array.isArray(list)) throw new Error('Products must be a list.');
  const seen = new Set();
  return list.map((p, i) => {
    const name = str(p.name, 140);
    if (!name) throw new Error(`Product ${i + 1} has no name.`);
    let slug = slugify(p.slug || name) || `towel-${i + 1}`;
    while (seen.has(slug)) slug = `${slug}-${i + 1}`;
    seen.add(slug);
    const sizes = (Array.isArray(p.sizes) ? p.sizes : [])
      .map((s) => ({ size: str(s.size, 20).toLowerCase().replace(/\s+/g, '').replace('×', 'x'), weight: str(s.weight, 60) }))
      .filter((s) => /^\d+(\.\d+)?x\d+(\.\d+)?$/.test(s.size));
    const images = (Array.isArray(p.images) ? p.images : []).map((x) => str(x, 200)).filter((x) => IMG_RE.test(x)).slice(0, 12);
    return {
      id: str(p.id, 40) || `p${Date.now()}${i}`,
      slug,
      name,
      material: str(p.material, 80),
      origin: str(p.origin, 60) || 'India',
      pattern: str(p.pattern, 80),
      description: str(p.description, 2000),
      moq: str(p.moq, 120),
      featured: !!p.featured,
      hidden: !!p.hidden,
      colour: /^#[0-9a-f]{6}$/i.test(p.colour || '') ? p.colour : '#34489c',
      images,
      sizes,
    };
  });
}

function cleanCategories(list) {
  if (!Array.isArray(list) || !list.length) throw new Error('Add at least one towel type.');
  const seen = new Set();
  return list.map((c, i) => {
    const name = str(c.name, 80);
    if (!name) throw new Error(`Towel type ${i + 1} has no name.`);
    let slug = slugify(c.slug || name);
    while (seen.has(slug)) slug = `${slug}-${i + 1}`;
    seen.add(slug);
    const sizes = (Array.isArray(c.sizes) ? c.sizes : []).map((s) => str(s, 20).toLowerCase().replace(/\s+/g, '').replace('×', 'x')).filter((s) => /^\d+(\.\d+)?x\d+(\.\d+)?$/.test(s));
    const sizeNames = {};
    for (const [k, v] of Object.entries(c.sizeNames && typeof c.sizeNames === 'object' ? c.sizeNames : {})) {
      if (sizes.includes(k) && str(v, 30)) sizeNames[k] = str(v, 30);
    }
    return {
      slug,
      name,
      singular: str(c.singular, 80) || name,
      sizes,
      sizeNames,
      description: str(c.description, 600),
    };
  });
}

function cleanSettings(s) {
  if (!s || typeof s !== 'object') throw new Error('Business details are missing.');
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'ratings') {
      out.ratings = (Array.isArray(v) ? v : []).slice(0, 8).map((r) => ({
        platform: str(r.platform, 40),
        rating: r.rating === '' || r.rating == null ? '' : Math.max(0, Math.min(5, Number(r.rating) || 0)),
        reviews: str(r.reviews, 30),
        note: str(r.note, 40),
        url: /^https?:\/\//.test(r.url || '') ? str(r.url, 600) : '',
      })).filter((r) => r.platform);
    } else if (Array.isArray(v)) {
      out[k] = v.map((x) => str(x, 80)).filter(Boolean).slice(0, 40);
    } else if (typeof v === 'number') {
      out[k] = v;
    } else {
      out[k] = str(v, k === 'about' ? 8000 : 600);
    }
  }
  out.established = Number(s.established) || 1982;
  if (!['loom', 'mill', 'spa'].includes(out.design)) out.design = 'loom';
  delete out.homeLayout;
  return out;
}

export async function onRequestPost({ request, env }) {
  const cfg = repoConfig(env);
  if (!cfg) return json({ error: 'GitHub is not connected. Add GITHUB_TOKEN and GITHUB_REPO in Cloudflare Pages settings, then redeploy.' }, 400);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'The request was not valid.' }, 400); }

  let settings, categories, products;
  try {
    settings = cleanSettings(body.settings);
    categories = cleanCategories(body.categories);
    products = cleanProducts(body.products);
  } catch (e) {
    return json({ error: e.message }, 400);
  }

  const referenced = new Set(products.flatMap((p) => p.images));
  const uploads = (Array.isArray(body.uploads) ? body.uploads : []).filter((u) => IMG_RE.test(u.path || '') && referenced.has(u.path));
  for (const u of uploads) {
    if (typeof u.data !== 'string' || u.data.length * 0.75 > MAX_IMG_BYTES) return json({ error: `Photo ${u.path} is too large. Use photos under 6 MB.` }, 400);
  }

  try {
    const ref = await gh(cfg, `/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
    const headSha = ref.object.sha;
    const head = await gh(cfg, `/git/commits/${headSha}`);
    const tree = await gh(cfg, `/git/trees/${head.tree.sha}?recursive=1`);
    const existing = new Set(tree.tree.filter((t) => t.type === 'blob' && t.path.startsWith(IMG_DIR)).map((t) => t.path));

    const entries = [];
    const fileJson = (path, data) => entries.push({ path, mode: '100644', type: 'blob', content: JSON.stringify(data, null, 2) + '\n' });
    fileJson('data/settings.json', settings);
    fileJson('data/categories.json', categories);
    fileJson('data/products.json', products);

    for (const u of uploads) {
      const blob = await gh(cfg, '/git/blobs', { method: 'POST', body: JSON.stringify({ content: u.data, encoding: 'base64' }) });
      entries.push({ path: `static${u.path}`, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // remove photos no product uses any more
    let removed = 0;
    for (const path of existing) {
      if (path.endsWith('.gitkeep')) continue;
      if (!referenced.has('/' + path.slice('static/'.length))) { entries.push({ path, mode: '100644', type: 'blob', sha: null }); removed++; }
    }

    const newTree = await gh(cfg, '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree: entries }) });
    const message = str(body.message, 200) || `Update products from admin panel (${products.length} products)`;
    const commit = await gh(cfg, '/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }) });
    await gh(cfg, `/git/refs/heads/${encodeURIComponent(cfg.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });

    return json({ ok: true, commit: commit.sha, uploaded: uploads.length, removed, products: products.length });
  } catch (e) {
    const hint = e.status === 401 || e.status === 403
      ? 'GitHub refused the change. Check that GITHUB_TOKEN is valid and has Contents: read and write on this repository.'
      : e.status === 404
        ? 'GitHub could not find the repository or branch. Check GITHUB_REPO (owner/name) and GITHUB_BRANCH.'
        : e.status === 409 || e.status === 422
          ? 'Someone else changed the site at the same moment. Reload the admin panel and publish again.'
          : 'GitHub could not save the changes. Try again in a minute.';
    return json({ error: hint, detail: e.message }, 502);
  }
}
