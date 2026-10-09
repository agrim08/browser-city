/* Browser City — shared helpers: seeded randomness, colour math, isometric projection. */
(function () {
  const BC = (window.BC = window.BC || {});
  const U = (BC.util = {});

  U.hash = function (s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  // mulberry32 with a few conveniences hung off the function
  U.rng = function (seed) {
    let a = (typeof seed === 'string' ? U.hash(seed) : seed) >>> 0;
    const r = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (lo, hi) => lo + (hi - lo) * r();
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    r.gauss = () => {
      let u = 0, v = 0;
      while (u === 0) u = r();
      while (v === 0) v = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return r;
  };

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (a, b, x) => {
    const t = U.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  U.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  U.easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  U.easeOutBack = (t) => {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  // ---- colour ----
  const rgbCache = new Map();
  U.rgb = function (hex) {
    let c = rgbCache.get(hex);
    if (c) return c;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    rgbCache.set(hex, c);
    return c;
  };
  U.hex = (r, g, b) =>
    '#' + [r, g, b].map((v) => Math.round(U.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mixCache = new Map();
  U.mix = function (a, b, t) {
    const key = a + b + t;
    let m = mixCache.get(key);
    if (m) return m;
    const A = U.rgb(a), B = U.rgb(b);
    m = U.hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
    if (mixCache.size > 20000) mixCache.clear();
    mixCache.set(key, m);
    return m;
  };
  U.light = (c, t) => U.mix(c, '#ffffff', t);
  U.dark = (c, t) => U.mix(c, '#4a4270', t);
  U.rgba = (c, a) => {
    const A = U.rgb(c);
    return `rgba(${A[0]},${A[1]},${A[2]},${a})`;
  };
  // tint used for night-time versions of things
  U.NIGHT = '#5b5394';
  U.nightTint = (c, n) => (n <= 0 ? c : U.mix(c, U.NIGHT, Math.round(n * 0.4 * 20) / 20));

  // ---- isometric ----
  // tile (i, j) with height z (px) -> world pixel coords. Tiles are 64x32.
  U.iso = (i, j, z = 0) => [(i - j) * 32, (i + j) * 16 - z];
  U.toTile = (x, y) => [(x / 32 + y / 16) / 2, (y / 16 - x / 32) / 2];

  // ---- misc ----
  U.fmt = (n) => Math.round(n).toLocaleString('en-US');
  U.esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  U.hourLabel = (h) => {
    const hh = ((Math.floor(h) % 24) + 24) % 24;
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return h12 + (hh < 12 ? 'am' : 'pm');
  };
  U.clockLabel = (h) => {
    const hh = ((Math.floor(h) % 24) + 24) % 24;
    const mm = Math.floor((h - Math.floor(h)) * 60);
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
  };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  U.dateLabel = (t) => {
    const d = new Date(t);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };
  U.ago = (t, now = Date.now()) => {
    const days = Math.round((now - t) / 864e5);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return days + ' days ago';
    if (days < 60) return Math.round(days / 7) + ' weeks ago';
    if (days < 730) return Math.round(days / 30) + ' months ago';
    return Math.round(days / 365) + ' years ago';
  };
  U.pointInPoly = (x, y, pts) => {
    let inside = false;
    for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
      const xi = pts[a][0], yi = pts[a][1], xj = pts[b][0], yj = pts[b][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  // monotone chain convex hull of [x,y] points (returned CCW in y-down space)
  U.hull = (pts) => {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) {
      while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
      lo.push(q);
    }
    for (let k = p.length - 1; k >= 0; k--) {
      const q = p[k];
      while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
      up.push(q);
    }
    up.pop();
    lo.pop();
    return lo.concat(up);
  };
})();
