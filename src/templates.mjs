import { esc, parseSize, sizeLabel, sizeShort, sizeCm, waLink, paragraphs } from './lib.mjs';

// ---------- shared context ----------

export function makeContext({ settings, categories, products, cssVersion, jsVersion }) {
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
    cssVersion, jsVersion, sizeToCat, productCats,
    city: settings.city ? String(settings.city) : '',
  };
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
    return `<img src="${esc(img)}" alt="${esc(p.name)}" loading="${large ? 'eager' : 'lazy'}" decoding="async" width="800" height="1000">`;
  }
  return towelSwatch(p.colour, { label: p.name, cls: 'terry--fill' });
}

function stars(rating, id) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  const pct = (r / 5) * 100;
  const star = (i) => `<path transform="translate(${i * 24} 0)" d="M12 1.8l3.1 6.4 7 1-5.1 4.9 1.2 7-6.2-3.3-6.2 3.3 1.2-7L1.9 9.2l7-1z"/>`;
  return `<svg class="stars" viewBox="0 0 120 24" aria-hidden="true"><defs><linearGradient id="g${id}"><stop offset="${pct}%" stop-color="var(--turmeric)"/><stop offset="${pct}%" stop-color="var(--line)"/></linearGradient></defs><g fill="url(#g${id})">${[0, 1, 2, 3, 4].map(star).join('')}</g></svg>`;
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
    ${caption ? `<figcaption>${esc(sizeShort(size))}</figcaption>` : ''}
  </figure>`;
}

function sizeChips(sizes, { href } = {}) {
  return `<ul class="chips">${sizes
    .map((s) => `<li>${href ? `<a class="chip" href="${esc(href(s))}">${esc(sizeShort(s.size || s))}</a>` : `<span class="chip">${esc(sizeShort(s.size || s))}</span>`}</li>`)
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
  const fullTitle = title ? `${title} | ${s.firmName}` : `${s.firmName} | ${s.tagline}`;
  const desc = description || s.seoDescription;
  const canonical = abs(ctx, path);
  const ogImage = image ? (image.startsWith('http') ? image : abs(ctx, image)) : abs(ctx, '/og-image.png');
  const nav = [
    ['towels', '/towels/', 'Towels'],
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Rozha+One&display=swap">
<link rel="stylesheet" href="/assets/site.css?v=${ctx.cssVersion}">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/" aria-label="${esc(s.firmName)} home">
      ${logoMark()}
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
<script src="/assets/site.js?v=${ctx.jsVersion}" defer></script>
</body>
</html>`;
}

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
  if (s.flipkartUrl) profiles.push(['Flipkart', s.flipkartUrl]);
  return `<footer class="site-footer">
  <div class="border-band" aria-hidden="true"></div>
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <a class="brand brand--light" href="/">${logoMark()}<span class="brand-text"><span class="brand-name">${esc(s.firmName)}</span><span class="brand-sub">Terry towels since ${ctx.established}</span></span></a>
      <p>Manufacturers of terry bath towels, baby bath towels, hand towels, face towels and bath mats${ctx.city ? ` in ${esc(ctx.city)}` : ''}.</p>
    </div>
    <div>
      <h2 class="footer-h">Towels</h2>
      <ul>${ctx.categories.map((c) => `<li><a href="/towels/${esc(c.slug)}/">${esc(c.name)}</a></li>`).join('')}</ul>
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
    <p>© ${ctx.year} ${esc(s.firmName)}. All sizes are in inches.</p>
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
    knowsAbout: ['Terry towels', 'Bath towels', 'Hand towels', 'Face towels', 'Baby bath towels', 'Bath mats', 'Towel manufacturing'],
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

export function homePage(ctx, layoutName) {
  const s = ctx.settings;
  const variant = layoutName || s.homeLayout || 'loom';
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
    return `<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <h1 class="display">Terry towels, made${cityIn} since ${ctx.established}.</h1>
      <p class="lede">${lede}</p>
      ${heroButtons}
      ${facts}
    </div>
    <div class="hero-stack" aria-hidden="true">
      ${stack.map((c, i) => `<div class="fold" style="--c:${c};--i:${i}"><span class="terry-band"></span></div>`).join('')}
    </div>
  </div>
</section>`;
  };

  const heroShowroom = () => `<section class="hero-show">
  <div class="hero-show-cloth terry" style="--c:#1d2a5c" aria-hidden="true"><span class="terry-band"></span><span class="terry-band terry-band--low"></span></div>
  <div class="wrap hero-show-inner">
    <p class="hero-show-kicker">${esc(s.businessType || 'Terry towel manufacturer')}${cityIn}</p>
    <h1 class="display display--show">Towels woven for trade, since ${ctx.established}.</h1>
    <p class="lede lede--light">${lede}</p>
    <div class="btn-row">
      <a class="btn btn--light" href="/towels/">See our towels</a>
      <a class="btn btn--ghost-light" href="/contact/">Ask for a quotation</a>
    </div>
  </div>
  ${ratingCards(ctx) ? `<div class="wrap hero-show-trust">${ratingCards(ctx)}</div>` : ''}
</section>`;

  const heroHeritage = () => `<section class="hero-heritage">
  <div class="wrap heritage-grid">
    <div>
      <p class="heritage-year" aria-hidden="true">${ctx.established}</p>
      <h1 class="display display--heritage">${ctx.yearsActive} years of cotton, now devoted to towels.</h1>
      <p class="lede">${lede}</p>
      ${heroButtons}
    </div>
    <div class="heritage-side">
      <h2 class="h3">How we got here</h2>
      ${timeline(ctx)}
    </div>
  </div>
  <div class="border-band" aria-hidden="true"></div>
</section>`;

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
    loom: [heroLoom, scaleSection, featuredSection, storySection, trustSection],
    showroom: [heroShowroom, catTiles, featuredSection, valuesSection],
    heritage: [heroHeritage, featuredSection, scaleSection, trustSection, valuesSection],
  };
  const body = (orders[variant] || orders.loom).map((f) => f()).join('\n') + '\n' + enquiryBand(ctx);

  return layout(ctx, {
    title: '',
    description: s.seoDescription,
    path: '/',
    body,
    jsonld: [orgJsonLd(ctx), { '@context': 'https://schema.org', '@type': 'WebSite', name: s.firmName, url: `${ctx.siteUrl}/` }],
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
  const allSizes = ctx.categories.flatMap((c) => c.sizes || []);
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
        ${allSizes.map((sz) => `<button class="chip chip--btn" aria-pressed="false" data-filter-size="${esc(norm(sz))}">${esc(sizeShort(sz))}</button>`).join('')}
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
        ${(cat.sizes || []).map((sz) => `<button class="chip chip--btn" aria-pressed="false" data-filter-size="${esc(norm(sz))}">${esc(sizeLabel(sz))}</button>`).join('')}
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
${otherCats(ctx, cat)}
${enquiryBand(ctx)}`;
  return layout(ctx, {
    title: `${cat.name} manufacturer${ctx.city ? ` in ${ctx.city}` : ''}`,
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
    return { key: norm(sz.size), label: sizeLabel(sz.size), cm: sizeCm(sz.size), weight: sz.weight || '', w: d?.w || 0, h: d?.h || 0, cat: ctx.sizeToCat.get(norm(sz.size))?.singular || '' };
  });
  const msg = (size) => `Hello ${s.firmName}, I am interested in "${p.name}"${size ? ` in size ${size}` : ''}. Please share your best quotation.`;
  const sizeList = (p.sizes || []).map((x) => sizeShort(x.size)).join(', ');

  const gallery = imgs.length
    ? `<div class="gallery" data-gallery>
        <div class="gallery-main"><img src="${esc(imgs[0])}" alt="${esc(p.name)}" width="1000" height="1250" data-gallery-main></div>
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
          <div class="chips">${g.sizes.map((sz) => `<button type="button" class="chip chip--btn chip--size" data-size="${esc(norm(sz.size))}" aria-pressed="${sz === first ? 'true' : 'false'}">${esc(sizeLabel(sz.size))}</button>`).join('')}</div>
        </div>`).join('')}
        <div class="size-detail">
          <div class="size-scale" aria-hidden="true">
            <div class="size-scale-ref" title="36 × 72 in"></div>
            <div class="size-scale-towel" data-size-scale style="--w:${sizeData[0].w};--h:${sizeData[0].h}">${towelSwatch(p.colour, {})}</div>
          </div>
          <dl class="spec">
            <div><dt>Size</dt><dd data-size-label>${esc(sizeData[0].label)} <span class="muted">(${esc(sizeData[0].cm)})</span></dd></div>
            <div data-weight-row ${sizeData[0].weight ? '' : 'hidden'}><dt>Weight</dt><dd data-size-weight>${esc(sizeData[0].weight)}</dd></div>
            ${p.material ? `<div><dt>Material</dt><dd>${esc(p.material)}</dd></div>` : ''}
            ${p.pattern ? `<div><dt>Pattern</dt><dd>${esc(p.pattern)}</dd></div>` : ''}
            <div><dt>Country of origin</dt><dd>${esc(p.origin || 'India')}</dd></div>
            ${p.moq ? `<div><dt>Minimum order</dt><dd>${esc(p.moq)}</dd></div>` : ''}
            <div><dt>Available sizes</dt><dd>${esc(sizeList)} in</dd></div>
          </dl>
        </div>
      </div>` : ''}

      <div class="product-cta" data-cta data-msg-base="${esc(msg(''))}">
        ${quoteButtons(ctx, msg(first ? sizeLabel(first.size) : ''))}
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
    brand: { '@type': 'Brand', name: s.firmName },
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
  const options = ctx.categories.flatMap((c) => (c.sizes || []).map((sz) => `${c.singular} ${sizeLabel(sz)}`));
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
