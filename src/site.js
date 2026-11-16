(() => {
  // mobile nav
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });
  }

  // filters on listing pages
  const grid = document.querySelector('[data-grid]');
  if (grid) {
    const state = { cat: '', size: '' };
    const params = new URLSearchParams(location.search);
    if (params.get('size')) state.size = params.get('size');
    if (params.get('type')) state.cat = params.get('type');
    const empty = document.querySelector('[data-empty]');
    // sizes that belong to each towel type, read from the size buttons
    const catSizes = {};
    document.querySelectorAll('[data-size-cat]').forEach((b) => {
      (catSizes[b.dataset.sizeCat] ||= []).push(b.dataset.filterSize);
    });
    const apply = () => {
      const allowed = state.cat && catSizes[state.cat] ? catSizes[state.cat] : null;
      if (allowed && state.size && !allowed.includes(state.size)) state.size = '';
      let shown = 0;
      grid.querySelectorAll('.card').forEach((card) => {
        const okCat = !state.cat || card.dataset.cats.split(' ').includes(state.cat);
        const okSize = !state.size || card.dataset.sizes.split(' ').includes(state.size);
        card.hidden = !(okCat && okSize);
        if (!card.hidden) shown++;
        // on each card, show only the sizes of the chosen type
        card.querySelectorAll('[data-chip-size]').forEach((li) => {
          li.hidden = !!allowed && !allowed.includes(li.dataset.chipSize);
        });
        const firstChip = card.querySelector('[data-chip-size]:not([hidden]) a');
        const link = card.querySelector('.card-link');
        if (firstChip && link) link.href = firstChip.getAttribute('href');
      });
      if (empty) empty.hidden = shown > 0;
      document.querySelectorAll('[data-filter-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filterCat === state.cat)));
      document.querySelectorAll('[data-filter-size]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.filterSize === state.size));
        if (b.dataset.sizeCat) b.hidden = !!allowed && b.dataset.sizeCat !== state.cat;
      });
    };
    document.addEventListener('click', (e) => {
      const c = e.target.closest('[data-filter-cat]');
      const s = e.target.closest('[data-filter-size]');
      if (c) { state.cat = c.dataset.filterCat; apply(); }
      if (s) { state.size = s.dataset.filterSize; apply(); }
    });
    apply();
  }

  // product page: size selection
  const product = document.querySelector('[data-product]');
  if (product) {
    let sizes = [];
    try { sizes = JSON.parse(product.dataset.sizes || '[]'); } catch (_) {}
    const label = product.querySelector('[data-size-label]');
    const weight = product.querySelector('[data-size-weight]');
    const weightRow = product.querySelector('[data-weight-row]');
    const scale = product.querySelector('[data-size-scale]');
    const cta = product.querySelector('[data-cta]');
    // show the photos that belong to the chosen size
    const mainImg = document.querySelector('[data-gallery-main]');
    const thumbsList = document.querySelector('[data-gallery-thumbs]');
    const note = document.querySelector('[data-gallery-note]');
    const showPhotosFor = (key) => {
      if (!mainImg || !thumbsList) return;
      const items = [...thumbsList.querySelectorAll('[data-photo-sizes]')];
      let match = items.filter((li) => !li.dataset.photoSizes || li.dataset.photoSizes.split(' ').includes(key));
      const fallback = match.length === 0;
      if (fallback) match = items;
      items.forEach((li) => { li.hidden = !match.includes(li); });
      thumbsList.hidden = match.length < 2;
      const firstBtn = match[0] && match[0].querySelector('[data-gallery-thumb]');
      if (firstBtn) {
        mainImg.src = firstBtn.dataset.galleryThumb;
        items.forEach((li) => { const b = li.querySelector('[data-gallery-thumb]'); b.setAttribute('aria-current', String(b === firstBtn)); });
      }
      if (note) note.hidden = !fallback;
    };
    const select = (key, push) => {
      const s = sizes.find((x) => x.key === key) || sizes[0];
      if (!s) return;
      product.querySelectorAll('[data-size]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === s.key)));
      if (label) {
        label.textContent = `${s.label} `;
        const cm = document.createElement('span'); cm.className = 'muted'; cm.textContent = `(${s.cm})`; label.append(cm);
        if (s.note) { const n = document.createElement('span'); n.className = 'size-note'; n.textContent = s.note; label.append(n); }
      }
      if (weight) weight.textContent = s.weight;
      if (weightRow) weightRow.hidden = !s.weight;
      if (scale) { scale.style.setProperty('--w', s.w); scale.style.setProperty('--h', s.h); }
      showPhotosFor(s.key);
      if (cta) {
        const msg = `${(cta.dataset.msgBase || '').replace(/\. Please share/, ` in size ${s.label}${s.name ? ` (${s.name})` : ''}. Please share`)}`;
        cta.querySelectorAll('[data-wa]').forEach((a) => { const u = new URL(a.href); u.searchParams.set('text', msg); a.href = u.toString(); });
        cta.querySelectorAll('[data-mail]').forEach((a) => { a.href = a.href.replace(/body=[^&]*/, 'body=' + encodeURIComponent(msg)); });
      }
      // floating WhatsApp button mentions the towel and size being viewed
      const float = document.querySelector('[data-wa-float]');
      if (float) {
        const text = `Hi ${product.dataset.firm}, I was looking at "${product.dataset.name}" in size ${s.label}${s.name ? ` (${s.name})` : ''} on your website: ${product.dataset.url}?size=${s.key}`;
        float.href = `${float.dataset.waNumber}?text=${encodeURIComponent(text)}`;
      }
      if (push) {
        const u = new URL(location.href); u.searchParams.set('size', s.key);
        history.replaceState(null, '', u);
      }
    };
    product.addEventListener('click', (e) => {
      const b = e.target.closest('[data-size]');
      if (b) select(b.dataset.size, true);
    });
    const initial = new URLSearchParams(location.search).get('size');
    select(initial || (sizes[0] && sizes[0].key), false);
  }

  // gallery thumbnails
  const main = document.querySelector('[data-gallery-main]');
  if (main) {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-gallery-thumb]');
      if (!t) return;
      main.src = t.dataset.galleryThumb;
      document.querySelectorAll('[data-gallery-thumb]').forEach((x) => x.setAttribute('aria-current', String(x === t)));
    });
  }

  // enquiry form -> WhatsApp or email
  const form = document.querySelector('[data-enquiry]');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const via = e.submitter ? e.submitter.value : 'wa';
      const f = new FormData(form);
      const lines = [
        `Hello ${form.dataset.firm}, I would like a quotation.`,
        f.get('name') && `Name: ${f.get('name')}`,
        f.get('company') && `Company: ${f.get('company')}`,
        f.get('city') && `City: ${f.get('city')}`,
        f.get('product') && `Towel and size: ${f.get('product')}`,
        f.get('qty') && `Quantity: ${f.get('qty')}`,
        f.get('message') && `Details: ${f.get('message')}`,
      ].filter(Boolean);
      const text = lines.join('\n');
      if (via === 'email' && form.dataset.email) {
        location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent('Quotation request')}&body=${encodeURIComponent(text)}`;
      } else if (form.dataset.wa) {
        window.open(`${form.dataset.wa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      }
    });
  }

  // share and copy link on product pages
  const done = document.querySelector('[data-share-done]');
  const say = (msg) => { if (done) { done.textContent = msg; setTimeout(() => { done.textContent = ''; }, 2500); } };
  const currentUrl = (base) => {
    const size = new URLSearchParams(location.search).get('size');
    return size ? `${base}?size=${encodeURIComponent(size)}` : base;
  };
  document.addEventListener('click', async (e) => {
    const share = e.target.closest('[data-share]');
    const copy = e.target.closest('[data-copy-link]');
    if (share) {
      const url = currentUrl(share.dataset.url);
      const title = share.dataset.title;
      if (navigator.share) {
        try { await navigator.share({ title, text: `${title}: terry towel from Vijayalaxmi Textiles, Solapur`, url }); } catch (_) {}
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${title}: ${url}`)}`, '_blank', 'noopener');
      }
    }
    if (copy) {
      const url = currentUrl(copy.dataset.copyLink);
      try { await navigator.clipboard.writeText(url); say('Link copied'); }
      catch (_) { window.prompt('Copy this link', url); }
    }
  });

  // PDF catalogue: load the generator only when someone asks for it
  let catLoading = null;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-catalogue]');
    if (!btn) return;
    const go = () => window.VLTCatalogue && window.VLTCatalogue.download(btn);
    if (window.VLTCatalogue) return go();
    if (!catLoading) {
      catLoading = new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = document.body.dataset.catalogueJs; sc.onload = res; sc.onerror = rej;
        document.head.appendChild(sc);
      });
    }
    catLoading.then(go).catch(() => alert('The catalogue could not be loaded. Please check your internet and try again.'));
  });
})();
