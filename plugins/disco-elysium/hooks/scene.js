// Disco Elysium: Martinaise harbour, painted. An expressionist sky of short brush
// strokes laid along a flow field: they sweep from the upper left toward the horizon
// and swirl round an orange blast that burns behind a sculpted cumulus bank.
// Revachol hazes along the horizon. A pier on arches with warehouses, a lamp tower
// and cranes stands on the left; a wooden church with a steeple stands on the ice on
// the right. The harbour mirrors them, broken by ripples, among lavender ice floes.
// A frozen shore with old jetty posts and a streetlamp fills the foreground.
//
// Cost: no filters. The painted look is seeded strokes, grouped into a few paths by
// colour. Motion stays local (small boxes); nothing sweeps the whole screen. All
// motion is SMIL and every colour a presentation attribute: the desktop app draws the
// scene in a script-less frame. Reflections reuse the drawn shapes with <use>.

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
const HORIZON = 512
const n0 = (v) => Math.round(v)
const n1 = (v) => (Math.round(v * 10) / 10).toString()
const poly = (pts) => `M${pts.map(([x, y]) => `${n0(x)} ${n0(y)}`).join(' L')}`
const pick = (rng, list) => list[Math.floor(rng() * list.length)]
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// SMIL helpers. Values are ';'-separated.
const SPLINE = '0.42 0 0.58 1'
const evenTimes = (n) => Array.from({ length: n }, (_, i) => (i / (n - 1)).toFixed(3)).join(';')
function at(type, values, dur, begin = 0, kt = '', ease = true, additive = false) {
  const n = values.split(';').length
  const calc = ease ? ` calcMode="spline" keySplines="${Array(n - 1).fill(SPLINE).join(';')}"` : ''
  const add = additive ? ' additive="sum"' : ''
  const times = kt ? ` keyTimes="${kt}"` : ease ? ` keyTimes="${evenTimes(n)}"` : ''
  const start = begin ? ` begin="${n1(begin)}s"` : ''
  return `<animateTransform attributeName="transform" type="${type}" values="${values}"${times} dur="${dur}s"${start} repeatCount="indefinite"${calc}${add}/>`
}
function ao(values, dur, begin = 0, kt = '') {
  const times = kt ? ` keyTimes="${kt}"` : ''
  const start = begin ? ` begin="${n1(begin)}s"` : ''
  return `<animate attributeName="opacity" values="${values}"${times} dur="${dur}s"${start} repeatCount="indefinite"/>`
}
const pivot = (px, py, anims, content) =>
  `<g transform="translate(${px} ${py})"><g>${anims}<g transform="translate(${-px} ${-py})">${content}</g></g></g>`

// Brush strokes. A stroke is a short relative quadratic; strokes of one colour, width
// and opacity share one path, which keeps the markup small.
function stroke(x, y, len, ang, bend) {
  const dx = Math.cos(ang) * len
  const dy = Math.sin(ang) * len
  return `M${n0(x)} ${n0(y)}q${n0(dx / 2 - Math.sin(ang) * bend)} ${n0(dy / 2 + Math.cos(ang) * bend)} ${n0(dx)} ${n0(dy)}`
}
// Snap a colour to a coarse grid (steps of 28), so strokes of near colours share one path.
function quant(h) {
  return '#' + [1, 3, 5].map((i) => clamp(n0(parseInt(h.slice(i, i + 2), 16) / 28) * 28, 0, 255).toString(16).padStart(2, '0')).join('')
}
class Brush {
  constructor() { this.g = new Map() }
  add(color, width, op, d) {
    const k = `${quant(color)}|${width}|${op}`
    if (!this.g.has(k)) this.g.set(k, [])
    this.g.get(k).push(d)
  }
  svg(cap = 'round') {
    return [...this.g].map(([k, ds]) => {
      const [c, w, o] = k.split('|')
      return `<path d="${ds.join('')}" fill="none" stroke="${c}" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="${cap}"/>`
    }).join('')
  }
}

// Rectangles of one fill, merged into one path.
class Rects {
  constructor() { this.g = new Map() }
  add(fill, x, y, w, h) {
    if (!this.g.has(fill)) this.g.set(fill, [])
    this.g.get(fill).push(`M${n1(x)} ${n1(y)}h${n1(w)}v${n1(h)}h${n1(-w)}z`)
  }
  svg() { return [...this.g].map(([f, ds]) => `<path d="${ds.join('')}" fill="${f}"/>`).join('') }
}

// Blend two #rrggbb colours.
function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return '#' + x.map((v, i) => n0(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------- the sky

const BLAST = { x: 1060, y: 330 }
const GLOW = { x: 820, y: 470 }

// The flow field: a sweep from the upper left down toward the horizon's glow, bent
// into a swirl round the blast and a slower eddy at the top right.
function flow(x, y, rng) {
  let a = Math.atan2(GLOW.y - y, GLOW.x - x) * 0.55 + 0.12
  const bx = x - BLAST.x
  const by = y - BLAST.y
  const db = Math.hypot(bx, by)
  if (db < 360) {
    const swirl = Math.atan2(by, bx) - 1.25
    a = a + (swirl - a) * (1 - db / 360) * 0.8
  }
  const ex = x - 1420
  const ey = y - 120
  const de = Math.hypot(ex, ey)
  if (de < 260) a += (1 - de / 260) * 1.1
  return a + (rng() - 0.5) * 0.35
}

const SKY_BANDS = [
  // [top y, palette]
  [0, ['#10223e', '#16305a', '#1d3d72', '#132c4a', '#22376a', '#0f2a40']],
  [120, ['#1d4a6a', '#24587a', '#1f5f66', '#2a4f86', '#3b3f78', '#215a5a']],
  [230, ['#2f6a5f', '#3a7a6c', '#2f6a55', '#4a7e86', '#3f6a8a', '#556a96']],
  [330, ['#5f8f84', '#7aa08c', '#8fb0a0', '#6a8a92', '#a0a888', '#7f9a7a']],
  [420, ['#c4a066', '#d8b27a', '#e2c48c', '#b89a6a', '#cfa070', '#e8cf98']],
]
function skyColor(x, y, rng) {
  let band = SKY_BANDS[0][1]
  for (const [top, pal] of SKY_BANDS) if (y + (rng() - 0.5) * 70 >= top) band = pal
  let c = pick(rng, band)
  const db = Math.hypot(x - BLAST.x, (y - BLAST.y) * 1.3)
  if (db < 300 && rng() < 1 - db / 300) c = mix(c, pick(rng, ['#e8742a', '#f2a03a', '#d8561e', '#f4c45a']), 0.55 + rng() * 0.4)
  const dg = Math.hypot(x - GLOW.x, (y - GLOW.y) * 2)
  if (dg < 420) c = mix(c, '#f1d9a0', (1 - dg / 420) * 0.6)
  return c
}

function sky() {
  const rng = mulberry32(1981)
  const b = new Brush()
  // Underpainting: a few wide, low-opacity strokes so no flat gradient shows.
  for (let i = 0; i < 40; i++) {
    const x = rng() * W
    const y = rng() * (HORIZON - 10)
    b.add(skyColor(x, y, rng), 60, '0.55', stroke(x - 60, y, 160 + rng() * 120, flow(x, y, rng), (rng() - 0.5) * 30))
  }
  // The paint: short strokes on a jittered grid, laid along the flow.
  const step = 31
  for (let gy = 4; gy < HORIZON - 4; gy += step * 0.78) {
    for (let gx = -10; gx < W + 10; gx += step) {
      const x = gx + (rng() - 0.5) * step
      const y = gy + (rng() - 0.5) * step * 0.8
      const a = flow(x, y, rng)
      const len = 30 + rng() * 38
      const w = rng() < 0.5 ? 11 : 15
      b.add(skyColor(x, y, rng), w, '0.9', stroke(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2, len, a, (rng() - 0.5) * 8))
    }
  }
  // Highlights: long thin strokes along the sweep, cream and mint, a few hot ones.
  for (let i = 0; i < 12; i++) {
    const x = rng() * 900 - 60
    const y = 30 + rng() * 300
    const a = flow(x, y, rng)
    b.add(pick(rng, ['#efe0b4', '#f4e8c4', '#cfe6d8', '#b8dccf', '#f0a04a', '#efe0b4']), [4, 6][i % 2], '0.55', stroke(x, y, 160 + rng() * 260, a, -20 - rng() * 40))
  }
  return b.svg()
}

// The blast: a hot core and broad flaring dabs, drawn over the sky; it pulses.
function blast() {
  const rng = mulberry32(512)
  const b = new Brush()
  for (let i = 0; i < 60; i++) {
    const a = -1.3 + rng() * 1.1
    const r0 = 10 + rng() * 140
    const x = BLAST.x + Math.cos(a) * r0
    const y = BLAST.y + Math.sin(a) * r0 * 0.9
    const core = r0 < 55
    b.add(pick(rng, core ? ['#fbe3a0', '#f7d67a', '#fff0c4'] : ['#f08a2a', '#e8641e', '#f4a83a', '#d9561a', '#c94a1c', '#f6b84a']),
      [10, 16, 24][i % 3], core ? '0.85' : ['0.45', '0.6', '0.75'][i % 3], stroke(x, y, 40 + rng() * (core ? 50 : 130), a + (rng() - 0.5) * 0.3, (rng() - 0.5) * 30))
  }
  return `<circle cx="${BLAST.x}" cy="${BLAST.y + 10}" r="300" fill="url(#de-blast)"/>` +
    `<g>${ao('0.85;1;0.8;1;0.85', 6.5, 0, '0;0.2;0.45;0.75;1')}${b.svg()}</g>`
}

// Light shafts from the blast and the glow: long soft wedges across the scene.
function shafts() {
  const wedge = (a0, a1, len, op) => {
    const p = (a, r) => [BLAST.x + Math.cos(a) * r, BLAST.y + Math.sin(a) * r]
    return `<path d="${poly([p(a0, 40), p(a0, len), p(a1, len), p(a1, 40)])} Z" fill="url(#de-shaft)" opacity="${op}"/>`
  }
  return wedge(2.55, 2.68, 900, 0.5) + wedge(2.8, 2.88, 1000, 0.35) + wedge(1.9, 2.02, 700, 0.3)
}

// ---------------------------------------------------------------- the clouds

// Cumulus, modelled softly: each puff is an ellipse with a smooth light-to-shadow
// gradient lit from the blast's side, over a cool mint underside; the largest puffs
// get a warm rim on their lit top. The bank billows slowly as a whole.
function clouds() {
  const rng = mulberry32(303)
  const clusters = [[770, 468, 0.75], [880, 442, 1.0], [990, 400, 1.2], [1110, 380, 1.3], [1235, 404, 1.15], [1345, 432, 1.0], [1450, 456, 0.85], [1180, 458, 1.05]]
  let under = ''
  let puffs = ''
  let rims = ''
  for (const [cx, cy, k] of clusters) {
    const ps = []
    const n = 10 + Math.floor(rng() * 4)
    for (let i = 0; i < n; i++) {
      const t = rng()
      ps.push([cx + (rng() - 0.5) * 150 * k, cy - t * 50 * k + (rng() - 0.5) * 8, (14 + rng() * 22) * k * (1 - t * 0.3)])
    }
    ps.sort((a, b) => b[1] - a[1])
    const floor = cy + 20 * k
    under += `M${n0(cx - 95 * k)} ${n0(floor)}Q${n0(cx)} ${n0(floor + 8 * k)} ${n0(cx + 95 * k)} ${n0(floor)}Q${n0(cx + 60 * k)} ${n0(floor - 30 * k)} ${n0(cx)} ${n0(floor - 32 * k)}Q${n0(cx - 60 * k)} ${n0(floor - 30 * k)} ${n0(cx - 95 * k)} ${n0(floor)}Z`
    const lightFromRight = cx < BLAST.x
    for (const [x, y, r] of ps) {
      puffs += `<ellipse cx="${n0(x)}" cy="${n0(y)}" rx="${n0(r * 1.18)}" ry="${n0(r * 0.82)}" fill="url(#de-puff-${lightFromRight ? 'r' : 'l'})"/>`
      if (r > 24 * k && rng() < 0.6) {
        const a0 = lightFromRight ? -1.4 : -2.4
        const p = (a) => `${n0(x + Math.cos(a) * r * 1.12)} ${n0(y + Math.sin(a) * r * 0.78)}`
        rims += `M${p(a0)}A${n0(r * 1.12)} ${n0(r * 0.78)} 0 0 1 ${p(a0 + 0.9)}`
      }
    }
  }
  return pivot(1110, 470, at('scale', '1 1;1.015 1.025;1 1', 18),
    `<path d="${under}" fill="#8fb0aa"/>${puffs}<path d="${rims}" fill="none" stroke="#fff0c8" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`) +
    `<ellipse cx="1080" cy="488" rx="480" ry="44" fill="url(#de-cloud-foot)"/>`
}

// The aerostat: a big quad-rotor craft that drifts and bobs with spinning rotors.
function aerostats() {
  const rotor = (x, y, r, dur) =>
    `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n1(r * 0.22)}" fill="none" stroke="#e9e4d2" stroke-opacity="0.7" stroke-width="1.4"/>` +
    `<g transform="translate(${x} ${y})"><g>${at('scale', '1 1;-1 1;1 1', dur, 0, '', false)}<line x1="${-r}" y1="0" x2="${r}" y2="0" stroke="#f4efe0" stroke-width="1.3" opacity="0.8"/></g></g>`
  const craft = `<path d="M-36 -2 L36 -2 L28 8 L-28 8 Z" fill="#2c303c"/><path d="M-30 -2 L30 -2 L24 -8 L-24 -8 Z" fill="#4e5262"/>` +
    `<path d="M-30 -2 L30 -2 L24 -8" fill="none" stroke="#f6d08e" stroke-opacity="0.55" stroke-width="1"/>` +
    `<rect x="-12" y="8" width="24" height="10" fill="#23262f"/><path d="M-9 11h4v3h-4zM-2 11h4v3h-4zM5 11h4v3h-4z" fill="#f4c46a"/>` +
    `<path d="M-34 -4 L-48 -14 M34 -4 L48 -14" stroke="#2c303c" stroke-width="2"/>${rotor(-48, -16, 22, 0.16)}${rotor(48, -16, 22, 0.19)}`
  const big = `<g transform="translate(1350 150) scale(1.7)"><g>${at('translate', '0 0;-26 6;-10 -4;0 0', 38)}<g>${at('translate', '0 0;0 -3;0 0', 5.5, 0, '', true, true)}${craft}</g></g></g>`
  return big
}

// ---------------------------------------------------------------- the town

// Shapes of one fill, merged into one path.
class Shapes {
  constructor() { this.g = new Map() }
  add(fill, d) {
    if (!this.g.has(fill)) this.g.set(fill, [])
    this.g.get(fill).push(d)
  }
  rect(fill, x, y, w, h) { this.add(fill, `M${n1(x)} ${n1(y)}h${n1(w)}v${n1(h)}h${n1(-w)}z`) }
  poly(fill, pts) { this.add(fill, `${poly(pts)}z`) }
  svg() { return [...this.g].map(([f, ds]) => `<path d="${ds.join('')}" fill="${f}"/>`).join('') }
}

// Building materials: [front face, side face lit by the glow, roof].
const MATERIAL = {
  cream: ['#b2a690', '#e2cfa6', '#56525e'],
  pale: ['#9c98aa', '#d6cec4', '#4a4a58'],
  slate: ['#56607a', '#9c8c7a', '#363c4e'],
  teal: ['#3c666e', '#7aa092', '#283844'],
  rust: ['#7a4838', '#c27e56', '#3a2a30'],
  ochre: ['#86704e', '#d0a866', '#40363a'],
  blue: ['#46526a', '#8a8a92', '#2c3244'],
  wood: ['#3c3230', '#7a5e4a', '#26222a'],
}

// A painted box: a front face, a side face receding toward the glow (lit) and a
// roof: 'gable', 'shed', 'flat' or 'saw'. Lit windows are a few warm dabs.
function box(sh, x, base, w, h, mat, roof, rng, wins = 0) {
  const [front, side, top] = MATERIAL[mat]
  const right = x + w / 2 < GLOW.x
  const d = Math.min(w * 0.35, 16)
  const y = base - h
  sh.rect(front, x, y, w, h)
  // The side face: on the right of buildings left of the glow, on the left otherwise.
  if (right) sh.poly(side, [[x + w, base], [x + w, y], [x + w + d, y - d * 0.4], [x + w + d, base - d * 0.4]])
  else sh.poly(side, [[x, base], [x, y], [x - d, y - d * 0.4], [x - d, base - d * 0.4]])
  const rh = roof === 'flat' ? 3 : roof === 'shed' ? w * 0.18 : w * 0.32
  if (roof === 'gable') sh.poly(top, [[x - 2, y], [x + w / 2, y - rh], [x + w + 2, y]])
  else if (roof === 'shed') sh.poly(top, right ? [[x - 2, y], [x - 2, y - rh], [x + w + 2, y]] : [[x - 2, y], [x + w + 2, y - rh], [x + w + 2, y]])
  else if (roof === 'saw') {
    const n = Math.max(2, Math.round(w / 22))
    const tw = w / n
    for (let i = 0; i < n; i++) sh.poly(top, [[x + i * tw, y], [x + i * tw, y - tw * 0.55], [x + (i + 1) * tw, y]])
    for (let i = 0; i < n; i++) sh.poly('#e8d8b0', [[x + i * tw, y - tw * 0.55], [x + i * tw + 2, y - tw * 0.55], [x + i * tw + 2, y]])
  } else sh.rect(top, x - 2, y - 3, w + 4, 3)
  for (let i = 0; i < wins; i++) {
    const wx = x + 3 + rng() * Math.max(1, w - 8)
    const wy = y + 4 + rng() * Math.max(1, h - 10)
    sh.rect(rng() < 0.8 ? '#f4c06a' : '#d8ecdf', wx, wy, 3, 4)
  }
}

// A painterly glaze over a block of buildings: semi-transparent dabs, vertical and
// horizontal, in the given colours. It breaks hard box edges into painted mass.
function glazeOver(rng, x0, y0, w, h, count, pal, op = '0.4') {
  const g = new Brush()
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5
    g.add(pick(rng, pal), [4, 7][i % 2], op, stroke(x0 + rng() * w, y0 + rng() * h, 8 + rng() * 22, vertical ? Math.PI / 2 + (rng() - 0.5) * 0.2 : (rng() - 0.5) * 0.15, 0))
  }
  return g.svg()
}

// Revachol across the middle distance: a pale far skyline, then a dense, hazy town of
// small painted buildings with gantry cranes and chimneys, warm-lit on the glow side.
function city() {
  const rng = mulberry32(4242)
  const far = new Shapes()
  let x = 0
  while (x < W) {
    const w = 14 + rng() * 30
    const h = 14 + Math.pow(rng(), 1.7) * 64
    far.rect('#b8a888', x, HORIZON + 2 - h, w + 1, h)
    if (rng() < 0.1) far.poly('#b8a888', [[x + w / 2 - 4, HORIZON + 2 - h], [x + w / 2, HORIZON - h - 20 - rng() * 26], [x + w / 2 + 4, HORIZON + 2 - h]])
    x += w
  }
  const town = new Shapes()
  const mats = ['slate', 'blue', 'cream', 'teal', 'rust', 'pale', 'ochre', 'slate', 'blue']
  const roofs = ['gable', 'gable', 'shed', 'flat', 'flat', 'saw']
  // Back rows first, so nearer rows overlap them.
  for (const [base, minH, maxH, from, to] of [[HORIZON + 8, 8, 24, 160, 1220], [HORIZON + 22, 10, 34, 260, 1200]]) {
    let bx = from
    while (bx < to) {
      const w = 10 + rng() * 24
      box(town, bx, base + (rng() - 0.5) * 4, w, minH + rng() * (maxH - minH), pick(rng, mats), pick(rng, roofs), rng, rng() < 0.4 ? 1 : 0)
      bx += w + rng() * 6
    }
  }
  // Gantry cranes over the docks, and chimneys.
  return `<g opacity="0.7">${far.svg()}</g>` +
    `<rect x="0" y="${HORIZON - 70}" width="${W}" height="90" fill="url(#de-haze)"/>` +
    town.svg() +
    // Haze over the town: it sits in the distance.
    `<rect x="0" y="${HORIZON - 60}" width="${W}" height="100" fill="url(#de-town-haze)"/>`
}

// The near town: rows stepping down toward the water, each nearer row taller, warmer
// and less hazed, ending at a lit quay. Each row is drawn whole (its buildings, its
// gantry cranes and chimneys, its glaze, its haze) before the next, nearer row, so the
// nearer buildings cover the feet of the cranes behind them. Drawn over the water; the
// harbour mirrors it.
function nearTown() {
  const rng = mulberry32(2626)
  const mats = ['slate', 'blue', 'cream', 'teal', 'rust', 'pale', 'ochre', 'cream', 'slate']
  const roofs = ['gable', 'gable', 'shed', 'flat', 'saw', 'gable']
  // A gantry crane: braced A-frame legs, a lattice girder with a lit top edge, and a
  // trolley with a cable and hook; on `travel` the trolley runs along the girder.
  const gantry = (gx, gw, gh, base, travel) => {
    const top = base - gh
    let lattice = ''
    for (let x = gx - 4; x < gx + gw + 2; x += 8) lattice += `M${x} ${top - 7}l4 6l4 -6`
    const leg = (x) => `M${x - 6} ${base}L${x} ${top}L${x + 6} ${base}M${x - 4} ${base - gh * 0.35}h8M${x - 2} ${base - gh * 0.7}h4`
    const trolley = `<path d="M${gx + gw * 0.3} ${top - 1}h14v8h-14z" fill="#3c3f50"/><path d="M${gx + gw * 0.3 + 7} ${top + 7}v28" stroke="#2a2d3a"/><path d="M${gx + gw * 0.3 + 4} ${top + 35}h6v4h-6z" fill="#2a2d3a"/>`
    return `<path d="${leg(gx)}${leg(gx + gw)}" fill="none" stroke="#343a4c" stroke-width="2.4"/>` +
      `<path d="M${gx - 8} ${top - 8}h${gw + 16}v8h${-gw - 16}z" fill="#343a4c"/>` +
      `<path d="${lattice}" fill="none" stroke="#5a5e70" stroke-width="1"/>` +
      `<path d="M${gx - 8} ${top - 8}h${gw + 16}" stroke="#f2d8a8" stroke-opacity="0.65" stroke-width="1.6"/>` +
      (travel ? `<g>${at('translate', `0 0;${n0(gw * 0.4)} 0;0 0`, travel)}${trolley}</g>` : trolley)
  }
  const chimney = (cx, cb, ch) => `<path d="M${cx} ${cb}v${-ch}h6v${ch}z" fill="#4a4656"/><path d="M${cx} ${cb - ch}h6" stroke="#f2d8a8" stroke-opacity="0.6" stroke-width="2"/>`
  const rows = [
    { base: HORIZON + 42, minH: 16, maxH: 46, from: 380, to: 1190, extra: () => gantry(900, 100, 56, HORIZON + 42, 0) },
    { base: HORIZON + 62, minH: 22, maxH: 58, from: 450, to: 1170, extra: () => gantry(700, 130, 70, HORIZON + 62, 22) + chimney(610, HORIZON + 62, 70) + chimney(1010, HORIZON + 62, 76) },
    { base: HORIZON + 84, minH: 26, maxH: 70, from: 540, to: 1140, extra: () => chimney(790, HORIZON + 84, 60) },
  ]
  let out = ''
  rows.forEach(({ base, minH, maxH, from, to, extra }, ri) => {
    const sh = new Shapes()
    let bx = from
    while (bx < to) {
      const w = 14 + rng() * 34
      box(sh, bx, base + (rng() - 0.5) * 4, w, minH + rng() * (maxH - minH), pick(rng, mats), pick(rng, roofs), rng, rng() < 0.6 ? 1 + ri : 0)
      bx += w + 2 + rng() * 10
    }
    // The glaze: dabs in haze colours over this row, breaking the boxes' hard edges.
    const glaze = new Brush()
    const pal = ri === 0 ? ['#d8c8a0', '#c8bca0', '#b8b0a0', '#cfc4a8'] : ri === 1 ? ['#a8a090', '#8a8a96', '#c8a878', '#9a8a80'] : ['#6a7082', '#8a7a78', '#c89a6a', '#5a6070']
    for (let i = 0; i < 85; i++) {
      const vertical = rng() < 0.45
      glaze.add(pick(rng, pal), [4, 7][i % 2], '0.4', stroke(from + rng() * (to - from), base - maxH + rng() * maxH, 8 + rng() * 22, vertical ? Math.PI / 2 + (rng() - 0.5) * 0.2 : (rng() - 0.5) * 0.15, 0))
    }
    out += sh.svg() + extra() + glaze.svg()
    if (ri < 2) out += `<rect x="${from - 40}" y="${base - maxH - 30}" width="${to - from + 80}" height="${maxH + 34}" fill="url(#de-town-haze)"/>`
  })
  const q = HORIZON + 86
  return `<g id="de-town">${out}</g>` +
    `<path d="M520 ${q}H1150V${q + 8}H520Z" fill="#3a3a48"/><path d="M520 ${q}H1150" stroke="#f2d8a8" stroke-opacity="0.6" stroke-width="1.6"/>`
}

// The left pier complex: a big pale industrial hall with a sawtooth roof, a rust
// warehouse, sheds and blocks in teal and slate, all on a stone pier of arches; a tall
// tower whose lamp burns white with crackling light; cranes; smoke; and the figure.
const DECK = 600
function pier() {
  const rng = mulberry32(77)
  const sh = new Shapes()
  box(sh, 0, DECK, 96, 128, 'rust', 'gable', rng, 6)
  box(sh, 150, DECK, 250, 104, 'pale', 'saw', rng, 0)
  box(sh, 96, DECK, 60, 70, 'slate', 'shed', rng, 3)
  box(sh, 300, DECK, 70, 46, 'teal', 'gable', rng, 2)
  box(sh, 400, DECK, 90, 74, 'blue', 'flat', rng, 4)
  box(sh, 480, DECK, 54, 40, 'cream', 'gable', rng, 2)
  // The hall's long window band, warm, and its painted face.
  let band = ''
  for (let wx = 160; wx < 392; wx += 10) band += `M${wx} ${DECK - 66}h6v10h-6z`
  const b = new Brush()
  for (let i = 0; i < 30; i++) b.add(pick(rng, ['#c4bec8', '#8a8698', '#b0aab6', '#d8d0c8']), 5, '0.6', stroke(160 + rng() * 230, DECK - 100 + rng() * 90, 14 + rng() * 26, (rng() - 0.5) * 0.2, 0))
  // The tower: cream-lit shaft, a white lamp, white crackle round it.
  const tower = `<path d="M104 ${DECK - 300}h24v300h-24z" fill="#9c98aa"/><path d="M120 ${DECK - 300}h8v300h-8z" fill="#e2d6be"/>` +
    `<path d="M98 ${DECK - 308}h36v10h-36z" fill="#4a4a58"/><path d="M106 ${DECK - 334}h20v26h-20z" fill="#f8f4e4"/>` +
    `<circle cx="116" cy="${DECK - 320}" r="90" fill="url(#de-lamp)">${ao('0.8;1;0.85;1;0.8', 5, 0, '0;0.3;0.5;0.8;1')}</circle>` +
    `<path d="M116 ${DECK - 334}l-14 -18l8 -6l-16 -22M126 ${DECK - 330}l18 -10l-4 -12l20 -8M104 ${DECK - 320}l-22 4l-6 12" fill="none" stroke="#fffbe8" stroke-width="1.6" stroke-linejoin="round" opacity="0.85">${ao('0.9;0.2;0.9;0.5;0.9', 2.2, 0, '0;0.1;0.2;0.6;1')}</path>`
  // The pier: stone arches in grey-blue with a lit top edge.
  let arches = ''
  for (let x = 10; x < 560; x += 46) arches += `M${x} ${DECK + 14}V${DECK + 74}h12V${DECK + 42}q11 -14 22 0V${DECK + 74}h12`
  const deck = `<path d="M-10 ${DECK}H570V${DECK + 14}H-10Z" fill="#4a5064"/><path d="${arches}" fill="none" stroke="#3a3f52" stroke-width="12"/>` +
    `<path d="M-10 ${DECK}H570" stroke="#f2d8a8" stroke-opacity="0.55" stroke-width="1.6"/>`
  const crane = (x, h, jib, swing) => {
    const top = DECK - h
    let lat = ''
    for (let y = top + 8; y < DECK; y += 14) lat += `M${x - 6} ${y}l12 14M${x + 6} ${y}l-12 14`
    const hook = `<path d="M${x + jib} ${top}v60" stroke="#2a2c38"/><path d="M${x + jib - 3} ${top + 60}h6v4h-6z" fill="#2a2c38"/>`
    return `<path d="M${x - 7} ${DECK}L${x - 5} ${top}h10L${x + 7} ${DECK}${lat}M${x - 30} ${top}H${x + jib + 10}" fill="none" stroke="#2a2c38" stroke-width="2"/>` +
      `<path d="M${x - 30} ${top}H${x + jib + 10}" stroke="#f2c88a" stroke-opacity="0.4"/>` +
      `<path d="M${x - 10} ${top - 12}h20v14h-20z" fill="#a0583a"/>` + (swing ? pivot(x + jib, top, at('rotate', '-5;5;-5', 6.5, -swing), hook) : hook)
  }
  const stack = `<path d="M330 ${DECK - 150}h12v104h-12z" fill="#6a6474"/>`
  const smoke = [0, 1, 2, 3].map((i) =>
    `<g opacity="0">${at('translate', `336 ${DECK - 154};316 ${DECK - 224};284 ${DECK - 284}`, 12, -i * 3, '', false)}${ao('0;0.45;0.25;0', 12, -i * 3, '0;0.15;0.6;1')}<g>${at('scale', '0.6;1.4;2.2', 12, -i * 3, '', false, true)}<ellipse rx="12" ry="9" fill="#c8c0b0"/></g></g>`).join('')
  const man = `<g transform="translate(548 ${DECK})">
      <path d="M-4 0L-3 -14Q-5 -20 -3 -24H3Q5 -20 3 -14L4 0H1L0 -10L-1 0Z" fill="#1c1d26"/>
      <circle cy="-27" r="3.2" fill="#1c1d26"/><path d="M-5 -28.5H5L3.5 -30.5H-3.5Z" fill="#1c1d26"/>
      <circle cx="5.3" cy="-25.5" r="0.9" fill="#ff7a2a">${ao('0.4;1;0.4;0.4', 7, 0, '0;0.1;0.25;1')}</circle>
      <circle cx="5.3" cy="-25.5" r="5" fill="url(#de-ember)">${ao('0.2;0.9;0.2;0.2', 7, 0, '0;0.1;0.25;1')}</circle>
    </g>`
  return crane(470, 150, 90, 0) + crane(640, 120, 70, 2) +
    `<g id="de-pier">${stack}${sh.svg()}<path d="${band}" fill="#f4c06a" opacity="0.85"/>${b.svg()}` +
    glazeOver(rng, 0, DECK - 140, 540, 140, 120, ['#8a8698', '#c4b8a8', '#6a6a7e', '#a08070', '#d8c8a8', '#5a6070']) +
    `${tower}${deck}</g>` + smoke + man
}

// The right village on the ice: a dark wooden longhouse with two gables and warm
// windows, a tall steeple with a white spire, a teal-roofed shack on stilts, all with
// snow on the roof edges and warm light at the doors.
const CHURCH_BASE = 700
function church() {
  const rng = mulberry32(5)
  const base = CHURCH_BASE
  const sh = new Shapes()
  // The longhouse body: two wings.
  sh.rect('#3a302e', 1120, base - 70, 130, 70)
  sh.rect('#463832', 1240, base - 100, 170, 100)
  sh.poly('#7a5e4a', [[1410, base], [1410, base - 100], [1436, base - 112], [1436, base - 10]])
  // Roofs: big dark planes with a warm-lit ridge side and snow on the lower edge.
  sh.poly('#2a2428', [[1108, base - 70], [1185, base - 134], [1262, base - 70]])
  sh.poly('#2e262a', [[1226, base - 100], [1325, base - 196], [1424, base - 100]])
  sh.poly('#5a4640', [[1325, base - 196], [1424, base - 100], [1446, base - 110], [1347, base - 204]])
  // The steeple, in front of the roof: a wide lower stage, a narrower belfry with an
  // open arch, lit cornices, and the white spire, lit on its glow side.
  const sx = 1252
  sh.rect('#342c30', sx, base - 210, 46, 112)
  sh.rect('#7a5e4a', sx, base - 210, 10, 112)
  sh.rect('#e2d6c0', sx - 4, base - 214, 54, 5)
  sh.rect('#2c262c', sx + 7, base - 268, 32, 54)
  sh.rect('#6a5448', sx + 7, base - 268, 7, 54)
  sh.add('#100e14', `M${sx + 15} ${base - 222}v-26q8 -10 16 0v26z`)
  sh.rect('#e2d6c0', sx + 3, base - 272, 40, 5)
  sh.poly('#e8e4f2', [[sx + 5, base - 272], [sx + 23, base - 372], [sx + 41, base - 272]])
  sh.poly('#9e98c0', [[sx + 23, base - 372], [sx + 41, base - 272], [sx + 30, base - 272]])
  sh.add('#2c262c', `M${sx + 22} ${base - 372}v-14h2v14zM${sx + 18} ${base - 382}h10v2h-10z`)
  // The shack on stilts, teal roof.
  sh.rect('#4a4048', 1480, base - 34, 70, 34)
  sh.poly('#5a9a8a', [[1474, base - 34], [1515, base - 62], [1556, base - 34]])
  sh.poly('#8ac0ae', [[1515, base - 62], [1556, base - 34], [1548, base - 34], [1513, base - 56]])
  const b = new Brush()
  for (let x = 1243; x < 1408; x += 5) b.add(pick(rng, ['#52423a', '#3a302c', '#5e4c42']), 3, '0.8', `M${x} ${base - 98}v${n0(96 - rng() * 6)}`)
  for (let x = 1123; x < 1248; x += 5) b.add(pick(rng, ['#463a34', '#30282a']), 3, '0.8', `M${x} ${base - 68}v${n0(66 - rng() * 6)}`)
  for (let i = 0; i < 26; i++) {
    const t = rng()
    b.add(pick(rng, ['#3a3034', '#46383a', '#2a2428']), 5, '0.8', stroke(1325 - t * 98, base - 194 + t * 94, 18 + rng() * 16, 2.35, 0))
  }
  const snow = `<path d="M1108 ${base - 70}L1185 ${base - 134}M1226 ${base - 100}L1325 ${base - 196}M1474 ${base - 34}L1515 ${base - 62}" fill="none" stroke="#ece8f6" stroke-opacity="0.8" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M1108 ${base - 70}H1262M1226 ${base - 100}H1424" stroke="#d8d2ea" stroke-width="4" stroke-linecap="round"/>`
  const windows = [[1140, 40], [1170, 40], [1206, 40], [1262, 56], [1294, 56], [1352, 56], [1384, 56], [1498, 22]]
    .filter(([x]) => x < 1248 || x > 1302)
    .map(([x, h], i) => `<path d="M${x} ${base - h + 20}v-18h10v18z" fill="#f4b45a">${i === 4 ? ao('1;0.65;1', 5, -2, '0;0.5;1') : ''}</path>`).join('')
  const door = `<path d="M1318 ${base}V${base - 38}q10 -12 20 0V${base}Z" fill="#f6c46a"/>`
  const stilts = `<path d="M1486 ${base}v14M1510 ${base}v16M1534 ${base}v14M1546 ${base}v12" stroke="#2c2830" stroke-width="3"/>`
  const glaze = glazeOver(rng, 1110, base - 200, 340, 200, 80, ['#5a4640', '#3a3038', '#7a5e4a', '#4a4250', '#2e2a34'], '0.45')
  return `<g id="de-church">${sh.svg()}${b.svg()}${glaze}${snow}${windows}${door}${stilts}</g>` +
    `<ellipse cx="1328" cy="${base + 4}" rx="90" ry="12" fill="url(#de-ember)" opacity="0.7">${ao('0.6;0.85;0.6', 4.5)}</ellipse>`
}

// ---------------------------------------------------------------- the harbour

// The water: a dark umber base, the pier and church mirrored (squashed, darkened),
// then horizontal ripple strokes that break the reflections, a warm sheen under the
// glow, shimmering light streaks, and painted ice floes.
function harbour() {
  const rng = mulberry32(9)
  const water = `<rect x="0" y="${HORIZON + 8}" width="${W}" height="${H - HORIZON}" fill="url(#de-water)"/>` +
    `<ellipse cx="${GLOW.x + 120}" cy="${HORIZON + 70}" rx="440" ry="130" fill="url(#de-sheen)"/>`
  const mirror = (id, y, op) => `<use href="#${id}" transform="matrix(1 0 0 -0.55 0 ${n1(y * 1.55)})" opacity="${op}"/>`
  const reflections = `<g opacity="0.4">${mirror('de-pier', DECK + 74, 1)}${mirror('de-church', CHURCH_BASE, 1)}${mirror('de-town', HORIZON + 94, 1)}</g>`
  const b = new Brush()
  for (let i = 0; i < 190; i++) {
    const y = HORIZON + 14 + Math.pow(rng(), 0.8) * 380
    const x = rng() * W
    const warm = Math.abs(x - (GLOW.x + 120)) < 260 + (y - HORIZON) * 0.5 && y < 760
    const pal = warm ? ['#9a6038', '#b8763c', '#7a4a34', '#d29a52', '#e8b866']
      : y < 640 ? ['#5a4a52', '#3e4a5a', '#2f5a62', '#6a5a6a', '#4a3a48', '#55607a'] : ['#2a1e22', '#3a2630', '#30283e', '#22303a', '#4a2c30']
    b.add(pick(rng, pal), [4, 7][i % 2], '0.7', stroke(x, y, 20 + rng() * 100, (rng() - 0.5) * 0.05, (rng() - 0.5) * 3))
  }
  const lights = [[116, 690, '#f4efdc', 9], [300, 690, '#f2b45a', 5], [1300, 716, '#f6c46a', 8], [1250, 716, '#f2b45a', 4], [GLOW.x + 160, 540, '#f4c46a', 14]]
    .map(([x, y, c, n], i) => {
      let d = ''
      for (let k = 0; k < n; k++) d += `M${n0(x - 4 - rng() * 8)} ${n0(y + k * 9)}h${n0(6 + rng() * 14 - k * 0.5)}`
      return `<path d="${d}" stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.55">${ao('0.55;0.25;0.6;0.35;0.55', 2.6 + i * 0.5, -i, '0;0.25;0.5;0.75;1')}</path>`
    }).join('')
  // Ice floes: jagged plates in lavender, shadowed below, lit along the top, cracked;
  // their tops are brushed. A few drift.
  const ice = new Brush()
  const floe = (cx, cy, w, h, drift) => {
    const pts = []
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2
      const j = k % 2 ? 0.82 + rng() * 0.12 : 0.95 + rng() * 0.15
      pts.push([cx + Math.cos(a) * w * j, cy + Math.sin(a) * h * j])
    }
    for (let s = 0; s < Math.ceil(w / 18); s++) ice.add(pick(rng, ['#e8e4f4', '#c4bedc', '#b4aed4', '#f2eefa']), 3, '0.7', stroke(cx - w * 0.7 + rng() * w * 1.4, cy - h * 0.4 + rng() * h * 0.8, 10 + rng() * 20, (rng() - 0.5) * 0.1, 0))
    const body = `<path d="${poly(pts.map(([x, y]) => [x + 2, y + 4]))}Z" fill="#4f4a72"/><path d="${poly(pts)}Z" fill="${pick(rng, ['#d0cbe6', '#dad5ec', '#c6c0de', '#e4e0f2'])}"/>` +
      `<path d="${poly(pts.slice(8, 14))}" fill="none" stroke="#8f89bc" stroke-width="2.2"/>` +
      `<path d="${poly(pts.slice(1, 6))}" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="1.4"/>` +
      `<path d="M${n0(cx - w * 0.4)} ${n0(cy + (rng() - 0.5) * h)}L${n0(cx)} ${n0(cy + (rng() - 0.5) * h * 0.6)}L${n0(cx + w * 0.3)} ${n0(cy + (rng() - 0.5) * h)}" fill="none" stroke="#a09ac8"/>`
    return drift ? `<g>${at('translate', `0 0;${drift} 1;0 0`, 40 + rng() * 20, -rng() * 30)}${body}</g>` : body
  }
  const floes = [
    [700, 640, 66, 8, 0], [980, 646, 46, 6, 0], [420, 666, 52, 7, 0], [1560, 696, 48, 8, 0], [760, 690, 30, 4, 0], [1010, 702, 40, 6, 0],
    [380, 760, 88, 14, 12], [1080, 766, 78, 12, 8], [660, 742, 42, 7, 0], [1250, 792, 46, 7, 0], [1500, 770, 104, 17, 0],
  ].map(([x, y, w, h, d]) => floe(x, y, w, h, d)).join('')
  return water + reflections + b.svg() + lights + floes + ice.svg()
}

// The foreground: low snow banks in the bottom corners and a streetlamp whose light
// flickers on the snow.
function foreground() {
  const rng = mulberry32(64)
  const snow = new Brush()
  const bank = (pts, fill) => `<path d="${poly(pts)}Z" fill="${fill}"/>`
  const left = [[0, 846], [80, 836], [180, 846], [270, 868], [320, 900], [0, 900]]
  const right = [[1240, 900], [1320, 872], [1440, 856], [1600, 850], [1600, 900]]
  for (let i = 0; i < 44; i++) {
    const onLeft = i % 2 === 0
    const x = onLeft ? rng() * 300 : 1280 + rng() * 320
    const yTop = onLeft ? 846 + (x / 320) * 54 : 900 - ((x - 1240) / 360) * 50
    const y = yTop + 6 + rng() * (900 - yTop)
    const shade = (y - yTop) / (900 - yTop)
    snow.add(shade < 0.3 ? pick(rng, ['#e2ddf0', '#eeeaf6', '#d0cae6']) : pick(rng, ['#9a94c0', '#7a74a6', '#aaa4cc', '#6a6496']), [5, 8, 12][i % 3], '0.8', stroke(x, y, 20 + rng() * 50, (rng() - 0.5) * 0.25, (rng() - 0.5) * 6))
  }
  const lamp = `<path d="M1472 780V636" stroke="#16151c" stroke-width="4"/><path d="M1472 640q14 -6 22 4" stroke="#16151c" stroke-width="3" fill="none"/>` +
    `<path d="M1488 642h12l-2 8h-8z" fill="#f6d690"/>` +
    `<g>${ao('1;0.8;1;0.9;1', 3.4, 0, '0;0.2;0.45;0.7;1')}<circle cx="1494" cy="648" r="56" fill="url(#de-ember)" opacity="0.55"/><ellipse cx="1494" cy="788" rx="70" ry="12" fill="url(#de-ember)" opacity="0.5"/></g>`
  return bank(left, '#8a84b0') + bank(right, '#8a84b0') + snow.svg() +
    `<path d="${poly(left.slice(0, -1))}" fill="none" stroke="#e6e2f2" stroke-opacity="0.7" stroke-width="3"/><path d="${poly(right.slice(1))}" fill="none" stroke="#e6e2f2" stroke-opacity="0.7" stroke-width="3"/>` + lamp
}

// A slow, light snowfall, and gulls.
function snowfall() {
  const rng = mulberry32(31)
  return Array.from({ length: 10 }, () => {
    const d = 14 + rng() * 12
    return `<g transform="translate(${n0(rng() * W)} -10)"><g>${at('translate', `0 0;-40 ${H + 20}`, n1(d), -rng() * d, '', false)}<circle r="${n1(0.9 + rng() * 1.1)}" fill="#f2eefa" opacity="${n1(0.5 + rng() * 0.4)}"/></g></g>`
  }).join('')
}
function gulls() {
  const one = (x, y, s, d, l) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><g>${at('translate', '0 0;60 -14;120 6;50 18;0 0', d, l)}<path d="M-10 0Q-5 -6 0 -1Q5 -6 10 0Q5 -3 0 1Q-5 -3 -10 0Z" fill="#efeadc">${at('scale', '1 1;1 -0.4;1 1', 0.8, l / 5)}</path></g></g>`
  return one(560, 400, 1, 20, -3) + one(640, 360, 0.8, 24, -11) + one(820, 560, 0.9, 18, -6)
}

// ---------------------------------------------------------------- the scene

export function buildScene() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="de-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10223e"/><stop offset="0.4" stop-color="#245a6a"/><stop offset="0.75" stop-color="#7aa08c"/><stop offset="1" stop-color="#e2c48c"/></linearGradient>
    <radialGradient id="de-blast"><stop offset="0" stop-color="#ffc060" stop-opacity="0.85"/><stop offset="0.4" stop-color="#ee7a2a" stop-opacity="0.45"/><stop offset="1" stop-color="#e0601e" stop-opacity="0"/></radialGradient>
    <linearGradient id="de-shaft" gradientUnits="userSpaceOnUse" x1="${BLAST.x}" y1="${BLAST.y}" x2="200" y2="800"><stop offset="0" stop-color="#f8d898" stop-opacity="0.5"/><stop offset="1" stop-color="#f8d898" stop-opacity="0"/></linearGradient>
    <radialGradient id="de-puff-r" cx="0.62" cy="0.3" r="0.75"><stop offset="0" stop-color="#fff2d4"/><stop offset="0.4" stop-color="#f0dfb8"/><stop offset="0.75" stop-color="#c2d0bc"/><stop offset="1" stop-color="#98b4ae"/></radialGradient>
    <radialGradient id="de-puff-l" cx="0.38" cy="0.3" r="0.75"><stop offset="0" stop-color="#fff2d4"/><stop offset="0.4" stop-color="#f0dfb8"/><stop offset="0.75" stop-color="#c2d0bc"/><stop offset="1" stop-color="#98b4ae"/></radialGradient>
    <radialGradient id="de-cloud-foot"><stop offset="0" stop-color="#f6e2a8" stop-opacity="0.8"/><stop offset="1" stop-color="#f6e2a8" stop-opacity="0"/></radialGradient>
    <linearGradient id="de-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8d6a0" stop-opacity="0"/><stop offset="0.6" stop-color="#dcc898" stop-opacity="0.5"/><stop offset="1" stop-color="#b8a888" stop-opacity="0.2"/></linearGradient>
    <linearGradient id="de-town-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2cfa0" stop-opacity="0.55"/><stop offset="0.6" stop-color="#cdbc98" stop-opacity="0.32"/><stop offset="1" stop-color="#c8b898" stop-opacity="0"/></linearGradient>
    <linearGradient id="de-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a6050"/><stop offset="0.2" stop-color="#4a3430"/><stop offset="0.6" stop-color="#2e2228"/><stop offset="1" stop-color="#1a1418"/></linearGradient>
    <radialGradient id="de-sheen"><stop offset="0" stop-color="#f2b866" stop-opacity="0.55"/><stop offset="0.5" stop-color="#c8783a" stop-opacity="0.25"/><stop offset="1" stop-color="#c8783a" stop-opacity="0"/></radialGradient>
    <radialGradient id="de-lamp"><stop offset="0" stop-color="#f8f4e0" stop-opacity="0.85"/><stop offset="0.3" stop-color="#cfe8de" stop-opacity="0.3"/><stop offset="1" stop-color="#cfe8de" stop-opacity="0"/></radialGradient>
    <radialGradient id="de-ember"><stop offset="0" stop-color="#ff9a3a" stop-opacity="0.8"/><stop offset="1" stop-color="#ff9a3a" stop-opacity="0"/></radialGradient>
    <radialGradient id="de-backlight" gradientUnits="userSpaceOnUse" cx="${BLAST.x - 40}" cy="${BLAST.y + 90}" r="720"><stop offset="0" stop-color="#ffd890" stop-opacity="0.38"/><stop offset="0.35" stop-color="#f2b870" stop-opacity="0.16"/><stop offset="1" stop-color="#f2b870" stop-opacity="0"/></radialGradient>
    <linearGradient id="de-cool" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14283a" stop-opacity="0"/><stop offset="1" stop-color="#14283a" stop-opacity="0.45"/></linearGradient>
    <radialGradient id="de-vignette" cx="0.5" cy="0.5" r="0.78"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#05080e" stop-opacity="0.7"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#de-sky)"/>
  ${sky()}
  ${blast()}
  ${clouds()}
  ${aerostats()}
  ${city()}
  ${harbour()}
  ${nearTown()}
  ${pier()}
  ${church()}
  <rect width="${W}" height="${H}" fill="url(#de-backlight)"/>
  <rect y="${HORIZON + 60}" width="${W}" height="${H - HORIZON - 60}" fill="url(#de-cool)"/>
  ${foreground()}
  ${gulls()}
  ${snowfall()}
  <rect width="${W}" height="${H}" fill="url(#de-vignette)"/>
</svg>`
}
