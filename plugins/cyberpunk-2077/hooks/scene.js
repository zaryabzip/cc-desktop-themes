// Cyberpunk 2077 inspired: a neon megacity seen from a dusty roadside, as an original
// scene. No logos, ads, characters or vehicles from the game: the towers, the signs
// (made-up words and abstract panels) and the wedge car are all drawn for this scene.
// Megatowers crowd the left, wrapped in tall billboards; a cluster of corporate blocks
// joined by a skybridge stands on the right; pale towers fade into the haze between.
// Shacks and palms line the midground, a road and a parked wedge coupe the foreground.
//
// The sky turns from day to dusk to night to dawn and back, in one two-minute loop.
// At night the towers go dark blue, thousands of windows light up, the streetlamp
// comes on, the car's lights and underglow switch on, and flying cars cross with
// their lights. The billboards glow day and night.
//
// Cost: the full-screen fades step in small increments (calcMode discrete), so the
// browser repaints a few times a second during a fade and not at all between. Moving
// parts are small. No filters. All motion is SMIL and every colour a presentation
// attribute: the desktop app draws the scene in a script-less frame.

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
const HORIZON = 600
const n0 = (v) => Math.round(v)
const n1 = (v) => (Math.round(v * 10) / 10).toString()
const pick = (rng, list) => list[Math.floor(rng() * list.length)]

// ---------------------------------------------------------------- the day cycle

const DAY = 120 // seconds for one full loop
// Opacity over the loop, as [time 0..1, value] points.
const NIGHT = [[0, 1], [0.03, 1], [0.11, 0], [0.44, 0], [0.54, 1], [1, 1]]
const DUSK = [[0, 0.6], [0.04, 1], [0.11, 0], [0.42, 0], [0.49, 1], [0.56, 0], [0.95, 0], [1, 0.6]]
const SUNUP = NIGHT.map(([t, v]) => [t, 1 - v])

// A fade that steps in 0.04 increments, so the browser repaints only at each step.
// A fade over the day loop: a continuous, eased change between the given points, so
// the light shifts without visible steps. Between fades the value holds still, so the
// browser has nothing to repaint.
function stepped(points, scale = 1) {
  const vs = points.map(([, v]) => (v * scale).toFixed(2)).join(';')
  const ts = points.map(([t]) => t.toFixed(4)).join(';')
  const splines = points.slice(1).map(() => '0.42 0 0.58 1').join(';')
  return `<animate attributeName="opacity" values="${vs}" keyTimes="${ts}" dur="${DAY}s" repeatCount="indefinite" calcMode="spline" keySplines="${splines}"/>`
}
const layer = (points, content, scale = 1) => `<g opacity="${points[0][1] * scale}">${stepped(points, scale)}${content}</g>`

function ao(values, dur, begin = 0, kt = '', calc = '') {
  const times = kt ? ` keyTimes="${kt}"` : ''
  const start = begin ? ` begin="${n1(begin)}s"` : ''
  const mode = calc ? ` calcMode="${calc}"` : ''
  return `<animate attributeName="opacity" values="${values}"${times} dur="${dur}s"${start} repeatCount="indefinite"${mode}/>`
}

// Shapes of one fill, merged into one path.
class Shapes {
  constructor() { this.g = new Map() }
  add(fill, d) {
    if (!this.g.has(fill)) this.g.set(fill, [])
    this.g.get(fill).push(d)
  }
  rect(fill, x, y, w, h) { this.add(fill, `M${n1(x)} ${n1(y)}h${n1(w)}v${n1(h)}h${n1(-w)}z`) }
  svg(extra = '') { return [...this.g].map(([f, ds]) => `<path d="${ds.join('')}" fill="${f}"${extra}/>`).join('') }
}

// ---------------------------------------------------------------- the sky

// The sun and the moon cross on arcs; each sits below the skyline when it is not up.
function arc(t0, t1, x0, x1, yLow, yHigh) {
  // The glow is kept small, so moving it smoothly stays cheap to repaint.
  // Smooth motion along the arc, through 24 points.
  const n = 24
  const ts = [0]
  const vs = [`${x0} ${yLow + 200}`]
  for (let i = 0; i <= n; i++) {
    const u = i / n
    ts.push(t0 + (t1 - t0) * u)
    vs.push(`${n0(x0 + (x1 - x0) * u)} ${n0(yLow - (yLow - yHigh) * Math.sin(u * Math.PI))}`)
  }
  ts.push(t1 + 0.0001)
  vs.push(`${x0} ${yLow + 200}`)
  return `<animateTransform attributeName="transform" type="translate" values="${vs.join(';')}" keyTimes="${ts.map((t) => t.toFixed(4)).join(';')}" dur="${DAY}s" repeatCount="indefinite"/>`
}

function sky() {
  const rng = mulberry32(5)
  let stars = ''
  for (let i = 0; i < 70; i++) stars += `M${n0(rng() * W)} ${n0(rng() * 380)}h1.6v1.6h-1.6z`
  const cloud = (x, y, w) => `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${n0(w * 0.22)}"/><ellipse cx="${x + w * 0.3}" cy="${y - w * 0.1}" rx="${w * 0.5}" ry="${n0(w * 0.2)}"/>`
  return `<rect width="${W}" height="${H}" fill="url(#cp-day)"/>` +
    layer(DUSK, `<rect width="${W}" height="${H}" fill="url(#cp-dusk)"/>`) +
    layer(NIGHT, `<rect width="${W}" height="${H}" fill="url(#cp-night)"/><path d="${stars}" fill="#dfe8ff" opacity="0.7"/>`) +
    // The sun, rising at dawn and setting at dusk.
    `<g>${arc(0.05, 0.5, 380, 1380, 560, 150)}<circle r="90" fill="url(#cp-sun-glow)"/><circle r="26" fill="#fff4d8"/></g>` +
    // The moon, at night.
    `<g>${arc(0.55, 0.98, 300, 1300, 560, 120)}<circle r="48" fill="url(#cp-moon-glow)"/><circle r="16" fill="#e8f0ff"/><circle cx="5" cy="-4" r="14" fill="#c8d4ee" opacity="0.5"/></g>` +
    // Clouds: pale by day, dim at night.
    layer(SUNUP.map(([t, v]) => [t, 0.35 + v * 0.65]), `<g fill="#f2f6ff" opacity="0.55">${cloud(1180, 150, 90)}${cloud(1420, 90, 60)}${cloud(900, 230, 70)}${cloud(1500, 260, 50)}</g>`)
}

// ---------------------------------------------------------------- the city

// A vertical sign of glyph strokes: made-up characters.
function glyphs(rng, x, y, w, h, color) {
  let d = ''
  for (let gy = y + 4; gy < y + h - 10; gy += w + 4) {
    const k = Math.floor(rng() * 4)
    if (k === 0) d += `M${x + 3} ${gy}h${w - 6}M${x + w / 2} ${gy}v${w - 4}`
    else if (k === 1) d += `M${x + 3} ${gy}v${w - 4}h${w - 6}M${x + 3} ${gy + (w - 4) / 2}h${w - 6}`
    else if (k === 2) d += `M${x + 3} ${gy}l${w - 6} ${w - 4}M${x + w - 3} ${gy}v${w - 4}`
    else d += `M${x + 3} ${gy}h${w - 6}v${w - 4}h${-(w - 6)}z`
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#160c18"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>` +
    `<rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" fill="${color}" opacity="0.12"/>`
}

// An abstract billboard: a gradient panel with bold shapes and scanlines. No
// figures or marks from anywhere: shapes only.
let BB = 0
function billboard(x, y, w, h, c1, c2, fg, kind, flick = 0) {
  const id = `cp-bb${BB++}`
  const cx = x + w / 2
  let art = ''
  if (kind === 0) art = `<circle cx="${cx}" cy="${y + h * 0.36}" r="${w * 0.26}" fill="${fg}"/><path d="M${x + w * 0.12} ${y + h * 0.95}Q${cx} ${y + h * 0.5} ${x + w * 0.88} ${y + h * 0.95}Z" fill="${fg}"/>`
  else if (kind === 1) art = `<path d="M${x + w * 0.18} ${y + h * 0.25}L${x + w * 0.82} ${y + h * 0.5}L${x + w * 0.18} ${y + h * 0.75}Z" fill="${fg}"/>`
  else if (kind === 2) art = Array.from({ length: 6 }, (_, i) => `<rect x="${n0(x + w * 0.12)}" y="${n0(y + h * (0.12 + i * 0.13))}" width="${n0(w * (0.3 + ((i * 37) % 50) / 100))}" height="${n0(h * 0.06)}" fill="${fg}"/>`).join('')
  else if (kind === 3) art = `<path d="M${x + w * 0.1} ${y + h * 0.55}L${cx} ${y + h * 0.15}L${x + w * 0.9} ${y + h * 0.55}L${cx} ${y + h * 0.9}Z" fill="none" stroke="${fg}" stroke-width="${n1(w * 0.07)}"/>`
  else art = Array.from({ length: 4 }, (_, i) => `<circle cx="${cx}" cy="${n0(y + h * 0.5)}" r="${n1(w * (0.12 + i * 0.1))}" fill="none" stroke="${fg}" stroke-width="${n1(w * 0.03)}"/>`).join('') + `<path d="M${x + w * 0.2} ${y + h * 0.82}h${w * 0.6}" stroke="${fg}" stroke-width="${n1(w * 0.08)}"/>`
  const panel = `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id})"/>${art}<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#cp-scan)"/>`
  const glow = `<rect x="${x - 8}" y="${y - 8}" width="${w + 16}" height="${h + 16}" fill="${c1}" opacity="0.16"/>`
  return flick ? `<g>${ao('1;0.4;1;1;0.6;1', flick, 0, '0;0.04;0.08;0.7;0.73;1', 'discrete')}${glow}${panel}</g>` : glow + panel
}

// A neon word: made-up words.
const word = (x, y, text, color, size = 18) =>
  `<text x="${x}" y="${y}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${size}" fill="${color}" letter-spacing="2">${text}</text>`

// The city: three depths, built as masses. Each tower shows its front and the side
// that faces the street's vanishing point, narrows at setbacks, carries rooftop gear,
// and has a facade of its own kind: a glass grid, vertical ribs or floor bands. Faces
// turned to the low sun on the right are warm; faces turned away are in shade. By
// night a lit-window pattern covers the fronts.
const VP = [820, 600]
function city() {
  const rng = mulberry32(2077)
  const far = new Shapes()
  let out = ''
  let nightRects = ''
  // A tower of one or more tiers. `side` is the depth of its visible side face.
  const tower = (x, top, w, base, side, face, kind, tiers = []) => {
    const left = x + w / 2 < VP[0]
    let g = ''
    let ty = top
    let tx = x
    let tw = w
    const levels = [[top, x, w], ...tiers.map(([f, k]) => [top + (base - top) * f, x + (w - w * k) / 2, w * k])].reverse()
    // Draw from the base tier up, each tier its own box.
    const bands = []
    let floor = base
    for (const [lt, lx, lw] of levels) {
      bands.push([lt, lx, lw, floor])
      floor = lt
    }
    for (const [lt, lx, lw, lb] of bands) {
      ty = lt
      tx = lx
      tw = lw
      // The side face, receding toward the vanishing point.
      const ex = left ? tx + tw : tx
      const dx = left ? side : -side
      const k = side / Math.max(40, Math.abs(VP[0] - ex))
      const dyT = (VP[1] - ty) * k
      const dyB = (VP[1] - lb) * k
      const sideFill = left ? '#c8a07a' : '#26303e'
      g += `<path d="M${n0(ex)} ${n0(ty)}L${n0(ex + dx)} ${n0(ty + dyT)}L${n0(ex + dx)} ${n0(lb + dyB)}L${n0(ex)} ${n0(lb)}Z" fill="${face}"/>` +
        `<path d="M${n0(ex)} ${n0(ty)}L${n0(ex + dx)} ${n0(ty + dyT)}L${n0(ex + dx)} ${n0(lb + dyB)}L${n0(ex)} ${n0(lb)}Z" fill="${sideFill}" opacity="${left ? 0.35 : 0.45}"/>`
      // The front face, its facade, and a reflection that brightens toward the top.
      g += `<rect x="${n0(tx)}" y="${n0(ty)}" width="${n0(tw)}" height="${n0(lb - ty)}" fill="${face}"/>` +
        `<rect x="${n0(tx + 3)}" y="${n0(ty + 4)}" width="${n0(tw - 6)}" height="${n0(lb - ty - 6)}" fill="url(#cp-${kind})"/>` +
        `<rect x="${n0(tx)}" y="${n0(ty)}" width="${n0(tw)}" height="${n0(lb - ty)}" fill="url(#cp-sheen)"/>`
      // The parapet, lit on the sun side.
      g += `<rect x="${n0(tx - 2)}" y="${n0(ty - 4)}" width="${n0(tw + 4)}" height="5" fill="${face}"/><path d="M${n0(tx - 2)} ${n0(ty - 4)}h${n0(tw + 4)}" stroke="#ffd8a8" stroke-opacity="0.5" stroke-width="1.5"/>`
      nightRects += `M${n0(tx + 3)} ${n0(ty + 4)}h${n0(tw - 6)}v${n0(lb - ty - 6)}h${n0(-(tw - 6))}z`
    }
    // Rooftop gear on the top tier: plant boxes and antenna masts.
    const rt = ty
    const bx = tx + tw * (0.15 + rng() * 0.3)
    g += `<rect x="${n0(bx)}" y="${n0(rt - 14)}" width="${n0(tw * 0.25)}" height="12" fill="${face}"/><rect x="${n0(bx + tw * 0.3)}" y="${n0(rt - 8)}" width="${n0(tw * 0.15)}" height="7" fill="${face}"/>`
    const ax = tx + tw * (0.6 + rng() * 0.3)
    g += `<path d="M${n0(ax)} ${n0(rt)}v${-n0(30 + rng() * 50)}M${n0(ax - 6)} ${n0(rt - 20)}h12" stroke="${face}" stroke-width="2.4"/>`
    // The sun-side edge.
    g += `<path d="M${n0(left ? tx + tw : tx + tw)} ${n0(rt)}V${n0(base)}" stroke="#ffd8a8" stroke-opacity="0.35" stroke-width="2"/>`
    out += g
  }
  // Far haze towers in the middle distance: pale silhouettes.
  let x = 600
  let farD = ''
  let farBody = ''
  while (x < 1180) {
    const w = 24 + rng() * 46
    const top = 330 + rng() * 180
    far.rect('#b2c2ce', x, top, w, 600 - top)
    far.rect('#d2dce4', x + w - 4, top, 4, 600 - top)
    farBody += `M${n0(x)} ${n0(top)}h${n0(w)}V600h${n0(-w)}z`
    farD += `M${n0(x + 3)} ${n0(top + 4)}h${n0(w - 6)}V600h${n0(-(w - 6))}z`
    x += w + 2 + rng() * 8
  }
  // The window pattern sits on the towers only, not on the sky between them.
  const farPats = `<path d="${farD}" fill="url(#cp-win-far)" opacity="0.6"/>`
  // By night the far towers go dark, with a few dim lit windows.
  const farNight = `<path d="${farBody}" fill="#1a2440" opacity="0.75"/>` +
    `<path d="${farD}" fill="url(#cp-win-farnight)"/>`
  // The right cluster, drawn from the vanishing point outward: back row, then front.
  for (const [bx, top, w, c, kind] of [[1000, 300, 70, '#7a8ca0', 'grid'], [1070, 330, 60, '#5a6e88', 'screens'], [1380, 300, 80, '#4a5a78', 'screens'], [1520, 280, 90, '#6a7890', 'bands']]) tower(bx, top, w, 610, 10, c, kind)
  for (const [bx, top, w, side, kind, tiers, c] of [[1040, 270, 110, 18, 'screens', [], '#22304a'], [1150, 200, 92, 16, 'ribs', [[0.3, 0.8]], '#3a4660'], [1185, 360, 115, 16, 'bands', [], '#8a7a6a'], [1260, 236, 190, 28, 'screens', [[0.25, 0.85]], '#1e2a44'], [1460, 150, 160, 24, 'screens', [[0.2, 0.8], [0.45, 0.9]], '#24324e']]) tower(bx, top, w, 620, side, c, kind, tiers)
  // The left megatowers, drawn from the vanishing point outward.
  tower(740, 250, 60, 640, 10, '#8a8478', 'grid')
  tower(600, 20, 130, 640, 20, '#8a5a40', 'bands', [[0.18, 0.8]])
  tower(490, 80, 95, 640, 16, '#2c3a52', 'screens', [[0.25, 0.8]])
  tower(365, -20, 105, 640, 18, '#a88a6a', 'ribs')
  tower(180, 50, 150, 640, 26, '#4a5466', 'grid', [[0.3, 0.82]])
  tower(-40, -20, 190, 640, 30, '#6a6458', 'dots')
  // The skybridge on the right: a solid enclosed span from the face of one tower to
  // the face of the next, each end set into its tower, with a strip of windows and a
  // darker underside. Nothing hangs free.
  const frame = `<path d="M1196 206H1500V234H1196Z" fill="#26324a"/>` +
    `<path d="M1206 214H1490V224H1206Z" fill="url(#cp-screens)"/>` +
    `<path d="M1196 230H1500V234H1196Z" fill="#141c2c"/>` +
    `<path d="M1196 206V234M1500 206V234" stroke="#141c2c" stroke-width="3"/>` +
    `<path d="M1196 206H1500" stroke="#ffd8a8" stroke-width="1.5" opacity="0.5"/>`
  let scaffold = ''
  for (let y = 380; y < 600; y += 30) scaffold += `M60 ${y}H230M60 ${y}l30 30M230 ${y}l-30 30`
  scaffold += 'M60 380V610M230 380V610M140 380V300M90 300H260M250 300v40'
  return {
    far: far.svg() + farPats,
    farNight,
    body: out,
    pats: '',
    frame: frame + `<path d="${scaffold}" stroke="#2a2f36" stroke-width="4" fill="none"/>`,
    nightWin: `<path d="${nightRects}" fill="url(#cp-win-night)"/>`,
  }
}

// Signs and billboards: lit day and night, drawn over the night grade.
function signs() {
  BB = 0
  const rng = mulberry32(99)
  // Neon bands across the right towers and lit edges on the left towers. Drawn first,
  // so every panel, screen and logo sits in front of them; each band runs at a height
  // clear of the logo, its name and the screens.
  return `<path d="M1044 300H1146M1264 252H1446M1464 180H1616M1044 470H1146M1264 520H1436M1154 260H1238M1464 330H1616" stroke="#46f0ff" stroke-width="3" opacity="0.9"/>` +
    `<path d="M1044 300H1146M1264 252H1446M1464 180H1616M1044 470H1146M1264 520H1436" stroke="#46f0ff" stroke-width="10" opacity="0.15"/>` +
    `<path d="M1186 560H1300M1464 500H1616" stroke="#ff4fa3" stroke-width="3" opacity="0.85"/>` +
    `<path d="M150 0V640" stroke="#ffd09a" stroke-width="6" opacity="0.7"/><path d="M150 0V640" stroke="#ffd09a" stroke-width="18" opacity="0.15"/>` +
    `<path d="M585 80V640M730 20V640" stroke="#ff9a3c" stroke-width="2.4" opacity="0.8"/>` +
    // Sign blades hanging off the towers' edges, stacked down toward the street. Drawn
    // before the billboards, so a billboard covers any blade behind it.
    [170, 360, 470, 570, 600, 700, 730].map((ex) => Array.from({ length: 7 }, () => {
      const y = 260 + rng() * 340
      const w = 14 + rng() * 22
      const h = 10 + rng() * 22
      const c = pick(rng, ['#ff4fa3', '#5ff2ff', '#ffd23f', '#c06cff', '#ff7a3a', '#3affc8', '#f2f6ff'])
      const x = ex - (rng() < 0.5 ? w : 0)
      return `<path d="M${n0(ex)} ${n0(y + h / 2)}h${x < ex ? -4 : 4}" stroke="#20242a" stroke-width="2"/><rect x="${n0(x)}" y="${n0(y)}" width="${n0(w)}" height="${n0(h)}" fill="${c}" opacity="0.9"/><rect x="${n0(x + 2)}" y="${n0(y + h * 0.4)}" width="${n0(w * 0.6)}" height="2" fill="#120a18" opacity="0.6"/>`
    }).join('')).join('') +
    glyphs(rng, 336, 20, 22, 300, '#5ff2ff') +
    glyphs(rng, 588, 44, 20, 300, '#ff9a3c') +
    // Big panels across the tower fronts: one tall wrap on the near tower, a stack of
    // screens up the middle towers. Abstract art only.
    billboard(196, 150, 120, 330, '#ff3fa0', '#5a1aa0', '#2a0b3a', 4, 13) +
    billboard(372, 60, 82, 440, '#ff4fb0', '#7a2ad0', '#ffe2f2', 0, 7) +
    billboard(498, 96, 72, 200, '#c040ff', '#5a1a90', '#ffd23f', 3) +
    billboard(498, 304, 72, 80, '#3ad7ff', '#105080', '#0e1030', 2, 17) +
    billboard(612, 120, 92, 150, '#ffd23f', '#e07810', '#3a1640', 1) +
    billboard(612, 280, 60, 120, '#ff4f8a', '#902050', '#ffe9a8', 4) +
    billboard(676, 300, 40, 90, '#3affc8', '#10806a', '#0a1a20', 0, 11) +
    billboard(212, 492, 52, 90, '#3ad7ff', '#1a6aa0', '#0e1030', 1, 11) +
    billboard(492, 404, 56, 64, '#ffd23f', '#e08a10', '#3a1640', 3) +
    billboard(640, 470, 66, 70, '#ff4f8a', '#902050', '#ffe9a8', 2) +
    billboard(574, 360, 34, 36, '#2ad1ff', '#105080', '#e8fbff', 1) +
    billboard(1104, 330, 40, 110, '#f0e8e0', '#c8b8b0', '#3a3040', 0) +
    billboard(1186, 384, 48, 76, '#2ad1ff', '#1a5a90', '#ffffff', 2, 9) +
    billboard(1326, 386, 44, 60, '#d23cff', '#601a90', '#9ff4ff', 3) +
    billboard(1456, 430, 54, 40, '#3affc8', '#108a70', '#0a1a20', 1) +
    // The corporate mark: an original emblem and a made-up name.
    `<circle cx="1352" cy="296" r="22" fill="none" stroke="#f2f6ff" stroke-width="5"/><path d="M1352 280v32M1338 296h28" stroke="#f2f6ff" stroke-width="4"/>` +
    word(1300, 342, 'HAYAMI', '#f2f6ff', 22) +
    `<path d="M1196 208H1500" stroke="#46f0ff" stroke-width="3"/><path d="M1196 232H1500" stroke="#46f0ff" stroke-width="2" opacity="0.6"/>` +
    word(-4, 26, 'SYNAPSE', '#46f0ff', 22) +
    word(1218, 476, 'NEON 24', '#5ff2ff', 14) + word(470, 560, 'KAIRO', '#ff4fa3', 18) +
    `<g>${ao('1;1;0.2;1;0.3;1', 5.3, 0, '0;0.6;0.62;0.66;0.68;1', 'discrete')}${word(1050, 520, 'HOTEL', '#ffd23f', 16)}</g>`
}

// ---------------------------------------------------------------- the ground

// Smog: a low band of soft cloud between the towers, and a warm haze over the city.
function smog() {
  const rng = mulberry32(13)
  let puffs = ''
  for (let i = 0; i < 18; i++) puffs += `<ellipse cx="${n0(560 + rng() * 1080)}" cy="${n0(470 + rng() * 60)}" rx="${n0(60 + rng() * 120)}" ry="${n0(12 + rng() * 18)}"/>`
  return `<rect y="300" width="${W}" height="340" fill="url(#cp-haze)"/><g fill="#eef2f0" opacity="0.5">${puffs}</g>`
}

// A cable-stayed bridge in the middle distance, in the gap between the left towers and
// the right cluster: a deck, an A-shaped pylon, and stay cables fanning down to the
// deck. Drawn behind the right towers, so they cover its far end. A red light blinks
// on the pylon's top.
function bridge() {
  const deckY = 574
  const px = 930
  const top = 452
  let cables = ''
  for (let i = 1; i <= 7; i++) {
    cables += `M${px} ${top + 10 + i * 4}L${px - i * 34} ${deckY}M${px} ${top + 10 + i * 4}L${px + i * 34} ${deckY}`
  }
  return `<g opacity="0.75">` +
    `<path d="M780 ${deckY}H1120V${deckY + 6}H780Z" fill="#5a6470"/><path d="M780 ${deckY}H1120" stroke="#d8c8a8" stroke-width="1.2"/>` +
    `<path d="${cables}" stroke="#4a5460" stroke-width="1" fill="none"/>` +
    `<path d="M${px - 12} ${deckY + 30}L${px - 2} ${top}H${px + 2}L${px + 12} ${deckY + 30}H${px + 6}L${px} ${top + 30}L${px - 6} ${deckY + 30}Z" fill="#4a5460"/>` +
    `<path d="M${px - 8} ${deckY - 18}H${px + 8}" stroke="#4a5460" stroke-width="3"/>` +
    `<path d="M${px - 2} ${top}V${deckY + 30}" stroke="#e8c8a0" stroke-width="1" opacity="0.6"/>` +
    `</g><circle cx="${px}" cy="${top - 2}" r="2.4" fill="#ff3a3a">${ao('1;0.15;1', 2.4, 0, '0;0.5;1', 'discrete')}</circle>`
}

// Low smog: a band of soft cloud across the tower bases, so the towers rise out of it.
// Cream by day; by night the same band, darker, catching the city's glow.
function lowSmog(color, op) {
  const rng = mulberry32(31)
  let puffs = ''
  for (let i = 0; i < 16; i++) puffs += `<ellipse cx="${n0(rng() * W)}" cy="${n0(592 + rng() * 26)}" rx="${n0(90 + rng() * 140)}" ry="${n0(14 + rng() * 12)}"/>`
  return `<g fill="${color}" opacity="${op}">${puffs}</g>`
}

// Midground: shacks with corrugated roofs, debris, palms and power lines.
function midground() {
  const rng = mulberry32(7)
  const sh = new Shapes()
  const shacks = (from, to, base) => {
    let x = from
    while (x < to) {
      const w = 40 + rng() * 70
      const h = 18 + rng() * 26
      sh.rect(pick(rng, ['#6a5e50', '#5a5248', '#74685a', '#4e4a44']), x, base - h, w, h)
      sh.add('#8a7c6a', `M${n0(x - 4)} ${n0(base - h)}l${n0(w + 8)} -5v5z`)
      x += w + rng() * 14
    }
  }
  shacks(-10, 760, 640)
  shacks(1330, W, 620)
  const palm = (px, base, ph) => {
    const top = base - ph
    let fronds = ''
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.42
      const len = 40 + (i % 3) * 10
      const ex = px + Math.cos(a) * len
      const ey = top + Math.sin(a) * len * 0.5 + len * 0.55
      fronds += `M${px} ${top}Q${n0(px + Math.cos(a) * len * 0.5)} ${n0(top - 14)} ${n0(ex)} ${n0(ey)}`
    }
    return `<path d="M${px - 3} ${base}Q${px + 8} ${top + ph / 2} ${px} ${top}" stroke="#3a3026" stroke-width="5" fill="none"/>` +
      `<path d="${fronds}" stroke="#2a3622" stroke-width="7" fill="none" stroke-linecap="round"/>`
  }
  // A low concrete wall on the right, sprayed with graffiti (abstract shapes and
  // made-up tags), its top catching the sun.
  const wall = `<path d="M1300 606H1600V652H1300Z" fill="#7a7062"/><path d="M1300 606H1600" stroke="#ffd8a8" stroke-width="2" opacity="0.7"/>` +
    `<path d="M1312 640q20 -24 44 -6q16 -20 36 -2M1410 642q14 -18 30 -4l18 -16M1480 636q26 -20 50 0q12 -12 30 -6" fill="none" stroke="#e85aa8" stroke-width="5" stroke-linecap="round" opacity="0.8"/>` +
    `<path d="M1330 626h40M1440 624l24 -6M1520 628h30" stroke="#3ad7e6" stroke-width="4" stroke-linecap="round" opacity="0.75"/>` +
    `<path d="M1300 652H1600" stroke="#2a2620" stroke-width="3"/>`
  return sh.svg() + wall + palm(380, 640, 130) + palm(316, 640, 90) + palm(1300, 620, 120) + palm(1420, 622, 88) + palm(990, 612, 60) +
    `<path d="M0 520Q300 560 620 540M620 540Q900 520 1220 550" stroke="#2a2a2a" stroke-width="1.4" fill="none"/>`
}

// The road, the concrete barrier on the left catching the low sun, and the tall
// streetlamp on the right.
function road() {
  const rng = mulberry32(21)
  let debris = ''
  for (let i = 0; i < 60; i++) debris += `M${n0(rng() * 1000)} ${n0(660 + rng() * 220)}h${n0(4 + rng() * 18)}v${n0(2 + rng() * 3)}h${n0(-(4 + rng() * 18))}z`
  let cracks = ''
  for (let i = 0; i < 9; i++) {
    let cx = 320 + rng() * 1200
    let cy = 680 + rng() * 200
    cracks += `M${n0(cx)} ${n0(cy)}`
    for (let k = 0; k < 5; k++) { cx += 10 + rng() * 26; cy += (rng() - 0.5) * 12; cracks += `L${n0(cx)} ${n0(cy)}` }
  }
  return `<path d="M0 630H${W}V${H}H0Z" fill="url(#cp-road)"/>` +
    // Warm patches of low sun across the road, between the shadows.
    `<path d="M330 700L900 676L1600 690V730L900 718L340 744Z" fill="#ffc890" opacity="0.14"/>` +
    `<path d="M600 820L1300 800L1600 812V836L1300 826L620 846Z" fill="#ffc890" opacity="0.1"/>` +
    `<ellipse cx="560" cy="860" rx="160" ry="18" fill="#141210" opacity="0.4"/><ellipse cx="1300" cy="780" rx="120" ry="12" fill="#141210" opacity="0.35"/>` +
    `<path d="${cracks}" fill="none" stroke="#1a1714" stroke-width="1.6" opacity="0.7"/>` +
    `<path d="${debris}" fill="#3a342e" opacity="0.7"/>` +
    `<path d="M0 640H${W}" stroke="#b8a690" stroke-width="2" opacity="0.5"/>` +
    // The barrier: heavy concrete blocks running toward us from the left edge, their
    // tops catching the low sun, their faces in shadow, with chips, rebar and a rubble
    // heap at the nearest block.
    [[-20, 700, 120], [100, 682, 110], [205, 668, 95]].map(([bx, by, bw]) => {
      const h = 46 + (300 - bx) * 0.12
      return `<path d="M${bx} ${by}L${bx + bw} ${by - 14}L${bx + bw + 6} ${by - 8}L${bx + bw + 6} ${by - 8 + h}L${bx} ${by + h}Z" fill="#26221f"/>` +
        `<path d="M${bx} ${by}L${bx + bw} ${by - 14}L${bx + bw + 6} ${by - 8}L${bx + 6} ${by + 6}Z" fill="#5a4e42"/>` +
        `<path d="M${bx} ${by}L${bx + bw} ${by - 14}" stroke="#ffd09a" stroke-width="3"/>` +
        `<path d="M${bx + bw * 0.3} ${by + 14}l8 6l-4 8M${bx + bw * 0.7} ${by + 6}l-6 10" stroke="#14110f" stroke-width="2" fill="none"/>`
    }).join('') +
    `<path d="M-10 790L60 760L120 780L170 770L230 800L250 900H-10Z" fill="#1c1916"/>` +
    `<path d="M10 784l20 -18l14 10l22 -16l18 12M90 778l26 -10l18 14" stroke="#4a4036" stroke-width="3" fill="none"/>` +
    `<path d="M40 772l-6 -30M70 768l4 -26M150 774l10 -22" stroke="#6a5a48" stroke-width="2"/>` +
    `<path d="M36 744h14v6h-14zM60 752h20v5h-20zM150 760h14v5h-14z" fill="#ffc870" opacity="0.85"/>` +
    `<path d="M24 712h22v7h-22zM70 706h26v7h-26zM128 694h22v7h-22zM180 688h28v6h-28zM236 678h20v6h-20z" fill="#ffd27a"/>` +
    // The streetlamp.
    `<path d="M1495 900V80" stroke="#4a4438" stroke-width="12"/><path d="M1490 86L1594 60" stroke="#4a4438" stroke-width="10"/>` +
    `<path d="M1500 74l94 -24v18l-94 24z" fill="#5a5448"/><path d="M1502 92l92 -24" stroke="#ffe6a8" stroke-width="6"/><ellipse cx="1548" cy="80" rx="70" ry="18" fill="#ffe6a8" opacity="0.3" transform="rotate(-14 1548 80)"/>`
}

// The car: an original low wedge coupe, as a small 3D model (centimetres) seen from
// behind it and to its left, low and close. X runs nose (-230) to tail (+230), Y
// across (+95 is the near side), Z up. The body is a wedge: low at the nose and high
// at the tail, with a flat tail face, a slim light bar and a slatted grille, a big
// rear wing on two struts, a low glass cabin and wide wheels.
// Fitted so the car sits where it does in the view this scene is built on: tail toward
// the camera, the near side running off to the nose on the right.
// The camera stands 1.4 m above the road, so the ground meets the horizon at y 600.
const CAM = { yaw: 230, pitch: -4, h: 140, D0: 1100, F: 2400, cx: 1079, cy: 445 }
function project(X, Y, Z) {
  const yaw = (CAM.yaw * Math.PI) / 180
  const p = (CAM.pitch * Math.PI) / 180
  const x1 = X * Math.cos(yaw) - Y * Math.sin(yaw)
  const d = X * Math.sin(yaw) + Y * Math.cos(yaw)
  const z = Z - CAM.h
  const zc = CAM.D0 + d * Math.cos(p) - z * Math.sin(p)
  return [CAM.cx + (CAM.F * x1) / zc, CAM.cy - (CAM.F * (d * Math.sin(p) + z * Math.cos(p))) / zc, CAM.F / zc]
}
const pt = ([x, y]) => `${n1(x)} ${n1(y)}`
const face = (pts, fill, extra = '') => `<path d="M${pts.map((q) => pt(project(...q))).join('L')}Z" fill="${fill}"${extra}/>`
const line = (pts, stroke, w, extra = '') => `<path d="M${pts.map((q) => pt(project(...q))).join('L')}" fill="none" stroke="${stroke}" stroke-width="${w}"${extra}/>`
// The top of the body along its length: low nose, rising to the tail.
const topZ = (X) => 44 + ((X + 230) / 460) * 22
function car() {
  // A rounded rectangle in plan, as points round it.
  const rrect = (x0, x1, y0, y1, r, n = 5) => {
    const out = []
    const corners = [[x0 + r, y0 + r, Math.PI], [x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2]]
    for (const [ccx, ccy, a0] of corners) for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2)
      out.push([ccx + r * Math.cos(a), ccy + r * Math.sin(a)])
    }
    return out
  }
  const faces = []
  const C = [0, 0, 50]
  // Shade a face by how it turns to the low sun (up and toward the nose side).
  const L = (() => { const v = [-0.45, 0.25, 0.86]; const m = Math.hypot(...v); return v.map((x) => x / m) })()
  const add = (pts, base, kind = 'body') => {
    const [a, b, c] = [pts[0], pts[1], pts[2]]
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    let nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const mid = pts.reduce((m, q) => [m[0] + q[0] / pts.length, m[1] + q[1] / pts.length, m[2] + q[2] / pts.length], [0, 0, 0])
    if (nrm[0] * (mid[0] - C[0]) + nrm[1] * (mid[1] - C[1]) + nrm[2] * (mid[2] - C[2]) < 0) nrm = nrm.map((x) => -x)
    const m = Math.hypot(...nrm) || 1
    const lit = Math.max(0, (nrm[0] * L[0] + nrm[1] * L[1] + nrm[2] * L[2]) / m)
    const [r0, g0, b0, r1, g1, b1] = kind === 'glass' ? [10, 14, 20, 70, 84, 100] : kind === 'dark' ? [14, 16, 20, 40, 44, 50] : [18, 20, 24, 92, 88, 84]
    const k = kind === 'glass' ? lit * lit : lit
    const fill = `rgb(${n0(r0 + (r1 - r0) * k)},${n0(g0 + (g1 - g0) * k)},${n0(b0 + (b1 - b0) * k)})`
    const depth = pts.reduce((t, q) => t + 1 / project(...q)[2], 0) / pts.length
    faces.push({ pts, fill: base || fill, depth })
  }
  const plan = rrect(-230, 230, -95, 95, 28)
  const inset = rrect(-224, 224, -88, 88, 24)
  const sill = 16
  for (let i = 0; i < plan.length; i++) {
    const j = (i + 1) % plan.length
    const [ax, ay] = plan[i]
    const [bx, by] = plan[j]
    add([[ax, ay, sill], [bx, by, sill], [bx, by, topZ(bx) - 7], [ax, ay, topZ(ax) - 7]])
    add([[ax, ay, topZ(ax) - 7], [bx, by, topZ(bx) - 7], [inset[j][0], inset[j][1], topZ(inset[j][0])], [inset[i][0], inset[i][1], topZ(inset[i][0])]])
  }
  add(inset.map(([x, y]) => [x, y, topZ(x)]))
  // The cabin, lofted from its base to a smaller roof.
  const base = rrect(-74, 150, -76, 76, 24)
  const roof = rrect(-20, 52, -56, 56, 14)
  const roofZ = 92
  for (let i = 0; i < base.length; i++) {
    const j = (i + 1) % base.length
    const rear = base[i][0] > 70 && base[j][0] > 70
    add([[base[i][0], base[i][1], topZ(base[i][0])], [base[j][0], base[j][1], topZ(base[j][0])], [roof[j][0], roof[j][1], roofZ], [roof[i][0], roof[i][1], roofZ]], null, rear ? 'dark' : 'glass')
  }
  add(roof.map(([x, y]) => [x, y, roofZ]))
  // The rear haunch: the near flank swells out over the rear wheel, and a dark sill
  // skirt runs along the bottom between the wheels.
  add([[80, 95, 18], [214, 95, 18], [210, 106, 30], [92, 106, 30]])
  add([[92, 106, 30], [210, 106, 30], [206, 104, topZ(206) - 10], [100, 104, topZ(100) - 10]])
  add([[80, 95, 18], [92, 106, 30], [100, 104, topZ(100) - 10], [76, 95, topZ(76) - 7]])
  add([[-190, 96, 14], [80, 96, 14], [80, 96, 24], [-190, 96, 24]], '#101216')
  faces.sort((a, b) => b.depth - a.depth)
  const body = faces.map((f) => `<path d="M${f.pts.map((q) => pt(project(...q))).join('L')}Z" fill="${f.fill}"/>`).join('')
  // Louvres across the sloping rear deck.
  let louvres = ''
  for (let u = 0.08; u < 0.96; u += 0.08) {
    const X = 52 + 98 * u
    const Z = roofZ - (roofZ - topZ(150)) * u
    louvres += line([[X, -56 - 20 * u, Z], [X, 56 + 20 * u, Z]], '#05070a', 2)
  }
  // The tail: a recessed louvred panel under a thin light bar, the plate, twin pipes.
  let tail = face([[231, -88, 18], [231, 88, 18], [231, 88, 58], [231, -88, 58]], '#0b0d11')
  for (let z = 21; z < 58; z += 4) tail += line([[232, -82, z], [232, 82, z]], '#262a32', 1.3)
  tail += face([[231, -88, 60], [231, 88, 60], [231, 88, 64], [231, -88, 64]], '#3a1216')
  tail += face([[231, -18, 32], [231, 18, 32], [231, 18, 42], [231, -18, 42]], '#d6d0b8')
  const pipe = (y) => { const r = Array.from({ length: 12 }, (_, i) => [236, y + 7 * Math.cos((i / 12) * Math.PI * 2), 14 + 6 * Math.sin((i / 12) * Math.PI * 2)]); return face(r, '#8a8e94') + face(r.map(([X, Y, Z]) => [X + 1, y + (Y - y) * 0.6, 14 + (Z - 14) * 0.6]), '#0a0a0c') }
  tail += pipe(-14) + pipe(14)
  // A ducktail lip over the tail, and a diffuser of fins under it.
  tail += face([[226, -92, topZ(226)], [238, -92, topZ(230) + 3], [238, 92, topZ(230) + 3], [226, 92, topZ(226)]], '#2a2e35') +
    line([[238, -92, topZ(230) + 3], [238, 92, topZ(230) + 3]], '#e8b57a', 1.4, ' opacity="0.7"')
  tail += face([[232, -80, 8], [232, 80, 8], [226, 80, 16], [226, -80, 16]], '#08090b')
  for (let y = -60; y <= 60; y += 30) tail += line([[233, y, 8], [227, y, 16]], '#1e2126', 2)
  // Wheels on the near side, in dark arches: a fat tyre, a dished rim, five spokes.
  const Yn = 95
  const ring = (X0, Y, Z0, r, n = 24) => Array.from({ length: n }, (_, i) => [X0 + r * Math.cos((i / n) * Math.PI * 2), Y, Z0 + r * Math.sin((i / n) * Math.PI * 2)])
  const arch = (x, r) => face(ring(x, Yn + 1, r + 2, r + 9).filter(([, , Z]) => Z > 4), '#07080a')
  const spokes = (x, r) => Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2 + 0.3; return line([[x, Yn + 6, r], [x + r * 0.58 * Math.cos(a), Yn + 6, r + r * 0.58 * Math.sin(a)]], '#4a5058', 2) }).join('')
  const wheel = (x, r) => face(ring(x, Yn + 4, r, r), '#0c0d10') + face(ring(x, Yn + 5, r, r * 0.68), '#1a1d22') + face(ring(x, Yn + 5.5, r, r * 0.6), '#121418') + spokes(x, r) +
    face(ring(x, Yn + 7, r, r * 0.14), '#16181c') + line(ring(x, Yn + 6, r, r * 0.68).concat([ring(x, Yn + 6, r, r * 0.68)[0]]), '#5a626c', 1.6)
  // The spoiler on short struts.
  // The rear wing: a thick blade set high over the tail, with endplates, on two
  // struts. Its rear face is drawn tall enough to read from this low angle.
  const wing = line([[214, -56, topZ(214)], [214, -56, 84]], '#16181c', 6) + line([[214, 56, topZ(214)], [214, 56, 84]], '#16181c', 6) +
    face([[200, -78, 88], [246, -78, 84], [246, 78, 84], [200, 78, 88]], '#24282f') +
    face([[246, -78, 84], [246, 78, 84], [246, 78, 72], [246, -78, 72]], '#0f1115') +
    face([[200, 78, 90], [248, 78, 86], [248, 78, 68], [204, 78, 72]], '#15171b') +
    face([[200, -78, 90], [248, -78, 86], [248, -78, 68], [204, -78, 72]], '#15171b') +
    line([[200, 78, 88], [246, 78, 84], [246, -78, 84]], '#e8b57a', 1.6, ' opacity="0.8"')
  const shadow = face([[-270, -120, 0], [270, -120, 0], [270, 130, 0], [-270, 130, 0]], '#0a0a0c', ' opacity="0.65"')
  const rim = line(plan.filter(([x, y]) => y > 40).map(([x, y]) => [x, y, topZ(x) - 7]), '#e8b57a', 1.8, ' opacity="0.8"')
  const accent = line([[-200, 97, 22], [200, 97, 22]], '#c8a050', 2.2, ' opacity="0.85"')
  const flank = face([[-226, 96, 26], [226, 96, 26], [226, 96, topZ(226) - 8], [-226, 96, topZ(-226) - 8]], 'url(#cp-flank)') +
    face([[-120, 96.5, 44], [60, 96.5, 48], [70, 96.5, 52], [-110, 96.5, 48]], '#9aa4b0', ' opacity="0.22"') +
    face([[90, 106.5, 34], [206, 106.5, 34], [204, 104.5, topZ(204) - 12], [100, 104.5, topZ(100) - 12]], 'url(#cp-flank)')
  return shadow + figure() + body + flank + louvres + rim + accent + arch(-150, 32) + arch(150, 37) + tail + wheel(-150, 32) + wheel(150, 37) + wing
}

// The man: an original character, a random guy leaning on the far side of the car
// with his back to us, looking out at the city. A dark jacket with a raised collar and
// a teal stripe down the near sleeve, short dark hair. He stands with his arms at his
// sides, hands in his pockets below the roofline. Drawn
// in centimetres from his feet and scaled by the camera, so he matches the car. The
// low sun on the right puts a warm rim on his right side.
function figure() {
  const [x, y, k] = project(45, -112, 0)
  const J = '#20232a'
  const JS = '#14161b'
  const JL = '#2e333c'
  const SKIN = '#9a7460'
  const RIM = '#f0bc80'
  const CY = '#3ae8f0'
  return `<g transform="translate(${n1(x)} ${n1(y)}) scale(${n1(k)})">` +
    // Legs and hips (hidden by the car).
    `<path d="M-13 0L-12 -94H-1V0ZM1 0V-94H12L13 0Z" fill="#121418"/>` +
    // The far arm, hanging, the hand in a pocket.
    `<path d="M-22 -146C-28 -132 -29 -114 -27 -96L-20 -96C-21 -112 -20 -128 -16 -142Z" fill="${JS}"/>` +
    // The jacket: broad shoulders tapering to a cropped hem at the waist.
    `<path d="M-16 -92C-18 -110 -22 -128 -24 -140C-25 -148 -20 -153 -12 -155H12C20 -153 25 -148 24 -140C22 -128 18 -110 16 -92Z" fill="${J}"/>` +
    // Shade down the left side, a lit panel across the right shoulder blade.
    `<path d="M-16 -92C-18 -110 -22 -128 -24 -140C-25 -148 -20 -153 -12 -155L-9 -150C-14 -136 -14 -112 -11 -92Z" fill="${JS}"/>` +
    `<path d="M4 -150C12 -150 19 -146 21 -138C19 -130 12 -128 5 -131Z" fill="${JL}"/>` +
    // Seams: a yoke across the shoulders and a centre seam; the ribbed hem.
    `<path d="M-22 -138C-10 -133 10 -133 22 -138M0 -133V-96" fill="none" stroke="#0e1013" stroke-width="1.2"/>` +
    `<path d="M-16 -96H16V-91H-16Z" fill="#0f1114"/><path d="M-16 -94H16" stroke="${CY}" stroke-width="0.8" opacity="0.6"/>` +
    // The near arm, hanging, a glowing stripe down the sleeve, the warm rim on it.
    `<path d="M22 -146C28 -132 29 -114 27 -96L20 -96C21 -112 20 -128 16 -142Z" fill="${J}"/>` +
    `<path d="M24 -140C26 -128 26 -112 25 -98" stroke="${CY}" stroke-width="1.6" fill="none"/>` +
    `<path d="M24 -146C29 -132 30 -114 28 -96" stroke="${RIM}" stroke-width="1.4" fill="none" opacity="0.85"/>` +
    `<path d="M12 -155C20 -153 25 -148 24 -140" stroke="${RIM}" stroke-width="1.6" fill="none" opacity="0.9"/>` +
    // The tall stand-up collar, edged with a thin glow strip.
    `<path d="M-9 -154C-10 -160 -8 -166 -6 -168H6C8 -166 10 -160 9 -154Z" fill="${JS}"/>` +
    `<path d="M-6 -168H6" stroke="${CY}" stroke-width="1.4"/><path d="M-6 -168H6" stroke="${CY}" stroke-width="4" opacity="0.25"/>` +
    // The neck, with a thin implant line glowing down it.
    `<path d="M-3.5 -168h7v-3h-7z" fill="${SKIN}"/>` +
    // The head from behind: an undercut, faded short at the sides and the nape, with
    // longer hair swept back on top; small ears; the warm rim on the right.
    `<path d="M-8.5 -170C-10 -180 -7 -190 0 -191C7 -190 10 -180 8.5 -170C6 -166 -6 -166 -8.5 -170Z" fill="#3a3028"/>` +
    `<path d="M-6 -168C-3 -166.5 3 -166.5 6 -168L5.5 -171C2 -169.5 -2 -169.5 -5.5 -171Z" fill="${SKIN}" opacity="0.7"/>` +
    `<path d="M-8 -180C-8 -189 -3 -194 2 -193C8 -192 10 -186 9 -179C5 -183 -3 -184 -8 -180Z" fill="#17120e"/>` +
    `<path d="M-6 -186C-2 -189 3 -189 7 -186" stroke="#2c241c" stroke-width="1.2" fill="none"/>` +
    `<path d="M-9.5 -178q-2 2.5 0 5M9.5 -178q2 2.5 0 5" stroke="${SKIN}" stroke-width="2" fill="none"/>` +
    `<path d="M9 -179C10 -184 8 -190 3 -193" stroke="${RIM}" stroke-width="1.3" fill="none" opacity="0.85"/>` +
    `<path d="M2.5 -167v-4" stroke="${CY}" stroke-width="1"/>` +
    `</g>`
}

// The night lights over the dark grade: the lamp, the car's light bar, its underglow.
function groundLights() {
  // The lamp's cone and pool, and the car's underglow: they light the road, so the
  // car is drawn after them and stands in front.
  return `<path d="M1548 82L1380 900H1700Z" fill="url(#cp-cone)"/><circle cx="1548" cy="80" r="90" fill="url(#cp-lamp)"/>` +
    face([[-250, -60, 1], [250, -60, 1], [250, 130, 1], [-250, 130, 1]], 'url(#cp-under)')
}
function tailLights() {
  return face([[231, -88, 60], [231, 88, 60], [231, 88, 64], [231, -88, 64]], '#ff2a4a') +
    face([[232, -92, 54], [232, 92, 54], [232, 92, 70], [232, -92, 70]], '#ff2a4a', ' opacity="0.3"')
}

// Flying cars crossing the city, each a small dark shape with a light bar that glows
// brighter at night.
function flyers() {
  const one = (y, dur, begin, dir, s, color) => {
    const from = dir > 0 ? -80 : W + 80
    const to = dir > 0 ? W + 80 : -80
    return `<g transform="translate(0 ${y})"><g><animateTransform attributeName="transform" type="translate" values="${from} 0;${to} 0" dur="${dur}s" begin="${-begin}s" repeatCount="indefinite"/>` +
      `<g transform="scale(${dir * s} ${s})"><path d="M-22 0L18 -4L26 2L-20 6Z" fill="#20242c"/><path d="M-10 -3L10 -6L14 -2Z" fill="#3a4250"/>` +
      `<path d="M-22 1L-14 1" stroke="${color}" stroke-width="2.4"/><circle cx="-24" cy="1" r="6" fill="${color}" opacity="0.35"/></g></g></g>`
  }
  return one(120, 30, 3, 1, 0.9, '#ff3a5a') + one(170, 38, 14, -1, 0.7, '#5ff2ff') + one(90, 44, 22, 1, 0.55, '#ffd23f')
}

// ---------------------------------------------------------------- the scene

export function buildScene() {
  const c = city()
  const carSvg = car()
  // The car and the man, darkened at night: their shapes in deep navy, the ember left out.
  const nightCar = carSvg.replace(/fill="url\(#cp-ember\)"/g, 'fill="none"').replace(/fill="#ff7a3a"/g, 'fill="none"')
    .replace(/fill="(?!none)[^"]*"/g, 'fill="#03050f"').replace(/stroke="[^"]*"/g, 'stroke="#03050f"')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="cp-day" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a7ea8"/><stop offset="0.45" stop-color="#8eb6cc"/><stop offset="0.68" stop-color="#d4dcc8"/><stop offset="1" stop-color="#e8dcb8"/></linearGradient>
    <linearGradient id="cp-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a6a"/><stop offset="0.4" stop-color="#b04a8a"/><stop offset="0.65" stop-color="#ff8a5a"/><stop offset="1" stop-color="#ffc07a"/></linearGradient>
    <linearGradient id="cp-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05081a"/><stop offset="0.5" stop-color="#0c1638"/><stop offset="0.7" stop-color="#14305a"/><stop offset="1" stop-color="#1a4a66"/></linearGradient>
    <radialGradient id="cp-sun-glow"><stop offset="0" stop-color="#fff4d8" stop-opacity="0.8"/><stop offset="0.3" stop-color="#ffd8a0" stop-opacity="0.3"/><stop offset="1" stop-color="#ffd8a0" stop-opacity="0"/></radialGradient>
    <radialGradient id="cp-moon-glow"><stop offset="0" stop-color="#cfe0ff" stop-opacity="0.5"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient>
    <linearGradient id="cp-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0e8d8" stop-opacity="0"/><stop offset="0.6" stop-color="#ece0c8" stop-opacity="0.55"/><stop offset="1" stop-color="#d8c8a8" stop-opacity="0.3"/></linearGradient>
    <linearGradient id="cp-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e6454"/><stop offset="0.35" stop-color="#4a4238"/><stop offset="1" stop-color="#1e1b18"/></linearGradient>
    <linearGradient id="cp-grade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060a24" stop-opacity="0.55"/><stop offset="1" stop-color="#04061a" stop-opacity="0.72"/></linearGradient>
    <linearGradient id="cp-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c0" stop-opacity="0.35"/><stop offset="1" stop-color="#fff0c0" stop-opacity="0"/></linearGradient>
    <linearGradient id="cp-flank" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8b8a0" stop-opacity="0.28"/><stop offset="0.35" stop-color="#8a8a90" stop-opacity="0.08"/><stop offset="0.6" stop-color="#000" stop-opacity="0.1"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></linearGradient>
    <radialGradient id="cp-ember"><stop offset="0" stop-color="#ff8a3a" stop-opacity="0.8"/><stop offset="1" stop-color="#ff8a3a" stop-opacity="0"/></radialGradient>
    <radialGradient id="cp-lamp"><stop offset="0" stop-color="#fff4d0" stop-opacity="0.9"/><stop offset="1" stop-color="#fff4d0" stop-opacity="0"/></radialGradient>
    <radialGradient id="cp-under"><stop offset="0" stop-color="#ff3ad7" stop-opacity="0.75"/><stop offset="0.5" stop-color="#5ff2ff" stop-opacity="0.3"/><stop offset="1" stop-color="#5ff2ff" stop-opacity="0"/></radialGradient>
    <pattern id="cp-win-cool" width="9" height="8" patternUnits="userSpaceOnUse"><rect width="5" height="4" fill="#cfe6f2" opacity="0.55"/></pattern>
    <pattern id="cp-win-warm" width="9" height="8" patternUnits="userSpaceOnUse"><rect width="5" height="4" fill="#3a2e28" opacity="0.6"/></pattern>
    <pattern id="cp-win-far" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="3" fill="#dde8ee" opacity="0.6"/></pattern>
    <pattern id="cp-win-farnight" width="24" height="18" patternUnits="userSpaceOnUse"><path d="M2 2h3v2h-3zM14 10h3v2h-3z" fill="#ffd27a"/><path d="M8 14h3v2h-3z" fill="#9fe8ff"/></pattern>
    <pattern id="cp-grid" width="9" height="8" patternUnits="userSpaceOnUse"><rect width="9" height="8" fill="#000" opacity="0.12"/><rect width="6" height="5" fill="#cfe6f2" opacity="0.32"/></pattern>
    <pattern id="cp-ribs" width="8" height="40" patternUnits="userSpaceOnUse"><rect width="2" height="40" fill="#000" opacity="0.28"/><rect x="2" width="1" height="40" fill="#fff" opacity="0.12"/><rect y="36" width="8" height="2" fill="#000" opacity="0.2"/></pattern>
    <pattern id="cp-bands" width="20" height="12" patternUnits="userSpaceOnUse"><rect y="8" width="20" height="4" fill="#000" opacity="0.3"/><rect y="2" width="14" height="5" fill="#ffe6c8" opacity="0.2"/></pattern>
    <linearGradient id="cp-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></linearGradient>
    <pattern id="cp-screens" width="12" height="10" patternUnits="userSpaceOnUse"><rect width="12" height="10" fill="#0a1020" opacity="0.35"/><path d="M1 1h4v3h-4zM7 5h4v3h-4z" fill="#8ab8ff" opacity="0.75"/><path d="M7 1h4v3h-4z" fill="#e8f2ff" opacity="0.6"/><path d="M1 5h4v3h-4z" fill="#ffb8e0" opacity="0.4"/></pattern>
    <pattern id="cp-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="1.8" fill="#c8d2d8" opacity="0.55"/></pattern>
    <pattern id="cp-scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity="0.18"/></pattern>
    <pattern id="cp-win-night" width="45" height="40" patternUnits="userSpaceOnUse"><path d="M0 0h5v4h-5zM27 8h5v4h-5zM9 24h5v4h-5zM36 32h5v4h-5z" fill="#ffd27a" opacity="0.85"/><path d="M18 16h5v4h-5zM36 0h5v4h-5z" fill="#9fe8ff" opacity="0.8"/><path d="M9 32h5v4h-5z" fill="#ff8fd0" opacity="0.8"/></pattern>
    <radialGradient id="cp-gold" gradientUnits="userSpaceOnUse" cx="1500" cy="40" r="1500"><stop offset="0" stop-color="#ffd6a0" stop-opacity="0.45"/><stop offset="0.6" stop-color="#ffb070" stop-opacity="0.18"/><stop offset="1" stop-color="#ff9050" stop-opacity="0.05"/></radialGradient>
    <pattern id="cp-grit" width="180" height="180" patternUnits="userSpaceOnUse">${(() => { const r = mulberry32(77); let d = '', l = ''; for (let i = 0; i < 700; i++) { const q = `M${n0(r() * 180)} ${n0(r() * 180)}h1v1h-1z`; if (r() < 0.6) d += q; else l += q } return `<path d="${d}" fill="#000" opacity="0.5"/><path d="${l}" fill="#fff" opacity="0.25"/>` })()}</pattern>
    <radialGradient id="cp-vignette" cx="0.5" cy="0.5" r="0.78"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#02030a" stop-opacity="0.6"/></radialGradient>
  </defs>
  ${sky()}
  <g opacity="0.8">${c.far}</g>
  ${layer(NIGHT, c.farNight)}
  ${smog()}
  ${bridge()}
  ${c.body}
  <g opacity="0.85">${c.pats}</g>
  ${c.frame}
  <rect y="400" width="${W}" height="240" fill="url(#cp-haze)" opacity="0.6"/>
  ${layer(SUNUP, `<rect width="${W}" height="${H}" fill="url(#cp-gold)"/>`)}
  ${layer(NIGHT, `<rect width="${W}" height="${H}" fill="url(#cp-grade)"/>`)}
  ${layer(NIGHT, c.nightWin)}
  ${layer(SUNUP, lowSmog('#ece2cc', 0.55))}
  ${layer(NIGHT, lowSmog('#3a3050', 0.5))}
  ${signs()}
  ${flyers()}
  ${midground()}
  ${road()}
  ${layer(NIGHT, `<rect y="600" width="${W}" height="${H - 600}" fill="#03050f" opacity="0.55"/>`)}
  ${layer(NIGHT, groundLights())}
  ${carSvg}
  ${layer(NIGHT, `<g opacity="0.55">${nightCar}</g>`)}
  ${layer(NIGHT, tailLights())}
  ${layer(DUSK, `<rect width="${W}" height="${H}" fill="#ff6a4a" opacity="0.12"/>`)}
  <rect width="${W}" height="${H}" fill="url(#cp-grit)" opacity="0.5"/>
  <rect width="${W}" height="${H}" fill="url(#cp-vignette)"/>
</svg>`
}
