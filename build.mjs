// Builds the static site into ./dist. No dependencies: Cloudflare Pages runs `node build.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { makeContext, homePage, towelsPage, categoryPage, productPage, aboutPage, contactPage, notFoundPage, solapurPage, terryGuidePage, sizeGuidePage, hotelPage, blogIndexPage, articlePage, visibleArticles, catalogueData } from './src/templates.mjs';
import { slugify } from './src/lib.mjs';

const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.resolve(root, process.env.OUT_DIR || 'dist');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));

const settings = read('data/settings.json');
const categories = read('data/categories.json');
const products = read('data/products.json')
  .filter((p) => p && p.name && !p.hidden)
  .map((p) => ({ ...p, slug: p.slug || slugify(p.name) }));

const articles = fs.existsSync(path.join(root, 'data/articles.json')) ? read('data/articles.json') : [];
if (process.env.SITE_URL) settings.siteUrl = process.env.SITE_URL;
if (process.env.DESIGN) settings.design = process.env.DESIGN; // for previews

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// static files (favicon, images, _headers, _routes.json ...)
fs.cpSync(path.join(root, 'static'), out, { recursive: true });
// admin panel
fs.cpSync(path.join(root, 'admin'), path.join(out, 'admin'), { recursive: true });
// copy of the data for the admin panel (used before GitHub is connected)
fs.writeFileSync(path.join(out, 'admin/data.json'), JSON.stringify({ settings: read('data/settings.json'), categories, products: read('data/products.json'), articles: fs.existsSync(path.join(root, 'data/articles.json')) ? read('data/articles.json') : [] }));

// assets with cache-busting versions
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const css = fs.readFileSync(path.join(root, 'src/site.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/site.js'), 'utf8');
// file names change whenever the content changes, so browsers never mix old and new files
fs.mkdirSync(path.join(out, 'assets/v'), { recursive: true });
const cssFile = `v/site.${hash(css)}.css`;
const jsFile = `v/site.${hash(js)}.js`;
const catJs = fs.readFileSync(path.join(root, 'src/catalogue.js'), 'utf8');
const catalogueFile = `v/catalogue.${hash(catJs)}.js`;
fs.writeFileSync(path.join(out, 'assets', catalogueFile), catJs);
fs.writeFileSync(path.join(out, 'assets', cssFile), css);
fs.writeFileSync(path.join(out, 'assets', jsFile), js);
// keep the plain names too, for anything that links to them directly
fs.writeFileSync(path.join(out, 'assets/site.css'), css);
fs.writeFileSync(path.join(out, 'assets/site.js'), js);

const ctx = makeContext({ settings, categories, products, articles, cssFile, jsFile, catalogueFile });
fs.writeFileSync(path.join(out, 'catalogue.json'), JSON.stringify(catalogueData(ctx)));

const pages = [];
const write = (urlPath, html, { sitemap = true, priority = '0.6', lastmod = '' } = {}) => {
  const file = urlPath.endsWith('/') ? path.join(out, urlPath, 'index.html') : path.join(out, urlPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  if (sitemap) pages.push({ urlPath, priority, lastmod });
};

write('/', homePage(ctx), { priority: '1.0' });
write('/towels/', towelsPage(ctx), { priority: '0.9' });
for (const c of categories) write(`/towels/${c.slug}/`, categoryPage(ctx, c), { priority: '0.8' });
const seen = new Set();
for (const p of products) {
  if (seen.has(p.slug)) { console.warn(`Duplicate product slug skipped: ${p.slug}`); continue; }
  seen.add(p.slug);
  write(`/products/${p.slug}/`, productPage(ctx, p), { priority: '0.7' });
}
write('/solapur-towels/', solapurPage(ctx), { priority: '0.9' });
write('/terry-towels/', terryGuidePage(ctx), { priority: '0.8' });
write('/towel-size-guide/', sizeGuidePage(ctx), { priority: '0.8' });
write('/hotel-towels/', hotelPage(ctx), { priority: '0.8' });
const posts = visibleArticles(articles);
if (posts.length) {
  write('/blog/', blogIndexPage(ctx), { priority: '0.6' });
  for (const a of posts) write(`/blog/${a.slug}/`, articlePage(ctx, a), { priority: '0.6', lastmod: a.updated || a.date });
}
write('/about/', aboutPage(ctx), { priority: '0.7' });
write('/contact/', contactPage(ctx), { priority: '0.7' });
write('/404.html', notFoundPage(ctx), { sitemap: false });

const today = new Date().toISOString().slice(0, 10);
const base = ctx.siteUrl;
fs.writeFileSync(
  path.join(out, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${base}${p.urlPath}</loc><lastmod>${/^\d{4}-\d{2}-\d{2}$/.test(p.lastmod) ? p.lastmod : today}</lastmod><priority>${p.priority}</priority></url>`)
    .join('\n')}\n</urlset>\n`
);
fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`);

console.log(`Built ${pages.length} pages into dist/ for ${base}`);
