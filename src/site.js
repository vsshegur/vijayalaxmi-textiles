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
    const apply = () => {
      let shown = 0;
      grid.querySelectorAll('.card').forEach((card) => {
        const okCat = !state.cat || card.dataset.cats.split(' ').includes(state.cat);
        const okSize = !state.size || card.dataset.sizes.split(' ').includes(state.size);
        card.hidden = !(okCat && okSize);
        if (!card.hidden) shown++;
      });
      if (empty) empty.hidden = shown > 0;
      document.querySelectorAll('[data-filter-cat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filterCat === state.cat)));
      document.querySelectorAll('[data-filter-size]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filterSize === state.size)));
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
    const select = (key, push) => {
      const s = sizes.find((x) => x.key === key) || sizes[0];
      if (!s) return;
      product.querySelectorAll('[data-size]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === s.key)));
      if (label) label.innerHTML = `${s.label} <span class="muted">(${s.cm})</span>`;
      if (weight) weight.textContent = s.weight;
      if (weightRow) weightRow.hidden = !s.weight;
      if (scale) { scale.style.setProperty('--w', s.w); scale.style.setProperty('--h', s.h); }
      if (cta) {
        const msg = `${(cta.dataset.msgBase || '').replace(/\. Please share/, ` in size ${s.label}. Please share`)}`;
        cta.querySelectorAll('[data-wa]').forEach((a) => { const u = new URL(a.href); u.searchParams.set('text', msg); a.href = u.toString(); });
        cta.querySelectorAll('[data-mail]').forEach((a) => { a.href = a.href.replace(/body=[^&]*/, 'body=' + encodeURIComponent(msg)); });
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
    if (initial) select(initial, false);
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
})();
