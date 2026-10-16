/* Niagara Lite — procedural material textures (white RGB + alpha, tinted by particle color). */
'use strict';

const TEXTURES = {
  glow: { label: 'Radial Glow' }, softDot: { label: 'Soft Dot' }, hardDot: { label: 'Hard Dot' }, ring: { label: 'Ring' },
  spark: { label: 'Spark Streak' }, star: { label: 'Star Twinkle' }, flare: { label: 'Lens Flare Cross' }, smoke: { label: 'Smoke Puff' },
  square: { label: 'Square / Leaf' }, ribbon: { label: 'Ribbon Soft Edge' }, beam: { label: 'Beam (noisy core)' },
  smokeSheet: { label: 'Smoke Flipbook 4×4', grid: [4, 4] }, fireSheet: { label: 'Fire Flipbook 4×4', grid: [4, 4] }, burstSheet: { label: 'Burst Flipbook 4×4', grid: [4, 4] }
};

function _cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function _vnoise(seed) {
  const P = new Uint8Array(512); const r = mulberry32(seed); const a = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  for (let i = 0; i < 512; i++) P[i] = a[i & 255];
  const V = new Float32Array(256).map(() => r());
  const f = t => t * t * (3 - 2 * t);
  const n = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const a0 = V[P[P[X] + Y]], a1 = V[P[P[X + 1] + Y]], b0 = V[P[P[X] + Y + 1]], b1 = V[P[P[X + 1] + Y + 1]], u = f(xf), v = f(yf);
    return lerp(lerp(a0, a1, u), lerp(b0, b1, u), v); };
  return (x, y, oct = 4) => { let s = 0, amp = .5, fr = 1; for (let o = 0; o < oct; o++) { s += amp * n(x * fr, y * fr); fr *= 2; amp *= .5; } return s / (1 - Math.pow(.5, oct)); };
}
function _radial(g, s, stops) { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); for (const [t, a] of stops) gr.addColorStop(t, `rgba(255,255,255,${a})`); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
function _pixels(w, h, fn) {
  const [c, g] = _cnv(w, h), img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = clamp(fn(x, y), 0, 1), i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a * 255; }
  g.putImageData(img, 0, 0); return c;
}
function _sheet(fr, fn) { // 4x4 sheet, fr px per frame
  const [c, g] = _cnv(fr * 4, fr * 4);
  for (let i = 0; i < 16; i++) g.drawImage(_pixels(fr, fr, (x, y) => { const u = x / fr, v = y / fr; return fn(u, v, i / 15, i) * Math.min(1, u * 16, v * 16, (1 - u) * 16, (1 - v) * 16); }), (i % 4) * fr, Math.floor(i / 4) * fr);
  return c;
}
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function makeTextureCanvas(key) {
  const S = 128;
  switch (key) {
    case 'glow': { const [c, g] = _cnv(S, S); _radial(g, S, [[0, 1], [.12, .85], [.3, .35], [.6, .08], [1, 0]]); return c; }
    case 'softDot': { const [c, g] = _cnv(S, S); _radial(g, S, [[0, 1], [.45, .7], [1, 0]]); return c; }
    case 'hardDot': return _pixels(S, S, (x, y) => 1 - ss(.42, .48, Math.hypot(x / S - .5, y / S - .5)));
    case 'ring': return _pixels(S, S, (x, y) => { const d = Math.hypot(x / S - .5, y / S - .5); return ss(.3, .41, d) * (1 - ss(.43, .49, d)); });
    case 'spark': return _pixels(64, S, (x, y) => { const u = (x / 64 - .5) * 2, v = (y / S - .5) * 2; return Math.max(0, 1 - Math.hypot(u * 1.0, v)) ** 1.5 * (1 - ss(.15, 1, Math.abs(u))); });
    case 'star': return _pixels(S, S, (x, y) => { const u = x / S - .5, v = y / S - .5, d = Math.hypot(u, v); const ray = Math.max(Math.exp(-Math.abs(u) * 60) , Math.exp(-Math.abs(v) * 60)) * (1 - ss(0, .5, d)); return Math.min(1, ray + Math.exp(-d * 18)); });
    case 'flare': return _pixels(S, S, (x, y) => { const u = x / S - .5, v = y / S - .5, d = Math.hypot(u, v); return Math.min(1, Math.exp(-Math.abs(v) * 90) * (1 - ss(0, .5, Math.abs(u))) + Math.exp(-d * 10) * .8); });
    case 'smoke': { const N = _vnoise(7); return _pixels(S, S, (x, y) => { const u = x / S - .5, v = y / S - .5, d = Math.hypot(u, v); return (1 - ss(.15, .5, d + (N(x / 22, y / 22) - .5) * .25)) * (.55 + .45 * N(x / 14 + 9, y / 14)); }); }
    case 'square': return _pixels(64, 64, (x, y) => (x > 3 && x < 60 && y > 3 && y < 60) ? 1 : 0);
    case 'ribbon': return _pixels(32, 64, (x, y) => { const v = Math.abs(y / 64 - .5) * 2; return (1 - v * v) ** 1.5; });
    case 'beam': { const N = _vnoise(3); return _pixels(256, 64, (x, y) => { const v = Math.abs(y / 64 - .5) * 2; return Math.min(1, Math.exp(-v * v * 30) + .5 * (1 - v) ** 2 * N(x / 10, y / 6)); }); }
    case 'smokeSheet': { const N = _vnoise(11); return _sheet(128, (u, v, t, i) => { const d = Math.hypot(u - .5, v - .5), r = .22 + .2 * t; return (1 - ss(r * .3, r, d + (N(u * 6 + i * .7, v * 6) - .5) * .22)) * (.5 + .5 * N(u * 9 + 3, v * 9 + i * .4)) * (1 - .55 * t); }); }
    case 'fireSheet': { const N = _vnoise(5); return _sheet(128, (u, v, t, i) => { const y = 1 - v, w = .36 * Math.pow(Math.max(0, 1 - y), .7) + .02, dx = Math.abs(u - .5 + .06 * Math.sin(y * 7 + i)); const n = N(u * 5, v * 5 + i * .45); return ss(0, 1, (1 - dx / w) * 1.3) * (1 - y * .85) * (.35 + .9 * n) * ss(0, .15, v) * ss(0, .06, 1 - v) * ss(0, .08, u) * ss(0, .08, 1 - u); }); }
    case 'burstSheet': { const N = _vnoise(9); return _sheet(128, (u, v, t) => { const d = Math.hypot(u - .5, v - .5), r = .08 + .4 * t, th = .12 * (1 - t) + .02; return (1 - ss(0, th, Math.abs(d - r))) * (1 - t * .8) * (.5 + N(u * 8, v * 8)); }); }
  }
  const [c, g] = _cnv(4, 4); g.fillStyle = '#fff'; g.fillRect(0, 0, 4, 4); return c;
}
