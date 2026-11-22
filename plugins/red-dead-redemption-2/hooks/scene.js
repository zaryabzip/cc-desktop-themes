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

// A bay horse grazing on the left bank, built in 3D: the body, neck, head, legs and
// tail are tubes along a skeleton in metres, seen through a camera from in front
// and to the left of it, so it has real depth and foreshortening. Each tube is
// drawn as its projected outline, then a lighter core shifted up for the rounded
// top and a cold rim of sky light. The neck is a chain from the withers to the poll
// that bends down to the grass and back up, in six poses swapped on the clock; the
// tail swishes. x runs forward, y to the horse's right (the near side is y < 0),
// z up.
const HC = { yaw: -22, D: 11, F: 1150, eye: 1.5, cx: 326, gy: 676 }
function hp(x, y, z) {
  const c = Math.cos((HC.yaw * Math.PI) / 180)
  const s = Math.sin((HC.yaw * Math.PI) / 180)
  const xr = x * c - y * s
  const d = HC.D + x * s + y * c
  return [HC.cx + (HC.F * xr) / d, HC.gy + (HC.F * (HC.eye - z)) / d - (HC.F * HC.eye) / HC.D, d]
}
// A tube along 3D points [x, y, z, r]: its projected outline with round ends, as a
// path; `lift` shifts it up by part of its radius and `k` scales the radius, for
// the lit core.
function htube(pts0, k = 1, lift = 0) {
  // Resample the skeleton along a Catmull-Rom curve, so joints bend smoothly.
  const pts3 = []
  for (let i = 0; i < pts0.length - 1; i++) {
    const p0 = pts0[Math.max(0, i - 1)]
    const p1 = pts0[i]
    const p2 = pts0[i + 1]
    const p3 = pts0[Math.min(pts0.length - 1, i + 2)]
    const steps = pts0.length > 6 ? 1 : pts0.length > 3 ? 2 : 3
    for (let j = 0; j < steps; j++) {
      const t = j / steps
      pts3.push(p1.map((_, c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t * t * t)))
    }
  }
  pts3.push(pts0[pts0.length - 1])
  const P = pts3.map(([x, y, z, r]) => {
    const [X, Y, d] = hp(x, y, z)
    const sr = (r * HC.F) / d
    return [X, Y - lift * sr, sr * k]
  })
  const n = P.length
  const L = []
  const R = []
  const T = []
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)]
    const b = P[Math.min(n - 1, i + 1)]
    let tx = b[0] - a[0]
    let ty = b[1] - a[1]
    const l = Math.hypot(tx, ty) || 1
    tx /= l
    ty /= l
    T.push([tx, ty])
    L.push([P[i][0] - ty * P[i][2], P[i][1] + tx * P[i][2]])
    R.push([P[i][0] + ty * P[i][2], P[i][1] - tx * P[i][2]])
  }
  const cap = (i, dir) => {
    const [x, y, sr] = P[i]
    const [tx, ty] = T[i]
    const out = []
    for (const a of [0.5, 0, -0.5]) {
      const ang = Math.atan2(ty * dir, tx * dir) + a * 1.4
      out.push([x + Math.cos(ang) * sr, y + Math.sin(ang) * sr])
    }
    return out
  }
  const ring = [...L, ...cap(n - 1, 1).reverse(), ...R.reverse(), ...cap(0, -1)]
  // A smooth closed outline: curves through the midpoints, the points as controls.
  const m = (i) => ring[(i + ring.length) % ring.length]
  const mid = (i) => [(m(i)[0] + m(i + 1)[0]) / 2, (m(i)[1] + m(i + 1)[1]) / 2]
  let d = `M${n0(mid(0)[0])} ${n0(mid(0)[1])}`
  for (let i = 1; i <= ring.length; i++) d += `Q${n0(m(i)[0])} ${n0(m(i)[1])} ${n0(mid(i)[0])} ${n0(mid(i)[1])}`
  return { d: d + 'Z', L, R: R.reverse(), P }
}
// A quadratic curve through 3D points, sampled.
const qb = (a, c, b, n, r0, r1) => Array.from({ length: n }, (_, i) => {
  const t = i / (n - 1)
  const u = 1 - t
  return [0, 1, 2].map((k) => u * u * a[k] + 2 * u * t * c[k] + t * t * b[k]).concat(r0 + (r1 - r0) * t)
})
function horse() {
  const COAT = '#3c2316'
  const LIT = '#64402a'
  const DARK = '#140b07'
  const FAR = '#24140c'
  const RIM = '#8a9ac0'
  const shade = (pts, base, lit = LIT) => {
    const t = htube(pts)
    return `<path d="${t.d}" fill="${base}"/><path d="${htube(pts, 0.62, 0.32).d}" fill="${lit}" opacity="0.75"/>`
  }
  // The legs, as side-view profiles in metres: the front edge from top to hoof,
  // then the back edge from top to heel. A fore leg: a muscled forearm, the bony
  // knee, a thin cannon, the fetlock, a sloped pastern, a flared hoof. A hind leg:
  // the gaskin's swell, the sharp point of the hock behind, then the same below.
  const smoothPath = (ring) => {
    const m = (i) => ring[(i + ring.length) % ring.length]
    const mid = (i) => [(m(i)[0] + m(i + 1)[0]) / 2, (m(i)[1] + m(i + 1)[1]) / 2]
    let d = `M${n0(mid(0)[0])} ${n0(mid(0)[1])}`
    for (let i = 1; i <= ring.length; i++) d += `Q${n0(m(i)[0])} ${n0(m(i)[1])} ${n0(mid(i)[0])} ${n0(mid(i)[1])}`
    return d + 'Z'
  }
  // The part of an edge below height z0, with the point where it crosses z0.
  const below = (edge, z0) => {
    const out = []
    for (let i = 0; i < edge.length; i++) {
      const [x, z] = edge[i]
      if (z <= z0) {
        if (i > 0 && edge[i - 1][1] > z0) {
          const [px, pz] = edge[i - 1]
          out.push([px + ((x - px) * (pz - z0)) / (pz - z), z0])
        }
        out.push([x, z])
      }
    }
    return out
  }
  // The body: rump, loin, barrel, girth and chest along a gently dipping back.
  const body = [[-0.86, 0, 1.36, 0.26], [-0.66, 0, 1.34, 0.33], [-0.34, 0, 1.28, 0.33], [0.0, 0, 1.22, 0.36], [0.34, 0, 1.24, 0.35], [0.62, 0, 1.3, 0.29]]
  // The tail, from its root over the rump, falling to the hocks.
  const [rx, ry] = hp(-0.86, -0.1, 1.54)
  const swish = timeline('', 7, [[0, `0 ${n0(rx)} ${n0(ry)}`], [2, `10 ${n0(rx)} ${n0(ry)}`], [2.25, `16 ${n0(rx)} ${n0(ry)}`], [2.5, `6 ${n0(rx)} ${n0(ry)}`], [2.75, `-6 ${n0(rx)} ${n0(ry)}`], [3, `0 ${n0(rx)} ${n0(ry)}`]], 'rotate')
  // The saddle, built on the barrel's surface: a point at length x along the body
  // and angle th (degrees) round from the top of the back down the near side.
  const surf = (x, th, out = 0) => {
    let k = 1
    while (k < body.length - 1 && body[k][0] < x) k++
    const [x0, , z0, r0] = body[k - 1]
    const [x1, , z1, r1] = body[k]
    const u = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)))
    const zc = z0 + (z1 - z0) * u
    const r = r0 + (r1 - r0) * u + out
    const t = (th * Math.PI) / 180
    return hp(x, -r * Math.sin(t), zc + r * Math.cos(t))
  }
  const poly = (ps) => smoothPath(ps)
  const sheet = (x0, x1, th0, th1, out, round = 0) => {
    const ps = []
    for (let i = 0; i <= 4; i++) ps.push(surf(x0 + ((x1 - x0) * i) / 4, th0, out))
    for (let j = 1; j <= 3; j++) ps.push(surf(x1 - round * (j === 3 ? 1 : 0), th0 + ((th1 - th0) * j) / 3, out))
    for (let i = 4; i >= 0; i--) ps.push(surf(x0 + ((x1 - x0) * i) / 4 + (i === 0 || i === 4 ? (i ? -round : round) : 0), th1, out))
    for (let j = 2; j >= 1; j--) ps.push(surf(x0 + round * (j === 2 ? 1 : 0), th0 + ((th1 - th0) * j) / 3, out))
    return ps
  }
  const strip = (x0, x1, th, out) => 'M' + [0, 1, 2, 3, 4].map((i) => surf(x0 + ((x1 - x0) * i) / 4, th, out)).map(([X, Y]) => `${n0(X)} ${n0(Y)}`).join('L')
  // The blanket: a wool pad, two cream stripes near its edge.
  const blanket = poly(sheet(-0.32, 0.42, -12, 74, 0.012, 0.02))
  const stripes = strip(-0.31, 0.41, 62, 0.014) + strip(-0.31, 0.41, 67, 0.014)
  // The skirt: a leather panel with rounded corners, tooled along its border.
  const skirt = poly(sheet(-0.26, 0.32, -8, 58, 0.03, 0.04))
  const tool = strip(-0.22, 0.28, 52, 0.032)
  // The seat: the cantle raised at the back, a dip, the swell and horn at the front.
  const seatTop = [[-0.24, 0.13], [-0.2, 0.1], [-0.1, 0.045], [0.04, 0.04], [0.16, 0.08], [0.24, 0.12]]
  const seat = [...seatTop.map(([x, dz]) => surf(x, 0, 0.03 + dz)), ...seatTop.slice().reverse().map(([x]) => surf(x, 34, 0.035))]
  const cantle = poly([surf(-0.27, -10, 0.05), surf(-0.25, -6, 0.17), surf(-0.19, 6, 0.13), surf(-0.18, 30, 0.05), surf(-0.26, 30, 0.04)])
  const [hbx, hby] = surf(0.25, 4, 0.12)
  const [htx, hty] = surf(0.27, 4, 0.22)
  // The fender and stirrup hanging from the seat; the cinch under the belly.
  const fender = poly([surf(-0.02, 30, 0.04), surf(0.08, 30, 0.04), surf(0.1, 70, 0.045), surf(0.11, 95, 0.05), surf(-0.03, 95, 0.05), surf(-0.04, 70, 0.045)])
  const [fx, fy] = surf(0.04, 104, 0.06)
  const stirrup = `M${n0(fx - 9)} ${n0(fy)}h18l-2 10h-14z`
  const cinch = 'M' + [surf(0.28, 56, 0.035), surf(0.28, 110, 0.02), surf(0.28, 150, 0.01)].map(([X, Y]) => `${n0(X)} ${n0(Y)}`).join('L')
  const ring = surf(0.28, 60, 0.04)
  // The bedroll tied across behind the cantle, its straps, and a saddlebag below.
  const roll = htube([[-0.36, -0.3, 1.64, 0.07], [-0.36, 0.28, 1.64, 0.07]])
  const bag = poly([surf(-0.42, 28, 0.04), surf(-0.3, 28, 0.04), surf(-0.29, 88, 0.05), surf(-0.33, 96, 0.05), surf(-0.41, 94, 0.05), surf(-0.44, 80, 0.045)])
  const bagFlap = poly([surf(-0.42, 28, 0.045), surf(-0.3, 28, 0.045), surf(-0.3, 52, 0.05), surf(-0.36, 58, 0.05), surf(-0.42, 52, 0.05)])
  const strapAt = (x) => { const [a1, b1] = hp(x, -0.37, 1.64); return `M${n0(a1)} ${n0(b1 - 10)}v20` }
  const SADDLE = `<path d="${blanket}" fill="#5a2a3a"/><path d="${stripes}" fill="none" stroke="#d8c8a0" stroke-width="2.6"/>` +
    `<path d="${bag}" fill="#4a2c18"/><path d="${bagFlap}" fill="#5a3620"/>` +
    `<path d="${skirt}" fill="#6a3e22"/><path d="${tool}" fill="none" stroke="#3a2010" stroke-width="1.4" stroke-dasharray="3 3"/>` +
    `<path d="${fender}" fill="#5a3418"/>` +
    `<path d="${roll.d}" fill="#6a6248"/><path d="${htube([[-0.36, -0.3, 1.64, 0.07], [-0.36, 0.28, 1.64, 0.07]], 0.5, 0.35).d}" fill="#8a8262"/><path d="${strapAt(-0.4)}${strapAt(-0.32)}" stroke="#2a180c" stroke-width="3"/>` +
    `<path d="${smoothPath(seat)}" fill="#7a4a28"/><path d="${cantle}" fill="#5a3418"/>` +
    `<path d="M${seatTop.map(([x, dz]) => surf(x, 0, 0.03 + dz)).map(([X, Y]) => `${n0(X)} ${n0(Y)}`).join('L')}" fill="none" stroke="#c89060" stroke-width="2" opacity="0.8"/>` +
    `<path d="M${n0(hbx)} ${n0(hby)}L${n0(htx)} ${n0(hty)}" stroke="#4a2a14" stroke-width="5" stroke-linecap="round"/><ellipse cx="${n0(htx)}" cy="${n0(hty)}" rx="6" ry="2.6" fill="#6a3e22"/>` +
    `<path d="${cinch}" fill="none" stroke="#3a2414" stroke-width="5"/><circle cx="${n0(ring[0])}" cy="${n0(ring[1])}" r="3.4" fill="none" stroke="#8a8a90" stroke-width="1.6"/>` +
    `<path d="${stirrup}" fill="#3a2414"/>`
  // The neck and head in a pose: g = 0 head up, 1 grazing.
  // The neck grows out of the whole front of the shoulder, from the withers to the
  // point of the shoulder, so the chest never shows in front of it.
  const B = [0.6, 0, 1.42]
  const pose = (g) => {
    const a = ((48 - 100 * g) * Math.PI) / 180
    const L = 0.98
    const poll = [B[0] + Math.cos(a) * L, 0, B[2] + Math.sin(a) * L]
    // The crest arches up, more when the head is up.
    const mid = [(B[0] + poll[0]) / 2, 0, (B[2] + poll[2]) / 2]
    const ctl = [mid[0] - Math.sin(a) * (0.16 - 0.06 * g), 0, mid[2] + Math.cos(a) * (0.16 - 0.06 * g)]
    const neck = qb(B, ctl, poll, 8, 0.3, 0.13)
    const h = ((-40 - 48 * g) * Math.PI) / 180
    const hl = 0.62
    const dir = [Math.cos(h), Math.sin(h)]
    const dors = [-Math.sin(h), Math.cos(h)]
    const at = (t, off, y = 0, r = 0) => [poll[0] + dir[0] * hl * t + dors[0] * off, y, poll[2] + dir[1] * hl * t + dors[1] * off, r]
    const head = [at(0, 0, 0, 0.115), at(0.3, -0.01, 0, 0.11), at(0.62, 0, 0, 0.08), at(0.86, -0.005, 0, 0.074), at(1, -0.01, 0, 0.082)]
    const cheek = [at(0.08, -0.07, 0, 0.12), at(0.26, -0.06, 0, 0.13), at(0.36, -0.03, 0, 0.09)]
    const nt = htube(neck)
    // The mane: a ragged band along the crest, on its upper edge.
    const crest = nt.R
    let mane = 'M' + crest.map(([x, y]) => `${n0(x)} ${n0(y)}`).join('L')
    for (let i = crest.length - 1; i >= 0; i--) {
      const [x, y] = crest[i]
      const [px, py, sr] = nt.P[i]
      const ox = (x - px) / (sr || 1)
      const oy = (y - py) / (sr || 1)
      const len = (i % 2 ? 5 : 9) + (1 - i / crest.length) * 2
      mane += `L${n0(x + ox * len * 0.4 - oy * 2)} ${n0(y + oy * len * 0.4 + ox * 2)}L${n0(x - ox * len * 0.6)} ${n0(y - oy * len * 0.6)}`
    }
    mane += 'Z'
    // Ears at the poll, eye, nostril, a white blaze down the face.
    const [px, py] = hp(...poll)
    const up = a + Math.PI / 2
    const ear = (dx) => `M${n0(px + dx)} ${n0(py)}l${n0(Math.cos(up + 0.5) * 14)} ${n0(-Math.sin(up + 0.5) * 14)}l${n0(Math.cos(up - 0.2) * 6)} ${n0(Math.sin(up - 0.2) * -6 + 8)}z`
    const [ex, ey] = hp(...at(0.2, 0.04, -0.09))
    const [mx, my] = hp(...at(0.93, -0.03, -0.06))
    const blaze = htube([at(0.1, 0.1, -0.03, 0.018), at(0.5, 0.07, -0.03, 0.022), at(0.92, 0.07, -0.03, 0.03)])
    return `<path d="${nt.d}" fill="${COAT}"/><path d="${htube(neck, 0.6, 0.3).d}" fill="${LIT}" opacity="0.75"/>` +
      `<path d="${htube(cheek).d}" fill="${COAT}"/><path d="${htube(head).d}" fill="${COAT}"/><path d="${htube(head, 0.55, 0.3).d}" fill="${LIT}" opacity="0.7"/>` +
      `<path d="${blaze.d}" fill="#e6dccc" opacity="0.9"/><ellipse cx="${n0(mx)}" cy="${n0(my)}" rx="2.6" ry="1.8" fill="#120a06"/>` +
      `<path d="${mane}" fill="#0e0806"/><path d="${ear(-4)}${ear(4)}" fill="#24140c"/><circle cx="${n1(ex)}" cy="${n1(ey)}" r="2.4" fill="#0a0604"/>` +
      `<path d="M${crest.slice(2).map(([x, y]) => `${n0(x)} ${n0(y)}`).join('L')}" fill="none" stroke="${RIM}" stroke-width="1.6" opacity="0.45"/>`
  }
  const G = [0, 0.25, 0.5, 0.75, 1]
  // Lowering over one second (a pose every 6 ticks), grazing, raising, standing.
  const step = 1 / 4
  const vis = (k) => k === 0 ? [[0, 1], [4, 0], [15, 1]] : k === 4 ? [[0, 0], [4 + 3 * step, 1], [14, 0]]
    : [[0, 0], [4 + (k - 1) * step, 1], [4 + k * step, 0], [14 + (3 - k) * step, 1], [14 + (4 - k) * step, 0]]
  const poses = G.map((g, k) => `<g opacity="${k ? 0 : 1}">${timeline('opacity', 23, vis(k))}${pose(g)}</g>`).join('')
  // The horse in one piece, as it stands side on: the outline of the body, with
  // the near legs growing out of it. The hindquarter is one mass: the croup rounds
  // over into the buttock, down the back of the thigh and the gaskin to the point
  // of the hock; in front the stifle and the flank run up into the belly. The
  // shoulder and chest carry down into the forearm and the knee. Below the knee and
  // the hock the legs are lean: cannon, fetlock, sloped pastern, hoof. [x, z] in
  // metres, the near side at y = -0.12.
  const SIL = [
    [0.44, 1.63], [0.2, 1.56], [-0.1, 1.55], [-0.38, 1.58], [-0.62, 1.62], [-0.8, 1.58], [-0.9, 1.5], [-0.96, 1.36],
    [-0.95, 1.18], [-0.89, 0.98], [-0.82, 0.8], [-0.82, 0.66], [-0.83, 0.56],
    [-0.79, 0.44], [-0.78, 0.26], [-0.8, 0.16], [-0.76, 0.05], [-0.74, 0.0], [-0.62, 0.0], [-0.66, 0.07], [-0.7, 0.17], [-0.71, 0.26], [-0.71, 0.5],
    [-0.69, 0.62], [-0.65, 0.78], [-0.57, 0.94], [-0.47, 1.02], [-0.25, 0.96], [0.05, 0.93], [0.28, 0.95],
    [0.35, 0.9], [0.37, 0.76], [0.39, 0.6], [0.4, 0.48], [0.41, 0.26], [0.39, 0.16], [0.44, 0.06], [0.45, 0.0], [0.58, 0.0], [0.55, 0.07], [0.51, 0.17], [0.49, 0.26], [0.49, 0.5],
    [0.51, 0.6], [0.52, 0.78], [0.58, 0.97], [0.67, 1.1], [0.73, 1.28], [0.72, 1.42], [0.6, 1.56],
  ]
  const near = (pts) => pts.map(([x, z]) => hp(x, -0.12, z))
  const sil = smoothPath(near(SIL))
  // The lower legs, darker below the knee and hock, and the hooves.
  const lowF = smoothPath(near([[0.4, 0.5], [0.41, 0.26], [0.39, 0.16], [0.44, 0.06], [0.45, 0.0], [0.58, 0.0], [0.55, 0.07], [0.51, 0.17], [0.49, 0.26], [0.49, 0.5]]))
  const lowH = smoothPath(near([[-0.8, 0.5], [-0.78, 0.26], [-0.8, 0.16], [-0.76, 0.05], [-0.74, 0.0], [-0.62, 0.0], [-0.66, 0.07], [-0.7, 0.17], [-0.71, 0.26], [-0.71, 0.5]]))
  const hooves = smoothPath(near([[0.44, 0.06], [0.45, 0.0], [0.58, 0.0], [0.55, 0.07]])) + smoothPath(near([[-0.76, 0.05], [-0.74, 0.0], [-0.62, 0.0], [-0.66, 0.07]]))
  // The far legs, behind the body: the far fore a step back, the far hind a step
  // forward, so the four legs read apart.
  const far = (pts, dx) => smoothPath(pts.map(([x, z]) => hp(x + dx, 0.16, z)))
  const farF = far([[0.36, 1.0], [0.37, 0.76], [0.39, 0.6], [0.4, 0.48], [0.41, 0.26], [0.39, 0.16], [0.44, 0.06], [0.45, 0.0], [0.58, 0.0], [0.55, 0.07], [0.51, 0.17], [0.49, 0.26], [0.49, 0.5], [0.51, 0.6], [0.52, 0.78], [0.54, 1.0]], -0.1)
  const farH = far([[-0.88, 1.0], [-0.82, 0.8], [-0.82, 0.66], [-0.83, 0.56], [-0.79, 0.44], [-0.78, 0.26], [-0.8, 0.16], [-0.76, 0.05], [-0.74, 0.0], [-0.62, 0.0], [-0.66, 0.07], [-0.7, 0.17], [-0.71, 0.26], [-0.71, 0.5], [-0.69, 0.62], [-0.65, 0.78], [-0.6, 1.0]], 0.12)
  // Light and shade: the round of the hindquarter and of the shoulder lit from the
  // sky, the belly and the inside of the thigh in shadow.
  const at = (x, z) => hp(x, -0.12, z)
  const [qx, qy] = at(-0.62, 1.3)
  const [sx2, sy2] = at(0.48, 1.3)
  const [bx2, by2] = at(-0.1, 1.38)
  const [ux, uy] = at(-0.1, 1.0)
  const [gx, gy2] = at(-0.62, 0.92)
  // Muscle lines: the edge of the hindquarter, the line of the shoulder.
  const lines = 'M' + [at(-0.45, 1.5), at(-0.42, 1.28), at(-0.5, 1.06), at(-0.58, 0.96)].map(([X, Y]) => `${n0(X)} ${n0(Y)}`).join('L') +
    'M' + [at(0.48, 1.58), at(0.4, 1.36), at(0.4, 1.12)].map(([X, Y]) => `${n0(X)} ${n0(Y)}`).join('L')
  const back = 'M' + SIL.slice(0, 8).map(([x, z]) => at(x, z)).map(([X, Y]) => `${n0(X)} ${n0(Y)}`).join('L')
  // The tail: falling from its root close down the back of the thigh, full in the
  // middle, tapering to the hocks, a few loose hairs.
  const TAIL = [[-0.84, 1.56], [-0.94, 1.5], [-1.0, 1.32], [-1.01, 1.08], [-0.99, 0.84], [-0.96, 0.62], [-0.92, 0.46], [-0.88, 0.56], [-0.9, 0.82], [-0.92, 1.1], [-0.92, 1.32], [-0.88, 1.46]]
  const tailD = smoothPath(TAIL.map(([x, z]) => hp(x, -0.1, z)))
  const hairs = 'M' + [hp(-0.96, -0.1, 1.3), hp(-0.98, -0.1, 0.9), hp(-0.95, -0.1, 0.55)].map(([X, Y]) => `${n0(X)} ${n0(Y)}`).join('L') +
    'M' + [hp(-0.93, -0.1, 1.2), hp(-0.94, -0.1, 0.8), hp(-0.9, -0.1, 0.5)].map(([X, Y]) => `${n0(X)} ${n0(Y)}`).join('L')
  return `<ellipse cx="${n0(HC.cx + 10)}" cy="${HC.gy + 2}" rx="150" ry="11" fill="#05070c" opacity="0.7"/>` +
    `<path d="${farF}${farH}" fill="${FAR}"/>` +
    `<path d="${sil}" fill="${COAT}"/>` +
    blob('r-hlit', qx, qy, 46, 40, 0.8) + blob('r-hlit', sx2, sy2, 34, 36, 0.6) + blob('r-hlit', bx2, by2, 60, 16, 0.5) +
    blob('r-hshade', ux, uy, 80, 18, 0.8) + blob('r-hshade', gx, gy2, 26, 30, 0.6) +
    `<path d="${lines}" fill="none" stroke="#24140c" stroke-width="2.4" opacity="0.5" stroke-linecap="round"/>` +
    `<path d="${lowF}${lowH}" fill="${DARK}"/><path d="${hooves}" fill="#070403"/>` +
    `<path d="${back}" fill="none" stroke="${RIM}" stroke-width="1.8" opacity="0.5"/>` +
    `<g>${swish}<path d="${tailD}" fill="#0e0806"/><path d="${hairs}" fill="none" stroke="#2a1810" stroke-width="1.4"/></g>` +
    SADDLE +
    poses
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
    sparks += `<circle r="1.4" fill="#ffd37a">${ticked('transform', 'translate', dur, 2, (u) => `${n1(x + dx * u + Math.sin(u * 9) * 4)} ${n1(y - 30 - h * u)}`, begin)}${ticked('opacity', '', dur, 2, (u) => n2(1 - u), begin)}</circle>`
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
    <radialGradient id="r-hlit"><stop offset="0" stop-color="#7a4e30" stop-opacity="0.9"/><stop offset="1" stop-color="#7a4e30" stop-opacity="0"/></radialGradient>
    <radialGradient id="r-hshade"><stop offset="0" stop-color="#160c06" stop-opacity="0.8"/><stop offset="1" stop-color="#160c06" stop-opacity="0"/></radialGradient>
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
