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

// ================================================================ Red Dead Redemption 2 inspired
//
// A camp by a mountain river at blue hour, as an original scene. The sun is down
// behind snowy peaks that still hold its last pink light on their western faces; the
// first stars are out. The river winds down out of the range toward us. On the near
// right bank a fire burns in a ring of stones, a coffee pot hanging over it, before a
// canvas wall tent; a cowboy sits on a log by the fire with a tin cup, and now and
// then drinks. His saddle and bedroll lie behind him, a rifle leans on the log. On
// the left bank his horse grazes, swishing its tail. Nothing is taken from the game:
// the man, the horse and the camp are drawn for this scene, and the man is no one in
// particular.

const HZ = 470 // the foot of the mountains
const FIRE = [1092, 748]

// ---------------------------------------------------------------- the sky

function sky() {
  const rng = mulberry32(4)
  let stars = ''
  let twinkle = ''
  for (let i = 0; i < 140; i++) {
    const x = rng() * W
    const y = Math.pow(rng(), 1.6) * 260
    const r = n1(0.45 + rng() * 1)
    const d = `M${n1(x - r)} ${n1(y)}a${r} ${r} 0 1 0 ${n1(r * 2)} 0a${r} ${r} 0 1 0 ${n1(-r * 2)} 0`
    if (rng() < 0.18) twinkle += d
    else stars += d
  }
  // Long low clouds, their undersides catching the last light.
  let clouds = ''
  let rims = ''
  for (let i = 0; i < 7; i++) {
    const x = 150 + rng() * 1300
    const y = 250 + rng() * 90
    const w = 180 + rng() * 260
    const h = 8 + rng() * 10
    clouds += `M${n0(x)} ${n0(y)}q${n0(w * 0.3)} ${-n0(h * 1.6)} ${n0(w * 0.6)} ${-n0(h * 0.4)}q${n0(w * 0.25)} ${-n0(h)} ${n0(w * 0.4)} ${n0(h * 0.4)}q${-n0(w * 0.5)} ${n0(h * 0.9)} ${-n0(w)} 0z`
    rims += `M${n0(x + w * 0.1)} ${n0(y + 1)}q${n0(w * 0.4)} ${n0(h * 0.6)} ${n0(w * 0.85)} 0`
  }
  const shoot = `<g opacity="0">${timeline('opacity', 37, [[0, 0], [19, 1], [19.6, 0]])}<path d="M0 0L-90 34" stroke="url(#r-shoot)" stroke-width="2" stroke-linecap="round">${timeline('', 37, [[0, '1200 70'], [19, '1200 70'], [19.2, '1150 89'], [19.4, '1100 108'], [19.6, '1050 127']], 'translate')}</path></g>`
  // The Milky Way: a soft band rising from the right, thick with faint stars.
  let milk = ''
  for (let i = 0; i < 260; i++) {
    const u = rng()
    const off = (rng() + rng() + rng() - 1.5) * 50
    const x = 1500 - u * 1100 + off * 0.5
    const y = 30 + u * 180 + off
    milk += `M${n0(x)} ${n0(y)}h1v1h-1z`
  }
  let band = ''
  for (let k = 0; k < 6; k++) band += blob('r-milk', 1400 - k * 190, 50 + k * 34, 190, 34, 0.5, 10)
  return `<rect width="${W}" height="${H}" fill="url(#r-sky)"/>` + band + `<path d="${milk}" fill="#e4e8ff" opacity="0.55"/>` +
    `<path d="${stars}" fill="#f2f4ff" opacity="0.8"/><path d="${twinkle}" fill="#f2f4ff">${timeline('opacity', 3, [[0, 1], [0.5, 0.3], [1, 0.9], [2, 0.5], [2.5, 1]])}</path>` +
    `<path d="M196 92a20 20 0 1 0 22 26a16 16 0 1 1 -22 -26z" fill="#f4ecd8"/>${blob('r-moon', 200, 108, 70, 70, 0.5)}` +
    `<g>${stepDrift(60, 0, 90)}<path d="${clouds}" fill="#4a4870" opacity="0.85"/><path d="${rims}" fill="none" stroke="#e8a0a0" stroke-width="2.4" opacity="0.7" stroke-linecap="round"/></g>` + shoot
}

// ---------------------------------------------------------------- the mountains

// A range in facets: the outline is drawn in its shadow colour, then from each peak a
// lit face falls to the left (toward the light), down a spur line to the foot. Snow
// lies above a ragged snow line, pink where it is lit and lilac in shadow.
function range(keys, seed, foot, cShade, cLit, snowLine, opts = {}) {
  const line = ridge(keys, opts.rough ?? 0.14, seed, 4)
  const outline = `M${pts(line)}L1620 ${foot}L-20 ${foot}Z`
  const rng = mulberry32(seed + 7)
  let lit = ''
  let spurs = ''
  // The peaks are the odd keys; each lit face runs from the valley before it to it.
  for (let k = 1; k < keys.length - 1; k += 2) {
    const [vx] = keys[k - 1]
    const [px, py] = keys[k]
    const seg = line.filter(([x]) => x >= vx && x <= px)
    const baseX = px + (keys[k + 1][0] - px) * (0.12 + rng() * 0.15)
    // The face's left edge runs down a spur from the valley notch, not straight down.
    const [sx0, sy0] = seg[0] || [vx, py]
    lit += `M${pts(seg)}L${n0(px + (baseX - px) * 0.3)} ${n0(py + (foot - py) * 0.3)}L${n0(baseX)} ${foot}L${n0(sx0 + (px - sx0) * 0.62)} ${foot}Q${n0(sx0 + (px - sx0) * 0.2)} ${n0(sy0 + (foot - sy0) * 0.45)} ${n0(sx0)} ${n0(sy0)}Z`
    // Spurs: a few gullies running down the faces.
    for (let s = 0; s < 3; s++) {
      const sx = vx + (px - vx) * (0.3 + rng() * 0.6)
      const top = line.find(([x]) => x >= sx) || [sx, py]
      const len = (foot - top[1]) * (0.35 + rng() * 0.4)
      const lean = -10 - rng() * 26
      spurs += `M${n0(top[0])} ${n0(top[1] + 3)}q${n0(lean * 0.5)} ${n0(len * 0.4)} ${n0(lean)} ${n0(len)}l${n0(6 + rng() * 6)} ${n0(-len * 0.15)}q${n0(-lean * 0.3)} ${n0(-len * 0.5)} ${n0(-lean - 3)} ${n0(-len * 0.85)}z`
    }
  }
  let out = `<path d="${outline}" fill="${cShade}"/><path d="${lit}" fill="${cLit}"/>` +
    `<path d="${spurs}" fill="${cShade}" opacity="0.55"/>`
  if (snowLine) {
    const id = `r-sn${seed}`
    let wave = `M-20 -10H1620V${snowLine}`
    for (let x = 1620; x >= -20; x -= 20) wave += `L${x} ${n0(snowLine + Math.sin(x / 37 + seed) * 18 + Math.sin(x / 11) * 7 + (rng() - 0.5) * 10)}`
    out += `<clipPath id="${id}"><path d="${wave}Z"/></clipPath><g clip-path="url(#${id})"><path d="${outline}" fill="#a9a6cc"/><path d="${lit}" fill="url(#r-snowLit)"/></g>`
  }
  // Haze gathering toward the foot, so each range sits in the air before the next.
  return out + `<rect x="-20" y="${foot - 150}" width="1640" height="152" fill="url(#r-haze)"/>`
}
function mountains() {
  return range([[-20, 300], [140, 196], [290, 270], [470, 140], [620, 250], [760, 180], [880, 262], [1060, 150], [1220, 250], [1380, 168], [1500, 240], [1620, 200]], 21, HZ, '#3e4a72', '#6a6a94', 230) +
    blob('r-glow', 790, HZ - 10, 520, 90, 0.7) +
    range([[-20, 380], [160, 320], [330, 372], [520, 300], [700, 390], [880, 340], [1040, 400], [1240, 310], [1420, 380], [1620, 330]], 31, HZ + 10, '#28304e', '#3e4466', 335, { rough: 0.18 }) +
    range([[-20, 440], [200, 400], [420, 446], [620, 420], [780, HZ - 2], [960, 424], [1200, 404], [1420, 440], [1620, 412]], 41, HZ + 20, '#18203a', '#222a46', 0, { rough: 0.2 })
}

// ---------------------------------------------------------------- the railway

// A timber trestle carries the line across the valley mouth, below the far range. A
// train crosses it every 47 s: a locomotive with its headlamp lit, its stack
// throwing puffs of steam that hang and thin behind it, a tender and four cars.
const RAIL = HZ - 32
function railway() {
  let trestle = ''
  for (let x = 560; x <= 1040; x += 24) trestle += `M${x} ${RAIL + 4}L${x - 8} ${HZ + 8}M${x} ${RAIL + 4}L${x + 8} ${HZ + 8}M${x - 6} ${RAIL + 18}H${x + 6}`
  const car = (x, len, h) => `M${x} ${RAIL}v${-h}h${len}v${h}z`
  // The train, drawn with its nose at x 0, running to the right.
  let body = car(-86, 30, 15) + car(-122, 34, 15) + car(-158, 34, 15) + car(-194, 34, 15) + car(-55, 20, 10)
  body += `M-32 ${RAIL}v-12h26l6 6v6zM-30 ${RAIL - 12}v-8h10v8zM-12 ${RAIL - 12}v-7h4v7z`
  let wheels = ''
  for (let x = -190; x < 0; x += 9) wheels += `M${x} ${RAIL}a2.4 2.4 0 1 0 0.1 0`
  let steam = ''
  for (let k = 0; k < 6; k++) steam += blob('r-steam', -10 - k * 18, RAIL - 24 - k * 5, 7 + k * 4, 5 + k * 2.4, 0.8 - k * 0.11)
  const dur = 47
  const t0 = 24
  const n = 18 * 24
  const run = [[0, '300 0']]
  for (let i = 0; i <= n; i += 2) run.push([t0 + i / 24, `${n0(300 + (1400 * i) / n)} 0`])
  return `<path d="${trestle}" stroke="#1a2038" stroke-width="2.2"/><path d="M540 ${RAIL + 2}H1060" stroke="#1a2038" stroke-width="4"/>` +
    `<g>${timeline('', dur, run, 'translate')}<path d="${body}" fill="#141a2e"/><path d="${wheels}" fill="#0c1020"/>` +
    `<path d="M-2 ${RAIL - 8}l60 -6v14z" fill="url(#r-lamp)"/><circle cx="-1" cy="${RAIL - 8}" r="2" fill="#ffe6a0"/>` +
    `<path d="M-186 ${RAIL - 9}h22v4h-22zM-150 ${RAIL - 9}h22v4h-22zM-114 ${RAIL - 9}h22v4h-22z" fill="#e8b46a" opacity="0.7"/>` +
    `<g>${ticked('opacity', '', 1, 3, (u) => n2(0.75 + 0.25 * Math.sin(u * Math.PI * 2)))}${steam}</g></g>`
}

// ---------------------------------------------------------------- the river

// Its course winds out of the gap toward us, widening. The banks are drawn from the
// same centre line, so a pale pebble strip can run along each edge.
const RIVER = [[790, HZ], [770, 520], [712, 580], [690, 640], [742, 720], [800, 800], [760, 910]]
function riverEdges() {
  const centre = []
  for (let i = 1; i < RIVER.length; i++) {
    const [x0, y0] = RIVER[i - 1]
    const [x1, y1] = RIVER[i]
    for (let k = 0; k < 8; k++) {
      const u = k / 8
      const v = (1 - Math.cos(u * Math.PI)) / 2
      centre.push([x0 + (x1 - x0) * v, y0 + (y1 - y0) * u])
    }
  }
  centre.push(RIVER[RIVER.length - 1])
  const half = (y) => 8 + Math.pow((y - HZ) / (H - HZ), 1.25) * 300
  const L = centre.map(([x, y]) => [x - half(y), y])
  const R = centre.map(([x, y]) => [x + half(y) * 0.92, y])
  return { L, R }
}
function river() {
  const { L, R } = riverEdges()
  const water = `M${pts(L)}L${pts(R.slice().reverse())}Z`
  const edge = (side, out) => `M${pts(side)}L${pts(side.slice().reverse().map(([x, y]) => [x + out * (2 + (y - HZ) * 0.04), y]))}Z`
  const rng = mulberry32(61)
  // Ripples: short strokes that follow the flow, longer and further apart near us.
  let rip = ''
  for (let i = 0; i < 70; i++) {
    const t = Math.pow(rng(), 0.8)
    const y = HZ + 10 + t * (H - HZ)
    const row = L.find(([, ly]) => ly >= y) || L[L.length - 1]
    const rowR = R.find(([, ry]) => ry >= y) || R[R.length - 1]
    const x = row[0] + (rowR[0] - row[0]) * (0.1 + rng() * 0.8)
    const w = 6 + t * 50 * (0.5 + rng())
    rip += `M${n0(x)} ${n0(y)}q${n0(w / 2)} ${n1(-1 - t * 2)} ${n0(w)} 0`
  }
  const flow = ticked('transform', 'translate', 3, 2, (u) => `0 ${n1(u * 70)}`)
  // Rocks in the stream, white water breaking around them, flickering.
  let rocks = ''
  let foam = ''
  for (const [x, y, s] of [[700, 610, 0.7], [742, 690, 0.9], [868, 790, 1.4], [560, 850, 1.6]]) {
    rocks += `M${n0(x - 14 * s)} ${n0(y)}q${n0(4 * s)} ${n0(-12 * s)} ${n0(14 * s)} ${n0(-12 * s)}q${n0(12 * s)} ${n0(2 * s)} ${n0(14 * s)} ${n0(12 * s)}z`
    // White water: a collar where the current piles against the rock, and a short
    // wake trailing off downstream on both sides.
    foam += `M${n0(x - 17 * s)} ${n0(y + 1)}q${n0(17 * s)} ${n0(5 * s)} ${n0(34 * s)} 0M${n0(x - 14 * s)} ${n0(y + 5 * s)}q${n0(-6 * s)} ${n0(6 * s)} ${n0(-14 * s)} ${n0(8 * s)}M${n0(x + 14 * s)} ${n0(y + 5 * s)}q${n0(6 * s)} ${n0(6 * s)} ${n0(14 * s)} ${n0(8 * s)}`
  }
  const foamFx = timeline('opacity', 1, [[0, 0.9], [0.25, 0.5], [0.5, 0.8], [0.75, 0.6]])
  return `<clipPath id="r-water"><path d="${water}"/></clipPath>` +
    `<path d="${water}" fill="url(#r-river)"/>` +
    `<g clip-path="url(#r-water)">` +
    // The reflected sky's glow, and the darker reflections of the banks' trees.
    blob('r-glowW', 780, HZ + 30, 70, 70, 0.9) + blob('r-fireRefl', FIRE[0] - 150, 790, 120, 60, 0.6) +
    `<path d="${edge(L, 1)}" fill="#0a0f1c" opacity="0.5"/>` +
    `<g>${flow}<path id="r-rip" d="${rip}" fill="none" stroke="#c8b8d6" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/><use href="#r-rip" y="-70"/></g></g>` +
    `<path d="${edge(L, -1)}" fill="#3c3c48"/><path d="${edge(R, 1)}" fill="#48403e"/>` +
    `<path d="${rocks}" fill="#141a26"/><path d="${rocks}" fill="url(#r-rockLit)"/>` +
    `<g>${foamFx}<path d="${foam}" fill="none" stroke="#e6e2f0" stroke-width="2" stroke-linecap="round" opacity="0.8"/></g>` +
    // Mist lying on the water, drifting downstream.
    `<g>${stepDrift(50, 0, 40)}${blob('r-mist', 760, 520, 160, 14, 0.7)}${blob('r-mist', 700, 640, 220, 18, 0.55)}${blob('r-mist', 820, 760, 300, 22, 0.4)}</g>`
}

// ---------------------------------------------------------------- the land

function land() {
  const rng = mulberry32(51)
  const { L, R } = riverEdges()
  const leftBank = `M-20 ${HZ + 4}L${pts(L)}L-20 910Z`
  const rightBank = `M1620 ${HZ + 6}L${pts(R)}L1620 910Z`
  // Forest along the foot of the range, both sides of the gap.
  let far = ''
  for (let x = -10; x < W + 20; x += 6 + rng() * 10) {
    if (x > 740 && x < 840) continue
    far += use(`p${Math.floor(rng() * 3)}`, x, HZ + 8 + rng() * 6, 0.3 + rng() * 0.4, rng() < 0.5)
  }
  // Clumps of pines on each bank, bigger as they come nearer.
  let mid = ''
  for (const [x, y, s] of [[40, 600, 1.9], [92, 584, 1.5], [150, 596, 1.7], [510, 540, 1.1], [552, 552, 1.3], [470, 534, 0.9], [960, 540, 1.0], [1000, 552, 1.2], [1040, 530, 0.9], [1460, 590, 1.9], [1520, 570, 1.6], [1576, 600, 2.1], [1400, 566, 1.3]]) mid += use(`p${Math.floor(rng() * 3)}`, x, y, s, rng() < 0.5)
  // Grass: a texture of short blades over both banks, and boulders.
  let blades = ''
  for (let i = 0; i < 90; i++) {
    const y = HZ + 30 + Math.pow(rng(), 0.7) * (H - HZ - 30)
    const t = (y - HZ) / (H - HZ)
    const x = rng() < 0.5 ? rng() * 600 : 960 + rng() * 640
    const h = 3 + t * 12
    for (let k = 0; k < 4; k++) blades += `M${n1(x + k * 1.6)} ${n0(y)}l${n1((k - 1.5) * h * 0.18)} ${n1(-h * (0.6 + rng() * 0.5))}`
  }
  let boulders = ''
  for (const [x, y, s] of [[220, 640, 1], [420, 730, 1.4], [120, 800, 2], [1360, 700, 1.1], [1500, 820, 1.8], [980, 660, 0.8]]) boulders += `M${n0(x - 22 * s)} ${n0(y)}q${n0(4 * s)} ${n0(-18 * s)} ${n0(20 * s)} ${n0(-20 * s)}q${n0(18 * s)} ${n0(2 * s)} ${n0(24 * s)} ${n0(20 * s)}z`
  return `<g fill="#0f1526">${far}</g>` +
    `<path d="${leftBank}" fill="url(#r-bankL)"/><path d="${rightBank}" fill="url(#r-bankR)"/>` +
    `<path d="${blades}" stroke="#263048" stroke-width="1.2" stroke-linecap="round" opacity="0.8"/>` +
    `<path d="${boulders}" fill="#141a28"/><path d="${boulders}" fill="url(#r-rockLit)"/>` +
    `<g fill="#0a0f1a">${mid}</g>`
}

// ---------------------------------------------------------------- the horse

// A bay horse grazing on the left bank, side on, facing right: a brown coat shaded
// darker underneath, black mane, tail and lower legs, a white blaze. Its neck lowers
// to the grass and rises again; its tail swishes.
function horse() {
  const body = 'M-60 -114C-78 -114 -94 -104 -94 -88C-94 -76 -88 -66 -84 -58C-84 -48 -86 -40 -84 -32L-80 -10L-82 0H-70L-71 -10L-72 -30C-70 -44 -66 -56 -58 -64C-40 -70 -10 -66 16 -66C26 -66 34 -68 38 -64L40 -36L42 -28L42 -8L40 0H52L52 -8L52 -30L54 -40C56 -56 60 -70 64 -80C70 -96 66 -108 56 -116C40 -122 20 -110 0 -108C-20 -106 -40 -114 -60 -114Z'
  const socks = 'M-84 -32L-80 -10L-82 0H-70L-71 -10L-72 -30ZM40 -36L42 -28L42 -8L40 0H52L52 -8L52 -30L53 -36Z'
  const farLegs = 'M-66 -60C-62 -48 -64 -40 -62 -32L-58 -10L-60 0H-48L-50 -10L-52 -32C-50 -44 -50 -54 -48 -62ZM22 -66L24 -36L26 -28L26 -8L24 0H36L36 -8L36 -30L38 -64Z'
  const neck = 'M34 -116C50 -140 76 -158 98 -164L103 -171L106 -163L112 -158C122 -148 136 -132 144 -120C148 -112 144 -104 136 -104C126 -106 114 -110 106 -118C96 -126 90 -122 84 -112C76 -100 68 -90 62 -78Z'
  const mane = 'M34 -118C50 -142 74 -160 98 -166L100 -160C78 -152 56 -136 44 -112Z'
  const blaze = 'M118 -150L136 -124L134 -118L114 -144Z'
  const tail = 'M-90 -104Q-112 -90 -110 -56Q-108 -34 -100 -18Q-100 -44 -96 -60Q-94 -78 -88 -90Z'
  const muscle = 'M-80 -94C-70 -84 -66 -70 -66 -60M40 -96C46 -86 50 -76 50 -64M-20 -100C-10 -98 10 -98 30 -104'
  const piv = '56 -104'
  const graze = timeline('', 23, [[0, `0 ${piv}`], [4, `14 ${piv}`], [4.5, `30 ${piv}`], [5, `48 ${piv}`], [5.5, `62 ${piv}`], [6, `74 ${piv}`], [14, `66 ${piv}`], [14.5, `48 ${piv}`], [15, `28 ${piv}`], [15.5, `10 ${piv}`], [16, `0 ${piv}`]], 'rotate')
  const swish = timeline('', 7, [[0, '0 -90 -100'], [2, '10 -90 -100'], [2.25, '18 -90 -100'], [2.5, '8 -90 -100'], [2.75, '-6 -90 -100'], [3, '0 -90 -100']], 'rotate')
  return `<g transform="translate(330 672) scale(0.92)">` +
    `<ellipse cx="-10" cy="2" rx="110" ry="9" fill="#05070c" opacity="0.7"/>` +
    `<path d="${farLegs}" fill="#140c08"/>` +
    `<g>${swish}<path d="${tail}" fill="#0e0806"/></g>` +
    `<path d="${body}" fill="url(#r-bay)"/><path d="${socks}" fill="#120a06"/>` +
    `<path d="${muscle}" fill="none" stroke="#2a180e" stroke-width="2.4" opacity="0.6" stroke-linecap="round"/>` +
    `<path d="M-92 -96C-86 -110 -72 -114 -60 -114C-40 -114 -20 -106 0 -108C20 -110 40 -122 56 -116" fill="none" stroke="#8a9ac0" stroke-width="2" opacity="0.5"/>` +
    // The saddle: tree, horn, skirt, a blanket under it, the cinch.
    `<path d="M-30 -112Q0 -104 30 -114L32 -86Q2 -80 -30 -86Z" fill="#7a2e22"/><path d="M-20 -116Q4 -108 24 -118L22 -96Q2 -90 -18 -96Z" fill="#4a2a18"/>` +
    `<path d="M18 -118l6 -12l5 2l-4 10z" fill="#3a2010"/><path d="M2 -92v40" stroke="#2a160e" stroke-width="3"/>` +
    `<g>${graze}<path d="${neck}" fill="url(#r-bayN)"/><path d="${mane}" fill="#0e0806"/><path d="${blaze}" fill="#e8dccc"/><circle cx="118" cy="-146" r="2.2" fill="#0a0604"/>` +
    `<path d="M106 -118Q126 -112 140 -108M112 -140L122 -150" stroke="#1a100a" stroke-width="2" fill="none"/></g>` +
    `</g>`
}

// ---------------------------------------------------------------- wildlife

// A white-tailed deer drinking at the water's edge across from the camp; every so
// often it lifts its head and looks round, then drinks again.
function deer() {
  const body = 'M-22 -22C-26 -30 -18 -34 -6 -34C6 -34 14 -32 18 -26L20 -12L18 0H15L14 -12L10 -16H-12L-15 -10L-14 0H-17L-19 -12Z'
  const farLegs = 'M-10 -16L-8 0H-6L-6 -16ZM8 -16L10 0H12L12 -16Z'
  const headDown = 'M16 -30L28 -14L32 -6L28 -4L24 -10L14 -24Z'
  const headUp = 'M14 -30L20 -46L26 -50L30 -46L26 -42L20 -28Z'
  const earsUp = 'M22 -48l-2 -8l4 6zM26 -49l3 -7l0 7z'
  const up = timeline('opacity', 17, [[0, 0], [9, 1], [12, 0]])
  const down = timeline('opacity', 17, [[0, 1], [9, 0], [12, 1]])
  return `<g transform="translate(612 618) scale(1.05)"><path d="${farLegs}" fill="#1e1612"/><path d="${body}" fill="#5a3e2a"/>` +
    `<path d="M-22 -22q-4 -2 -6 2q4 0 6 0z" fill="#e8e0d4"/><path d="M-18 -32q12 -4 30 0" stroke="#8a9ac0" stroke-width="1.4" opacity="0.5" fill="none"/>` +
    `<g>${down}<path d="${headDown}" fill="#5a3e2a"/></g><g opacity="0">${up}<path d="${headUp}${earsUp}" fill="#5a3e2a"/></g></g>`
}

// A hawk circling high over the valley, wings set, tilting as it turns.
function hawk() {
  const shape = 'M-14 0Q-6 -4 0 -1Q6 -4 14 0Q6 -1 0 2Q-6 -1 -14 0Z'
  return `<g>${ticked('transform', 'translate', 24, 2, (u) => `${n0(1000 + Math.cos(u * Math.PI * 2) * 160)} ${n0(170 + Math.sin(u * Math.PI * 2) * 40)}`)}<path d="${shape}" fill="#141a30"/></g>`
}

// Fireflies over the grass by the camp, each blinking on its own beat.
function fireflies() {
  const rng = mulberry32(83)
  let out = ''
  for (let i = 0; i < 16; i++) {
    const x = rng() < 0.5 ? 120 + rng() * 420 : 1000 + rng() * 520
    const y = 640 + rng() * 200
    const dur = 3 + Math.floor(rng() * 4)
    const t = Math.round(rng() * dur * 12) / 12
    out += `<g opacity="0">${timeline('opacity', dur, [[0, 0], [t, 1], [t + 0.5, 0]])}<circle cx="${n0(x)}" cy="${n0(y)}" r="1.8" fill="#f8f0a0"/>${blob('r-fly', x, y, 8, 8, 0.8)}</g>`
  }
  return out
}

// The camp dog, curled up asleep on the warm side of the fire; every so often its
// tail thumps and its head lifts to look at the man, then settles again.
function dog() {
  // Lying on its side facing left: a long body, the hind leg folded, the forelegs
  // stretched out in front with the muzzle resting on them.
  const body = 'M-22 -4C-24 -16 -12 -24 4 -24C20 -24 34 -18 36 -6C37 2 32 6 24 6H-16C-20 6 -22 2 -22 -4Z'
  const hind = 'M16 -14C26 -16 32 -8 30 2H12C10 -6 10 -12 16 -14Z'
  const fore = 'M-18 2H-52Q-56 4 -52 7H-18Z'
  const neck = 'M-14 -18C-22 -18 -30 -14 -32 -8L-20 -4Z'
  const headDown = 'M-30 -14C-24 -16 -18 -12 -18 -6C-18 -2 -22 2 -28 2H-50Q-56 0 -54 -4C-50 -8 -42 -14 -30 -14Z'
  const earDown = 'M-28 -14C-24 -14 -20 -10 -20 -4C-24 -6 -28 -10 -28 -14Z'
  const headUp = 'M-26 -30C-20 -32 -14 -28 -14 -22C-14 -16 -18 -12 -24 -12L-42 -10Q-48 -12 -46 -16C-42 -22 -34 -30 -26 -30Z'
  const earUp = 'M-24 -30C-20 -30 -16 -26 -16 -20C-20 -22 -24 -26 -24 -30Z'
  const up = timeline('opacity', 23, [[0, 0], [14, 1], [17, 0]])
  const down = timeline('opacity', 23, [[0, 1], [14, 0], [17, 1]])
  const thump = timeline('', 23, [[0, '0 34 -4'], [6, '-24 34 -4'], [6.25, '0 34 -4'], [6.5, '-24 34 -4'], [6.75, '0 34 -4'], [15, '-24 34 -4'], [15.25, '0 34 -4']], 'rotate')
  return `<g transform="translate(1004 780) scale(1.05)"><ellipse cx="-8" cy="6" rx="50" ry="5" fill="#050304" opacity="0.6"/>` +
    `<g>${thump}<path d="M34 -4Q50 -6 58 4Q52 6 46 2Q40 0 34 2Z" fill="#3e2a1c"/></g>` +
    `<path d="${body}${hind}${fore}${neck}" fill="#5a3e28"/><path d="${hind}" fill="#4a3220"/>` +
    `<path d="M-22 -4C-24 -16 -12 -24 4 -24M-52 2H-20" fill="none" stroke="#e0884e" stroke-width="2" opacity="0.65"/>` +
    `<path d="M-2 -20q10 4 24 2M-8 -10q10 4 22 2" stroke="#6e5034" stroke-width="3" fill="none" opacity="0.5"/>` +
    `<g>${down}<path d="${headDown}" fill="#5a3e28"/><path d="${earDown}" fill="#3a2616"/><path d="M-36 -8h4" stroke="#1a0e08" stroke-width="1.4"/><circle cx="-53" cy="-3" r="1.8" fill="#120a06"/></g>` +
    `<g opacity="0">${up}<path d="${headUp}" fill="#5a3e28"/><path d="${earUp}" fill="#3a2616"/><circle cx="-30" cy="-23" r="1.4" fill="#0a0604"/><circle cx="-45" cy="-14" r="1.8" fill="#120a06"/></g></g>`
}

// ---------------------------------------------------------------- the camp

// A covered wagon behind the tent: the canvas bonnet over its hoops, the box, a
// wheel, the tongue resting on the ground.
function wagon() {
  return `<path d="M1468 618L1474 562Q1520 540 1580 552L1590 614Z" fill="#c8b898"/><path d="M1520 548L1526 616M1556 548L1560 616" stroke="#a89878" stroke-width="2"/>` +
    `<path d="M1470 614h124v20h-124z" fill="#3a2414"/><circle cx="1490" cy="642" r="18" fill="none" stroke="#2a1a10" stroke-width="4"/><path d="M1490 624v36M1472 642h36M1478 630l24 24M1478 654l24 -24" stroke="#2a1a10" stroke-width="2"/>` +
    `<path d="M1470 630L1420 660" stroke="#2a1a10" stroke-width="3"/>`
}


// A canvas wall tent: short walls and a pitched roof, its front toward the fire with
// the flaps tied back and lamplight inside, guy ropes out to stakes.
function tent() {
  const roofFront = 'M1244 640L1306 586L1366 640Z'
  const wallFront = 'M1250 640H1360V700H1250Z'
  const roofSide = 'M1306 586L1500 600L1548 650L1366 640Z'
  const wallSide = 'M1366 640L1548 650L1546 708L1360 700Z'
  const door = 'M1286 700L1304 618L1324 700Z'
  const flaps = 'M1286 700L1304 618L1278 650L1268 700ZM1324 700L1304 618L1332 648L1344 700Z'
  const seams = 'M1306 586L1366 640M1400 590L1410 642M1450 594L1458 646M1410 642L1408 703M1458 646L1456 705'
  const ropes = 'M1244 640L1200 712M1366 640L1376 716M1500 600L1586 690M1548 650L1600 720'
  const flick = timeline('opacity', 4, [[0, 1], [1.2, 0.85], [1.3, 1], [2.6, 0.9], [2.7, 1]])
  return `<path d="${roofSide}" fill="#8a7a62"/><path d="${wallSide}" fill="#6e6250"/>` +
    `<path d="${wallFront}" fill="#d6b88a"/><path d="${roofFront}" fill="#e2c496"/>` +
    `<path d="${door}" fill="#ffcc80"/><g>${flick}${blob('r-warm', 1304, 676, 70, 50, 0.7)}</g><path d="${flaps}" fill="#c4a272"/>` +
    `<path d="${seams}" stroke="#5a4c3a" stroke-width="1.4" opacity="0.7"/>` +
    `<path d="M1306 586V572M1500 600V588" stroke="#2a1c12" stroke-width="3"/><path d="${ropes}" stroke="#a89878" stroke-width="1" opacity="0.6"/>` +
    // Lantern hanging from a post by the door.
    `<path d="M1226 712V624M1218 630h22" stroke="#24180e" stroke-width="4"/><path d="M1234 634v8" stroke="#24180e" stroke-width="1.4"/>` +
    `<path d="M1229 642h10v14h-10z" fill="#ffd590"/><path d="M1228 640h12v3h-12zM1228 655h12v3h-12z" fill="#24180e"/><g>${flick}${blob('r-warm', 1234, 650, 50, 50, 0.8)}</g>`
}

// The fire: a ring of stones lit on top, crossed logs, embers, flames that change
// shape every three ticks, sparks rising, smoke drifting off, and a coffee pot on
// an iron tripod.
function fire() {
  const [x, y] = FIRE
  const rng = mulberry32(71)
  const flame = (k) => {
    const r = mulberry32(80 + k)
    let outer = ''
    let inner = ''
    for (let i = 0; i < 5; i++) {
      const fx = x + (i - 2) * 9 + (r() - 0.5) * 6
      const h = 40 + r() * 40 - Math.abs(i - 2) * 10
      const lean = (r() - 0.5) * 14
      const tongue = (s) => `M${n0(fx - 9 * s)} ${y - 4}Q${n0(fx - 8 * s + lean * 0.3)} ${n0(y - 4 - h * s * 0.5)} ${n0(fx + lean * s)} ${n0(y - 4 - h * s)}Q${n0(fx + 8 * s + lean * 0.3)} ${n0(y - 4 - h * s * 0.5)} ${n0(fx + 9 * s)} ${y - 4}Z`
      outer += tongue(1)
      inner += tongue(0.55)
    }
    return `<path d="${outer}" fill="url(#r-flame)"/><path d="${inner}" fill="#fff2b8" opacity="0.9"/>`
  }
  let flames = ''
  for (let k = 0; k < 4; k++) {
    const steps = k ? [[0, 0], [k * 0.125, 1], [(k + 1) * 0.125, 0]] : [[0, 1], [0.125, 0]]
    flames += `<g opacity="${k ? 0 : 1}">${timeline('opacity', 0.5, k === 3 ? steps.slice(0, 2) : steps)}${flame(k)}</g>`
  }
  let sparks = ''
  for (let i = 0; i < 12; i++) {
    const dur = 2 + Math.round(rng() * 4) / 2
    const dx = (rng() - 0.5) * 60
    const h = 80 + rng() * 120
    const begin = -Math.round(rng() * dur * 24) / 24
    sparks += `<circle r="1.4" fill="#ffd37a">${ticked('transform', 'translate', dur, 1, (u) => `${n1(x + dx * u + Math.sin(u * 9) * 4)} ${n1(y - 30 - h * u)}`, begin)}${ticked('opacity', '', dur, 1, (u) => n2(1 - u), begin)}</circle>`
  }
  // Stones round the fire, an ellipse of them, each lit on its top.
  let stones = ''
  let stoneLit = ''
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2
    const sx = x + Math.cos(a) * 40
    const sy = y + 2 + Math.sin(a) * 11
    const r = 6 + rng() * 3
    stones += `M${n0(sx - r)} ${n0(sy)}q${n0(r * 0.2)} ${n0(-r * 1.1)} ${n0(r)} ${n0(-r)}q${n0(r * 0.9)} 0 ${n0(r)} ${n0(r)}q${n0(-r)} ${n0(r * 0.4)} ${n0(-r * 2)} 0z`
    if (Math.sin(a) < 0.2) stoneLit += `M${n0(sx - r * 0.5)} ${n0(sy - r * 0.75)}q${n0(r * 0.5)} ${n0(-r * 0.3)} ${n0(r)} 0`
  }
  const logs = `M${x - 30} ${y + 2}L${x + 28} ${y - 10}l3 7L${x - 28} ${y + 9}zM${x - 26} ${y - 8}L${x + 32} ${y + 4}l-3 7L${x - 28} ${y - 1}z`
  const tripod = `M${x - 34} ${y + 4}L${x} ${y - 100}L${x + 36} ${y + 6}M${x} ${y - 100}L${x + 6} ${y + 10}M${x} ${y - 100}V${y - 64}`
  const pot = `M${x - 9} ${y - 60}h18l2 18h-22zM${x - 6} ${y - 64}h12v4h-12zM${x + 11} ${y - 56}q8 2 6 10`
  return blob('r-fireGlow', x, y - 20, 380, 200, 0.85) +
    `<ellipse cx="${x}" cy="${y + 2}" rx="34" ry="8" fill="#ff7a2a" opacity="0.5"/>` +
    `<path d="${logs}" fill="#2a170c"/>` + flames +
    `<path d="${stones}" fill="#26221f"/><path d="${stoneLit}" fill="none" stroke="#c4703e" stroke-width="1.6" opacity="0.6" stroke-linecap="round"/>` +
    `<path d="${tripod}" fill="none" stroke="#1a1410" stroke-width="2.6"/><path d="${pot}" fill="#2c3036" stroke="#1a1d22" stroke-width="1"/><path d="M${x - 9} ${y - 58}v14" stroke="#e08a50" stroke-width="2" opacity="0.7"/>` +
    `<g>${stepDrift(-60, -30, 12)}${blob('r-smoke', x - 20, y - 160, 40, 22, 0.5)}${blob('r-smoke', x - 50, y - 210, 56, 26, 0.35, -20)}</g>` +
    sparks
}

// The cowboy on his log, side on, facing the fire to his left: a cattleman hat with a
// pinched crown, a full beard, a red bandana, a long coat falling over the log, a
// gun on his hip, jeans and boots. The firelight catches everything that faces it.
// Every so often he lifts the tin cup and drinks.
function cowboy() {
  const log = 'M-74 10C-78 2 -74 -4 -64 -4L110 -8C118 -8 122 6 112 10L-62 24C-72 24 -76 16 -74 10Z'
  const farLeg = 'M2 -6L-36 -16C-44 -16 -46 -4 -38 0L0 4ZM-44 -12H-32L-30 34H-44ZM-46 30H-30L-28 46H-62C-64 40 -56 36 -46 36Z'
  const coatTail = 'M8 -14C20 -10 26 0 30 12L38 36L8 38L2 10Z'
  const thigh = 'M12 -10L-44 -20C-54 -20 -56 -6 -48 -2L10 6Z'
  const shin = 'M-56 -14H-40L-40 34H-56Z'
  const boot = 'M-58 30H-40L-38 46H-78C-80 40 -72 36 -60 36ZM-42 46H-37V51H-44Z'
  const coat = 'M-14 -62C-8 -66 4 -66 10 -62C18 -50 18 -28 14 -6L-14 -4C-22 -24 -22 -46 -14 -62Z'
  const lapel = 'M-14 -62L-6 -40L-12 -26L-18 -40Z'
  const belt = 'M-16 -10L16 -8L16 -3L-15 -5Z'
  const holster = 'M6 -10L16 -8L20 20L9 22ZM6 -12L14 -22L19 -19L15 -10Z'
  const neck = 'M-6 -74L2 -74L4 -62L-8 -62Z'
  const bandana = 'M-14 -66Q-2 -59 10 -66L8 -60Q-2 -53 -12 -60ZM-12 -60L-16 -50L-6 -56Z'
  const face = 'M-2 -100C-12 -100 -17 -98 -18 -94L-19 -90Q-18 -88 -20 -86L-24 -81Q-23 -79 -20 -79L-19 -77L-10 -72L2 -74L4 -90C4 -96 2 -100 -2 -100Z'
  const hair = 'M2 -99C9 -96 11 -86 9 -74L2 -72L4 -90Z'
  const beard = 'M-20 -80C-23 -73 -18 -64 -9 -62C-1 -61 5 -67 4 -76L0 -78C-4 -74 -10 -74 -14 -78ZM-22 -80Q-16 -83 -11 -79Q-16 -77 -22 -80Z'
  const hat = 'M-38 -96C-26 -101 6 -102 28 -96C24 -93 18 -94 14 -95C0 -97 -22 -97 -38 -96ZM-20 -98L-18 -114C-12 -118 -6 -114 -2 -117C4 -119 10 -116 12 -112L12 -98Z'
  const band = 'M-19 -101L12 -101V-98H-20Z'
  // The near arm, resting on the knee with the cup, or raised to drink.
  const armRest = 'M-12 -60L-2 -54L-28 -16L-38 -22ZM-36 -26L-30 -16L-58 -26L-60 -34Z'
  const cupRest = 'M-70 -42h9l-1 13h-7z'
  const armDrink = 'M-12 -60L-2 -54L-26 -18L-36 -24ZM-36 -22L-28 -18L-20 -68L-28 -72Z'
  const cupDrink = 'M-31 -84l9 2l-1 12l-8 -2z'
  const litRest = 'M-38 -22L-60 -34L-58 -30L-36 -20Z'
  const lit = 'M-14 -62C-22 -46 -22 -24 -14 -6L-17 -6C-25 -24 -25 -46 -17 -60ZM-44 -20L12 -10L12 -8L-44 -17.5ZM-56 -14H-53V34H-56Z'
  const dur = 19
  const drinking = timeline('opacity', dur, [[0, 0], [8, 1], [10.5, 0]])
  const resting = timeline('opacity', dur, [[0, 1], [8, 0], [10.5, 1]])
  return `<g transform="translate(1238 744) scale(1.3)">` +
    `<ellipse cx="10" cy="24" rx="100" ry="8" fill="#050304" opacity="0.6"/>` +
    // Behind him: the saddle and rolled bedroll, the rifle leaning on the log.
    `<path d="M60 8Q70 -24 104 -18Q116 -4 112 10Z" fill="#5a3020"/><path d="M76 -20q12 -8 24 -2l-2 6q-12 -6 -20 2z" fill="#3a1e12"/>` +
    `<path d="M40 -6h40a8 8 0 0 1 0 16h-40a8 8 0 0 1 0 -16z" fill="#6a5a40"/><path d="M50 -6v16M70 -6v16" stroke="#3a2c1a" stroke-width="2"/>` +
    `<path d="M120 10L96 -60" stroke="#1a120c" stroke-width="3"/><path d="M118 4l8 -2l2 8z" fill="#3a2414"/>` +
    `<path d="${log}" fill="#3a2414"/><ellipse cx="-72" cy="10" rx="5" ry="12" fill="#9a6a3a"/><path d="M-72 4v12" stroke="#6a4424" stroke-width="1"/>` +
    `<path d="${farLeg}" fill="#1a1e28"/>` +
    `<path d="${coatTail}" fill="#2e2620"/>` +
    `<path d="${thigh}" fill="#2a3242"/><path d="${shin}" fill="#2a3242"/><path d="${boot}" fill="#24160c"/>` +
    `<path d="${coat}" fill="#352c24"/><path d="${lapel}" fill="#4a3e32"/><path d="${belt}" fill="#1c120a"/><path d="${holster}" fill="#5a361e"/>` +
    `<path d="${neck}" fill="#9a6448"/><path d="${bandana}" fill="#8a2a1e"/>` +
    `<path d="${face}" fill="#a86c4e"/><path d="M-18 -94L-19 -90Q-18 -88 -20 -86L-24 -81Q-23 -79 -20 -79L-22 -82Q-20 -86 -19 -90Z" fill="#e09a6a" opacity="0.8"/>` +
    `<path d="M-19 -97Q-6 -96 4 -95L4 -90Q-8 -92 -19 -92Z" fill="#2a1a10" opacity="0.55"/>` +
    `<path d="${hair}" fill="#3a2414"/><path d="${beard}" fill="#4a2e1a"/><ellipse cx="1" cy="-86" rx="2.2" ry="3.4" fill="#7a4a36"/>` +
    `<path d="M-16 -91q2 -1.6 5 -0.6" stroke="#2a1a10" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="-13.5" cy="-88.6" r="1.1" fill="#120a06"/>` +
    `<path d="${hat}" fill="#5a4630"/><path d="${band}" fill="#1c140e"/><path d="M-38 -96C-26 -100 -10 -101 0 -100" fill="none" stroke="#d08a54" stroke-width="1.4" opacity="0.8"/>` +
    `<path d="${lit}" fill="#d07a44" opacity="0.6"/>` +
    `<g>${resting}<path d="${armRest}" fill="#3c3229"/><path d="${litRest}" fill="#e0884e" opacity="0.7"/><circle cx="-62" cy="-31" r="4" fill="#b87a5a"/><path d="${cupRest}" fill="#9aa0a8"/><path d="M-61 -40q5 1 4 7" fill="none" stroke="#9aa0a8" stroke-width="1.4"/></g>` +
    `<g opacity="0">${drinking}<path d="${armDrink}" fill="#3c3229"/><circle cx="-24" cy="-72" r="4" fill="#b87a5a"/><path d="${cupDrink}" fill="#9aa0a8"/></g>` +
    `</g>`
}

// Grass across the foreground and a pine framing the left edge.
function foreground() {
  const rng = mulberry32(91)
  let grass = ''
  for (let i = 0; i < 90; i++) {
    const x = rng() < 0.45 ? rng() * 420 : 1150 + rng() * 470
    const base = 820 + rng() * 90
    const h = 20 + rng() * 44
    const lean = (rng() - 0.5) * 18
    grass += `M${n0(x - 2)} ${n0(base)}Q${n1(x + lean * 0.4)} ${n0(base - h * 0.6)} ${n1(x + lean)} ${n0(base - h)}Q${n1(x + lean * 0.3 + 1)} ${n0(base - h * 0.5)} ${n0(x + 2)} ${n0(base)}Z`
  }
  return `<path d="M-20 910V830Q120 806 260 832Q340 852 380 910ZM1240 910Q1310 846 1460 836Q1560 830 1620 846V910Z" fill="#080b12"/>` +
    `<path d="${grass}" fill="#0a0e15"/>` +
    `<g fill="#05070b">${use('p1', 30, 940, 5.6)}${use('p0', -40, 910, 4.2, true)}</g>`
}

// ---------------------------------------------------------------- the scene

export function buildScene() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <symbol id="p0" overflow="visible">${pine(1, 16, 0.24)}</symbol>
    <symbol id="p1" overflow="visible">${pine(2, 14, 0.28)}</symbol>
    <symbol id="p2" overflow="visible"><use href="#p0" transform="matrix(-1.15 0 0 .9 0 0)"/></symbol>
    <linearGradient id="r-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1230"/><stop offset="0.28" stop-color="#202a56"/><stop offset="0.42" stop-color="#5a5284"/><stop offset="0.5" stop-color="#b88290"/><stop offset="0.54" stop-color="#e8a688"/></linearGradient>
    <radialGradient id="r-moon"><stop offset="0" stop-color="#f4ecd8" stop-opacity="0.5"/><stop offset="1" stop-color="#f4ecd8" stop-opacity="0"/></radialGradient>
    <linearGradient id="r-shoot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="r-snowLit" gradientUnits="userSpaceOnUse" x1="0" y1="140" x2="0" y2="330"><stop offset="0" stop-color="#ffe0d8"/><stop offset="1" stop-color="#e0a8b8"/></linearGradient>
    <radialGradient id="r-glow"><stop offset="0" stop-color="#f0b07a" stop-opacity="0.55"/><stop offset="1" stop-color="#f0b07a" stop-opacity="0"/></radialGradient>
    <radialGradient id="r-glowW"><stop offset="0" stop-color="#f6c49a" stop-opacity="0.8"/><stop offset="1" stop-color="#f6c49a" stop-opacity="0"/></radialGradient>
    <linearGradient id="r-bankL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e2640"/><stop offset="1" stop-color="#0c1018"/></linearGradient>
    <linearGradient id="r-bankR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e2640"/><stop offset="0.55" stop-color="#2a2024"/><stop offset="1" stop-color="#120e0e"/></linearGradient>
    <linearGradient id="r-river" gradientUnits="userSpaceOnUse" x1="0" y1="${HZ}" x2="0" y2="900"><stop offset="0" stop-color="#e0a888"/><stop offset="0.12" stop-color="#7a6a96"/><stop offset="0.45" stop-color="#344068"/><stop offset="1" stop-color="#121a30"/></linearGradient>
    <linearGradient id="r-rockLit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a6080" stop-opacity="0.6"/><stop offset="0.5" stop-color="#5a6080" stop-opacity="0"/></linearGradient>
    <linearGradient id="r-bay" gradientUnits="userSpaceOnUse" x1="0" y1="-120" x2="0" y2="-40"><stop offset="0" stop-color="#6a4028"/><stop offset="0.6" stop-color="#4a2c1a"/><stop offset="1" stop-color="#24140c"/></linearGradient>
    <linearGradient id="r-bayN" gradientUnits="userSpaceOnUse" x1="40" y1="-160" x2="80" y2="-90"><stop offset="0" stop-color="#6a4028"/><stop offset="1" stop-color="#3a2214"/></linearGradient>
    <radialGradient id="r-fireRefl"><stop offset="0" stop-color="#ff9a4a" stop-opacity="0.5"/><stop offset="1" stop-color="#ff9a4a" stop-opacity="0"/></radialGradient>
    <radialGradient id="r-fireGlow"><stop offset="0" stop-color="#ff9a4a" stop-opacity="0.55"/><stop offset="0.4" stop-color="#ff7a3a" stop-opacity="0.2"/><stop offset="1" stop-color="#ff7a3a" stop-opacity="0"/></radialGradient>
    <linearGradient id="r-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd070"/><stop offset="0.45" stop-color="#ff8a30"/><stop offset="1" stop-color="#d03a14" stop-opacity="0.3"/></linearGradient>
    <radialGradient id="r-warm"><stop offset="0" stop-color="#ffcf84" stop-opacity="0.6"/><stop offset="1" stop-color="#ffcf84" stop-opacity="0"/></radialGradient>
    <radialGradient id="r-smoke"><stop offset="0" stop-color="#8a8aa0" stop-opacity="0.6"/><stop offset="1" stop-color="#8a8aa0" stop-opacity="0"/></radialGradient>
    <radialGradient id="r-vig" cx="0.5" cy="0.5" r="0.8"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>
    ${grain('r-grain', 7)}
    <linearGradient id="r-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a6a96" stop-opacity="0"/><stop offset="1" stop-color="#7a6a96" stop-opacity="0.55"/></linearGradient>
    <radialGradient id="r-steam"><stop offset="0" stop-color="#b8b4cc" stop-opacity="0.9"/><stop offset="1" stop-color="#b8b4cc" stop-opacity="0"/></radialGradient>
    <linearGradient id="r-lamp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe6a0" stop-opacity="0.7"/><stop offset="1" stop-color="#ffe6a0" stop-opacity="0"/></linearGradient>
    <radialGradient id="r-milk"><stop offset="0" stop-color="#9aa0d8" stop-opacity="0.35"/><stop offset="1" stop-color="#9aa0d8" stop-opacity="0"/></radialGradient>
    <radialGradient id="r-mist"><stop offset="0" stop-color="#9a94b8" stop-opacity="0.6"/><stop offset="1" stop-color="#9a94b8" stop-opacity="0"/></radialGradient>
    <radialGradient id="r-fly"><stop offset="0" stop-color="#f8f0a0" stop-opacity="0.7"/><stop offset="1" stop-color="#f8f0a0" stop-opacity="0"/></radialGradient>
  </defs>
  ${sky()}
  ${hawk()}
  ${mountains()}
  ${railway()}
  ${land()}
  ${river()}
  ${deer()}
  ${horse()}
  ${wagon()}
  ${tent()}
  ${fire()}
  ${dog()}
  ${cowboy()}
  ${fireflies()}
  ${foreground()}
  <rect width="${W}" height="${H}" fill="url(#r-grain)" opacity="0.35"/>
  <rect width="${W}" height="${H}" fill="url(#r-vig)"/>
</svg>`
}
