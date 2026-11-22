function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const W = 1600
const H = 900
const n0 = (v) => Math.round(v)
const n1 = (v) => (Math.round(v * 10) / 10).toString()
const n2 = (v) => (Math.round(v * 100) / 100).toString()
const pts = (list) => list.map(([x, y]) => `${n0(x)} ${n0(y)}`).join('L')

// ---------------------------------------------------------------- the clock

// The shared clock. Every animation changes only on a tick of 1/24 s, so changes
// from different parts land on the same frames, and the browser draws at most 24
// frames a second instead of 60. Slow things step every 12 ticks (0.5 s).
const FPS = 24
const SLOW = 0.5
const TICK = 1 / FPS
const onTick = (t, every = TICK) => Math.round(t / every) * every
const kt = (t, dur) => (t / dur).toFixed(9).replace(/0+$/, '').replace(/\.$/, '')

// A value sampled on the clock: `fn(u)` for u from 0 to 1 over `dur` seconds, a new
// value every `step` ticks, held between (calcMode discrete).
function ticked(attr, type, dur, step, fn, begin = 0) {
  const n = Math.round((dur * FPS) / step)
  const vals = Array.from({ length: n }, (_, i) => fn(i / n)).join(';')
  const start = begin ? ` begin="${+onTick(begin, step / FPS).toFixed(6)}s"` : ''
  return attr === 'transform'
    ? `<animateTransform attributeName="transform" type="${type}" values="${vals}" dur="${dur}s"${start} repeatCount="indefinite" calcMode="discrete"/>`
    : `<animate attributeName="${attr}" values="${vals}" dur="${dur}s"${start} repeatCount="indefinite" calcMode="discrete"/>`
}
// A held timeline: [[t seconds, value], ...] from t = 0, each value held until the
// next, the times rounded onto the clock.
function timeline(attr, dur, steps, type = '') {
  const vals = steps.map(([, v]) => v).join(';')
  const times = steps.map(([t]) => kt(onTick(t), dur)).join(';')
  return type
    ? `<animateTransform attributeName="transform" type="${type}" values="${vals}" keyTimes="${times}" dur="${dur}s" repeatCount="indefinite" calcMode="discrete"/>`
    : `<animate attributeName="${attr}" values="${vals}" keyTimes="${times}" dur="${dur}s" repeatCount="indefinite" calcMode="discrete"/>`
}
// A slow drift in discrete steps (one every SLOW seconds), there and back on an
// eased curve.
function stepDrift(dx, dy, dur, begin = 0) {
  dur = Math.round(dur)
  const steps = Math.round(dur / SLOW)
  begin = onTick(begin, SLOW)
  const vals = []
  for (let i = 0; i < steps; i++) {
    const t = (1 - Math.cos((i / steps) * Math.PI * 2)) / 2
    vals.push(`${n0(dx * t)} ${n0(dy * t)}`)
  }
  const start = begin ? ` begin="${n1(begin)}s"` : ''
  return `<animateTransform attributeName="transform" type="translate" values="${vals.join(';')}" dur="${dur}s"${start} repeatCount="indefinite" calcMode="discrete"/>`
}

// A soft blob: an ellipse filled with a radial fade, turned by `rot` degrees.
const blob = (grad, cx, cy, rx, ry, op, rot = 0) =>
  `<ellipse cx="${n0(cx)}" cy="${n0(cy)}" rx="${n0(rx)}" ry="${n0(ry)}" fill="url(#${grad})"${op < 1 ? ` opacity="${n2(op)}"` : ''}${rot ? ` transform="rotate(${n0(rot)} ${n0(cx)} ${n0(cy)})"` : ''}/>`

// A placed copy of a defined shape: at (x, y), scaled by s, mirrored when flip.
const dec = (v) => n2(v).replace(/^(-?)0\./, '$1.')
const use = (id, x, y, s = 1, flip = false) =>
  s === 1 && !flip ? `<use href="#${id}" x="${n0(x)}" y="${n0(y)}"/>` : `<use href="#${id}" transform="matrix(${dec(flip ? -s : s)} 0 0 ${dec(s)} ${n0(x)} ${n0(y)})"/>`

// A ridge line through key points, with fractal detail added between them.
function ridge(keys, rough, seed, passes = 4) {
  const rng = mulberry32(seed)
  let line = keys.map(([x, y]) => [x, y])
  for (let pass = 0; pass < passes; pass++) {
    const next = [line[0]]
    for (let i = 1; i < line.length; i++) {
      const [x0, y0] = line[i - 1]
      const [x1, y1] = line[i]
      const len = Math.hypot(x1 - x0, y1 - y0)
      next.push([(x0 + x1) / 2 + (rng() - 0.5) * len * 0.1, (y0 + y1) / 2 + (rng() - 0.5) * len * rough], [x1, y1])
    }
    line = next
  }
  return line
}

// ---------------------------------------------------------------- shapes, defined once

// A pine of unit height 100, base at (0, 0): one ragged silhouette.
function pine(seed, tiers, wide) {
  const rng = mulberry32(seed)
  const side = (s) => {
    const out = []
    for (let i = 0; i < tiers; i++) {
      const t = (i + 1) / tiers
      const y = -100 + t * 96
      const reach = 100 * wide * (0.12 + 0.88 * Math.pow(t, 0.85)) * (0.75 + rng() * 0.45)
      out.push([s * reach * 0.45, y - (96 / tiers) * (0.9 + rng() * 0.3)], [s * reach * 0.8, y - 2 - rng() * 2], [s * reach, y + reach * 0.12 * rng()])
    }
    return out
  }
  const r = side(1)
  const l = side(-1).reverse()
  return `<path d="M0 -106L${pts(r)}L${n0(r[r.length - 1][0] * 0.3)} 0L${n0(l[0][0] * 0.3)} 0L${pts(l)}Z"/>`
}


// A fine paint grain: a static tile of light and dark specks, laid over the whole
// scene at low opacity so flat fills read as painted. Static, so it costs nothing per
// frame once drawn.
function grain(id, seed) {
  const rng = mulberry32(seed)
  let dark = ''
  let light = ''
  for (let i = 0; i < 260; i++) {
    const d = `M${n0(rng() * 160)} ${n0(rng() * 160)}h${1 + Math.floor(rng() * 2)}v1h-${1 + Math.floor(rng() * 2)}z`
    if (rng() < 0.55) dark += d
    else light += d
  }
  return `<pattern id="${id}" width="160" height="160" patternUnits="userSpaceOnUse"><path d="${dark}" fill="#000" opacity="0.5"/><path d="${light}" fill="#fff" opacity="0.35"/></pattern>`
}

// An opacity that swells and fades in discrete steps (dur / steps on the clock).
function stepPulse(lo, hi, dur, steps, begin = 0) {
  const vals = []
  for (let i = 0; i < steps; i++) vals.push(n2(lo + (hi - lo) * (1 - Math.cos((i / steps) * Math.PI * 2)) / 2))
  const start = begin ? ` begin="${n1(begin)}s"` : ''
  return `<animate attributeName="opacity" values="${vals.join(';')}" dur="${dur}s"${start} repeatCount="indefinite" calcMode="discrete"/>`
}

// ================================================================ Alan Wake inspired
//
// A lake in the Pacific Northwest at night, as an original scene. A lighthouse on a
// rocky point throws its beam round and round over the water; a cabin with one lit
// window stands among the pines on the shore; fog lies on the lake. At the end of a
// dock a man searches the far shore with a flashlight. Now and then a figure of
// darkness forms in the fog at the treeline, and burns away when the light finds it.
// Nothing is taken from the game: the man, the lighthouse and the shapes are drawn
// for this scene.

const SHORE = 500 // the far shoreline
const FL = { dur: 26, find: 14 } // the flashlight's search cycle, and when it finds the figure

// ---------------------------------------------------------------- the sky

function sky() {
  const rng = mulberry32(3)
  let clouds = ''
  for (let i = 0; i < 20; i++) clouds += blob('a-cd', rng() * W, 40 + rng() * 300, 180 + rng() * 260, 30 + rng() * 50, 0.6 + rng() * 0.35, -6 + rng() * 12)
  let lit = ''
  for (let i = 0; i < 10; i++) lit += blob('a-cl', 1000 + rng() * 380, 110 + rng() * 140, 90 + rng() * 140, 14 + rng() * 18, 0.3 + rng() * 0.4, -8 + rng() * 10)
  let drift = ''
  for (let i = 0; i < 6; i++) drift += blob('a-cd', 900 + rng() * 600, 120 + rng() * 120, 140 + rng() * 120, 24 + rng() * 20, 0.6 + rng() * 0.3)
  const far = ridge([[0, 430], [140, 380], [300, 400], [460, 350], [640, 392], [820, 372], [1000, 404], [1180, 364], [1380, 394], [1600, 372]], 0.18, 7)
  const near = ridge([[0, 470], [220, 446], [480, 462], [760, 450], [1040, 468], [1300, 452], [1600, 470]], 0.2, 9)
  return `<rect width="${W}" height="${H}" fill="url(#a-sky)"/>` +
    blob('a-halo', 1180, 170, 260, 220, 0.9) + starGap() +
    lit + clouds +
    `<circle cx="1180" cy="170" r="38" fill="#eef2fa"/><path d="M1158 152q10 -6 18 2q-2 10 -12 8q-8 -2 -6 -10zM1186 174q8 -4 14 4q-4 8 -12 6zM1170 186q6 -2 8 4q-4 4 -8 0z" fill="#c8d0de"/>` +
    `<path d="M1146 182a38 38 0 0 0 66 6a40 40 0 0 1 -66 -6z" fill="#b8c2d4" opacity="0.6"/>` +
    `<g>${stepDrift(-120, 0, 80)}${drift}</g>` +
    `<path d="M${pts(far)}L1600 ${SHORE}L0 ${SHORE}Z" fill="#141c2c"/>` +
    `<path d="M${pts(near)}L1600 ${SHORE}L0 ${SHORE}Z" fill="#0f1522"/>`
}

// Stars showing through a gap in the cloud around the moon.
function starGap() {
  const rng = mulberry32(14)
  let d = ''
  for (let i = 0; i < 40; i++) {
    const a = rng() * Math.PI * 2
    const r = 60 + rng() * 200
    const x = 1180 + Math.cos(a) * r * 1.4
    const y = 170 + Math.sin(a) * r * 0.6
    const z = n1(0.5 + rng() * 0.9)
    d += `M${n1(x - z)} ${n1(y)}a${z} ${z} 0 1 0 ${n1(z * 2)} 0a${z} ${z} 0 1 0 ${n1(-z * 2)} 0`
  }
  return `<path d="${d}" fill="#dfe6f4" opacity="0.7"/>`
}

// ---------------------------------------------------------------- the far shore

function farShore() {
  const rng = mulberry32(11)
  let trees = ''
  for (let x = -10; x < W + 20; x += 7 + rng() * 12) trees += use(`p${Math.floor(rng() * 3)}`, x, SHORE + 2 + rng() * 4, 0.35 + rng() * 0.45, rng() < 0.5)
  return `<g fill="#0b111c">${trees}</g>` +
    `<g>${stepDrift(90, 0, 70)}${blob('a-fog', 500, SHORE - 6, 520, 30, 0.75)}${blob('a-fog', 1250, SHORE - 2, 420, 26, 0.6)}</g>`
}

// ---------------------------------------------------------------- the lighthouse

// On a rocky point to the left: a tapered white tower, a gallery, the lantern room
// burning yellow. The beam turns in a level plane, seen from the side, so it swings
// out long to one side, shortens toward us, and swings out to the other.
const LH = [430, 262]
function lighthouse() {
  const [x, y] = LH
  const rock = `M250 ${SHORE + 30}L290 ${SHORE - 6}L340 ${SHORE - 22}L400 ${SHORE - 30}L470 ${SHORE - 28}L520 ${SHORE - 12}L580 ${SHORE + 8}L620 ${SHORE + 30}Z`
  const tower = `M${x - 26} ${SHORE - 26}L${x - 15} ${y + 26}H${x + 15}L${x + 26} ${SHORE - 26}Z`
  const shade = `M${x + 4} ${y + 26}H${x + 15}L${x + 26} ${SHORE - 26}H${x + 8}Z`
  const beam = `<path d="M0 -5L1100 -46L1100 40L0 5Z" fill="url(#a-beam)"/>`
  const spin = ticked('transform', 'scale', 13, 1, (u) => `${n2(Math.cos(u * Math.PI * 2))} 1`)
  const glare = ticked('opacity', '', 13, 1, (u) => n2(Math.max(0, Math.sin(u * Math.PI * 2)) ** 6))
  // Brightest when it lies across the view, dim when it points toward or away from us.
  const fade = ticked('opacity', '', 13, 1, (u) => n2(0.35 + 0.65 * Math.max(0, Math.sin(u * Math.PI * 2) * 0.5 + 0.5)))
  return `<path d="${rock}" fill="#0a0e15"/>` +
    `<path d="${tower}" fill="#b8c0cc"/><path d="${shade}" fill="#7c8596"/>` +
    `<path d="M${x - 21} ${y + 120}H${x + 21}L${x + 22} ${y + 136}H${x - 22}ZM${x - 18} ${y + 60}H${x + 18}L${x + 19} ${y + 74}H${x - 19}Z" fill="#7a1e1e"/>` +
    `<path d="M${x - 22} ${y + 22}h44v6h-44zM${x - 26} ${y + 18}h52v4h-52z" fill="#1c222c"/>` +
    `<path d="M${x - 11} ${y - 6}h22v28h-22z" fill="#ffd98a"/><path d="M${x - 11} ${y - 6}v28M${x} ${y - 6}v28M${x + 11} ${y - 6}v28" stroke="#3a2a12" stroke-width="1.2"/>` +
    `<path d="M${x - 15} ${y - 6}L${x} ${y - 24}L${x + 15} ${y - 6}Z" fill="#1c222c"/><path d="M${x - 0.8} ${y - 34}h1.6v10h-1.6z" fill="#1c222c"/>` +
    // Gallery railing, a door, two small windows; moonlight on the rock's upper edges.
    `<path d="M${x - 24} ${y + 18}v-9M${x - 16} ${y + 18}v-9M${x - 8} ${y + 18}v-9M${x + 8} ${y + 18}v-9M${x + 16} ${y + 18}v-9M${x + 24} ${y + 18}v-9M${x - 25} ${y + 9}h50" stroke="#1c222c" stroke-width="1.4"/>` +
    `<path d="M${x - 6} ${SHORE - 26}v-20a6 6 0 0 1 12 0v20zM${x - 3} ${y + 92}h6v10h-6zM${x - 3} ${y + 160}h6v10h-6z" fill="#1c222c"/><path d="M${x - 3} ${y + 92}h6v10h-6z" fill="#ffd98a" opacity="0.7"/>` +
    `<path d="M290 ${SHORE - 6}L340 ${SHORE - 22}L400 ${SHORE - 30}M470 ${SHORE - 28}L520 ${SHORE - 12}" stroke="#3a4a66" stroke-width="2" fill="none"/>` +
    blob('a-lamp', x, y + 8, 70, 60, 0.9) +
    // When the beam swings toward us, it flashes across the water below.
    `<g opacity="0">${glare}${blob('a-flare', x, SHORE + 70, 60, 150, 0.5)}${blob('a-flare', x, SHORE + 40, 140, 14, 0.6)}</g>` +
    `<g transform="translate(${x} ${y + 8})"><g>${fade}<g>${spin}${beam}</g></g><g opacity="0">${glare}${blob('a-flare', 0, 0, 120, 60, 1)}</g></g>`
}

// ---------------------------------------------------------------- the lake

// Dark water: the moon's broken column, the lighthouse's reflection, and glints that
// shimmer by swapping between two sets of short strokes.
function lake() {
  const rng = mulberry32(21)
  const glints = (n, x0, x1, y0, y1) => {
    let d = ''
    for (let i = 0; i < n; i++) {
      const y = y0 + rng() * (y1 - y0)
      const x = x0 + (rng() - 0.5) * (x1 - x0) * (0.4 + (y - y0) / (y1 - y0))
      d += `M${n0(x)} ${n0(y)}h${n0(6 + rng() * 22)}`
    }
    return d
  }
  const moonA = glints(40, 1180, 1300, SHORE + 6, 760)
  const moonB = glints(40, 1180, 1300, SHORE + 6, 760)
  const lhA = glints(16, 430, 470, SHORE + 6, 700)
  const swap = (k) => timeline('opacity', 1, k ? [[0, 0], [0.5, 1]] : [[0, 1], [0.5, 0]])
  let ripples = ''
  for (let i = 0; i < 70; i++) {
    const y = SHORE + 8 + Math.pow(rng(), 1.6) * (H - SHORE)
    const w = 30 + ((y - SHORE) / (H - SHORE)) * 160 * rng()
    ripples += `M${n0(rng() * W)} ${n0(y)}h${n0(w)}`
  }
  return `<rect y="${SHORE}" width="${W}" height="${H - SHORE}" fill="url(#a-lake)"/>` +
    `<path d="${ripples}" stroke="#25324a" stroke-width="1.2" opacity="0.7"/>` +
    blob('a-halo', 1180, 620, 120, 160, 0.35) +
    `<g>${swap(0)}<path d="${moonA}" stroke="#c9d6ea" stroke-width="2" opacity="0.6"/></g><g opacity="0">${swap(1)}<path d="${moonB}" stroke="#c9d6ea" stroke-width="2" opacity="0.6"/></g>` +
    `<path d="${lhA}" stroke="#ffd98a" stroke-width="1.6" opacity="0.45"/>` +
    `<g>${stepDrift(-80, 0, 60, -20)}${blob('a-fog', 700, SHORE + 50, 640, 34, 0.55)}${blob('a-fog', 1350, SHORE + 80, 380, 30, 0.45)}</g>`
}

// ---------------------------------------------------------------- the darkness

// A figure of darkness at the far treeline, in the flashlight's path: it gathers out
// of the fog, stands, and when the flashlight finds it, it flares white and burns
// away. A second one gathers further left and thins back into the fog.
function taken(x, y, s, steps, flare) {
  const body = `M-7 0L-6 -30Q-11 -44 -5 -52Q-8 -60 -3 -66Q2 -72 6 -65Q10 -58 6 -51Q12 -43 7 -30L8 0Q4 -6 2 -2Q-1 -8 -3 -2Q-5 -7 -7 0Z`
  const wisps = `M-6 -40q-10 -6 -14 -2M7 -44q9 -8 15 -4M-4 -60q-8 -8 -6 -14M5 -20q10 2 13 8`
  let out = `<g transform="translate(${x} ${y}) scale(${s})"><g opacity="0">${timeline('opacity', FL.dur, steps)}` +
    `${blob('a-dark', 0, -34, 26, 44, 0.9)}<path d="${body}" fill="#020306"/><path d="${wisps}" fill="none" stroke="#020306" stroke-width="2.4" stroke-linecap="round"/></g>`
  if (flare) {
    const t = flare
    out += `<g opacity="0">${timeline('opacity', FL.dur, [[0, 0], [t, 1], [t + 2 * TICK, 0.6], [t + 4 * TICK, 1], [t + 10 * TICK, 0]])}${blob('a-flare', 0, -34, 40, 54, 1)}<path d="${body}" fill="#f4f6ff"/></g>`
    let sparks = ''
    const r = mulberry32(5)
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2
      const d = 20 + r() * 40
      sparks += `<g opacity="0">${timeline('opacity', FL.dur, [[0, 0], [t + 4 * TICK, 1], [t + 24 * TICK, 0]])}<circle r="1.6" fill="#f4f6ff">${timeline('', FL.dur, [[0, '0 -34'], [t + 4 * TICK, '0 -34'], [t + 10 * TICK, `${n0(Math.cos(a) * d * 0.5)} ${n0(-34 + Math.sin(a) * d * 0.5)}`], [t + 18 * TICK, `${n0(Math.cos(a) * d)} ${n0(-34 + Math.sin(a) * d - 10)}`]], 'translate')}</circle></g>`
    }
    out += sparks
  }
  return out + '</g>'
}
function darkness() {
  const fadeIn = (t0, t1, hold, end) => {
    const st = [[0, 0]]
    for (let k = 1; k <= 8; k++) st.push([t0 + ((t1 - t0) * k) / 8, n2(k / 8)])
    st.push([hold, 1])
    if (end) for (let k = 1; k <= 8; k++) st.push([hold + ((end - hold) * k) / 8, n2(1 - k / 8)])
    return st
  }
  return taken(748, SHORE + 8, 1.05, [...fadeIn(5, 9, FL.find), [FL.find, 0]], FL.find) +
    taken(640, SHORE + 4, 0.8, fadeIn(16, 19, 21, 24), 0)
}

// Manuscript pages: typed sheets drifting down out of the dark, tumbling slowly as
// they fall; one settles on the water every so often.
function pages() {
  const rng = mulberry32(57)
  let out = ''
  const lines = 'M-6 -6h12M-6 -3h12M-6 0h10M-6 3h12M-6 6h8'
  for (let i = 0; i < 6; i++) {
    const dur = 18 + Math.floor(rng() * 10)
    const x0 = 300 + rng() * 1000
    const begin = -Math.round(rng() * dur * 12) / 12
    const sway = 40 + rng() * 60
    const move = ticked('transform', 'translate', dur, 2, (u) => `${n0(x0 + Math.sin(u * Math.PI * 3) * sway)} ${n0(-30 + u * 620)}`, begin)
    const spin = ticked('transform', 'rotate', dur, 2, (u) => n0(Math.sin(u * Math.PI * 5) * 60), begin)
    const flip = ticked('transform', 'scale', dur, 2, (u) => `${n2(Math.cos(u * Math.PI * 7))} 1`, begin)
    out += `<g>${move}<g>${spin}<g>${flip}<path d="M-9 -12h18v24h-18z" fill="#e8ecf4" opacity="0.85"/><path d="${lines}" stroke="#6a7488" stroke-width="0.8"/></g></g></g>`
  }
  return out
}

// Crows: a flock of black birds wheeling over the far treeline, beating their wings,
// the flock tightening and loosening as it circles.
function crows() {
  const rng = mulberry32(67)
  const up = 'M-7 -3Q-3 -6 0 0Q3 -6 7 -3'
  const down = 'M-7 3Q-3 0 0 0Q3 0 7 3'
  let flock = ''
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2
    const r = 20 + rng() * 60
    const ph = rng() * 0.4
    const wings = (k) => `<path d="${k ? down : up}" fill="none" stroke="#030406" stroke-width="2.4" stroke-linecap="round" opacity="${k ? 0 : 1}">${timeline('opacity', 0.5, k ? [[0, 0], [ph, 1], [ph + 0.25, 0]] : [[0, 1], [ph, 0], [ph + 0.25, 1]])}</path>`
    const orbit = ticked('transform', 'translate', 12, 2, (u) => `${n0(Math.cos(a + u * Math.PI * 2) * r * 1.6)} ${n0(Math.sin(a + u * Math.PI * 2) * r * 0.5)}`, -i * 0.5)
    flock += `<g>${orbit}${wings(0)}${wings(1)}</g>`
  }
  const drift = ticked('transform', 'translate', 40, 2, (u) => `${n0(820 + Math.sin(u * Math.PI * 2) * 260)} ${n0(330 + Math.cos(u * Math.PI * 2) * 30)}`)
  return `<g>${drift}${flock}</g>`
}

// The darkness creeping out over the water from the treeline: black tendrils of fog
// that swell toward the dock and draw back.
function creep() {
  const rng = mulberry32(73)
  let d = ''
  for (let i = 0; i < 9; i++) {
    const x = 560 + i * 70 + rng() * 40
    d += blob('a-dark', x, SHORE + 10 + rng() * 20, 50 + rng() * 40, 20 + rng() * 26, 0.7 + rng() * 0.3, -10 + rng() * 20)
  }
  // The patch swells out over the water and draws back, in half-second steps.
  const swell = ticked('transform', 'scale', 16, 12, (u) => `1 ${n2(0.8 + 0.9 * (1 - Math.cos(u * Math.PI * 2)) / 2)}`)
  return `<g transform="translate(0 ${SHORE})"><g>${swell}<g transform="translate(0 ${-SHORE})">${d}</g></g></g>`
}

// ---------------------------------------------------------------- the near shore

// The cabin on the right shore, its window lit, smoke from its chimney; the dock
// running out from the near shore, and the man at its end with his flashlight.
function cabin() {
  const x = 1330
  const y = SHORE + 34
  return `<path d="M${x} ${y}V${y - 40}L${x + 50} ${y - 70}L${x + 100} ${y - 40}V${y}Z" fill="#141a24"/>` +
    `<path d="M${x - 8} ${y - 38}L${x + 50} ${y - 74}L${x + 108} ${y - 38}" fill="none" stroke="#252e3c" stroke-width="5"/>` +
    `<path d="M${x + 74} ${y - 74}h10v-22h-10z" fill="#141a24"/>` +
    `<path d="M${x + 20} ${y - 30}h22v18h-22z" fill="#ffc874"/><path d="M${x + 31} ${y - 30}v18M${x + 20} ${y - 21}h22" stroke="#3a2a12" stroke-width="1.5"/>` +
    blob('a-lamp', x + 31, y - 21, 50, 34, 0.6) +
    `<path d="M${x + 22} ${y + 10}h18M${x + 24} ${y + 17}h14M${x + 26} ${y + 24}h10" stroke="#ffc874" stroke-width="2" opacity="0.35"/>` +
    `<g>${stepDrift(-30, -20, 14)}${blob('a-smoke', x + 79, y - 112, 22, 12, 0.5)}${blob('a-smoke', x + 70, y - 134, 30, 15, 0.35, -20)}</g>`
}

function dock() {
  // The deck: the far end (where the man stands) to the near end at the frame's foot.
  const fl = [1030, 668]
  const fr = [1176, 668]
  const nl = [1250, 910]
  const nr = [1700, 910]
  let planks = ''
  for (let k = 0; k <= 22; k++) {
    const u = Math.pow(k / 22, 1.7)
    planks += `M${n0(fl[0] + (nl[0] - fl[0]) * u)} ${n0(fl[1] + (nl[1] - fl[1]) * u)}L${n0(fr[0] + (nr[0] - fr[0]) * u)} ${n0(fr[1] + (nr[1] - fr[1]) * u)}`
  }
  // The side face along the left edge: the deck's thickness, and posts below it.
  const sideFace = `M${fl[0]} ${fl[1]}L${nl[0]} ${nl[1]}L${nl[0]} ${nl[1] + 26}L${fl[0]} ${fl[1] + 6}Z`
  let posts = ''
  for (const u of [0, 0.18, 0.42, 0.75]) {
    const x = fl[0] + (nl[0] - fl[0]) * u
    const y = fl[1] + (nl[1] - fl[1]) * u
    const w = 4 + u * 12
    posts += `M${n0(x)} ${n0(y)}h${n0(w)}v${n0(20 + u * 60)}h${n0(-w)}z`
  }
  const farEnd = `M${fl[0]} ${fl[1]}H${fr[0]}V${fl[1] + 6}H${fl[0]}Z`
  // Reflections of the posts in the water, broken.
  let refl = ''
  for (const u of [0, 0.18, 0.42]) {
    const x = fl[0] + (nl[0] - fl[0]) * u
    const y = fl[1] + (nl[1] - fl[1]) * u + 20 + u * 60
    for (let k = 0; k < 4; k++) refl += `M${n0(x - 2 + (k % 2) * 3)} ${n0(y + k * 7)}h${n0(6 + u * 10)}`
  }
  return `<path d="${refl}" stroke="#0a0d13" stroke-width="2.4" opacity="0.8"/>` +
    `<path d="${posts}" fill="#090b10"/><path d="${sideFace}" fill="#0d1016"/><path d="${farEnd}" fill="#0d1016"/>` +
    `<path d="M${fl[0]} ${fl[1]}H${fr[0]}L${nr[0]} ${nr[1]}H${nl[0]}Z" fill="url(#a-deck)"/>` +
    `<path d="${planks}" stroke="#0b0e13" stroke-width="1.6"/>` +
    `<path d="M${fl[0]} ${fl[1]}L${nl[0]} ${nl[1]}" stroke="#4a5568" stroke-width="2"/>` +
    // A lamp post at the dock's root: the one safe light, buzzing.
    `<path d="M1232 820V700M1232 700q0 -10 12 -10h6" fill="none" stroke="#14181f" stroke-width="4"/><path d="M1246 686h12l-2 8h-8z" fill="#14181f"/>` +
    `<g>${timeline('opacity', 6, [[0, 1], [3.5, 0.5], [3.5 + 2 * TICK, 1], [3.5 + 4 * TICK, 0.6], [3.5 + 6 * TICK, 1]])}<circle cx="1252" cy="696" r="3.6" fill="#fff4cc"/>${blob('a-lamp', 1252, 700, 70, 60, 0.8)}${blob('a-lamp', 1270, 800, 110, 26, 0.6)}</g>` +
    // A bollard and a coil of rope near the end.
    `<path d="M1150 668v-12h9v12z" fill="#0d1016"/><ellipse cx="1110" cy="700" rx="14" ry="4" fill="none" stroke="#2a2e36" stroke-width="3"/>`
}

// The man, seen from behind and to one side: a dark jacket, his left arm out with
// the flashlight. The beam searches the far shore, finds the figure, holds on it.
function man() {
  const x = 1098
  const y = 668
  const S = 1.35
  const P = (dx, dy) => `${n1(x + dx * S)} ${n1(y + dy * S)}`
  // Legs and boots, apart; a long coat down to the knee, belted, collar up.
  const legs = `M${P(-10, 0)}L${P(-9, -34)}L${P(-2, -34)}L${P(-3, 0)}ZM${P(3, 0)}L${P(4, -34)}L${P(11, -34)}L${P(12, 0)}Z` +
    `M${P(-13, 0)}L${P(-12, -4)}L${P(-2, -4)}L${P(-2, 0)}ZM${P(3, 0)}L${P(3, -4)}L${P(14, -4)}L${P(15, 0)}Z`
  const coat = `M${P(-14, -30)}L${P(-16, -58)}Q${P(-16, -76)} ${P(-8, -80)}L${P(8, -80)}Q${P(16, -76)} ${P(16, -58)}L${P(15, -30)}Q${P(0, -26)} ${P(-14, -30)}Z`
  const collar = `M${P(-7, -80)}L${P(-6, -88)}L${P(0, -84)}L${P(6, -88)}L${P(7, -80)}Z`
  const head = `M${P(-6, -90)}a${n1(7 * S)} ${n1(8 * S)} 0 1 1 ${n1(13 * S)} 0a${n1(7 * S)} ${n1(5 * S)} 0 0 1 ${n1(-13 * S)} 0Z`
  // His left arm: shoulder, elbow forward and out, the hand with the light.
  const arm = `M${P(-10, -74)}L${P(-24, -62)}L${P(-34, -66)}`
  const hand = [x - 36 * S, y - 66 * S]
  const otherArm = `M${P(12, -74)}L${P(15, -54)}L${P(11, -44)}`
  const rim = `M${P(15, -58)}Q${P(16, -74)} ${P(8, -80)}M${P(7, -88)}q${n1(4 * S)} ${n1(4 * S)} ${n1(1 * S)} ${n1(9 * S)}M${P(15, -30)}L${P(16, -56)}`
  const belt = `M${P(-15, -46)}L${P(15, -46)}L${P(15, -43)}L${P(-15, -43)}Z`
  // The search: the beam's angle over the cycle (degrees, 0 = pointing left).
  const target = Math.atan2(SHORE - 20 - hand[1], 748 - hand[0]) * 180 / Math.PI - 180
  const ang = [[0, -8], [3, 6], [6, -4], [9, 10], [11.5, 2], [13, target + 6], [FL.find, target], [17, target], [19, -6], [23, 8], [FL.dur - TICK, -8]]
  const at = (t) => {
    for (let i = 1; i < ang.length; i++) if (t <= ang[i][0]) {
      const [t0, a0] = ang[i - 1]
      const [t1, a1] = ang[i]
      const u = (t - t0) / (t1 - t0)
      return a0 + (a1 - a0) * (1 - Math.cos(u * Math.PI)) / 2
    }
    return ang[0][1]
  }
  const sweep = ticked('transform', 'rotate', FL.dur, 2, (u) => n1(at(u * FL.dur)))
  const beam = `<path d="M-9 -3L-560 -80L-560 80L-9 3Z" fill="url(#a-torch)"/>`
  // Dust in the beam.
  const rng = mulberry32(31)
  let motes = ''
  for (let i = 0; i < 18; i++) motes += `M${n0(-60 - rng() * 420)} ${n0((rng() - 0.5) * 60)}h2v2h-2z`
  const drift = ticked('transform', 'translate', 4, 2, (u) => `${n1(-u * 30)} ${n1(Math.sin(u * Math.PI * 2) * 4)}`)
  return `<g transform="translate(${n1(hand[0])} ${n1(hand[1])})"><g>${sweep}${beam}<g>${drift}<path d="${motes}" fill="#fff6d8" opacity="0.6"/></g></g></g>` +
    `<ellipse cx="${x}" cy="${y + 2}" rx="${n0(22 * S)}" ry="4" fill="#020305" opacity="0.6"/>` +
    `<path d="${legs}" fill="#05070a"/><path d="${coat}" fill="#0b0e14"/><path d="${belt}" fill="#05070a"/><path d="${collar}" fill="#0b0e14"/><path d="${head}" fill="#06080c"/>` +
    `<path d="${otherArm}" fill="none" stroke="#0b0e14" stroke-width="${n1(7 * S)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${arm}" fill="none" stroke="#0b0e14" stroke-width="${n1(7 * S)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M${n1(hand[0] - 9)} ${n1(hand[1] - 3)}h12v6h-12z" fill="#1a1d22"/><circle cx="${n1(hand[0] - 9)}" cy="${n1(hand[1])}" r="3.4" fill="#fff6d8"/>${blob('a-lamp', hand[0] - 9, hand[1], 20, 16, 0.8)}` +
    // A rim of moonlight down his right side.
    `<path d="${rim}" stroke="#6a7c9c" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
}

// An empty rowboat adrift off the reeds, an oar trailing, rocking on the swell.
function rowboat() {
  const hull = 'M-70 0Q-60 18 -10 20H50Q72 16 80 -4L74 -6Q60 4 40 6H-20Q-56 6 -66 -4Z'
  const inside = 'M-66 -4Q-56 6 -20 6H40Q60 4 74 -6Q40 -12 0 -12Q-40 -12 -66 -4Z'
  const rock = ticked('transform', 'rotate', 6, 6, (u) => `${n1(Math.sin(u * Math.PI * 2) * 2.5)} 0 0`)
  const bob = ticked('transform', 'translate', 6, 6, (u) => `0 ${n1(Math.sin(u * Math.PI * 2 + 1) * 2)}`)
  return `<g transform="translate(560 742)"><g>${bob}<g>${rock}` +
    `<path d="${inside}" fill="#1a1f28"/><path d="${hull}" fill="#2a2420"/><path d="M-60 2Q-40 12 0 13H48" fill="none" stroke="#4a5a74" stroke-width="1.6" opacity="0.7"/>` +
    `<path d="M-30 -8h8v12h-8zM20 -8h8v12h-8z" fill="#141210"/><path d="M10 -4L90 30" stroke="#2a2420" stroke-width="3"/><path d="M84 26l14 6l-4 6l-14 -6z" fill="#2a2420"/>` +
    `</g></g>${blob('a-dark', 0, 22, 90, 8, 0.5)}<path d="M-80 24h50M30 26h60" stroke="#3a4a66" stroke-width="1.4" opacity="0.6"/></g>`
}

// Pines framing the left and right edges, and the near shore's rocks.
function framing() {
  const left = `${use('p1', 40, 920, 6.6)}${use('p0', 150, 940, 4.6, true)}${use('p2', -20, 900, 5)}`
  const right = `${use('p2', 1600, 920, 7)}${use('p0', 1500, 905, 4.4, true)}${use('p1', 1420, 640, 2.4)}${use('p0', 1490, 650, 2.8)}`
  const rocks = 'M0 900V780Q60 760 120 772Q190 768 230 800Q300 820 330 900Z'
  const rng = mulberry32(41)
  let reeds = ''
  let heads = ''
  for (let i = 0; i < 46; i++) {
    const x = 180 + rng() * 460
    const base = 830 + rng() * 70
    const h = 60 + rng() * 120
    const lean = (rng() - 0.3) * 24
    reeds += `M${n0(x - 1.4)} ${n0(base)}Q${n1(x + lean * 0.3)} ${n0(base - h * 0.6)} ${n1(x + lean)} ${n0(base - h)}L${n1(x + lean + 1)} ${n0(base - h + 2)}Q${n1(x + lean * 0.3 + 1.5)} ${n0(base - h * 0.6)} ${n0(x + 1.4)} ${n0(base)}Z`
    if (rng() < 0.35) heads += `M${n1(x + lean * 0.8 - 2.5)} ${n0(base - h * 0.85)}h5v16h-5z`
  }
  const sway = ticked('transform', 'skewX', 6, 3, (u) => n1(Math.sin(u * Math.PI * 2) * 2.4))
  return `<path d="${rocks}" fill="#06080c"/><g transform="translate(0 900)"><g>${sway}<g transform="translate(0 -900)"><path d="${reeds}${heads}" fill="#05070b"/></g></g></g><g fill="#04060a">${left}${right}</g>`
}

// ---------------------------------------------------------------- the scene

export function buildScene() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <symbol id="p0" overflow="visible">${pine(1, 16, 0.24)}</symbol>
    <symbol id="p1" overflow="visible">${pine(2, 14, 0.28)}</symbol>
    <symbol id="p2" overflow="visible"><use href="#p0" transform="matrix(-1.15 0 0 .9 0 0)"/></symbol>
    <linearGradient id="a-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03050b"/><stop offset="0.4" stop-color="#0b1222"/><stop offset="0.55" stop-color="#18233a"/></linearGradient>
    <radialGradient id="a-cd"><stop offset="0" stop-color="#03050a" stop-opacity="0.9"/><stop offset="1" stop-color="#03050a" stop-opacity="0"/></radialGradient>
    <radialGradient id="a-cl"><stop offset="0" stop-color="#55647e" stop-opacity="0.8"/><stop offset="1" stop-color="#55647e" stop-opacity="0"/></radialGradient>
    <radialGradient id="a-halo"><stop offset="0" stop-color="#9fb2d0" stop-opacity="0.45"/><stop offset="1" stop-color="#9fb2d0" stop-opacity="0"/></radialGradient>
    <radialGradient id="a-fog"><stop offset="0" stop-color="#6f84a6" stop-opacity="0.55"/><stop offset="1" stop-color="#6f84a6" stop-opacity="0"/></radialGradient>
    <radialGradient id="a-lamp"><stop offset="0" stop-color="#ffd98a" stop-opacity="0.6"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
    <radialGradient id="a-smoke"><stop offset="0" stop-color="#6a7890" stop-opacity="0.7"/><stop offset="1" stop-color="#6a7890" stop-opacity="0"/></radialGradient>
    <radialGradient id="a-dark"><stop offset="0" stop-color="#000" stop-opacity="0.8"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="a-flare"><stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient>
    <linearGradient id="a-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff2c8" stop-opacity="0.5"/><stop offset="1" stop-color="#fff2c8" stop-opacity="0"/></linearGradient>
    <linearGradient id="a-beam2" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff2c8" stop-opacity="0.5"/><stop offset="1" stop-color="#fff2c8" stop-opacity="0"/></linearGradient>
    <linearGradient id="a-torch" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff6d8" stop-opacity="0.55"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></linearGradient>
    <linearGradient id="a-deck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a303a"/><stop offset="1" stop-color="#14181f"/></linearGradient>
    <linearGradient id="a-lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121a2a"/><stop offset="1" stop-color="#05070c"/></linearGradient>
    <radialGradient id="a-vig" cx="0.5" cy="0.5" r="0.8"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient>
    ${grain('a-grain', 9)}
    <linearGradient id="a-creep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.85"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
  </defs>
  ${sky()}
  ${farShore()}
  ${lake()}
  ${creep()}
  ${darkness()}
  ${crows()}
  ${lighthouse()}
  ${cabin()}
  ${dock()}
  ${man()}
  ${rowboat()}
  ${pages()}
  ${framing()}
  <rect width="${W}" height="${H}" fill="url(#a-grain)" opacity="0.3"/>
  <rect width="${W}" height="${H}" fill="url(#a-vig)"/>
</svg>`
}
