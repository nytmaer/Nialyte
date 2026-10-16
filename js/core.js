/* Niagara Lite — core: utilities, parameter schema, module registry.
   Units mirror Unreal: centimetres, Z-up, seconds, degrees. */
'use strict';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
let _uidN = 1;
const uid = () => 'u' + Date.now().toString(36).slice(-5) + (_uidN++).toString(36);
const clone = o => JSON.parse(JSON.stringify(o));

function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function hash(n) { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

const _hexCache = {};
function hex3(h) {
  if (_hexCache[h]) return _hexCache[h];
  const n = parseInt((h || '#ffffff').slice(1), 16);
  return (_hexCache[h] = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]);
}
function rgbHex(r, g, b) { const f = x => Math.round(clamp(x, 0, 1) * 255).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); }

function evalCurve(keys, t) {
  if (!keys || !keys.length) return 1;
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (t <= k.t) { const a = keys[i - 1]; const u = (t - a.t) / ((k.t - a.t) || 1); return a.v + (k.v - a.v) * u; }
  }
  return keys[keys.length - 1].v;
}
const _g = [0, 0, 0, 0];
function evalGrad(stops, t, out = _g) {
  if (!stops || !stops.length) { out[0] = out[1] = out[2] = out[3] = 1; return out; }
  let a = stops[0], b = stops[stops.length - 1];
  if (t <= a.t) b = a; else if (t >= b.t) a = b;
  else for (let i = 1; i < stops.length; i++) if (t <= stops[i].t) { a = stops[i - 1]; b = stops[i]; break; }
  const u = a === b ? 0 : (t - a.t) / ((b.t - a.t) || 1);
  const ca = hex3(a.c), cb = hex3(b.c);
  out[0] = lerp(ca[0], cb[0], u); out[1] = lerp(ca[1], cb[1], u); out[2] = lerp(ca[2], cb[2], u); out[3] = lerp(a.a, b.a, u);
  return out;
}

function rotEuler(x, y, z, r) {
  if (!r || (!r[0] && !r[1] && !r[2])) return [x, y, z];
  let a = r[0] * D2R, c = Math.cos(a), s = Math.sin(a), t;
  t = y * c - z * s; z = y * s + z * c; y = t;
  a = r[1] * D2R; c = Math.cos(a); s = Math.sin(a);
  t = x * c + z * s; z = -x * s + z * c; x = t;
  a = r[2] * D2R; c = Math.cos(a); s = Math.sin(a);
  t = x * c - y * s; y = x * s + y * c; x = t;
  return [x, y, z];
}
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function randDir(rnd) { const z = rnd() * 2 - 1, p = rnd() * TAU, s = Math.sqrt(1 - z * z); return [s * Math.cos(p), s * Math.sin(p), z]; }
function coneDir(axis, ang, rnd) {
  let [ax, ay, az] = norm3(axis);
  const ct = 1 - rnd() * (1 - Math.cos(ang)), st = Math.sqrt(Math.max(0, 1 - ct * ct)), ph = rnd() * TAU;
  let ux, uy, uz;
  if (Math.abs(az) < .9) { ux = -ay; uy = ax; uz = 0; } else { ux = 0; uy = -az; uz = ay; }
  const n = Math.hypot(ux, uy, uz) || 1; ux /= n; uy /= n; uz /= n;
  const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
  const c = Math.cos(ph) * st, s = Math.sin(ph) * st;
  return [ux * c + vx * s + ax * ct, uy * c + vy * s + ay * ct, uz * c + vz * s + az * ct];
}
function rotAxis(x, y, z, a, ang) { // Rodrigues
  const [kx, ky, kz] = norm3(a), c = Math.cos(ang), s = Math.sin(ang), d = (kx * x + ky * y + kz * z) * (1 - c);
  return [x * c + (ky * z - kz * y) * s + kx * d, y * c + (kz * x - kx * z) * s + ky * d, z * c + (kx * y - ky * x) * s + kz * d];
}
// Divergence-free pseudo-curl noise (analytic curl of a trig vector potential, 2 octaves).
function curlNoise(x, y, z, out) {
  out[0] = out[1] = out[2] = 0;
  let amp = 1;
  for (let o = 0; o < 2; o++) {
    const a = 1.7 + o * 3.1, b = .4 + o * 5.3, c = 2.9 + o * 1.9;
    out[0] += amp * (-1.1 * Math.sin(x + c) * Math.sin(1.1 * y) - Math.cos(z + b) * Math.cos(1.7 * x));
    out[1] += amp * (-1.3 * Math.sin(y + a) * Math.sin(1.3 * z) - Math.cos(x + c) * Math.cos(1.1 * y));
    out[2] += amp * (-1.7 * Math.sin(z + b) * Math.sin(1.7 * x) - Math.cos(y + a) * Math.cos(1.3 * z));
    const nx = y * 2.13 + 4.1, ny = z * 2.07 - 1.3, nz = x * 2.21 + 2.7; x = nx; y = ny; z = nz; amp *= .5;
  }
  return out;
}

/* ---------- parameter schema helpers ---------- */
const F = (k, l, d, min, max, step, x) => ({ k, l, t: 'f', d, min, max, step: step || +((max - min) / 200).toPrecision(2), ...x });
const Rg = (k, l, d, min, max, step, x) => ({ k, l, t: 'r', d, min, max, step: step || 1, ...x });
const V3 = (k, l, d, x) => ({ k, l, t: 'v', d, ...x });
const Col = (k, l, d, x) => ({ k, l, t: 'c', d, ...x });
const En = (k, l, d, o, x) => ({ k, l, t: 'e', d, o: o.map(v => Array.isArray(v) ? v : [v, v]), ...x });
const Bo = (k, l, d, x) => ({ k, l, t: 'b', d, ...x });
const Cv = (k, l, d, min, max, x) => ({ k, l, t: 'cv', d, min, max, ...x });
const Gr = (k, l, d, x) => ({ k, l, t: 'g', d, ...x });
const Tx = (k, l, d, x) => ({ k, l, t: 'tx', d, ...x });
const Er = (k, l, x) => ({ k, l, t: 'em', d: '', ...x });
const Tt = (k, l, d, x) => ({ k, l, t: 's', d, ...x });

const cv = (...pts) => pts.map(([t, v]) => ({ t, v }));
const gr = (...st) => st.map(([c, a, t]) => ({ t, c, a }));
const C1 = (c = '#ffffff', i = 1) => ({ c, i });

const SHAPES = [['point', 'Point'], ['sphere', 'Sphere'], ['box', 'Box / Cube'], ['cylinder', 'Cylinder'], ['cone', 'Cone'], ['torus', 'Torus'], ['ring', 'Ring / Disc'], ['line', 'Line'], ['grid', 'Grid']];
const sh = (...s) => p => s.includes(p.shape);

/* ---------- module registry ----------
   stage: emitter (Emitter Update / spawning), spawn (Particle Spawn), update (Particle Update), render.
   phase (update only): force (before velocity solve), vel (after velocity solve), post (after position integrate).
   sl: supported by Lightweight (stateless) emitters per Epic docs.  spec: exported but not previewed. */
const MODS = {
  /* ===== Emitter Update — spawning ===== */
  spawnRate: {
    stage: 'emitter', cat: 'Spawn', name: 'Spawn Rate', sl: 1,
    desc: 'Continuous spawning, particles per second.',
    params: [F('rate', 'Spawn Rate (/s)', 50, 0, 2000, 1), F('prob', 'Spawn Probability', 1, 0, 1, .01)],
    emit(m, P, E, c) {
      const k = m.uid; E.acc[k] = (E.acc[k] || 0) + P.rate * c.dt * c.scale;
      const n = Math.floor(E.acc[k]); E.acc[k] -= n;
      if (P.prob >= 1) return n; let r = 0; for (let i = 0; i < n; i++) if (c.rand() < P.prob) r++; return r;
    }
  },
  spawnBurst: {
    stage: 'emitter', cat: 'Spawn', name: 'Spawn Burst Instantaneous', sl: 1,
    desc: 'Spawns a burst at a time within the loop. Add several for multiple bursts.',
    params: [Rg('count', 'Spawn Count (min–max)', [50, 50], 0, 5000), F('time', 'Spawn Time (s)', 0, 0, 10, .01), F('prob', 'Spawn Probability', 1, 0, 1, .01)],
    emit(m, P, E, c) {
      if (c.pst < P.time && c.st >= P.time) {
        if (P.prob < 1 && c.rand() > P.prob) return 0;
        return Math.round(lerp(P.count[0], P.count[1], c.rand()) * c.scale);
      } return 0;
    }
  },
  spawnPerUnit: {
    stage: 'emitter', cat: 'Spawn', name: 'Spawn Per Unit',
    desc: 'Spawns by distance the component travels. Needs System → Component Motion to see it.',
    params: [F('spacing', 'Spawn Spacing (cm)', 5, .5, 200, .5), F('maxFrame', 'Max Frame Spawn', 200, 1, 2000, 1), F('minMove', 'Movement Tolerance (cm)', .1, 0, 10, .1)],
    emit(m, P, E, c) {
      if (c.dist < P.minMove) return 0;
      const k = m.uid; E.acc[k] = (E.acc[k] || 0) + c.dist / Math.max(.01, P.spacing) * c.scale;
      const n = Math.floor(E.acc[k]); E.acc[k] -= n; return Math.min(n, P.maxFrame);
    }
  },

  /* ===== Particle Spawn ===== */
  init: {
    stage: 'spawn', cat: 'Core', name: 'Initialize Particle', sl: 1,
    desc: 'Lifetime, mass, color, sprite size, rotation and mesh scale at birth.',
    params: [
      Rg('life', 'Lifetime (s)', [1, 2], 0, 30, .05), Rg('mass', 'Mass', [1, 1], 0, 100, .1),
      Col('color', 'Color (× intensity)', C1()),
      En('sizeMode', 'Sprite Size Mode', 'uniform', [['uniform', 'Uniform'], ['nonuniform', 'Non-Uniform']]),
      Rg('size', 'Sprite Size (cm)', [10, 20], 0, 2000, .5),
      Rg('sizeY', 'Sprite Size Y (cm)', [10, 20], 0, 2000, .5, { show: p => p.sizeMode === 'nonuniform' }),
      Rg('rot', 'Sprite Rotation (deg)', [0, 0], -360, 360, 1),
      V3('meshScale', 'Mesh Scale (xyz)', [1, 1, 1]), Rg('meshRand', 'Mesh Scale Random ×', [1, 1], 0, 10, .05)
    ],
    spawn(p, P, c) {
      p.life = Math.max(.01, lerp(P.life[0], P.life[1], c.rand())); p.mass = lerp(P.mass[0], P.mass[1], c.rand()) || 1;
      const [r, g, b] = hex3(P.color.c); p.br = r * P.color.i; p.bg = g * P.color.i; p.bb = b * P.color.i; p.ba = 1;
      const s = lerp(P.size[0], P.size[1], c.rand()); p.bsx = s; p.bsy = P.sizeMode === 'nonuniform' ? lerp(P.sizeY[0], P.sizeY[1], c.rand()) : s;
      p.rot = lerp(P.rot[0], P.rot[1], c.rand()) * D2R;
      const k = lerp(P.meshRand[0], P.meshRand[1], c.rand()); p.bmx = P.meshScale[0] * k; p.bmy = P.meshScale[1] * k; p.bmz = P.meshScale[2] * k;
    }
  },
  shape: {
    stage: 'spawn', cat: 'Location', name: 'Shape Location', sl: 1,
    desc: 'Spawn position from a primitive shape. Rotation/offset place the shape.',
    params: [
      En('shape', 'Shape Primitive', 'sphere', SHAPES),
      F('radius', 'Radius', 50, 0, 2000, 1, { show: sh('sphere', 'cylinder', 'ring') }),
      Bo('surface', 'Surface Only', false, { show: sh('sphere', 'box', 'cylinder', 'cone', 'torus') }),
      Bo('hemi', 'Hemisphere (+Z)', false, { show: sh('sphere') }),
      V3('box', 'Box Size', [100, 100, 100], { show: sh('box') }),
      F('height', 'Cylinder Height', 100, 0, 3000, 1, { show: sh('cylinder') }),
      Bo('centered', 'Centered on Z', false, { show: sh('cylinder') }),
      F('angle', 'Cone Angle (deg)', 30, 0, 89, 1, { show: sh('cone') }),
      F('length', 'Length', 100, 0, 3000, 1, { show: sh('cone', 'line') }),
      F('major', 'Torus Major Radius', 100, 0, 2000, 1, { show: sh('torus') }),
      F('minor', 'Torus Minor Radius', 20, 0, 500, 1, { show: sh('torus') }),
      F('coverage', 'Disc Coverage (0=ring)', 0, 0, 1, .01, { show: sh('ring') }),
      F('arc', 'Arc (deg)', 360, 0, 360, 1, { show: sh('ring', 'torus', 'cylinder') }),
      En('axis', 'Line Axis', 'x', ['x', 'y', 'z'], { show: sh('line') }),
      V3('gridCount', 'Grid Count (xyz)', [8, 8, 1], { show: sh('grid') }),
      V3('gridSize', 'Grid Size', [400, 400, 0], { show: sh('grid') }),
      F('jitter', 'Jitter (cm)', 0, 0, 200, .5, { show: sh('grid', 'line', 'point') }),
      V3('rotation', 'Shape Rotation (deg)', [0, 0, 0]), V3('offset', 'Offset', [0, 0, 0])
    ],
    spawn(p, P, c) {
      const R = c.rand; let x = 0, y = 0, z = 0, n = [0, 0, 1];
      switch (P.shape) {
        case 'sphere': { const d = randDir(R); if (P.hemi) d[2] = Math.abs(d[2]); const r = P.surface ? P.radius : P.radius * Math.cbrt(R()); x = d[0] * r; y = d[1] * r; z = d[2] * r; n = d; break; }
        case 'box': {
          const b = P.box; x = (R() - .5) * b[0]; y = (R() - .5) * b[1]; z = (R() - .5) * b[2];
          if (P.surface) { const ax = Math.floor(R() * 3), sg = R() < .5 ? -.5 : .5; if (ax === 0) x = sg * b[0]; else if (ax === 1) y = sg * b[1]; else z = sg * b[2]; }
          n = norm3([x || 1e-6, y, z]); break;
        }
        case 'cylinder': { const a = R() * P.arc * D2R, r = P.surface ? P.radius : P.radius * Math.sqrt(R()); x = Math.cos(a) * r; y = Math.sin(a) * r; z = R() * P.height - (P.centered ? P.height / 2 : 0); n = [Math.cos(a), Math.sin(a), 0]; break; }
        case 'cone': { const h = P.length * Math.cbrt(R()), maxr = h * Math.tan(P.angle * D2R), r = P.surface ? maxr : maxr * Math.sqrt(R()), a = R() * TAU; x = Math.cos(a) * r; y = Math.sin(a) * r; z = h; n = norm3([x, y, z || 1]); break; }
        case 'torus': { const u = R() * P.arc * D2R, v = R() * TAU, r = P.surface ? P.minor : P.minor * Math.sqrt(R()); x = (P.major + r * Math.cos(v)) * Math.cos(u); y = (P.major + r * Math.cos(v)) * Math.sin(u); z = r * Math.sin(v); n = [Math.cos(v) * Math.cos(u), Math.cos(v) * Math.sin(u), Math.sin(v)]; break; }
        case 'ring': { const a = R() * P.arc * D2R, r = P.radius * Math.sqrt(1 - P.coverage * R()); x = Math.cos(a) * r; y = Math.sin(a) * r; n = [Math.cos(a), Math.sin(a), 0]; break; }
        case 'line': { const t = (R() - .5) * P.length; if (P.axis === 'x') x = t; else if (P.axis === 'y') y = t; else z = t; break; }
        case 'grid': {
          const gc = P.gridCount.map(v => Math.max(1, Math.round(v))), tot = gc[0] * gc[1] * gc[2], i = (c.E.gridIdx++) % tot;
          const ix = i % gc[0], iy = Math.floor(i / gc[0]) % gc[1], iz = Math.floor(i / (gc[0] * gc[1])) % gc[2];
          const f = (k, n2) => n2 > 1 ? k / (n2 - 1) - .5 : 0;
          x = f(ix, gc[0]) * P.gridSize[0]; y = f(iy, gc[1]) * P.gridSize[1]; z = f(iz, gc[2]) * P.gridSize[2]; break;
        }
      }
      if (P.jitter && (P.shape === 'grid' || P.shape === 'line' || P.shape === 'point')) { const d = randDir(R), j = P.jitter * R(); x += d[0] * j; y += d[1] * j; z += d[2] * j; }
      [x, y, z] = rotEuler(x, y, z, P.rotation); n = rotEuler(n[0], n[1], n[2], P.rotation);
      p.x = x + P.offset[0]; p.y = y + P.offset[1]; p.z = z + P.offset[2]; p.nx = n[0]; p.ny = n[1]; p.nz = n[2];
    }
  },
  addVel: {
    stage: 'spawn', cat: 'Velocity', name: 'Add Velocity', sl: 1,
    desc: 'Velocity Mode: Linear, In Cone, or From Point (radial from the shape origin).',
    params: [
      En('mode', 'Velocity Mode', 'linear', [['linear', 'Linear'], ['cone', 'In Cone'], ['point', 'From Point']]),
      V3('vel', 'Velocity', [0, 0, 100], { show: p => p.mode === 'linear' }),
      V3('spread', 'Random ± per axis', [0, 0, 0], { show: p => p.mode === 'linear' }),
      Rg('speed', 'Speed (min–max)', [100, 200], 0, 10000, 1, { show: p => p.mode !== 'linear' }),
      V3('axis', 'Cone Axis', [0, 0, 1], { show: p => p.mode === 'cone' }),
      F('angle', 'Cone Angle (deg)', 25, 0, 180, 1, { show: p => p.mode === 'cone' }),
      V3('origin', 'Point Origin Offset', [0, 0, 0], { show: p => p.mode === 'point' }),
      Bo('useNormal', 'Use Shape Normal', false, { show: p => p.mode === 'point', help: 'Push along the shape surface normal instead of away from the origin' })
    ],
    spawn(p, P, c) {
      const R = c.rand;
      if (P.mode === 'linear') { p.vx += P.vel[0] + (R() * 2 - 1) * P.spread[0]; p.vy += P.vel[1] + (R() * 2 - 1) * P.spread[1]; p.vz += P.vel[2] + (R() * 2 - 1) * P.spread[2]; return; }
      const s = lerp(P.speed[0], P.speed[1], R()); let d;
      if (P.mode === 'cone') d = coneDir(P.axis, P.angle * D2R, R);
      else if (P.useNormal) d = [p.nx, p.ny, p.nz];
      else { const dx = p.x - P.origin[0], dy = p.y - P.origin[1], dz = p.z - P.origin[2]; d = Math.hypot(dx, dy, dz) > 1e-4 ? norm3([dx, dy, dz]) : randDir(R); }
      p.vx += d[0] * s; p.vy += d[1] * s; p.vz += d[2] * s;
    }
  },
  inheritVel: {
    stage: 'spawn', cat: 'Velocity', name: 'Inherit Velocity',
    desc: 'Adds the component’s velocity (see Component Motion).',
    params: [F('scale', 'Velocity Scale', 1, -2, 2, .01)],
    spawn(p, P, c) { p.vx += c.cvx * P.scale; p.vy += c.cvy * P.scale; p.vz += c.cvz * P.scale; }
  },
  randColor: {
    stage: 'spawn', cat: 'Color', name: 'Random Color from Gradient',
    desc: 'Initial color picked at random from a gradient (Random Range Linear Color).',
    params: [Gr('grad', 'Gradient', gr(['#ff3355', 1, 0], ['#ffd23f', 1, .33], ['#3ee07a', 1, .66], ['#3fa7ff', 1, 1])), F('intensity', 'Intensity', 1, 0, 20, .05), Bo('stepped', 'Pick Stops Only', true)],
    spawn(p, P, c) {
      let col; if (P.stepped) { const s = P.grad[Math.floor(c.rand() * P.grad.length)]; const h = hex3(s.c); col = [h[0], h[1], h[2], s.a]; } else col = evalGrad(P.grad, c.rand(), []);
      p.br = col[0] * P.intensity; p.bg = col[1] * P.intensity; p.bb = col[2] * P.intensity; p.ba = col[3];
    }
  },
  meshOrient: {
    stage: 'spawn', cat: 'Orientation', name: 'Initial Mesh Orientation', sl: 1,
    desc: 'Mesh orientation at birth plus a tumble rate around a random axis.',
    params: [En('mode', 'Orientation', 'random', [['random', 'Random'], ['fixed', 'Fixed'], ['normal', 'Align X to Shape Normal']]), V3('fixed', 'Fixed Rotation (deg)', [0, 0, 0], { show: p => p.mode === 'fixed' }), Rg('rate', 'Rotation Rate (deg/s)', [0, 0], -2000, 2000, 1)],
    spawn(p, P, c) {
      if (P.mode === 'random') { const d = randDir(c.rand); p.axx = d[0]; p.axy = d[1]; p.axz = d[2]; p.mang = c.rand() * TAU; }
      else if (P.mode === 'normal') { const nx = p.nx, ny = p.ny, nz = p.nz, ax = norm3([0, -nz, ny]); const l = Math.hypot(0, -nz, ny); if (l > 1e-5) { p.axx = ax[0]; p.axy = ax[1]; p.axz = ax[2]; p.mang = Math.acos(clamp(nx, -1, 1)); } else if (nx < 0) { p.axz = 1; p.mang = Math.PI; } }
      else { const v = P.fixed; const l = Math.hypot(v[0], v[1], v[2]); if (l > 0) { p.axx = v[0] / l; p.axy = v[1] / l; p.axz = v[2] / l; p.mang = l * D2R; } }
      p.mrate = lerp(P.rate[0], P.rate[1], c.rand()) * D2R;
    }
  },
  beam: {
    stage: 'spawn', cat: 'Location', name: 'Beam Emitter Setup',
    desc: 'Places a burst’s particles along a beam from Start to End. Pair with a Ribbon Renderer.',
    params: [V3('start', 'Beam Start', [-300, 0, 150]), V3('end', 'Beam End', [300, 0, 150]), F('arc', 'Arc Height', 0, -1000, 1000, 1), F('jitter', 'Jitter', 20, 0, 300, 1), Bo('taper', 'Pin Ends (no jitter at ends)', true)],
    spawn(p, P, c) {
      const t = c.n > 1 ? c.i / (c.n - 1) : 0, w = P.taper ? Math.sin(Math.PI * t) : 1, d = randDir(c.rand);
      p.x = lerp(P.start[0], P.end[0], t) + d[0] * P.jitter * w; p.y = lerp(P.start[1], P.end[1], t) + d[1] * P.jitter * w;
      p.z = lerp(P.start[2], P.end[2], t) + d[2] * P.jitter * w + Math.sin(Math.PI * t) * P.arc;
    }
  },

  /* ===== Particle Update ===== */
  gravity: { stage: 'update', cat: 'Forces', name: 'Gravity Force', sl: 1, desc: 'Constant acceleration, default Earth gravity in cm/s².', params: [V3('g', 'Gravity', [0, 0, -980])], update(p, P) { p.fx += P.g[0]; p.fy += P.g[1]; p.fz += P.g[2]; } },
  accel: { stage: 'update', cat: 'Forces', name: 'Acceleration Force', sl: 1, desc: 'Constant acceleration (ignores mass).', params: [V3('a', 'Acceleration', [0, 0, 200])], update(p, P) { p.fx += P.a[0]; p.fy += P.a[1]; p.fz += P.a[2]; } },
  linearForce: { stage: 'update', cat: 'Forces', name: 'Linear Force', desc: 'Force divided by particle mass.', params: [V3('f', 'Force', [100, 0, 0])], update(p, P) { const m = p.mass || 1; p.fx += P.f[0] / m; p.fy += P.f[1] / m; p.fz += P.f[2] / m; } },
  drag: { stage: 'update', cat: 'Forces', name: 'Drag', sl: 1, desc: 'Velocity and rotational damping.', params: [F('drag', 'Drag', 1, 0, 20, .05), F('rotDrag', 'Rotational Drag', 0, 0, 20, .05)], update(p, P, c) { p.drag += P.drag; if (P.rotDrag) { const k = Math.exp(-P.rotDrag * c.dt); p.mrate *= k; p.srate *= k; } } },
  wind: { stage: 'update', cat: 'Forces', name: 'Wind Force', desc: 'Pushes particles toward the wind velocity.', params: [V3('wind', 'Wind Speed', [200, 0, 0]), F('resist', 'Air Resistance', .5, 0, 10, .01)], update(p, P) { p.fx += (P.wind[0] - p.vx) * P.resist; p.fy += (P.wind[1] - p.vy) * P.resist; p.fz += (P.wind[2] - p.vz) * P.resist; } },
  curl: {
    stage: 'update', cat: 'Forces', name: 'Curl Noise Force', sl: 1, desc: 'Swirling, divergence-free turbulence.',
    params: [F('strength', 'Noise Strength', 200, 0, 5000, 1), F('freq', 'Noise Frequency', .01, .0005, .1, .0005), V3('pan', 'Pan Noise Field (cm/s)', [0, 0, 0])],
    update(p, P, c) {
      const f = P.freq, t = c.t, o = c.tmp;
      curlNoise((p.x + c.ox + P.pan[0] * t) * f, (p.y + c.oy + P.pan[1] * t) * f, (p.z + c.oz + P.pan[2] * t) * f, o);
      p.fx += o[0] * P.strength; p.fy += o[1] * P.strength; p.fz += o[2] * P.strength;
    }
  },
  vortex: {
    stage: 'update', cat: 'Forces', name: 'Vortex Force', desc: 'Spins particles around an axis, optionally pulling them in.',
    params: [V3('axis', 'Vortex Axis', [0, 0, 1]), F('amount', 'Vortex Force Amount', 500, -10000, 10000, 10), F('pull', 'Origin Pull', 0, -10000, 10000, 10), V3('center', 'Vortex Origin Offset', [0, 0, 0])],
    update(p, P) {
      const [ax, ay, az] = norm3(P.axis); let rx = p.x - P.center[0], ry = p.y - P.center[1], rz = p.z - P.center[2];
      const d = rx * ax + ry * ay + rz * az; rx -= ax * d; ry -= ay * d; rz -= az * d;
      const l = Math.hypot(rx, ry, rz); if (l < 1e-3) return; rx /= l; ry /= l; rz /= l;
      const tx = ay * rz - az * ry, ty = az * rx - ax * rz, tz = ax * ry - ay * rx;
      p.fx += tx * P.amount - rx * P.pull; p.fy += ty * P.amount - ry * P.pull; p.fz += tz * P.amount - rz * P.pull;
    }
  },
  attract: {
    stage: 'update', cat: 'Forces', name: 'Point Attraction Force', desc: 'Pulls toward a point; negative strength pushes. Kill Radius removes arrivals.',
    params: [F('strength', 'Attraction Strength', 1000, -20000, 20000, 10), F('radius', 'Attraction Radius', 500, 1, 5000, 1), F('falloff', 'Falloff Exponent', 1, 0, 8, .1), F('kill', 'Kill Radius', 0, 0, 500, 1), V3('center', 'Attractor Position', [0, 0, 0])],
    update(p, P) {
      const dx = P.center[0] - p.x, dy = P.center[1] - p.y, dz = P.center[2] - p.z, d = Math.hypot(dx, dy, dz);
      if (d < P.kill) { p.dead = true; return; } if (d > P.radius || d < 1e-3) return;
      const f = P.strength * Math.pow(1 - d / P.radius, P.falloff) / d; p.fx += dx * f; p.fy += dy * f; p.fz += dz * f;
    }
  },
  limitVel: { stage: 'update', cat: 'Forces', name: 'Limit Velocity', phase: 'vel', desc: 'Clamps speed after forces are solved.', params: [F('max', 'Max Speed', 500, 0, 10000, 1)], update(p, P) { const s = Math.hypot(p.vx, p.vy, p.vz); if (s > P.max) { const k = P.max / s; p.vx *= k; p.vy *= k; p.vz *= k; } } },
  rotateAround: {
    stage: 'update', cat: 'Location', name: 'Rotate Around Point', sl: 1, phase: 'post', desc: 'Orbits particle positions around a center.',
    params: [F('rate', 'Rotation Rate (deg/s)', 90, -2000, 2000, 1), V3('axis', 'Rotation Axis', [0, 0, 1]), V3('center', 'Center Offset', [0, 0, 0])],
    update(p, P, c) { const [x, y, z] = rotAxis(p.x - P.center[0], p.y - P.center[1], p.z - P.center[2], P.axis, P.rate * D2R * c.dt); p.x = x + P.center[0]; p.y = y + P.center[1]; p.z = z + P.center[2]; }
  },
  color: {
    stage: 'update', cat: 'Color', name: 'Color', desc: 'Color over normalized age from a gradient.',
    params: [Gr('grad', 'Color Over Life', gr(['#ffffff', 1, 0], ['#ffffff', 0, 1])), En('mode', 'Apply', 'multiply', [['multiply', 'Multiply initial color'], ['set', 'Set (overwrite)']]), F('intensity', 'Intensity', 1, 0, 50, .05)],
    update(p, P) { const g = evalGrad(P.grad, p.na), k = P.intensity; if (P.mode === 'set') { p.r = g[0] * k; p.g = g[1] * k; p.b = g[2] * k; p.a = g[3]; } else { p.r *= g[0] * k; p.g *= g[1] * k; p.b *= g[2] * k; p.a *= g[3]; } }
  },
  scaleColor: {
    stage: 'update', cat: 'Color', name: 'Scale Color', sl: 1, desc: 'Scales RGB and alpha; alpha follows a curve over life.',
    params: [V3('rgb', 'Scale RGB', [1, 1, 1]), Cv('alpha', 'Scale Alpha Over Life', cv([0, 1], [1, 1]), 0, 1)],
    update(p, P) { p.r *= P.rgb[0]; p.g *= P.rgb[1]; p.b *= P.rgb[2]; p.a *= evalCurve(P.alpha, p.na); }
  },
  scaleSprite: {
    stage: 'update', cat: 'Size', name: 'Scale Sprite Size', sl: 1, desc: 'Sprite size multiplier over normalized age.',
    params: [En('mode', 'Mode', 'uniform', [['uniform', 'Uniform'], ['nonuniform', 'Non-Uniform (X/Y)']]), Cv('curve', 'Scale (X) Over Life', cv([0, 1], [1, 1]), 0, 4), Cv('curveY', 'Scale Y Over Life', cv([0, 1], [1, 1]), 0, 4, { show: p => p.mode === 'nonuniform' })],
    update(p, P) { const a = evalCurve(P.curve, p.na); p.sx *= a; p.sy *= P.mode === 'nonuniform' ? evalCurve(P.curveY, p.na) : a; }
  },
  scaleSpriteSpeed: {
    stage: 'update', cat: 'Size', name: 'Scale Sprite Size By Speed', sl: 1, desc: 'Stretches sprites as they move faster.',
    params: [F('min', 'Velocity Threshold Min', 0, 0, 5000, 1), F('max', 'Velocity Threshold Max', 500, 1, 10000, 1), F('sx', 'Scale X at Max', 1, 0, 10, .05), F('sy', 'Scale Y at Max', 3, 0, 10, .05)],
    update(p, P) { const t = clamp((Math.hypot(p.vx, p.vy, p.vz) - P.min) / Math.max(1, P.max - P.min), 0, 1); p.sx *= lerp(1, P.sx, t); p.sy *= lerp(1, P.sy, t); }
  },
  scaleMesh: { stage: 'update', cat: 'Size', name: 'Scale Mesh Size', sl: 1, desc: 'Mesh scale multiplier over life.', params: [Cv('curve', 'Scale Over Life', cv([0, 1], [1, 1]), 0, 4)], update(p, P) { const k = evalCurve(P.curve, p.na); p.mx *= k; p.my *= k; p.mz *= k; } },
  scaleMeshSpeed: {
    stage: 'update', cat: 'Size', name: 'Scale Mesh Size By Speed', sl: 1, desc: 'Scales meshes by speed.',
    params: [F('min', 'Velocity Threshold Min', 0, 0, 5000, 1), F('max', 'Velocity Threshold Max', 800, 1, 10000, 1), V3('scale', 'Scale at Max', [2, 1, 1])],
    update(p, P) { const t = clamp((Math.hypot(p.vx, p.vy, p.vz) - P.min) / Math.max(1, P.max - P.min), 0, 1); p.mx *= lerp(1, P.scale[0], t); p.my *= lerp(1, P.scale[1], t); p.mz *= lerp(1, P.scale[2], t); }
  },
  spriteRot: {
    stage: 'update', cat: 'Orientation', name: 'Sprite Rotation Rate', sl: 1, desc: 'Spins sprites; each particle picks a rate in the range.',
    params: [Rg('rate', 'Rotation Rate (deg/s)', [-90, 90], -3600, 3600, 1)],
    update(p, P, c) { p.rot += (lerp(P.rate[0], P.rate[1], hash(p.id * 1.37 + 3)) * D2R + p.srate) * c.dt; }
  },
  subuv: {
    stage: 'update', cat: 'Material', name: 'Sub UV Animation', sl: 1, desc: 'Flipbook frame selection. Frame count comes from the Sprite Renderer’s Sub Image Size.',
    params: [En('mode', 'Animation Mode', 'linear', [['linear', 'Linear (over life)'], ['random', 'Random (fixed frame)'], ['loop', 'Infinite Loop (FPS)']]), F('start', 'Start Frame', 0, 0, 255, 1), F('end', 'End Frame (-1 = last)', -1, -1, 255, 1), F('fps', 'Frames Per Second', 16, 0, 120, 1, { show: p => p.mode === 'loop' }), Bo('randStart', 'Random Start Frame', false, { show: p => p.mode === 'loop' })],
    update(p, P, c) {
      const N = c.frames, s = Math.min(P.start, N - 1), e = P.end < 0 ? N - 1 : Math.min(P.end, N - 1), span = Math.max(1, e - s + 1);
      if (P.mode === 'linear') p.frame = s + Math.min(span - 1, Math.floor(p.na * span));
      else if (P.mode === 'random') p.frame = s + Math.floor(hash(p.id * 7.13) * span);
      else p.frame = s + Math.floor(p.age * P.fps + (P.randStart ? hash(p.id * 3.7) * span : 0)) % span;
    }
  },
  dynParam: { stage: 'update', cat: 'Material', name: 'Dynamic Material Parameters', desc: 'Drives a material parameter over life — previewed as emissive brightness.', params: [Cv('curve', 'Emissive Over Life', cv([0, 1], [1, 1]), 0, 10)], update(p, P) { p.emis *= evalCurve(P.curve, p.na); } },
  camOffset: { stage: 'update', cat: 'Location', name: 'Camera Offset', desc: 'Pushes sprites toward (+) or away from (−) the camera at render time.', params: [F('amount', 'Camera Offset (cm)', 50, -1000, 1000, 1)], update(p, P) { p.camOff += P.amount; } },
  collision: {
    stage: 'update', cat: 'Collision', name: 'Collision', phase: 'post', desc: 'Collides with the ground plane (stand-in for scene depth / ray-traced collision).',
    params: [F('floor', 'Ground Height (world Z)', 0, -1000, 1000, 1), F('radius', 'Particle Radius', 2, 0, 200, .5), F('rest', 'Restitution (bounce)', .4, 0, 1.2, .01), F('friction', 'Friction', .2, 0, 1, .01), F('restSpeed', 'Rest Speed Threshold', 10, 0, 500, 1), Bo('kill', 'Kill On Collision', false), F('maxBounce', 'Max Collisions (0 = ∞)', 0, 0, 50, 1), Bo('event', 'Generate Collision Event', false)],
    update(p, P, c) {
      const wz = p.z + c.oz, fl = P.floor + P.radius;
      if (wz < fl && p.vz < 0) {
        if (P.event) c.emitEvent('collision', p);
        p.bounces++;
        if (P.kill || (P.maxBounce > 0 && p.bounces >= P.maxBounce)) { p.dead = true; return; }
        p.z = fl - c.oz; p.vz = -p.vz * P.rest; p.vx *= 1 - P.friction; p.vy *= 1 - P.friction;
        if (Math.abs(p.vz) < P.restSpeed) p.vz = 0;
        p.mrate *= 1 - P.friction;
      }
    }
  },
  killVolume: {
    stage: 'update', cat: 'Kill', name: 'Kill Particles In Volume', phase: 'post', desc: 'Kills particles inside (or outside, if inverted) a sphere or box.',
    params: [En('shape', 'Volume', 'sphere', [['sphere', 'Sphere'], ['box', 'Box']]), V3('center', 'Center', [0, 0, 0]), F('radius', 'Sphere Radius', 50, 0, 5000, 1, { show: p => p.shape === 'sphere' }), V3('box', 'Box Size', [200, 200, 200], { show: p => p.shape === 'box' }), Bo('invert', 'Invert (kill outside)', false)],
    update(p, P) {
      const dx = p.x - P.center[0], dy = p.y - P.center[1], dz = p.z - P.center[2];
      const inside = P.shape === 'sphere' ? dx * dx + dy * dy + dz * dz < P.radius * P.radius : Math.abs(dx) < P.box[0] / 2 && Math.abs(dy) < P.box[1] / 2 && Math.abs(dz) < P.box[2] / 2;
      if (inside !== P.invert) p.dead = true;
    }
  },
  locEvent: { stage: 'update', cat: 'Events', name: 'Generate Location Event', desc: 'Emits location events other emitters can spawn from (e.g. trails).', params: [F('rate', 'Events per Second (per particle)', 30, 0, 240, 1)], update(p, P, c) { p.locAcc += P.rate * c.dt; while (p.locAcc >= 1) { p.locAcc -= 1; c.emitEvent('location', p); } } },
  deathEvent: { stage: 'update', cat: 'Events', name: 'Generate Death Event', desc: 'Emits an event when a particle dies (e.g. secondary explosions).', params: [], update() { } },

  /* ===== Renderers ===== */
  sprite: {
    stage: 'render', cat: 'Renderers', name: 'Sprite Renderer', sl: 1, desc: 'Camera-facing quads with a material texture and optional flipbook.',
    params: [
      Tx('tex', 'Material Texture', 'glow'), F('cols', 'Sub Image Size X', 1, 1, 16, 1), F('rows', 'Sub Image Size Y', 1, 1, 16, 1),
      En('blend', 'Blend Mode', 'additive', [['additive', 'Additive'], ['translucent', 'Translucent'], ['premult', 'Alpha Composite'], ['modulate', 'Modulate'], ['masked', 'Masked'], ['opaque', 'Opaque']]),
      En('align', 'Alignment', 'unaligned', [['unaligned', 'Unaligned'], ['velocity', 'Velocity Aligned'], ['custom', 'Custom Alignment']]),
      En('facing', 'Facing Mode', 'cameraPlane', [['cameraPlane', 'Face Camera Plane'], ['cameraPos', 'Face Camera Position'], ['custom', 'Custom Facing Vector']]),
      V3('alignVec', 'Custom Alignment Vector', [0, 0, 1], { show: p => p.align === 'custom' }),
      V3('faceVec', 'Custom Facing Vector', [0, 0, 1], { show: p => p.facing === 'custom' }),
      F('stretch', 'Velocity Stretch (per cm/s)', 0, 0, .05, .0005, { show: p => p.align === 'velocity' }),
      F('pivotX', 'Pivot Offset U', .5, -1, 2, .01), F('pivotY', 'Pivot Offset V', .5, -1, 2, .01),
      En('sort', 'Sort Mode', 'none', [['none', 'None'], ['depth', 'View Depth'], ['distance', 'View Distance'], ['oldest', 'Oldest First'], ['newest', 'Newest First']]),
      F('emissive', 'Emissive Multiplier', 1, 0, 20, .05), F('sizeScale', 'Size Scale', 1, 0, 10, .05), F('order', 'Sort Order Hint', 0, -10, 10, 1)
    ]
  },
  ribbon: {
    stage: 'render', cat: 'Renderers', name: 'Ribbon Renderer', desc: 'Links particles in spawn order into a strip. Width comes from Sprite Size X.',
    params: [
      Tx('tex', 'Material Texture', 'ribbon'),
      En('blend', 'Blend Mode', 'additive', [['additive', 'Additive'], ['translucent', 'Translucent'], ['premult', 'Alpha Composite'], ['modulate', 'Modulate'], ['opaque', 'Opaque']]),
      En('facing', 'Facing Mode', 'screen', [['screen', 'Screen'], ['custom', 'Custom'], ['side', 'Custom Side Vector']]),
      V3('faceVec', 'Custom Facing / Side Vector', [0, 0, 1], { show: p => p.facing !== 'screen' }),
      F('width', 'Width Scale', 1, 0, 10, .05), F('tess', 'Tessellation (per segment)', 2, 0, 8, 1),
      En('uv', 'UV Mode', 'stretch', [['stretch', 'Scale UV to Ribbon Length'], ['distance', 'Tile by Distance'], ['segment', 'Tile per Segment']]),
      F('tile', 'Tile Size (cm)', 100, 1, 2000, 1, { show: p => p.uv === 'distance' }),
      En('link', 'Ribbon Link', 'emitter', [['emitter', 'One ribbon per emitter'], ['burst', 'One ribbon per spawn batch']]),
      En('linkOrder', 'Link Order', 'newest', [['newest', 'Newest → Oldest'], ['oldest', 'Oldest → Newest']]),
      F('emissive', 'Emissive Multiplier', 1, 0, 20, .05), F('order', 'Sort Order Hint', 0, -10, 10, 1)
    ]
  },
  mesh: {
    stage: 'render', cat: 'Renderers', name: 'Mesh Renderer', desc: 'Instanced meshes (100 cm base size, like engine basic shapes).',
    params: [
      En('mesh', 'Mesh', 'cube', [['cube', 'Cube'], ['sphere', 'Sphere'], ['shard', 'Shard'], ['cone', 'Cone'], ['cylinder', 'Cylinder'], ['quad', 'Plane (two-sided)']]),
      En('shading', 'Shading', 'lit', [['lit', 'Lit'], ['unlit', 'Unlit / Emissive']]),
      En('blend', 'Blend Mode', 'opaque', [['opaque', 'Opaque'], ['masked', 'Masked'], ['translucent', 'Translucent'], ['additive', 'Additive']]),
      En('facing', 'Facing Mode', 'default', [['default', 'Default (orientation)'], ['velocity', 'Velocity'], ['camera', 'Camera Position']]),
      F('scale', 'Scale Multiplier', 1, 0, 10, .05), F('emissive', 'Emissive Multiplier', 1, 0, 20, .05), F('order', 'Sort Order Hint', 0, -10, 10, 1)
    ]
  },
  light: {
    stage: 'render', cat: 'Renderers', name: 'Light Renderer', desc: 'A point light per particle. Preview lights the ground and lit meshes (16 max).',
    params: [F('radiusScale', 'Radius Scale (× sprite size)', 2, 0, 50, .05), F('intensity', 'Color Scale / Intensity', 1, 0, 50, .05), En('colorMode', 'Light Color', 'particle', [['particle', 'Particle Color'], ['override', 'Override']]), Col('color', 'Override Color', C1('#ffaa55'), { show: p => p.colorMode === 'override' }), Bo('alpha', 'Alpha Scales Color', true), Bo('glow', 'Preview Glow Sprite', true), F('glowScale', 'Glow Size', .35, 0, 3, .01, { show: p => p.glow })]
  },
  decal: {
    stage: 'render', cat: 'Renderers', name: 'Decal Renderer', desc: 'Projects the texture onto the ground under each particle.',
    params: [Tx('tex', 'Decal Material Texture', 'ring'), En('blend', 'Blend Mode', 'additive', [['additive', 'Additive'], ['translucent', 'Translucent'], ['modulate', 'Modulate']]), F('sizeScale', 'Decal Size (× sprite size)', 1, 0, 20, .05), F('fadeHeight', 'Fade Above Ground (cm)', 300, 1, 5000, 1), F('emissive', 'Emissive Multiplier', 1, 0, 20, .05)]
  },
  component: { stage: 'render', cat: 'Renderers', name: 'Component Renderer', spec: 1, desc: 'Spawns scene components (lights, meshes, audio…) per particle. Exported only — not previewed here.', params: [Tt('cls', 'Component Class', 'PointLightComponent'), F('max', 'Component Count Limit', 15, 1, 100, 1)] },
  volume: { stage: 'render', cat: 'Renderers', name: 'Volume Renderer', spec: 1, desc: 'Renders heterogeneous volumes (smoke/fire grids). Exported only — not previewed here.', params: [Tt('material', 'Volume Material', 'M_HeterogeneousVolume'), F('res', 'Grid Resolution', 64, 8, 256, 1)] }
};
for (const k in MODS) MODS[k].id = k;

const STAGES = [
  ['emitter', 'Emitter Update', 'Spawning (Spawn Rate, Bursts, Per Unit)'],
  ['spawn', 'Particle Spawn', 'Runs once when a particle is born'],
  ['update', 'Particle Update', 'Runs every frame for every particle'],
  ['events', 'Event Handlers', 'Spawn from another emitter’s events'],
  ['render', 'Render', 'Renderers draw the particle data']
];
const STAGE_KEY = { emitter: 'emit', spawn: 'spawn', update: 'update', render: 'render' };

const EVENT_PARAMS = [
  Er('src', 'Source Emitter'), En('type', 'Event Type', 'death', [['death', 'Death'], ['collision', 'Collision'], ['location', 'Location']]),
  F('count', 'Spawn Number', 10, 0, 500, 1), F('max', 'Max Events Per Frame', 64, 1, 2000, 1), F('inherit', 'Inherit Velocity Scale', 0, -2, 2, .01), Bo('useSpawn', 'Run Particle Spawn Modules', true)
];

const EMITTER_PARAMS = [
  Tt('name', 'Emitter Name', 'Emitter'),
  En('mode', 'Emitter Mode', 'standard', [['standard', 'Standard (stateful)'], ['stateless', 'Lightweight (stateless, UE 5.4+)']], { help: 'Lightweight emitters only support a fixed module set' }),
  En('sim', 'Sim Target', 'cpu', [['cpu', 'CPUSim'], ['gpu', 'GPUCompute Sim']], { help: 'Exported setting; the preview always simulates on CPU' }),
  Bo('local', 'Local Space', false, { help: 'Particles move with the component' }),
  Bo('det', 'Determinism', false), F('seed', 'Random Seed', 1, 0, 99999, 1, { show: p => p.det }),
  Bo('interp', 'Interpolated Spawning', true),
  F('max', 'Max Particles (preview cap)', 4000, 1, 30000, 1),
  En('loop', 'Loop Behavior', 'infinite', [['infinite', 'Infinite'], ['once', 'Once'], ['multiple', 'Multiple']]),
  F('loopCount', 'Loop Count', 3, 1, 100, 1, { show: p => p.loop === 'multiple' }),
  F('dur', 'Loop Duration (s)', 2, .05, 60, .05), F('delay', 'Loop Delay (s)', 0, 0, 30, .05), Bo('delayFirst', 'Delay First Loop Only', false),
  F('scale', 'Spawn Count Scale', 1, 0, 5, .05)
];

const SYSTEM_PARAMS = [
  Tt('name', 'System Name', 'NS_Effect'),
  F('warmup', 'Warmup Time (s)', 0, 0, 20, .1), F('warmupDt', 'Warmup Tick Delta', 1 / 30, .005, .2, .005),
  Bo('fixedTick', 'Fixed Tick Delta', false), F('tickRate', 'Fixed Tick Rate (Hz)', 60, 10, 240, 1, { show: p => p.fixedTick }),
  F('timeScale', 'Preview Time Dilation', 1, 0, 3, .05), F('spawnScale', 'Scalability: Spawn Count Scale', 1, 0, 3, .05),
  En('motion', 'Component Motion (preview)', 'none', [['none', 'Static'], ['orbit', 'Orbit'], ['line', 'Back & Forth'], ['figure8', 'Figure Eight'], ['bounce', 'Bounce'], ['spiral', 'Rising Spiral']]),
  F('motionR', 'Motion Radius (cm)', 200, 0, 2000, 1, { show: p => p.motion !== 'none' }), F('motionSpeed', 'Motion Speed (rad/s)', 2, 0, 20, .05, { show: p => p.motion !== 'none' }),
  F('motionZ', 'Component Height (cm)', 0, -500, 2000, 1),
  En('bg', 'Background', 'night', [['night', 'Night Blue'], ['black', 'Black'], ['grey', 'Studio Grey'], ['sky', 'Day Sky']]),
  Bo('floor', 'Show Ground', true), Bo('autoOrbit', 'Auto-Orbit Camera', false)
];

function fillDefaults(obj, params) { for (const s of params) if (obj[s.k] === undefined) obj[s.k] = clone(s.d); return obj; }
function mkMod(t, p = {}, on = true) { return { uid: uid(), t, on, p: fillDefaults(clone(p), MODS[t].params) }; }

function normalizeSystem(sys) {
  sys = sys || {};
  fillDefaults(sys, SYSTEM_PARAMS); sys.emitters = sys.emitters || []; sys.textures = sys.textures || {};
  for (const em of sys.emitters) {
    em.id = em.id || uid(); if (em.on === undefined) em.on = true; em.solo = !!em.solo;
    fillDefaults(em, EMITTER_PARAMS);
    for (const k of ['emit', 'spawn', 'update', 'render']) {
      em[k] = (em[k] || []).filter(m => MODS[m.t]).map(m => { m.uid = m.uid || uid(); if (m.on === undefined) m.on = true; m.p = fillDefaults(m.p || {}, MODS[m.t].params); return m; });
    }
    em.events = (em.events || []).map(h => { h.uid = h.uid || uid(); if (h.on === undefined) h.on = true; h.p = fillDefaults(h.p || {}, EVENT_PARAMS); return h; });
  }
  for (const em of sys.emitters) for (const h of em.events) if (h.p.src && !sys.emitters.some(e => e.id === h.p.src)) { const f = sys.emitters.find(e => e.name === h.p.src); h.p.src = f ? f.id : ''; }
  return sys;
}
