/* NytLite — editor UI, camera, main loop, import/export. */
'use strict';

const $ = s => document.querySelector(s);
function h(tag, a = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in a) {
    const v = a[k];
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v; else if (k === 'checked') e.checked = !!v;
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
};
const fmt = v => +(+v).toFixed(3);

/* ---------------- state ---------------- */
let sys, sim, renderer, selId = null, paused = false, stepOnce = false;
const openSet = new Set();
const canvas = $('#gl');
try { renderer = new Renderer(canvas); }
catch (e) { $('#view').innerHTML = `<p style="padding:20px;color:#ffadb8">${e.message}</p>`; throw e; }

function loadSystem(s, keepSel) {
  sys = normalizeSystem(s); sim = new Sim(sys);
  if (!keepSel) { Object.assign(cam, clone(CAM0)); const v = sys.view; if (v) { if (v.tz != null) cam.target[2] = v.tz; if (v.dist) cam.dist = v.dist; if (v.pitch != null) cam.pitch = v.pitch; } }
  if (!keepSel || !sys.emitters.some(e => e.id === selId)) selId = sys.emitters[0] ? sys.emitters[0].id : null;
  buildPanel(); dirty();
}
function restart() { sim = new Sim(sys); }
let saveT = 0;
function dirty() { clearTimeout(saveT); saveT = setTimeout(() => store.set('nl2.current', sys), 500); }

/* ---------------- camera ---------------- */
const CAM0 = { yaw: -1.15, pitch: .32, dist: 1000, target: [0, 0, 140], fov: 50 };
const cam = clone(CAM0);
function camState() {
  const cp = Math.cos(cam.pitch), t = cam.target;
  return { eye: [t[0] + cam.dist * cp * Math.cos(cam.yaw), t[1] + cam.dist * cp * Math.sin(cam.yaw), t[2] + cam.dist * Math.sin(cam.pitch)], target: t, fov: cam.fov };
}
{
  const pts = new Map(); let pinch = 0, mid = null;
  const pan = (dx, dy) => {
    const c = camState(), f = norm3([c.target[0] - c.eye[0], c.target[1] - c.eye[1], c.target[2] - c.eye[2]]), r = norm3([f[1], -f[0], 0]);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]], k = cam.dist * .0015;
    for (let i = 0; i < 3; i++) cam.target[i] += (-r[i] * dx + u[i] * dy) * k;
  };
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, sh: e.shiftKey }); });
  canvas.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) { if (p.b === 2 || p.b === 1 || p.sh) pan(dx, dy); else { cam.yaw -= dx * .006; cam.pitch = clamp(cam.pitch + dy * .006, -1.45, 1.45); } }
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), m = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      if (pinch) cam.dist = clamp(cam.dist * pinch / d, 50, 8000); if (mid) pan(m[0] - mid[0], m[1] - mid[1]);
      pinch = d; mid = m;
    }
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) { pinch = 0; mid = null; } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * .001), 50, 8000); }, { passive: false });
  canvas.addEventListener('dblclick', () => Object.assign(cam, clone(CAM0)));
}

/* ---------------- parameter controls ---------------- */
function numIn(v, step, on) { const n = h('input', { type: 'number', step: step || 'any', value: fmt(v) }); n.addEventListener('change', () => { if (n.value !== '' && isFinite(+n.value)) on(+n.value); }); return n; }

function paramRow(s, obj, onChange, rebuild, ctxEm) {
  if (s.show && !s.show(obj)) return null;
  const set = v => { obj[s.k] = v; onChange(s); dirty(); };
  const v = obj[s.k]; let ctl, wide = false;
  switch (s.t) {
    case 'f': {
      const r = h('input', { type: 'range', min: s.min, max: s.max, step: s.step, value: v });
      const n = numIn(v, s.step, x => { r.value = x; set(x); });
      r.addEventListener('input', () => { n.value = fmt(r.value); set(+r.value); });
      ctl = h('div', { class: 'ctl' }, r, n); break;
    }
    case 'r': ctl = h('div', { class: 'ctl rg' }, numIn(v[0], s.step, x => { v[0] = x; set(v); }), h('span', {}, '–'), numIn(v[1], s.step, x => { v[1] = x; set(v); })); break;
    case 'v': ctl = h('div', { class: 'ctl v3' }, [0, 1, 2].map(i => numIn(v[i], 'any', x => { v[i] = x; set(v); }))); break;
    case 'c': {
      const c = h('input', { type: 'color', value: v.c }); c.addEventListener('input', () => { v.c = c.value; set(v); });
      ctl = h('div', { class: 'ctl' }, c, h('span', { class: 'sec-sub' }, '×'), numIn(v.i, .1, x => { v.i = x; set(v); })); break;
    }
    case 'e': {
      const sel = h('select', {}, s.o.map(([val, lab]) => h('option', { value: val }, lab))); sel.value = v;
      sel.addEventListener('change', () => { set(sel.value); rebuild(); }); ctl = h('div', { class: 'ctl' }, sel); break;
    }
    case 'b': { const cb = h('input', { type: 'checkbox', checked: v }); cb.addEventListener('change', () => { set(cb.checked); rebuild(); }); ctl = h('div', { class: 'ctl' }, cb); break; }
    case 's': { const t = h('input', { type: 'text', value: v }); t.addEventListener('change', () => set(t.value)); ctl = h('div', { class: 'ctl' }, t); break; }
    case 'em': {
      const sel = h('select', {}, h('option', { value: '' }, '— choose —'), sys.emitters.map(e => h('option', { value: e.id }, e.name))); sel.value = v;
      sel.addEventListener('change', () => set(sel.value)); ctl = h('div', { class: 'ctl' }, sel); break;
    }
    case 'tx': {
      const sel = h('select', {}, Object.entries(TEXTURES).map(([k, t]) => h('option', { value: k }, t.label)),
        Object.keys(sys.textures).map(k => h('option', { value: k }, '🖼 ' + k.slice(7))), h('option', { value: '__upload' }, '⤒ Upload image…'));
      sel.value = v;
      sel.addEventListener('change', () => {
        if (sel.value === '__upload') { sel.value = v; pickTexture(key => { obj[s.k] = key; onChange(s); dirty(); rebuild(); }); return; }
        const g = TEXTURES[sel.value] && TEXTURES[sel.value].grid;
        if ('cols' in obj) { obj.cols = g ? g[0] : 1; obj.rows = g ? g[1] : 1; }
        set(sel.value); rebuild();
      });
      ctl = h('div', { class: 'ctl' }, sel); break;
    }
    case 'cv': wide = true; ctl = curveEditor(s, v, () => set(v)); break;
    case 'g': wide = true; ctl = gradEditor(v, () => set(v)); break;
  }
  if (wide) return h('div', { class: 'row wide' }, ctl);
  return h('div', { class: 'row' }, h('label', { title: s.help || s.l }, s.l), ctl);
}

const CURVE_PRESETS = {
  'Constant 1': [[0, 1], [1, 1]], '1 → 0': [[0, 1], [1, 0]], '0 → 1': [[0, 0], [1, 1]], 'Fade in/out': [[0, 0], [.2, 1], [.8, 1], [1, 0]],
  'Pop': [[0, 0], [.1, 1.2], [.25, 1], [1, 1]], 'Grow ×3': [[0, .5], [1, 3]], 'Ease out 1 → 0': [[0, 1], [.5, .25], [1, 0]], 'Pulse': [[0, 1], [.25, .3], [.5, 1], [.75, .3], [1, 1]], 'Flicker': [[0, 1], [.1, .3], [.2, .9], [.35, .2], [.5, 1], [.65, .4], [.8, .9], [1, 0]]
};
function curveEditor(s, keys, onCh) {
  const c = h('canvas', { class: 'curve' }), g = c.getContext('2d');
  const lo = Math.min(s.min, ...keys.map(k => k.v)), hiV = Math.max(s.max, ...keys.map(k => k.v)), hi = hiV === lo ? lo + 1 : hiV;
  const W = () => c.width, H = () => c.height, pad = 8;
  const toX = t => pad + t * (W() - 2 * pad), toY = v => H() - pad - (v - lo) / (hi - lo) * (H() - 2 * pad);
  const fromX = x => clamp((x - pad) / (W() - 2 * pad), 0, 1), fromY = y => lo + (H() - pad - y) / (H() - 2 * pad) * (hi - lo);
  function draw() {
    const d = devicePixelRatio || 1, w = c.clientWidth * d, hh = c.clientHeight * d; if (!w) return; if (c.width !== w) { c.width = w; c.height = hh; }
    g.clearRect(0, 0, W(), H()); g.strokeStyle = '#1b2a4a'; g.lineWidth = 1;
    for (const v of [lo, (lo + hi) / 2, hi]) { g.beginPath(); g.moveTo(pad, toY(v)); g.lineTo(W() - pad, toY(v)); g.stroke(); }
    if (lo < 1 && hi > 1) { g.setLineDash([3 * d, 3 * d]); g.beginPath(); g.moveTo(pad, toY(1)); g.lineTo(W() - pad, toY(1)); g.stroke(); g.setLineDash([]); }
    g.strokeStyle = '#5fe1ff'; g.lineWidth = 2 * d; g.beginPath();
    for (let i = 0; i <= 64; i++) { const t = i / 64, x = toX(t), y = toY(evalCurve(keys, t)); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.fillStyle = '#fff'; for (const k of keys) { g.beginPath(); g.arc(toX(k.t), toY(k.v), 4 * d, 0, TAU); g.fill(); }
    g.fillStyle = '#8ea2c6'; g.font = `${10 * d}px system-ui`; g.fillText(fmt(hi), 2 * d, 10 * d); g.fillText(fmt(lo), 2 * d, H() - 2 * d);
  }
  let drag = -1;
  const pos = e => { const r = c.getBoundingClientRect(), d = c.width / r.width; return [(e.clientX - r.left) * d, (e.clientY - r.top) * d]; };
  c.addEventListener('pointerdown', e => {
    c.setPointerCapture(e.pointerId); const [x, y] = pos(e), d = c.width / c.clientWidth;
    drag = keys.findIndex(k => Math.hypot(toX(k.t) - x, toY(k.v) - y) < 9 * d);
    if (drag < 0) { const k = { t: fromX(x), v: fromY(y) }; keys.push(k); keys.sort((a, b) => a.t - b.t); drag = keys.indexOf(k); onCh(); }
    draw();
  });
  c.addEventListener('pointermove', e => {
    if (drag < 0) return; const [x, y] = pos(e), k = keys[drag];
    const minT = drag === 0 ? 0 : keys[drag - 1].t + .001, maxT = drag === keys.length - 1 ? 1 : keys[drag + 1].t - .001;
    k.t = (drag === 0 && keys.length > 1 && k.t === 0) ? 0 : clamp(fromX(x), minT, maxT); if (drag === keys.length - 1 && keys.length > 1 && k.t > .999) k.t = 1;
    k.v = fmt(fromY(y)); k.t = fmt(k.t); onCh(); draw();
  });
  c.addEventListener('pointerup', () => { drag = -1; });
  c.addEventListener('dblclick', e => { const [x, y] = pos(e), d = c.width / c.clientWidth, i = keys.findIndex(k => Math.hypot(toX(k.t) - x, toY(k.v) - y) < 9 * d); if (i >= 0 && keys.length > 2) { keys.splice(i, 1); onCh(); draw(); } });
  new ResizeObserver(draw).observe(c);
  const sel = h('select', { class: 'sm' }, h('option', { value: '' }, 'Preset…'), Object.keys(CURVE_PRESETS).map(k => h('option', { value: k }, k)));
  sel.addEventListener('change', () => { if (!sel.value) return; keys.length = 0; for (const [t, v] of CURVE_PRESETS[sel.value]) keys.push({ t, v }); sel.value = ''; onCh(); draw(); });
  return h('div', {}, h('div', { class: 'lbl-top' }, h('span', {}, s.l), sel), c, h('div', { class: 'sec-sub', style: 'margin-top:2px' }, 'click: add key · drag: move · double-click: delete'));
}

function gradEditor(stops, onCh) {
  const wrap = h('div', {}), bar = h('canvas', { class: 'gbar' });
  function drawBar() {
    const w = bar.clientWidth || 300, g = bar.getContext('2d'); bar.width = w; bar.height = 18;
    for (let x = 0; x < w; x += 6) for (let y = 0; y < 18; y += 6) { g.fillStyle = ((x + y) / 6) % 2 ? '#333' : '#222'; g.fillRect(x, y, 6, 6); }
    for (let x = 0; x < w; x++) { const c = evalGrad(stops, x / (w - 1), []); g.fillStyle = `rgba(${c[0] * 255},${c[1] * 255},${c[2] * 255},${c[3]})`; g.fillRect(x, 0, 1, 18); }
  }
  function list() {
    wrap.innerHTML = '';
    wrap.append(h('div', { class: 'lbl-top' }, h('span', {}, 'Gradient (position · color · alpha)'), h('button', { class: 'ghost sm', onclick: () => {
      let gi = 0, gap = -1; for (let i = 0; i < stops.length - 1; i++) if (stops[i + 1].t - stops[i].t > gap) { gap = stops[i + 1].t - stops[i].t; gi = i; }
      const t = stops.length > 1 ? (stops[gi].t + stops[gi + 1].t) / 2 : .5, c = evalGrad(stops, t, []);
      stops.push({ t: fmt(t), c: rgbHex(c[0], c[1], c[2]), a: fmt(c[3]) }); stops.sort((a, b) => a.t - b.t); onCh(); list();
    } }, '+ stop')), bar);
    stops.forEach((st, i) => {
      const col = h('input', { type: 'color', value: st.c }); col.addEventListener('input', () => { st.c = col.value; onCh(); drawBar(); });
      const al = h('input', { type: 'range', min: 0, max: 1, step: .01, value: st.a }); al.addEventListener('input', () => { st.a = +al.value; onCh(); drawBar(); });
      wrap.append(h('div', { class: 'gstop' }, numIn(st.t, .05, x => { st.t = clamp(x, 0, 1); stops.sort((a, b) => a.t - b.t); onCh(); list(); }), col, al,
        h('button', { class: 'icon', title: 'Remove stop', onclick: () => { if (stops.length > 1) { stops.splice(i, 1); onCh(); list(); } } }, '✕')));
    });
    requestAnimationFrame(drawBar);
  }
  list(); return wrap;
}

function pickTexture(done) {
  const inp = $('#texIn'); inp.value = '';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { const key = 'custom:' + f.name.replace(/\.[^.]+$/, '').slice(0, 30); sys.textures[key] = r.result; done(key); };
    r.readAsDataURL(f);
  };
  inp.click();
}

/* ---------------- panel ---------------- */
const panel = $('#panel');
const selEm = () => sys.emitters.find(e => e.id === selId);
const countSpans = new Map();

function sectionHead(key, title, sub) {
  const col = `var(--st-${key})`;
  return h('div', { class: 'sec-h' }, h('span', { class: 'sw', style: `background:${col}` }), h('b', {}, title), h('span', { class: 'sec-sub' }, sub));
}
function det(id, cls, summaryKids, bodyFn, defOpen) {
  const d = h('details', { class: cls }); if (openSet.has(id) || (defOpen && !openSet.has('closed:' + id))) d.open = true;
  d.addEventListener('toggle', () => { if (d.open) { openSet.add(id); openSet.delete('closed:' + id); if (!d._built) { d._built = true; bodyFn(body); } } else { openSet.delete(id); openSet.add('closed:' + id); } });
  const body = h('div', { class: 'body' });
  d.append(h('summary', {}, h('span', { class: 'chev' }, '▶'), summaryKids), body);
  if (d.open) { d._built = true; bodyFn(body); }
  return d;
}
function paramsInto(body, params, obj, onChange) {
  const fill = () => { body.innerHTML = ''; for (const s of params) { const r = paramRow(s, obj, onChange, fill); if (r) body.append(r); } };
  fill(); return fill;
}

function moveIn(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }

function modCard(em, list, mo, i) {
  const M = MODS[mo.t];
  const cb = h('input', { type: 'checkbox', checked: mo.on, title: 'Enable', onclick: e => e.stopPropagation() });
  const d = det(mo.uid, 'mod' + (mo.on ? '' : ' off'), [cb, h('span', { class: 't' }, M.name),
    em.mode === 'stateless' && !M.sl ? h('span', { class: 'badge bad', title: 'Not available on Lightweight emitters' }, 'not lightweight') : null,
    M.spec ? h('span', { class: 'badge warn' }, 'export only') : null,
    h('button', { class: 'icon', title: 'Move up', onclick: e => { e.preventDefault(); moveIn(list, i, -1); buildPanel(); dirty(); } }, '↑'),
    h('button', { class: 'icon', title: 'Move down', onclick: e => { e.preventDefault(); moveIn(list, i, 1); buildPanel(); dirty(); } }, '↓'),
    h('button', { class: 'icon', title: 'Remove', onclick: e => { e.preventDefault(); list.splice(i, 1); buildPanel(); dirty(); } }, '✕')],
  body => { body.append(h('div', { class: 'desc' }, M.desc || '')); const pb = h('div'); body.append(pb); paramsInto(pb, M.params, mo.p, () => { }); });
  cb.addEventListener('change', () => { mo.on = cb.checked; d.classList.toggle('off', !mo.on); dirty(); });
  return d;
}

function addModuleSelect(em, stage) {
  const key = STAGE_KEY[stage], cats = {};
  for (const id in MODS) { const M = MODS[id]; if (M.stage !== stage) continue; (cats[M.cat] = cats[M.cat] || []).push(M); }
  const sel = h('select', { class: 'addsel' }, h('option', { value: '' }, '+ Add module…'),
    Object.entries(cats).map(([c, ms]) => h('optgroup', { label: c }, ms.map(M => h('option', { value: M.id }, M.name + (em.mode === 'stateless' && !M.sl ? '  (not lightweight)' : ''))))));
  sel.addEventListener('change', () => { if (!sel.value) return; const mo = mkMod(sel.value); em[key].push(mo); openSet.add(mo.uid); buildPanel(); dirty(); });
  return sel;
}

function warnings(em) {
  const w = [];
  if (em.mode === 'stateless') {
    const bad = [...em.emit, ...em.spawn, ...em.update, ...em.render].filter(mo => mo.on && !MODS[mo.t].sl && MODS[mo.t].stage !== 'render').map(mo => MODS[mo.t].name);
    if (bad.length) w.push('Lightweight emitters don’t support: ' + [...new Set(bad)].join(', ') + '. Switch to Standard or remove them.');
    if (em.events.length) w.push('Lightweight emitters can’t receive events.');
  }
  if (em.emit.some(mo => mo.on && mo.t === 'spawnPerUnit') && sys.motion === 'none') w.push('Spawn Per Unit needs movement — set System → Component Motion to preview it.');
  if (em.render.some(r => r.on && r.t === 'ribbon') && !em.emit.some(mo => mo.on) && !em.events.length) w.push('Ribbon has nothing spawning.');
  if (!em.render.some(r => r.on)) w.push('No enabled renderer — particles simulate but are invisible.');
  if (!em.emit.some(mo => mo.on) && !em.events.some(e => e.on)) w.push('No spawn module or event handler — nothing will spawn.');
  for (const e of em.events) if (e.on && !e.p.src) w.push('An event handler has no source emitter.');
  return w;
}

function buildPanel() {
  const st = panel.scrollTop; panel.innerHTML = ''; countSpans.clear();
  // presets select reflects name
  // ---- system
  panel.append(det('sys', 'card', [h('b', {}, 'System'), h('span', { class: 'sec-sub', style: 'flex:1' }, sys.name)], body => paramsInto(body, SYSTEM_PARAMS, sys, s => { if (s.k === 'name') buildPanel(); })));

  // ---- emitters
  panel.append(sectionHead('emitter', 'Emitters', `${sys.emitters.length} in system`));
  const list = h('div', { class: 'emlist' });
  sys.emitters.forEach((em, i) => {
    const cb = h('input', { type: 'checkbox', checked: em.on, title: 'Enable emitter', onclick: e => e.stopPropagation() });
    cb.addEventListener('change', () => { em.on = cb.checked; dirty(); });
    const solo = h('span', { class: 'solo' + (em.solo ? ' on' : ''), title: 'Solo (isolate)', onclick: e => { e.stopPropagation(); em.solo = !em.solo; buildPanel(); } }, 'S');
    const ct = h('span', { class: 'ct' }, '0'); countSpans.set(em.id, ct);
    list.append(h('div', { class: 'emrow' + (em.id === selId ? ' sel' : ''), onclick: () => { selId = em.id; buildPanel(); } }, cb, h('span', { class: 'nm' }, em.name), ct, solo));
  });
  panel.append(list);
  const tpl = h('select', {}, h('option', { value: '' }, '+ Add emitter…'), Object.keys(EMITTER_TEMPLATES).map(k => h('option', { value: k }, k)));
  tpl.addEventListener('change', () => { if (!tpl.value) return; const em = EMITTER_TEMPLATES[tpl.value](); sys.emitters.push(em); normalizeSystem(sys); selId = em.id; buildPanel(); dirty(); });
  const em = selEm();
  const idx = sys.emitters.indexOf(em);
  panel.append(h('div', { class: 'tools' }, tpl,
    em && h('button', { class: 'ghost sm', onclick: () => { const c = clone(em); c.id = uid(); c.name = em.name + ' Copy'; for (const k of ['emit', 'spawn', 'update', 'render', 'events']) c[k].forEach(x => x.uid = uid()); sys.emitters.splice(idx + 1, 0, c); selId = c.id; buildPanel(); dirty(); } }, 'Duplicate'),
    em && h('button', { class: 'ghost sm', onclick: () => { moveIn(sys.emitters, idx, -1); buildPanel(); dirty(); } }, '↑'),
    em && h('button', { class: 'ghost sm', onclick: () => { moveIn(sys.emitters, idx, 1); buildPanel(); dirty(); } }, '↓'),
    em && h('button', { class: 'ghost sm', onclick: () => { if (!confirmDelete(em)) return; sys.emitters.splice(idx, 1); selId = sys.emitters[0] && sys.emitters[0].id; buildPanel(); dirty(); } }, 'Delete')));

  if (em) {
    const ws = warnings(em);
    if (ws.length) panel.append(h('div', { class: 'warns' }, ws.map(t => h('div', {}, '⚠ ' + t))));
    panel.append(det('props:' + em.id, 'card', [h('b', {}, em.name), h('span', { class: 'sec-sub', style: 'flex:1' }, 'Emitter Properties · State · Scalability'),
      em.mode === 'stateless' ? h('span', { class: 'badge' }, 'lightweight') : null, h('span', { class: 'badge' }, em.sim.toUpperCase())],
    body => paramsInto(body, EMITTER_PARAMS, em, s => { if (['name', 'mode', 'sim'].includes(s.k)) buildPanel(); if (['det', 'seed'].includes(s.k)) restart(); }), false));
    for (const [stage, title, sub] of STAGES) {
      panel.append(sectionHead(stage, title, sub));
      if (stage === 'events') {
        em.events.forEach((hd, i) => {
          const cb = h('input', { type: 'checkbox', checked: hd.on, onclick: e => e.stopPropagation() }); cb.addEventListener('change', () => { hd.on = cb.checked; dirty(); });
          const src = sys.emitters.find(e => e.id === hd.p.src);
          panel.append(det(hd.uid, 'mod', [cb, h('span', { class: 't' }, `Event Handler · ${hd.p.type} from ${src ? src.name : '?'}`),
            h('button', { class: 'icon', onclick: e => { e.preventDefault(); em.events.splice(i, 1); buildPanel(); dirty(); } }, '✕')],
          body => paramsInto(body, EVENT_PARAMS, hd.p, s => { if (s.k === 'src' || s.k === 'type') buildPanel(); })));
        });
        panel.append(h('button', { class: 'ghost sm', style: 'width:100%', onclick: () => { const hd = { uid: uid(), on: true, p: fillDefaults({}, EVENT_PARAMS) }; const other = sys.emitters.find(e => e !== em); if (other) hd.p.src = other.id; em.events.push(hd); openSet.add(hd.uid); buildPanel(); dirty(); } }, '+ Add event handler'));
        continue;
      }
      const key = STAGE_KEY[stage], arr = em[key];
      arr.forEach((mo, i) => panel.append(modCard(em, arr, mo, i)));
      panel.append(addModuleSelect(em, stage));
    }
  }
  panel.append(h('div', { class: 'about' },
    h('p', {}, h('b', {}, 'Units match Unreal: '), 'centimetres, Z-up, seconds, degrees. Colors are sRGB hex × intensity (HDR). Mesh shapes are 100 cm like the engine’s basic shapes, so Mesh Scale values transfer directly.'),
    h('p', {}, h('b', {}, 'What’s previewed: '), 'every spawn, location, velocity, force, color, size, rotation, Sub UV, collision (ground plane), kill, event, and the Sprite / Ribbon / Mesh / Light / Decal renderers. Component and Volume renderers are export-only. GPU Sim is an exported flag — the browser always simulates on the CPU.'),
    h('p', {}, h('b', {}, 'UEFN: '), 'the JSON and build sheet are recipes, not .uasset files. Recreate the stack in UEFN’s Niagara editor (not every node is available there), or use the flipbook PNG as a SubUV texture.')));
  panel.scrollTop = st;
  refreshPresetSel();
}
function confirmDelete(em) { return em.emit.length + em.spawn.length + em.update.length < 2 || window.confirm(`Delete emitter “${em.name}”?`); }

/* ---------------- header: presets, library, import/export ---------------- */
const presetSel = $('#presetSel');
function refreshPresetSel() {
  presetSel.innerHTML = '';
  presetSel.append(h('option', { value: '' }, sys ? `▸ ${sys.name}` : 'Presets'));
  presetSel.append(h('optgroup', { label: 'Load preset' }, Object.keys(PRESETS).map(k => h('option', { value: k }, k))));
  presetSel.value = '';
}
presetSel.addEventListener('change', () => { const k = presetSel.value; if (!k) return; openSet.clear(); loadSystem(PRESETS[k]()); });

function refreshLib() {
  const lib = store.get('nl2.library', {}), sel = $('#libSel'); sel.innerHTML = '';
  sel.append(h('option', { value: '' }, `Library (${Object.keys(lib).length})`));
  for (const k of Object.keys(lib).sort()) sel.append(h('option', { value: 'load:' + k }, '↥ ' + k));
  if (Object.keys(lib).length) sel.append(h('optgroup', { label: 'Delete' }, Object.keys(lib).sort().map(k => h('option', { value: 'del:' + k }, '✕ ' + k))));
}
$('#libSel').addEventListener('change', e => {
  const v = e.target.value; e.target.value = ''; if (!v) return; const lib = store.get('nl2.library', {}), name = v.slice(v.indexOf(':') + 1);
  if (v.startsWith('load:') && lib[name]) { openSet.clear(); loadSystem(clone(lib[name])); }
  if (v.startsWith('del:') && window.confirm(`Delete “${name}” from the library?`)) { delete lib[name]; store.set('nl2.library', lib); }
  refreshLib();
});
$('#saveBtn').addEventListener('click', () => {
  const name = window.prompt('Save system to this device’s library as:', sys.name); if (!name) return;
  const lib = store.get('nl2.library', {}); lib[name] = clone(sys); if (!store.set('nl2.library', lib)) alert('Could not save (storage full or blocked). Use Export → Effect JSON instead.');
  refreshLib();
});
$('#restartBtn').addEventListener('click', restart);
$('#importBtn').addEventListener('click', () => { const f = $('#fileIn'); f.value = ''; f.click(); });
$('#fileIn').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => { try { openSet.clear(); loadSystem(importJSON(JSON.parse(r.result))); } catch (err) { alert('Could not import: ' + err.message); } };
  r.readAsText(f);
});

function importJSON(j) {
  if (j && j.schema === 'niagara-lite/0.1') { // Effect Lab 001 export
    const s = PRESETS['Boost Burst'](); const sp = s.emitters[2];
    sp.emit[0].p.count = [j.count, j.count]; sp.spawn[0].p.life = [j.lifetime * .6, j.lifetime]; sp.spawn[0].p.color.c = j.color;
    sp.spawn[2].p.speed = [j.speed * 60, j.speed * 160]; s.emitters.forEach(e => { e.dur = j.lifetime + .35; e.spawn[0].p.color.c = j.color; }); s.name = 'NS_Imported_' + (j.preset || 'v1');
    return s;
  }
  const s = j && j.system ? j.system : j;
  if (!s || !Array.isArray(s.emitters)) throw new Error('No “emitters” array found.');
  return clone(s);
}

function download(blob, name) { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
const fileBase = () => (sys.name || 'NS_Effect').replace(/[^\w-]+/g, '_');

function exportJSON() {
  const out = clone(sys);
  for (const em of out.emitters) for (const k of ['emit', 'spawn', 'update', 'render']) em[k].forEach(mo => { mo.niagara = MODS[mo.t].name; });
  download(new Blob([JSON.stringify({ schema: 'nytlite/0.2', app: 'NytLite Effect Lab 002', exported: new Date().toISOString(), units: 'cm, Z-up, seconds, degrees; colors sRGB hex × intensity', system: out }, null, 2)], { type: 'application/json' }), fileBase() + '.nytlite.json');
}

function fmtVal(s, v) {
  switch (s.t) {
    case 'r': return v[0] === v[1] ? `${fmt(v[0])}` : `Uniform Ranged ${fmt(v[0])} – ${fmt(v[1])}`;
    case 'v': return `(X=${fmt(v[0])}, Y=${fmt(v[1])}, Z=${fmt(v[2])})`;
    case 'c': { const c = hex3(v.c); return `${v.c} × ${fmt(v.i)}  (linear-ish R=${fmt(c[0] * v.i)} G=${fmt(c[1] * v.i)} B=${fmt(c[2] * v.i)})`; }
    case 'e': { const o = s.o.find(x => x[0] === v); return o ? o[1] : v; }
    case 'b': return v ? 'Yes' : 'No';
    case 'cv': return 'Curve keys ' + v.map(k => `[t=${fmt(k.t)} → ${fmt(k.v)}]`).join(' ');
    case 'g': return 'Gradient ' + v.map(k => `[${fmt(k.t)}: ${k.c} a=${fmt(k.a)}]`).join(' ');
    case 'tx': return (TEXTURES[v] && TEXTURES[v].label) || v;
    case 'em': { const e = sys.emitters.find(x => x.id === v); return e ? e.name : '(none)'; }
    default: return String(fmt(v) === v ? v : (typeof v === 'number' ? fmt(v) : v));
  }
}
function buildSheet() {
  const L = [], line = (d, t) => L.push('  '.repeat(d) + t);
  const params = (d, ps, obj) => { for (const s of ps) if (!s.show || s.show(obj)) line(d, `${s.l}: ${fmtVal(s, obj[s.k])}`); };
  L.push(`NYTLITE BUILD SHEET (for Unreal Niagara) — ${sys.name}`, `Generated ${new Date().toLocaleString()} · units: cm, Z-up, seconds, degrees`, '');
  L.push('SYSTEM'); params(1, SYSTEM_PARAMS.filter(s => !['bg', 'floor', 'autoOrbit', 'timeScale'].includes(s.k)), sys); L.push('');
  sys.emitters.forEach((em, i) => {
    L.push(`EMITTER ${i + 1}: ${em.name}${em.on ? '' : '  (disabled)'}`);
    line(1, 'Emitter Properties / Emitter State'); params(2, EMITTER_PARAMS.filter(s => s.k !== 'name'), em);
    for (const [stage, title] of STAGES) {
      if (stage === 'events') { if (em.events.length) { line(1, title); for (const hd of em.events) { line(2, `• Event Handler${hd.on ? '' : ' (disabled)'}`); params(3, EVENT_PARAMS, hd.p); } } continue; }
      const arr = em[STAGE_KEY[stage]]; if (!arr.length) continue;
      line(1, title);
      for (const mo of arr) { line(2, `• ${MODS[mo.t].name}${mo.on ? '' : '  (disabled)'}`); params(3, MODS[mo.t].params, mo.p); }
    }
    L.push('');
  });
  L.push('NOTES', '  Ground-plane Collision stands in for Scene Depth / Ray Traced collision.', '  Procedural textures: recreate with your own materials or export the flipbook PNG.', '  Event Handlers map to Niagara Event Handler stages (Spawned Particles execution mode).');
  download(new Blob([L.join('\n')], { type: 'text/plain' }), fileBase() + '_build_sheet.txt');
}

/* ---------------- flipbook ---------------- */
const dlg = $('#flipDlg'); let fbBlob = null;
const loopLen = () => Math.max(.1, ...sys.emitters.filter(e => e.on).map(e => e.dur + e.delay));
function renderFlipbook(o) {
  const frames = o.cols * o.rows, sz = o.size, tmp = new Sim(sys, { deterministic: true }), t0 = tmp.t;
  const sheet = document.createElement('canvas'); sheet.width = o.cols * sz; sheet.height = o.rows * sz; const sg = sheet.getContext('2d', { willReadFrequently: o.bg === 'alpha' });
  const step = 1 / 60, adv = target => { while (target - (tmp.t - t0) > 1e-5) tmp.step(Math.min(step, target - (tmp.t - t0))); };
  adv(o.start);
  canvas.width = sz; canvas.height = sz;
  for (let i = 0; i < frames; i++) {
    adv(o.start + (i + .5) * o.dur / frames);
    renderer.render(tmp, camState(), { w: sz, h: sz, floor: o.floor, bg: o.bg === 'scene' ? null : 'transparent' });
    const x = (i % o.cols) * sz, y = Math.floor(i / o.cols) * sz; sg.drawImage(canvas, 0, 0, sz, sz, x, y, sz, sz);
    if (o.bg === 'alpha') {
      const img = sg.getImageData(x, y, sz, sz), d = img.data;
      for (let k = 0; k < d.length; k += 4) { const a = Math.max(d[k], d[k + 1], d[k + 2]); if (a) { d[k] = d[k] * 255 / a; d[k + 1] = d[k + 1] * 255 / a; d[k + 2] = d[k + 2] * 255 / a; } d[k + 3] = a; }
      sg.putImageData(img, x, y);
    }
  }
  sizeCanvas(true);
  return sheet;
}
$('#fbDurAuto').addEventListener('click', () => { $('#fbDur').value = fmt(loopLen()); });
$('#fbGo').addEventListener('click', () => {
  const o = { cols: clamp(+$('#fbCols').value | 0, 1, 16), rows: clamp(+$('#fbRows').value | 0, 1, 16), size: +$('#fbSize').value, dur: Math.max(.01, +$('#fbDur').value), start: Math.max(0, +$('#fbStart').value), bg: $('#fbBg').value, floor: $('#fbFloor').checked };
  const sheet = renderFlipbook(o);
  sheet.toBlob(b => { fbBlob = b; const img = $('#fbPrev'); img.src = URL.createObjectURL(b); img.hidden = false; $('#fbSave').disabled = false; });
});
$('#fbSave').addEventListener('click', () => fbBlob && download(fbBlob, `${fileBase()}_flipbook_${$('#fbCols').value}x${$('#fbRows').value}.png`));
$('#fbClose').addEventListener('click', () => dlg.close());

/* ---------------- recording ---------------- */
function record() {
  if (!canvas.captureStream || !window.MediaRecorder) { alert('Video recording isn’t supported in this browser.'); return; }
  const types = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'], type = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(canvas.captureStream(60), type ? { mimeType: type, videoBitsPerSecond: 12e6 } : undefined), chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => { recording = 0; const t = rec.mimeType || type || 'video/webm'; download(new Blob(chunks, { type: t }), `${fileBase()}.${t.includes('mp4') ? 'mp4' : 'webm'}`); };
  restart(); recording = performance.now(); rec.start(); setTimeout(() => rec.stop(), 5000);
}
let recording = 0;

$('#exportSel').addEventListener('change', e => {
  const v = e.target.value; e.target.value = '';
  if (v === 'json') exportJSON(); else if (v === 'sheet') buildSheet(); else if (v === 'rec') record();
  else if (v === 'flip') { $('#fbDur').value = fmt(loopLen()); $('#fbPrev').hidden = true; $('#fbSave').disabled = true; dlg.showModal(); }
});

/* ---------------- transport ---------------- */
$('#pauseBtn').addEventListener('click', () => { paused = !paused; $('#pauseBtn').textContent = paused ? '▶' : '⏸'; });
$('#stepBtn').addEventListener('click', () => { paused = true; stepOnce = true; $('#pauseBtn').textContent = '▶'; });
$('#camBtn').addEventListener('click', () => Object.assign(cam, clone(CAM0)));
let speed = 1; $('#speedSel').addEventListener('change', e => { speed = +e.target.value; });

/* ---------------- main loop ---------------- */
function sizeCanvas(force) {
  const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2), w = Math.max(1, Math.round(r.width * d)), hh = Math.max(1, Math.round(r.height * d));
  if (force || canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
}
let last = performance.now(), acc = 0, fps = 60, hudT = 0;
function frame(now) {
  const real = Math.min(.1, (now - last) / 1000); last = now; fps = lerp(fps, 1 / Math.max(real, 1e-3), .05);
  if (!paused || stepOnce) {
    const dt = stepOnce ? 1 / 60 : real * sys.timeScale * speed; stepOnce = false;
    if (sys.fixedTick) { const hstep = 1 / sys.tickRate; acc += dt; let n = 0; while (acc >= hstep && n < 10) { sim.step(hstep); acc -= hstep; n++; } if (n === 10) acc = 0; }
    else if (dt > 0) sim.step(dt);
  }
  if (sys.autoOrbit) cam.yaw += real * .25;
  sizeCanvas(); renderer.render(sim, camState(), { w: canvas.width, h: canvas.height, floor: true });
  if (now - hudT > 250) {
    hudT = now;
    $('#hud').textContent = `${sys.name}\n${Math.round(fps)} fps · ${sim.total} particles · t ${sim.t.toFixed(2)}s${paused ? ' · paused' : ''}${recording ? ' · ● REC ' + ((now - recording) / 1000).toFixed(1) : ''}`;
    for (const [id, sp] of countSpans) { const E = sim.E.get(id); sp.textContent = E ? E.ps.length : 0; }
  }
  requestAnimationFrame(frame);
}

/* ---------------- boot ---------------- */
const saved = store.get('nl2.current', null);
try { loadSystem(saved && saved.emitters ? saved : PRESETS['Boost Burst']()); } catch (e) { console.warn(e); loadSystem(PRESETS['Boost Burst']()); }
refreshLib();
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
