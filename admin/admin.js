(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const normSize = (s) => String(s || '').toLowerCase().replace(/\s+/g, '').replace('×', 'x').replace('*', 'x');
  const validSize = (s) => /^\d+(\.\d+)?x\d+(\.\d+)?$/.test(s);
  const showSize = (s) => s.replace('x', ' × ');
  const OTHER = '__other__';
  const DRAFT_KEY = 'vlt-admin-draft-v1';

  const state = { settings: {}, categories: [], products: [], connected: false, dirty: false };
  const uploads = new Map(); // path -> { data (base64), url (object URL) }
  const previews = new Map(); // path -> object URL for photos published this session

  // ---------- status / notices ----------
  const statusEl = $('#status');
  const publishBtn = $('#publish');
  const notice = $('#notice');
  function setDirty(v = true) {
    state.dirty = v;
    publishBtn.disabled = !v || !state.connected;
    statusEl.className = 'status' + (v ? ' is-dirty' : '');
    statusEl.textContent = v ? 'Unpublished changes' : '';
    if (v) saveDraft();
  }
  function showNotice(html, kind = '') {
    notice.className = 'notice' + (kind ? ` is-${kind}` : '');
    notice.innerHTML = html;
    notice.hidden = !html;
  }
  function saveDraft() {
    try {
      const pending = new Set(uploads.keys());
      const products = state.products.map((p) => ({ ...p, images: p.images.filter((i) => !pending.has(i)) }));
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), settings: state.settings, categories: state.categories, products }));
    } catch (_) {}
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (_) {} }
  function readDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) { return null; } }

  window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- tabs ----------
  $$('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => {
    $$('.tabs [data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
  }));

  // ---------- load ----------
  async function load() {
    statusEl.textContent = 'Loading…';
    let data;
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      data = await res.json();
      if (!res.ok && !data.settings) throw new Error(data.error || 'Could not load the site data.');
    } catch (e) {
      showNotice(`<strong>Could not load your products.</strong> ${esc(e.message)} Reload the page to try again.`, 'error');
      statusEl.textContent = '';
      return;
    }
    state.connected = !!data.connected;
    state.settings = data.settings || {};
    state.categories = data.categories || [];
    state.products = (data.products || []).map(fixProduct);

    if (!state.connected) {
      showNotice(`<strong>Publishing is not connected yet.</strong> You can look around, but changes cannot be published until <code>GITHUB_TOKEN</code> and <code>GITHUB_REPO</code> are added in Cloudflare Pages settings. ${data.error ? esc(data.error) : ''}`);
    }

    const draft = readDraft();
    if (draft && draft.products && confirm('You have unpublished changes saved on this device from before. Restore them?')) {
      state.settings = draft.settings; state.categories = draft.categories; state.products = draft.products.map(fixProduct);
      renderAll(); setDirty(true);
    } else {
      clearDraft(); renderAll(); setDirty(false);
    }
  }
  function fixProduct(p) {
    return { id: p.id || `p${Date.now()}${Math.random().toString(36).slice(2, 6)}`, name: '', slug: '', material: '', origin: 'India', pattern: '', description: '', moq: '', featured: false, hidden: false, colour: '#34489c', images: [], sizes: [], ...p };
  }
  const imgUrl = (path) => uploads.get(path)?.url || previews.get(path) || path;
  const sizeCat = () => {
    const m = new Map();
    for (const c of state.categories) for (const s of c.sizes || []) if (!m.has(s)) m.set(s, c);
    return m;
  };

  function renderAll() { renderProducts(); renderTypes(); renderRatings(); renderBusiness(); renderDesign(); }

  // ---------- products list ----------
  $('#product-search').addEventListener('input', renderProducts);
  function renderProducts() {
    const q = $('#product-search').value.trim().toLowerCase();
    const list = $('#product-list');
    const m = sizeCat();
    const items = state.products.filter((p) => !q || p.name.toLowerCase().includes(q));
    $('#product-count').textContent = `${state.products.length} product${state.products.length === 1 ? '' : 's'}`;
    if (!state.products.length) {
      list.innerHTML = `<li class="empty"><p><strong>No products yet.</strong></p><p class="muted">Add your first towel with its sizes, material and photos.</p></li>`;
      return;
    }
    list.innerHTML = items.map((p) => {
      const img = p.images[0];
      const types = [...new Set(p.sizes.map((s) => m.get(s.size)?.name || 'Other size'))].join(', ');
      return `<li class="pitem${p.hidden ? ' is-hidden' : ''}">
        ${img ? `<img class="pthumb" src="${esc(imgUrl(img))}" alt="">` : `<span class="pthumb" style="--c:${esc(p.colour)}"></span>`}
        <div>
          <div class="pname">${esc(p.name)}${p.featured ? '<span class="tag">Home page</span>' : ''}${p.hidden ? '<span class="tag tag--warn">Hidden</span>' : ''}</div>
          <div class="pmeta">${esc(types || 'No sizes')}: ${esc(p.sizes.map((s) => showSize(s.size)).join(', '))}</div>
          <div class="pmeta">${esc([p.material, p.material && /micro/i.test(p.material) ? p.origin : '', p.pattern].filter(Boolean).join(', '))}</div>
        </div>
        <button class="btn btn--small" data-edit="${esc(p.id)}">Edit</button>
      </li>`;
    }).join('') || `<li class="empty">No products match “${esc(q)}”.</li>`;
  }
  $('#product-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit]');
    if (b) openEditor(state.products.find((p) => p.id === b.dataset.edit));
  });
  $('#add-product').addEventListener('click', () => openEditor(null));

  // ---------- product editor ----------
  const dlg = $('#editor');
  const form = $('#product-form');
  let editing = null; // working copy
  let isNew = false;

  function fillSelect(sel, options, value, otherInput) {
    const opts = [...new Set(options.filter(Boolean))];
    const known = !value || opts.includes(value);
    sel.innerHTML = `<option value="">Not specified</option>` + opts.map((o) => `<option${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('') + `<option value="${OTHER}"${known ? '' : ' selected'}>Other…</option>`;
    otherInput.hidden = known;
    otherInput.value = known ? '' : value;
  }
  const selectValue = (sel, other) => (sel.value === OTHER ? other.value.trim() : sel.value);

  function openEditor(product) {
    isNew = !product;
    editing = product ? JSON.parse(JSON.stringify(product)) : fixProduct({ origin: 'India' });
    $('#editor-title').textContent = isNew ? 'Add product' : 'Edit product';
    $('#p-delete').hidden = isNew;
    $('#p-name').value = editing.name;
    $('#p-moq').value = editing.moq;
    $('#p-desc').value = editing.description;
    $('#p-colour').value = /^#[0-9a-f]{6}$/i.test(editing.colour) ? editing.colour : '#34489c';
    $('#p-featured').checked = !!editing.featured;
    $('#p-hidden').checked = !!editing.hidden;
    fillSelect($('#p-material'), state.settings.materials || [], editing.material, $('#p-material-other'));
    fillSelect($('#p-pattern'), state.settings.patterns || [], editing.pattern, $('#p-pattern-other'));
    fillSelect($('#p-origin'), state.settings.origins || ['India', 'China'], editing.origin || 'India', $('#p-origin-other'));
    updateOrigin(false);
    renderSizes();
    renderPhotos();
    $$('[data-error]', form).forEach((x) => (x.hidden = true));
    dlg.showModal();
    if (isNew) $('#p-name').focus();
  }

  function isMicro() { return /micro/i.test(selectValue($('#p-material'), $('#p-material-other'))); }
  function updateOrigin(fromChange) {
    const show = isMicro();
    $('#origin-field').hidden = !show;
    if (show && fromChange && ($('#p-origin').value === 'India' || !$('#p-origin').value)) {
      fillSelect($('#p-origin'), state.settings.origins || ['India', 'China'], 'China', $('#p-origin-other'));
    }
  }
  [['#p-material', '#p-material-other'], ['#p-pattern', '#p-pattern-other'], ['#p-origin', '#p-origin-other']].forEach(([s, o]) => {
    $(s).addEventListener('change', () => {
      $(o).hidden = $(s).value !== OTHER;
      if (!$(o).hidden) $(o).focus();
      if (s === '#p-material') updateOrigin(true);
    });
  });
  $('#p-material-other').addEventListener('input', () => updateOrigin(true));

  function renderSizes() {
    const box = $('#p-sizes');
    const chosen = new Map(editing.sizes.map((s) => [s.size, s.weight]));
    const groups = state.categories.map((c) => ({ title: c.name, sizes: c.sizes || [] }));
    const known = new Set(groups.flatMap((g) => g.sizes));
    const extra = editing.sizes.map((s) => s.size).filter((s) => !known.has(s));
    if (extra.length) groups.push({ title: 'Other sizes', sizes: extra });
    box.innerHTML = groups.map((g) => `<div>
      <div class="size-group-title">${esc(g.title)}</div>
      ${g.sizes.map((s) => {
        const on = chosen.has(s);
        const id = `sz-${s.replace(/\W/g, '_')}`;
        return `<div class="size-row">
          <label for="${id}"><input type="checkbox" id="${id}" data-size="${esc(s)}"${on ? ' checked' : ''}> ${esc(showSize(s))}</label>
          <input type="text" data-weight="${esc(s)}" value="${esc(chosen.get(s) || '')}" placeholder="Weight, e.g. 450 g" aria-label="Weight for ${esc(showSize(s))}"${on ? '' : ' disabled'}>
        </div>`;
      }).join('')}
    </div>`).join('');
  }
  $('#p-sizes').addEventListener('change', (e) => {
    const cb = e.target.closest('[data-size]');
    if (!cb) return;
    const w = $(`[data-weight="${CSS.escape(cb.dataset.size)}"]`, $('#p-sizes'));
    w.disabled = !cb.checked;
    if (cb.checked) w.focus();
  });
  $('#p-add-size').addEventListener('click', () => {
    const input = $('#p-custom-size');
    const s = normSize(input.value);
    if (!validSize(s)) { input.setCustomValidity('Write the size as width x length, e.g. 27x54'); input.reportValidity(); return; }
    input.setCustomValidity('');
    collectSizes();
    if (!editing.sizes.some((x) => x.size === s)) editing.sizes.push({ size: s, weight: '' });
    input.value = '';
    renderSizes();
  });
  $('#p-custom-size').addEventListener('input', (e) => e.target.setCustomValidity(''));
  function collectSizes() {
    editing.sizes = $$('[data-size]', $('#p-sizes')).filter((c) => c.checked).map((c) => ({
      size: c.dataset.size,
      weight: $(`[data-weight="${CSS.escape(c.dataset.size)}"]`, $('#p-sizes')).value.trim(),
    }));
  }

  // photos
  function renderPhotos() {
    const ul = $('#p-photos');
    ul.innerHTML = editing.images.map((src, i) => `<li>
      <img src="${esc(imgUrl(src))}" alt="Photo ${i + 1}">
      ${i === 0 ? '<span class="main-tag">Main</span>' : ''}
      <div class="photo-tools">
        <button type="button" data-move="${i}" data-dir="-1" aria-label="Move photo ${i + 1} left"${i === 0 ? ' disabled' : ''}>◀</button>
        <button type="button" data-remove="${i}" aria-label="Remove photo ${i + 1}">✕</button>
        <button type="button" data-move="${i}" data-dir="1" aria-label="Move photo ${i + 1} right"${i === editing.images.length - 1 ? ' disabled' : ''}>▶</button>
      </div>
    </li>`).join('');
  }
  $('#p-photos').addEventListener('click', (e) => {
    const mv = e.target.closest('[data-move]');
    const rm = e.target.closest('[data-remove]');
    if (mv) {
      const i = +mv.dataset.move, j = i + +mv.dataset.dir;
      [editing.images[i], editing.images[j]] = [editing.images[j], editing.images[i]];
      renderPhotos();
    }
    if (rm) { editing.images.splice(+rm.dataset.remove, 1); renderPhotos(); }
  });
  $('#p-file').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    const base = slugify($('#p-name').value) || 'towel';
    for (const f of files) {
      try {
        const { blob, ext } = await resize(f, 1600);
        const name = `${base}-${Math.random().toString(36).slice(2, 8)}.${ext}`.slice(-90);
        const path = `/images/products/${name}`;
        const data = await toBase64(blob);
        uploads.set(path, { data, url: URL.createObjectURL(blob) });
        editing.images.push(path);
        renderPhotos();
      } catch (err) {
        alert(`Could not add ${f.name}. Use a JPG, PNG or WebP photo.`);
      }
    }
  });
  async function resize(file, max) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.drawImage(bmp, 0, 0, w, h);
    let blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.82));
    if (blob && blob.type === 'image/webp') return { blob, ext: 'webp' };
    blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return { blob, ext: 'jpg' };
  }
  function toBase64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  $$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    collectSizes();
    const name = $('#p-name').value.trim();
    $('[data-error="name"]').hidden = !!name;
    $('[data-error="sizes"]').hidden = editing.sizes.length > 0;
    if (!name) { $('#p-name').focus(); return; }
    if (!editing.sizes.length) { $('#p-sizes input')?.focus(); return; }
    const material = selectValue($('#p-material'), $('#p-material-other'));
    Object.assign(editing, {
      name,
      material,
      origin: /micro/i.test(material) ? (selectValue($('#p-origin'), $('#p-origin-other')) || 'China') : 'India',
      pattern: selectValue($('#p-pattern'), $('#p-pattern-other')),
      moq: $('#p-moq').value.trim(),
      description: $('#p-desc').value.trim(),
      colour: $('#p-colour').value,
      featured: $('#p-featured').checked,
      hidden: $('#p-hidden').checked,
    });
    if (isNew || !editing.slug) {
      let slug = slugify(name) || 'towel';
      const taken = new Set(state.products.filter((p) => p.id !== editing.id).map((p) => p.slug));
      let n = 2; const b = slug;
      while (taken.has(slug)) slug = `${b}-${n++}`;
      editing.slug = slug;
    }
    if (isNew) state.products.unshift(editing);
    else state.products = state.products.map((p) => (p.id === editing.id ? editing : p));
    dlg.close();
    renderProducts();
    setDirty(true);
  });

  $('#p-delete').addEventListener('click', () => {
    if (!confirm(`Delete “${editing.name}”? It will be removed from the site when you publish.`)) return;
    state.products = state.products.filter((p) => p.id !== editing.id);
    dlg.close();
    renderProducts();
    setDirty(true);
  });

  // ---------- towel types ----------
  function renderTypes() {
    $('#type-list').innerHTML = state.categories.map((c, i) => `<div class="card form-grid" data-type="${i}">
      <div class="field"><label>Name (plural)</label><input data-k="name" value="${esc(c.name)}" placeholder="Bath Towels"></div>
      <div class="field"><label>Name (one item)</label><input data-k="singular" value="${esc(c.singular || '')}" placeholder="Bath towel"></div>
      <div class="field wide"><label>Sizes in inches, separated by commas</label><input data-k="sizes" value="${esc((c.sizes || []).join(', '))}" placeholder="30x60, 36x72"></div>
      <div class="field wide"><label>Description for this page and Google</label><textarea data-k="description" rows="2">${esc(c.description || '')}</textarea></div>
      <div class="wide row-actions"><button type="button" class="btn btn--danger-text" data-del-type="${i}">Delete this type</button></div>
    </div>`).join('');
  }
  $('#type-list').addEventListener('change', (e) => {
    const card = e.target.closest('[data-type]'); const k = e.target.dataset.k;
    if (!card || !k) return;
    const c = state.categories[+card.dataset.type];
    if (k === 'sizes') {
      const parts = e.target.value.split(/[,;\n]+/).map(normSize).filter(Boolean);
      const bad = parts.filter((s) => !validSize(s));
      if (bad.length) { alert(`These sizes are not in the form 30x60: ${bad.join(', ')}`); }
      c.sizes = parts.filter(validSize);
      e.target.value = c.sizes.join(', ');
    } else {
      c[k] = e.target.value.trim();
      if (k === 'name' && !c.slug) c.slug = slugify(c.name);
    }
    setDirty(true);
  });
  $('#type-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del-type]');
    if (!b) return;
    const c = state.categories[+b.dataset.delType];
    if (!confirm(`Delete the towel type “${c.name}”? Products in its sizes will show under “Other sizes” until you add a type for them.`)) return;
    state.categories.splice(+b.dataset.delType, 1);
    renderTypes(); setDirty(true);
  });
  $('#add-type').addEventListener('click', () => {
    state.categories.push({ slug: '', name: '', singular: '', sizes: [], description: '' });
    renderTypes(); setDirty(true);
    $('#type-list .card:last-child input')?.focus();
  });

  // ---------- ratings ----------
  function renderRatings() {
    const list = state.settings.ratings || (state.settings.ratings = []);
    $('#rating-list').innerHTML = list.map((r, i) => `<div class="card form-grid" data-rating="${i}">
      <div class="field"><label>Platform</label><input data-k="platform" value="${esc(r.platform)}" placeholder="IndiaMART"></div>
      <div class="field"><label>Rating out of 5</label><input data-k="rating" type="number" min="0" max="5" step="0.1" value="${esc(r.rating)}" placeholder="4.8"></div>
      <div class="field"><label>Number of reviews or buyers</label><input data-k="reviews" value="${esc(r.reviews)}" placeholder="150+"></div>
      <div class="field"><label>Shown after the number</label><input data-k="note" value="${esc(r.note)}" placeholder="reviews"></div>
      <div class="field wide"><label>Profile link</label><input data-k="url" type="url" value="${esc(r.url)}" placeholder="https://"></div>
      <div class="wide row-actions"><button type="button" class="btn btn--danger-text" data-del-rating="${i}">Remove</button></div>
    </div>`).join('');
  }
  $('#rating-list').addEventListener('change', (e) => {
    const card = e.target.closest('[data-rating]'); const k = e.target.dataset.k;
    if (!card || !k) return;
    const r = state.settings.ratings[+card.dataset.rating];
    r[k] = k === 'rating' ? (e.target.value === '' ? '' : Math.max(0, Math.min(5, Number(e.target.value)))) : e.target.value.trim();
    setDirty(true);
  });
  $('#rating-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del-rating]');
    if (!b) return;
    state.settings.ratings.splice(+b.dataset.delRating, 1);
    renderRatings(); setDirty(true);
  });
  $('#add-rating').addEventListener('click', () => {
    (state.settings.ratings ||= []).push({ platform: '', rating: '', reviews: '', note: 'reviews', url: '' });
    renderRatings(); setDirty(true);
  });

  // ---------- business details ----------
  const FIELDS = [
    ['h', 'Firm'],
    ['firmName', 'Firm name'], ['alternateName', 'Other name buyers use'],
    ['tagline', 'Short tagline'], ['businessType', 'What you do'],
    ['buyers', 'Main buyers'], ['established', 'Year established', 'number'],
    ['h', 'Contact'],
    ['phone', 'Phone'], ['whatsapp', 'WhatsApp number'],
    ['email', 'Email', 'email'], ['languages', 'Languages you reply in'],
    ['addressLine', 'Street / area', 'text', 'wide'], ['city', 'City'], ['state', 'State'],
    ['pincode', 'PIN code'], ['gstin', 'GSTIN'], ['hours', 'Working hours'],
    ['mapUrl', 'Google Maps link or embed link', 'url'],
    ['h', 'Links'],
    ['siteUrl', 'Website address (your domain)', 'url'], ['indiamartUrl', 'IndiaMART enquiry link', 'url'], ['flipkartUrl', 'Flipkart store link', 'url'],
    ['h', 'Text'],
    ['seoDescription', 'Description shown in Google results (about 150–160 characters)', 'textarea', 'wide'],
    ['about', 'Our story (About page). Leave a blank line between paragraphs.', 'textarea-lg', 'wide'],
    ['h', 'Choices in the product form (one per line)'],
    ['materials', 'Materials', 'list'], ['patterns', 'Pattern types', 'list'], ['origins', 'Countries of origin', 'list'],
  ];
  function renderBusiness() {
    const s = state.settings;
    $('#business-form').innerHTML = FIELDS.map(([k, label, type = 'text', cls = '']) => {
      if (k === 'h') return `<h2>${esc(label)}</h2>`;
      const v = s[k];
      const id = `b-${k}`;
      let input;
      if (type === 'list') input = `<textarea id="${id}" data-k="${k}" data-list rows="6">${esc((v || []).join('\n'))}</textarea>`;
      else if (type.startsWith('textarea')) input = `<textarea id="${id}" data-k="${k}" rows="${type === 'textarea-lg' ? 14 : 3}">${esc(v || '')}</textarea>`;
      else input = `<input id="${id}" data-k="${k}" type="${type}" value="${esc(v ?? '')}">`;
      return `<div class="field ${cls}"><label for="${id}">${esc(label)}</label>${input}</div>`;
    }).join('');
  }
  $('#business-form').addEventListener('change', (e) => {
    const k = e.target.dataset.k; if (!k) return;
    let v = e.target.value;
    if (e.target.dataset.list !== undefined) v = v.split('\n').map((x) => x.trim()).filter(Boolean);
    else if (k === 'established') v = Number(v) || 1982;
    else v = v.trim();
    state.settings[k] = v;
    setDirty(true);
  });
  $('#business-form').addEventListener('submit', (e) => e.preventDefault());

  // ---------- design ----------
  const DESIGNS = [
    ['loom', 'Loom', 'Classic Indian textile look: indigo and turmeric, serif headings, a stack of folded towels and every size drawn to scale.', 'background:#fff', '<span class="d"></span><span class="y"></span><span></span><span class="d"></span>'],
    ['mill', 'Mill', 'Bold commercial supplier look: dark slate and bright blue, heavy headings, square edges, size chart and key numbers up top.', 'background:#16202c', '<span style="background:#0b63ce"></span><span style="background:#fff"></span><span style="background:#0b63ce;grid-column:1/3"></span>'],
    ['spa', 'Spa', 'Soft home and hotel look: sage and blush, light rounded type, rolled towels, rounded cards.', 'background:#eef3ef', '<span style="background:#a9c4b2;border-radius:50%"></span><span style="background:#f1d3c9;border-radius:50%"></span><span style="background:#c9d8e8;border-radius:50%"></span><span style="background:#4f7b63;border-radius:50%"></span>'],
  ];
  const currentDesign = () => state.settings.design || { showroom: 'mill', heritage: 'spa' }[state.settings.homeLayout] || 'loom';
  function renderDesign() {
    const cur = currentDesign();
    $('#design-list').innerHTML = DESIGNS.map(([k, name, desc, bg, thumb]) => `<label class="design">
      <input type="radio" name="design" value="${k}"${k === cur ? ' checked' : ''}>
      <div class="design-thumb" style="grid-template-columns:1fr 1fr;${bg}">${thumb}</div>
      <span class="design-name">${esc(name)}</span>
      <span class="muted">${esc(desc)}</span>
    </label>`).join('');
  }
  $('#design-list').addEventListener('change', (e) => {
    if (e.target.name !== 'design') return;
    state.settings.design = e.target.value;
    delete state.settings.homeLayout;
    setDirty(true);
  });

  // ---------- publish ----------
  publishBtn.addEventListener('click', async () => {
    const missingType = state.categories.find((c) => !c.name);
    if (missingType) { alert('One towel type has no name. Add a name or delete it before publishing.'); return; }
    publishBtn.disabled = true;
    statusEl.className = 'status';
    statusEl.textContent = 'Publishing…';
    const referenced = new Set(state.products.flatMap((p) => p.images));
    const up = [...uploads].filter(([p]) => referenced.has(p)).map(([path, u]) => ({ path, data: u.data }));
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin': '1' },
        body: JSON.stringify({ settings: state.settings, categories: state.categories, products: state.products, uploads: up }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `Publishing failed (error ${res.status}).`);
      for (const [p, u] of uploads) previews.set(p, u.url);
      uploads.clear();
      clearDraft();
      setDirty(false);
      statusEl.className = 'status is-ok';
      statusEl.textContent = 'Published';
      showNotice('<strong>Published.</strong> Your website updates in about 1–2 minutes. Refresh the site after that to see the changes.', 'ok');
    } catch (e) {
      setDirty(true);
      showNotice(`<strong>Not published.</strong> ${esc(e.message)} Your changes are still here, so you can try again.`, 'error');
    }
  });

  load();
})();
