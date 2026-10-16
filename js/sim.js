/* Niagara Lite — CPU simulation. Reads the system model live, so edits apply without a restart. */
'use strict';

const PHASES = { force: [], vel: [], post: [] };

function compPos(S, t) {
  const R = S.motionR, w = S.motionSpeed, h = S.motionZ;
  switch (S.motion) {
    case 'orbit': return [R * Math.cos(w * t), R * Math.sin(w * t), h];
    case 'line': return [R * Math.sin(w * t), 0, h];
    case 'figure8': return [R * Math.sin(w * t), R * .5 * Math.sin(2 * w * t), h];
    case 'bounce': return [0, 0, h + R * Math.abs(Math.sin(w * t))];
    case 'spiral': { const k = (t * w / TAU) % 3; return [R * .6 * Math.cos(w * t), R * .6 * Math.sin(w * t), h + k * R * .5]; }
    default: return [0, 0, h];
  }
}

class Sim {
  constructor(sys, opts = {}) { this.sys = sys; this.forceDet = !!opts.deterministic; this.reset(); }

  reset() {
    this.E = new Map(); this.t = 0; this.events = new Map(); this.total = 0;
    this.comp = compPos(this.sys, 0); this.prevComp = this.comp.slice(); this.cvel = [0, 0, 0];
    const S = this.sys;
    if (S.warmup > 0) { const dt = Math.max(.005, S.warmupDt); for (let t = 0; t < S.warmup; t += dt) this.step(dt); }
  }

  mkE(em) {
    const det = this.forceDet || em.det;
    return {
      id: em.id, ps: [], pool: [], age: 0, loopStart: 0, loop: 0, lastSt: -1e-6, state: 'active', acc: {}, nextId: 1, batch: 0, gridIdx: 0,
      rand: det ? mulberry32((em.seed | 0) * 7919 + 17) : Math.random
    };
  }

  newP(E) {
    const p = E.pool.pop() || {};
    p.id = E.nextId++; p.x = p.y = p.z = 0; p.vx = p.vy = p.vz = 0; p.fx = p.fy = p.fz = 0; p.drag = 0;
    p.age = 0; p.life = 1; p.na = 0; p.mass = 1; p.dead = false; p.bounces = 0; p.locAcc = 0; p.camOff = 0;
    p.bsx = p.bsy = p.sx = p.sy = 10; p.rot = 0; p.srate = 0; p.frame = 0; p.emis = 1;
    p.br = p.bg = p.bb = p.ba = 1; p.r = p.g = p.b = p.a = 1;
    p.bmx = p.bmy = p.bmz = p.mx = p.my = p.mz = 1; p.axx = 0; p.axy = 0; p.axz = 1; p.mang = 0; p.mrate = 0;
    p.nx = 0; p.ny = 0; p.nz = 1; p.rid = E.batch;
    return p;
  }

  step(dtIn) {
    const S = this.sys, dt = Math.min(dtIn, .1);
    this.t += dt;
    this.prevComp = this.comp; this.comp = compPos(S, this.t);
    this.cvel = [(this.comp[0] - this.prevComp[0]) / dt, (this.comp[1] - this.prevComp[1]) / dt, (this.comp[2] - this.prevComp[2]) / dt];
    const solo = S.emitters.some(e => e.solo && e.on), next = new Map();
    let total = 0;
    for (const em of S.emitters) {
      let E = this.E.get(em.id); if (!E) { E = this.mkE(em); this.E.set(em.id, E); }
      if (!em.on || (solo && !em.solo)) { if (E.ps.length) { E.pool.push(...E.ps); E.ps.length = 0; } continue; }
      this.stepEmitter(em, E, dt, next); total += E.ps.length;
    }
    for (const id of this.E.keys()) if (!S.emitters.some(e => e.id === id)) this.E.delete(id);
    this.events = next; this.total = total;
  }

  stepEmitter(em, E, dt, next) {
    const S = this.sys, comp = this.comp, prev = this.prevComp, local = em.local;
    const ox = local ? comp[0] : 0, oy = local ? comp[1] : 0, oz = local ? comp[2] : 0;
    const out = [];
    const emitEvent = (type, p) => { if (out.length < 4000) out.push({ type, x: p.x + ox, y: p.y + oy, z: p.z + oz, vx: p.vx, vy: p.vy, vz: p.vz }); };
    let frames = 1;
    for (const r of em.render) if (r.on && r.t === 'sprite') frames = Math.max(frames, Math.round(r.p.cols) * Math.round(r.p.rows));
    const ctx = { E, em, rand: E.rand, dt, t: this.t, i: 0, n: 1, cvx: this.cvel[0], cvy: this.cvel[1], cvz: this.cvel[2], ox, oy, oz, frames, tmp: [0, 0, 0], emitEvent };

    /* ---- emitter lifecycle + spawn count ---- */
    let n = 0;
    if (E.state === 'active') {
      E.age += dt;
      const delay = (em.delayFirst && E.loop > 0) ? 0 : em.delay;
      const st = E.age - E.loopStart - delay;
      if (st >= 0) {
        const dist = Math.hypot(comp[0] - prev[0], comp[1] - prev[1], comp[2] - prev[2]);
        const c = { dt, st, pst: E.lastSt, scale: em.scale * S.spawnScale, rand: E.rand, dist };
        for (const mo of em.emit) if (mo.on) { const M = MODS[mo.t]; if (M.emit) n += M.emit(mo, mo.p, E, c); }
        E.lastSt = st;
      }
      if (st >= em.dur) {
        E.loop++; E.loopStart += delay + em.dur; E.lastSt = -1e-6;
        if (em.loop === 'once' || (em.loop === 'multiple' && E.loop >= em.loopCount)) E.state = 'inactive';
      }
    }
    if (n > 0) this.spawn(em, E, n, ctx, null, null);

    /* ---- event handlers (events produced by other emitters last step) ---- */
    for (const h of em.events) {
      if (!h.on || !h.p.src) continue;
      const list = this.events.get(h.p.src); if (!list) continue;
      let used = 0;
      for (const e of list) { if (e.type !== h.p.type) continue; if (used++ >= h.p.max) break; this.spawn(em, E, Math.round(h.p.count * em.scale * S.spawnScale), ctx, e, h.p); }
    }

    /* ---- particle update ---- */
    PHASES.force.length = PHASES.vel.length = PHASES.post.length = 0;
    let death = false;
    for (const mo of em.update) if (mo.on) { const M = MODS[mo.t]; if (mo.t === 'deathEvent') death = true; else if (M.update) PHASES[M.phase || 'force'].push(mo); }
    const F = PHASES.force, V = PHASES.vel, P = PHASES.post, ps = E.ps;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.na = p.age / p.life;
      p.r = p.br; p.g = p.bg; p.b = p.bb; p.a = p.ba; p.sx = p.bsx; p.sy = p.bsy; p.mx = p.bmx; p.my = p.bmy; p.mz = p.bmz;
      p.emis = 1; p.camOff = 0; p.fx = p.fy = p.fz = 0; p.drag = 0;
      for (const mo of F) MODS[mo.t].update(p, mo.p, ctx);
      p.vx += p.fx * dt; p.vy += p.fy * dt; p.vz += p.fz * dt;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
      for (const mo of V) MODS[mo.t].update(p, mo.p, ctx);
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.mang += p.mrate * dt;
      if (!p.dead) for (const mo of P) { MODS[mo.t].update(p, mo.p, ctx); if (p.dead) break; }
      p.age += dt;
      if (p.age >= p.life) p.dead = true;
      if (p.dead) { if (death) emitEvent('death', p); ps[i] = ps[ps.length - 1]; ps.pop(); E.pool.push(p); }
    }
    if (out.length) next.set(em.id, out);
  }

  spawn(em, E, n, ctx, ev, h) {
    n = Math.min(n, em.max - E.ps.length); if (n <= 0) return;
    const comp = this.comp, prev = this.prevComp, local = em.local, interp = em.interp && !ev;
    E.batch++; ctx.n = n;
    for (let i = 0; i < n; i++) {
      const p = this.newP(E); ctx.i = i;
      let ox, oy, oz;
      if (ev) { ox = ev.x; oy = ev.y; oz = ev.z; }
      else if (interp) { const k = (i + 1) / n; ox = lerp(prev[0], comp[0], k); oy = lerp(prev[1], comp[1], k); oz = lerp(prev[2], comp[2], k); }
      else { ox = comp[0]; oy = comp[1]; oz = comp[2]; }
      if (local) { ox -= comp[0]; oy -= comp[1]; oz -= comp[2]; }
      if (!ev || h.useSpawn) for (const mo of em.spawn) if (mo.on) MODS[mo.t].spawn(p, mo.p, ctx);
      p.x += ox; p.y += oy; p.z += oz;
      if (ev && h.inherit) { p.vx += ev.vx * h.inherit; p.vy += ev.vy * h.inherit; p.vz += ev.vz * h.inherit; }
      if (interp && n > 1) p.age = ctx.dt * (1 - (i + 1) / n);
      E.ps.push(p);
    }
  }
}
