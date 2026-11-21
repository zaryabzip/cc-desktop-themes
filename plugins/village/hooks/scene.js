// Resident Evil Village inspired: a snowbound mountain valley in a storm, as an
// original scene. Nothing is taken from the game: the castle, the village, the mill
// and the land are all drawn for this scene. A low light breaks through a pass between
// the mountains; a gothic castle stands on a ridge on the right, half lost in fog; a
// village with a church spire lies in the valley below it; a windmill turns on the
// left among tall firs; bare, snow-laden brush fills the foreground.
//
// Depth comes from the air: each plane further away is paler and bluer, with less
// contrast, and fog lies between the planes.
//
// Size: trees, brush and bushes are a few shapes defined once and placed many times
// (<use>), so the forest costs little text and nothing repeats in a visible grid.
//
// Cost: no filters. Soft shapes are gradients. Every animation steps on one shared
// clock (24 ticks a second; slow drifts every half second), so changes from all parts
// land on the same frames and the browser never draws more than 24 frames a second.
// Any smooth SMIL animation would make it draw 60. All motion is SMIL and every colour a presentation attribute: the desktop app draws
// the scene in a script-less frame.

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

// SMIL helpers.
const SPLINE = '0.42 0 0.58 1'
const evenTimes = (n) => Array.from({ length: n }, (_, i) => (i / (n - 1)).toFixed(3)).join(';')
function at(type, values, dur, begin = 0, kt = '', ease = true) {
  const n = values.split(';').length
  const calc = ease ? ` calcMode="spline" keySplines="${Array(n - 1).fill(SPLINE).join(';')}"` : ''
  const times = kt ? ` keyTimes="${kt}"` : ease ? ` keyTimes="${evenTimes(n)}"` : ''
  const start = begin ? ` begin="${n1(begin)}s"` : ''
  return `<animateTransform attributeName="transform" type="${type}" values="${values}"${times} dur="${dur}s"${start} repeatCount="indefinite"${calc}/>`
}
function ao(values, dur, begin = 0, kt = '', calc = '') {
  const times = kt ? ` keyTimes="${kt}"` : ''
  const start = begin ? ` begin="${n1(begin)}s"` : ''
  const mode = calc ? ` calcMode="${calc}"` : ''
  return `<animate attributeName="opacity" values="${values}"${times} dur="${dur}s"${start} repeatCount="indefinite"${mode}/>`
}
// The shared clock. Every animation changes only on a tick of 1/24 s, so changes
// from different parts land on the same frames, and the browser draws at most 24
// frames a second instead of 60. Slow things step every 12 ticks (0.5 s).
const FPS = 24
const SLOW = 0.5
const onTick = (t, every) => Math.round(t / every) * every
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
// A slow drift in discrete steps (one every SLOW seconds), there and back on an
// eased curve.
function stepDrift(dx, dy, dur, steps, begin = 0) {
  dur = Math.round(dur)
  steps = Math.round(dur / SLOW)
  begin = onTick(begin, SLOW)
  const vals = []
  for (let i = 0; i < steps; i++) {
    const t = (1 - Math.cos((i / steps) * Math.PI * 2)) / 2
    vals.push(`${n0(dx * t)} ${n0(dy * t)}`)
  }
  const start = begin ? ` begin="${n1(begin)}s"` : ''
  return `<animateTransform attributeName="transform" type="translate" values="${vals.join(';')}" dur="${dur}s"${start} repeatCount="indefinite" calcMode="discrete"/>`
}
// An opacity that swells and fades in discrete steps (dur / steps on the clock).
function stepPulse(lo, hi, dur, steps, begin = 0) {
  const vals = []
  for (let i = 0; i < steps; i++) vals.push(n2(lo + (hi - lo) * (1 - Math.cos((i / steps) * Math.PI * 2)) / 2))
  return ao(vals.join(';'), dur, begin, '', 'discrete')
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
const massif = (line, bottom) => `M${pts(line)}L${n0(line[line.length - 1][0])} ${bottom}L${n0(line[0][0])} ${bottom}Z`

// ---------------------------------------------------------------- shapes, defined once

// A spruce of unit height 100, base at (0, 0): one dense silhouette with a ragged
// edge. Down each side the outline steps out to a drooping bough tip and back in,
// with small needle teeth between, the tips uneven. A few small patches of snow
// on the boughs take the placed colour (currentColor).
function spruce(seed, tiers, wide, snowAmt, frost = 0) {
  const rng = mulberry32(seed)
  const side = (s) => {
    const out = []
    for (let i = 0; i < tiers; i++) {
      const t = (i + 1) / tiers
      const y = -100 + t * 96
      const reach = 100 * wide * (0.12 + 0.88 * Math.pow(t, 0.85)) * (0.75 + rng() * 0.45)
      const yIn = y - (96 / tiers) * (0.9 + rng() * 0.3)
      out.push([s * reach * 0.45, yIn], [s * reach * 0.8, y - 2 - rng() * 2], [s * reach, y + reach * 0.12 * rng()])
    }
    return out
  }
  const r = side(1)
  const l = side(-1).reverse()
  const body = `M0 -106L${pts(r.map(([x, y]) => [x, y]))}L${n0(r[r.length - 1][0] * 0.3)} 0L${n0(l[0][0] * 0.3)} 0L${pts(l)}Z`
  let snow = ''
  for (const [x, y] of [...r, ...l]) {
    if (rng() > snowAmt || Math.abs(x) < 3) continue
    const w = Math.abs(x) * (0.35 + rng() * 0.3)
    const sx = Math.sign(x)
    snow += `M${n0(x - sx * w)} ${n0(y - 3)}q${n0(sx * w * 0.5)} -3 ${n0(sx * w)} 1l${n0(-sx * w * 0.4)} 2z`
  }
  const b = body.replace(/(\d)\.\d+/g, '$1')
  return `<path d="${b}"/>` + (frost ? `<path d="${b}" fill="url(#v-frost)" opacity="${frost}"/>` : '') + (snow ? `<path d="${snow}" fill="currentColor"/>` : '')
}

// A small far fir of unit height 30, base at (0, 0): a jagged spike.
function spikeShape(seed, h, n) {
  const rng = mulberry32(seed)
  const w = h * (0.17 + rng() * 0.06)
  let r = ''
  let l = ''
  for (let i = 1; i <= n; i++) {
    const k = w * (i / n) * (0.75 + rng() * 0.5)
    const y = -h + (i / n) * h
    r += `L${n1(k)} ${n1(y)}L${n1(k * 0.35)} ${n1(y - (h / n) * 0.25)}`
    l = `L${n1(-k * 0.35)} ${n1(y - (h / n) * 0.25)}L${n1(-k)} ${n1(y)}` + l
  }
  return `<path d="M0 ${-h}${r}L0 0${l}Z"/>`
}

// A clump of far firs around (0, 0): a crowd of spikes, the tallest in the middle.
function clumpShape(seed, n, wid) {
  const rng = mulberry32(seed)
  const list = []
  for (let i = 0; i < n; i++) {
    const u = (rng() - 0.5) * 2
    const s = (1 - Math.abs(u) * 0.45) * (0.6 + rng() * 0.7)
    list.push([rng() * 8 + Math.abs(u) * 5, use(`s${Math.floor(rng() * 4)}`, u * wid, 0, s, rng() < 0.5)])
  }
  list.sort((p, q) => p[0] - q[0])
  return list.map(([, u]) => u.replace(/ 0\)"\/>$/, ` ${0})"/>`)).join('')
}

// A tangle of bare brush of unit height 100, base at (0, 0): stems forking into twigs.
// Its strokes keep their width however it is scaled.
function brushShape(seed, stems, spread) {
  const rng = mulberry32(seed)
  let thick = ''
  let thin = ''
  const grow = (x0, y0, ang, len, depth) => {
    const x1 = x0 + Math.cos(ang) * len
    const y1 = y0 + Math.sin(ang) * len
    const bx = (rng() - 0.5) * len * 0.35
    const seg = `M${n0(x0)} ${n0(y0)}q${n0((x1 - x0) / 2 + bx)} ${n0((y1 - y0) / 2)} ${n0(x1 - x0)} ${n0(y1 - y0)}`
    if (depth < 2) thick += seg
    else thin += seg
    if (depth >= 4 || len < 8) return
    const kids = rng() < 0.2 ? 1 : 2
    for (let k = 0; k < kids; k++) grow(x1, y1, ang + (rng() - 0.5) * spread, len * (0.62 + rng() * 0.2), depth + 1)
  }
  for (let s = 0; s < stems; s++) grow((rng() - 0.5) * 24, 0, -Math.PI / 2 + (rng() - 0.5) * 1.1, 34 + rng() * 10, 0)
  return `<path d="${thick}" fill="none" stroke-width="1.8" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="${thin}" fill="none" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`
}

// A low shrub of unit width 100, base at (0, 0): a ragged dark mass with twig tips
// along its outline, snow lying in flat drifts on its upper surfaces (currentColor).
function bushShape(seed, snowAmt) {
  const rng = mulberry32(seed)
  const ptsL = []
  const N = 34
  const hh = 30 + rng() * 25
  for (let i = 0; i <= N; i++) {
    const a = Math.PI + (i / N) * Math.PI
    const r = 0.75 + rng() * 0.3 + (i % 3 === 0 ? 0.12 : 0)
    ptsL.push([Math.cos(a) * 52 * r, Math.sin(a) * hh * r])
  }
  // Snow lies along the top edge in broken runs, and in thinner runs inside the mass.
  let snow = ''
  let inner = ''
  // The outline averaged over its neighbours, so the snow lies smooth over the twigs.
  const smooth = ptsL.map((p, i) => {
    const q = ptsL[Math.max(0, i - 1)]
    const r = ptsL[Math.min(N, i + 1)]
    return [(q[0] + p[0] * 2 + r[0]) / 4, (q[1] + p[1] * 2 + r[1]) / 4]
  })
  for (let i = 1; i < N - 2; i++) {
    if (rng() > snowAmt) continue
    const len = 3 + Math.floor(rng() * 6)
    const run = smooth.slice(i, Math.min(N, i + len))
    if (run.length < 3) continue
    // A cap: the outline on top, a line a little inside it below, thickest mid-run.
    const k = run.length - 1
    const under = run.map(([x, y], j) => {
      const t = Math.sin((j / k) * Math.PI)
      return [x * (1 - 0.04 * t), y * (1 - (0.05 + 0.06 * rng()) * t) + 1]
    })
    snow += `M${pts(run.map(([x, y]) => [x, y + 1]))}L${pts(under.reverse())}Z`
    if (rng() < 0.5) {
      const m = run.map(([x, y]) => [x * 0.68, y * 0.6 + 3])
      inner += `M${pts(m)}L${pts(m.map(([x, y], j) => [x, y + 2.5 * Math.sin((j / k) * Math.PI)]).reverse())}Z`
    }
    i += len
  }
  let twigs = ''
  for (let i = 1; i < N; i += 2) {
    const [x, y] = ptsL[i]
    twigs += `M${n0(x)} ${n0(y)}l${n0(x * 0.08 + (rng() - 0.5) * 6)} ${-n0(4 + rng() * 9)}`
  }
  // A ragged foot, so the shrub sinks into the snow and does not stand on a line.
  const foot = []
  for (let x = 50; x >= -50; x -= 10) foot.push([x, 2 + rng() * 6])
  const mass = `M${pts(ptsL)}L${pts(foot)}Z`
  return `<path d="${mass}"/><path d="${mass}" fill="url(#v-frost)" opacity="0.55"/><path d="${twigs}" fill="none" stroke-width="1" vector-effect="non-scaling-stroke"/>` +
    `<path d="${snow}" fill="currentColor"/><path d="${inner}" fill="currentColor" opacity="0.55"/>`
}

function symbols() {
  let out = ''
  // Spruces: tall and narrow, fuller, very narrow, and a small snowy one.
  out += `<symbol id="t0" overflow="visible">${spruce(1, 15, 0.21, 0.25)}</symbol>`
  // The fuller one is the first, widened and shortened, mirrored: it costs no new path.
  out += `<symbol id="t1" overflow="visible"><use href="#t0" transform="matrix(-1.2 0 0 .92 0 0)"/></symbol>`
  out += `<symbol id="t2" overflow="visible">${spruce(3, 14, 0.18, 0.2)}</symbol>`
  out += `<symbol id="t3" overflow="visible">${spruce(4, 10, 0.32, 0.15, 0.7)}</symbol>`
  // Far firs: four spikes of different heights, and clumps of them.
  for (let i = 0; i < 4; i++) out += `<symbol id="s${i}" overflow="visible">${spikeShape(10 + i, 20 + i * 9, 3 + (i > 1 ? 1 : 0))}</symbol>`
  for (let i = 0; i < 6; i++) out += `<symbol id="c${i}" overflow="visible">${clumpShape(40 + i, 5 + i * 2, 16 + i * 6)}</symbol>`
  // Brush tangles.
  for (let i = 0; i < 4; i++) out += `<symbol id="b${i}" overflow="visible">${brushShape(20 + i, 3 + (i % 2), 1.0 + i * 0.12)}</symbol>`
  // Shrubs with more and less snow.
  for (let i = 0; i < 4; i++) out += `<symbol id="u${i}" overflow="visible">${bushShape(30 + i, [0.15, 0.4, 0.7, 0.25][i])}</symbol>`
  return out
}

// ---------------------------------------------------------------- the sky

// A grey storm sky: bright over the left and the middle, heavy and dark over the
// castle, with long pale streaks falling from the upper left toward the pass.
function sky() {
  const rng = mulberry32(8)
  let dark = ''
  let light = ''
  for (let i = 0; i < 16; i++) dark += blob('v-cd', 1000 + rng() * 650, rng() * 260, 220 + rng() * 260, 40 + rng() * 50, 0.3 + rng() * 0.3, -22 - rng() * 12)
  for (let i = 0; i < 10; i++) dark += blob('v-cd', 80 + rng() * 900, 80 + rng() * 240, 220 + rng() * 240, 30 + rng() * 40, 0.08 + rng() * 0.12, 20 + rng() * 14)
  for (let i = 0; i < 10; i++) light += blob('v-cl', 100 + rng() * 800, 40 + rng() * 300, 200 + rng() * 200, 45 + rng() * 50, 0.15 + rng() * 0.2, 14 + rng() * 22)
  // Broken cloud: mid-size patches, darker and lighter, at mixed angles.
  for (let i = 0; i < 40; i++) {
    const x = rng() * W
    const y = rng() * 330
    const dk = rng() < 0.5 + x / 3200
    ;(dk ? (dark += blob('v-cd', x, y, 50 + rng() * 110, 18 + rng() * 34, 0.12 + rng() * 0.2, -30 + rng() * 60)) : (light += blob('v-cl', x, y, 50 + rng() * 110, 18 + rng() * 34, 0.15 + rng() * 0.25, -30 + rng() * 60)))
  }
  // Long faint shafts from the pass up to the left.
  for (const [cx, cy, rx, op, rot] of [[430, 200, 420, 0.18, 38], [300, 260, 380, 0.14, 30]]) light += blob('v-cl', cx, cy, rx, 70, op, rot)
  let drift1 = ''
  let drift2 = ''
  for (let i = 0; i < 6; i++) drift1 += blob('v-cd', 850 + rng() * 800, 60 + rng() * 250, 200 + rng() * 200, 26 + rng() * 30, 0.25 + rng() * 0.2, -20 - rng() * 10)
  for (let i = 0; i < 6; i++) drift2 += blob('v-cl', 100 + rng() * 900, 80 + rng() * 260, 200 + rng() * 220, 20 + rng() * 26, 0.2 + rng() * 0.2, 24 + rng() * 10)
  return `<rect width="${W}" height="${H}" fill="url(#v-sky)"/>` +
    `<rect width="${W}" height="${H}" fill="url(#v-skyR)"/>` +
    dark + light +
    `<g>${stepDrift(90, 0, 110, 220)}${drift1}</g><g>${stepDrift(-70, 0, 90, 180, -30)}${drift2}</g>` +
    `<g>${stepPulse(0.85, 1, 18, 18)}${blob('v-glow', 700, 468, 460, 250, 1)}</g>`
}

// ---------------------------------------------------------------- the mountains

function mountains() {
  const far = ridge([[480, 520], [560, 478], [606, 452], [630, 437], [646, 441], [666, 456], [690, 480], [720, 492], [760, 488], [800, 500]], 0.22, 3)
  const right = ridge([[712, 520], [742, 463], [790, 446], [832, 428], [885, 404], [935, 382], [990, 376], [1050, 392], [1120, 425], [1220, 470]], 0.2, 5)
  const midL = ridge([[250, 300], [330, 292], [400, 286], [450, 314], [515, 340], [562, 392], [600, 432], [630, 452], [660, 480], [700, 530]], 0.2, 7)
  const left = ridge([[0, 196], [30, 214], [60, 250], [100, 272], [156, 290], [200, 296], [237, 287], [281, 296], [325, 294], [375, 306], [420, 360], [460, 440], [500, 560]], 0.25, 11)
  const rng = mulberry32(13)
  let leftFace = ''
  for (let i = 0; i < 22; i++) leftFace += blob(rng() < 0.15 ? 'v-cl' : 'v-cd', 10 + rng() * 430, 230 + rng() * 190, 40 + rng() * 70, 5 + rng() * 7, 0.2 + rng() * 0.25, 12 + rng() * 22)
  for (let i = 0; i < 5; i++) leftFace += blob('v-fog', 300 + rng() * 260, 360 + rng() * 120, 120 + rng() * 120, 30 + rng() * 30, 0.5 + rng() * 0.3, 20)
  let rightFace = ''
  for (let i = 0; i < 8; i++) rightFace += blob(rng() < 0.6 ? 'v-cl' : 'v-cd', 780 + rng() * 360, 410 + rng() * 60, 30 + rng() * 60, 5 + rng() * 9, 0.3 + rng() * 0.3, -32 - rng() * 14)
  const back = ridge([[960, 420], [1040, 372], [1130, 350], [1220, 318], [1300, 300], [1400, 268], [1480, 280], [1560, 246], [1620, 236]], 0.22, 17)
  return `<path d="${massif(back, 620)}" fill="url(#v-m-back)"/>` +
    `<clipPath id="v-mL"><path d="${massif(left, 620)}"/></clipPath><clipPath id="v-mR"><path d="${massif(right, 620)}"/></clipPath>` +
    `<path d="${massif(far, 620)}" fill="url(#v-m-far)"/>` +
    `<path d="${massif(right, 620)}" fill="url(#v-m-right)"/>` +
    `<g clip-path="url(#v-mR)">${rightFace}</g>` +
    `<path d="${massif(midL, 620)}" fill="url(#v-m-mid)"/>` +
    `<path d="${massif(left, 620)}" fill="url(#v-m-left)"/>` +
    `<g clip-path="url(#v-mL)">${leftFace}</g>` +
    blob('v-glow', 700, 470, 240, 90, 0.55) +
    `<rect y="380" width="${W}" height="260" fill="url(#v-haze)"/>`
}

// ---------------------------------------------------------------- the castle

// An original gothic castle on the ridge to the right, seen from below: a low west
// wing with turrets, a tall keep crowned by a cluster of spires, a long roofed hall,
// and an east block with a high bell tower. It is drawn flat, then every point goes
// through a perspective: its west end is further away (smaller and lower), so its
// lines rise toward the east, and its towers lean in a little as they rise. A few
// windows glow; snow lies on the roofs; fog wraps its feet and drifts through it.
// The castle in two-point perspective, seen from below. Its long front (the west
// wing, the keep and the hall) runs away to a vanishing point just left of it, at
// (940, 480) on the horizon; the east block beside the bell tower turns to a second
// vanishing point far to the right. A shape is drawn at its screen x; its heights
// are given as they would be at the near corner (x 1443) and shrink toward the
// horizon by the corner's distance to the vanishing point, so every horizontal line
// on a face runs to that face's vanishing point. T(x, y) gives the drawn height that
// lands at screen y for a shape at x.
const HZ = 480
const VPL = 940
const VPR = 2270
const CORNER = 1443
const sP = (x) => (x <= CORNER ? (x - VPL) / (CORNER - VPL) : (VPR - x) / (VPR - CORNER))
// `at` set: the point belongs to a round tower or a spire standing at x = at, which
// scales as one object, not as part of a receding face.
function castleP(x, y, at) {
  return [x, HZ - (HZ - y) * sP(at ?? x)]
}
const T = (x, y) => HZ - (HZ - y) / sP(x)
function castle() {
  const body = []
  const side = []
  const shade = []
  const snow = []
  const win = []
  const fins = []
  const ledge = []
  const under = []
  let at
  const poly = (list, ps) => list.push('M' + ps.map(([x, y]) => castleP(x, y, at).map(n0).join(' ')).join('L') + 'Z')
  const line = (list, ps) => list.push('M' + ps.map(([x, y]) => castleP(x, y, at).map(n0).join(' ')).join('L'))
  // Draw `fn` as one upright object standing at x = ax.
  const upright = (ax, fn) => {
    at = ax
    fn()
    at = undefined
  }
  const R = (x, y, w, h, list = body) => poly(list, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]])
  // A steep spire: sides that curve in toward the tip, a finial above it.
  const cone = (cx, y, w, h, fin = 10, snowy = h > 28) => upright(at ?? cx, () => {
    const l = []
    const r = []
    const n = h > 30 ? 5 : 3
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const k = Math.pow(1 - t, 1.35)
      l.push([cx - (w / 2) * k, y - h * t])
      r.unshift([cx + (w / 2) * k, y - h * t])
    }
    poly(body, [...l, ...r])
    if (h > 50) for (let t = 0.2; t < 0.85; t += 0.16) {
      const k = Math.pow(1 - t, 1.35) * (w / 2)
      const yy = y - h * t
      poly(body, [[cx - k, yy], [cx - k - 3, yy - 2], [cx - k + 1, yy - 5]])
      poly(body, [[cx + k, yy], [cx + k + 3, yy - 2], [cx + k - 1, yy - 5]])
    }
    poly(shade, [[cx, y - h], ...r.slice(1), [cx + w * 0.08, y]])
    line(fins, [[cx, y - h], [cx, y - h - fin]])
    if (snowy) line(snow, l.slice(0, n))
  })
  const turret = (cx, top, bottom, w, roofH) => {
    R(cx - w / 2, top, w, bottom - top)
    R(cx - w / 2 - 2, top - 4, w + 4, 5)
    cone(cx, top - 4, w + 6, roofH)
    R(cx + w * 0.1, top, w * 0.4, bottom - top, shade)
  }
  // A gabled front with its roof running back to the east (the side seen in depth).
  const gable = (x, top, w, bottom, roofH, depth = 0, snowy = true) => {
    R(x, top, w, bottom - top)
    poly(body, [[x - 3, top], [x + w / 2, top - roofH], [x + w + 3, top]])
    if (depth) {
      poly(side, [[x + w / 2, top - roofH], [x + w / 2 + depth, top - roofH], [x + w + 3 + depth, top], [x + w + 3, top]])
      if (snowy) line(snow, [[x + w / 2 + 1, top - roofH], [x + w / 2 + depth, top - roofH]])
    } else poly(shade, [[x + w / 2, top - roofH], [x + w + 3, top], [x + w / 2, top]])
    if (snowy) line(snow, [[x - 2, top - 1], [x + w / 2, top - roofH + 1]])
  }
  const lancet = (x, y, w, h, lit) => {
    const ps = [[x, y + h], [x, y + w / 2], [x + w * 0.15, y], [x + w / 2, y - w * 0.35], [x + w * 0.85, y], [x + w, y + w / 2], [x + w, y + h]]
    poly(lit ? win : shade, ps)
  }
  // A tall traceried window: a pointed opening, a mullion, a round light in its head.
  const tracery = (x, y, w, h, lit) => {
    lancet(x, y, w, h, lit)
    line(side, [[x + w / 2, y + w * 0.4], [x + w / 2, y + h]])
    line(side, [[x, y + h * 0.55], [x + w, y + h * 0.55]])
  }
  // Crenels along a wall top.
  const crenels = (x0, x1, y, step = 8) => {
    for (let x = x0; x < x1 - 3; x += step) R(x, y - 5, step / 2, 6)
  }
  // Buttresses: narrow stepped piers against a wall.
  const pier = (x, top, bottom) => {
    R(x, top, 5, bottom - top, side)
    poly(side, [[x, top], [x + 2.5, top - 8], [x + 5, top]])
  }

  // The rock under the castle, drawn on screen as it is (it lies below the horizon).
  const rockTop = ridge([[1030, 520], [1062, 470], [1100, 458], [1180, 450], [1260, 446], [1330, 440], [1420, 432], [1520, 428], [1620, 422]], 0.3, 71, 3)
  body.push('M' + pts([...rockTop, [1620, 580], [1030, 580]]) + 'Z')
  // A ledge across a face: a line of snow on it and a line of shadow below it.
  const course = (x0, x1, y) => {
    line(ledge, [[x0, y], [x1, y]])
    line(under, [[x0, y + 3], [x1, y + 3]])
  }
  // The west wing: a long hall under a steep roof, four slim turrets.
  const we = T(1110, 395)
  const wr = T(1110, 371)
  R(1088, we, 112, HZ + 40 - we)
  poly(side, [[1086, we], [1092, wr], [1202, wr], [1202, we]])
  line(snow, [[1088, we - 1], [1093, wr], [1200, wr]])
  crenels(1088, 1200, we, 6)
  for (let x = 1100; x < 1196; x += 18) {
    tracery(x, we + 30, 7, 40, x === 1136)
    tracery(x, we + 110, 7, 40, false)
  }
  for (const k of [22, 96, 170]) course(1088, 1200, we + k)
  for (const [cx, base, tip, w] of [[1095, 372, 343, 12], [1124, 368, 345, 8], [1148, 355, 323, 12], [1185, 330, 295, 13]]) {
    const yb = T(cx, base)
    upright(cx, () => {
      R(cx - w / 2, yb, w, HZ + 40 - yb)
      R(cx - w / 2 - 2, yb - 4, w + 4, 5)
      R(cx + w * 0.1, yb, w * 0.4, HZ + 40 - yb, shade)
      cone(cx, yb - 4, w + 6, yb - 4 - T(cx, tip), 8)
    })
  }
  // The keep: a dark mass crowned by a drum and a cluster of spires, a steep roof
  // falling away on its east side.
  // Everything of the keep scales as one object standing at x 1250.
  const K = (y) => T(1250, y)
  upright(1250, () => {
    const kt = K(214)
    R(1203, kt, 60, HZ + 40 - kt)
    R(1244, kt, 19, HZ + 40 - kt, shade)
    crenels(1201, 1265, kt, 6)
    // A steep roof falling away from the crown toward the middle turret, a wall below.
    R(1262, K(300), 40, HZ + 40 - K(300))
    poly(side, [[1256, K(300)], [1263, K(188)], [1304, K(300)]])
    poly(shade, [[1263, K(188)], [1304, K(300)], [1286, K(300)]])
    // The crown: a drum and a tall spire, ringed by pinnacles.
    R(1209, K(196), 30, kt - K(196))
    R(1227, K(196), 12, kt - K(196), shade)
    cone(1224, K(196), 34, K(196) - K(136), 18)
    for (const [cx, base, tip, w] of [[1205, 220, 190, 8], [1212, 198, 178, 6], [1237, 198, 172, 7], [1246, 214, 182, 9], [1258, 214, 190, 7], [1230, 214, 196, 5], [1218, 214, 198, 5]]) cone(cx, K(base), w, K(base) - K(tip), 5, false)
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) tracery(1210 + i * 22, kt + 30 + j * 60, 9, 42, i === 0 && j === 1)
  })
  // The middle turret with its flared spire, and a small spire beside it.
  const mb = T(1325, 292)
  upright(1325, () => {
    R(1309, mb, 32, HZ + 40 - mb)
    R(1328, mb, 13, HZ + 40 - mb, shade)
    cone(1325, mb, 40, mb - T(1325, 232), 10)
  })
  cone(1310, T(1310, 300), 9, T(1310, 300) - T(1310, 266), 5, false)
  // The long hall, its roof running to the left vanishing point, dormers along it.
  const he = T(1443, 332)
  const hr = T(1443, 302)
  R(1298, he, 145, HZ + 40 - he)
  poly(side, [[1296, he], [1302, hr], [1445, hr], [1445, he]])
  line(snow, [[1298, he - 1], [1303, hr], [1443, hr]])
  for (let x = 1315; x < 1435; x += 26) gable(x, hr + 14, 10, he, 12, 0, false)
  for (let x = 1304; x < 1440; x += 17) tracery(x, he + 24, 7, 40, x === 1372)
  for (let x = 1306; x < 1440; x += 34) {
    pier(x, he + 70, HZ + 40)
    cone(x + 2.5, he + 70, 6, 14, 4, false)
  }
  for (let x = 1304; x < 1440; x += 17) tracery(x, he + 90, 7, 34, false)
  for (const k of [16, 80]) course(1298, 1443, he + k)
  // The spire at the hall's east end.
  const rb = T(1415, 310)
  upright(1415, () => {
    R(1403, rb, 24, HZ + 40 - rb)
    R(1417, rb, 10, HZ + 40 - rb, shade)
    cone(1415, rb, 32, rb - T(1415, 257), 10)
  })
  // The east block, turned to the right vanishing point: a gabled front at the
  // corner, a long roof behind, rows of tall windows, chimneys.
  const ee = T(1520, 290)
  const er = T(1520, 238)
  R(1443, ee, 170, HZ + 40 - ee)
  R(1530, ee, 83, HZ + 40 - ee, shade)
  poly(side, [[1500, ee], [1512, er], [1614, er], [1614, ee]])
  line(snow, [[1512, er], [1610, er]])
  crenels(1500, 1612, ee, 7)
  gable(1443, T(1443, 272), 60, HZ + 40, T(1443, 272) - T(1443, 226), 0)
  for (let x = 1450; x < 1600; x += 22) {
    tracery(x, ee + 30, 9, 44, x === 1538)
    tracery(x, ee + 110, 9, 40, false)
  }
  for (const k of [18, 96]) course(1443, 1612, ee + k)
  for (const cx of [1560, 1596]) { R(cx - 4, er - 22, 8, 24); cone(cx, er - 22, 11, 18, 5, false) }
  // The bell tower: a shaft, a wide lantern with open arches, a flared cap.
  const lt = T(1481, 158)
  const lb = T(1481, 210)
  upright(1481, () => {
    R(1459, lb, 44, T(1481, 280) - lb)
    R(1484, lb, 19, T(1481, 280) - lb, shade)
    R(1449, lt, 64, lb - lt)
    R(1484, lt, 29, lb - lt, shade)
    R(1445, lt - 5, 72, 7)
    R(1447, lb, 68, 6)
    for (let i = 0; i < 3; i++) lancet(1455 + i * 18, lt + 10, 9, lb - lt - 18, false)
    cone(1481, lt - 5, 62, lt - 5 - T(1481, 118), 18)
  })
  // Fog: a veil over the whole castle, banks across its feet, wisps through its middle.
  const rng = mulberry32(61)
  let veil = ''
  // A sea of fog over the lower floors: wide billows, thickest at the bottom, so only
  // the towers and the roofs rise clear.
  for (let i = 0; i < 12; i++) veil += blob('v-fog', 1050 + i * 48 + rng() * 40, 385 + rng() * 85, 60 + rng() * 120, 26 + rng() * 44, 0.55 + rng() * 0.4, -35 + rng() * 40)
  // Plumes rising up and to the right between the towers.
  for (const [cx, cy, rx, op] of [[1160, 360, 120, 0.35], [1290, 340, 140, 0.3], [1400, 335, 110, 0.28], [1520, 320, 130, 0.22]]) veil += blob('v-fog', cx, cy, rx, 26 + rx * 0.12, op, -48)
  for (let i = 0; i < 8; i++) veil += blob('v-fog', 1100 + rng() * 480, 300 + rng() * 130, 110 + rng() * 120, 40 + rng() * 30, 0.08 + rng() * 0.1, -22 - rng() * 10)
  return `<defs><path id="v-cb" d="${body.join('')}"/></defs><use href="#v-cb" fill="#323a4b"/>` +
    `<path d="${side.join('')}" fill="#272e3c"/><path d="${fins.join('')}" stroke="#3f485b" stroke-width="1.4"/>` +
    `<use href="#v-cb" fill="url(#v-stone)"/>` +
    `<path d="${shade.join('')}" fill="#262e3d" opacity="0.6"/>` +
    `<path d="${snow.join('')}" fill="none" stroke="#c9d0dc" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>` +
    `<path d="${under.join('')}" stroke="#1c222e" stroke-width="2" opacity="0.6"/><path d="${ledge.join('')}" stroke="#b4bccb" stroke-width="1.4" opacity="0.55"/>` +
    `<path d="${win.join('')}" fill="#cbb58c" opacity="0.3">${ao('0.3;0.18;0.34;0.25', 10, 0, '0;0.4;0.6;0.8', 'discrete')}</path>` +
    blob('v-fog', 1330, 460, 380, 60, 0.7) +
    veil +
    `<g>${stepDrift(70, -20, 50, 100)}${blob('v-fog', 1250, 330, 170, 50, 0.22, -24)}${blob('v-fog', 1500, 300, 150, 46, 0.18, -26)}</g>` +
    `<g>${stepDrift(-60, 0, 64, 128, -20)}${blob('v-fog', 1180, 420, 230, 46, 0.5, -6)}${blob('v-fog', 1480, 410, 210, 42, 0.45, -4)}</g>`
}

// ---------------------------------------------------------------- the valley

// A fog bank: a wide soft ellipse that drifts in slow steps.
const bank = (cx, cy, rx, ry, op, dx, dur, begin = 0) =>
  `<g>${stepDrift(dx, 0, dur, Math.round(dur * 2), begin)}${blob('v-fog', cx, cy, rx, ry, op)}</g>`

// A clump of firs: one of the clump shapes, at its own size, perhaps mirrored.
const clump = (rng, cx, cy, big = 1) => use(`c${Math.floor(rng() * 6)}`, cx, cy, big * (0.7 + rng() * 0.6), rng() < 0.5)

// A house in the valley, below the eye: its front faces us, its side runs back
// toward a vanishing point on the right, so roof lines rise as they recede. Styles:
// 0, a gable end in front; 1, a long side in front, the roof plane above it; 2, a
// tall narrow house. Returns [walls, side walls, lit roofs, dark roofs, windows].
const VP = [2600, 470]
function house(rng, x, y, w, style) {
  const toVP = ([px, py], d) => {
    const f = d / (VP[0] - px)
    return [px + (VP[0] - px) * f, py + (VP[1] - py) * f]
  }
  const P = (ps) => 'M' + ps.map(([a, b]) => `${n0(a)} ${n0(b)}`).join('L') + 'Z'
  const h = style === 2 ? w * (1.1 + rng() * 0.4) : w * (0.45 + rng() * 0.25)
  const d = w * (0.5 + rng() * 0.6)
  const g = w * (0.55 + rng() * 0.3)
  const A = [x, y]
  const B = [x + w, y]
  const C = [x + w, y - h]
  const D = [x, y - h]
  const out = ['', '', '', '', '']
  if (style === 1) {
    // The long side in front; the roof slopes back from its eave; a gable at the end.
    const Cb = toVP(C, d)
    const Bb = toVP(B, d)
    const ridgeL = [x + w * 0.05, y - h - g * 0.6]
    const ridgeR = [x + w * 0.95, y - h - g * 0.6]
    out[0] += P([A, B, C, D])
    out[1] += P([B, Bb, Cb, C])
    out[2] += P([[D[0] - 3, D[1]], [C[0] + 3, C[1]], toVP(ridgeR, d * 0.5), toVP(ridgeL, d * 0.5)])
    out[3] += P([C, Cb, toVP(ridgeR, d * 0.5)])
  } else {
    // The gable end in front; the roof's far slope seen running back.
    const E = [x + w / 2, y - h - g]
    const Eb = toVP(E, d)
    const Cb = toVP(C, d)
    out[0] += P([A, B, C, E, D])
    out[1] += P([B, toVP(B, d), Cb, C])
    out[2] += P([[E[0], E[1] - 1], Eb, [Cb[0] + 2, Cb[1]], [C[0] + 3, C[1] + 1]])
    out[3] += P([[D[0] - 3, D[1] + 1], [E[0], E[1] - 1], [E[0] + 1, E[1] + 3], [D[0], D[1] + 3]])
    if (rng() < 0.5) out[1] += P([[E[0] + d * 0.3, E[1] + g * 0.25], [E[0] + d * 0.3 + 4, E[1] + g * 0.28], [E[0] + d * 0.3 + 4, E[1] - 6], [E[0] + d * 0.3, E[1] - 6]])
  }
  // Windows: a row of small panes, now and then one lit.
  const rows = style === 2 ? 2 : 1
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < Math.max(1, Math.floor(w / 9)); k++) {
      const wx = x + 3 + k * 9
      const wy = y - h * (0.65 - r * 0.4)
      if (wx + 3 > x + w - 2) break
      out[rng() < 0.12 ? 4 : 1] += `M${n0(wx)} ${n0(wy)}h3v4h-3z`
    }
  }
  return out
}

// The valley: the forested hill under the castle, the village spread over the slope
// and the valley floor, clumps of firs, open snow between them, and fog in layers.
function valley() {
  const rng = mulberry32(21)
  const hillTop = (x) => (x < 1060 ? 512 + (1060 - x) * 0.4 : 512 - (x - 1060) * 0.04)
  const hillLine = ridge([[840, 600], [900, 566], [960, 540], [1010, 524], [1060, 512], [1200, 506], [1400, 498], [1600, 490]], 0.14, 23, 4)
  let out = `<path d="M${pts(hillLine)}L1600 900L840 900Z" fill="url(#v-hill)"/>`
  // The castle slope: dense dark forest running down from under the walls.
  let slope = ''
  for (let i = 0; i < 26; i++) {
    const x = 1000 + rng() * 600
    slope += clump(rng, x, hillTop(x) + 4 + rng() * 26, 1.1)
  }
  out += `<g fill="#3e475a">${slope}</g>`
  // Firs along the hill's edge, so it reads as forest and not as a cut.
  for (const [x, y] of hillLine.filter((_, i) => i % 6 === 3)) out += `<g fill="#68738b">${clump(rng, x, y + 8, 0.8)}</g>`
  // Depth bands, far to near: each with clumps of firs and houses in its own tone.
  const bands = [
    // [y range, x range, fir colour, house colours, clumps, houses]
    [[505, 545], [960, 1600], '#56617a', ['#5e687f', '#525b71', '#99a2b4', '#5a6379'], 9, 7],
    [[545, 585], [880, 1600], '#4a556c', ['#525c72', '#465065', '#8d97a9', '#4b5469'], 10, 9],
    [[565, 625], [640, 1600], '#404a5f', ['#475066', '#3b4457', '#838c9f', '#40495c'], 11, 12],
    [[630, 700], [700, 1600], '#363f53', ['#3d4659', '#30384a', '#7a8497', '#353d4f'], 10, 12],
  ]
  const fogs = [
    bank(1300, 512, 380, 22, 0.45, 80, 70) + bank(1000, 530, 240, 24, 0.5, -60, 56, -20),
    bank(1200, 575, 480, 30, 0.5, -70, 66, -12) + blob('v-fog', 1500, 570, 200, 26, 0.4),
    bank(900, 610, 460, 34, 0.5, 60, 72, -30) + blob('v-fog', 1300, 600, 320, 50, 0.55) + blob('v-fog', 1450, 640, 220, 40, 0.4),
    bank(1150, 680, 460, 40, 0.5, -50, 60, -8),
  ]
  // The far valley floor in front of the pass: pale firs fading into the glare.
  const farLine = (x) => 592 - Math.max(0, 380 - Math.abs(x - 700)) * 0.05
  let far = `<path d="M360 600L${pts(Array.from({ length: 36 }, (_, i) => [360 + i * 20, farLine(360 + i * 20) + 4]))}L1060 900L360 900Z" fill="#a3abbe"/><g fill="#98a1b6">`
  for (let x = 380; x < 1040; x += 50 + rng() * 60) far += clump(rng, x, farLine(x), 0.7)
  far += '</g>'
  bands.forEach(([[y0, y1], [x0, x1], fc, hc, nc, nh], bi) => {
    const items = []
    for (let i = 0; i < nc; i++) {
      const x = x0 + rng() * (x1 - x0)
      const y = Math.max(y0 + rng() * (y1 - y0), hillTop(x) + 12)
      items.push([y, `<g fill="${fc}">${clump(rng, x, y, 0.9 + bi * 0.25)}</g>`])
    }
    const hp = ['', '', '', '', '']
    for (let i = 0; i < nh; i++) {
      const x = x0 + 40 + rng() * (x1 - x0 - 60)
      const y = Math.max(y0 + rng() * (y1 - y0), hillTop(x) + 26)
      const w = (12 + rng() * 14) * (0.8 + bi * 0.25)
      const st = rng() < 0.45 ? 1 : rng() < 0.75 ? 0 : 2
      const parts = house(rng, x, y, w, st)
      parts.forEach((p, k) => (hp[k] += p))
    }
 if (bi === 2) for (const [x, y, w, st] of [[820, 668, 26, 0], [868, 660, 22, 1], [930, 650, 28, 1], [745, 676, 20, 2], [985, 644, 24, 0], [1030, 652, 22, 1]]) house(rng, x, y, w, st).forEach((p, k) => (hp[k] += p))
    items.push([y0 + 20, `<path d="${hp[0]}" fill="${hc[0]}"/><path d="${hp[1]}" fill="${hc[1]}"/><path d="${hp[2]}" fill="${hc[2]}"/><path d="${hp[3]}" fill="${hc[3]}"/><path d="${hp[4]}" fill="#e2c48e" opacity="0.5"/>`])
    items.sort((p, q) => p[0] - q[0])
    out += items.map(([, s]) => s).join('') + fogs[bi]
    if (bi === 1) out += far + bank(700, 585, 520, 40, 0.75, 70, 64, -10)
    if (bi === 2) out += church()
  })
  return out + smoke()
}

// The church: a nave with a steep snowy roof, a tower with louvred belfry and a
// needle spire, its lines in the same perspective as the houses.
function church() {
  return `<path d="M1300 640V606L1340 606V640Z" fill="#4a5469"/><path d="M1296 607L1318 586L1342 607Z" fill="#b6becc"/><path d="M1318 586L1346 590L1352 604L1342 607Z" fill="#4a5469"/>` +
    `<path d="M1338 640V560H1362V640Z" fill="#3c4558"/><path d="M1355 560L1362 560L1362 640L1355 640Z" fill="#2e3646"/>` +
    `<path d="M1334 562L1350 547L1366 562Z" fill="#3c4558"/><path d="M1341 548L1350 486L1359 548Z" fill="#3c4558"/><path d="M1350 486L1359 548L1354 548Z" fill="#2a3240"/>` +
    `<path d="M1349.4 486h1.2v-10h-1.2zM1346 481h8v1.2h-8z" fill="#3c4558"/><path d="M1342 548L1350 490" stroke="#c8d0dc" stroke-width="1.5"/>` +
    `<path d="M1343 568h4v10h-4zM1352 568h4v10h-4z" fill="#1c2430"/><path d="M1344 570h2M1344 573h2M1344 576h2M1353 570h2M1353 573h2M1353 576h2" stroke="#5a6478" stroke-width="0.8"/>`
}

// Chimney smoke: soft puffs rising and leaning in the wind.
function smoke() {
  return [[850, 650, 0], [1180, 600, -4], [1460, 590, -8], [1040, 640, -2]].map(([x, y, b]) =>
    `<g>${stepDrift(-10, -4, 12, 30, b)}${blob('v-smoke', x, y - 8, 18, 10, 0.6)}${blob('v-smoke', x - 10, y - 26, 22, 12, 0.45, -20)}${blob('v-smoke', x - 26, y - 48, 28, 14, 0.3, -30)}</g>`).join('')
}

// ---------------------------------------------------------------- the left side

// The windmill high on the left slope: a tapered tower mill whose foot sinks into
// the wooded rise, a capped top with snow on it, and four broad lattice sails on a
// plane turned away to the right, so they turn on a narrow, tilted ellipse.
function windmill() {
  let sails = ''
  for (let k = 0; k < 4; k++) {
    let lattice = 'M14 -7L84 -7L84 11L14 11Z'
    for (let s = 22; s < 84; s += 8) lattice += `M${s} -7V11`
    sails += `<g transform="rotate(${k * 90})"><path d="M14 -7H84V11H14Z" fill="#8a93a7" opacity="0.3"/><path d="${lattice}" fill="none" stroke="#545d71" stroke-width="1.8"/><path d="M0 -2.5H88V2.5H0Z" fill="#4a5266"/></g>`
  }
  return `<g>` +
    // The tower: lit left face, shaded right face, a door and two small windows.
    `<path d="M196 610L210 506L238 502L240 612Z" fill="#6a7388"/>` +
    `<path d="M238 502L256 506L272 610L240 612Z" fill="#4c5569"/>` +
    `<path d="M219 584h10v22h-10zM218 536h7v10h-7zM246 532l6 1v10l-6-1z" fill="#3a4253"/>` +
    // The cap: a curved hood with a snow crust, its rim in shade.
    `<path d="M204 508Q206 478 232 472Q258 474 262 508Z" fill="#525b70"/>` +
    `<path d="M207 498Q212 478 232 474Q248 476 254 486Q236 482 214 498Z" fill="#c3cad7"/>` +
    `<path d="M202 506H264V512H202Z" fill="#3f475a"/>` +
    // The sails on their turned plane, around the hub on the cap's front.
    `<g transform="translate(250 490) matrix(.52 .24 -.1 1 0 0)"><g>${ticked('transform', 'rotate', 11, 2, (u) => n1(u * 90))}${sails}</g></g>` +
    `<circle cx="250" cy="490" r="5" fill="#3a4253"/></g>`
}

// The firs on the left: a pale screen behind, a snowy slope, then tall dark spruces.
function leftWood() {
  const rng = mulberry32(5)
  let back = ''
  for (let x = 0; x < 640; x += 10 + rng() * 16) back += use(`t${Math.floor(rng() * 3)}`, x, 650 + rng() * 10, 0.45 + rng() * 0.6 - Math.max(0, x - 300) / 1200, rng() < 0.5)
  let mid = ''
  for (const [x, base, h, k] of [[40, 600, 150, 0], [78, 596, 130, 2], [112, 604, 150, 1], [146, 610, 120, 0], [176, 616, 96, 2], [292, 620, 80, 1], [452, 640, 88, 0], [500, 650, 70, 2]]) mid += use(`t${k}`, x, base, h / 100, x % 2 === 0)
  let near = ''
  for (const [x, base, h, k] of [[8, 660, 300, 2], [326, 668, 160, 2], [372, 672, 195, 0], [410, 676, 120, 1]]) near += use(`t${k}`, x, base, h / 100, x % 2 === 0)
  return `<g fill="#5c667c" color="#a3acbe">${back}</g>` +
    // Fog over the mill's foot and the trees behind it.
    blob('v-fog', 240, 560, 230, 55, 0.5) + blob('v-fog', 120, 520, 160, 40, 0.3) +
    // The wooded rise the windmill stands on: a mound under the mill, its crest
    // ragged with firs, a little snow in a clearing.
    `<path d="M0 588Q80 572 150 584Q200 590 232 598Q290 600 330 612Q440 640 560 700V760H0Z" fill="url(#v-rise)"/>` +
    `<g fill="#3a4357" color="#8f99ac">${[[150, 596, 70], [176, 604, 52], [196, 612, 44], [282, 610, 60], [306, 616, 84], [350, 628, 66], [400, 640, 58], [445, 656, 50], [490, 672, 44], [20, 596, 64], [70, 590, 76], [110, 592, 58], [262, 612, 40]].map(([x, y, h], i) => use(`t${i % 3}`, x, y, h / 100, i % 2 === 0)).join('')}</g>` +
    bank(300, 650, 260, 22, 0.35, 50, 44, -8) +
    `<g fill="#252e3b" color="#9aa4b4">${near}</g>`
}

// ---------------------------------------------------------------- the foreground

// The near slope: snow-covered ground falling away from the lower left, with wind
// ridges across it. On it stand dark shrubs and tangles of bare brush in uneven
// clusters, small and fogged further off, large and dark near the bottom edge;
// snowy spruces at the lower left; tall bare trees reaching up on the right.
function foreground() {
  const rng = mulberry32(77)
  const edge = (x) => 706 + x * 0.02 + Math.sin(x / 140) * 14 + Math.sin(x / 41) * 6 - Math.max(0, 400 - x) * 0.12
  const g = []
  for (let x = 0; x <= W; x += 20) g.push([x, edge(x) + rng() * 8])
  let out = blob('v-fog', 760, 660, 330, 60, 0.7) + `<path d="M0 900L${pts(g)}L${W} 900Z" fill="url(#v-ground)"/>`
  // Wind ridges: long low strokes of shade following the slope.
  let ridges = ''
  for (let i = 0; i < 12; i++) {
    const x = rng() * W
    const y = edge(x) + 30 + rng() * 140
    const w = 80 + rng() * 200
    ridges += `M${n0(x)} ${n0(y)}q${n0(w / 2)} ${n0(-6 - rng() * 6)} ${n0(w)} ${n0(4 + rng() * 6)}`
  }
  out += `<path d="${ridges}" fill="none" stroke="#5c677c" stroke-width="2" opacity="0.5"/>`
  // Brush along the far edge of the snow, small and grey in the fog.
  let far = ''
  for (let i = 0; i < 34; i++) {
    const x = 380 + rng() * 1220
    far += use(`b${Math.floor(rng() * 4)}`, x, edge(x) + 4 + rng() * 10, 0.5 + rng() * 0.6, rng() < 0.5)
  }
  out += `<g stroke="#56617a">${far}</g>`
  // A cluster: a few shrubs and brush tangles around a centre.
  const cluster = (cx, y0, k, n, kinds) => {
    let bush = ''
    let brush = ''
    for (let i = 0; i < n; i++) {
      const x = cx + (rng() - 0.5) * 140 * k
      const y = y0 + rng() * 30 * k
      bush += use(`u${kinds[Math.floor(rng() * kinds.length)]}`, x, y, k * (0.7 + rng() * 0.6), rng() < 0.5)
      if (rng() < 0.8) brush += use(`b${Math.floor(rng() * 4)}`, x + (rng() - 0.5) * 60 * k, y + 6, k * (0.8 + rng() * 0.9), rng() < 0.5)
    }
    return [bush, brush]
  }
  // The middle band, fogged a little.
  let mb = ''
  let mr = ''
  for (const cx of [470, 610, 800, 910, 1090, 1200, 1360, 1490, 1575]) {
    const [b, r] = cluster(cx, edge(cx) + 22, 0.9, 2 + Math.floor(rng() * 3), [0, 1, 3])
    mb += b
    mr += r
  }
  out += `<g fill="url(#v-bushB)" stroke="#3c4559" color="#9aa4b6">${mb}</g><g stroke="#2c3445">${mr}</g>`
  // The near band: big, dark, with gaps of snow between the clusters.
  let nb = ''
  let nr = ''
  for (const cx of [440, 650, 760, 1010, 1190, 1390, 1540]) {
    const [b, r] = cluster(cx, 830 + rng() * 30, 1.9, 2 + Math.floor(rng() * 3), [0, 3, 1])
    nb += b
    nr += r
  }
  out += `<g fill="url(#v-bushF)" stroke="#1a212c" color="#b7c0cd">${nb}</g><g stroke="#161c26">${nr}</g>`
  // Snowy spruces at the lower left, and heavy shrubs between them.
  let left = ''
  for (const [x, y, h] of [[40, 770, 175], [130, 800, 150], [225, 785, 185], [320, 830, 130], [80, 900, 190], [270, 740, 120], [175, 730, 110], [380, 790, 110], [0, 860, 150]]) left += use('t3', x, y, h / 100, rng() < 0.5)
  for (const [x, y, s] of [[170, 870, 2.2], [360, 890, 2.0], [10, 840, 1.8], [100, 760, 1.6], [300, 780, 1.5], [230, 900, 2.4], [420, 860, 1.6]]) left += use(`u${rng() < 0.5 ? 2 : 1}`, x, y, s, rng() < 0.5)
  out += `<g fill="#1d2532" color="#d6dce6">${left}</g>`
  // Tall bare trees reaching up on the right.
  let tall = ''
  for (const [x, s] of [[1400, 3.1], [1530, 2.7], [1590, 3.5], [1470, 3.8], [960, 2.1], [680, 1.9]]) tall += use(`b${Math.floor(rng() * 4)}`, x, 820, s, rng() < 0.5)
  out += `<g stroke="#1e2531">${tall}</g>`
  // Drifts at the bottom edge.
  let heaps = ''
  for (const [x0, x1, y, hgt] of [[30, 290, 906, 34], [820, 1060, 904, 44]]) {
    const top = []
    for (let i = 0; i <= 12; i++) {
      const u = i / 12
      top.push([x0 + (x1 - x0) * u, y - Math.pow(Math.sin(u * Math.PI), 0.6) * hgt * (0.8 + 0.2 * Math.sin(u * 9 + x0))])
    }
    heaps += `M${pts(top)}Z`
  }
  return out + `<path d="${heaps}" fill="url(#v-snow)"/>`
}

// ---------------------------------------------------------------- snowfall

// Falling snow: two sheets of flakes, far and near. Each sheet is a tile of flakes
// stacked three high, sliding down one tile height per loop and swaying, stepped on
// the clock.
function snowfall() {
  const rng = mulberry32(99)
  const sheet = (id, n, rMin, rMax, op, tileH, dur, sway) => {
    let d = ''
    for (let i = 0; i < n; i++) {
      const x = rng() * (W + 200) - 100
      const y = rng() * tileH
      const r = rMin + rng() * (rMax - rMin)
      d += `M${n0(x - r)} ${n0(y)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(r * 2)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-r * 2)} 0`
    }
    const move = ticked('transform', 'translate', dur, 1, (u) => `${n1(Math.sin(u * Math.PI * 2) * sway)} ${n1(-tileH + u * tileH)}`)
    return `<g opacity="${op}">${move}<path id="${id}" d="${d}"/><use href="#${id}" y="${tileH}"/><use href="#${id}" y="${tileH * 2}"/></g>`
  }
  return `<g fill="#eef2f8">${sheet('v-sn1', 46, 0.7, 1.4, 0.5, 450, 15, 24)}${sheet('v-sn2', 18, 1.6, 2.8, 0.7, 450, 9, 40)}</g>`
}

// ---------------------------------------------------------------- the scene

export function buildScene() {
  const fr = mulberry32(404)
  let frost = ''
  for (let i = 0; i < 90; i++) frost += `M${n0(fr() * 97)} ${n0(fr() * 71)}h${n0(1 + fr() * 3)}v${n0(1 + fr())}h${-n0(1 + fr() * 2)}z`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    ${symbols()}
    <linearGradient id="v-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bcc3d5"/><stop offset="0.3" stop-color="#bcc3d5"/><stop offset="0.55" stop-color="#c4cadb"/><stop offset="0.75" stop-color="#ccd1df"/></linearGradient>
    <linearGradient id="v-skyR" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0.45" stop-color="#4a5878" stop-opacity="0"/><stop offset="1" stop-color="#4a5878" stop-opacity="0.75"/></linearGradient>
    <radialGradient id="v-cd"><stop offset="0" stop-color="#4e5a74" stop-opacity="0.8"/><stop offset="0.5" stop-color="#4e5a74" stop-opacity="0.35"/><stop offset="1" stop-color="#4e5a74" stop-opacity="0"/></radialGradient>
    <radialGradient id="v-cl"><stop offset="0" stop-color="#e8ebf2" stop-opacity="0.8"/><stop offset="0.5" stop-color="#e8ebf2" stop-opacity="0.35"/><stop offset="1" stop-color="#e8ebf2" stop-opacity="0"/></radialGradient>
    <radialGradient id="v-glow"><stop offset="0" stop-color="#fffef6"/><stop offset="0.1" stop-color="#f6f6f2" stop-opacity="0.95"/><stop offset="0.35" stop-color="#e2e5ee" stop-opacity="0.5"/><stop offset="1" stop-color="#cfd4e0" stop-opacity="0"/></radialGradient>
    <linearGradient id="v-m-far" gradientUnits="userSpaceOnUse" x1="0" y1="430" x2="0" y2="540"><stop offset="0" stop-color="#b0b8cb"/><stop offset="1" stop-color="#ccd1de"/></linearGradient>
    <linearGradient id="v-m-right" gradientUnits="userSpaceOnUse" x1="0" y1="380" x2="0" y2="560"><stop offset="0" stop-color="#848ea6"/><stop offset="1" stop-color="#b8bfcf"/></linearGradient>
    <linearGradient id="v-m-back" gradientUnits="userSpaceOnUse" x1="0" y1="240" x2="0" y2="480"><stop offset="0" stop-color="#8790a8"/><stop offset="1" stop-color="#b3bacb"/></linearGradient>
    <linearGradient id="v-m-mid" gradientUnits="userSpaceOnUse" x1="0" y1="290" x2="0" y2="560"><stop offset="0" stop-color="#9aa3b9"/><stop offset="1" stop-color="#c0c6d5"/></linearGradient>
    <linearGradient id="v-m-left" gradientUnits="userSpaceOnUse" x1="0" y1="260" x2="0" y2="600"><stop offset="0" stop-color="#4f5a75"/><stop offset="0.45" stop-color="#66718b"/><stop offset="1" stop-color="#a0a9bc"/></linearGradient>
    <linearGradient id="v-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c6ccda" stop-opacity="0"/><stop offset="0.6" stop-color="#c6ccda" stop-opacity="0.5"/><stop offset="1" stop-color="#c6ccda" stop-opacity="0.8"/></linearGradient>
    <linearGradient id="v-hill" gradientUnits="userSpaceOnUse" x1="0" y1="440" x2="0" y2="720"><stop offset="0" stop-color="#4c566d"/><stop offset="1" stop-color="#2f3748"/></linearGradient>
    <radialGradient id="v-fog"><stop offset="0" stop-color="#cfd4e0" stop-opacity="0.9"/><stop offset="0.55" stop-color="#c8cedb" stop-opacity="0.45"/><stop offset="1" stop-color="#c8cedb" stop-opacity="0"/></radialGradient>
    <radialGradient id="v-smoke"><stop offset="0" stop-color="#e2e6ee" stop-opacity="0.9"/><stop offset="1" stop-color="#e2e6ee" stop-opacity="0"/></radialGradient>
    <linearGradient id="v-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#727d92"/><stop offset="0.3" stop-color="#8a94a7"/><stop offset="0.6" stop-color="#596377"/><stop offset="1" stop-color="#2c3445"/></linearGradient>
    <pattern id="v-stone" width="29" height="41" patternUnits="userSpaceOnUse"><path d="M3 0v14M9 6v22M16 2v9M21 12v26M26 4v11M12 30v9M5 22v12" stroke="#1a202c" stroke-width="1.2" opacity="0.35"/><path d="M0 18h29" stroke="#596379" stroke-width="0.6" opacity="0.35"/></pattern>
    <linearGradient id="v-bushB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a546c"/><stop offset="1" stop-color="#262e3c"/></linearGradient>
    <linearGradient id="v-bushF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#323b4e"/><stop offset="0.6" stop-color="#1a212d"/><stop offset="1" stop-color="#141a24"/></linearGradient>
    <linearGradient id="v-rise" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#465066"/><stop offset="0.5" stop-color="#2f3747"/><stop offset="1" stop-color="#222a36"/></linearGradient>
    <pattern id="v-frost" width="97" height="71" patternUnits="userSpaceOnUse"><path d="${frost}" fill="#c9d0dc"/></pattern>
    <linearGradient id="v-snow" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#eef2f7"/><stop offset="0.45" stop-color="#c9d1de"/><stop offset="1" stop-color="#7f8ba2"/></linearGradient>
    <radialGradient id="v-vignette" cx="0.5" cy="0.45" r="0.8"><stop offset="0.55" stop-color="#0a0e18" stop-opacity="0"/><stop offset="1" stop-color="#0a0e18" stop-opacity="0.45"/></radialGradient>
  </defs>
  ${sky()}
  ${mountains()}
  ${castle()}
  ${valley()}
  ${windmill()}
  ${leftWood()}
  ${foreground()}
  ${snowfall()}
  <rect width="${W}" height="${H}" fill="url(#v-vignette)"/>
</svg>`
}
