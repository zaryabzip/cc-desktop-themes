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

// ================================================================ Firewatch inspired
//
// A wilderness at sunset, in flat layered shapes, as an original scene. Ridge after
// ridge of pine forest falls away toward a low sun, each ridge paler and warmer than
// the one before it, with haze lying between them. A fire lookout tower stands on a
// near ridge, its cab lit, someone inside at the window. Far off on the right a
// wildfire sends up a column of smoke that leans in the wind. Birds cross the sky.
// Nothing is taken from the game: the tower and the land are drawn for this scene.

// A ridge: a smooth rolling line of hills, and on it stands of pine of uneven height,
// thinning to bare crests and open meadows in places. Each tree is a narrow spire
// with a few drooping tiers, so the edge reads as forest, not as a saw blade.
function forestEdge(keys, seed, hMin, hMax, gap) {
  const rng = mulberry32(seed)
  const base = ridge(keys, 0.06, seed, 3)
  const yAt = (x) => {
    for (let i = 1; i < base.length; i++) if (x <= base[i][0]) {
      const [x0, y0] = base[i - 1]
      const [x1, y1] = base[i]
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1)
    }
    return base[base.length - 1][1]
  }
  // Density: a slow wave, so trees gather in stands and leave clearings.
  const ph = rng() * 10
  const dens = (x) => 0.5 + 0.5 * Math.sin(x / 170 + ph) * Math.sin(x / 61 + ph * 2)
  let d = `M-20 ${n0(yAt(-20))}`
  for (let x = -20; x < W + 20; ) {
    const w = gap * (0.7 + rng() * 0.6)
    const y = yAt(x + w / 2)
    const k = dens(x)
    // Taller in the stands, low scrub in the clearings.
    const h = (hMin + rng() * (hMax - hMin)) * (k < 0.3 ? 0.25 : 0.5 + k * 0.7)
    const cx = x + w / 2
    const j = (v) => v * (0.85 + rng() * 0.3)
    d += `L${n0(cx - w * 0.5)} ${n0(y)}L${n0(cx - w * 0.3)} ${n0(y - h * j(0.3))}L${n0(cx - w * 0.38)} ${n0(y - h * j(0.32))}L${n0(cx - w * 0.16)} ${n0(y - h * j(0.62))}L${n0(cx - w * 0.24)} ${n0(y - h * j(0.62))}L${n0(cx)} ${n0(y - h)}` +
      `L${n0(cx + w * 0.24)} ${n0(y - h * j(0.62))}L${n0(cx + w * 0.16)} ${n0(y - h * j(0.62))}L${n0(cx + w * 0.38)} ${n0(y - h * j(0.32))}L${n0(cx + w * 0.3)} ${n0(y - h * j(0.3))}L${n0(cx + w * 0.5)} ${n0(y)}`
    x += w * (0.45 + rng() * 0.35)
  }
  return d + `L${W + 20} 900L-20 900Z`
}

// ---------------------------------------------------------------- the sky

function sky() {
  const rng = mulberry32(5)
  // Cloud banks: long soft streaks of cloud, each a few overlapping soft ellipses,
  // a darker body above and the sun-lit underside below.
  let wisps = ''
  let rims = ''
  for (let i = 0; i < 7; i++) {
    const x = 120 + rng() * 1360
    const y = 90 + rng() * 210
    const w = 200 + rng() * 280
    for (let k = 0; k < 4; k++) {
      const cx = x + (k - 1.5) * w * 0.22 + (rng() - 0.5) * 30
      wisps += blob('f-cloud', cx, y - 6 - rng() * 8, w * 0.22 + rng() * 30, 12 + rng() * 10, 0.9)
      rims += blob('f-rim', cx, y + 6, w * 0.2, 5 + rng() * 3, 0.8)
    }
  }
  return `<rect width="${W}" height="${H}" fill="url(#f-sky)"/>` +
    blob('f-sun', 1060, 440, 520, 320, 1) +
    `<circle cx="1060" cy="440" r="54" fill="#fff2c4"/>` +
    `<g>${stepPulse(0.6, 1, 20, 40)}<path d="M1060 440L380 -20L560 -20ZM1060 440L760 -20L900 -20ZM1060 440L1160 -20L1300 -20ZM1060 440L1560 -20L1700 60ZM1060 440L1700 300L1700 380Z" fill="url(#f-ray)" opacity="0.13"/></g>` +
    `<g>${stepDrift(70, 0, 100)}${wisps}${rims}</g>`
}

// ---------------------------------------------------------------- the land

// Six ridges, far to near; haze lies on the feet of each.
const RIDGES = [
  [[[0, 470], [300, 430], [600, 456], [900, 420], [1200, 448], [1600, 430]], 0, 0, '#f2a679'],
  [[[0, 520], [260, 486], [560, 506], [860, 480], [1200, 500], [1600, 474]], 10, 22, '#e3805f'],
  [[[0, 560], [300, 540], [640, 566], [980, 536], [1300, 556], [1600, 530]], 14, 30, '#c75d4e'],
  [[[0, 620], [340, 592], [700, 612], [1040, 588], [1360, 606], [1600, 590]], 18, 40, '#9c3f46'],
  [[[0, 690], [300, 652], [520, 630], [760, 664], [1100, 650], [1400, 676], [1600, 660]], 24, 52, '#6b2b40'],
  [[[0, 780], [260, 750], [600, 770], [900, 744], [1240, 772], [1600, 740]], 30, 70, '#3e1a30'],
]
// Mix two hex colours: t = 0 gives a, 1 gives b.
const mix = (a, b, t) => '#' + [1, 3, 5].map((k) => Math.round(parseInt(a.slice(k, k + 2), 16) * (1 - t) + parseInt(b.slice(k, k + 2), 16) * t).toString(16).padStart(2, '0')).join('')
function land() {
  let out = ''
  RIDGES.forEach(([keys, hMin, hMax, fill], i) => {
    const d = hMax ? forestEdge(keys, 30 + i, hMin, hMax, 12 + i * 4) : `M${pts(ridge(keys, 0.12, 30, 4))}L1600 900L0 900Z`
    // Each ridge is lit along its crest by the low sun and falls into shade below.
    const top = Math.min(...keys.map(([, y]) => y)) - hMax
    out += `<linearGradient id="f-r${i}" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${top + hMax + 120}"><stop offset="0" stop-color="${mix(fill, '#ffb07a', 0.35 - i * 0.04)}"/><stop offset="1" stop-color="${mix(fill, '#1a0814', 0.25)}"/></linearGradient>`
    fill = `url(#f-r${i})`
    // The tower stands among the near ridge's trees: drawn first, so they hide its feet.
    if (i === 4) out += tower()
    out += `<path d="${d}" fill="${fill}"/>`
    if (i === 1) out += smoke()
    if (i === 2) out += otherLookout()
    if (i === 3) out += lake()
    if (i === 2 || i === 3 || i === 4) out += groves(keys, i)
    if (i < 5) out += `<rect y="${keys[0][1] - 10}" width="${W}" height="80" fill="url(#f-haze${i % 2})" opacity="0.7"/>`
  })
  return out
}

// Groves of aspen gone gold, set among the pines along a ridge: clusters of small
// rounded crowns, darker below and lit on top, softened by the ridge's haze.
function groves(keys, i) {
  const rng = mulberry32(90 + i)
  const yAt = (x) => {
    for (let k = 1; k < keys.length; k++) if (x <= keys[k][0]) {
      const [x0, y0] = keys[k - 1]
      const [x1, y1] = keys[k]
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
    return keys[keys.length - 1][1]
  }
  const sites = { 2: [420, 1010], 3: [300, 980, 1480], 4: [760, 1260] }[i]
  const size = [0, 0, 0.6, 0.8, 1.05][i]
  const col = [[], [], ['#e8a05a', '#f2bc72'], ['#d28a44', '#eaa860'], ['#b06a34', '#d08c4a']][i]
  let dark = ''
  let lit = ''
  for (const cx of sites) {
    const n = 10 + Math.floor(rng() * 8)
    for (let k = 0; k < n; k++) {
      const x = cx + (rng() - 0.5) * 120 * size
      const y = yAt(x) + 14 + rng() * 14 * size
      const rx = (4 + rng() * 3) * size
      const ry = (14 + rng() * 10) * size
      dark += `M${n0(x - rx)} ${n0(y)}a${n1(rx)} ${n1(ry)} 0 1 1 ${n1(rx * 2)} 0z`
      lit += `M${n0(x - rx * 0.6)} ${n0(y - ry * 0.6)}a${n1(rx * 0.6)} ${n1(ry * 0.4)} 0 0 1 ${n1(rx * 1.2)} 0z`
    }
  }
  return `<path d="${dark}" fill="${col[0]}" opacity="0.85"/><path d="${lit}" fill="${col[1]}" opacity="0.8"/>`
}

// The other lookout, far off on the second ridge: a tiny tower whose window light
// blinks now and then, answering the radio.
const TALK = { dur: 14, near: [[0, 0], [1, 1], [1.25, 0], [1.5, 1], [1.75, 0], [2.25, 1], [2.5, 0]], far: [[0, 0], [5, 1], [5.25, 0], [5.5, 1], [6, 0], [6.5, 1], [6.75, 0], [7.25, 1], [7.5, 0]] }
function otherLookout() {
  const x = 1186
  const y = 548
  return `<g fill="#7a3048"><path d="M${x - 6} ${y}L${x - 3} ${y - 22}h6L${x + 6} ${y}z"/><path d="M${x - 6} ${y - 22}h12v-8h-12zM${x - 8} ${y - 30}L${x} ${y - 36}L${x + 8} ${y - 30}z"/></g>` +
    `<path d="M${x - 4} ${y - 28}h8v4h-8z" fill="#ffd890" opacity="0.5"/>` +
    `<g opacity="0">${timeline('opacity', TALK.dur, TALK.far)}<path d="M${x - 4} ${y - 28}h8v4h-8z" fill="#fff4c0"/>${blob('f-warm', x, y - 26, 22, 16, 1)}</g>`
}

// A long lake in the valley holding the sunset: the sky's colours, the sun's glitter
// in a broken column that shimmers, the far ridge's dark reflection along its shore.
function lake() {
  const shape = 'M690 630Q760 608 900 610Q1100 604 1280 612Q1370 620 1390 640Q1300 668 1100 670Q880 672 730 660Q680 646 690 630Z'
  const rng = mulberry32(81)
  const glitter = (k) => {
    let d = ''
    for (let i = 0; i < 14; i++) {
      const y = 618 + rng() * 28
      d += `M${n0(1060 - 30 + rng() * 60)} ${n0(y)}h${n0(6 + rng() * 22)}`
    }
    return `<path d="${d}" stroke="#ffe8b0" stroke-width="2" stroke-linecap="round" opacity="${k ? 0 : 0.9}">${timeline('opacity', 1, k ? [[0, 0], [0.5, 0.9]] : [[0, 0.9], [0.5, 0]])}</path>`
  }
  return `<path d="${shape}" fill="url(#f-lake)"/>` + glitter(0) + glitter(1)
}

// ---------------------------------------------------------------- the wildfire

// A column of smoke from a fire beyond the second ridge, rising, then leaning off to
// the left in the wind; billows climb it in steps. A red glow at its foot.
function smoke() {
  const x = 1330
  const y = 506
  const rng = mulberry32(51)
  let puffs = ''
  for (let i = 0; i < 16; i++) {
    const dur = 18
    const begin = -Math.round(((i * dur) / 16) * 24) / 24
    const path = (u) => {
      const h = u * 360
      const lean = Math.pow(u, 1.8) * -260
      return `${n1(x + lean)} ${n1(y - h)}`
    }
    const r = 32 + rng() * 16
    puffs += `<g>${ticked('transform', 'translate', dur, 12, path, begin)}<g>${ticked('transform', 'scale', dur, 12, (u) => n2(0.6 + u * 2.2), begin)}${ticked('opacity', '', dur, 12, (u) => n2(u < 0.1 ? u * 9 : 0.9 * (1 - u * 0.9)), begin)}<ellipse rx="${n0(r)}" ry="${n0(r * 0.7)}" fill="url(#f-smoke)"/></g></g>`
  }
  return blob('f-ember', x, y, 80, 30, 0.9) + puffs
}

// ---------------------------------------------------------------- the lookout

// A timber tower on four splayed legs with X bracing, stairs zigzagging up inside,
// and the cab on top: windows all round, lit warm, a figure at the glass, a pyramid
// roof and a lightning rod.
function tower() {
  const x = 520
  const base = 662
  const top = 452
  const half = (y) => 14 + ((y - top) / (base - top)) * 30
  let frame = `M${x - half(base)} ${base}L${x - half(top)} ${top}M${x + half(base)} ${base}L${x + half(top)} ${top}`
  const levels = [top, 470, 512, 556, 600, base]
  for (let i = 1; i < levels.length; i++) {
    const a = levels[i - 1]
    const b = levels[i]
    frame += `M${n1(x - half(a))} ${a}L${n1(x + half(b))} ${b}M${n1(x + half(a))} ${a}L${n1(x - half(b))} ${b}M${n1(x - half(b))} ${b}H${n1(x + half(b))}`
  }
  const cab = `M${x - 34} ${top}V${top - 46}H${x + 34}V${top}Z`
  const roof = `M${x - 44} ${top - 44}L${x} ${top - 80}L${x + 44} ${top - 44}Z`
  const wins = `M${x - 28} ${top - 38}h16v24h-16zM${x - 8} ${top - 38}h16v24h-16zM${x + 12} ${top - 38}h16v24h-16z`
  const person = `M${x + 2} ${top - 14}v-12a3 3 0 0 1 -1 -2a4 4 0 1 1 8 0a3 3 0 0 1 -1 2v12z`
  const lit = timeline('opacity', 9, [[0, 1], [5, 0.85], [5.25, 1]])
  return `<path d="${frame}" fill="none" stroke="#2a1224" stroke-width="3"/>` +
    `<path d="M${x - 50} ${top + 2}h100v4h-100z" fill="#2a1224"/>` +
    `<path d="${cab}" fill="#2a1224"/><g>${lit}<path d="${wins}" fill="#ffcf7a"/>${blob('f-warm', x, top - 26, 70, 40, 0.6)}</g>` +
    `<path d="${person}" fill="#2a1224"/>` +
    `<path d="${roof}" fill="#1e0c1a"/><path d="M${x - 1} ${top - 80}v-16h2v16z" fill="#1e0c1a"/>` +
    `<path d="M${x - 40} ${top + 4}V${top - 6}M${x + 40} ${top + 4}V${top - 6}M${x - 40} ${top - 4}H${x + 40}" stroke="#2a1224" stroke-width="2"/>`
}

// ---------------------------------------------------------------- birds

// A loose flock crossing from right to left, wings beating in two positions.
function birds() {
  const rng = mulberry32(61)
  const up = 'M-8 -3Q-4 -6 0 0Q4 -6 8 -3'
  const down = 'M-8 2Q-4 -1 0 0Q4 -1 8 2'
  let flock = ''
  for (let i = 0; i < 7; i++) {
    const dx = i * 34 + rng() * 20
    const dy = Math.abs(i - 3) * 12 + rng() * 10
    const phase = rng() * 0.5
    const beat = (k) => `<path d="${k ? down : up}" fill="none" stroke="#3a1a2c" stroke-width="2" stroke-linecap="round" opacity="${k ? 0 : 1}">${timeline('opacity', 0.5, k ? [[0, 0], [phase, 1], [phase + 0.25, 0]] : [[0, 1], [phase, 0], [phase + 0.25, 1]])}</path>`
    flock += `<g transform="translate(${n0(dx)} ${n0(dy)})">${beat(0)}${beat(1)}</g>`
  }
  const cross = ticked('transform', 'translate', 40, 2, (u) => `${n0(1700 - u * 2100)} ${n0(170 + Math.sin(u * Math.PI * 3) * 20)}`)
  return `<g>${cross}${flock}</g>`
}

// An eagle soaring nearer, on wide still wings, circling slowly and banking.
function eagle() {
  const wing = 'M0 0Q-14 -6 -30 -4Q-40 -2 -44 2Q-34 0 -26 4Q-14 2 -4 4ZM0 0Q14 -6 30 -4Q40 -2 44 2Q34 0 26 4Q14 2 4 4ZM-3 -1h6l2 8h-10zM-2 7l2 5l2 -5z'
  const fly = ticked('transform', 'translate', 30, 2, (u) => `${n0(330 + Math.cos(u * Math.PI * 2) * 180)} ${n0(150 + Math.sin(u * Math.PI * 2) * 50)}`)
  const bank = ticked('transform', 'rotate', 30, 2, (u) => n1(Math.cos(u * Math.PI * 2) * 12))
  return `<g>${fly}<g>${bank}<path d="${wing}" fill="#3a1a2c"/></g></g>`
}

// ---------------------------------------------------------------- the foreground

// Dark pines framing the left, a branch reaching in from the top right, a rocky
// outcrop across the bottom.
function foreground() {
  const rng = mulberry32(71)
  const rocks = 'M0 900V830Q120 800 240 820Q300 812 360 840Q440 860 500 900ZM1100 900Q1180 850 1300 846Q1420 830 1520 850Q1580 856 1600 860V900Z'
  // The hiker: seated on the rock, backpack beside him, facing the view, the radio
  // raised; its light blinks while he talks.
  const hx = 1340
  const hy = 848
  // The hiker, seen from behind, looking out over the valley: boots, trousers, a
  // jacket, a tall frame pack on his back with a bedroll on top, a cap; his left arm
  // raised with the radio at his ear. The low sun rims his left side.
  const S = 1.5
  const P = (dx, dy) => `${n1(hx + dx * S)} ${n1(hy + dy * S)}`
  const legs = `M${P(-9, 0)}L${P(-8, -34)}L${P(-1, -34)}L${P(-2, 0)}ZM${P(2, 0)}L${P(1, -34)}L${P(8, -34)}L${P(10, 0)}ZM${P(-11, 1)}L${P(-10, -4)}L${P(-1, -4)}L${P(-1, 1)}ZM${P(2, 1)}L${P(2, -4)}L${P(11, -4)}L${P(12, 1)}Z`
  const jacket = `M${P(-11, -32)}L${P(-12, -62)}Q${P(-11, -70)} ${P(-3, -71)}L${P(3, -71)}Q${P(11, -70)} ${P(12, -62)}L${P(11, -32)}Z`
  const armR = `M${P(11, -66)}L${P(14, -48)}L${P(13, -36)}`
  const armL = `M${P(-10, -66)}L${P(-17, -78)}L${P(-9, -86)}`
  const radio = `M${P(-11, -94)}h${n1(5 * S)}v${n1(11 * S)}h${n1(-5 * S)}zM${P(-9.5, -94)}v${n1(-6 * S)}`
  const head = `M${P(-6, -76)}a${n1(6 * S)} ${n1(7 * S)} 0 1 1 ${n1(12 * S)} 0a${n1(6 * S)} ${n1(4 * S)} 0 0 1 ${n1(-12 * S)} 0Z`
  const cap = `M${P(-7, -79)}Q${P(0, -88)} ${P(7, -79)}ZM${P(-2, -80)}l${n1(-9 * S)} ${n1(-1 * S)}l${n1(9 * S)} ${n1(3 * S)}Z`
  const pack = `M${P(-9, -36)}L${P(-10, -64)}Q${P(-9, -70)} ${P(-3, -70)}H${n1(hx + 3 * S)}Q${P(9, -70)} ${P(10, -64)}L${P(9, -36)}Z`
  const roll = `M${P(-11, -74)}h${n1(22 * S)}a${n1(3.5 * S)} ${n1(3.5 * S)} 0 0 1 0 ${n1(7 * S)}h${n1(-22 * S)}a${n1(3.5 * S)} ${n1(3.5 * S)} 0 0 1 0 ${n1(-7 * S)}z`
  const straps = `M${P(-6, -64)}V${n1(hy - 38 * S)}M${P(6, -64)}V${n1(hy - 38 * S)}M${P(-9, -50)}H${n1(hx + 9 * S)}`
  const rim = `M${P(-12, -34)}L${P(-12, -62)}Q${P(-11, -70)} ${P(-3, -71)}M${P(-9, -36)}L${P(-10, -64)}M${P(-11, -74)}h${n1(8 * S)}M${P(-6, -77)}q0 -6 5 -9M${P(-9, -2)}L${P(-8, -34)}`
  const hiker = `<path d="${legs}" fill="#1a0a16"/><path d="${jacket}" fill="#24101e"/>` +
    `<path d="${armR}" fill="none" stroke="#24101e" stroke-width="${n1(5.5 * S)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${pack}" fill="#3a1a28"/><path d="${straps}" stroke="#1a0a16" stroke-width="2" fill="none"/><path d="${roll}" fill="#5a2a38"/>` +
    `<path d="${head}" fill="#1a0a16"/><path d="${cap}" fill="#5a2a2a"/>` +
    `<path d="${armL}" fill="none" stroke="#24101e" stroke-width="${n1(5.5 * S)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${radio}" fill="#140812" stroke="#140812" stroke-width="1.6"/>` +
    `<path d="${rim}" fill="none" stroke="#ff9a6a" stroke-width="1.3" stroke-linecap="round" opacity="0.85"/>` +
    `<g opacity="0">${timeline('opacity', TALK.dur, TALK.near)}<circle cx="${n1(hx - 8.5 * S)}" cy="${n1(hy - 91 * S)}" r="1.8" fill="#9aff9a"/>${blob('f-warm', hx - 8.5 * S, hy - 91 * S, 8, 8, 0.8)}</g>`
  // The granite outcrop the hiker stands on: slabs with sun on their upper edges.
  const slabs = 'M1110 900L1150 864L1230 852L1300 846L1380 840L1450 848L1530 856L1600 862V900Z'
  const facets = 'M1150 864L1230 852L1250 900H1170ZM1300 846L1380 840L1400 900H1330ZM1450 848L1530 856L1520 900H1470Z'
  const edges = 'M1150 864L1230 852L1300 846L1380 840M1450 848L1530 856'
  // Fireweed: tall spikes of pink flowers in clumps on the slope.
  let stems = ''
  let blooms = ''
  for (const [cx, cy, n] of [[1210, 860, 5], [1460, 856, 4], [620, 860, 6], [860, 870, 5]]) {
    for (let k = 0; k < n; k++) {
      const x = cx + (rng() - 0.5) * 50
      const h = 34 + rng() * 30
      const y = cy + rng() * 12
      stems += `M${n0(x)} ${n0(y)}l${n1((rng() - 0.5) * 6)} ${-n0(h)}`
      for (let j = 0; j < 5; j++) blooms += `M${n0(x - 3 + (j % 2) * 3)} ${n0(y - h + j * 5)}h4v4h-4z`
    }
  }
  const sway = ticked('transform', 'skewX', 4, 6, (u) => n1(Math.sin(u * Math.PI * 2) * 2))
  const fireweed = `<g transform="translate(0 880)"><g>${sway}<g transform="translate(0 -880)"><path d="${stems}" stroke="#2a1224" stroke-width="1.6"/><path d="${blooms}" fill="#d84a7a"/></g></g></g>`
  return `<path d="${rocks}" fill="#140812"/>` + fireweed +
    `<path d="${slabs}" fill="#1e0e1a"/><path d="${facets}" fill="#160810"/><path d="${edges}" fill="none" stroke="#c86a5a" stroke-width="2" opacity="0.7"/>` +
    `<g fill="#140812">${use('p1', 70, 920, 6.4)}${use('p0', 190, 930, 4.6, true)}${use('p2', -30, 910, 5.2)}${use('p0', 1560, 940, 4.2)}</g>` +
    hiker
}

// ---------------------------------------------------------------- the scene

export function buildScene() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <symbol id="p0" overflow="visible">${pine(1, 16, 0.24)}</symbol>
    <symbol id="p1" overflow="visible">${pine(2, 14, 0.28)}</symbol>
    <symbol id="p2" overflow="visible"><use href="#p0" transform="matrix(-1.15 0 0 .9 0 0)"/></symbol>
    <linearGradient id="f-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a2a5c"/><stop offset="0.25" stop-color="#b44a5a"/><stop offset="0.42" stop-color="#ef7d58"/><stop offset="0.52" stop-color="#ffc27a"/></linearGradient>
    <radialGradient id="f-sun"><stop offset="0" stop-color="#ffe6a6" stop-opacity="0.9"/><stop offset="0.35" stop-color="#ffb070" stop-opacity="0.4"/><stop offset="1" stop-color="#ff9060" stop-opacity="0"/></radialGradient>
    <linearGradient id="f-haze0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc08a" stop-opacity="0"/><stop offset="0.6" stop-color="#ffc08a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffc08a" stop-opacity="0"/></linearGradient>
    <linearGradient id="f-haze1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f29070" stop-opacity="0"/><stop offset="0.6" stop-color="#f29070" stop-opacity="0.5"/><stop offset="1" stop-color="#f29070" stop-opacity="0"/></linearGradient>
    <radialGradient id="f-smoke"><stop offset="0" stop-color="#b07a7a" stop-opacity="0.8"/><stop offset="1" stop-color="#b07a7a" stop-opacity="0"/></radialGradient>
    <radialGradient id="f-ember"><stop offset="0" stop-color="#ff5a2a" stop-opacity="0.8"/><stop offset="1" stop-color="#ff5a2a" stop-opacity="0"/></radialGradient>
    ${grain('f-grain', 11)}
    <radialGradient id="f-ray" gradientUnits="userSpaceOnUse" cx="1060" cy="440" r="900"><stop offset="0" stop-color="#ffe6a6" stop-opacity="0.8"/><stop offset="1" stop-color="#ffe6a6" stop-opacity="0"/></radialGradient>
    <linearGradient id="f-lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2a679"/><stop offset="1" stop-color="#b44a5a"/></linearGradient>
    <pattern id="f-bark" width="10" height="14" patternUnits="userSpaceOnUse"><path d="M2 3h4M5 9h3" stroke="#5a3a3a" stroke-width="1.2"/></pattern>
    <radialGradient id="f-cloud"><stop offset="0" stop-color="#7a3456" stop-opacity="0.85"/><stop offset="0.6" stop-color="#8e3e5e" stop-opacity="0.5"/><stop offset="1" stop-color="#8e3e5e" stop-opacity="0"/></radialGradient>
    <radialGradient id="f-rim"><stop offset="0" stop-color="#ffc49a" stop-opacity="0.9"/><stop offset="1" stop-color="#ffc49a" stop-opacity="0"/></radialGradient>
    <radialGradient id="f-warm"><stop offset="0" stop-color="#ffcf7a" stop-opacity="0.6"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
  </defs>
  ${sky()}
  ${birds()}
  ${eagle()}
  ${land()}
  ${foreground()}
  <rect width="${W}" height="${H}" fill="url(#f-grain)" opacity="0.3"/>
</svg>`
}
