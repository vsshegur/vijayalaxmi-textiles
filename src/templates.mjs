import { esc, parseSize, sizeLabel, sizeShort, sizeCm, waLink, paragraphs } from './lib.mjs';

// ---------- shared context ----------

// size -> name (e.g. 30x60 -> Standard), filled by makeContext
let SIZE_NAMES = new Map();
const sizeName = (s) => SIZE_NAMES.get(norm(s)) || '';
const nameTag = (s) => (sizeName(s) ? ` <span class="size-name">${esc(sizeName(s))}</span>` : '');
const nameParen = (s) => (sizeName(s) ? ` (${sizeName(s)})` : '');

export function makeContext({ settings, categories, products, cssFile, jsFile }) {
  SIZE_NAMES = new Map();
  for (const c of categories) for (const [k, v] of Object.entries(c.sizeNames || {})) if (v) SIZE_NAMES.set(norm(k), String(v));
  const siteUrl = String(settings.siteUrl || '').replace(/\/+$/, '');
  const year = new Date().getFullYear();
  const established = Number(settings.established) || 1982;
  const yearsActive = year - established;

  // size -> category
  const sizeToCat = new Map();
  for (const c of categories) for (const s of c.sizes || []) if (!sizeToCat.has(norm(s))) sizeToCat.set(norm(s), c);

  const productCats = (p) => {
    const out = [];
    for (const c of categories) {
      const sizes = (p.sizes || []).filter((s) => sizeToCat.get(norm(s.size)) === c);
      if (sizes.length) out.push({ cat: c, sizes });
    }
    const other = (p.sizes || []).filter((s) => !sizeToCat.has(norm(s.size)));
    if (other.length) out.push({ cat: { slug: '', name: 'Other sizes', singular: 'Other size' }, sizes: other });
    return out;
  };

  return {
    settings, categories, products, siteUrl, year, established, yearsActive,
    cssFile, jsFile, sizeToCat, productCats,
    city: settings.city ? String(settings.city) : '',
    design: designOf(settings),
  };
}

export function designOf(settings) {
  const d = settings.design || { showroom: 'mill', heritage: 'spa' }[settings.homeLayout] || settings.homeLayout;
  return ['loom', 'mill', 'spa'].includes(d) ? d : 'loom';
}

function fontPreload(design) {
  const files = { loom: ['lora-var', 'inter-400'], mill: ['interdisplay-800', 'inter-400'], spa: ['poppins-300', 'poppins-400'] }[design] || [];
  return files.map((f) => `<link rel="preload" href="/assets/fonts/${f}.woff" as="font" type="font/woff" crossorigin>`).join('\n');
}

function roll(colour, size) {
  return `<span class="roll" style="--c:${esc(colour)};--s:${size}" aria-hidden="true"></span>`;
}

export const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '').replace('×', 'x');

const abs = (ctx, path) => `${ctx.siteUrl}${path}`;

// ---------- small components ----------

function towelSwatch(colour, { label = '', cls = '' } = {}) {
  const c = colour || '#34489c';
  return `<div class="terry ${cls}" style="--c:${esc(c)}" role="img" aria-label="${esc(label)}"><span class="terry-band"></span><span class="terry-band terry-band--low"></span></div>`;
}

function productVisual(p, { large = false } = {}) {
  const img = (p.images || [])[0];
  if (img) {
    return `<img src="${esc(img)}" alt="${esc(p.name)}, ${esc((p.sizes || []).map((x) => sizeShort(x.size)).join(', '))} inch terry towel" loading="${large ? 'eager' : 'lazy'}" decoding="async" width="800" height="1000">`;
  }
  return towelSwatch(p.colour, { label: p.name, cls: 'terry--fill' });
}

function stars(rating, id) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const pct = (r / 5) * 100;
  const star = (i) => `<path transform="translate(${i * 24} 0)" d="M12 1.8l3.1 6.4 7 1-5.1 4.9 1.2 7-6.2-3.3-6.2 3.3 1.2-7L1.9 9.2l7-1z"/>`;
  return `<svg class="stars" viewBox="0 0 120 24" aria-hidden="true"><defs><linearGradient id="g${id}"><stop offset="${pct}%" stop-color="var(--star)"/><stop offset="${pct}%" stop-color="var(--line)"/></linearGradient></defs><g fill="url(#g${id})">${[0, 1, 2, 3, 4].map(star).join('')}</g></svg>`;
}

function ratingCards(ctx) {
  const list = (ctx.settings.ratings || []).filter((r) => r.rating !== '' && r.rating != null || r.url);
  if (!list.length) return '';
  return `<ul class="ratings">${list
    .map((r, i) => {
      const has = r.rating !== '' && r.rating != null;
      const val = has ? Number(r.rating).toFixed(1) : '';
      return `<li class="rating">
        <p class="rating-platform">${esc(r.platform)}</p>
        ${has ? `<p class="rating-score"><span class="rating-num">${esc(val)}</span><span class="rating-of">out of 5</span></p>${stars(r.rating, i)}` : `<p class="rating-score rating-score--none">See our profile</p>`}
        ${r.reviews ? `<p class="rating-count">${esc(r.reviews)} ${esc(r.note || 'reviews')}</p>` : ''}
        ${r.url ? `<a class="rating-link" href="${esc(r.url)}" target="_blank" rel="noopener">View ${esc(r.platform)} profile</a>` : ''}
      </li>`;
    })
    .join('')}</ul>`;
}

// Size drawn to scale. unit = CSS length per inch (as a CSS var on parent).
function sizeFigure(size, colour, { caption = true } = {}) {
  const p = parseSize(size);
  if (!p) return '';
  return `<figure class="scale-item" style="--w:${p.w};--h:${p.h}">
    <div class="scale-towel">${towelSwatch(colour, { label: sizeLabel(size) })}</div>
    ${caption ? `<figcaption>${esc(sizeShort(size))}${nameTag(size)}</figcaption>` : ''}
  </figure>`;
}

function sizeChips(sizes, { href } = {}) {
  return `<ul class="chips">${sizes
    .map((s) => `<li data-chip-size="${esc(norm(s.size || s))}">${href ? `<a class="chip" href="${esc(href(s))}">${esc(sizeShort(s.size || s))}${nameTag(s.size || s)}</a>` : `<span class="chip">${esc(sizeShort(s.size || s))}${nameTag(s.size || s)}</span>`}</li>`)
    .join('')}</ul>`;
}

function productCard(ctx, p, { cat } = {}) {
  const groups = ctx.productCats(p);
  const sizes = cat ? (groups.find((g) => g.cat.slug === cat.slug)?.sizes || []) : (p.sizes || []);
  const first = sizes[0]?.size;
  const url = `/products/${p.slug}/${first ? `?size=${encodeURIComponent(norm(first))}` : ''}`;
  const meta = [p.material, p.pattern].filter(Boolean).join(', ');
  const catSlugs = groups.map((g) => g.cat.slug).filter(Boolean).join(' ');
  const sizeKeys = (p.sizes || []).map((s) => norm(s.size)).join(' ');
  return `<li class="card" data-cats="${esc(catSlugs)}" data-sizes="${esc(sizeKeys)}">
    <a class="card-link" href="${esc(url)}">
      <div class="card-visual">${productVisual(p)}</div>
      <h3 class="card-title">${esc(p.name)}</h3>
      ${meta ? `<p class="card-meta">${esc(meta)}</p>` : ''}
    </a>
    ${sizeChips(sizes, { href: (s) => `/products/${p.slug}/?size=${encodeURIComponent(norm(s.size))}` })}
  </li>`;
}

function quoteButtons(ctx, text, { light = false } = {}) {
  const wa = waLink(ctx.settings, text);
  const mail = ctx.settings.email
    ? `mailto:${ctx.settings.email}?subject=${encodeURIComponent('Quotation request')}&body=${encodeURIComponent(text)}`
    : '';
  const im = ctx.settings.indiamartUrl;
  const btns = [];
  if (wa) btns.push(`<a class="btn btn--primary" data-wa href="${esc(wa)}" target="_blank" rel="noopener">${waIcon()}Enquire on WhatsApp</a>`);
  if (im) btns.push(`<a class="btn ${light ? 'btn--ghost-light' : 'btn--ghost'}" href="${esc(im)}" target="_blank" rel="noopener">Enquire on IndiaMART</a>`);
  else if (mail) btns.push(`<a class="btn ${light ? 'btn--ghost-light' : 'btn--ghost'}" data-mail href="${esc(mail)}">Email us</a>`);
  if (!btns.length) btns.push(`<a class="btn btn--primary" href="/contact/">Ask for a quotation</a>`);
  const langs = ctx.settings.languages && wa ? `<p class="lang-note">We reply on WhatsApp in ${esc(ctx.settings.languages)}.</p>` : '';
  return `<div class="quote"><div class="btn-row">${btns.join('')}</div>${langs}</div>`;
}

const waIcon = () =>
  `<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4 5.2 5.2 0 0 0 3.1.6 2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>`;

function timeline(ctx) {
  const items = [
    [String(ctx.established), 'Set up our first grey cotton fabric plant.'],
    ['Growth', 'Expanded into chaddars, then into terry towels.'],
    ['Online', 'Began serving buyers through IndiaMART and Google Business, earning a 5-star IndiaMART rating from 150+ customers.'],
    ['Today', 'Specialists in towels: our own terry towels in every standard size, plus selected microfiber towels.'],
  ];
  return `<ol class="timeline">${items
    .map(([k, v]) => `<li><span class="timeline-key">${esc(k)}</span><p>${esc(v)}</p></li>`)
    .join('')}</ol>`;
}

// ---------- layout ----------

export function layout(ctx, { title, description, path, body, jsonld = [], image, active = '', noindex = false }) {
  const s = ctx.settings;
  const fullTitle = title ? `${title} | ${s.firmName}` : `Terry Towel Manufacturer in ${s.city || 'India'} since ${ctx.established} | ${s.firmName}${s.brandName ? ` (${s.brandName})` : ''}`;
  const desc = description || s.seoDescription;
  const canonical = abs(ctx, path);
  const ogImage = image ? (image.startsWith('http') ? image : abs(ctx, image)) : abs(ctx, '/og-image.png');
  const nav = [
    ['towels', '/towels/', 'Towels'],
    ['sizes', '/towel-size-guide/', 'Size guide'],
    ['about', '/about/', 'About us'],
    ['contact', '/contact/', 'Contact'],
  ];
  const wa = waLink(s, `Hello ${s.firmName}, I would like a quotation for terry towels.`);
  const quoteHref = wa || '/contact/';

  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(s.firmName)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1d2a5c">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${fontPreload(ctx.design)}
<link rel="stylesheet" href="/assets/${ctx.cssFile}">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body class="theme-${ctx.design}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/" aria-label="${esc(s.firmName)} home">
      ${brandLogo(ctx, ctx.design === 'mill')}
      <span class="brand-text"><span class="brand-name">${esc(s.firmName)}</span><span class="brand-sub">Terry towels since ${ctx.established}</span></span>
    </a>
    <button class="nav-toggle" aria-expanded="false" aria-controls="site-nav"><span class="sr">Menu</span><span class="nav-toggle-bars"></span></button>
    <nav id="site-nav" class="site-nav" aria-label="Main">
      <ul>
        ${nav.map(([k, href, label]) => `<li><a href="${href}"${active === k ? ' aria-current="page"' : ''}>${label}</a></li>`).join('')}
      </ul>
      <a class="btn btn--small btn--primary" href="${esc(quoteHref)}"${wa ? ' target="_blank" rel="noopener"' : ''}>Get a quotation</a>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
${footer(ctx)}
<script src="/assets/${ctx.jsFile}" defer></script>
</body>
</html>`;
}

function brandLogo(ctx, light) {
  const s = ctx.settings;
  const src = light ? (s.brandLogoLight || s.brandLogo) : s.brandLogo;
  if (!src) return logoMark();
  return `<img class="brand-logo" src="${esc(src)}" alt="${esc(s.brandName || s.firmName)}" width="673" height="177">`;
}

const brandR = (ctx) => (ctx.settings.brandName ? `${ctx.settings.brandName}®` : '');

export function logoMark() {
  return `<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
    <rect x="3" y="6" width="34" height="28" rx="4" fill="#1d2a5c"/>
    <rect x="3" y="11" width="34" height="3" fill="#e2a12a"/>
    <rect x="3" y="26" width="34" height="3" fill="#e2a12a"/>
    <path d="M12 15.5l8 9 8-9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function footer(ctx) {
  const s = ctx.settings;
  const addr = [s.addressLine, [s.city, s.state].filter(Boolean).join(', '), s.pincode].filter(Boolean).join(', ');
  const profiles = (s.ratings || []).filter((r) => r.url).map((r) => [r.platform, r.url]);
  const greet = s.whatsappGreeting || `Hi ${s.firmName}, I was searching for towels on your website.`;
  const waHref = waLink(s, greet);
  const footerWa = waHref
    ? `<a class="btn btn--wa" href="${esc(waHref)}" target="_blank" rel="noopener">${waIcon()}Chat on WhatsApp</a>${s.languages ? `<p class="footer-wa-note">${esc(s.whatsapp || s.phone)}. We reply in ${esc(s.languages)}.</p>` : ''}`
    : '';
  if (s.flipkartUrl) profiles.push(['Flipkart', s.flipkartUrl]);
  return `<footer class="site-footer">
  <div class="border-band" aria-hidden="true"></div>
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <a class="brand brand--light" href="/">${brandLogo(ctx, true)}<span class="brand-text"><span class="brand-name">${esc(s.firmName)}</span><span class="brand-sub">Terry towels since ${ctx.established}</span></span></a>
      <p>Manufacturers of terry bath towels, baby bath towels, hand towels, face towels and bath mats${ctx.city ? ` in ${esc(ctx.city)}` : ''}.</p>
      ${footerWa}
    </div>
    <div>
      <h2 class="footer-h">Towels</h2>
      <ul>${ctx.categories.map((c) => `<li><a href="/towels/${esc(c.slug)}/">${esc(c.name)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h2 class="footer-h">Guides</h2>
      <ul>${GUIDES.map(([p, n]) => `<li><a href="${p}">${esc(n)}</a></li>`).join('')}</ul>
    </div>
    <div>
      <h2 class="footer-h">Contact</h2>
      <ul>
        ${s.phone ? `<li><a href="tel:${esc(s.phone.replace(/\s+/g, ''))}">${esc(s.phone)}</a></li>` : ''}
        ${s.email ? `<li><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>` : ''}
        ${addr ? `<li>${esc(addr)}</li>` : ''}
        ${s.gstin ? `<li>GSTIN ${esc(s.gstin)}</li>` : ''}
        <li><a href="/contact/">Send an enquiry</a></li>
      </ul>
    </div>
    ${profiles.length ? `<div>
      <h2 class="footer-h">Find us on</h2>
      <ul>${profiles.map(([n, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join('')}</ul>
    </div>` : ''}
  </div>
  <div class="wrap footer-base">
    <p>© ${ctx.year} ${esc(s.firmName)}.${s.brandName ? ` ${esc(brandR(ctx))} is a registered brand of ${esc(s.firmName)}.` : ''} All sizes are in inches.</p>
  </div>
</footer>`;
}

// ---------- structured data ----------

function orgJsonLd(ctx) {
  const s = ctx.settings;
  const sameAs = [...(s.ratings || []).map((r) => r.url), s.flipkartUrl].filter(Boolean);
  const o = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${ctx.siteUrl}/#business`,
    name: s.firmName,
    alternateName: s.alternateName || undefined,
    description: s.seoDescription,
    url: `${ctx.siteUrl}/`,
    logo: `${ctx.siteUrl}/logo.png`,
    image: `${ctx.siteUrl}/og-image.png`,
    foundingDate: String(ctx.established),
    slogan: s.tagline,
    brand: s.brandName ? { '@type': 'Brand', name: s.brandName, logo: s.brandLogo ? `${ctx.siteUrl}${s.brandLogo}` : undefined } : undefined,
    areaServed: { '@type': 'Country', name: 'India' },
    keywords: 'Solapur towels, terry towels, towel manufacturer Solapur, bath towels, hand towels, face towels, baby bath towels, bath mats, hotel towels, wholesale towels',
    knowsAbout: ['Solapur Terry Towel', 'Terry towels', 'Bath towels', 'Hand towels', 'Face towels', 'Baby bath towels', 'Bath mats', 'Towel manufacturing'],
  };
  if (s.phone) o.telephone = s.phone;
  if (s.email) o.email = s.email;
  if (s.gstin) o.taxID = s.gstin;
  if (s.city || s.addressLine) {
    o.address = {
      '@type': 'PostalAddress',
      streetAddress: s.addressLine || undefined,
      addressLocality: s.city || undefined,
      addressRegion: s.state || undefined,
      postalCode: s.pincode || undefined,
      addressCountry: 'IN',
    };
  }
  if (sameAs.length) o.sameAs = sameAs;
  return o;
}

function breadcrumbs(ctx, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(ctx, path) })),
  };
}

function crumbNav(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items
    .map(([name, path], i) => `<li>${i < items.length - 1 ? `<a href="${esc(path)}">${esc(name)}</a>` : `<span aria-current="page">${esc(name)}</span>`}</li>`)
    .join('')}</ol></nav>`;
}

// ---------- pages ----------

export function homePage(ctx) {
  const s = ctx.settings;
  const variant = ctx.design;
  const featured = ctx.products.filter((p) => p.featured);
  const showcase = (featured.length ? featured : ctx.products).slice(0, 6);
  const indiamart = (s.ratings || []).find((r) => /indiamart/i.test(r.platform) && r.rating !== '');
  const cityIn = ctx.city ? ` in ${esc(ctx.city)}` : '';
  const lede = `For over ${ctx.yearsActive} years we have manufactured cotton textiles. Today we specialise in towels: terry bath, baby, hand and face towels and bath mats, for ${esc(s.buyers || 'wholesalers, hotels and retailers')}.`;
  const heroButtons = `<div class="btn-row">
        <a class="btn btn--primary" href="/towels/">See our towels</a>
        <a class="btn btn--ghost" href="/contact/">Ask for a quotation</a>
      </div>`;
  const facts = `<dl class="facts">
        <div><dt>Established</dt><dd>${ctx.established}</dd></div>
        ${indiamart ? `<div><dt>IndiaMART rating</dt><dd>${esc(Number(indiamart.rating).toFixed(1))} / 5</dd></div>` : ''}
        ${indiamart && indiamart.reviews ? `<div><dt>Trusted buyers</dt><dd>${esc(indiamart.reviews)}</dd></div>` : ''}
      </dl>`;

  const heroLoom = () => {
    const stack = ['#1d2a5c', '#e2a12a', '#f4f5f8', '#2f7a6b', '#b5473a'];
    const img = s.heroImage;
    const visual = img
      ? `<picture class="hero-photo"><img src="${esc(img)}-1400.webp" srcset="${esc(img)}-900.webp 900w, ${esc(img)}-1400.webp 1400w, ${esc(img)}-2000.webp 2000w" sizes="(max-width: 860px) 100vw, 640px" width="2000" height="1512" alt="Stacks of ${esc(s.firmName)} terry towels in many colours, plain, striped, dobby border and jacquard designs" fetchpriority="high"></picture>`
      : `<div class="hero-stack" aria-hidden="true">${stack.map((c, i) => `<div class="fold" style="--c:${c};--i:${i}"><span class="terry-band"></span></div>`).join('')}</div>`;
    return `<section class="hero${img ? ' hero--photo' : ''}">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <h1 class="display">Terry towels, made${cityIn} since ${ctx.established}.</h1>
      <p class="lede">${lede}</p>
      ${heroButtons}
      ${facts}
    </div>
    ${visual}
  </div>
</section>`;
  };

  const heroMill = () => `<section class="mill-hero">
  <div class="wrap mill-hero-grid">
    <div>
      <p class="mill-kicker">${esc(s.businessType || 'Terry towel manufacturer')}${cityIn}</p>
      <h1 class="display">Terry towels in every standard size. Since ${ctx.established}.</h1>
      <p class="lede">${lede}</p>
      <div class="btn-row">
        <a class="btn btn--primary" href="/towels/">See our towels</a>
        <a class="btn btn--ghost-light" href="/contact/">Ask for a quotation</a>
      </div>
    </div>
    <div class="mill-sheet">
      <h2 class="mill-sheet-h">Standard sizes, in inches</h2>
      <table>
        <tbody>${ctx.categories.map((c) => `<tr><th scope="row"><a href="/towels/${esc(c.slug)}/">${esc(c.name)}</a></th><td>${(c.sizes || []).map((sz) => esc(sizeShort(sz) + nameParen(sz))).join(', ')}</td></tr>`).join('')}</tbody>
      </table>
      <a class="mill-sheet-link" href="/towels/">Browse the full range</a>
    </div>
  </div>
</section>
<section class="mill-stats" aria-label="Key facts">
  <dl class="wrap mill-stats-grid">
    <div><dt>Established</dt><dd>${ctx.established}</dd></div>
    ${indiamart ? `<div><dt>Rating on IndiaMART</dt><dd>${esc(Number(indiamart.rating).toFixed(1))}/5</dd></div>` : ''}
    ${indiamart && indiamart.reviews ? `<div><dt>Trusted buyers on IndiaMART</dt><dd>${esc(indiamart.reviews)}</dd></div>` : ''}
    <div><dt>Standard towel sizes</dt><dd>${ctx.categories.reduce((n, c) => n + (c.sizes || []).length, 0)}</dd></div>
  </dl>
</section>`;

  const heroSpa = () => {
    const rolls = [['#a9c4b2', 1], ['#f1d3c9', 0.8], ['#ffffff', 1.15], ['#c9d8e8', 0.85], ['#e8dcc6', 0.95], ['#6f8f7a', 0.7]];
    return `<section class="spa-hero">
  <div class="wrap spa-hero-inner">
    <p class="spa-kicker">${esc(ctx.city || 'India')}, since ${ctx.established}</p>
    <h1 class="display">Soft, absorbent towels, made with care for ${ctx.yearsActive} years.</h1>
    <p class="lede">${lede}</p>
    <div class="btn-row">
      <a class="btn btn--primary" href="/towels/">See our towels</a>
      <a class="btn btn--ghost" href="/contact/">Ask for a quotation</a>
    </div>
  </div>
  <div class="spa-rolls">${rolls.map(([c, sz]) => roll(c, sz)).join('')}</div>
</section>`;
  };

  const catRolls = () => {
    const palette = ['#a9c4b2', '#f1d3c9', '#c9d8e8', '#e8dcc6', '#6f8f7a', '#d9c2e0'];
    return `<section class="section" aria-labelledby="cats-h">
  <div class="wrap">
    <div class="section-head section-head--center">
      <h2 id="cats-h" class="h2">Find the right towel</h2>
      <p>All sizes are in inches.</p>
    </div>
    <ul class="spa-cats">${ctx.categories.map((c, i) => {
      const big = Math.max(...(c.sizes || ['10x10']).map((sz) => { const d = parseSize(sz); return d ? d.w * d.h : 100; }));
      const scale = Math.max(0.55, Math.min(1.1, Math.sqrt(big / 2592) * 1.1));
      return `<li><a href="/towels/${esc(c.slug)}/">${roll(palette[i % palette.length], scale.toFixed(2))}<span class="spa-cat-name">${esc(c.name)}</span><span class="spa-cat-sizes">${(c.sizes || []).map(sizeShort).join(', ')}</span></a></li>`;
    }).join('')}</ul>
  </div>
</section>`;
  };

  const brandStrip = () => s.brandName ? `<section class="brand-strip" aria-label="Our brand">
  <div class="wrap brand-strip-inner">
    ${s.brandLogo ? `<img class="brand-strip-logo" src="${esc(s.brandLogo)}" alt="${esc(s.brandName)}" width="673" height="177" loading="lazy">` : ''}
    <p><strong>${esc(brandR(ctx))} is the registered brand of ${esc(s.firmName)}.</strong> Ask for ${esc(s.brandName)} towels by name when you order.</p>
  </div>
</section>` : '';

  const scaleSection = () => `<section class="section section--scale" aria-labelledby="sizes-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="sizes-h" class="h2">Every size, drawn to scale</h2>
      <p>Our towels are grouped by size. All measurements are in inches. Choose a size to see the designs we make in it.</p>
    </div>
    <div class="scale-row" role="list">
      ${ctx.categories.map((c) => `<a class="scale-group" role="listitem" href="/towels/${esc(c.slug)}/">
        <div class="scale-figs">${(c.sizes || []).map((sz) => sizeFigure(sz, '#34489c')).join('')}</div>
        <span class="scale-name">${esc(c.name)}</span>
      </a>`).join('')}
    </div>
  </div>
</section>`;

  const catTiles = () => `<section class="section" aria-labelledby="cats-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="cats-h" class="h2">Shop by towel type</h2>
      <p>Every towel type, with its sizes drawn to the same scale. All measurements are in inches.</p>
    </div>
    <ul class="cat-tiles">
      ${ctx.categories.map((c) => `<li><a class="cat-tile" href="/towels/${esc(c.slug)}/">
        <div class="cat-tile-figs">${(c.sizes || []).map((sz) => sizeFigure(sz, '#34489c')).join('')}</div>
        <span class="cat-tile-name">${esc(c.name)}</span>
        <span class="cat-tile-sizes">${(c.sizes || []).map(sizeLabel).join(', ')}</span>
      </a></li>`).join('')}
    </ul>
  </div>
</section>`;

  const featuredSection = () => showcase.length ? `<section class="section" aria-labelledby="feat-h">
  <div class="wrap">
    <div class="section-head section-head--row">
      <h2 id="feat-h" class="h2">From our looms</h2>
      <a class="text-link" href="/towels/">View all towels</a>
    </div>
    <ul class="grid">${showcase.map((p) => productCard(ctx, p)).join('')}</ul>
  </div>
</section>` : '';

  const storySection = () => `<section class="section section--story" aria-labelledby="story-h">
  <div class="wrap story-grid">
    <div>
      <h2 id="story-h" class="h2">${ctx.yearsActive} years of making cotton textiles</h2>
      <p>${esc(paragraphs(s.about)[0] || '')}</p>
      <a class="text-link" href="/about/">Read our story</a>
    </div>
    ${timeline(ctx)}
  </div>
</section>`;

  const valuesSection = () => `<section class="section section--story" aria-labelledby="values-h">
  <div class="wrap">
    <div class="section-head"><h2 id="values-h" class="h2">What buyers get from us</h2></div>
    <ul class="values">
      <li><h3 class="h3">Uniform quality</h3><p>An experienced team checks every stage, so each batch matches the last.</p></li>
      <li><h3 class="h3">Competitive prices</h3><p>Strong buying power and tight control of overheads keep our rates low.</p></li>
      <li><h3 class="h3">Timely delivery</h3><p>Prompt dispatch and personal attention on every order.</p></li>
      <li><h3 class="h3">Honest dealing</h3><p>We grow through long relationships, with a guarantee on what we supply.</p></li>
    </ul>
    <a class="text-link" href="/about/">Read our story</a>
  </div>
</section>`;

  const trustSection = () => ratingCards(ctx) ? `<section class="section" aria-labelledby="trust-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="trust-h" class="h2">Rated by our buyers</h2>
      <p>Independent ratings from the platforms where buyers find and review us.</p>
    </div>
    ${ratingCards(ctx)}
  </div>
</section>` : '';

  const orders = {
    loom: [heroLoom, brandStrip, scaleSection, featuredSection, storySection, trustSection],
    mill: [heroMill, brandStrip, catTiles, featuredSection, trustSection, valuesSection],
    spa: [heroSpa, brandStrip, catRolls, featuredSection, valuesSection, storySection, trustSection],
  };
  const guidesSection = () => `<section class="section" aria-labelledby="guides-h">
  <div class="wrap guides-grid">
    <div>
      <h2 id="guides-h" class="h2">Terry towel manufacturer in ${esc(ctx.city || 'India')}</h2>
      <p class="guides-intro">${esc(s.firmName)} makes terry towels in ${esc(ctx.city || 'India')}, the home of the GI-tagged Solapur Terry Towel. We manufacture and wholesale bath towels in standard 30 × 60 and large 36 × 72 inch sizes, baby bath towels, hand towels, face towels and bath mats under our registered brand ${esc(s.brandName ? s.brandName + '®' : s.firmName)}, for wholesalers, hotels and retailers.</p>
    </div>
    <ul class="cat-links">${GUIDES.map(([p, n, d]) => `<li><a href="${p}"><span>${esc(n)}</span><span class="cat-links-sizes">${esc(d)}</span></a></li>`).join('')}</ul>
  </div>
</section>`;
  const body = (orders[variant] || orders.loom).map((f) => f()).join('\n') + '\n' + guidesSection() + '\n' + enquiryBand(ctx);

  return layout(ctx, {
    title: '',
    description: s.seoDescription,
    path: '/',
    image: s.heroImage ? `${s.heroImage}-1400.webp` : undefined,
    body,
    jsonld: [orgJsonLd(ctx), { '@context': 'https://schema.org', '@type': 'WebSite', name: s.firmName, alternateName: [s.brandName, s.alternateName].filter(Boolean), url: `${ctx.siteUrl}/` }],
  });
}

function enquiryBand(ctx) {
  return `<section class="enquiry" aria-labelledby="enq-h">
  <div class="border-band" aria-hidden="true"></div>
  <div class="wrap enquiry-inner">
    <div>
      <h2 id="enq-h" class="h2">Tell us what you need</h2>
      <p>Share the towel type, size and quantity. We reply quickly with our best quotation.</p>
    </div>
    ${quoteButtons(ctx, `Hello ${ctx.settings.firmName}, I would like a quotation for terry towels.`, { light: true })}
  </div>
</section>`;
}

export function towelsPage(ctx) {
  const allSizes = ctx.categories.flatMap((c) => (c.sizes || []).map((sz) => ({ sz, cat: c.slug })));
  const body = `
<section class="page-head">
  <div class="wrap">
    ${crumbNav([['Home', '/'], ['Towels', '/towels/']])}
    <h1 class="display display--page">Our towels</h1>
    <p class="lede">Every towel we make, in every size. Filter by type or size, then open a towel to see its weight and details.</p>
  </div>
</section>
<section class="section section--tight">
  <div class="wrap">
    <div class="filters" data-filters>
      <div class="filter-group" role="group" aria-label="Filter by type">
        <button class="chip chip--btn" aria-pressed="true" data-filter-cat="">All types</button>
        ${ctx.categories.map((c) => `<button class="chip chip--btn" aria-pressed="false" data-filter-cat="${esc(c.slug)}">${esc(c.name)}</button>`).join('')}
      </div>
      <div class="filter-group" role="group" aria-label="Filter by size">
        <button class="chip chip--btn" aria-pressed="true" data-filter-size="">All sizes</button>
        ${allSizes.map(({ sz, cat }) => `<button class="chip chip--btn" aria-pressed="false" data-filter-size="${esc(norm(sz))}" data-size-cat="${esc(cat)}">${esc(sizeShort(sz))}${nameTag(sz)}</button>`).join('')}
      </div>
    </div>
    ${ctx.products.length ? `<ul class="grid" data-grid>${ctx.products.map((p) => productCard(ctx, p)).join('')}</ul>
    <p class="empty" data-empty hidden>No towels match this filter yet. Try another size, or <a href="/contact/">ask us</a> about custom orders.</p>`
    : `<p class="empty">Our product list is being updated. <a href="/contact/">Contact us</a> for our current range.</p>`}
  </div>
</section>
${enquiryBand(ctx)}`;
  return layout(ctx, {
    title: 'Terry towels: bath, hand, face, baby towels and bath mats',
    description: `Browse terry towels made by ${ctx.settings.firmName}: bath towels, baby bath towels, hand towels, face towels and bath mats in standard inch sizes.`,
    path: '/towels/',
    active: 'towels',
    body,
    jsonld: [breadcrumbs(ctx, [['Home', '/'], ['Towels', '/towels/']])],
  });
}

export function categoryPage(ctx, cat) {
  const items = ctx.products.filter((p) => ctx.productCats(p).some((g) => g.cat.slug === cat.slug));
  const path = `/towels/${cat.slug}/`;
  const crumbs = [['Home', '/'], ['Towels', '/towels/'], [cat.name, path]];
  const body = `
<section class="page-head">
  <div class="wrap cat-head">
    <div>
      ${crumbNav(crumbs)}
      <h1 class="display display--page">${esc(cat.name)}</h1>
      <p class="lede">${esc(cat.description || '')}</p>
      <div class="filter-group" role="group" aria-label="Filter by size" data-filters>
        <button class="chip chip--btn" aria-pressed="true" data-filter-size="">All sizes</button>
        ${(cat.sizes || []).map((sz) => `<button class="chip chip--btn" aria-pressed="false" data-filter-size="${esc(norm(sz))}">${esc(sizeLabel(sz))}${nameTag(sz)}</button>`).join('')}
      </div>
    </div>
    <div class="cat-scale" aria-hidden="true">${(cat.sizes || []).map((sz) => sizeFigure(sz, '#34489c')).join('')}</div>
  </div>
</section>
<section class="section section--tight">
  <div class="wrap">
    ${items.length ? `<ul class="grid" data-grid>${items.map((p) => productCard(ctx, p, { cat })).join('')}</ul>
    <p class="empty" data-empty hidden>No ${esc(cat.name.toLowerCase())} in this size yet. <a href="/contact/">Ask us</a> about making it to order.</p>`
    : `<p class="empty">We are adding ${esc(cat.name.toLowerCase())} to the site. <a href="/contact/">Contact us</a> for the current range.</p>`}
  </div>
</section>
${catAbout(ctx, cat)}
${otherCats(ctx, cat)}
${enquiryBand(ctx)}`;
  return layout(ctx, {
    title: `${cat.name} Manufacturer in ${ctx.city || 'India'}, Wholesale ${(cat.sizes || []).map(sizeShort).join(', ')}`,
    description: `${cat.description || cat.name} Made by ${ctx.settings.firmName}, terry towel manufacturer since ${ctx.established}.`,
    path,
    active: 'towels',
    body,
    jsonld: [
      breadcrumbs(ctx, crumbs),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: cat.name,
        itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(ctx, `/products/${p.slug}/`), name: p.name })),
      },
    ],
  });
}

function catAbout(ctx, cat) {
  const s = ctx.settings;
  const sizes = (cat.sizes || []).map((sz) => `${sizeLabel(sz)}${sizeName(sz) ? ` (${sizeName(sz).toLowerCase()})` : ''}`).join(' and ');
  const lower = cat.name.toLowerCase();
  return `<section class="section section--tight">
  <div class="wrap narrow prose prose--guide">
    <h2>${esc(cat.name)} from ${esc(ctx.city || 'our factory')}</h2>
    <p>${esc(s.firmName)} manufactures terry ${esc(lower)} in ${esc(ctx.city || 'India')} in ${esc(sizes)} sizes, under our registered brand ${esc(s.brandName ? s.brandName + '®' : s.firmName)}. We supply ${esc(lower)} in bulk to ${esc(s.buyers || 'wholesalers, hotels and retailers')}, in ${esc((s.materials || []).slice(0, 4).join(', ').toLowerCase() || 'cotton')} and more.</p>
    <p>Each product page lists the weight for every size. For the full chart in inches and centimetres, see the <a href="/towel-size-guide/">towel size guide</a>. To understand weight, GSM and materials, read our <a href="/terry-towels/">terry towel guide</a>.</p>
  </div>
</section>`;
}

function otherCats(ctx, current) {
  const others = ctx.categories.filter((c) => c.slug !== current.slug);
  return `<section class="section section--tight">
  <div class="wrap">
    <h2 class="h3">More towel types</h2>
    <ul class="cat-links">${others.map((c) => `<li><a href="/towels/${esc(c.slug)}/"><span>${esc(c.name)}</span><span class="cat-links-sizes">${(c.sizes || []).map(sizeShort).join(', ')}</span></a></li>`).join('')}</ul>
  </div>
</section>`;
}

export function productPage(ctx, p) {
  const s = ctx.settings;
  const groups = ctx.productCats(p);
  const primary = groups[0]?.cat;
  const path = `/products/${p.slug}/`;
  const crumbs = [['Home', '/'], ['Towels', '/towels/']];
  if (primary?.slug) crumbs.push([primary.name, `/towels/${primary.slug}/`]);
  crumbs.push([p.name, path]);
  const first = (p.sizes || [])[0];
  const imgs = p.images || [];
  const sizeData = (p.sizes || []).map((sz) => {
    const d = parseSize(sz.size);
    const catName = ctx.sizeToCat.get(norm(sz.size))?.singular || '';
    const nm = sizeName(sz.size);
    return { key: norm(sz.size), label: sizeLabel(sz.size), cm: sizeCm(sz.size), weight: sz.weight || '', w: d?.w || 0, h: d?.h || 0, cat: catName, name: nm, note: nm ? `${nm} ${catName ? catName.toLowerCase() + ' ' : ''}size` : '' };
  });
  const msg = (size) => `Hello ${s.firmName}, I am interested in "${p.name}"${size ? ` in size ${size}` : ''}. Please share your best quotation.`;
  const sizeList = (p.sizes || []).map((x) => sizeShort(x.size) + nameParen(x.size)).join(', ');

  const gallery = imgs.length
    ? `<div class="gallery" data-gallery>
        <div class="gallery-main"><img src="${esc(imgs[0])}" alt="${esc(p.name)} by ${esc(s.brandName || s.firmName)}, ${esc(sizeList)} inches" width="1000" height="1250" data-gallery-main></div>
        ${imgs.length > 1 ? `<ul class="gallery-thumbs">${imgs.map((src, i) => `<li><button type="button" data-gallery-thumb="${esc(src)}" aria-label="Show photo ${i + 1}"${i === 0 ? ' aria-current="true"' : ''}><img src="${esc(src)}" alt="" loading="lazy" width="120" height="150"></button></li>`).join('')}</ul>` : ''}
      </div>`
    : `<div class="gallery"><div class="gallery-main gallery-main--swatch">${towelSwatch(p.colour, { label: p.name, cls: 'terry--fill' })}<p class="gallery-note">Photos coming soon</p></div></div>`;

  const body = `
<section class="page-head page-head--product">
  <div class="wrap">${crumbNav(crumbs)}</div>
</section>
<section class="section section--tight">
  <div class="wrap product" data-product data-sizes='${esc(JSON.stringify(sizeData))}' data-name="${esc(p.name)}">
    ${gallery}
    <div class="product-info">
      <p class="product-kind">${groups.map((g) => esc(g.cat.singular || g.cat.name)).join(', ')}</p>
      <h1 class="display display--product">${esc(p.name)}</h1>
      ${p.description ? `<p class="product-desc">${esc(p.description)}</p>` : ''}

      ${sizeData.length ? `<div class="size-picker">
        <h2 class="h4" id="size-h">Choose a size</h2>
        ${groups.map((g) => `<div class="size-group" role="group" aria-labelledby="size-h">
          <span class="size-group-name">${esc(g.cat.singular || g.cat.name)}</span>
          <div class="chips">${g.sizes.map((sz) => `<button type="button" class="chip chip--btn chip--size" data-size="${esc(norm(sz.size))}" aria-pressed="${sz === first ? 'true' : 'false'}">${esc(sizeLabel(sz.size))}${nameTag(sz.size)}</button>`).join('')}</div>
        </div>`).join('')}
        <div class="size-detail">
          <div class="size-scale" aria-hidden="true">
            <div class="size-scale-ref" title="36 × 72 in"></div>
            <div class="size-scale-towel" data-size-scale style="--w:${sizeData[0].w};--h:${sizeData[0].h}">${towelSwatch(p.colour, {})}</div>
          </div>
          <dl class="spec">
            <div><dt>Size</dt><dd data-size-label>${esc(sizeData[0].label)} <span class="muted">(${esc(sizeData[0].cm)})</span>${sizeData[0].note ? `<span class="size-note">${esc(sizeData[0].note)}</span>` : ''}</dd></div>
            <div data-weight-row ${sizeData[0].weight ? '' : 'hidden'}><dt>Weight</dt><dd data-size-weight>${esc(sizeData[0].weight)}</dd></div>
            ${p.material ? `<div><dt>Material</dt><dd>${esc(p.material)}</dd></div>` : ''}
            ${p.brand || s.brandName ? `<div><dt>Brand</dt><dd>${esc(p.brand || brandR(ctx))}</dd></div>` : ''}
            ${p.pattern ? `<div><dt>Pattern</dt><dd>${esc(p.pattern)}</dd></div>` : ''}
            <div><dt>Country of origin</dt><dd>${esc(p.origin || 'India')}</dd></div>
            ${p.moq ? `<div><dt>Minimum order</dt><dd>${esc(p.moq)}</dd></div>` : ''}
            <div><dt>Available sizes (inches)</dt><dd>${esc(sizeList)}</dd></div>
          </dl>
        </div>
      </div>` : ''}

      <div class="product-cta" data-cta data-msg-base="${esc(msg(''))}">
        ${quoteButtons(ctx, msg(first ? sizeLabel(first.size) + nameParen(first.size) : ''))}
        <p class="muted small">Prices depend on size, weight and quantity. Send your requirement and we will quote quickly.</p>
      </div>
    </div>
  </div>
</section>
${related(ctx, p, primary)}
${enquiryBand(ctx)}`;

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description || `${p.name} by ${s.firmName}. Available sizes: ${sizeList} inches.`,
    brand: { '@type': 'Brand', name: p.brand || s.brandName || s.firmName },
    manufacturer: { '@id': `${ctx.siteUrl}/#business` },
    category: groups.map((g) => g.cat.name).join(', '),
    url: abs(ctx, path),
  };
  if (imgs.length) productLd.image = imgs.map((i) => abs(ctx, i));
  if (p.material) productLd.material = p.material;
  if (p.pattern) productLd.pattern = p.pattern;
  productLd.countryOfOrigin = { '@type': 'Country', name: p.origin || 'India' };
  if (sizeList) productLd.size = `${sizeList} in`;

  const title = primary?.singular && !p.name.toLowerCase().includes(primary.singular.toLowerCase()) ? `${p.name}, ${primary.singular.toLowerCase()}` : p.name;
  return layout(ctx, {
    title,
    description: `${p.name} in ${sizeList} inch sizes${p.material ? `, ${p.material}` : ''}. ${p.description || ''}`.trim().slice(0, 158),
    path,
    active: 'towels',
    image: imgs[0],
    body,
    jsonld: [productLd, breadcrumbs(ctx, crumbs)],
  });
}

function related(ctx, p, cat) {
  if (!cat?.slug) return '';
  const items = ctx.products
    .filter((x) => x.slug !== p.slug && ctx.productCats(x).some((g) => g.cat.slug === cat.slug))
    .slice(0, 4);
  if (!items.length) return '';
  return `<section class="section section--tight">
  <div class="wrap">
    <div class="section-head section-head--row"><h2 class="h3">More ${esc(cat.name.toLowerCase())}</h2><a class="text-link" href="/towels/${esc(cat.slug)}/">View all</a></div>
    <ul class="grid">${items.map((x) => productCard(ctx, x, { cat })).join('')}</ul>
  </div>
</section>`;
}

export function aboutPage(ctx) {
  const paras = paragraphs(ctx.settings.about);
  const body = `
<section class="page-head">
  <div class="wrap">
    ${crumbNav([['Home', '/'], ['About us', '/about/']])}
    <h1 class="display display--page">Our story</h1>
    <p class="lede">Cotton textile manufacturers since ${ctx.established}, terry towel specialists today.</p>
  </div>
</section>
<section class="section section--tight">
  <div class="wrap about-grid">
    <div class="prose">${paras.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    <aside class="about-aside">
      <h2 class="h3">Our journey</h2>
      ${timeline(ctx)}
    </aside>
  </div>
</section>
${ratingCards(ctx) ? `<section class="section"><div class="wrap"><div class="section-head"><h2 class="h2">Rated by our buyers</h2></div>${ratingCards(ctx)}</div></section>` : ''}
${enquiryBand(ctx)}`;
  return layout(ctx, {
    title: 'About us: terry towel manufacturer since ' + ctx.established,
    description: `The story of ${ctx.settings.firmName}: established in ${ctx.established} with a grey cotton plant, then chaddars, and now specialist terry towel manufacturers.`,
    path: '/about/',
    active: 'about',
    body,
    jsonld: [orgJsonLd(ctx), breadcrumbs(ctx, [['Home', '/'], ['About us', '/about/']])],
  });
}

export function contactPage(ctx) {
  const s = ctx.settings;
  const addr = [s.addressLine, [s.city, s.state].filter(Boolean).join(', '), s.pincode, s.country].filter(Boolean).join(', ');
  const wa = waLink(s, 'Hello');
  const isEmbed = /google\.[^/]+\/maps\/embed/.test(s.mapUrl || '');
  const options = ctx.categories.flatMap((c) => (c.sizes || []).map((sz) => `${c.singular} ${sizeLabel(sz)}${nameParen(sz)}`));
  const body = `
<section class="page-head">
  <div class="wrap">
    ${crumbNav([['Home', '/'], ['Contact', '/contact/']])}
    <h1 class="display display--page">Ask for a quotation</h1>
    <p class="lede">Tell us the towel type, size and quantity you need. We reply quickly with our best price.</p>
  </div>
</section>
<section class="section section--tight">
  <div class="wrap contact-grid">
    <form class="form" data-enquiry data-wa="${esc(wa ? wa.split('?')[0] : '')}" data-email="${esc(s.email || '')}" data-firm="${esc(s.firmName)}">
      <div class="field"><label for="f-name">Your name</label><input id="f-name" name="name" autocomplete="name" required></div>
      <div class="field"><label for="f-company">Company or shop name</label><input id="f-company" name="company" autocomplete="organization"></div>
      <div class="field"><label for="f-city">City</label><input id="f-city" name="city" autocomplete="address-level2"></div>
      <div class="field"><label for="f-product">Towel and size</label>
        <input id="f-product" name="product" list="f-product-list" placeholder="For example, Bath towel 30 × 60 in">
        <datalist id="f-product-list">${options.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>
      </div>
      <div class="field"><label for="f-qty">Quantity</label><input id="f-qty" name="qty" placeholder="For example, 500 pieces"></div>
      <div class="field field--wide"><label for="f-msg">Anything else</label><textarea id="f-msg" name="message" rows="4" placeholder="Colour, weight, pattern, delivery location"></textarea></div>
      <div class="field--wide btn-row">
        ${wa ? `<button class="btn btn--primary" type="submit" name="via" value="wa">${waIcon()}Send on WhatsApp</button>` : ''}
        ${s.email ? `<button class="btn ${wa ? 'btn--ghost' : 'btn--primary'}" type="submit" name="via" value="email">Send by email</button>` : ''}
        ${!wa && !s.email ? `<p class="muted">Contact details will appear here soon.</p>` : ''}
      </div>
    </form>
    <aside class="contact-card">
      <h2 class="h3">${esc(s.firmName)}</h2>
      <dl class="spec spec--stack">
        ${s.phone ? `<div><dt>Phone</dt><dd><a href="tel:${esc(s.phone.replace(/\s+/g, ''))}">${esc(s.phone)}</a></dd></div>` : ''}
        ${wa ? `<div><dt>WhatsApp</dt><dd><a href="${esc(wa)}" target="_blank" rel="noopener">Chat with us</a></dd></div>` : ''}
        ${s.email ? `<div><dt>Email</dt><dd><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></dd></div>` : ''}
        ${addr ? `<div><dt>Address</dt><dd>${esc(addr)}</dd></div>` : ''}
        ${s.hours ? `<div><dt>Hours</dt><dd>${esc(s.hours)}</dd></div>` : ''}
        ${s.gstin ? `<div><dt>GSTIN</dt><dd>${esc(s.gstin)}</dd></div>` : ''}
      </dl>
      ${s.mapUrl && !isEmbed ? `<a class="text-link" href="${esc(s.mapUrl)}" target="_blank" rel="noopener">Open in Google Maps</a>` : ''}
    </aside>
  </div>
  ${isEmbed ? `<div class="wrap"><iframe class="map" src="${esc(s.mapUrl)}" title="Map to ${esc(s.firmName)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : ''}
</section>
${ratingCards(ctx) ? `<section class="section"><div class="wrap"><div class="section-head"><h2 class="h2">Rated by our buyers</h2></div>${ratingCards(ctx)}</div></section>` : ''}`;
  return layout(ctx, {
    title: 'Contact us for a terry towel quotation',
    description: `Contact ${s.firmName}${ctx.city ? `, ${ctx.city}` : ''} for wholesale terry towel quotations. Bath towels, hand towels, face towels, baby towels and bath mats.`,
    path: '/contact/',
    active: 'contact',
    body,
    jsonld: [orgJsonLd(ctx), breadcrumbs(ctx, [['Home', '/'], ['Contact', '/contact/']])],
  });
}

export function notFoundPage(ctx) {
  const body = `<section class="page-head page-head--center"><div class="wrap">
    <h1 class="display display--page">This page isn't here</h1>
    <p class="lede">The towel or page you were looking for may have moved or been removed.</p>
    <div class="btn-row"><a class="btn btn--primary" href="/towels/">See all towels</a><a class="btn btn--ghost" href="/">Go to the home page</a></div>
  </div></section>`;
  return layout(ctx, { title: 'Page not found', path: '/404', body, noindex: true });
}

// =====================================================================
// Guide pages for search: Solapur towels, terry towel guide, size guide, hotel towels
// =====================================================================

const strip = (html) => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export const GUIDES = [
  ['/solapur-towels/', 'Solapur towels', 'Terry towels made in Solapur, Maharashtra, home of the GI-tagged Solapur Terry Towel.'],
  ['/terry-towels/', 'Terry towel guide', 'Weight, GSM, materials and patterns explained.'],
  ['/towel-size-guide/', 'Towel size guide', 'Every towel size in inches and centimetres.'],
  ['/hotel-towels/', 'Hotel towels', 'Room sets of bath, hand and face towels and bath mats in bulk.'],
];

function faqBlock(faq) {
  if (!faq?.length) return '';
  return `<section class="section section--tight" aria-labelledby="faq-h">
  <div class="wrap narrow">
    <h2 id="faq-h" class="h2">Questions buyers ask</h2>
    <div class="faq">${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><div class="faq-a">${a}</div></details>`).join('')}</div>
  </div>
</section>`;
}

function faqLd(faq) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: strip(a) } })),
  };
}

function guideLinks(ctx, currentPath) {
  const items = GUIDES.filter(([p]) => p !== currentPath);
  return `<section class="section section--tight">
  <div class="wrap">
    <h2 class="h3">More buying guides</h2>
    <ul class="cat-links">${items.map(([p, name, d]) => `<li><a href="${p}"><span>${esc(name)}</span><span class="cat-links-sizes">${esc(d)}</span></a></li>`).join('')}</ul>
  </div>
</section>`;
}

function guidePage(ctx, { path, crumb, title, description, h1, lede, body, faq = [], extraLd = [] }) {
  const crumbs = [['Home', '/'], [crumb, path]];
  const html = `
<section class="page-head">
  <div class="wrap">
    ${crumbNav(crumbs)}
    <h1 class="display display--page">${esc(h1)}</h1>
    <p class="lede">${lede}</p>
  </div>
</section>
<section class="section section--tight">
  <div class="wrap narrow prose prose--guide">${body}</div>
</section>
${faqBlock(faq)}
${guideLinks(ctx, path)}
${enquiryBand(ctx)}`;
  const ld = [breadcrumbs(ctx, crumbs), ...extraLd];
  if (faq.length) ld.push(faqLd(faq));
  return layout(ctx, { title, description, path, body: html, jsonld: ld, active: path === '/towel-size-guide/' ? 'sizes' : '' });
}

function sizeTable(ctx) {
  return `<div class="table-wrap"><table class="size-table">
    <thead><tr><th scope="col">Towel</th><th scope="col">Size (inches)</th><th scope="col">Size (cm)</th></tr></thead>
    <tbody>${ctx.categories.map((c) => (c.sizes || []).map((sz, i) => `<tr>
      ${i === 0 ? `<th scope="rowgroup" rowspan="${c.sizes.length}"><a href="/towels/${esc(c.slug)}/">${esc(c.name)}</a></th>` : ''}
      <td>${esc(sizeLabel(sz))}${nameTag(sz)}</td><td>${esc(sizeCm(sz))}</td>
    </tr>`).join('')).join('')}</tbody>
  </table></div>`;
}

function catList(ctx) {
  return `<ul class="tick-list">${ctx.categories.map((c) => `<li><a href="/towels/${esc(c.slug)}/">${esc(c.name)}</a>: ${(c.sizes || []).map((sz) => esc(sizeLabel(sz) + nameParen(sz))).join(', ')}</li>`).join('')}</ul>`;
}

function waText(ctx, text) {
  const wa = waLink(ctx.settings, text);
  return wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : '<a href="/contact/">WhatsApp</a>';
}

export function solapurPage(ctx) {
  const s = ctx.settings;
  const brand = s.brandName ? `${s.brandName}®` : s.firmName;
  const im = s.indiamartUrl ? `<a href="${esc(s.indiamartUrl)}" target="_blank" rel="noopener">IndiaMART</a>` : 'IndiaMART';
  const body = `
<h2>Why Solapur is known for towels</h2>
<p>Solapur in Maharashtra is one of India's best-known centres for terry towels and chaddars. Its towel-making heritage is protected by law: <strong>Solapur Terry Towel</strong> is a registered Geographical Indication (GI) of India, registered in 2005, alongside Solapuri Chaddar.</p>
<p>Generations of Solapur weavers, dyers and finishers have built skills in terry weaving, so buyers across India look to Solapur for towels with good absorbency, strong borders and dependable quality.</p>

<h2>A Solapur towel manufacturer since ${ctx.established}</h2>
<p>${esc(s.firmName)} started in Solapur in ${ctx.established} with a grey cotton fabric plant, grew into chaddars and then terry towels, and today is a manufacturer and wholesaler of towels. We sell under our registered brand ${esc(brand)}.</p>
<p>You will find us ${s.addressLine ? `at ${esc(s.addressLine)}, ` : 'in '}${esc(s.city || 'Solapur')}. Buyers on IndiaMART rate us 5.0 out of 5, with more than 150 trusted customers.</p>

<h2>Solapur towels we make</h2>
${catList(ctx)}
<p>See the <a href="/towels/">full towel range</a>, or check every size in our <a href="/towel-size-guide/">towel size guide</a>.</p>

<h2>Why buy direct from a Solapur manufacturer</h2>
<ul class="tick-list">
  <li><strong>Factory prices.</strong> Our buying power and tight control of overheads keep our rates competitive.</li>
  <li><strong>Uniform quality.</strong> Our experienced team checks each stage, so every batch matches the last.</li>
  <li><strong>Choice.</strong> Standard and large bath towels, baby, hand and face towels and bath mats, in cotton and blended yarns, plain, dobby border, jacquard, striped and more.</li>
  <li><strong>Quick quotations.</strong> We reply on WhatsApp in ${esc(s.languages || 'English, Marathi, Hindi and Telugu')}.</li>
</ul>

<h2>How to order Solapur towels from us</h2>
<ol class="steps">
  <li>Choose the towel type and size from <a href="/towels/">our towels</a>.</li>
  <li>Send the towel, size, quantity and delivery city on ${waText(ctx, `Hello ${s.firmName}, I want to buy Solapur towels.`)} or ${im}.</li>
  <li>We reply quickly with our best quotation.</li>
</ol>

<div class="lang-block">
  <p lang="mr"><strong>सोलापूरमधील टॉवेल उत्पादक.</strong> विजयलक्ष्मी टेक्सटाईल्स (शेगुर्स), १९८२ पासून. घाऊक टेरी टॉवेलसाठी आम्हाला WhatsApp करा.</p>
  <p lang="hi"><strong>सोलापुर के टॉवेल निर्माता.</strong> विजयलक्ष्मी टेक्सटाइल्स (शेगुर्स), 1982 से. थोक में टेरी टॉवेल के लिए हमें WhatsApp करें।</p>
</div>`;

  const faq = [
    ['Are you a manufacturer or a trader?', `<p>We are a manufacturer and wholesaler of terry towels in Solapur, established in ${ctx.established}. We also supply selected microfiber towels.</p>`],
    ['Who do you supply?', `<p>Wholesalers, hotels and retailers. Tell us your quantity and we will quote.</p>`],
    ['What is the standard bath towel size?', `<p>30 × 60 inches (76 × 152 cm) is the standard bath towel size. 36 × 72 inches (91 × 183 cm) is the large size. See the <a href="/towel-size-guide/">size guide</a>.</p>`],
    ['What is the minimum order quantity?', `<p>It depends on the towel and size. Send your requirement on ${waText(ctx, `Hello ${s.firmName}, what is your minimum order quantity?`)} and we will confirm.</p>`],
    ['How do I get your price list?', `<p>Prices depend on size, weight and quantity. Message us on ${waText(ctx, `Hello ${s.firmName}, please share your towel price list.`)} or ${im} with your requirement.</p>`],
    ['What is your brand name?', `<p>${esc(brand)} is the registered brand of ${esc(s.firmName)}.</p>`],
  ];

  return guidePage(ctx, {
    path: '/solapur-towels/',
    crumb: 'Solapur towels',
    title: 'Solapur Towels: Terry Towel Manufacturer in Solapur since ' + ctx.established,
    description: `Buy Solapur terry towels direct from ${s.firmName} (${s.brandName || ''}), a towel manufacturer and wholesaler in Solapur since ${ctx.established}. Bath, hand, face, baby towels and bath mats.`,
    h1: 'Solapur towels, direct from a Solapur manufacturer',
    lede: `${esc(s.firmName)} has made cotton textiles in Solapur since ${ctx.established}. Buy terry towels direct from the maker, under our registered brand ${esc(brand)}.`,
    body,
    faq,
  });
}

export function terryGuidePage(ctx) {
  const s = ctx.settings;
  const body = `
<h2>What is a terry towel?</h2>
<p>Terry is a fabric woven with uncut loops of yarn standing up from the surface, usually on both sides. Those loops add surface area, so a terry towel soaks up water far better than flat-woven cloth. Nearly all bath, hand and face towels are terry.</p>

<h2>Towel weight and GSM</h2>
<p>GSM means grams per square metre. It tells you how dense the towel is, regardless of its size. As a general guide:</p>
<ul class="tick-list">
  <li><strong>Light, about 300–400 GSM:</strong> thin, dries fast, lowest cost. Good for gyms, salons, promotions and hot weather.</li>
  <li><strong>Medium, about 400–600 GSM:</strong> the everyday choice for homes and most hotels.</li>
  <li><strong>Heavy, 600 GSM and above:</strong> thick and plush, slower to dry, a premium feel.</li>
</ul>
<p>Many buyers in India order by <strong>weight per piece</strong> instead, for example a 30 × 60 bath towel of a certain number of grams. We list the weight for each size on our product pages, and can quote by GSM or by weight per piece.</p>

<h2>Materials</h2>
<p>We work with ${esc((s.materials || []).join(', ') || '100% cotton and blended yarns')}. Pure cotton is the most absorbent and the softest against skin. Blended and filament yarns can lower the price and add strength and sheen. Microfiber towels are very light and dry quickly.</p>

<h2>Patterns and borders</h2>
<ul class="tick-list">
  <li><strong>Plain:</strong> one colour, simple and easy to match.</li>
  <li><strong>Dobby border:</strong> a woven band near each end. A classic for hotels and homes.</li>
  <li><strong>Jacquard:</strong> designs woven into the towel itself, so they never wash out.</li>
  <li><strong>Striped and checks:</strong> yarn-dyed patterns that stay bright.</li>
  <li><strong>Printed:</strong> designs printed on the surface, good for bright colours and character designs.</li>
</ul>

<h2>Choosing the right size</h2>
<p>30 × 60 inches is the standard bath towel and 36 × 72 inches is the large size. Hand towels are usually 16 × 24 or 14 × 21 inches, and face towels 12 × 18 or 12 × 12 inches. See every size in centimetres in the <a href="/towel-size-guide/">towel size guide</a>.</p>

<h2>Caring for terry towels</h2>
<ul class="tick-list">
  <li>Wash new towels before first use to remove finishing agents and improve absorbency.</li>
  <li>Wash dark colours separately for the first few washes.</li>
  <li>Use fabric softener sparingly. It coats the loops and reduces absorbency.</li>
  <li>Dry fully before folding to keep towels fresh.</li>
</ul>`;
  const faq = [
    ['Which is better, a heavier or a lighter towel?', '<p>Neither is better for everyone. Heavier towels feel plush and absorb more, while lighter towels dry faster and cost less. Choose by use: everyday home and hotel use suits medium weights.</p>'],
    ['Do terry towels shrink?', '<p>Cotton terry can shrink slightly in the first washes, especially in hot water or a hot dryer. Washing in warm water and avoiding very high dryer heat helps.</p>'],
    ['Why does a new towel not absorb well?', '<p>New towels carry finishing agents from manufacturing. One or two washes remove them and the towel absorbs much better.</p>'],
    ['Can you make towels in a specific weight or colour?', `<p>Tell us the size, weight, colour and quantity on ${waText(ctx, `Hello ${s.firmName}, I need towels in a specific weight and colour.`)} and we will tell you what we can make.</p>`],
  ];
  return guidePage(ctx, {
    path: '/terry-towels/',
    crumb: 'Terry towel guide',
    title: "Terry Towels: Buyer's Guide to Weight, GSM, Material and Size",
    description: 'What terry towels are, how GSM and weight work, which materials and patterns to choose, standard sizes and care tips. From a Solapur terry towel manufacturer.',
    h1: "Terry towels: a buyer's guide",
    lede: `How to choose terry towels by weight, material, pattern and size, from a Solapur manufacturer making towels since ${ctx.established}.`,
    body,
    faq,
  });
}

export function sizeGuidePage(ctx) {
  const s = ctx.settings;
  const body = `
<h2>Towel sizes at a glance</h2>
<p>All our sizes are in inches. Centimetres are rounded to the nearest whole number.</p>
${sizeTable(ctx)}

<h2>Standard bath towel size</h2>
<p><strong>30 × 60 inches (76 × 152 cm)</strong> is the standard bath towel size in India and the most popular size with homes, hotels and retailers. It wraps comfortably around most adults.</p>
<p><strong>36 × 72 inches (91 × 183 cm)</strong> is the large bath towel, sometimes called a bath sheet. It suits taller people, premium hotel rooms and anyone who wants full coverage.</p>

<h2>Baby bath towel sizes</h2>
<p>24 × 48 and 20 × 40 inches are sized for babies and young children. They are easier to handle than full-size towels and dry quickly.</p>

<h2>Hand and face towel sizes</h2>
<p>Hand towels of 16 × 24 or 14 × 21 inches are used in washrooms, kitchens, salons and offices. Face towels of 12 × 18 or 12 × 12 inches work as face cloths, napkins and wash cloths.</p>

<h2>Bath mat size</h2>
<p>20 × 30 inches is the standard terry bath mat, made dense and heavy to stay in place on the floor.</p>

<h2>Need another size?</h2>
<p>Send the size and quantity you need on ${waText(ctx, `Hello ${s.firmName}, I need towels in a custom size.`)} and we will tell you what we can make.</p>`;
  const faq = [
    ['What is the standard size of a bath towel?', '<p>30 × 60 inches (76 × 152 cm).</p>'],
    ['What size is a large bath towel?', '<p>36 × 72 inches (91 × 183 cm), also called a bath sheet.</p>'],
    ['What is the size of a hand towel?', '<p>16 × 24 inches (41 × 61 cm) or 14 × 21 inches (36 × 53 cm).</p>'],
    ['What is the size of a face towel?', '<p>12 × 18 inches (30 × 46 cm) or 12 × 12 inches (30 × 30 cm).</p>'],
    ['What size is a baby bath towel?', '<p>24 × 48 inches (61 × 122 cm) or 20 × 40 inches (51 × 102 cm).</p>'],
  ];
  return guidePage(ctx, {
    path: '/towel-size-guide/',
    crumb: 'Towel size guide',
    title: 'Towel Size Guide: Standard Bath, Hand, Face Towel Sizes in Inches and cm',
    description: 'Standard bath towel size is 30 × 60 inches. Full chart of bath, large bath, baby, hand and face towel and bath mat sizes in inches and centimetres.',
    h1: 'Towel size guide',
    lede: 'Every towel size we make, in inches and centimetres, with what each size is used for.',
    body,
    faq,
  });
}

export function hotelPage(ctx) {
  const s = ctx.settings;
  const body = `
<h2>A standard hotel room set</h2>
<p>Most hotels stock each room with a set like this. We make every piece in Solapur, so you can order the full set from one supplier.</p>
<div class="table-wrap"><table class="size-table">
  <thead><tr><th scope="col">Item</th><th scope="col">Size (inches)</th><th scope="col">Typical use</th></tr></thead>
  <tbody>
    <tr><th scope="row"><a href="/towels/bath-towels/">Bath towel</a></th><td>30 × 60 <span class="size-name">Standard</span> or 36 × 72 <span class="size-name">Large</span></td><td>One or two per guest</td></tr>
    <tr><th scope="row"><a href="/towels/hand-towels/">Hand towel</a></th><td>16 × 24</td><td>One per guest</td></tr>
    <tr><th scope="row"><a href="/towels/face-towels/">Face towel</a></th><td>12 × 12</td><td>One per guest</td></tr>
    <tr><th scope="row"><a href="/towels/bath-mats/">Bath mat</a></th><td>20 × 30</td><td>One per bathroom</td></tr>
  </tbody>
</table></div>

<h2>Choosing hotel towels</h2>
<ul class="tick-list">
  <li><strong>Design:</strong> plain and dobby-border towels in white or light colours are the hotel favourite. They look clean and are easy to match across rooms.</li>
  <li><strong>Weight:</strong> medium weights suit most hotels and wash well. Heavier towels give premium rooms a plush feel. See our <a href="/terry-towels/">terry towel guide</a>.</li>
  <li><strong>Material:</strong> cotton absorbs best. Blends can lower the price per piece.</li>
  <li><strong>Stock:</strong> many hotels keep three sets per room: one in use, one in the laundry and one in store.</li>
</ul>

<h2>Bulk hotel towels from Solapur</h2>
<p>${esc(s.firmName)} has manufactured textiles in Solapur since ${ctx.established} and supplies wholesalers, hotels and retailers. Send your room count, sizes and preferred weight on ${waText(ctx, `Hello ${s.firmName}, I need towels for a hotel.`)} and we will reply with a quotation.</p>`;
  const faq = [
    ['What size towels do hotels use?', '<p>Usually a 30 × 60 inch bath towel (or 36 × 72 inch in premium rooms), a 16 × 24 inch hand towel, a 12 × 12 inch face towel and a 20 × 30 inch bath mat.</p>'],
    ['How many towels does a hotel need per room?', '<p>A common rule is three full sets per room: one in use, one in the laundry and one in store.</p>'],
    ['Can you supply all sizes together?', `<p>Yes. We make bath, hand and face towels and bath mats, so the whole room set can come from us. Send your requirement on ${waText(ctx, `Hello ${s.firmName}, I need complete hotel towel sets.`)}.</p>`],
  ];
  return guidePage(ctx, {
    path: '/hotel-towels/',
    crumb: 'Hotel towels',
    title: 'Hotel Towels in Bulk: Bath, Hand, Face Towels and Bath Mats from Solapur',
    description: `Hotel towel sets direct from a Solapur manufacturer: bath towels 30×60 and 36×72, hand towels, face towels and bath mats in bulk. ${s.firmName}, since ${ctx.established}.`,
    h1: 'Hotel towels in bulk, made in Solapur',
    lede: 'Complete room sets of bath, hand and face towels and bath mats, direct from the manufacturer.',
    body,
    faq,
  });
}
