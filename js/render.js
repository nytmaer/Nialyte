/* Niagara Lite — WebGL2 renderer: sprites, ribbons, meshes, lights, decals, ground. */
'use strict';

const BG = { night: [.031, .051, .098], black: [0, 0, 0], grey: [.16, .17, .19], sky: [.42, .55, .7] };
const BLEND_ID = { additive: 0, translucent: 1, premult: 2, modulate: 3, masked: 4, opaque: 5 };

const mat4 = {
  persp(fov, a, n, f) { const t = 1 / Math.tan(fov / 2), o = new Float32Array(16); o[0] = t / a; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
  look(e, c, u) {
    let z = norm3([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = norm3([u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]), y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]);
  },
  mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
};

const SH = {
  spriteVS: `#version 300 es
precision highp float;
layout(location=0) in vec2 aC; layout(location=1) in vec3 iPos; layout(location=2) in vec3 iVel; layout(location=3) in vec2 iSize;
layout(location=4) in float iRot; layout(location=5) in vec4 iCol; layout(location=6) in float iFrame;
uniform mat4 uVP; uniform vec3 uCamPos,uCamUp,uCamFwd,uCamRight; uniform int uAlign,uFacing; uniform vec3 uCAlign,uCFace; uniform vec2 uPivot,uGrid; uniform float uStretch;
out vec2 vUV; out vec4 vCol;
void main(){
  vec3 toCam=normalize(uCamPos-iPos);
  vec3 N = uFacing==0 ? -uCamFwd : (uFacing==1 ? toCam : normalize(uCFace));
  vec3 A; vec2 sz=iSize; float rot=iRot;
  if(uAlign==0){ A = uFacing==2 ? (abs(N.z)<.99?vec3(0,0,1):vec3(1,0,0)) : uCamUp; }
  else if(uAlign==1){ float sp=length(iVel); A = sp>1e-3 ? iVel/sp : uCamUp; sz.y*=1.+sp*uStretch; rot=0.; }
  else { A=normalize(uCAlign); rot=0.; }
  vec3 R=cross(A,N); float rl=length(R); R = rl>1e-4 ? R/rl : uCamRight; vec3 U=cross(N,R);
  float c=cos(rot), s=sin(rot); vec3 R2=R*c+U*s, U2=-R*s+U*c;
  vec2 q=aC-vec2(uPivot.x-.5,.5-uPivot.y);
  gl_Position=uVP*vec4(iPos+R2*q.x*sz.x+U2*q.y*sz.y,1.);
  vec2 uv=vec2(aC.x+.5,.5-aC.y); float nf=uGrid.x*uGrid.y, f=mod(floor(iFrame+.001),nf);
  vUV=(vec2(mod(f,uGrid.x),floor(f/uGrid.x))+uv)/uGrid; vCol=iCol;
}`,
  ribbonVS: `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol; layout(location=2) in vec2 aUV;
uniform mat4 uVP; out vec2 vUV; out vec4 vCol;
void main(){ gl_Position=uVP*vec4(aPos,1.); vUV=aUV; vCol=aCol; }`,
  fxFS: `#version 300 es
precision highp float;
in vec2 vUV; in vec4 vCol; uniform sampler2D uTex; uniform int uBlend; uniform float uEmis; uniform int uRepeat; out vec4 o;
void main(){ vec2 uv=uRepeat==1?vec2(fract(vUV.x),vUV.y):vUV; vec4 t=texture(uTex,uv); vec4 c=vec4(vCol.rgb*t.rgb*uEmis, clamp(vCol.a,0.,1.)*t.a);
  if(uBlend==3){ o=vec4(mix(vec3(1),c.rgb,c.a),1.); return; }
  if(uBlend>=4){ if(c.a<.33) discard; o=vec4(c.rgb,1.); return; }
  if(uBlend==2){ o=vec4(c.rgb*c.a,c.a); return; }
  o=c; }`,
  meshVS: `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec3 iPos; layout(location=3) in vec3 iScale;
layout(location=4) in vec4 iRot; layout(location=5) in vec4 iCol; layout(location=6) in vec3 iVel;
uniform mat4 uVP; uniform vec3 uCamPos; uniform int uFacing; out vec3 vN; out vec3 vW; out vec4 vCol;
mat3 aa(vec3 a,float t){ a=normalize(a); float c=cos(t),s=sin(t),k=1.-c;
  return mat3(c+a.x*a.x*k, a.y*a.x*k+a.z*s, a.z*a.x*k-a.y*s, a.x*a.y*k-a.z*s, c+a.y*a.y*k, a.z*a.y*k+a.x*s, a.x*a.z*k+a.y*s, a.y*a.z*k-a.x*s, c+a.z*a.z*k); }
mat3 basis(vec3 X){ X=normalize(X); vec3 up=abs(X.z)<.99?vec3(0,0,1):vec3(0,1,0); vec3 Y=normalize(cross(up,X)); return mat3(X,Y,cross(X,Y)); }
void main(){ mat3 R;
  if(uFacing==1 && length(iVel)>1e-3) R=basis(iVel)*aa(vec3(1,0,0),iRot.w);
  else if(uFacing==2) R=basis(uCamPos-iPos)*aa(vec3(1,0,0),iRot.w);
  else R=aa(iRot.xyz,iRot.w);
  vec3 w=iPos+R*(aPos*iScale); vW=w; vN=R*normalize(aNor/max(abs(iScale),vec3(1e-4))); vCol=iCol; gl_Position=uVP*vec4(w,1.); }`,
  meshFS: `#version 300 es
precision highp float;
in vec3 vN; in vec3 vW; in vec4 vCol; uniform int uLit,uNL,uBlend; uniform float uEmis; uniform vec4 uLP[16]; uniform vec4 uLC[16]; uniform vec3 uAmb; out vec4 o;
void main(){ vec3 n=normalize(gl_FrontFacing?vN:-vN); vec3 b=vCol.rgb; vec3 col;
  if(uLit==1){ vec3 L=normalize(vec3(.4,.3,.85)); col=b*(uAmb+.75*max(dot(n,L),0.));
    for(int i=0;i<16;i++){ if(i>=uNL) break; vec3 lv=uLP[i].xyz-vW; float d=length(lv); float at=pow(clamp(1.-d/uLP[i].w,0.,1.),2.); col+=b*uLC[i].rgb*at*max(dot(n,lv/max(d,1e-3)),0.)*1.5; } }
  else col=b; col*=uEmis; float a=clamp(vCol.a,0.,1.);
  if(uBlend>=4){ if(a<.33) discard; o=vec4(col,1.); return; }
  o=vec4(col,a); }`,
  floorVS: `#version 300 es
precision highp float; layout(location=0) in vec3 aPos; uniform mat4 uVP; out vec3 vW; void main(){ vW=aPos; gl_Position=uVP*vec4(aPos,1.); }`,
  floorFS: `#version 300 es
precision highp float; in vec3 vW; uniform int uNL; uniform vec4 uLP[16]; uniform vec4 uLC[16]; uniform vec3 uBase; uniform float uGrid; out vec4 o;
void main(){ vec2 g=vW.xy/100.; vec2 f=abs(fract(g-.5)-.5)/fwidth(g); float line=1.-min(min(f.x,f.y),1.);
  vec2 g2=vW.xy/500.; vec2 f2=abs(fract(g2-.5)-.5)/fwidth(g2); float line2=1.-min(min(f2.x,f2.y),1.);
  float fade=1.-smoothstep(600.,2600.,length(vW.xy));
  vec3 col=uBase+(line*.035+line2*.06)*uGrid*fade;
  for(int i=0;i<16;i++){ if(i>=uNL) break; vec3 lv=uLP[i].xyz-vW; float d=length(lv); float at=pow(clamp(1.-d/uLP[i].w,0.,1.),2.); col+=uLC[i].rgb*at*max(lv.z/max(d,1.),0.)*.6; }
  o=vec4(col,1.); }`
};

function buildMeshes() {
  const M = {};
  const push = (arr, p, n) => arr.push(p[0], p[1], p[2], n[0], n[1], n[2]);
  const tri = (arr, a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const n = norm3([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]); push(arr, a, n); push(arr, b, n); push(arr, c, n); };
  const quad = (arr, a, b, c, d) => { tri(arr, a, b, c); tri(arr, a, c, d); };
  { const a = [], h = 50, v = (x, y, z) => [x * h, y * h, z * h];
    quad(a, v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)); quad(a, v(-1, 1, -1), v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1));
    quad(a, v(1, 1, -1), v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1)); quad(a, v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1));
    quad(a, v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)); quad(a, v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1), v(-1, -1, -1)); M.cube = a; }
  { const a = [], S = 14, R = 8; const P = (i, j) => { const th = i / S * TAU, ph = j / R * Math.PI; return [Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph)]; };
    for (let i = 0; i < S; i++) for (let j = 0; j < R; j++) { const p = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]; for (const [x, y, z] of [[0, 1, 2], [0, 2, 3]]) for (const k of [x, y, z]) push(a, p[k].map(c => c * 50), p[k]); } M.sphere = a; }
  { const a = [], L = 80, W = 22, pts = [[L, 0, 0], [-L * .6, 0, 0]], r = [[0, W, 0], [0, 0, W * .6], [0, -W, 0], [0, 0, -W * .6]];
    for (let i = 0; i < 4; i++) { const p = r[i], q = r[(i + 1) % 4]; tri(a, pts[0], p, q); tri(a, pts[1], q, p); } M.shard = a; }
  { const a = [], S = 14; for (let i = 0; i < S; i++) { const t0 = i / S * TAU, t1 = (i + 1) / S * TAU, p0 = [-50, 50 * Math.cos(t0), 50 * Math.sin(t0)], p1 = [-50, 50 * Math.cos(t1), 50 * Math.sin(t1)]; tri(a, [50, 0, 0], p0, p1); tri(a, [-50, 0, 0], p1, p0); } M.cone = a; }
  { const a = [], S = 14; for (let i = 0; i < S; i++) { const t0 = i / S * TAU, t1 = (i + 1) / S * TAU, c0 = Math.cos(t0) * 50, s0 = Math.sin(t0) * 50, c1 = Math.cos(t1) * 50, s1 = Math.sin(t1) * 50;
      const n0 = [0, Math.cos(t0), Math.sin(t0)], n1 = [0, Math.cos(t1), Math.sin(t1)];
      push(a, [-50, c0, s0], n0); push(a, [50, c0, s0], n0); push(a, [50, c1, s1], n1); push(a, [-50, c0, s0], n0); push(a, [50, c1, s1], n1); push(a, [-50, c1, s1], n1);
      tri(a, [50, 0, 0], [50, c0, s0], [50, c1, s1]); tri(a, [-50, 0, 0], [-50, c1, s1], [-50, c0, s0]); } M.cylinder = a; }
  { const a = []; quad(a, [-50, -50, 0], [50, -50, 0], [50, 50, 0], [-50, 50, 0]); M.quad = a; }
  return M;
}

class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl; this.canvas = canvas; this.tex = {}; this.customTex = {};
    const P = (vs, fs) => { const p = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); } gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const an = gl.getActiveUniform(p, i).name; u[an.replace('[0]', '')] = gl.getUniformLocation(p, an); } return { p, u }; };
    this.pSprite = P(SH.spriteVS, SH.fxFS); this.pRibbon = P(SH.ribbonVS, SH.fxFS); this.pMesh = P(SH.meshVS, SH.meshFS); this.pFloor = P(SH.floorVS, SH.floorFS);

    // sprite VAO
    this.sVao = gl.createVertexArray(); gl.bindVertexArray(this.sVao);
    const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5, -.5, .5, -.5, .5, .5, -.5, -.5, .5, .5, -.5, .5]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.sBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.sBuf);
    const sl = [[1, 3, 0], [2, 3, 3], [3, 2, 6], [4, 1, 8], [5, 4, 9], [6, 1, 13]];
    for (const [loc, n, off] of sl) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 56, off * 4); gl.vertexAttribDivisor(loc, 1); }
    this.sData = new Float32Array(14 * 4096);

    // ribbon VAO
    this.rVao = gl.createVertexArray(); gl.bindVertexArray(this.rVao);
    this.rBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.rBuf);
    for (const [loc, n, off] of [[0, 3, 0], [1, 4, 3], [2, 2, 7]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 36, off * 4); }
    this.rData = new Float32Array(9 * 8192);

    // meshes
    this.mInst = gl.createBuffer(); this.mData = new Float32Array(17 * 2048); this.meshes = {};
    const geo = buildMeshes();
    for (const k in geo) {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo[k]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.mInst);
      for (const [loc, n, off] of [[2, 3, 0], [3, 3, 3], [4, 4, 6], [5, 4, 10], [6, 3, 14]]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 68, off * 4); gl.vertexAttribDivisor(loc, 1); }
      this.meshes[k] = { vao, count: geo[k].length / 6 };
    }
    // floor
    this.fVao = gl.createVertexArray(); gl.bindVertexArray(this.fVao);
    const fb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, fb); const F = 4000;
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-F, -F, 0, F, -F, 0, F, F, 0, -F, -F, 0, F, F, 0, -F, F, 0]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.lp = new Float32Array(64); this.lc = new Float32Array(64); this.nl = 0;
  }

  texture(key, sys) {
    const gl = this.gl;
    if (key && key.startsWith('custom:')) {
      const url = sys && sys.textures[key]; if (!url) return this.texture('glow');
      const c = this.customTex[key];
      if (c && c.url === url) return c.ready ? c.t : this.texture('glow');
      const ent = { url, ready: false, t: gl.createTexture() }; this.customTex[key] = ent;
      const img = new Image(); img.onload = () => { this.upload(ent.t, img); ent.ready = true; }; img.src = url;
      return this.texture('glow');
    }
    if (!this.tex[key]) { const t = gl.createTexture(); this.upload(t, makeTextureCanvas(key)); this.tex[key] = t; }
    return this.tex[key];
  }
  upload(t, src) {
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  setBlend(b) {
    const gl = this.gl;
    if (b === 'opaque' || b === 'masked') { gl.disable(gl.BLEND); gl.depthMask(true); return; }
    gl.enable(gl.BLEND); gl.depthMask(false);
    if (b === 'additive') gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    else if (b === 'translucent') gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    else if (b === 'premult') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else if (b === 'modulate') gl.blendFunc(gl.DST_COLOR, gl.ZERO);
  }

  /* cam: {eye,target}. opts: {w,h,bg,floor} */
  render(sim, cam, opts) {
    const gl = this.gl, S = sim.sys, w = opts.w, h = opts.h;
    gl.viewport(0, 0, w, h);
    const bg = opts.bg === 'transparent' ? [0, 0, 0] : BG[S.bg] || BG.night;
    gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
    const eye = cam.eye, tgt = cam.target;
    const view = mat4.look(eye, tgt, [0, 0, 1]), proj = mat4.persp(cam.fov * D2R, w / h, 5, 20000), VP = mat4.mul(proj, view);
    const fwd = norm3([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
    const rgt = norm3([fwd[1], -fwd[0], 0]); // fwd × Z
    const up = [rgt[1] * fwd[2] - rgt[2] * fwd[1], rgt[2] * fwd[0] - rgt[0] * fwd[2], rgt[0] * fwd[1] - rgt[1] * fwd[0]];
    const C = { eye, fwd, right: rgt, up, VP };

    // collect draw items + lights
    const items = []; let nl = 0; const lp = this.lp, lc = this.lc, glows = [];
    S.emitters.forEach((em, ei) => {
      const E = sim.E.get(em.id); if (!E || !E.ps.length || !em.on) return;
      const off = em.local ? sim.comp : [0, 0, 0];
      for (const r of em.render) {
        if (!r.on || MODS[r.t].spec) continue;
        if (r.t === 'light') {
          const P = r.p, oc = hex3(P.color.c);
          for (const p of E.ps) {
            if (nl >= 16) break;
            const k = P.intensity * (P.alpha ? clamp(p.a, 0, 1) : 1), col = P.colorMode === 'override' ? [oc[0] * P.color.i, oc[1] * P.color.i, oc[2] * P.color.i] : [p.r, p.g, p.b];
            const rad = Math.max(p.sx, p.sy) * P.radiusScale;
            lp[nl * 4] = p.x + off[0]; lp[nl * 4 + 1] = p.y + off[1]; lp[nl * 4 + 2] = p.z + off[2]; lp[nl * 4 + 3] = Math.max(1, rad);
            lc[nl * 4] = col[0] * k; lc[nl * 4 + 1] = col[1] * k; lc[nl * 4 + 2] = col[2] * k; nl++;
          }
          if (P.glow) items.push({ kind: 'glow', em, E, r, off, ei, order: 0, blend: 'additive' });
          continue;
        }
        items.push({ kind: r.t, em, E, r, off, ei, order: r.p.order || 0, blend: r.p.blend || 'additive' });
      }
    });
    this.nl = nl;

    if (opts.floor && S.floor) {
      const pf = this.pFloor; gl.useProgram(pf.p); gl.uniformMatrix4fv(pf.u.uVP, false, VP);
      const b = BG[S.bg] || BG.night; gl.uniform3f(pf.u.uBase, b[0] * 1.25 + .012, b[1] * 1.25 + .014, b[2] * 1.25 + .02); gl.uniform1f(pf.u.uGrid, 1);
      gl.uniform1i(pf.u.uNL, nl); gl.uniform4fv(pf.u.uLP, lp); gl.uniform4fv(pf.u.uLC, lc);
      gl.disable(gl.BLEND); gl.depthMask(true); gl.bindVertexArray(this.fVao); gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    const opaque = items.filter(i => i.blend === 'opaque' || i.blend === 'masked'), trans = items.filter(i => !(i.blend === 'opaque' || i.blend === 'masked'));
    trans.sort((a, b) => a.order - b.order || (a.kind === 'decal' ? -1 : 0) - (b.kind === 'decal' ? -1 : 0) || a.ei - b.ei);
    for (const it of [...opaque, ...trans]) {
      this.setBlend(it.blend);
      if (it.kind === 'sprite') this.drawSprites(it, C, S);
      else if (it.kind === 'decal') this.drawSprites(it, C, S, 'decal');
      else if (it.kind === 'glow') this.drawSprites(it, C, S, 'glow');
      else if (it.kind === 'ribbon') this.drawRibbons(it, C, S);
      else if (it.kind === 'mesh') this.drawMeshes(it, C, S);
    }
    gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null);
  }

  drawSprites(it, C, S, mode) {
    const gl = this.gl, P = it.r.p, ps = it.E.ps, off = it.off, n = ps.length; let order = ps;
    if (mode !== 'glow' && P.sort && P.sort !== 'none') {
      order = ps.slice(); const e = C.eye, f = C.fwd;
      if (P.sort === 'depth') { const d = p => (p.x + off[0] - e[0]) * f[0] + (p.y + off[1] - e[1]) * f[1] + (p.z + off[2] - e[2]) * f[2]; order.sort((a, b) => d(b) - d(a)); }
      else if (P.sort === 'distance') { const d = p => Math.hypot(p.x + off[0] - e[0], p.y + off[1] - e[1], p.z + off[2] - e[2]); order.sort((a, b) => d(b) - d(a)); }
      else if (P.sort === 'oldest') order.sort((a, b) => a.id - b.id); else order.sort((a, b) => b.id - a.id);
    }
    if (this.sData.length < n * 14) this.sData = new Float32Array(n * 14 * 2);
    const D = this.sData; let k = 0;
    const scale = mode === 'glow' ? P.glowScale * P.radiusScale : (P.sizeScale || 1);
    for (const p of order) {
      let x = p.x + off[0], y = p.y + off[1], z = p.z + off[2], a = p.a, emis = p.emis;
      if (mode === 'decal') { const ht = z - 0; a *= 1 - clamp(ht / P.fadeHeight, 0, 1); z = .6; }
      if (p.camOff) { const dx = C.eye[0] - x, dy = C.eye[1] - y, dz = C.eye[2] - z, l = Math.hypot(dx, dy, dz) || 1; x += dx / l * p.camOff; y += dy / l * p.camOff; z += dz / l * p.camOff; }
      let r = p.r * emis, g = p.g * emis, b = p.b * emis;
      if (mode === 'glow') { const s = P.intensity * .35; r *= s; g *= s; b *= s; }
      D[k++] = x; D[k++] = y; D[k++] = z; D[k++] = p.vx; D[k++] = p.vy; D[k++] = p.vz;
      D[k++] = p.sx * scale; D[k++] = (mode === 'glow' ? p.sx : p.sy) * scale; D[k++] = p.rot; D[k++] = r; D[k++] = g; D[k++] = b; D[k++] = a; D[k++] = p.frame;
    }
    const pr = this.pSprite; gl.useProgram(pr.p); const u = pr.u;
    gl.uniformMatrix4fv(u.uVP, false, C.VP); gl.uniform3fv(u.uCamPos, C.eye); gl.uniform3fv(u.uCamUp, C.up); gl.uniform3fv(u.uCamFwd, C.fwd); gl.uniform3fv(u.uCamRight, C.right);
    if (mode === 'decal') { gl.uniform1i(u.uAlign, 0); gl.uniform1i(u.uFacing, 2); gl.uniform3f(u.uCFace, 0, 0, 1); gl.uniform2f(u.uPivot, .5, .5); gl.uniform2f(u.uGrid, 1, 1); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2); }
    else if (mode === 'glow') { gl.uniform1i(u.uAlign, 0); gl.uniform1i(u.uFacing, 0); gl.uniform2f(u.uPivot, .5, .5); gl.uniform2f(u.uGrid, 1, 1); }
    else {
      gl.uniform1i(u.uAlign, { unaligned: 0, velocity: 1, custom: 2 }[P.align]); gl.uniform1i(u.uFacing, { cameraPlane: 0, cameraPos: 1, custom: 2 }[P.facing]);
      gl.uniform3fv(u.uCAlign, P.alignVec); gl.uniform3fv(u.uCFace, P.faceVec); gl.uniform2f(u.uPivot, P.pivotX, P.pivotY); gl.uniform2f(u.uGrid, Math.max(1, Math.round(P.cols)), Math.max(1, Math.round(P.rows)));
    }
    gl.uniform1f(u.uStretch, mode ? 0 : P.stretch || 0); gl.uniform1i(u.uBlend, BLEND_ID[it.blend]); gl.uniform1f(u.uEmis, mode === 'glow' ? 1 : P.emissive); gl.uniform1i(u.uRepeat, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texture(mode === 'glow' ? 'glow' : P.tex, S)); gl.uniform1i(u.uTex, 0);
    gl.bindVertexArray(this.sVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.sBuf); gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, k), gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
    if (mode === 'decal') gl.disable(gl.POLYGON_OFFSET_FILL);
  }

  drawRibbons(it, C, S) {
    const gl = this.gl, P = it.r.p, off = it.off;
    const groups = new Map();
    for (const p of it.E.ps) { const key = P.link === 'burst' ? p.rid : 0; let g = groups.get(key); if (!g) groups.set(key, g = []); g.push(p); }
    let D = this.rData, k = 0;
    const pushV = (x, y, z, r, g, b, a, u, v) => { if (k + 9 > D.length) { const nd = new Float32Array(D.length * 2); nd.set(D); D = this.rData = nd; } D[k++] = x; D[k++] = y; D[k++] = z; D[k++] = r; D[k++] = g; D[k++] = b; D[k++] = a; D[k++] = u; D[k++] = v; };
    const tess = Math.max(0, Math.round(P.tess)), fv = norm3(P.faceVec);
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      g.sort(P.linkOrder === 'oldest' ? (a, b) => a.id - b.id : (a, b) => b.id - a.id);
      // tessellate with Catmull-Rom
      const pts = [];
      for (let i = 0; i < g.length; i++) {
        const p0 = g[Math.max(0, i - 1)], p1 = g[i], p2 = g[Math.min(g.length - 1, i + 1)], p3 = g[Math.min(g.length - 1, i + 2)];
        const steps = i === g.length - 1 ? 1 : tess + 1;
        for (let s = 0; s < steps; s++) {
          const t = s / (tess + 1), t2 = t * t, t3 = t2 * t;
          const cr = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
          pts.push({ x: cr(p0.x, p1.x, p2.x, p3.x) + off[0], y: cr(p0.y, p1.y, p2.y, p3.y) + off[1], z: cr(p0.z, p1.z, p2.z, p3.z) + off[2],
            w: lerp(p1.sx, p2.sx, t) * P.width, r: lerp(p1.r, p2.r, t) * p1.emis, g: lerp(p1.g, p2.g, t) * p1.emis, b: lerp(p1.b, p2.b, t) * p1.emis, a: lerp(p1.a, p2.a, t), seg: i + t });
        }
      }
      let total = 0; for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z);
      let dist = 0; const L = [], Rr = [];
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        if (i > 0) dist += Math.hypot(q.x - a.x, q.y - a.y, q.z - a.z);
        const tg = norm3([b.x - a.x, b.y - a.y, b.z - a.z]); let side;
        if (P.facing === 'screen') { const tc = norm3([C.eye[0] - q.x, C.eye[1] - q.y, C.eye[2] - q.z]); side = norm3([tg[1] * tc[2] - tg[2] * tc[1], tg[2] * tc[0] - tg[0] * tc[2], tg[0] * tc[1] - tg[1] * tc[0]]); }
        else if (P.facing === 'custom') side = norm3([tg[1] * fv[2] - tg[2] * fv[1], tg[2] * fv[0] - tg[0] * fv[2], tg[0] * fv[1] - tg[1] * fv[0]]);
        else side = fv;
        const u = P.uv === 'stretch' ? dist / (total || 1) : P.uv === 'distance' ? dist / P.tile : q.seg, hw = q.w / 2;
        L.push([q.x + side[0] * hw, q.y + side[1] * hw, q.z + side[2] * hw, q, u]); Rr.push([q.x - side[0] * hw, q.y - side[1] * hw, q.z - side[2] * hw, q, u]);
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = L[i], b = Rr[i], c = L[i + 1], d = Rr[i + 1];
        for (const [v, vv] of [[a, 0], [b, 1], [c, 0], [b, 1], [d, 1], [c, 0]]) pushV(v[0], v[1], v[2], v[3].r, v[3].g, v[3].b, v[3].a, v[4], vv);
      }
    }
    if (!k) return;
    const pr = this.pRibbon; gl.useProgram(pr.p); gl.uniformMatrix4fv(pr.u.uVP, false, C.VP);
    gl.uniform1i(pr.u.uBlend, BLEND_ID[it.blend]); gl.uniform1f(pr.u.uEmis, P.emissive); gl.uniform1i(pr.u.uRepeat, P.uv === 'stretch' ? 0 : 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texture(P.tex, S)); gl.uniform1i(pr.u.uTex, 0);
    gl.bindVertexArray(this.rVao); gl.bindBuffer(gl.ARRAY_BUFFER, this.rBuf); gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, k), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, k / 9);
  }

  drawMeshes(it, C, S) {
    const gl = this.gl, P = it.r.p, ps = it.E.ps, off = it.off, n = ps.length, ms = this.meshes[P.mesh] || this.meshes.cube;
    if (this.mData.length < n * 17) this.mData = new Float32Array(n * 17 * 2);
    const D = this.mData; let k = 0; const sc = P.scale;
    for (const p of ps) {
      D[k++] = p.x + off[0]; D[k++] = p.y + off[1]; D[k++] = p.z + off[2]; D[k++] = p.mx * sc; D[k++] = p.my * sc; D[k++] = p.mz * sc;
      D[k++] = p.axx; D[k++] = p.axy; D[k++] = p.axz; D[k++] = p.mang; D[k++] = p.r * p.emis; D[k++] = p.g * p.emis; D[k++] = p.b * p.emis; D[k++] = p.a; D[k++] = p.vx; D[k++] = p.vy; D[k++] = p.vz;
    }
    const pr = this.pMesh, u = pr.u; gl.useProgram(pr.p);
    gl.uniformMatrix4fv(u.uVP, false, C.VP); gl.uniform3fv(u.uCamPos, C.eye); gl.uniform1i(u.uFacing, { default: 0, velocity: 1, camera: 2 }[P.facing]);
    gl.uniform1i(u.uLit, P.shading === 'lit' ? 1 : 0); gl.uniform1i(u.uBlend, BLEND_ID[it.blend]); gl.uniform1f(u.uEmis, P.emissive);
    const b = BG[S.bg] || BG.night; gl.uniform3f(u.uAmb, .18 + b[0] * .5, .18 + b[1] * .5, .2 + b[2] * .5);
    gl.uniform1i(u.uNL, this.nl); gl.uniform4fv(u.uLP, this.lp); gl.uniform4fv(u.uLC, this.lc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mInst); gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, k), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(ms.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, ms.count, n);
  }
}
