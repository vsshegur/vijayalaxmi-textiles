// Small helpers shared by the build.

export const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// "30x60" -> { w: 30, h: 60 }
export function parseSize(s) {
  const m = String(s || '').toLowerCase().match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { w: Number(m[1]), h: Number(m[2]) };
}

export function sizeLabel(s) {
  const p = parseSize(s);
  return p ? `${p.w} × ${p.h} in` : String(s);
}

export function sizeShort(s) {
  const p = parseSize(s);
  return p ? `${p.w}×${p.h}` : String(s);
}

export function sizeCm(s) {
  const p = parseSize(s);
  return p ? `${Math.round(p.w * 2.54)} × ${Math.round(p.h * 2.54)} cm` : '';
}

export function digits(s) {
  return String(s || '').replace(/[^\d]/g, '');
}

// WhatsApp number: add India code when a 10-digit number is given.
export function waNumber(s) {
  const d = digits(s);
  if (!d) return '';
  return d.length === 10 ? `91${d}` : d;
}

export function waLink(settings, text) {
  const n = waNumber(settings.whatsapp || settings.phone);
  if (!n) return '';
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export function paragraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
