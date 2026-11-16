// Builds a PDF catalogue in the browser from /catalogue.json. No libraries.
// Uses the standard Helvetica fonts (WinAnsi) and JPEG photos, so files stay small and open everywhere.
(() => {
  const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 0, 556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 552, 400, 549, 333, 333, 333, 576, 537, 333, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 549, 611, 556, 556, 556, 556, 500, 556, 500];
  const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 0, 556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 552, 400, 549, 333, 333, 333, 576, 556, 333, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 549, 611, 611, 611, 611, 611, 556, 611, 556];
  const PAGE_W = 595.28, PAGE_H = 841.89, M = 40;
  const INDIGO = [0.114, 0.165, 0.361], TURMERIC = [0.886, 0.631, 0.165], GREY = [0.365, 0.396, 0.522], LINE = [0.867, 0.882, 0.925], RED = [0.867, 0.09, 0.094];

  const SPECIAL = { 0x20ac: 0x80, 0x201a: 0x82, 0x201e: 0x84, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2122: 0x99 };
  const winAnsi = (str) => {
    const out = [];
    for (const ch of String(str).replace(/₹/g, 'Rs. ')) {
      const c = ch.codePointAt(0);
      if (c >= 32 && c < 127) out.push(c);
      else if (c >= 0xa0 && c <= 0xff) out.push(c);
      else if (SPECIAL[c]) out.push(SPECIAL[c]);
      else if (c === 10 || c === 9) out.push(32);
      else out.push(63);
    }
    return out;
  };
  const hex = (codes) => codes.map((c) => c.toString(16).padStart(2, '0')).join('');
  const measure = (str, bold, size) => winAnsi(str).reduce((s, c) => s + ((bold ? W_BOLD : W_REG)[c - 32] || 556), 0) * size / 1000;
  const wrap = (str, bold, size, width) => {
    const words = String(str).split(/\s+/).filter(Boolean);
    const lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (measure(t, bold, size) <= width || !cur) cur = t; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const f2 = (n) => (Math.round(n * 100) / 100).toString();
  const rgb = (c) => c.map(f2).join(' ');
  const hexToRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [0.204, 0.282, 0.612]; const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  // ---------- page drawing ----------
  class Page {
    constructor() { this.ops = []; this.images = []; this.links = []; }
    text(str, x, top, { size = 10, bold = false, color = INDIGO } = {}) {
      this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${f2(size)} Tf ${rgb(color)} rg 1 0 0 1 ${f2(x)} ${f2(PAGE_H - top - size * 0.8)} Tm <${hex(winAnsi(str))}> Tj ET`);
    }
    rect(x, top, w, h, color) { this.ops.push(`${rgb(color)} rg ${f2(x)} ${f2(PAGE_H - top - h)} ${f2(w)} ${f2(h)} re f`); }
    line(x1, top, x2, color = LINE, width = 0.6) { this.ops.push(`${rgb(color)} RG ${f2(width)} w ${f2(x1)} ${f2(PAGE_H - top)} m ${f2(x2)} ${f2(PAGE_H - top)} l S`); }
    image(img, x, top, w, h) { const name = `Im${img.id}`; this.images.push(img); this.ops.push(`q ${f2(w)} 0 0 ${f2(h)} ${f2(x)} ${f2(PAGE_H - top - h)} cm /${name} Do Q`); }
    link(url, x, top, w, h) { this.links.push({ url, rect: [x, PAGE_H - top - h, x + w, PAGE_H - top] }); }
  }

  // ---------- PDF file ----------
  function buildPdf(pages, images, title) {
    const enc = (s) => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };
    const chunks = []; let len = 0; const offsets = [];
    const push = (u8) => { chunks.push(u8); len += u8.length; };
    const objCount = { n: 0 };
    const objects = []; // [id, parts]
    const newId = () => ++objCount.n;
    const catalogId = newId(), pagesId = newId(), f1 = newId(), f2id = newId(), infoId = newId();
    const imgIds = new Map();
    images.forEach((img) => imgIds.set(img, newId()));
    const pageIds = pages.map(() => ({ page: newId(), content: newId(), annots: [] }));
    pageIds.forEach((p, i) => { p.annots = pages[i].links.map(() => newId()); });

    objects.push([catalogId, [`<< /Type /Catalog /Pages ${pagesId} 0 R >>`]]);
    objects.push([pagesId, [`<< /Type /Pages /Kids [${pageIds.map((p) => `${p.page} 0 R`).join(' ')}] /Count ${pages.length} >>`]]);
    objects.push([f1, ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']]);
    objects.push([f2id, ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>']]);
    objects.push([infoId, [`<< /Title <feff${[...title].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}> /Producer (Vijayalaxmi Textiles website) >>`]]);
    images.forEach((img) => {
      objects.push([imgIds.get(img), [`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`, img.bytes, '\nendstream']]);
    });
    pages.forEach((pg, i) => {
      const ids = pageIds[i];
      const xo = [...new Set(pg.images)].map((img) => `/Im${img.id} ${imgIds.get(img)} 0 R`).join(' ');
      const annots = ids.annots.length ? ` /Annots [${ids.annots.map((a) => `${a} 0 R`).join(' ')}]` : '';
      objects.push([ids.page, [`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f2(PAGE_W)} ${f2(PAGE_H)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2id} 0 R >> /XObject << ${xo} >> >> /Contents ${ids.content} 0 R${annots} >>`]]);
      const content = pg.ops.join('\n');
      objects.push([ids.content, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]]);
      pg.links.forEach((l, j) => {
        const uri = l.url.replace(/[()\\]/g, (m) => `\\${m}`);
        objects.push([ids.annots[j], [`<< /Type /Annot /Subtype /Link /Rect [${l.rect.map(f2).join(' ')}] /Border [0 0 0] /A << /S /URI /URI (${uri}) >> >>`]]);
      });
    });
    objects.sort((a, b) => a[0] - b[0]);
    push(enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
    for (const [id, parts] of objects) {
      offsets[id] = len;
      push(enc(`${id} 0 obj\n`));
      for (const part of parts) push(typeof part === 'string' ? enc(part) : part);
      push(enc('\nendobj\n'));
    }
    const xref = len;
    let x = `xref\n0 ${objCount.n + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objCount.n; i++) x += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    x += `trailer\n<< /Size ${objCount.n + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    push(enc(x));
    return new Blob(chunks, { type: 'application/pdf' });
  }

  // ---------- photos to JPEG ----------
  let imgSeq = 0;
  function loadImage(src) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  }
  async function toJpeg(src, boxW, boxH, { contain = false } = {}) {
    const im = await loadImage(src);
    const scale = 2.2;
    const cw = Math.round(boxW * scale), ch = Math.round(boxH * scale);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch);
    const r = contain ? Math.min(cw / im.width, ch / im.height) : Math.max(cw / im.width, ch / im.height);
    const dw = im.width * r, dh = im.height * r;
    g.drawImage(im, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    const data = atob(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
    const bytes = new Uint8Array(data.length); for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
    return { id: ++imgSeq, w: cw, h: ch, bytes };
  }

  // ---------- layout ----------
  async function make(data) {
    const pages = []; const images = [];
    const site = data.site.replace(/\/+$/, '');
    const siteShort = site.replace(/^https?:\/\//, '');
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // cover
    const cover = new Page(); pages.push(cover);
    cover.rect(0, 0, PAGE_W, 10, INDIGO);
    cover.rect(0, 10, PAGE_W, 5, TURMERIC);
    let y = 70;
    if (data.logo) {
      try { const lg = await toJpeg(data.logo, 190, 50, { contain: true }); images.push(lg); cover.image(lg, M - 4, y, 190, 50); y += 70; } catch (_) {}
    }
    cover.text(data.firm, M, y, { size: 30, bold: true }); y += 40;
    cover.text(data.tagline, M, y, { size: 13, color: GREY }); y += 50;
    cover.rect(M, y, 4, 54, TURMERIC);
    cover.text('Product catalogue', M + 16, y + 2, { size: 26, bold: true });
    cover.text(`Updated ${today}`, M + 16, y + 36, { size: 11, color: GREY }); y += 90;

    cover.text('Our range (sizes in inches)', M, y, { size: 13, bold: true }); y += 24;
    for (const c of data.categories) {
      cover.line(M, y - 6, PAGE_W - M);
      cover.text(c.name, M, y, { size: 11, bold: true });
      const sz = c.sizes.map((s) => s.label + (s.name ? ` (${s.name})` : '')).join(',  ');
      cover.text(sz, M + 160, y, { size: 11 });
      y += 22;
    }
    cover.line(M, y - 6, PAGE_W - M); y += 20;
    if (data.rating) {
      cover.rect(M, y, PAGE_W - 2 * M, 44, [0.992, 0.945, 0.847]);
      cover.text(data.rating, M + 16, y + 15, { size: 12, bold: true, color: [0.478, 0.31, 0] });
      y += 66;
    }
    cover.text('Contact us for a quotation', M, y, { size: 13, bold: true }); y += 24;
    const contact = [
      data.phone && ['Phone / WhatsApp', data.phone, data.wa],
      data.email && ['Email', data.email, `mailto:${data.email}`],
      data.address && ['Address', data.address, ''],
      data.gstin && ['GSTIN', data.gstin, ''],
      ['Website', siteShort, site],
      data.languages && ['We reply in', data.languages, ''],
    ].filter(Boolean);
    for (const [k, v, url] of contact) {
      cover.text(k, M, y, { size: 10.5, color: GREY });
      const lines = wrap(v, false, 11, PAGE_W - 2 * M - 130);
      lines.forEach((l, i) => cover.text(l, M + 130, y + i * 15, { size: 11, bold: !!url, color: url ? [0.204, 0.282, 0.612] : INDIGO }));
      if (url) cover.link(url, M + 130, y - 2, measure(v, true, 11), 16);
      y += 15 * lines.length + 8;
    }
    if (data.brand) cover.text(`${data.brand} is a registered brand of ${data.firm}.`, M, PAGE_H - 70, { size: 9.5, color: GREY });
    cover.rect(0, PAGE_H - 30, PAGE_W, 5, TURMERIC);
    cover.rect(0, PAGE_H - 25, PAGE_W, 25, INDIGO);

    // product pages
    let page = null; let top = 0;
    const bottom = PAGE_H - 60;
    const newPage = () => { page = new Page(); pages.push(page); top = 62; };
    const PH_W = 132, PH_H = 165, GAP = 18, TX = M + PH_W + GAP, TW = PAGE_W - M - TX;

    for (const group of data.groups) {
      if (!group.products.length) continue;
      if (!page || top + 30 + PH_H > bottom) newPage();
      page.rect(M, top, PAGE_W - 2 * M, 26, INDIGO);
      page.text(group.name, M + 10, top + 7, { size: 12.5, bold: true, color: [1, 1, 1] });
      const gs = group.sizes.join(',  ');
      page.text(gs, PAGE_W - M - 10 - measure(gs, false, 10), top + 8.5, { size: 10, color: [0.85, 0.87, 0.95] });
      top += 40;

      for (const p of group.products) {
        // text block first, to know the height
        const lines = [];
        const push = (str, opts = {}, gap = 0) => { for (const l of wrap(str, !!opts.bold, opts.size || 9.5, opts.width || TW)) lines.push({ str: l, ...opts }); if (gap) lines.push({ gap }); };
        push(p.name, { size: 13, bold: true, link: `${site}/products/${p.slug}/` });
        if (p.kinds) push(p.kinds, { size: 9, color: GREY }, 4);
        const sizeRows = p.sizes.map((s) => ({ sizeRow: s }));
        lines.push({ head: true }); lines.push(...sizeRows); lines.push({ gap: 6 });
        const facts = [['Material', p.material], ['Pattern', p.pattern], ['GSM', p.gsm], ['Colours', (p.colours || []).join(', ')], ['Minimum order', p.moq], ['Packing', p.pack], ['Best for', (p.bestFor || []).join(', ')], ['Country of origin', p.origin], ['Brand', p.brand]].filter(([, v]) => v);
        for (const [k, v] of facts) {
          const ls = wrap(v, false, 9.5, TW - 92);
          ls.forEach((l, i) => lines.push({ fact: i === 0 ? k : '', str: l }));
        }
        const lineH = (l) => (l.gap ? l.gap : l.size >= 13 ? 18 : l.head ? 14 : 13.2);
        const textH = lines.reduce((h, l) => h + lineH(l), 0);
        const rowH = Math.max(PH_H, textH) + 22;
        if (top + rowH > bottom) newPage();

        // photo
        if (p.photo) {
          try { const im = await toJpeg(p.photo, PH_W, PH_H); images.push(im); page.image(im, M, top, PH_W, PH_H); }
          catch (_) { page.rect(M, top, PH_W, PH_H, hexToRgb(p.colour)); }
        } else {
          const base = hexToRgb(p.colour);
          const tint = base.map((v) => v + (1 - v) * 0.45);
          page.rect(M, top, PH_W, PH_H, base);
          page.rect(M, top + 16, PH_W, 6, tint);
          page.rect(M, top + PH_H - 22, PH_W, 6, tint);
          page.text('Photo coming soon', M + 10, top + PH_H / 2 - 5, { size: 9, bold: true, color: [1, 1, 1] });
        }
        page.link(`${site}/products/${p.slug}/`, M, top, PH_W, PH_H);

        // text
        let t = top;
        for (const l of lines) {
          if (l.gap) { t += l.gap; continue; }
          if (l.head) {
            page.text('Size', TX, t, { size: 8.5, bold: true, color: GREY });
            page.text('Centimetres', TX + 150, t, { size: 8.5, bold: true, color: GREY });
            page.text('Weight', TX + 250, t, { size: 8.5, bold: true, color: GREY });
            t += 14; continue;
          }
          if (l.sizeRow) {
            const s = l.sizeRow;
            page.text(s.label + (s.name ? ` (${s.name})` : ''), TX, t, { size: 9.5, bold: true });
            page.text(s.cm, TX + 150, t, { size: 9.5 });
            page.text(s.weight || '-', TX + 250, t, { size: 9.5 });
            t += 13.2; continue;
          }
          if (l.fact !== undefined) {
            if (l.fact) page.text(l.fact, TX, t, { size: 9, color: GREY });
            page.text(l.str, TX + 92, t, { size: 9.5 });
            t += 13.2; continue;
          }
          page.text(l.str, TX, t, { size: l.size || 9.5, bold: !!l.bold, color: l.color || INDIGO });
          if (l.link) page.link(l.link, TX, t - 2, measure(l.str, true, l.size), l.size + 4);
          t += lineH(l);
        }
        top += rowH;
        page.line(M, top - 11, PAGE_W - M);
      }
      top += 6;
    }

    // header and footer on product pages
    const total = pages.length;
    pages.forEach((pg, i) => {
      if (i === 0) return;
      pg.text(data.brand ? `${data.brand}  |  ${data.firm}` : data.firm, M, 26, { size: 9.5, bold: true });
      const right = 'Product catalogue';
      pg.text(right, PAGE_W - M - measure(right, false, 9.5), 26, { size: 9.5, color: GREY });
      pg.line(M, 44, PAGE_W - M);
      pg.line(M, PAGE_H - 44, PAGE_W - M);
      const foot = [data.phone && `WhatsApp ${data.phone}`, siteShort].filter(Boolean).join('   |   ');
      pg.text(foot, M, PAGE_H - 36, { size: 9, color: GREY });
      if (data.wa) pg.link(data.wa, M, PAGE_H - 38, measure(foot, false, 9), 14);
      const pn = `Page ${i + 1} of ${total}`;
      pg.text(pn, PAGE_W - M - measure(pn, false, 9), PAGE_H - 36, { size: 9, color: GREY });
    });
    return buildPdf(pages, images, `${data.firm} product catalogue`);
  }

  window.VLTCatalogue = {
    async download(btn) {
      const label = btn ? btn.innerHTML : '';
      try {
        if (btn) { btn.disabled = true; btn.textContent = 'Preparing catalogue…'; }
        const res = await fetch('/catalogue.json', { cache: 'no-cache' });
        const data = await res.json();
        const blob = await make(data);
        const name = data.fileName || 'catalogue.pdf';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
        window.__lastCatalogue = blob;
      } catch (e) {
        alert('The catalogue could not be prepared. Please try again, or ask us on WhatsApp.');
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = label; }
      }
    },
  };
})();
