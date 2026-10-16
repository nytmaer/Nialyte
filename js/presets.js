/* NytLite — emitter templates (modelled on Niagara's built-in templates) and system presets. */
'use strict';

const m = mkMod;
function Em(name, props, st) {
  return { id: uid(), name, on: true, ...props, emit: st.emit || [], spawn: st.spawn || [], update: st.update || [], render: st.render || [], events: st.events || [] };
}
const ev = (src, type, count, extra = {}) => ({ uid: uid(), on: true, p: { src, type, count, ...extra } });
const fade = (c = '#ffffff') => gr([c, 1, 0], [c, 0, 1]);

/* ---------- emitter templates (Add Emitter menu) ---------- */
const EMITTER_TEMPLATES = {
  'Empty': () => Em('Empty', {}, { emit: [m('spawnRate', { rate: 10 })], spawn: [m('init')], render: [m('sprite')] }),
  'Minimal': () => Em('Minimal', {}, {
    emit: [m('spawnRate', { rate: 20 })], spawn: [m('init', { life: [1, 1.5], size: [12, 18] }), m('shape', { shape: 'sphere', radius: 30 })],
    update: [m('color', { grad: fade() })], render: [m('sprite')]
  }),
  'Fountain': () => Em('Fountain', {}, {
    emit: [m('spawnRate', { rate: 160 })],
    spawn: [m('init', { life: [2, 2.6], size: [6, 10], color: C1('#7fd8ff', 1.4) }), m('shape', { shape: 'point' }), m('addVel', { mode: 'cone', axis: [0, 0, 1], angle: 12, speed: [620, 760] })],
    update: [m('gravity'), m('drag', { drag: .1 }), m('color', { grad: gr(['#ffffff', 1, 0], ['#bfe9ff', 1, .6], ['#bfe9ff', 0, 1]) }), m('scaleSprite', { curve: cv([0, 1], [1, .4]) }), m('collision', { rest: .25, friction: .3 })],
    render: [m('sprite', { tex: 'softDot' })]
  }),
  'Simple Sprite Burst': () => Em('Simple Sprite Burst', { dur: 2 }, {
    emit: [m('spawnBurst', { count: [60, 60] })],
    spawn: [m('init', { life: [.8, 1.4], size: [10, 18] }), m('shape', { shape: 'sphere', radius: 10 }), m('addVel', { mode: 'point', speed: [100, 300] })],
    update: [m('drag', { drag: 2 }), m('color', { grad: fade() }), m('scaleSprite', { curve: cv([0, 1], [1, .2]) })],
    render: [m('sprite')]
  }),
  'Omnidirectional Burst': () => Em('Omnidirectional Burst', { dur: 2 }, {
    emit: [m('spawnBurst', { count: [150, 150] })],
    spawn: [m('init', { life: [.6, 1.2], size: [3, 6], color: C1('#ffc46b', 4) }), m('shape', { shape: 'sphere', radius: 5 }), m('addVel', { mode: 'point', speed: [300, 700] })],
    update: [m('gravity', { g: [0, 0, -300] }), m('drag', { drag: 3 }), m('color', { grad: fade() })],
    render: [m('sprite', { tex: 'spark', align: 'velocity', stretch: .006 })]
  }),
  'Directional Burst': () => Em('Directional Burst', { dur: 2 }, {
    emit: [m('spawnBurst', { count: [80, 80] })],
    spawn: [m('init', { life: [.6, 1], size: [3, 6], color: C1('#9fe7ff', 3) }), m('addVel', { mode: 'cone', axis: [1, 0, .3], angle: 25, speed: [400, 800] })],
    update: [m('gravity'), m('drag', { drag: 1.5 }), m('color', { grad: fade() })],
    render: [m('sprite', { tex: 'spark', align: 'velocity', stretch: .006 })]
  }),
  'Confetti Burst': () => Em('Confetti Burst', { dur: 3 }, {
    emit: [m('spawnBurst', { count: [200, 200] })],
    spawn: [m('init', { life: [2.5, 3], meshScale: [.06, .04, .005], meshRand: [.8, 1.2] }), m('randColor'), m('addVel', { mode: 'cone', axis: [0, 0, 1], angle: 35, speed: [500, 900] }), m('meshOrient', { rate: [180, 720] })],
    update: [m('gravity', { g: [0, 0, -500] }), m('drag', { drag: 2.5, rotDrag: .3 }), m('collision', { rest: .1, friction: .8 })],
    render: [m('mesh', { mesh: 'quad', shading: 'lit' })]
  }),
  'Hanging Particulates': () => Em('Hanging Particulates', {}, {
    emit: [m('spawnRate', { rate: 30 })],
    spawn: [m('init', { life: [4, 6], size: [2, 5], color: C1('#cfd9ff', 1.2) }), m('shape', { shape: 'box', box: [800, 800, 400], offset: [0, 0, 200] })],
    update: [m('curl', { strength: 30, freq: .005 }), m('drag', { drag: 1 }), m('scaleColor', { alpha: cv([0, 0], [.3, 1], [.7, 1], [1, 0]) })],
    render: [m('sprite', { tex: 'softDot' })]
  }),
  'Blowing Particles': () => Em('Blowing Particles', {}, {
    emit: [m('spawnRate', { rate: 60 })],
    spawn: [m('init', { life: [3, 4], size: [4, 8], rot: [0, 360] }), m('shape', { shape: 'box', box: [50, 600, 300], offset: [-400, 0, 150] }), m('addVel', { mode: 'linear', vel: [300, 0, 0], spread: [50, 50, 50] })],
    update: [m('wind', { wind: [250, 0, 40], resist: .5 }), m('curl', { strength: 120, freq: .006 }), m('spriteRot'), m('scaleColor', { alpha: cv([0, 0], [.15, 1], [.8, 1], [1, 0]) })],
    render: [m('sprite', { tex: 'square', blend: 'translucent' })]
  }),
  'Upward Mesh Burst': () => Em('Upward Mesh Burst', { dur: 3 }, {
    emit: [m('spawnBurst', { count: [40, 40] })],
    spawn: [m('init', { life: [2, 3], meshScale: [.12, .12, .12], meshRand: [.5, 1.2], color: C1('#c8a27a') }), m('addVel', { mode: 'cone', angle: 20, speed: [600, 900] }), m('meshOrient', { rate: [-400, 400] })],
    update: [m('gravity'), m('collision', { rest: .35, friction: .4, radius: 6 }), m('scaleMesh', { curve: cv([0, 1], [.85, 1], [1, 0]) })],
    render: [m('mesh', { mesh: 'cube' })]
  }),
  'Single Looping Particle': () => Em('Single Looping Particle', { dur: 2 }, {
    emit: [m('spawnBurst', { count: [1, 1] })],
    spawn: [m('init', { life: [2, 2], size: [120, 120], color: C1('#6fd6ff', 1.5) })],
    update: [m('scaleSprite', { curve: cv([0, .6], [.5, 1.1], [1, .6]) }), m('scaleColor', { alpha: cv([0, 0], [.2, 1], [.8, 1], [1, 0]) })],
    render: [m('sprite')]
  }),
  'Dynamic Beam': () => Em('Dynamic Beam', { dur: .08 }, {
    emit: [m('spawnBurst', { count: [32, 32] })],
    spawn: [m('init', { life: [.08, .08], size: [10, 10], color: C1('#9ec9ff', 4) }), m('beam', { jitter: 30 })],
    render: [m('ribbon', { tex: 'beam', link: 'burst', linkOrder: 'oldest', tess: 2 })]
  }),
  'Static Beam': () => Em('Static Beam', { loop: 'once', dur: 1 }, {
    emit: [m('spawnBurst', { count: [16, 16] })],
    spawn: [m('init', { life: [9999, 9999], size: [14, 14], color: C1('#ff7ad9', 3) }), m('beam', { jitter: 0, arc: 80 })],
    render: [m('ribbon', { tex: 'beam', link: 'burst', linkOrder: 'oldest', tess: 4 })]
  }),
  'Location Based Ribbon': () => Em('Location Based Ribbon', {}, {
    emit: [m('spawnRate', { rate: 60 })],
    spawn: [m('init', { life: [1, 1], size: [20, 20], color: C1('#7affc8', 2) })],
    update: [m('scaleSprite', { curve: cv([0, 1], [1, 0]) }), m('color', { grad: fade() })],
    render: [m('ribbon')]
  })
};

/* ---------- system presets ---------- */
const SYS = (name, extra, emitters) => normalizeSystem({ name, ...extra, emitters });

const PRESETS = {
  'Boost Burst': () => SYS('NS_BoostBurst', { motionZ: 130 }, [
    Em('Core Flash', { dur: 1.6 }, {
      emit: [m('spawnBurst', { count: [1, 1] })], spawn: [m('init', { life: [.45, .45], size: [260, 260], color: C1('#41dfff', 2) })],
      update: [m('scaleSprite', { curve: cv([0, .3], [.15, 1], [1, 1.3]) }), m('color', { grad: gr(['#ffffff', 1, 0], ['#ffffff', 0, 1]) })], render: [m('sprite')]
    }),
    Em('Shock Ring', { dur: 1.6 }, {
      emit: [m('spawnBurst', { count: [1, 1] })], spawn: [m('init', { life: [.7, .7], size: [40, 40], color: C1('#41dfff', 1.6) })],
      update: [m('scaleSprite', { curve: cv([0, 1], [1, 14]) }), m('color', { grad: fade() })], render: [m('sprite', { tex: 'ring' })]
    }),
    Em('Sparks', { dur: 1.6 }, {
      emit: [m('spawnBurst', { count: [90, 90] })],
      spawn: [m('init', { life: [.8, 1.4], size: [6, 12], color: C1('#41dfff', 4) }), m('shape', { shape: 'sphere', radius: 10 }), m('addVel', { mode: 'point', speed: [350, 800] })],
      update: [m('drag', { drag: 2.2 }), m('color', { grad: gr(['#ffffff', 1, 0], ['#ffffff', 1, .5], ['#ffffff', 0, 1]) }), m('scaleSprite', { curve: cv([0, 1], [1, .3]) })],
      render: [m('sprite', { tex: 'spark', align: 'velocity', stretch: .012 })]
    })
  ]),

  'Rail Sparks': () => SYS('NS_RailSparks', {}, [
    Em('Sparks', {}, {
      emit: [m('spawnRate', { rate: 320 })],
      spawn: [m('init', { life: [.5, 1.1], size: [2, 4], color: C1('#ffffff', 3) }), m('shape', { shape: 'point', offset: [0, 0, 60] }), m('addVel', { mode: 'cone', axis: [-1, 0, .45], angle: 28, speed: [500, 1100] })],
      update: [m('gravity'), m('drag', { drag: .3 }), m('color', { grad: gr(['#ffffff', 1, 0], ['#ffc04d', 1, .3], ['#ff4d1a', 0, 1]) }), m('collision', { rest: .35, friction: .3, radius: 1 })],
      render: [m('sprite', { tex: 'spark', align: 'velocity', stretch: .01 })]
    }),
    Em('Contact Light', {}, {
      emit: [m('spawnRate', { rate: 20 })], spawn: [m('init', { life: [.12, .2], size: [80, 120], color: C1('#ff9a3c', 3) }), m('shape', { shape: 'point', offset: [0, 0, 60] })],
      render: [m('light', { radiusScale: 3, intensity: 1.5, glowScale: .6 })]
    })
  ]),

  'Portal Pulse': () => SYS('NS_PortalPulse', { view: { tz: 200 } }, [
    Em('Ring Motes', {}, {
      emit: [m('spawnRate', { rate: 220 })],
      spawn: [m('init', { life: [1.2, 2], size: [5, 10], color: C1('#b26bff', 3) }), m('shape', { shape: 'ring', radius: 160, rotation: [90, 0, 0], offset: [0, 0, 200] })],
      update: [m('rotateAround', { rate: 120, axis: [0, 1, 0], center: [0, 0, 200] }), m('attract', { strength: 300, radius: 400, center: [0, 0, 200], kill: 10 }), m('color', { grad: gr(['#ffffff', 0, 0], ['#ffffff', 1, .2], ['#7f6bff', 0, 1]) })],
      render: [m('sprite')]
    }),
    Em('Core', { dur: 1 }, {
      emit: [m('spawnBurst', { count: [1, 1] })], spawn: [m('init', { life: [1, 1], size: [300, 300], color: C1('#6a3dff', 1.4) }), m('shape', { shape: 'point', offset: [0, 0, 200] })],
      update: [m('scaleSprite', { curve: cv([0, .85], [.5, 1.05], [1, .85]) })], render: [m('sprite', { tex: 'ring', facing: 'custom', faceVec: [0, 1, 0] }), m('light', { radiusScale: 1.6, intensity: 1, glow: false })]
    }),
    Em('Floor Glyph', { loop: 'once', dur: 1 }, {
      emit: [m('spawnBurst', { count: [1, 1] })], spawn: [m('init', { life: [9999, 9999], size: [380, 380], color: C1('#8a5bff', 1.2) })],
      update: [m('spriteRot', { rate: [30, 30] })], render: [m('decal', { tex: 'ring' })]
    })
  ]),

  'Fountain + Splashes': () => {
    const f = EMITTER_TEMPLATES['Fountain'](); f.update.find(x => x.t === 'collision').p.event = true;
    return SYS('NS_Fountain', {}, [f,
      Em('Splash', {}, {
        spawn: [m('init', { life: [.25, .45], size: [3, 5], color: C1('#cbefff', 1.5) }), m('addVel', { mode: 'cone', angle: 60, speed: [80, 220] })],
        update: [m('gravity'), m('color', { grad: fade() })], render: [m('sprite', { tex: 'softDot' })],
        events: [ev('Fountain', 'collision', 2, { max: 40 })]
      })]);
  },

  'Fireworks': () => SYS('NS_Fireworks', { bg: 'black', view: { tz: 520, dist: 1900 } }, [
    Em('Shell', { dur: 1.4 }, {
      emit: [m('spawnBurst', { count: [1, 1] })],
      spawn: [m('init', { life: [1.1, 1.3], size: [8, 8], color: C1('#ffd27a', 4) }), m('shape', { shape: 'box', box: [400, 400, 0] }), m('addVel', { mode: 'cone', angle: 8, speed: [1000, 1150] })],
      update: [m('gravity'), m('locEvent', { rate: 40 }), m('deathEvent')], render: [m('sprite')]
    }),
    Em('Trail', {}, {
      spawn: [m('init', { life: [.4, .8], size: [3, 5], color: C1('#ffb35c', 2) })], update: [m('gravity', { g: [0, 0, -150] }), m('color', { grad: fade() })],
      render: [m('sprite', { tex: 'softDot' })], events: [ev('Shell', 'location', 1, { inherit: .1 })]
    }),
    Em('Burst', { max: 8000 }, {
      spawn: [m('init', { life: [1.2, 1.8], size: [4, 7] }), m('randColor', { intensity: 4 }), m('shape', { shape: 'sphere', radius: 5 }), m('addVel', { mode: 'point', speed: [350, 450] })],
      update: [m('gravity', { g: [0, 0, -250] }), m('drag', { drag: 1.2 }), m('color', { grad: gr(['#ffffff', 1, 0], ['#ffffff', 1, .6], ['#ffffff', 0, 1]) })],
      render: [m('sprite', { tex: 'spark', align: 'velocity', stretch: .004 })], events: [ev('Shell', 'death', 160, { max: 6 })]
    }),
    Em('Flash Light', {}, {
      spawn: [m('init', { life: [.35, .35], size: [400, 400], color: C1('#ffd9a0', 4) })], update: [m('scaleColor', { alpha: cv([0, 1], [1, 0]) })],
      render: [m('light', { radiusScale: 2, intensity: 1, glowScale: .5 })], events: [ev('Shell', 'death', 1, { max: 6 })]
    })
  ]),

  'Campfire': () => SYS('NS_Campfire', {}, [
    Em('Logs', { loop: 'once', dur: 1 }, {
      emit: [m('spawnBurst', { count: [4, 4] })],
      spawn: [m('init', { life: [9999, 9999], meshScale: [.9, .14, .14], color: C1('#4a2c1a') }), m('shape', { shape: 'ring', radius: 20, offset: [0, 0, 8] }), m('meshOrient', { mode: 'normal' })],
      render: [m('mesh', { mesh: 'cylinder', facing: 'default' })]
    }),
    Em('Flames', {}, {
      emit: [m('spawnRate', { rate: 45 })],
      spawn: [m('init', { life: [.7, 1.1], size: [60, 95], rot: [-15, 15], color: C1('#ffb347', 2.2) }), m('shape', { shape: 'cylinder', radius: 28, height: 10 }), m('addVel', { mode: 'linear', vel: [0, 0, 110], spread: [15, 15, 40] })],
      update: [m('curl', { strength: 90, freq: .012 }), m('subuv'), m('color', { grad: gr(['#fff2b0', 0, 0], ['#ffc05a', 1, .15], ['#ff5a1f', 1, .6], ['#5a1408', 0, 1]) }), m('scaleSprite', { curve: cv([0, .6], [.3, 1], [1, .35]) })],
      render: [m('sprite', { tex: 'fireSheet', cols: 4, rows: 4, pivotY: .7 })]
    }),
    Em('Smoke', {}, {
      emit: [m('spawnRate', { rate: 10 })],
      spawn: [m('init', { life: [3, 4.5], size: [70, 110], rot: [0, 360], color: C1('#5a5a60') }), m('shape', { shape: 'sphere', radius: 20, offset: [0, 0, 120] }), m('addVel', { mode: 'linear', vel: [0, 0, 60] })],
      update: [m('wind', { wind: [70, 20, 40], resist: .3 }), m('spriteRot', { rate: [-20, 20] }), m('subuv'), m('scaleSprite', { curve: cv([0, 1], [1, 3.2]) }), m('scaleColor', { alpha: cv([0, 0], [.2, .55], [1, 0]) })],
      render: [m('sprite', { tex: 'smokeSheet', cols: 4, rows: 4, blend: 'translucent', sort: 'depth' })]
    }),
    Em('Embers', {}, {
      emit: [m('spawnRate', { rate: 25 })],
      spawn: [m('init', { life: [1.5, 2.8], size: [2, 4], color: C1('#ff8a2a', 4) }), m('shape', { shape: 'cylinder', radius: 30, height: 30 }), m('addVel', { mode: 'linear', vel: [0, 0, 160], spread: [30, 30, 60] })],
      update: [m('curl', { strength: 350, freq: .008 }), m('drag', { drag: .6 }), m('color', { grad: gr(['#ffffff', 1, 0], ['#ffffff', 1, .7], ['#ffffff', 0, 1]) })],
      render: [m('sprite', { tex: 'softDot' })]
    }),
    Em('Fire Light', {}, {
      emit: [m('spawnRate', { rate: 12 })], spawn: [m('init', { life: [.2, .3], size: [280, 380], color: C1('#ff8a3a', 2) }), m('shape', { shape: 'point', offset: [0, 0, 60] })],
      render: [m('light', { radiusScale: 1.6, intensity: 1, glow: false })]
    })
  ]),

  'Smoke Plume': () => SYS('NS_SmokePlume', { bg: 'sky', view: { tz: 350, dist: 1500 } }, [
    Em('Smoke', { max: 600 }, {
      emit: [m('spawnRate', { rate: 18 })],
      spawn: [m('init', { life: [4, 6], size: [80, 120], rot: [0, 360], color: C1('#6d6f75') }), m('shape', { shape: 'sphere', radius: 25 }), m('addVel', { mode: 'linear', vel: [0, 0, 160], spread: [20, 20, 30] })],
      update: [m('wind', { wind: [180, 0, 60], resist: .25 }), m('curl', { strength: 60, freq: .004 }), m('spriteRot', { rate: [-25, 25] }), m('subuv'), m('scaleSprite', { curve: cv([0, .8], [1, 4]) }), m('scaleColor', { alpha: cv([0, 0], [.15, .8], [1, 0]) })],
      render: [m('sprite', { tex: 'smokeSheet', cols: 4, rows: 4, blend: 'translucent', sort: 'depth' })]
    })
  ]),

  'Magic Swirl (ribbons)': () => SYS('NS_MagicSwirl', { motion: 'figure8', motionR: 260, motionSpeed: 1.8, motionZ: 160 }, [
    Em('Trail', { max: 600 }, {
      emit: [m('spawnPerUnit', { spacing: 6 })],
      spawn: [m('init', { life: [.9, .9], size: [26, 26], color: C1('#5fe1ff', 2.5) })],
      update: [m('scaleSprite', { curve: cv([0, 1], [1, 0]) }), m('color', { grad: gr(['#ffffff', 1, 0], ['#d27bff', 1, .5], ['#6a5bff', 0, 1]) })],
      render: [m('ribbon', { tess: 3 })]
    }),
    Em('Sparkles', {}, {
      emit: [m('spawnRate', { rate: 90 })],
      spawn: [m('init', { life: [.6, 1.2], size: [6, 12], rot: [0, 360], color: C1('#c9f6ff', 3) }), m('shape', { shape: 'sphere', radius: 15 }), m('addVel', { mode: 'point', speed: [20, 90] })],
      update: [m('gravity', { g: [0, 0, -120] }), m('spriteRot', { rate: [-180, 180] }), m('color', { grad: fade() })],
      render: [m('sprite', { tex: 'star' })]
    }),
    Em('Wisp Light', { local: true, dur: 1 }, {
      emit: [m('spawnBurst', { count: [1, 1] })], spawn: [m('init', { life: [1, 1], size: [120, 120], color: C1('#7fd4ff', 2) })],
      render: [m('light', { radiusScale: 2, glowScale: .5 })]
    })
  ]),

  'Lightning Beam': () => {
    const a = EMITTER_TEMPLATES['Dynamic Beam'](); a.name = 'Bolt'; a.emit[0].p.prob = .7; a.spawn[1].p.jitter = 45;
    const b = EMITTER_TEMPLATES['Dynamic Beam'](); b.name = 'Bolt Fork'; b.emit[0].p.prob = .5; b.spawn[0].p.size = [4, 4]; b.spawn[1].p.jitter = 80; b.spawn[1].p.arc = 40;
    return SYS('NS_Lightning', { bg: 'black' }, [a, b,
      Em('Flash', { dur: .1 }, {
        emit: [m('spawnBurst', { count: [1, 1], prob: .5 })], spawn: [m('init', { life: [.08, .08], size: [500, 500], color: C1('#a8c8ff', 2) }), m('shape', { shape: 'point', offset: [0, 0, 150] })],
        render: [m('light', { radiusScale: 2, intensity: 1, glowScale: .4 })]
      })]);
  },

  'Rain & Splashes': () => SYS('NS_Rain', { bg: 'grey', view: { tz: 200, dist: 1300 } }, [
    Em('Rain', { max: 6000 }, {
      emit: [m('spawnRate', { rate: 500 })],
      spawn: [m('init', { life: [2, 2], size: [1.2, 1.8], color: C1('#cfe3ff', 1.2) }), m('shape', { shape: 'box', box: [1400, 1400, 10], offset: [0, 0, 1000] }), m('addVel', { mode: 'linear', vel: [80, 0, -1400], spread: [10, 10, 100] })],
      update: [m('collision', { kill: true, event: true })], render: [m('sprite', { tex: 'spark', align: 'velocity', stretch: .03, blend: 'translucent' })]
    }),
    Em('Splash Drops', {}, {
      spawn: [m('init', { life: [.25, .4], size: [2, 3], color: C1('#dbeaff', 1.2) }), m('addVel', { mode: 'cone', angle: 55, speed: [90, 200] })],
      update: [m('gravity')], render: [m('sprite', { tex: 'softDot', blend: 'translucent' })], events: [ev('Rain', 'collision', 3, { max: 200 })]
    }),
    Em('Ripples', {}, {
      spawn: [m('init', { life: [.5, .5], size: [6, 6], color: C1('#ffffff', .8) })],
      update: [m('scaleSprite', { curve: cv([0, 1], [1, 6]) }), m('color', { grad: fade() })], render: [m('decal', { tex: 'ring' })], events: [ev('Rain', 'collision', 1, { max: 200 })]
    })
  ]),

  'Snowfall (warmup)': () => SYS('NS_Snow', { warmup: 8, bg: 'night', view: { tz: 250, dist: 1400 } }, [
    Em('Snow', { max: 3000 }, {
      emit: [m('spawnRate', { rate: 220 })],
      spawn: [m('init', { life: [7, 9], size: [3, 7], color: C1('#ffffff', 1.1) }), m('shape', { shape: 'box', box: [1500, 1500, 10], offset: [0, 0, 700] })],
      update: [m('gravity', { g: [0, 0, -60] }), m('drag', { drag: .5 }), m('wind', { wind: [50, 25, 0], resist: .2 }), m('curl', { strength: 50, freq: .004 }), m('collision', { rest: 0, friction: 1, radius: 1 })],
      render: [m('sprite', { tex: 'softDot', blend: 'translucent' })]
    })
  ]),

  'Fireflies (lights)': () => SYS('NS_Fireflies', { bg: 'black', view: { tz: 150, dist: 1300 } }, [
    Em('Fireflies', {}, {
      emit: [m('spawnRate', { rate: 4 })],
      spawn: [m('init', { life: [5, 8], size: [5, 7], color: C1('#c8ff6a', 4) }), m('shape', { shape: 'box', box: [1000, 1000, 250], offset: [0, 0, 150] })],
      update: [m('curl', { strength: 120, freq: .006, pan: [0, 0, 30] }), m('drag', { drag: 1 }), m('scaleColor', { alpha: cv([0, 0], [.15, 1], [.3, .2], [.45, 1], [.6, .3], [.8, 1], [1, 0]) })],
      render: [m('sprite'), m('light', { radiusScale: 25, intensity: .5, glowScale: .15 })]
    })
  ]),

  'Explosion (all renderers)': () => SYS('NS_Explosion', {}, [
    Em('Flash', { dur: 3 }, { emit: [m('spawnBurst', { count: [1, 1] })], spawn: [m('init', { life: [.25, .25], size: [700, 700], color: C1('#ffe2a8', 3) }), m('shape', { shape: 'point', offset: [0, 0, 80] })], update: [m('scaleColor', { alpha: cv([0, 1], [1, 0]) })], render: [m('sprite'), m('light', { radiusScale: 1.5, glow: false, intensity: 2 })] }),
    Em('Fireball', { dur: 3 }, {
      emit: [m('spawnBurst', { count: [26, 26] })],
      spawn: [m('init', { life: [.7, 1.1], size: [90, 140], rot: [0, 360], color: C1('#ffb04a', 1.3) }), m('shape', { shape: 'sphere', radius: 40, offset: [0, 0, 80] }), m('addVel', { mode: 'point', speed: [150, 380] })],
      update: [m('drag', { drag: 3.5 }), m('subuv'), m('scaleSprite', { curve: cv([0, .5], [.3, 1.1], [1, 1.4]) }), m('color', { grad: gr(['#fff5d0', 1, 0], ['#ff8a2a', 1, .35], ['#7a1f08', 0, 1]) })],
      render: [m('sprite', { tex: 'fireSheet', cols: 4, rows: 4 })]
    }),
    Em('Smoke', { dur: 3 }, {
      emit: [m('spawnBurst', { count: [18, 18], time: .15 })],
      spawn: [m('init', { life: [2.2, 3], size: [120, 170], rot: [0, 360], color: C1('#3e3a38') }), m('shape', { shape: 'sphere', radius: 60, offset: [0, 0, 100] }), m('addVel', { mode: 'point', speed: [60, 160] })],
      update: [m('accel', { a: [0, 0, 80] }), m('drag', { drag: 1.5 }), m('subuv'), m('scaleSprite', { curve: cv([0, .6], [1, 1.8]) }), m('scaleColor', { alpha: cv([0, 0], [.1, .9], [1, 0]) })],
      render: [m('sprite', { tex: 'smokeSheet', cols: 4, rows: 4, blend: 'translucent', sort: 'depth', order: -1 })]
    }),
    Em('Debris', { dur: 3 }, {
      emit: [m('spawnBurst', { count: [36, 36] })],
      spawn: [m('init', { life: [2.5, 3], meshScale: [.1, .06, .04], meshRand: [.6, 1.5], color: C1('#5b524c') }), m('shape', { shape: 'sphere', radius: 20, offset: [0, 0, 60] }), m('addVel', { mode: 'cone', angle: 60, speed: [500, 1100] }), m('meshOrient', { rate: [-720, 720] })],
      update: [m('gravity'), m('collision', { rest: .3, friction: .5, radius: 4 }), m('drag', { drag: .2, rotDrag: .4 })],
      render: [m('mesh', { mesh: 'shard' })]
    }),
    Em('Sparks', { dur: 3 }, {
      emit: [m('spawnBurst', { count: [140, 140] })],
      spawn: [m('init', { life: [.6, 1.4], size: [2, 4], color: C1('#ffc46b', 5) }), m('shape', { shape: 'sphere', radius: 10, offset: [0, 0, 80] }), m('addVel', { mode: 'point', speed: [500, 1300] })],
      update: [m('gravity'), m('drag', { drag: 1.5 }), m('color', { grad: fade() }), m('collision', { rest: .4, radius: 1 })],
      render: [m('sprite', { tex: 'spark', align: 'velocity', stretch: .006 })]
    }),
    Em('Shockwave Decal', { dur: 3 }, {
      emit: [m('spawnBurst', { count: [1, 1] })], spawn: [m('init', { life: [.8, .8], size: [60, 60], color: C1('#ffb066', 2) })],
      update: [m('scaleSprite', { curve: cv([0, 1], [1, 16]) }), m('color', { grad: fade() })], render: [m('decal', { tex: 'ring' })]
    }),
    Em('Scorch', { dur: 3 }, {
      emit: [m('spawnBurst', { count: [1, 1] })], spawn: [m('init', { life: [3, 3], size: [420, 420], rot: [0, 360], color: C1('#000000') })],
      update: [m('scaleColor', { alpha: cv([0, 0], [.05, .8], [.7, .8], [1, 0]) })], render: [m('decal', { tex: 'smoke', blend: 'translucent' })]
    })
  ]),

  'Tornado': () => SYS('NS_Tornado', { bg: 'grey', view: { tz: 350, dist: 1500 } }, [
    Em('Funnel Dust', { max: 3000 }, {
      emit: [m('spawnRate', { rate: 170 })],
      spawn: [m('init', { life: [2.5, 3.5], size: [30, 60], rot: [0, 360], color: C1('#8a8070') }), m('shape', { shape: 'cylinder', radius: 25, height: 10 }), m('addVel', { mode: 'point', speed: [110, 170], origin: [0, 0, 5] })],
      update: [m('accel', { a: [0, 0, 260] }), m('drag', { drag: .15 }), m('limitVel', { max: 450 }), m('rotateAround', { rate: 330 }), m('curl', { strength: 60, freq: .01 }), m('spriteRot', { rate: [-60, 60] }), m('scaleSprite', { curve: cv([0, .5], [1, 2.6]) }), m('scaleColor', { alpha: cv([0, 0], [.2, .6], [1, 0]) })],
      render: [m('sprite', { tex: 'smoke', blend: 'translucent', sort: 'depth' })]
    }),
    Em('Debris', {}, {
      emit: [m('spawnRate', { rate: 25 })],
      spawn: [m('init', { life: [3, 4], meshScale: [.05, .05, .02], meshRand: [.5, 1.5], color: C1('#6d5a44') }), m('shape', { shape: 'cylinder', radius: 60, height: 10 }), m('addVel', { mode: 'point', speed: [60, 110], origin: [0, 0, 5] }), m('meshOrient', { rate: [-600, 600] })],
      update: [m('accel', { a: [0, 0, 300] }), m('drag', { drag: .4 }), m('limitVel', { max: 500 }), m('rotateAround', { rate: 280 })],
      render: [m('mesh', { mesh: 'cube' })]
    })
  ]),

  'Black Hole': () => SYS('NS_BlackHole', { bg: 'black', view: { tz: 220, dist: 1300, pitch: .55 } }, [
    Em('Infall', { max: 5000 }, {
      emit: [m('spawnRate', { rate: 350 })],
      spawn: [m('init', { life: [3, 4], size: [3, 5], color: C1('#ffb066', 3) }), m('shape', { shape: 'ring', radius: 500, coverage: .4, offset: [0, 0, 220] })],
      update: [m('attract', { strength: 2500, radius: 800, falloff: .5, kill: 28, center: [0, 0, 220] }), m('vortex', { amount: 900, center: [0, 0, 220] }), m('drag', { drag: .4 }), m('color', { grad: gr(['#ffd08a', 0, 0], ['#ffb066', 1, .2], ['#c05cff', 1, 1]) })],
      render: [m('sprite', { tex: 'spark', align: 'velocity', stretch: .004 })]
    }),
    Em('Event Horizon', { dur: 1 }, {
      emit: [m('spawnBurst', { count: [1, 1] })], spawn: [m('init', { life: [1, 1], size: [150, 150], color: C1('#000000') }), m('shape', { shape: 'point', offset: [0, 0, 220] })],
      render: [m('sprite', { tex: 'softDot', blend: 'modulate', order: 5 })]
    })
  ]),

  'City Eraser (black hole)': () => {
    const HOLE = { strength: 2600, radius: 950, falloff: 1.4, kill: 150, follow: true };
    return SYS('NS_CityEraser', { motion: 'sweep', motionR: 1700, motionSpeed: TAU / 9, motionZ: 160, bg: 'night', view: { tz: 100, dist: 3600, pitch: .55 } }, [
      Em('City', { dur: 9, max: 200 }, {
        emit: [m('spawnBurst', { count: [126, 126] })],
        spawn: [m('init', { life: [8.95, 8.95], meshScale: [.95, .95, 3], meshRand: [.8, 1.8] }),
          m('randColor', { grad: gr(['#5d6577', 1, 0], ['#7a8396', 1, .33], ['#4b5266', 1, .66], ['#8c8f99', 1, 1]) }),
          m('shape', { shape: 'grid', gridCount: [14, 9, 1], gridSize: [2700, 2400, 0], jitter: 25, offset: [0, 0, 150], world: true }), m('meshOrient', { mode: 'fixed' })],
        update: [m('attract', { ...HOLE, strength: 7000, radius: 750, falloff: 2, shrink: .45, tumble: 900 }), m('vortex', { amount: 500, follow: true, radius: 700 }), m('scaleMesh', { curve: cv([0, 0], [.04, 1], [1, 1]) }), m('drag', { drag: 1.2 }), m('locEvent', { rate: 5, minSpeed: 120 }), m('deathEvent')],
        render: [m('mesh', { mesh: 'cube', shading: 'lit' })]
      }),
      Em('Rubble', { max: 3000 }, {
        spawn: [m('init', { life: [1.5, 2.5], meshScale: [.12, .08, .05], meshRand: [.5, 1.5], color: C1('#6b6f7a') }), m('addVel', { mode: 'point', speed: [80, 260] }), m('meshOrient', { rate: [-900, 900] })],
        update: [m('attract', { ...HOLE, shrink: .3 }), m('vortex', { amount: 1800, follow: true, radius: 900 }), m('drag', { drag: .6 }), m('deathEvent')],
        render: [m('mesh', { mesh: 'shard', shading: 'lit' })],
        events: [ev('City', 'location', 2, { max: 300, inherit: .5 })]
      }),
      Em('Erasure Sparks', { max: 4000 }, {
        spawn: [m('init', { life: [.35, .7], size: [4, 9], color: C1('#d6b3ff', 4) }), m('addVel', { mode: 'point', speed: [150, 400] })],
        update: [m('attract', { ...HOLE, strength: 5000, kill: 60 }), m('vortex', { amount: 2500, follow: true }), m('color', { grad: gr(['#ffffff', 1, 0], ['#ff9a4d', 1, .5], ['#8a3dff', 0, 1]) })],
        render: [m('sprite', { tex: 'spark', align: 'velocity', stretch: .012 })],
        events: [ev('City', 'death', 24, { max: 20 }), ev('Rubble', 'death', 3, { max: 200 })]
      }),
      Em('Erased Ground', { max: 400 }, {
        emit: [m('spawnPerUnit', { spacing: 45 })],
        spawn: [m('init', { life: [8.5, 8.5], size: [520, 640], rot: [0, 360], color: C1('#000000') }), m('shape', { shape: 'sphere', radius: 60 })],
        update: [m('scaleColor', { alpha: cv([0, 0], [.03, .95], [.85, .95], [1, 0]) })],
        render: [m('decal', { tex: 'smoke', blend: 'translucent' })]
      }),
      Em('Accretion Disk', { local: true, max: 3000 }, {
        emit: [m('spawnRate', { rate: 500 })],
        spawn: [m('init', { life: [.8, 1.6], size: [8, 16], color: C1('#ffb35c', 3) }), m('shape', { shape: 'ring', radius: 360, coverage: .55, rotation: [12, 0, 0] })],
        update: [m('rotateAround', { rate: 420, axis: [0, -.21, .98] }), m('attract', { strength: 500, radius: 500, kill: 140 }), m('color', { grad: gr(['#ffffff', 0, 0], ['#ffe2b0', 1, .15], ['#ff7a2a', 1, .6], ['#7a2cff', 0, 1]) })],
        render: [m('sprite', { tex: 'glow' })]
      }),
      Em('Event Horizon', { local: true, dur: 1 }, {
        emit: [m('spawnBurst', { count: [1, 1] })], spawn: [m('init', { life: [1, 1], meshScale: [2.7, 2.7, 2.7], color: C1('#000000'), size: [470, 470] })],
        render: [m('mesh', { mesh: 'sphere', shading: 'unlit', order: 3 }), m('sprite', { tex: 'softDot', blend: 'modulate', order: 4 })]
      }),
      Em('Photon Ring', { local: true, dur: .6 }, {
        emit: [m('spawnBurst', { count: [1, 1] })], spawn: [m('init', { life: [.6, .6], size: [330, 330], color: C1('#c9a8ff', 1.6) })],
        update: [m('scaleSprite', { curve: cv([0, .97], [.5, 1.04], [1, .97]) })],
        render: [m('sprite', { tex: 'ring', order: 5 })]
      }),
      Em('Hole Light', { local: true, dur: .25 }, {
        emit: [m('spawnBurst', { count: [1, 1] })], spawn: [m('init', { life: [.25, .25], size: [900, 900], color: C1('#ff8a4a', 2.2) })],
        render: [m('light', { radiusScale: 1.4, glow: false })]
      })
    ]);
  },

  'Confetti Cannons': () => {
    const a = EMITTER_TEMPLATES['Confetti Burst'](); a.name = 'Cannon L'; a.spawn.find(x => x.t === 'addVel').p.axis = [.5, 0, 1]; a.spawn.push(m('shape', { shape: 'point', offset: [-300, 0, 0] }));
    const b = EMITTER_TEMPLATES['Confetti Burst'](); b.name = 'Cannon R'; b.spawn.find(x => x.t === 'addVel').p.axis = [-.5, 0, 1]; b.spawn.push(m('shape', { shape: 'point', offset: [300, 0, 0] }));
    return SYS('NS_Confetti', { bg: 'sky', view: { tz: 250, dist: 1300 } }, [a, b]);
  },

  'Hanging Particulates': () => SYS('NS_Particulates', { view: { dist: 1300 } }, [EMITTER_TEMPLATES['Hanging Particulates']()]),
  'Empty System': () => SYS('NS_New', { motionZ: 100 }, [EMITTER_TEMPLATES['Minimal']()])
};
