// Outlast inspired: a remote asylum on a mountain at night, in a rainstorm, seen from
// the mud road at its gate through a camcorder's viewfinder. An original scene: the
// building, the signs, the jeep and the figures are drawn for it, the asylum has no
// name, and the camcorder overlay is a generic one.
//
// A long Victorian institution stands on a rise behind a chain-link fence: a clock
// tower over the centre, mansard-roofed wings, end pavilions, barred windows, a few
// of them lit. A guard tower's searchlight sweeps the grounds. At the half-open gate
// an abandoned jeep still has its headlights on. Rain falls; now and then lightning
// lights the sky. About once a minute the camera switches to night vision: the
// world goes green and grainy, and things that were not there show at the fence and
// in a dark window.
//
// Cost: no filters. Every animation steps on one shared clock (24 ticks a second;
// slow drifts every half second), so changes from all parts land on the same frames
// and the browser never draws more than 24 frames a second. All motion is SMIL and
// every colour a presentation attribute: the desktop app draws the scene in a
// script-less frame.

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
  const start = begin ? ` begin="${n2(onTick(begin, step / FPS))}s"` : ''
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

// The night-vision cycle, shared by everything that takes part: 60 s, the camera
// switches over at 40 s and back at 55 s, with a burst of static at each switch.
const NV = { dur: 60, on: 40, off: 55 }
const nvIn = (peak = 1) => timeline('opacity', NV.dur, [[0, 0], [NV.on, peak], [NV.off, 0]])
const nvOut = () => timeline('opacity', NV.dur, [[0, 1], [NV.on, 0], [NV.off, 1]])
const nvGlitch = () => timeline('opacity', NV.dur, [[0, 0], [NV.on - 3 * TICK, 1], [NV.on + 3 * TICK, 0], [NV.off - 3 * TICK, 1], [NV.off + 3 * TICK, 0]])

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

// A barred window of the asylum, 12 x 22, centred on (0, 0): an arched opening, and
// the bars across it. Dark, or lit a sick yellow.
const windowShape = (fill) =>
  `<path d="M-6 11V-5a6 6 0 0 1 12 0V11Z" fill="${fill}"/><path d="M-2 -10V11M2 -10V11M-6 2H6" stroke="#2a2e35" stroke-width="1.2"/>` +
  `<path d="M-8.5 -4a8.5 8.5 0 0 1 17 0" fill="none" stroke="#363c46" stroke-width="2.2"/><path d="M-1.6 -15h3.2v4h-3.2z" fill="#3c424c"/><path d="M-8 12H8" stroke="#3a404a" stroke-width="2.4"/>`

// A tuft of tall wet grass, unit height 30.
function grassShape(seed) {
  const rng = mulberry32(seed)
  let d = ''
  for (let i = 0; i < 9; i++) {
    const x = (rng() - 0.5) * 24
    const h = 14 + rng() * 18
    const lean = (rng() - 0.5) * 14
    d += `M${n1(x - 1.2)} 0Q${n1(x + lean * 0.4)} ${n1(-h * 0.6)} ${n1(x + lean)} ${n1(-h)}Q${n1(x + lean * 0.3)} ${n1(-h * 0.5)} ${n1(x + 1.2)} 0Z`
  }
  return `<path d="${d}"/>`
}

// An inmate in a hospital gown, about 44 units tall, feet at (0, 0), facing right:
// four poses of a running stride. `wild` raises the arms over the head.
function inmatePose(k, wild) {
  // Leg and arm swing for this pose: +1 front, -1 back, 0 passing.
  const sw = [1, 0, -1, 0][k]
  const lift = [0, 3, 0, 3][k]
  const hip = [0, -24 - lift]
  const foot = (s) => [s * 11, -lift * (s > 0 ? 0 : 1) - (sw === 0 && s < 0 ? 6 : 0)]
  const legA = foot(sw || 0.3)
  const legB = foot(-(sw || 0.3))
  const knee = (f) => [(hip[0] + f[0]) / 2 + 3, (hip[1] + f[1]) / 2 - 1]
  // The body leans into the run; a wild one throws its arms out and up, bent.
  const sh = [7, -36 - lift]
  const arm = (s) => (wild ? [sh[0] + s * 10, sh[1] - 4 - (s > 0 ? 4 : 0)] : [sh[0] - s * 9, sh[1] + 12])
  const hand = (s) => (wild ? [sh[0] + s * 13 + 4, sh[1] - 15 + (s > 0 ? -3 : 4)] : [sh[0] - s * 13 + 4, sh[1] + 6])
  const P = (a) => a.map(n1).join(' ')
  const limbs = `M${P(hip)}L${P(knee(legA))}L${P(legA)}M${P(hip)}L${P(knee(legB))}L${P(legB)}` +
    `M${P(sh)}L${P(arm(sw || 0.4))}L${P(hand(sw || 0.4))}M${P(sh)}L${P(arm(-(sw || 0.4)))}L${P(hand(-(sw || 0.4)))}`
  const gown = `M${n1(sh[0] - 6)} ${n1(sh[1] + 1)}L${n1(sh[0] + 6)} ${n1(sh[1] + 1)}L${n1(hip[0] + 8)} ${n1(hip[1] + 8)}L${n1(hip[0] - 7)} ${n1(hip[1] + 9)}Z`
  return `<path d="${limbs}" fill="none" stroke="#5d6269" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${gown}" fill="#7c8187"/><circle cx="${n1(sh[0] + 3)}" cy="${n1(sh[1] - 5)}" r="4.6" fill="#6d6f70"/>`
}

function symbols() {
  let out = ''
  for (let k = 0; k < 4; k++) {
    out += `<symbol id="i${k}" overflow="visible">${inmatePose(k, false)}</symbol>`
    out += `<symbol id="j${k}" overflow="visible">${inmatePose(k, true)}</symbol>`
  }
  out += `<symbol id="p0" overflow="visible">${pine(1, 16, 0.24)}</symbol>`
  out += `<symbol id="p1" overflow="visible">${pine(2, 14, 0.28)}</symbol>`
  out += `<symbol id="p2" overflow="visible"><use href="#p0" transform="matrix(-1.15 0 0 .9 0 0)"/></symbol>`
  out += `<symbol id="w0" overflow="visible">${windowShape('#07090c')}</symbol>`
  out += `<symbol id="w1" overflow="visible">${windowShape('url(#o-lit)')}</symbol>`
  // Boarded: planks nailed across; broken: a jagged hole in the pane.
  out += `<symbol id="w2" overflow="visible">${windowShape('#07090c')}<path d="M-8 -6L8 -1L8 3L-8 -2ZM-8 4L8 8L8 11L-8 8Z" fill="#3a3128"/></symbol>`
  out += `<symbol id="w3" overflow="visible">${windowShape('#141a22')}<path d="M-5 -6L-1 -2L-4 3L1 1L0 8L4 -1L5 -7Z" fill="#020304"/></symbol>`
  // A rain stain running down from a sill.
  out += `<symbol id="st" overflow="visible"><path d="M-6 12H6L4 26L1 40L-1 30L-3 44L-5 24Z" fill="url(#o-stain)"/></symbol>`
  for (let i = 0; i < 3; i++) out += `<symbol id="g${i}" overflow="visible">${grassShape(60 + i)}</symbol>`
  return out
}

// ---------------------------------------------------------------- the sky

// A black storm sky, a little paler toward the horizon; heavy cloud with paler
// undersides where the hidden moon catches them; two far ridges.
function sky() {
  const rng = mulberry32(8)
  let dark = ''
  let pale = ''
  for (let i = 0; i < 22; i++) dark += blob('o-cd', rng() * W, rng() * 380, 160 + rng() * 260, 30 + rng() * 50, 0.5 + rng() * 0.4, -8 + rng() * 16)
  for (let i = 0; i < 16; i++) pale += blob('o-cl', 150 + rng() * 800, 60 + rng() * 300, 120 + rng() * 200, 14 + rng() * 22, 0.25 + rng() * 0.35, -6 + rng() * 12)
  let drift = ''
  for (let i = 0; i < 6; i++) drift += blob('o-cd', rng() * W, 80 + rng() * 260, 180 + rng() * 200, 30 + rng() * 30, 0.5 + rng() * 0.3)
  const farR = ridge([[0, 430], [180, 392], [380, 410], [560, 376], [760, 404], [980, 380], [1200, 398], [1420, 372], [1600, 396]], 0.18, 3)
  const nearR = ridge([[0, 500], [200, 468], [420, 484], [640, 470], [900, 486], [1160, 466], [1400, 482], [1600, 470]], 0.2, 5)
  return `<rect width="${W}" height="${H}" fill="url(#o-sky)"/>` +
    blob('o-moon', 380, 150, 260, 160, 0.6) +
    pale + dark +
    `<g>${stepDrift(80, 0, 90)}${drift}</g>` +
    lightningSky() +
    `<path d="M${pts(farR)}L1600 620L0 620Z" fill="#121822"/>` +
    `<path d="M${pts(nearR)}L1600 620L0 620Z" fill="#0d1219"/>`
}

// Lightning: two strikes on their own cycles. The sky behind the ridges flashes
// pale, twice in quick succession, and a forked bolt shows for the first flash.
function lightningSky() {
  const strike = (dur, t0, x, seed) => {
    const rng = mulberry32(seed)
    let d = `M${x} 0`
    let px = x
    let fork = ''
    for (let y = 30; y < 380; y += 22 + rng() * 26) {
      px += (rng() - 0.5) * 50
      d += `L${n0(px)} ${n0(y)}`
      if (!fork && y > 150) fork = `M${n0(px)} ${n0(y)}l${n0(30 + rng() * 30)} 40l-10 40l24 50`
    }
    const flash = [[0, 0], [t0, 0.55], [t0 + 2 * TICK, 0.1], [t0 + 4 * TICK, 0.4], [t0 + 7 * TICK, 0]]
    const bolt = [[0, 0], [t0, 1], [t0 + 3 * TICK, 0]]
    return `<rect width="${W}" height="520" fill="url(#o-flash)" opacity="0">${timeline('opacity', dur, flash)}</rect>` +
      `<path d="${d}${fork}" fill="none" stroke="#e6ecff" stroke-width="2.4" opacity="0">${timeline('opacity', dur, bolt)}</path>`
  }
  return strike(23, 9, 300, 11) + strike(37, 21, 1180, 12)
}
// The same strikes light the whole scene a little.
const lightningAll = () =>
  `<rect width="${W}" height="${H}" fill="#a8b8d8" opacity="0">${timeline('opacity', 23, [[0, 0], [9, 0.14], [9 + 2 * TICK, 0.03], [9 + 4 * TICK, 0.1], [9 + 7 * TICK, 0]])}</rect>` +
  `<rect width="${W}" height="${H}" fill="#a8b8d8" opacity="0">${timeline('opacity', 37, [[0, 0], [21, 0.14], [21 + 2 * TICK, 0.03], [21 + 4 * TICK, 0.1], [21 + 7 * TICK, 0]])}</rect>`

// ---------------------------------------------------------------- the asylum

// The asylum on its rise: a long symmetrical Victorian institution. A centre block
// with a clock tower and a lit doorway; inner wings under mansard roofs with
// dormers and chimneys; end pavilions with steep pyramid roofs and iron cresting;
// low outer wings. Rows of barred windows, a few lit, one flickering; a figure
// passes behind one of them now and then.
const BASE = 522
function asylum() {
  const wall = []
  const roof = []
  const trim = []
  const rim = []
  const dent = []
  const iron = []
  let halos = ''
  let wins = ''
  let lit = ''
  const R = (list, x, y, w, h) => list.push(`M${n1(x)} ${n1(y)}h${n1(w)}v${n1(h)}h${n1(-w)}z`)
  const litAt = new Set(['c1-2', 'w2-5', 'e1-9', 'e2-3', 'p0-1', 'w1-11'])
  // A row of windows across a span.
  const wr = mulberry32(19)
  const darkAt = []
  let stains = ''
  const row = (key, x0, x1, y, step = 26) => {
    let i = 0
    for (let x = x0; x <= x1; x += step, i++) {
      const id = `${key}-${i}`
      const r = wr()
      if (litAt.has(id)) {
        lit += `<use href="#w1" x="${n0(x)}" y="${n0(y)}"/>`
        halos += blob('o-lamp', x, y, 24, 28, 0.4)
      }
      else {
        const kind = r < 0.08 ? 2 : r < 0.14 ? 3 : 0
        wins += `<use href="#w${kind}" x="${n0(x)}" y="${n0(y)}"/>`
        if (kind === 0) darkAt.push([x, y])
      }
      if (wr() < 0.45) stains += `<use href="#st" x="${n0(x)}" y="${n0(y)}"/>`
    }
  }
  // A mansard roof over a span: a steep lower slope, a flat top, dormers, a rim of
  // pale light along its edge from the sky behind.
  const mansard = (x0, x1, eave, top, dormers = true) => {
    roof.push(`M${x0 - 4} ${eave}L${x0 + 10} ${top}H${x1 - 10}L${x1 + 4} ${eave}Z`)
    R(trim, x0 - 6, eave - 2, x1 - x0 + 12, 5)
    R(dent, x0 - 2, eave + 3, x1 - x0 + 4, 6)
    rim.push(`M${x0 + 10} ${top}H${x1 - 10}`)
    if (dormers) for (let x = x0 + 26; x < x1 - 16; x += 34) {
      const y = eave - 6
      roof.push(`M${x - 8} ${y}V${y - 14}L${x} ${y - 24}L${x + 8} ${y - 14}V${y}Z`)
      wins += `<path d="M${x - 4} ${y - 2}V${y - 12}h8v10z" fill="#07090c"/>`
      rim.push(`M${x - 8} ${y - 14}L${x} ${y - 24}L${x + 8} ${y - 14}`)
    }
  }
  const chimney = (x, y, h) => {
    R(wall, x, y - h, 12, h)
    R(trim, x - 2, y - h - 4, 16, 5)
  }
  // A steep pyramid roof with iron cresting along its ridge and a finial.
  const pyramid = (x0, x1, eave, peak) => {
    const cx = (x0 + x1) / 2
    roof.push(`M${x0 - 6} ${eave}L${cx - 6} ${peak}H${cx + 6}L${x1 + 6} ${eave}Z`)
    R(trim, x0 - 8, eave - 2, x1 - x0 + 16, 5)
    R(dent, x0 - 4, eave + 3, x1 - x0 + 8, 6)
    // A round window in the roof.
    wins += `<circle cx="${cx}" cy="${eave - 34}" r="6" fill="#07090c" stroke="#363c46" stroke-width="2"/>`
    rim.push(`M${x0 - 6} ${eave}L${cx - 6} ${peak}H${cx + 6}`)
    let crest = ''
    for (let x = cx - 6; x <= cx + 6; x += 3) crest += `M${x} ${peak}v-6`
    trim.push(`M${cx - 1} ${peak - 22}h2v22h-2z`)
    return crest
  }
  let crest = ''
  const quoins = (x, top) => {
    for (let y = top + 4, k = 0; y < BASE - 6; y += 12, k++) R(trim, x - (k % 2 ? 4 : 6), y, k % 2 ? 8 : 12, 8)
  }

  // Outer low wings.
  R(wall, 470, 372, 92, BASE - 372)
  R(wall, 1438, 372, 92, BASE - 372)
  mansard(470, 562, 372, 350, false)
  mansard(1438, 1530, 372, 350, false)
  row('ow', 486, 550, 410, 22)
  row('ow2', 486, 550, 470, 22)
  row('oe', 1452, 1516, 410, 22)
  row('oe2', 1452, 1516, 470, 22)
  // End pavilions.
  for (const [x0, key] of [[560, 'p0'], [1360, 'p1']]) {
    R(wall, x0, 312, 80, BASE - 312)
    crest += pyramid(x0, x0 + 80, 312, 238)
    row(key, x0 + 14, x0 + 66, 350, 26)
    row(key + 'b', x0 + 14, x0 + 66, 410, 26)
    row(key + 'c', x0 + 14, x0 + 66, 470, 26)
    R(trim, x0 - 2, 382, 84, 3)
    R(trim, x0 - 2, 442, 84, 3)
  }
  // Inner wings.
  for (const [x0, x1, key] of [[640, 880, 'w'], [1120, 1360, 'e']]) {
    R(wall, x0, 330, x1 - x0, BASE - 330)
    mansard(x0, x1, 330, 300)
    row(key + '1', x0 + 14, x1 - 10, 366, 22)
    row(key + '2', x0 + 14, x1 - 10, 422, 22)
    row(key + '3', x0 + 14, x1 - 10, 478, 22)
    R(trim, x0, 392, x1 - x0, 3)
    R(trim, x0, 448, x1 - x0, 3)
    chimney(x0 + 40, 306, 26)
    chimney(x1 - 52, 306, 22)
  }
  for (const [x, top] of [[470, 372], [1530, 372], [560, 312], [640, 312], [1360, 312], [1440, 312], [880, 290], [1120, 290]]) quoins(x, top)
  // An iron fire escape down the west wing's east end: landings, rails, stairs.
  for (const [y, k] of [[384, 0], [440, 1], [496, 2]]) {
    iron.push(`M818 ${y}H864M818 ${y - 9}H864`)
    for (let x = 818; x <= 864; x += 6) iron.push(`M${x} ${y}v-9`)
    if (k < 2) iron.push(k % 2 ? `M822 ${y}L858 ${y + 56}` : `M860 ${y}L824 ${y + 56}`)
  }
  iron.push('M830 496L846 522')
  // Drainpipes down the corners, with their brackets.
  for (const x of [646, 874, 1126, 1354]) {
    iron.push(`M${x} ${x < 900 || x > 1300 ? 334 : 334}V${BASE}`)
    for (let y = 350; y < BASE; y += 40) iron.push(`M${x - 3} ${y}h6`)
  }
  // The centre block, its clock tower and its door.
  R(wall, 880, 290, 240, BASE - 290)
  mansard(880, 1120, 290, 252)
  row('c1', 896, 1104, 330, 26)
  row('c2', 896, 1104, 392, 26)
  R(trim, 880, 356, 240, 4)
  R(trim, 880, 418, 240, 4)
  R(wall, 958, 140, 84, 120)
  R(trim, 952, 134, 96, 7)
  R(trim, 952, 254, 96, 6)
  roof.push('M950 136L1000 40L1050 136Z')
  rim.push('M950 136L1000 40')
  trim.push('M999 18h2v24h-2z')
  // Corner pinnacles, and a weathervane on the spire.
  roof.push('M946 136L952 108L958 136ZM1042 136L1048 108L1054 136Z')
  iron.push('M988 24H1012M1012 24l-5 -4M1012 24l-5 4M988 24l-4 -5M988 24l-4 5M1000 14v10')
  dent.push('M952 260h96v6h-96z')
  // The belfry openings and the clock face.
  wins += '<path d="M968 230v-26a8 8 0 0 1 16 0v26zM1016 230v-26a8 8 0 0 1 16 0v26z" fill="#07090c"/><path d="M968 210h16M968 216h16M968 222h16M1016 210h16M1016 216h16M1016 222h16" stroke="#2b3039" stroke-width="2"/>'
  const clock = '<circle cx="1000" cy="176" r="22" fill="#9a8a5c" opacity="0.55"/><circle cx="1000" cy="176" r="22" fill="none" stroke="#2a2e35" stroke-width="3"/><path d="M1000 176V160M1000 176l11 6" stroke="#1a1d22" stroke-width="2.4"/>'
  // The entrance: steps, a deep arched door, a lamp above it that flickers.
  roof.push('M940 446L1000 410L1060 446Z')
  rim.push('M940 446L1000 410L1060 446')
  R(trim, 938, 444, 124, 9)
  const door = '<path d="M946 453h108v69h-108z" fill="#0f1114"/><path d="M980 522V484a20 20 0 0 1 40 0V522Z" fill="#050608"/>' +
    '<path d="M950 453h9v69h-9zM972 453h9v69h-9zM1019 453h9v69h-9zM1041 453h9v69h-9z" fill="#2e333b"/><path d="M956 453h3v69h-3zM978 453h3v69h-3zM1025 453h3v69h-3zM1047 453h3v69h-3z" fill="#1a1d22"/>' +
    '<path d="M942 522h116v6h-116zM934 528h132v6h-132zM926 534h148v6h-148z" fill="#2c3038"/><path d="M1000 410v8" stroke="#2b3039" stroke-width="2"/><circle cx="1000" cy="428" r="5" fill="#1a1d22"/>'
  const lamp = `<circle cx="1000" cy="462" r="4" fill="#ffe7a8"/>${blob('o-lamp', 1000, 466, 60, 50, 0.8)}`
  const lampFx = `<g>${timeline('opacity', 7, [[0, 1], [2, 0.3], [2 + 2 * TICK, 1], [2 + 5 * TICK, 0.2], [2 + 7 * TICK, 1], [5.5, 0.6], [5.5 + 3 * TICK, 1]])}${lamp}</g>`
  // A figure passing behind a lit window of the east wing, now and then.
  const fx = 1120 + 14 + 9 * 22
  const figure = `<clipPath id="o-win"><path d="M${fx - 6} 377V361a6 6 0 0 1 12 0V377Z"/></clipPath>` +
    `<g clip-path="url(#o-win)"><g>${timeline('transform', 30, [[0, '-20 0'], [12, '-12 0'], [12 + 0.25, '-9 0'], [12 + 0.5, '-6 0'], [12 + 0.75, '-3 0'], [13, '0 0'], [13.25, '3 0'], [13.5, '6 0'], [13.75, '9 0'], [14, '12 0'], [14.25, '20 0']], 'translate')}` +
    `<path d="M${fx - 3} 377v-12a3 3 0 0 1 -1 -2a4 4 0 1 1 8 0a3 3 0 0 1 -1 2v12z" fill="#0d0d0c"/></g></g>`
  // Windows whose lights buzz and stutter, each on its own cycle: on for a while,
  // stuttering, off, and back.
  const fr = mulberry32(88)
  let buzz = ''
  for (let i = 0; i < 12; i++) {
    const [x, y] = darkAt[Math.floor(fr() * darkAt.length)]
    const dur = 9 + Math.floor(fr() * 14)
    const t0 = 1 + fr() * (dur - 5)
    const steps = [[0, 0], [t0, 1]]
    let t = t0 + 0.4 + fr() * 1.5
    for (let k = 0; k < 3 + Math.floor(fr() * 4); k++) {
      steps.push([t, 0], [t + (1 + Math.floor(fr() * 3)) * TICK, 1])
      t += (3 + Math.floor(fr() * 6)) * TICK
    }
    steps.push([Math.min(dur - TICK, t + fr() * 2), 0])
    buzz += `<g opacity="0">${timeline('opacity', dur, steps)}<use href="#w1" x="${n0(x)}" y="${n0(y)}"/>${blob('o-lamp', x, y, 22, 26, 0.35)}</g>`
  }
  // A power surge every 47 s: every lit window and lamp dies, stutters, comes back.
  const surge = timeline('opacity', 47, [[0, 1], [31, 0], [31 + 2 * TICK, 0.7], [31 + 4 * TICK, 0], [32.5, 0.5], [32.5 + 2 * TICK, 0], [33.2, 1]])
  // One lit window flickers.
  const flick = `<rect x="${640 + 14 + 3 * 22 - 6}" y="${422 - 11}" width="12" height="22" fill="#07090c" opacity="0">${timeline('opacity', 11, [[0, 0], [3, 1], [3 + 2 * TICK, 0], [3 + 4 * TICK, 1], [3 + 9 * TICK, 0], [8, 1], [8.5, 0]])}</rect>`
  lit += `<use href="#w1" x="${640 + 14 + 3 * 22}" y="422"/>`
  // Ivy creeping up the lower walls in a few places.
  const ivy = 'M470 522V470Q478 440 490 458Q498 430 508 452Q520 420 530 456L540 522Z' +
    'M560 522V430Q570 404 584 426Q594 392 604 420L614 450Q622 470 618 522Z' +
    'M880 522V478Q890 456 902 470Q912 444 924 472L930 522Z' +
    'M1300 522L1306 470Q1318 446 1326 466Q1336 430 1348 462L1360 522Z'
  return `<defs><path id="o-walls" d="${wall.join('')}"/><path id="o-roofs" d="${roof.join('')}"/></defs>` +
    `<use href="#o-walls" fill="#1d2027"/><use href="#o-walls" fill="url(#o-brick)"/><use href="#o-walls" fill="url(#o-grime)" opacity="0.6"/>` +
    `<use href="#o-roofs" fill="#111419"/><use href="#o-roofs" fill="url(#o-slate)"/>` +
    `<path d="${trim.join('')}" fill="#2b3039"/><path d="${dent.join('')}" fill="url(#o-dent)"/>` +
    `<path d="${crest}" stroke="#2b3039" stroke-width="1.5"/>` +
    `<path d="${rim.join('')}" fill="none" stroke="#4a5566" stroke-width="1.4" opacity="0.7"/>` +
    `<g opacity="0.8">${stains}</g>` + wins + `<g>${surge}${halos}${lit}${buzz}</g>` + flick + figure + clock + door + `<g>${surge}${lampFx}</g>` +
    `<path d="${ivy}" fill="#121a14" opacity="0.85"/><path d="${ivy}" fill="url(#o-ivy)"/>` +
    `<path d="${iron.join('')}" fill="none" stroke="#434a55" stroke-width="2"/>` +
    // Rain-dark streaks down the walls, and the haze between us and the building.
    blob('o-fog', 1000, 520, 640, 60, 0.7) + blob('o-fog', 760, 500, 300, 40, 0.4) + blob('o-fog', 1280, 505, 300, 40, 0.4)
}

// The guard tower at the fence's east corner, and its searchlight sweeping the
// grounds: a long pale wedge, swinging back and forth.
function guardTower() {
  const beam = `<path d="M0 0L1500 -95L1500 95Z" fill="url(#o-beam)"/>`
  const sweep = ticked('transform', 'rotate', 18, 2, (u) => n1(210 + 40 * (1 - Math.cos(u * Math.PI * 2)) / 2))
  return `<g transform="translate(1474 404)"><g>${sweep}${beam}</g></g>` +
    `<path d="M1452 660L1460 420H1488L1496 660Z" fill="#14171c"/>` +
    `<path d="M1460 470l28 40M1488 470l-28 40M1460 540l28 40M1488 540l-28 40" stroke="#22262d" stroke-width="2"/>` +
    `<path d="M1446 420h56v-10h-56zM1450 410l6-22h36l6 22z" fill="#1b1f25"/>` +
    `<circle cx="1474" cy="402" r="7" fill="#f4f6ff"/>${blob('o-lamp2', 1474, 402, 40, 30, 0.9)}`
}

// ---------------------------------------------------------------- the grounds

// The lawn between the fence and the building, low fog over it, and the road from
// the gate up to the door.
function grounds() {
  const rng = mulberry32(31)
  const lawn = `<path d="M0 560Q300 528 560 524H1440Q1600 528 1600 540V720H0Z" fill="url(#o-lawn)"/>`
  const road = `<path d="M984 524H1016L1120 660H690Z" fill="#191b1e"/>`
  let trees = ''
  for (let x = 0; x < 460; x += 14 + rng() * 18) trees += use(`p${Math.floor(rng() * 3)}`, x, 540 + rng() * 10, 0.5 + rng() * 0.5, rng() < 0.5)
  for (let x = 1540; x < W + 20; x += 14 + rng() * 18) trees += use(`p${Math.floor(rng() * 3)}`, x, 545 + rng() * 10, 0.5 + rng() * 0.5, rng() < 0.5)
  return `<g fill="#0b0f13">${trees}</g>` + lawn + road +
    `<g>${stepDrift(70, 0, 60)}${blob('o-fog', 700, 560, 460, 30, 0.5)}${blob('o-fog', 1250, 555, 380, 26, 0.45)}</g>`
}

// Inmates running across the lawn behind the fence, each on its own cycle: hidden,
// then sprinting from one side to the other in a four-pose stride, then gone.
function runner(dur, t0, t1, x0, x1, y, wild, s = 1) {
  const step = 2 // move every 2 ticks
  const n = Math.round(((t1 - t0) * FPS) / step)
  const pos = [[0, `${x0} ${y}`]]
  for (let i = 0; i <= n; i++) pos.push([t0 + (i * step) / FPS, `${n1(x0 + ((x1 - x0) * i) / n)} ${y}`])
  pos.push([t1 + step / FPS, `${x0} ${y}`])
  const vis = timeline('opacity', dur, [[0, 0], [t0, 1], [t1 + step / FPS, 0]])
  const flip = x1 < x0 ? -s : s
  // The stride: each pose shown in turn, three ticks each.
  const pose = (k) => `<g opacity="${k ? 0 : 1}">${timeline('opacity', 0.5, k ? [[0, 0], [k * 0.125, 1], [(k + 1) * 0.125, 0]].slice(0, k === 3 ? 2 : 3) : [[0, 1], [0.125, 0]])}<use href="#${wild ? 'j' : 'i'}${k}"/></g>`
  return `<g opacity="0">${vis}<g>${timeline('', dur, pos, 'translate')}<g transform="scale(${flip} ${s})">${pose(0)}${pose(1)}${pose(2)}${pose(3)}</g></g></g>`
}
function inmates() {
  return runner(31, 5, 12, 470, 1450, 552, false, 0.62) + runner(43, 20, 27.5, 1490, 520, 556, true, 0.66) + runner(23, 14, 16.5, 1060, 1310, 542, false, 0.56) + runner(53, 36, 41, 640, 860, 548, true, 0.6)
}

// The fence: posts, chain-link panels, razor wire along the top, a half-open gate
// between stone pillars, and a sign.
const FB = 660 // the fence's foot
const FT = 540 // the fence's top
function fence() {
  let posts = ''
  let panels = ''
  let wire = ''
  for (let x = -20; x < W + 40; x += 110) {
    if (x > 660 && x < 940) continue
    posts += `M${x - 3} ${FB}V${FT - 6}h6V${FB}z`
  }
  for (const [x0, x1] of [[-20, 700], [900, W + 20]]) panels += `M${x0} ${FT}H${x1}V${FB}H${x0}z`
  for (let x = -20; x < W + 20; x += 9) {
    if (x > 690 && x < 910) continue
    wire += `M${x} ${FT - 8}a6 5 0 1 0 0.1 0`
  }
  // The gate: the left leaf shut, the right leaf swung in, skewed by the turn.
  const gate = `<path d="M720 ${FB}V${FT + 4}H802V${FB}Z" fill="url(#o-link)" stroke="#4a515b" stroke-width="3"/>` +
    `<path d="M806 ${FB - 10}V${FT + 14}L852 ${FT - 2}V${FB - 26}Z" fill="url(#o-link)" stroke="#4a515b" stroke-width="3"/>` +
    `<path d="M796 600h14v6h-14z" fill="#6a5a46"/>`
  const pillars = `<path d="M690 ${FB}V500H722V${FB}ZM880 ${FB}V500H912V${FB}Z" fill="#23262c"/><path d="M686 500h40v-8h-40zM876 500h40v-8h-40z" fill="#2f343c"/>` +
    `<path d="M698 492h24v-14h-24zM888 492h24v-14h-24z" fill="#1a1d22"/><circle cx="900" cy="485" r="4" fill="#d9c98e" opacity="0.6"/>${blob('o-lamp', 900, 488, 36, 30, 0.45)}`
  const sign = `<g transform="rotate(-3 1065 595)"><path d="M1012 572h106v44h-106z" fill="#c9c4b6"/><path d="M1012 572h106v44h-106z" fill="url(#o-grime)"/>` +
    `<text x="1065" y="592" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="17" fill="#8e1f17" text-anchor="middle">KEEP OUT</text>` +
    `<text x="1065" y="608" font-family="Arial, Helvetica, sans-serif" font-size="9" fill="#2a2a2a" text-anchor="middle">PRIVATE PROPERTY</text></g>`
  return `<path d="${panels}" fill="url(#o-link)"/>` +
    `<path d="M-20 ${FT}H700M900 ${FT}H${W + 20}" stroke="#3e444d" stroke-width="3"/>` +
    `<path d="${posts}" fill="#2a2f36"/>` +
    `<path d="${wire}" fill="none" stroke="#5d6570" stroke-width="1" opacity="0.8"/>` +
    pillars + gate + sign
}

// The jeep left at the gate: an original boxy four-by-four, modelled in metres and
// drawn in perspective from in front of it and to its left. Its front faces the
// gate. The driver's door hangs open on its front hinge, the dome light still on in
// the cab; the headlights throw two pale cones to the gate, lighting the rain.
// x runs forward, y to the vehicle's right (the near side is y < 0), z up.
const JEEP = { yaw: -28, D: 12, F: 980, h: 1.5, cx: 490, cy: 617 }
function jp(x, y, z) {
  const c = Math.cos((JEEP.yaw * Math.PI) / 180)
  const s = Math.sin((JEEP.yaw * Math.PI) / 180)
  const xr = x * c - y * s
  const depth = JEEP.D + x * s + y * c
  return [JEEP.cx + (JEEP.F * xr) / depth, JEEP.cy - (JEEP.F * (z - JEEP.h)) / depth]
}
const jpoly = (ps) => 'M' + ps.map(([x, y, z]) => jp(x, y, z).map(n1).join(' ')).join('L') + 'Z'
// A circle in a vertical plane across the vehicle (a wheel), as a polygon.
function jwheel(x, y, z, r, n = 20) {
  const ps = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    ps.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r])
  }
  return jpoly(ps)
}
let BEAMS = ''
function jeep() {
  const L = 2.1 // half length of the body
  const Y = 0.92 // half width
  const near = -Y
  // The headlights, and the beams from them toward the gate.
  const hl = [jp(L + 0.02, -0.66, 0.82), jp(L + 0.02, 0.66, 0.82)]
  BEAMS = `M${n0(hl[0][0])} ${n0(hl[0][1])}L1070 560L1120 700ZM${n0(hl[1][0])} ${n0(hl[1][1])}L1010 640L1050 770Z`
  const beams = `<path d="M${n0(hl[0][0])} ${n0(hl[0][1])}L1070 560L1120 700Z" fill="url(#o-head)"/><path d="M${n0(hl[1][0])} ${n0(hl[1][1])}L1010 640L1050 770Z" fill="url(#o-head)" opacity="0.7"/>`
  const pool = blob('o-pool', 850, 700, 240, 40, 0.75) + blob('o-pool', 900, 600, 140, 50, 0.4)
  const shadow = `<path d="${jpoly([[-L - 0.2, -Y - 0.25, 0], [L + 0.3, -Y - 0.25, 0], [L + 0.3, Y + 0.2, 0], [-L - 0.2, Y + 0.2, 0]])}" fill="#050506" opacity="0.7"/>`
  // Far wheels, seen under the body.
  const far = `<path d="${jwheel(-1.35, Y - 0.05, 0.38, 0.38)}${jwheel(1.35, Y - 0.05, 0.38, 0.38)}" fill="#060708"/>`
  // The body: the lower tub, the hood, the cab.
  const tubSide = jpoly([[-L, near, 0.45], [L, near, 0.45], [L, near, 1.05], [-L, near, 1.08]])
  const tubFront = jpoly([[L, near, 0.45], [L, Y, 0.45], [L, Y, 1.02], [L, near, 1.02]])
  const hood = jpoly([[0.95, near + 0.04, 1.1], [L, near + 0.04, 1.03], [L, Y - 0.04, 1.03], [0.95, Y - 0.04, 1.1]])
  const cabSide = jpoly([[-L + 0.05, near + 0.06, 1.08], [0.95, near + 0.06, 1.1], [0.5, near + 0.12, 1.85], [-L + 0.1, near + 0.12, 1.85]])
  const roof = jpoly([[-L + 0.1, near + 0.12, 1.85], [0.5, near + 0.12, 1.85], [0.5, Y - 0.12, 1.85], [-L + 0.1, Y - 0.12, 1.85]])
  const screen = jpoly([[0.95, near + 0.08, 1.12], [0.95, Y - 0.08, 1.12], [0.52, Y - 0.14, 1.8], [0.52, near + 0.14, 1.8]])
  // Side windows on the near side: rear quarter and the (open) driver's opening.
  const winRear = jpoly([[-L + 0.25, near + 0.08, 1.2], [-0.75, near + 0.08, 1.2], [-0.75, near + 0.11, 1.75], [-L + 0.3, near + 0.11, 1.75]])
  const winMid = jpoly([[-0.62, near + 0.08, 1.2], [-0.1, near + 0.08, 1.2], [-0.1, near + 0.11, 1.75], [-0.62, near + 0.11, 1.75]])
  const opening = jpoly([[-0.02, near + 0.02, 0.5], [0.86, near + 0.02, 0.5], [0.86, near + 0.04, 1.1], [0.55, near + 0.11, 1.75], [-0.02, near + 0.11, 1.75]])
  // The open door: hinged at its front edge, swung out 62 degrees toward us.
  const hx = 0.88
  const ang = (62 * Math.PI) / 180
  const dp = (d, z, out = 0) => [hx - d * Math.cos(ang) + out * Math.sin(ang), near - d * Math.sin(ang) - out * Math.cos(ang), z]
  const doorPanel = jpoly([dp(0, 0.5), dp(0.9, 0.5), dp(0.9, 1.12), dp(0, 1.12)])
  const doorFrame = jpoly([dp(0, 1.12), dp(0.9, 1.12), dp(0.9, 1.72), dp(0.32, 1.72), dp(0.02, 1.2)])
  const doorGlass = jpoly([dp(0.08, 1.16), dp(0.84, 1.16), dp(0.84, 1.66), dp(0.34, 1.66), dp(0.1, 1.24)])
  const armrest = jpoly([dp(0.2, 0.95, -0.02), dp(0.75, 0.95, -0.02), dp(0.75, 0.9, -0.02), dp(0.2, 0.9, -0.02)])
  // Inside the cab: the seat back and the wheel.
  const seat = jpoly([[-0.05, -0.45, 0.6], [-0.05, -0.45, 1.45], [0.25, -0.45, 1.5], [0.25, -0.45, 0.6]])
  const [wx, wy] = jp(0.62, -0.5, 1.22)
  // The grille, lamps and bumper on the front face.
  let slots = ''
  for (let k = -5; k <= 5; k++) slots += jpoly([[L + 0.01, k * 0.08 - 0.025, 0.6], [L + 0.01, k * 0.08 + 0.025, 0.6], [L + 0.01, k * 0.08 + 0.025, 0.95], [L + 0.01, k * 0.08 - 0.025, 0.95]])
  const lamps = `<path d="${jwheel(L + 0.02, -0.66, 0.82, 0.12, 12).replace(/[\d.]+ [\d.]+/g, (m) => m)}" fill="#fbf9ef"/>`
  const lampR = jpoly(Array.from({ length: 12 }, (_, i) => [L + 0.02, 0.66 + Math.cos((i / 12) * Math.PI * 2) * 0.12, 0.82 + Math.sin((i / 12) * Math.PI * 2) * 0.12]))
  const lampL = jpoly(Array.from({ length: 12 }, (_, i) => [L + 0.02, -0.66 + Math.cos((i / 12) * Math.PI * 2) * 0.12, 0.82 + Math.sin((i / 12) * Math.PI * 2) * 0.12]))
  const bumper = jpoly([[L, near - 0.04, 0.36], [L + 0.16, near - 0.04, 0.36], [L + 0.16, Y + 0.04, 0.36], [L + 0.16, Y + 0.04, 0.56], [L, Y + 0.04, 0.56], [L, near - 0.04, 0.56]])
  const bumperFace = jpoly([[L + 0.16, near - 0.04, 0.36], [L + 0.16, Y + 0.04, 0.36], [L + 0.16, Y + 0.04, 0.56], [L + 0.16, near - 0.04, 0.56]])
  // Wheel arches, near wheels, rims.
  const arch = (x) => jpoly(Array.from({ length: 11 }, (_, i) => [x + Math.cos((i / 10) * Math.PI) * 0.5, near - 0.02, 0.4 + Math.sin((i / 10) * Math.PI) * 0.5]))
  const tyres = jwheel(-1.35, near - 0.04, 0.38, 0.38) + jwheel(1.35, near - 0.04, 0.38, 0.38)
  const rims = jwheel(-1.35, near - 0.07, 0.38, 0.2, 14) + jwheel(1.35, near - 0.07, 0.38, 0.2, 14)
  const hubs = jwheel(-1.35, near - 0.08, 0.38, 0.06, 8) + jwheel(1.35, near - 0.08, 0.38, 0.06, 8)
  // The roof rack: two rails and crossbars.
  let rack = ''
  for (const yy of [near + 0.2, Y - 0.2]) rack += `M${jp(-L + 0.2, yy, 1.97).map(n1).join(' ')}L${jp(0.35, yy, 1.97).map(n1).join(' ')}`
  for (const xx of [-1.7, -0.9, -0.1]) rack += `M${jp(xx, near + 0.2, 1.97).map(n1).join(' ')}L${jp(xx, Y - 0.2, 1.97).map(n1).join(' ')}`
  // Rims of light on the edges the sky catches.
  const edges = `M${jp(-L + 0.1, near + 0.12, 1.85).map(n1).join(' ')}L${jp(0.5, near + 0.12, 1.85).map(n1).join(' ')}L${jp(0.5, Y - 0.12, 1.85).map(n1).join(' ')}` +
    `M${jp(0.95, near + 0.04, 1.1).map(n1).join(' ')}L${jp(L, near + 0.04, 1.03).map(n1).join(' ')}L${jp(L, Y - 0.04, 1.03).map(n1).join(' ')}`
  const mirror = jpoly([[0.98, near - 0.05, 1.3], [0.98, near - 0.2, 1.3], [0.98, near - 0.2, 1.42], [0.98, near - 0.05, 1.42]])
  const [dx, dy] = jp(0.35, -0.4, 1.78)
  const [tx, ty] = jp(-L, near + 0.02, 0.9)
  return beams + pool + shadow + far +
    `<path d="${tubSide}" fill="#22272d"/><path d="${tubSide}" fill="url(#o-mudside)"/>` +
    `<path d="${tubFront}" fill="#2a3037"/><path d="${hood}" fill="#323942"/>` +
    `<path d="${cabSide}" fill="#252a31"/><path d="${roof}" fill="#30363f"/><path d="${screen}" fill="#2b3646"/>` +
    `<path d="${winRear}${winMid}" fill="#0b0e12"/>` +
    // The open doorway, the cab inside, the dome light.
    `<path d="${opening}" fill="#08090b"/>${blob('o-dome', (dx + wx) / 2, (dy + wy) / 2 + 6, 50, 40, 0.9)}<circle cx="${n1(dx)}" cy="${n1(dy)}" r="2.6" fill="#ffd79a"/>` +
    `<path d="${seat}" fill="#17191d"/><ellipse cx="${n1(wx)}" cy="${n1(wy)}" rx="9" ry="12" fill="none" stroke="#1e2125" stroke-width="3"/>` +
    `<path d="${slots}" fill="#121418"/><path d="${bumper}" fill="#1b1e22"/><path d="${bumperFace}" fill="#2a2e34"/>` +
    `<path d="${lampL}${lampR}" fill="#fbf9ef"/>` + blob('o-lamp2', hl[0][0], hl[0][1], 30, 22, 0.95) + blob('o-lamp2', hl[1][0], hl[1][1], 24, 18, 0.9) +
    `<path d="${arch(-1.35)}${arch(1.35)}" fill="#0d0f12"/>` +
    `<path d="${tyres}" fill="#08090b"/><path d="${rims}" fill="#1e2227"/><path d="${hubs}" fill="#15171a"/>` +
    `<path d="${rack}" fill="none" stroke="#191c21" stroke-width="2.4"/>` +
    `<path d="${edges}" fill="none" stroke="#5f6b7d" stroke-width="1.4" opacity="0.8"/>` +
    `<path d="${mirror}" fill="#191c21"/>` +
    // The door, hanging open, in front of everything on its side.
    `<path d="${doorPanel}" fill="#1c2026"/><path d="${armrest}" fill="#2b3038"/><path d="${doorFrame}" fill="#1c2026"/><path d="${doorGlass}" fill="#2a3444" opacity="0.8"/>` +
    // A small red tail lamp at the rear corner.
    `<circle cx="${n1(tx)}" cy="${n1(ty)}" r="3" fill="#9a1c14"/>${blob('o-tail', tx, ty, 18, 14, 0.8)}`
}

// ---------------------------------------------------------------- the foreground

// The mud road toward the gate, puddles that hold the lights, ripples where the rain
// strikes, tall wet grass, and pines at the edges of the frame.
function foreground() {
  const rng = mulberry32(77)
  const mud = `<path d="M0 ${FB}H${W}V${H}H0Z" fill="url(#o-mud)"/>` +
    `<path d="M690 ${FB}H912L1260 ${H}H420Z" fill="#1c1d1f"/>`
  // Tyre ruts running up to the gate, water standing in them.
  let ruts = ''
  let wet = ''
  for (const [xb, xt] of [[560, 768], [700, 790], [930, 822], [1070, 846]]) {
    ruts += `M${xb - 26} ${H}Q${(xb + xt) / 2 - 24} 780 ${xt - 5} ${FB}H${xt + 5}Q${(xb + xt) / 2 + 4} 780 ${xb + 26} ${H}Z`
    wet += `M${xb - 6} ${H - 20}Q${(xb + xt) / 2 - 14} 800 ${(xb + xt) / 2 - 8} 760`
  }
  // Puddles: irregular dark mirrors with a pale rim of sky, the lit windows and the
  // headlight beam smeared in them, and rings where the rain strikes.
  const puddles = [[820, 742, 96, 13], [700, 830, 140, 20], [1040, 800, 110, 16], [930, 880, 160, 18], [610, 760, 60, 9]]
  let pud = ''
  let rim = ''
  let refl = ''
  let rip = ''
  for (const [cx, cy, rx, ry] of puddles) {
    // A soft irregular outline: points round an ellipse, joined by curves through
    // their midpoints.
    const p = []
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const k = 0.85 + rng() * 0.25
      p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
    }
    const mid = (i) => [(p[i % 10][0] + p[(i + 1) % 10][0]) / 2, (p[i % 10][1] + p[(i + 1) % 10][1]) / 2]
    let d = `M${pts([mid(0)])}`
    for (let i = 1; i <= 10; i++) d += `Q${pts([p[i % 10]])} ${pts([mid(i)])}`
    pud += d + 'Z'
    let r = `M${pts([mid(5)])}`
    for (let i = 6; i <= 9; i++) r += `Q${pts([p[i % 10]])} ${pts([mid(i)])}`
    rim += r
    for (let k = 0; k < 3; k++) {
      const x = cx + (rng() - 0.5) * rx * 1.2
      const len = ry * (1 + rng())
      refl += `M${n0(x)} ${n0(cy - ry * 0.6)}h${n0(2 + rng() * 3)}v${n0(len)}h${-n0(2 + rng() * 3)}z`
    }
    for (let k = 0; k < 2; k++) {
      const x = cx + (rng() - 0.5) * rx
      const y = cy + (rng() - 0.5) * ry * 0.6
      rip += `<g transform="translate(${n0(x)} ${n0(y)})"><ellipse rx="10" ry="2.5" fill="none" stroke="#7a8696" stroke-width="0.8">` +
        `${ticked('transform', 'scale', 1, 2, (u) => n2(0.2 + u * 1.2), -k * 0.5)}${ticked('opacity', '', 1, 2, (u) => n2(0.8 * (1 - u)), -k * 0.5)}</ellipse></g>`
    }
  }
  // The headlights' smear in the nearer puddles.
  const glare = blob('o-pool', 820, 744, 90, 8, 0.9) + blob('o-pool', 1030, 800, 70, 7, 0.6)
  // Grass along the fence, behind the jeep, and big tufts at the frame's foot.
  let back = ''
  for (let x = -10; x < W + 20; x += 18 + rng() * 26) {
    if (x > 560 && x < 1160) continue
    back += use(`g${Math.floor(rng() * 3)}`, x, FB + 6 + rng() * 26, 1.2 + rng() * 1.4, rng() < 0.5)
  }
  let grass = ''
  for (let i = 0; i < 26; i++) {
    const x = rng() < 0.5 ? rng() * 520 : 1180 + rng() * 420
    grass += use(`g${Math.floor(rng() * 3)}`, x, 790 + rng() * 110, 2.2 + rng() * 2, rng() < 0.5)
  }
  // Pines at the frame's edges, with a faint rim of sky light on their left edges.
  const pineSet = `${use('p1', 40, 930, 7)}${use('p0', 175, 945, 5.2, true)}${use('p2', 1590, 935, 6.6)}${use('p0', 1480, 950, 4.4, true)}`
  const pines = `<g fill="#1b222c" transform="translate(-3 -2)">${pineSet}</g><g fill="#05070a">${pineSet}</g>`
  return {
    ground: mud + `<path d="${ruts}" fill="#141517" opacity="0.8"/><path d="${wet}" fill="none" stroke="#45505e" stroke-width="1.6" opacity="0.4"/>` +
      `<path d="${pud}" fill="url(#o-pud)"/><path d="${rim}" fill="none" stroke="#56647a" stroke-width="1.2" opacity="0.6"/>` +
      `<path d="${refl}" fill="url(#o-refl)"/>${glare}${rip}<g fill="#0c0f12">${back}</g>`,
    front: `<g fill="#0c0f12">${grass}</g>` + pines,
  }
}

// ---------------------------------------------------------------- rain

// Rain: sheets of slanted streaks, each a tile copied along its fall, so one move
// loops seamlessly. A brighter sheet shows only inside the headlight beams.
function rainSheet(seed, n, len, color, op, width, tileH, dx, dur, clip = '', step = 2) {
  const rng = mulberry32(seed)
  let d = ''
  for (let i = 0; i < n; i++) {
    const x = rng() * (W + 500) - 100
    const y = rng() * tileH
    const l = len * (0.6 + rng() * 0.8)
    d += `M${n0(x)} ${n0(y)}l${n1((-l * dx) / tileH)} ${n0(l)}`
  }
  const id = `o-r${seed}`
  let copies = ''
  for (let k = 1; k <= Math.ceil(H / tileH) + 1; k++) copies += `<use href="#${id}" x="${n0(-k * dx)}" y="${k * tileH}"/>`
  copies += `<use href="#${id}" x="${dx}" y="${-tileH}"/>`
  const move = ticked('transform', 'translate', dur, step, (u) => `${n1(-dx * u)} ${n1(tileH * u)}`)
  return `<g${clip ? ` clip-path="url(#${clip})"` : ''} opacity="${op}"><g>${move}<path id="${id}" d="${d}" stroke="${color}" stroke-width="${width}"/>${copies}</g></g>`
}
function rain() {
  return `<clipPath id="o-beams"><path d="${BEAMS}"/></clipPath>` +
    rainSheet(1, 160, 34, '#7f8ba0', 0.45, 1, 300, 60, 0.75) +
    rainSheet(2, 50, 56, '#9aa6ba', 0.5, 1.4, 450, 90, 0.75) +
    rainSheet(3, 120, 36, '#f0ecd8', 0.8, 1.2, 300, 60, 0.75, 'o-beams')
}

// ---------------------------------------------------------------- the camcorder

// Night vision: the world goes green and grainy for a while each minute. In it, a
// figure stands at the fence by the gate, and eyes shine in a dark window.
function nightVision() {
  const rng = mulberry32(5)
  let grain = ''
  for (let i = 0; i < 700; i++) grain += `M${n0(rng() * W)} ${n0(rng() * H)}h${n0(1 + rng() * 2)}v1h${-n0(1 + rng() * 2)}z`
  const shimmer = ticked('transform', 'translate', 1, 2, (u) => `${n0((u * 997) % 7) - 3} ${n0((u * 613) % 7) - 3}`)
  const stalker = `<g transform="translate(940 ${FB})"><path d="M-9 0L-7 -46Q-12 -70 -6 -84Q-10 -92 -6 -100Q0 -108 6 -100Q10 -92 6 -84Q12 -70 7 -46L9 0H4L2 -40H-2L-4 0Z" fill="#b9ffc4" opacity="0.55"/>` +
    `<circle cx="-2.5" cy="-95" r="1.6" fill="#ffffff"/><circle cx="2.5" cy="-95" r="1.6" fill="#ffffff"/></g>`
  const eyes = `<circle cx="1222" cy="420" r="1.8" fill="#ffffff"/><circle cx="1228" cy="420" r="1.8" fill="#ffffff"/>${blob('o-eye', 1225, 420, 14, 8, 0.8)}`
  return `<g opacity="0">${nvIn()}` +
    `<rect width="${W}" height="${H}" fill="#0a2412" opacity="0.28"/>` +
    `<rect width="${W}" height="${H}" fill="#5fd47a" opacity="0.16"/>` +
    stalker + eyes +
    `<g>${shimmer}<path d="${grain}" fill="#c8ffd0" opacity="0.2"/></g>` +
    `<rect width="${W}" height="${H}" fill="url(#o-nvig)"/></g>` +
    // The burst of static at each switch.
    `<g opacity="0">${nvGlitch()}<rect width="${W}" height="${H}" fill="#9aa59c" opacity="0.5"/><path d="${grain}" fill="#ffffff" transform="translate(3 -2)"/>` +
    `<path d="M0 300h${W}v14H0zM0 610h${W}v8H0z" fill="#e8f0ea" opacity="0.5"/></g>`
}

// The viewfinder: corner brackets, a blinking REC, a running timecode (the clock's
// minutes and seconds), a battery with its last bar blinking, NV when night vision
// is on, faint scanlines.
function viewfinder() {
  const ui = '#e6ece8'
  const font = 'font-family="Courier New, Courier, monospace" font-weight="700"'
  const brackets = 'M110 70h56M110 70v40M1490 70h-56M1490 70v40M110 830h56M110 830v-40M1490 830h-56M1490 830v-40M794 450h12M800 444v12'
  // One digit of the timecode: `n` glyphs, each shown for `dur / n` seconds.
  const digit = (x, n, dur) => {
    let out = ''
    for (let k = 0; k < n; k++) {
      const steps = k === 0 ? [[0, 1], [dur / n, 0]] : [[0, 0], [(k * dur) / n, 1], [((k + 1) * dur) / n, 0]]
      if (k === n - 1) steps.pop()
      out += `<text x="${x}" y="104" opacity="${k === 0 ? 1 : 0}">${timeline('opacity', dur, steps)}${k}</text>`
    }
    return out
  }
  const tc = `<g ${font} font-size="28" fill="${ui}"><text x="1268" y="104">00:</text>${digit(1319, 6, 3600)}${digit(1336, 10, 600)}<text x="1353" y="104">:</text>${digit(1370, 6, 60)}${digit(1387, 10, 10)}</g>`
  const rec = `<g>${timeline('opacity', 1, [[0, 1], [0.5, 0]])}<circle cx="146" cy="94" r="10" fill="#e8322a"/></g><text x="166" y="104" ${font} font-size="28" fill="${ui}">REC</text>`
  const battery = `<path d="M1384 790h86v34h-86zM1470 800h6v14h-6z" fill="none" stroke="${ui}" stroke-width="2.4"/><path d="M1390 796h16v22h-16zM1410 796h16v22h-16zM1430 796h16v22h-16z" fill="${ui}"/>` +
    `<path d="M1450 796h14v22h-14z" fill="${ui}">${timeline('opacity', 2, [[0, 1], [1, 0]])}</path>`
  const nv = `<g opacity="0">${nvIn()}<text x="146" y="824" ${font} font-size="26" fill="#7dff8f">NIGHT VISION</text></g>`
  const mode = `<g opacity="1">${nvOut()}<text x="146" y="824" ${font} font-size="22" fill="${ui}" opacity="0.8">SP  ▶</text></g>`
  return `<rect width="${W}" height="${H}" fill="url(#o-scan)"/>` +
    `<path d="${brackets}" fill="none" stroke="${ui}" stroke-width="3" opacity="0.85"/>` +
    rec + tc + battery + nv + mode
}

// ---------------------------------------------------------------- the scene

export function buildScene() {
  const fg = foreground()
  const gr = mulberry32(404)
  let grime = ''
  for (let i = 0; i < 70; i++) grime += `M${n0(gr() * 83)} ${n0(gr() * 61)}v${n0(3 + gr() * 14)}h${n1(0.6 + gr() * 1.4)}v${-n0(3 + gr() * 10)}z`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    ${symbols()}
    <linearGradient id="o-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070b"/><stop offset="0.35" stop-color="#0c1119"/><stop offset="0.6" stop-color="#1a2130"/></linearGradient>
    <radialGradient id="o-cd"><stop offset="0" stop-color="#05070a" stop-opacity="0.9"/><stop offset="1" stop-color="#05070a" stop-opacity="0"/></radialGradient>
    <radialGradient id="o-cl"><stop offset="0" stop-color="#3a4558" stop-opacity="0.8"/><stop offset="1" stop-color="#3a4558" stop-opacity="0"/></radialGradient>
    <radialGradient id="o-moon"><stop offset="0" stop-color="#7d8ba3" stop-opacity="0.5"/><stop offset="1" stop-color="#7d8ba3" stop-opacity="0"/></radialGradient>
    <linearGradient id="o-flash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8d4f0" stop-opacity="0.2"/><stop offset="0.7" stop-color="#c8d4f0" stop-opacity="0.9"/><stop offset="1" stop-color="#c8d4f0"/></linearGradient>
    <linearGradient id="o-lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9c27c"/><stop offset="1" stop-color="#8a6f37"/></linearGradient>
    <radialGradient id="o-lamp"><stop offset="0" stop-color="#ffd98a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
    <radialGradient id="o-lamp2"><stop offset="0" stop-color="#f4f6ff" stop-opacity="0.8"/><stop offset="1" stop-color="#f4f6ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="o-dome"><stop offset="0" stop-color="#ffcf8a" stop-opacity="0.5"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>
    <radialGradient id="o-tail"><stop offset="0" stop-color="#ff3a2a" stop-opacity="0.45"/><stop offset="1" stop-color="#ff3a2a" stop-opacity="0"/></radialGradient>
    <linearGradient id="o-stain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0b0d" stop-opacity="0.7"/><stop offset="1" stop-color="#0a0b0d" stop-opacity="0"/></linearGradient>
    <linearGradient id="o-refl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4bd80" stop-opacity="0.5"/><stop offset="1" stop-color="#d4bd80" stop-opacity="0"/></linearGradient>
    <linearGradient id="o-mudside" x1="0" y1="0" x2="0" y2="1"><stop offset="0.3" stop-color="#3a3026" stop-opacity="0"/><stop offset="1" stop-color="#3a3026" stop-opacity="0.6"/></linearGradient>
    <radialGradient id="o-eye"><stop offset="0" stop-color="#ffffff" stop-opacity="0.7"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <linearGradient id="o-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e8eeff" stop-opacity="0.45"/><stop offset="1" stop-color="#e8eeff" stop-opacity="0"/></linearGradient>
    <linearGradient id="o-head" gradientUnits="userSpaceOnUse" x1="615" y1="0" x2="1080" y2="0"><stop offset="0" stop-color="#f4f2e6" stop-opacity="0.55"/><stop offset="1" stop-color="#f4f2e6" stop-opacity="0"/></linearGradient>
    <radialGradient id="o-pool"><stop offset="0" stop-color="#e8e4d4" stop-opacity="0.35"/><stop offset="1" stop-color="#e8e4d4" stop-opacity="0"/></radialGradient>
    <linearGradient id="o-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2130" stop-opacity="0"/><stop offset="0.7" stop-color="#1a2130" stop-opacity="0.25"/><stop offset="1" stop-color="#1e2634" stop-opacity="0.6"/></linearGradient>
    <radialGradient id="o-fog"><stop offset="0" stop-color="#4a5566" stop-opacity="0.6"/><stop offset="1" stop-color="#4a5566" stop-opacity="0"/></radialGradient>
    <linearGradient id="o-lawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#11161b"/><stop offset="1" stop-color="#0a0d10"/></linearGradient>
    <linearGradient id="o-mud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141618"/><stop offset="1" stop-color="#08090a"/></linearGradient>
    <linearGradient id="o-pud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3442"/><stop offset="1" stop-color="#151b24"/></linearGradient>
    <radialGradient id="o-nvig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#021006" stop-opacity="0"/><stop offset="1" stop-color="#021006" stop-opacity="0.55"/></radialGradient>
    <pattern id="o-link" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0L12 12M12 0L0 12" stroke="#5f6874" stroke-width="0.8" opacity="0.6"/></pattern>
    <pattern id="o-brick" width="24" height="10" patternUnits="userSpaceOnUse"><path d="M0 9.5H24M6 0V5M18 5V10" stroke="#0e1014" stroke-width="0.8" opacity="0.5"/></pattern>
    <pattern id="o-grime" width="83" height="61" patternUnits="userSpaceOnUse"><path d="${grime}" fill="#0a0b0c" opacity="0.35"/></pattern>
    <pattern id="o-slate" width="8" height="5" patternUnits="userSpaceOnUse"><path d="M0 5a4 3 0 0 1 8 0M-4 2.5a4 3 0 0 1 8 0M4 2.5a4 3 0 0 1 8 0" fill="none" stroke="#1e232b" stroke-width="0.7"/></pattern>
    <pattern id="o-dent" width="7" height="6" patternUnits="userSpaceOnUse"><path d="M0 0h7v1.6h-7zM1 1.6h3v4h-3z" fill="#2b3039"/></pattern>
    <pattern id="o-ivy" width="22" height="18" patternUnits="userSpaceOnUse"><path d="M3 4a3 2 30 1 0 0.1 0M11 2a3 2 -20 1 0 0.1 0M17 7a3 2 40 1 0 0.1 0M7 10a3 2 -30 1 0 0.1 0M15 14a3 2 20 1 0 0.1 0M2 15a3 2 -40 1 0 0.1 0M19 1a2 2 0 1 0 0.1 0" fill="#1f2b22"/><path d="M3 4L7 10L15 14M11 2L17 7" stroke="#0b100c" stroke-width="0.8"/></pattern>
    <pattern id="o-scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity="0.22"/></pattern>
    <radialGradient id="o-vig" cx="0.5" cy="0.5" r="0.8"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.65"/></radialGradient>
  </defs>
  ${sky()}
  ${asylum()}
  ${guardTower()}
  ${grounds()}
  ${inmates()}
  ${fence()}
  ${fg.ground}
  ${jeep()}
  ${fg.front}
  ${rain()}
  ${lightningAll()}
  <rect width="${W}" height="${H}" fill="url(#o-vig)"/>
  ${nightVision()}
  ${viewfinder()}
</svg>`
}
