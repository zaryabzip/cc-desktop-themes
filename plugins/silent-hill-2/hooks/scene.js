// Silent Hill 2 inspired: an overlook above a fogged lake valley, seen from high up.
// An original scene, with nothing taken from the game itself. Below a murky sky, dark
// pines rise out of a sea of fog in three depth layers; fog rolls between them. A low
// stone wall runs across the frame; a man stands at it, looking out. In the parking
// lot before it sits an old pale-blue sedan with a door left open, a trash can by the
// wall. On the right a wooden utility pole carries a dim streetlight, and a grimy
// little concrete building with a brick base stands at the edge. Heavy film grain,
// falling ash, and about once a minute the world turns to rust.
//
// Cost: built light. Broad gradients and few shapes; the fog drifts in small steps a
// few times a second (calcMode discrete), so the browser can skip repainting between
// steps. No filters; the grain is a static pattern. All motion is SMIL and every
// colour a presentation attribute: the desktop app draws the scene in a script-less
// frame.

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
const WALL = 608 // the top of the overlook wall
const n0 = (v) => Math.round(v)
const n1 = (v) => (Math.round(v * 10) / 10).toString()

// SMIL helpers.
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
function ao(values, dur, begin = 0, kt = '', calc = '') {
  const times = kt ? ` keyTimes="${kt}"` : ''
  const start = begin ? ` begin="${n1(begin)}s"` : ''
  const mode = calc ? ` calcMode="${calc}"` : ''
  return `<animate attributeName="opacity" values="${values}"${times} dur="${dur}s"${start} repeatCount="indefinite"${mode}/>`
}
// A slow drift in discrete steps: `steps` positions between 0 and (dx, dy), there and
// back on an eased curve.
function stepDrift(dx, dy, dur, steps, begin = 0) {
  const vals = []
  for (let i = 0; i <= steps; i++) {
    const t = (1 - Math.cos((i / steps) * Math.PI * 2)) / 2
    vals.push(`${n1(dx * t)} ${n1(dy * t)}`)
  }
  const start = begin ? ` begin="${n1(begin)}s"` : ''
  return `<animateTransform attributeName="transform" type="translate" values="${vals.join(';')}" dur="${dur}s"${start} repeatCount="indefinite" calcMode="discrete"/>`
}

// The otherworld cycle, shared by everything that takes part.
const OW = { d: 64, t: '0;0.8;0.85;0.92;0.97;1' }
// What the rust brings in fades in with it, and what it takes fades out.
const owIn = (peak = 1) => ao(`0;0;${peak};${peak};0;0`, OW.d, 0, OW.t)
const owOut = () => ao('1;1;0;0;1;1', OW.d, 0, OW.t)

// The murky sky: soft blotches of darker and lighter grey, static, so the sky has the
// texture of low cloud rather than a flat gradient.
function mottle() {
  const rng = mulberry32(17)
  let dark = ''
  let light = ''
  for (let i = 0; i < 46; i++) {
    const x = rng() * W
    const y = rng() * 470
    const isDark = rng() < 0.55
    const e = `<ellipse cx="${n0(x)}" cy="${n0(y)}" rx="${n0(120 + rng() * 260)}" ry="${n0(24 + rng() * 50)}" fill="url(#sh-mottle-${isDark ? 'd' : 'l'})"/>`
    if (isDark) dark += e
    else light += e
  }
  return dark + light
}

// ---------------------------------------------------------------- the valley

// A pine as the overlook has them: a heavy bark trunk and many tiers of fan-shaped
// boughs that overlap into a full crown. A bough leaves the trunk thin and fans out,
// thickest and hanging toward its tip, the lower ones drooping harder; its edges are
// feathery. The near trees' boughs carry a needle texture (a static speckle pattern);
// the rest a plain fill, which costs less to repaint under the moving fog.
// Each side sits at its own height. `far` draws faint silhouettes, as fog shows them.
function pine(rng, x, base, h, far, textured) {
  const tw = Math.max(1.8, h / 48)
  const trunk = `M${n1(x - tw)} ${base}L${n1(x - 1)} ${n0(base - h)}L${n1(x + 1)} ${n0(base - h)}L${n1(x + tw)} ${base}Z`
  let boughs = ''
  const tiers = far ? 6 : 7 + Math.floor(rng() * 2)
  for (let i = 0; i < tiers; i++) {
    const t = (i + 0.5) / tiers
    for (const s of [-1, 1]) {
      if (rng() < 0.16) continue
      const y = base - h + Math.pow(t, 0.9) * h * 0.86 + (rng() - 0.5) * h * 0.03
      const w = h * (0.05 + t * 0.27) * (0.75 + rng() * 0.5)
      const droop = w * (0.15 + t * 0.35) * (0.8 + rng() * 0.4)
      const th = h * (0.03 + t * 0.045)
      const top = []
      const bot = []
      const n = far ? 6 : 12
      for (let j = 0; j <= n; j++) {
        const u = j / n
        const px = x + s * w * u
        const cy = y + droop * u * u
        const thick = th * (0.35 + 0.9 * u) * (u > 0.92 ? 0.6 : 1)
        top.push([px, cy - thick * 0.35 - (j % 2 ? rng() * th * 0.15 : 0)])
        bot.push([px, cy + thick * 0.65 + (j % 2 ? rng() * th * 0.3 : 0)])
      }
      boughs += 'M' + [...top, ...bot.reverse()].map(([a, b]) => `${n0(a)} ${n0(b)}`).join('L') + 'Z'
    }
  }
  if (far) return `<path d="${trunk}${boughs}" fill="#5a5f58"/>`
  return `<path d="${trunk}" fill="#3e372f"/><path d="M${n1(x + tw * 0.35)} ${base}L${n1(x + 0.5)} ${n0(base - h)}" stroke="#6a5e4c" stroke-width="${n1(tw * 0.45)}"/>` +
    `<path d="${boughs}" fill="${textured ? 'url(#sh-needles)' : '#262820'}"/>`
}

// A dead pine for the rust: a darker, split trunk and bare limbs drooping where the
// boughs were, with twigs hanging from their tips. Its own random stream, so the live
// trees keep their shapes.
function deadPine(x, base, h) {
  const r = mulberry32(n0(x * 13 + h))
  const tw = Math.max(1.8, h / 48)
  let limbs = ''
  let twigs = ''
  for (let i = 0; i < 7; i++) {
    const t = (i + 0.5) / 7
    const y = base - h + Math.pow(t, 0.9) * h * 0.86
    for (const s of [-1, 1]) {
      if (r() < 0.25) continue
      const w = h * (0.05 + t * 0.22) * (0.6 + r() * 0.5)
      const dy = w * (0.35 + t * 0.5)
      const ex = x + s * w
      const ey = y + dy
      limbs += `M${n0(x)} ${n0(y)}Q${n0(x + s * w * 0.5)} ${n0(y - 2)} ${n0(ex)} ${n0(ey)}`
      twigs += `M${n0(ex)} ${n0(ey)}l${n0(s * 4)} ${n0(8 + r() * 12)}M${n0(x + s * w * 0.55)} ${n0(y + dy * 0.3)}l${n0(s * 3)} ${n0(6 + r() * 10)}`
    }
  }
  return `<path d="M${n1(x - tw)} ${base}L${n1(x - 1)} ${n0(base - h)}L${n1(x + 1)} ${n0(base - h)}L${n1(x + tw)} ${base}Z" fill="#2a1a14"/>` +
    `<path d="M${n1(x)} ${n0(base - h * 0.7)}l2 ${n0(h * 0.25)}" stroke="#120806" stroke-width="1.5"/>` +
    `<path d="${limbs}" fill="none" stroke="#2a1a14" stroke-width="${n1(Math.max(1.4, h / 160))}" stroke-linecap="round"/>` +
    `<path d="${twigs}" fill="none" stroke="#2a1a14" stroke-width="1" stroke-linecap="round"/>`
}

// A fog bank: a wide soft ellipse that drifts in slow steps.
const bank = (cx, cy, rx, ry, op, dx, dur, begin) =>
  `<g>${stepDrift(dx, 0, dur, Math.round(dur * 2), begin)}<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#sh-fog)" opacity="${op}"/></g>`

function valley() {
  const rng = mulberry32(21)
  // The far layer: pale, small pines, half lost.
  let far = ''
  for (let x = 30; x < 1560; x += 90 + rng() * 90) far += pine(rng, x, 560 + rng() * 20, 150 + rng() * 90, true)
  // The middle layer.
  let mid = ''
  const MID = [[330, 330], [600, 270], [820, 230], [930, 300], [1100, 290], [1150, 240]]
  for (const [x, h] of MID) mid += pine(rng, x, 600, h, false)
  // In the rust the live trees fade and dead ones stand in their place.
  mid = `<g>${owOut()}${mid}</g><g opacity="0">${owIn()}${MID.map(([x, h]) => deadPine(x, 600, h)).join('')}</g>`
  // The near layer: tall, dark, at the frame's edges.
  const near = `<g>${owOut()}${pine(rng, 160, 615, 520, false, true) + pine(rng, 1330, 615, 400, false, true)}</g>` +
    `<g opacity="0">${owIn()}${deadPine(160, 615, 520)}${deadPine(1330, 615, 400)}</g>`
  return `<g opacity="0.65">${far}</g>` +
    bank(800, 545, 1000, 70, 0.95, 70, 60, 0) +
    mid +
    bank(700, 585, 900, 60, 0.9, -80, 75, -20) + bank(1200, 560, 600, 45, 0.7, 60, 55, -40) +
    near +
    bank(900, 606, 1100, 34, 0.75, -60, 66, -10) +
    // Wisps: thin streaks of fog sliding between the trunks, faster than the banks.
    [[300, 520, 260, 16, 220, 34, 0], [900, 500, 300, 14, -260, 40, -12], [1250, 540, 220, 14, 200, 30, -6], [600, 570, 340, 18, -220, 44, -20], [1050, 585, 260, 12, 240, 36, -28]]
      .map(([cx, cy, rx, ry, dx, dur, b]) => bank(cx, cy, rx, ry, 0.8, dx, dur, b)).join('') +
    // The thick fog floor the pines stand in.
    `<rect x="0" y="560" width="${W}" height="60" fill="url(#sh-floor)"/>`
}

// ---------------------------------------------------------------- the overlook

// The wall: a lit top, a stone face with courses and joints, its foot in shadow.
function wall() {
  const rng = mulberry32(5)
  const right = 1372
  let joints = ''
  for (let y = WALL + 18; y < 686; y += 12) {
    joints += `M0 ${y}H${right}`
    for (let x = (y / 12) % 2 ? 0 : 14; x < right; x += 28) joints += `M${n0(x + rng() * 4)} ${y}v12`
  }
  let grime = ''
  for (let i = 0; i < 26; i++) grime += `<ellipse cx="${n0(rng() * right)}" cy="${n0(WALL + 20 + rng() * 60)}" rx="${n0(20 + rng() * 70)}" ry="${n0(6 + rng() * 16)}" fill="${rng() < 0.6 ? '#262824' : '#55574f'}" opacity="0.45"/>`
  return `<path d="M0 ${WALL}H${right}V${WALL + 10}H0Z" fill="#5e605a"/>` +
    `<path d="M0 ${WALL + 10}H${right}V688H0Z" fill="#3c3e3a"/>` + grime +
    `<path d="${joints}" stroke="#2a2c29" stroke-width="1.4" opacity="0.7"/>` +
    `<path d="M0 ${WALL}H${right}" stroke="#9a9c94" stroke-opacity="0.6"/>` +
    `<path d="M0 686H${right}" stroke="#262824" stroke-width="3"/>`
}

// The sidewalk, the curb and the parking lot, as the overlook has them: a slab strip
// along the wall's foot, then the sidewalk, which bulges toward us between x 465 and
// 790 with angled steps at each end, where the trash can stands; a dark curb face
// along its edge; then the asphalt with wet stains, a stall line and a drain.
function lot() {
  const rng = mulberry32(8)
  const edge = [[0, 718], [438, 718], [470, 734], [780, 734], [808, 718], [1380, 718]]
  const edgeD = 'M' + edge.map(([x, y]) => `${x} ${y}`).join('L')
  let slabs = ''
  for (let x = 30; x < 1380; x += 70) slabs += `M${x} 688l-4 12`
  let stains = ''
  for (let i = 0; i < 16; i++) stains += `<ellipse cx="${n0(rng() * 1300)}" cy="${n0(770 + rng() * 120)}" rx="${n0(40 + rng() * 120)}" ry="${n0(8 + rng() * 20)}" fill="#252623" opacity="${n1(0.3 + rng() * 0.35)}"/>`
  return `<path d="M0 714H1380V900H0Z" fill="#363834"/>` + stains +
    // The sidewalk: the slab strip, then the walk out to its edge.
    `<path d="M0 688H1380V700H0Z" fill="#8a8c85"/><path d="${slabs}" stroke="#6a6c66" stroke-width="1.2"/>` +
    `<path d="M0 700H1380V718L808 718L780 734L470 734L438 718L0 718Z" fill="#7a7c75"/>` +
    `<path d="M0 700H1380" stroke="#5e605a" stroke-width="1.2"/>` +
    // The curb's face, dark, just under the edge, and its lit top.
    `<path d="${edgeD}L1380 727L808 727L780 743L470 743L438 727L0 727Z" fill="#262724"/>` +
    `<path d="${edgeD}" fill="none" stroke="#a2a49c" stroke-opacity="0.6" stroke-width="1.5"/>` +
    // The lot's right edge: a curb running down to the bottom, and light concrete
    // beyond it up to the building, with a manhole.
    `<path d="M1040 727L1150 900H1380V727Z" fill="#7a7c75"/>` +
    `<path d="M1040 727L1150 900" stroke="#a2a49c" stroke-opacity="0.6" stroke-width="1.5"/><path d="M1034 730L1140 900" stroke="#262724" stroke-width="7"/>` +
    `<path d="M1190 748h50v18h-50z" fill="#3a3b37"/><path d="M1194 752h42v10h-42z" fill="#2a2b28"/>` +
    // A stall line, and the drain.
    `<path d="M196 744L120 900" stroke="#8e8e86" stroke-opacity="0.5" stroke-width="5"/>` +
    `<ellipse cx="940" cy="812" rx="34" ry="12" fill="#2a2b28"/><path d="M912 812h56M920 807h40M920 817h40" stroke="#1c1d1b" stroke-width="1.5"/>` +
    // The trash can on the sidewalk's bulge: tall, with a domed top and a flap.
    `<path d="M600 650h46l-2 80h-42z" fill="#3c3d3a"/><path d="M598 650q25 -16 50 0z" fill="#4a4b47"/>` +
    `<path d="M610 664h26v18h-26z" fill="#1e1f1c"/><path d="M613 672q10 -6 20 0" stroke="#7a7b74" stroke-width="2" fill="none"/>` +
    `<path d="M600 650h46" stroke="#8a8b84" stroke-opacity="0.5"/><ellipse cx="623" cy="732" rx="26" ry="5" fill="#1a1b19" opacity="0.6"/>`
}

// The old sedan, as a small 3D model (centimetres) seen from behind it, to its left,
// and above, with gentle perspective. X runs front (-235) to rear (+235), Y across
// (-88 is the near, driver's side), Z up. The plan has rounded corners, so the sides
// wrap round them in facets, each shaded by the way it faces; a bevelled shoulder
// runs between the sides and the top; the cabin is lofted from its base up to a
// smaller rounded roof, so the glass wraps round it, with pillars on it. Wheels sit in
// their arches; the driver's door is swung open with its inner trim toward us.
function car() {
  const cx = 636
  const cy = 820
  const yaw = (-46 * Math.PI) / 180
  const pitch = (24 * Math.PI) / 180
  const D0 = 1300
  const F = 760
  const P = (X, Y, Z) => {
    const x1 = X * Math.cos(yaw) - Y * Math.sin(yaw)
    const d = X * Math.sin(yaw) + Y * Math.cos(yaw)
    const zc = D0 + d * Math.cos(pitch) - Z * Math.sin(pitch)
    return [cx + (F * x1) / zc, cy - (F * (d * Math.sin(pitch) + Z * Math.cos(pitch))) / zc]
  }
  const pt = ([x, y]) => `${n1(x)} ${n1(y)}`
  const face = (pts, fill, extra = '') => `<path d="M${pts.map((q) => pt(P(...q))).join('L')}Z" fill="${fill}"${extra}/>`
  const line = (pts, stroke, w) => `<path d="M${pts.map((q) => pt(P(...q))).join('L')}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`
  // A rounded rectangle in plan, as points round it (clockwise from the front left).
  const rrect = (x0, x1, y0, y1, r, n = 4) => {
    const out = []
    const corners = [[x0 + r, y0 + r, Math.PI], [x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2]]
    for (const [ccx, ccy, a0] of corners) for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2)
      out.push([ccx + r * Math.cos(a), ccy + r * Math.sin(a)])
    }
    return out
  }
  // How a face whose outward normal is (nx, ny) faces us, and its shade.
  const facing = (nx, ny) => nx * Math.sin(yaw) + ny * Math.cos(yaw) // negative: toward us
  const shade = (nx, ny) => {
    const lit = Math.max(0, -nx * 0.3 - ny * 0.25 + 0.55)
    const c = (a, b) => n0(a + (b - a) * lit)
    return `rgb(${c(62, 92)},${c(78, 108)},${c(80, 110)})`
  }
  const ring = (pts, z) => pts.map(([x, y]) => [x, y, z])
  const plan = rrect(-235, 235, -88, 88, 26)
  const shoulder = rrect(-229, 229, -82, 82, 22)
  // The sides: a facet per edge of the plan that faces us, from the sill to the shoulder.
  let sides = ''
  for (let i = 0; i < plan.length; i++) {
    const [ax, ay] = plan[i]
    const [bx, by] = plan[(i + 1) % plan.length]
    const nx = by - ay
    const ny = -(bx - ax)
    const len = Math.hypot(nx, ny) || 1
    if (facing(nx / len, ny / len) >= 0.05) continue
    sides += face([[ax, ay, 26], [bx, by, 26], [bx, by, 74], [ax, ay, 74]], shade(nx / len, ny / len))
  }
  // The shoulder bevel and the deck (hood and trunk) on top.
  let bevel = ''
  for (let i = 0; i < plan.length; i++) {
    const j = (i + 1) % plan.length
    bevel += face([[...plan[i], 74], [...plan[j], 74], [...shoulder[j], 80], [...shoulder[i], 80]], '#62777a')
  }
  const deck = face(ring(shoulder, 80), '#6b8083')
  // The cabin, lofted from its base to the roof.
  const base = rrect(-92, 150, -80, 80, 24)
  const roof = rrect(-40, 92, -70, 70, 16)
  let glass = ''
  for (let i = 0; i < base.length; i++) {
    const j = (i + 1) % base.length
    glass += face([[...base[i], 80], [...base[j], 80], [...roof[j], 126], [...roof[i], 126]], 'url(#sh-glass)')
  }
  // Pillars and the body colour round the cabin's foot.
  const pillar = (bi, ri, w) => line([[...base[bi], 80], [...roof[ri], 126]], '#5a6e71', w)
  const nearMid = (pts, x) => pts.reduce((best, q, i) => (q[1] < 0 && Math.abs(q[0] - x) < Math.abs(pts[best][0] - x) ? i : best), 0)
  // The B-pillar, and the C-pillar as a solid panel behind the rear side window.
  // The glass is lofted point to point: on the near side the base edge runs x -68..126
  // and the roof edge x -24..76, so a pillar at base x b meets the roof at
  // -24 + (b + 68) * 100 / 194. The B-pillar stands at the door's back edge; the
  // C-pillar fills the strip between the rear side window and the rear glass.
  const roofX = (b) => -24 + ((b + 68) * 100) / 194
  const pillars = line([[22, -80, 80], [roofX(22), -70, 126]], '#566a6d', 6) +
    face([[100, -80, 80], [126, -80, 80], [76, -70, 126], [roofX(100), -70, 126]], '#566a6d')
  const roofTop = face(ring(roof, 126), '#71878a')
  const sill = line(ring(base, 80).concat([[...base[0], 80]]), '#7f9b9f', 3)
  // The rear: tail lights, the plate and a chrome bumper.
  const lights = face([[236, -66, 54], [236, -40, 54], [236, -40, 68], [236, -66, 68]], '#7c2a22') + face([[236, 40, 54], [236, 66, 54], [236, 66, 68], [236, 40, 68]], '#7c2a22')
  const plate = face([[236, -18, 36], [236, 18, 36], [236, 18, 50], [236, -18, 50]], '#c8c4ae')
  const bumper = face([[240, -80, 20], [240, 80, 20], [240, 80, 32], [240, -80, 32]], '#aeb3b1') + face([[240, -80, 32], [240, 80, 32], [230, 84, 34], [230, -84, 34]], '#d0d4d2')
  // The door opening, the seat inside, and the wheels in their arches.
  // The doorway: the door's own outline. The sill along the bottom, up the back edge,
  // the window's top under the roof, down the A-pillar, and back to the hinge.
  const opening = face([[-88, -88, 28], [19, -88, 28], [19, -88, 76], [22, -80, 80], [roofX(22), -70, 123], [-24, -70, 123], [-68, -80, 80], [-88, -88, 76]], '#121415')
  const doorD = (opening.match(/d="([^"]+)"/) || [])[1]
  const seat = `<clipPath id="sh-door-clip"><path d="${doorD}"/></clipPath><g clip-path="url(#sh-door-clip)">` +
    face([[-56, -30, 34], [6, -30, 34], [4, -30, 98], [-44, -30, 104]], '#2c2a26') + face([[-56, -30, 34], [6, -30, 34], [10, -60, 44], [-50, -60, 44]], '#24221f') + '</g>'
  const circle = (X0, Y, Z0, r, n = 18) => Array.from({ length: n }, (_, i) => [X0 + r * Math.cos((i / n) * Math.PI * 2), Y, Z0 + r * Math.sin((i / n) * Math.PI * 2)])
  const wheel = (x) => face(circle(x, -90, 34, 40), '#1a1d1e') + face(circle(x, -91, 33, 32), '#101110') + face(circle(x, -92, 33, 15), '#5a5e5c')
  // The door, hinged on its front edge and swung wide open (72 degrees), so it stands
  // nearly square to the body and shows its inner panel to the camera: rust-brown trim
  // with an armrest, a window frame above with a little glass left in it, and the
  // door's thickness in body colour along its free edge.
  const a = (72 * Math.PI) / 180
  const L = 104
  const H0 = -88
  const along = (u, z) => [-88 + u * L * Math.cos(a), H0 - u * L * Math.sin(a), z]
  const thick = 7
  const ex = Math.sin(a) * thick
  const ey = Math.cos(a) * thick
  const tipIn = along(1, 0)
  const door =
    // The free edge's thickness.
    face([[tipIn[0], tipIn[1], 26], [tipIn[0] + ex, tipIn[1] + ey, 26], [tipIn[0] + ex, tipIn[1] + ey, 80], [tipIn[0], tipIn[1], 80]], '#4e6265') +
    // The inner panel and its trim.
    face([along(0, 26), along(1, 26), along(1, 80), along(0, 80)], '#4c3b30') +
    face([along(0.08, 34), along(0.92, 34), along(0.92, 66), along(0.08, 66)], '#3a2c24') +
    face([along(0.15, 62), along(0.85, 62), along(0.85, 68), along(0.15, 68)], '#5a4638') +
    // The window frame and the glass in it.
    face([along(0.19, 80), along(0.62, 123), along(1, 123), along(1, 80)], 'url(#sh-glass)', ' opacity="0.5"') +
    line([along(0.19, 80), along(0.62, 123), along(1, 123), along(1, 80)], '#5e7275', 3) +
    line([along(0, 80), along(1, 80)], '#5e7275', 2.5) +
    line([along(0, 26), along(1, 26), along(1, 80)], '#2a2420', 1.5)
  const shadow = face(ring(rrect(-250, 250, -100, 100, 40), 0), '#141513', ' opacity="0.6"')
  // Chrome trim round the rear window.
  const roofRear = roof.filter((q) => q[0] > 75.99).map((q) => [...q, 126])
  const baseRear = base.filter((q) => q[0] > 125.99).map((q) => [...q, 80]).reverse()
  const rearTrim = line([...roofRear, ...baseRear, roofRear[0]], '#b8c6c8', 1.5)
  const rust = face([[60, -89, 30], [110, -89, 28], [130, -89, 40], [80, -89, 44]], '#4a2e22', ' opacity="0.6"') + face([[-200, -89, 30], [-170, -89, 28], [-160, -89, 42], [-190, -89, 40]], '#4a2e22', ' opacity="0.55"')
  // The doorway is drawn after the body, bevel and glass, so nothing paints over the
  // gap the open door leaves.
  // In the rust the car is abandoned: the body goes rust-brown and patchy, the rear
  // window is shattered, the rear side window broken out, the tyres flat.
  const rearGlass = (u, v) => [92 + 58 * u, v, 126 - 46 * u]
  const crackR = mulberry32(42)
  let cracks = ''
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + crackR() * 0.4
    const pts = [rearGlass(0.5, -8)]
    for (let k = 1; k <= 3; k++) pts.push(rearGlass(0.5 + Math.sin(a) * 0.16 * k, -8 + Math.cos(a) * 18 * k))
    cracks += (line(pts, '#c8d0cc', 1).match(/d="([^"]+)"/) || [])[1]
  }
  const sideX = (u) => [-68 + 194 * u, -24 + 100 * u]
  const [b0, r0] = sideX(0.53)
  const [b1, r1] = sideX(0.78)
  const decay = `<g opacity="0">${owIn()}` +
    sides.replace(/fill="[^"]*"/g, 'fill="#4a2a1e"').replace(/<path /g, '<path opacity="0.55" ') +
    face(ring(shoulder, 80), '#4a2a1e', ' opacity="0.5"') + face(ring(roof, 126), '#4a2a1e', ' opacity="0.5"') +
    face([[-180, -89, 40], [-120, -89, 36], [-100, -89, 62], [-160, -89, 70]], '#2a140c', ' opacity="0.7"') +
    face([[40, -89, 30], [120, -89, 34], [140, -89, 60], [70, -89, 66]], '#2a140c', ' opacity="0.7"') +
    face([rearGlass(0.36, -26), rearGlass(0.64, -18), rearGlass(0.6, 10), rearGlass(0.38, 6)], '#0c0d0d') +
    `<path d="${cracks}" fill="none" stroke="#c8d0cc" stroke-width="1" opacity="0.8"/>` +
    face([[b0 + 4, -80, 84], [b1 - 4, -80, 84], [r1 - 4, -70, 120], [r0 + 4, -70, 118]], '#0c0d0d') +
    face([[-190, -93, 0], [-110, -93, 0], [-116, -93, 14], [-184, -93, 14]], '#0a0a0a') + face([[110, -93, 0], [190, -93, 0], [184, -93, 14], [116, -93, 14]], '#0a0a0a') +
    `</g>`
  return shadow + sides + rust + bevel + deck + lights + plate + bumper + glass + opening + seat + pillars + roofTop + rearTrim + wheel(-150) + wheel(150) + decay + door
}

// The man at the wall, seen from behind, looking out over the valley: square
// shoulders above the wall, a dark olive jacket to the hip, arms hanging, dark trousers,
// short brown hair. He shifts his weight now and then.
function man() {
  return `<g transform="translate(838 692)"><g>${at('rotate', '0;0;0.8;0.8;0;0', 26, 0, '0;0.4;0.45;0.75;0.8;1')}` +
    // Legs, a little apart, and shoes.
    `<path d="M-11 0L-10 -50H-1L-2 0ZM2 0L1 -50H10L11 0Z" fill="#1e2026"/>` +
    `<path d="M-12 0h11v-3h-11zM1 0h11v-3h-11z" fill="#141416"/>` +
    // The jacket: square shoulders, straight sides, a hem at the hip.
    `<path d="M-17 -48L-19 -86Q-19 -94 -12 -96L-5 -98H5L12 -96Q19 -94 19 -86L17 -48Z" fill="#2f3527"/>` +
    `<path d="M-17 -50H17" stroke="#262b20" stroke-width="3"/><path d="M0 -96V-50" stroke="#262b20" stroke-width="1.2"/>` +
    // Arms hanging, hands at the hips.
    `<path d="M-19 -90L-19 -54L-14 -53L-14 -86ZM19 -90L19 -54L14 -53L14 -86Z" fill="#2a3022"/>` +
    `<path d="M-19 -54l1 5h4l1 -5zM19 -54l-1 5h-4l-1 -5z" fill="#7a6656"/>` +
    // Collar, neck, head with short hair.
    `<path d="M-7 -98h14v-4h-14z" fill="#3a4030"/><path d="M-3 -102h6v-4h-6z" fill="#8a7464"/>` +
    `<path d="M-7 -104Q-8 -118 0 -119Q8 -118 7 -104Q0 -101 -7 -104Z" fill="#4a3a2a"/>` +
    `</g></g>`
}

// ---------------------------------------------------------------- the right side

// The utility pole and its streetlight: a tall weathered shaft, a crossarm with wires,
// and a cobra-head lamp whose cold light flickers, and dies during the otherworld.
function pole() {
  const x = 1220
  const flick = ao('1;1;0.3;1;1;0.15;0.9;1', 11, 0, '0;0.45;0.47;0.5;0.8;0.81;0.84;1', 'discrete')
  const dies = ao('1;1;0;0;1;1', OW.d, 0, OW.t)
  return `<path d="M${x - 12} 900L${x - 7} -10H${x + 7}L${x + 12} 900Z" fill="#4a4038"/>` +
    `<path d="M${x + 4} -10L${x + 7} 900" stroke="#6a5c4e" stroke-width="3" opacity="0.6"/>` +
    `<path d="M${x - 46} 30H${x + 46}" stroke="#3a322c" stroke-width="7"/>` +
    `<path d="M${x + 40} 26Q1420 70 ${W} 60M${x + 40} 26Q1430 110 ${W} 120M${x - 40} 26Q900 90 600 0" fill="none" stroke="#2c2826" stroke-width="2"/>` +
    `<path d="M${x + 6} 262Q${x + 30} 236 ${x + 62} 234" fill="none" stroke="#3a3a36" stroke-width="5"/>` +
    `<path d="M${x + 50} 228q16 -6 34 2l-4 8q-14 -2 -28 0z" fill="#5a5c58"/>` +
    `<g>${dies}<g>${flick}<path d="M${x + 56} 238q10 3 22 -1" stroke="#eef4f0" stroke-width="3"/>` +
    `<circle cx="${x + 66}" cy="242" r="70" fill="url(#sh-cold)"/></g></g>`
}

// The little concrete building: a heavy roof slab with pipes, grimy pale walls, a
// brick base, a dark doorway; a fire hydrant and an A-frame sign by the corner.
function building() {
  const rng = mulberry32(3)
  const x = 1372
  let bricks = ''
  // Courses from the brick base's top (640) to its bottom (860); no joint runs past it.
  for (let y = 649; y < 860; y += 9) {
    bricks += `M${x} ${y}H${W}`
    for (let bx = x + ((y / 9) % 2 ? 0 : 9); bx < W; bx += 18) bricks += `M${bx} ${y}v${Math.min(9, 860 - y)}`
  }
  let stains = ''
  for (let i = 0; i < 12; i++) stains += `<path d="M${n0(x + 10 + rng() * 210)} ${n0(486 + rng() * 40)}v${n0(30 + rng() * 90)}" stroke="#6e6a5e" stroke-width="${n0(3 + rng() * 8)}" opacity="0.35"/>`
  return `<path d="M${x - 24} 444H${W}V486H${x - 24}Z" fill="#5a5b55"/><path d="M${x - 24} 444H${W}" stroke="#8a8b84" stroke-width="3"/>` +
    `<path d="M${x - 24} 480H${W}V490H${x - 24}Z" fill="#3a3b37"/>` +
    `<path d="M1418 444v-24h8v24M1568 444v-18h7v18" stroke="#3a3632" stroke-width="7"/>` +
    `<path d="M${x} 490H${W}V860H${x}Z" fill="#a9a395"/>` + stains +
    // Depth: the building's left side recedes, in shade.
    `<path d="M${x} 490L${x + 26} 498V870L${x} 860Z" fill="#7a7466"/>` +
    // Torn posters and a scrawl of graffiti on the pale wall.
    `<path d="M1392 520h46v58h-46zM1446 530h34v44h-34zM1494 512h28v40h-28z" fill="#d6d0c0" opacity="0.75"/>` +
    `<path d="M1392 560l12 18h-12zM1470 574l10 -12v12zM1494 540l14 12h-14z" fill="#a9a395"/>` +
    `<path d="M1398 534h34M1398 542h26M1452 540h22M1452 548h16" stroke="#6a6458" stroke-width="2"/>` +
    `<path d="M1390 606q14 -14 28 0t28 0q10 -16 22 -4M1452 618l10 -14l8 14l10 -14M1500 600q8 18 22 2" fill="none" stroke="#3a3632" stroke-width="3" stroke-linecap="round" opacity="0.7"/>` +
    `<path d="M${x} 640H${W}V860H${x}Z" fill="#6a3a2e"/><path d="${bricks}" stroke="#4a2a22" stroke-width="1" opacity="0.8"/>` +
    `<path d="M1528 600H${W}V860H1528Z" fill="#141513"/><path d="M1528 600H${W}" stroke="#5a5b55" stroke-width="5"/>` +
    `<path d="M${x} 490V860" stroke="#4a4840" stroke-width="5"/>` +
    // The fire hydrant: a base flange, a barrel, side nozzles, a bonnet and a cap, its
    // paint a faded, chipped yellow with a shaded left side.
    `<ellipse cx="1184" cy="870" rx="16" ry="5" fill="#1a1a18" opacity="0.6"/>` +
    `<path d="M1170 870h28v-6h-28z" fill="#6a5a2a"/><path d="M1174 864h20v-30h-20z" fill="#9a8638"/><path d="M1174 864h6v-30h-6z" fill="#6e5e28"/>` +
    `<path d="M1164 846h10v8h-10zM1194 846h10v8h-10z" fill="#8a7832"/><path d="M1162 847h3v6h-3zM1203 847h3v6h-3z" fill="#5a4c22"/>` +
    `<path d="M1172 834h24l-3 -8h-18z" fill="#a8943e"/><path d="M1180 826h8v-5h-8z" fill="#7a6a2e"/>` +
    `<path d="M1186 840l3 4M1177 856l4 2" stroke="#4a4030" stroke-width="2"/>` +
    `<path d="M1336 700L1350 640L1364 700M1340 684h20" fill="none" stroke="#2a2a28" stroke-width="2"/><path d="M1340 696L1350 644L1352 644L1346 696Z" fill="#d8d6cc"/>`
}

// The road in the rust: cracks spread across the asphalt and the sidewalk, branching,
// and potholes open, dark with a broken rim.
function roadDecay() {
  const r = mulberry32(77)
  let cracks = ''
  const crack = (x, y, a, n, depth) => {
    for (let k = 0; k < n; k++) {
      a += (r() - 0.5) * 0.9
      const nx = x + Math.cos(a) * (14 + r() * 22)
      const ny = y + Math.sin(a) * (5 + r() * 9)
      cracks += `M${n0(x)} ${n0(y)}L${n0(nx)} ${n0(ny)}`
      if (depth < 2 && r() < 0.3) crack(nx, ny, a + (r() < 0.5 ? -1 : 1), 3, depth + 1)
      x = nx
      y = ny
    }
  }
  for (let i = 0; i < 12; i++) crack(r() * 1100, 740 + r() * 150, r() * Math.PI * 2, 6, 0)
  for (let i = 0; i < 6; i++) crack(r() * 1360, 692 + r() * 30, r() < 0.5 ? 0 : Math.PI, 3, 1)
  let holes = ''
  for (const [cx, cy, rx] of [[300, 820, 40], [880, 860, 52], [180, 760, 26], [1000, 770, 30]]) {
    const pts = Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; const k = 0.7 + r() * 0.4; return `${n0(cx + Math.cos(a) * rx * k)} ${n0(cy + Math.sin(a) * rx * 0.3 * k)}` })
    holes += `M${pts.join('L')}Z`
  }
  return `<g opacity="0">${owIn()}<path d="${holes}" fill="#141210" stroke="#5a544c" stroke-width="2"/>` +
    `<path d="${cracks}" fill="none" stroke="#141210" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="${cracks}" fill="none" stroke="#6a625a" stroke-width="0.6" opacity="0.6" transform="translate(1 1)"/></g>`
}

// The building in the rust: paint peels off to show the brick, cracks run up the
// walls, black streaks run down from the roof, a chunk of the roof edge is gone, and
// the doorway is boarded up.
function buildingDecay() {
  const r = mulberry32(31)
  const x = 1372
  let peel = ''
  for (const [px, py, w, h] of [[1386, 520, 60, 40], [1452, 590, 50, 36], [1500, 500, 40, 60]]) {
    const pts = Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; const k = 0.7 + r() * 0.4; return `${n0(px + w / 2 + Math.cos(a) * w / 2 * k)} ${n0(py + h / 2 + Math.sin(a) * h / 2 * k)}` })
    peel += `M${pts.join('L')}Z`
  }
  let cracks = ''
  for (const [cx, cy] of [[1400, 860], [1470, 700], [1530, 860]]) {
    let px = cx
    let py = cy
    for (let k = 0; k < 7; k++) { const nx = px + (r() - 0.5) * 16; const ny = py - 12 - r() * 16; cracks += `M${n0(px)} ${n0(py)}L${n0(nx)} ${n0(ny)}`; px = nx; py = ny }
  }
  let streaks = ''
  for (let i = 0; i < 9; i++) streaks += `M${n0(x + 8 + r() * 220)} 490v${n0(40 + r() * 140)}`
  let boards = ''
  for (const [y, a] of [[640, 4], [700, -3], [760, 5], [820, -4]]) boards += `M1526 ${y}L${W} ${y + a}L${W} ${y + a + 16}L1526 ${y + 16}Z`
  return `<g opacity="0">${owIn()}` +
    `<path d="${peel}" fill="#6a3a2e" stroke="#4a3a30" stroke-width="2"/>` +
    `<path d="${streaks}" stroke="#1a1612" stroke-width="5" opacity="0.6"/>` +
    `<path d="${cracks}" fill="none" stroke="#1a1612" stroke-width="2"/>` +
    `<path d="M1440 442L1470 442L1462 456L1448 452Z" fill="#2a2620"/>` +
    `<path d="${boards}" fill="#5a4636" stroke="#2a2018" stroke-width="1.5"/>` +
    `<path d="M1540 650l2 2M1580 710l2 2M1550 770l2 2" stroke="#1a1612" stroke-width="3"/></g>`
}

// ---------------------------------------------------------------- weather and the otherworld

// A thin fog veil over the whole lot, drifting, and wisps creeping along the wall.
function veil() {
  return bank(800, 760, 1200, 220, 0.22, 90, 80, -15) + bank(500, 640, 520, 40, 0.5, 140, 50, -5) + bank(1100, 650, 420, 34, 0.45, -120, 46, -25)
}

// Ash, drifting down slowly, each flake its own small box.
function ash() {
  const rng = mulberry32(31)
  return Array.from({ length: 22 }, () => {
    const d = 20 + rng() * 16
    const c = rng() < 0.6 ? '#7a7a74' : '#d2d0c6'
    return `<g transform="translate(${n0(rng() * W)} -10)"><g>${at('translate', `0 0;${n0(-30 - rng() * 50)} ${H + 20}`, n1(d), -rng() * d, '', false)}` +
      `<path d="M0 0l2.4 1l-1 2.2l-2.6 -0.6z" fill="${c}" opacity="${n1(0.55 + rng() * 0.35)}"/></g></g>`
  }).join('')
}

// The rust on the places themselves: stains on the wall's face, on the sidewalk and
// the asphalt, and on the building, each clipped to its own surface, and drips running
// down from the wall's top and the roof's edge. The wall and ground layer is drawn
// before the man, the car and the creature, so they stand in front of it.
function rustStains() {
  const rng = mulberry32(666)
  // A blotch: an irregular, many-pointed patch.
  const blotch = (cx, cy, rx, ry) => {
    const pts = []
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const r = 0.65 + rng() * 0.5
      pts.push(`${n0(cx + Math.cos(a) * rx * r)} ${n0(cy + Math.sin(a) * ry * r)}`)
    }
    return `<path d="M${pts.join('L')}Z" fill="url(#sh-blot)"/>`
  }
  const set = (n, f) => Array.from({ length: n }, f).map(([x, y, rx, ry]) => [x, y, rx, ry])
  const wallSpots = set(9, () => [rng() * 1360, WALL + 14 + rng() * 60, 30 + rng() * 60, 10 + rng() * 18])
  const groundSpots = set(10, () => [rng() * 1360, 730 + rng() * 160, 50 + rng() * 110, 10 + rng() * 22])
  const bldSpots = set(4, () => [1380 + rng() * 210, 500 + rng() * 320, 20 + rng() * 40, 20 + rng() * 50])
  const wallP = wallSpots.map((q) => blotch(...q)).join('')
  const groundP = groundSpots.map((q) => blotch(...q)).join('')
  const bldP = bldSpots.map((q) => blotch(...q)).join('')
  let wallDrips = ''
  let roofDrips = ''
  const drip = (x, y, len) => `M${n1(x - 1.6)} ${y}L${n1(x - 0.4)} ${n1(y + len)}L${n1(x + 0.4)} ${n1(y + len)}L${n1(x + 1.6)} ${y}Z`
  for (let i = 0; i < 40; i++) wallDrips += drip(rng() * 1370, WALL + 10, 8 + rng() * 60)
  for (let i = 0; i < 16; i++) roofDrips += drip(1350 + rng() * 250, 488, 20 + rng() * 120)
  return {
    low: `<g opacity="0">${owIn(0.9)}` +
      `<clipPath id="sh-wall-clip"><path d="M0 ${WALL + 10}H1372V688H0Z"/></clipPath><clipPath id="sh-ground-clip"><path d="M0 700H1380V900H0Z"/></clipPath>` +
      `<g clip-path="url(#sh-wall-clip)">${wallP}<path d="${wallDrips}" fill="#4a1a0a" opacity="0.85"/></g>` +
      `<g clip-path="url(#sh-ground-clip)">${groundP}</g></g>`,
    high: `<g opacity="0">${owIn(0.9)}<clipPath id="sh-bld-clip"><path d="M1372 486H${W}V860H1372Z"/></clipPath>` +
      `<g clip-path="url(#sh-bld-clip)">${bldP}<path d="${roofDrips}" fill="#4a1a0a" opacity="0.85"/></g></g>`,
  }
}

// The otherworld's light: about once a minute everything goes red-brown and dark,
// then it fades back. The stains, the creature and the decay come with it.
function otherworld() {
  return `<g opacity="0">${ao('0;0;0.9;0.9;0;0', OW.d, 0, OW.t)}<rect width="${W}" height="${H}" fill="url(#sh-rust)"/></g>`
}

// The creature: an original thing, seen only during the rust, with nothing human in
// its outline. It walks on backward-bending legs that end in long, bird-like feet. Its
// torso is hunched and raw, the flesh mottled, the spine a row of ridges, the ribs
// showing. It has no head: a swollen lump sits sunk into its chest, and a vertical
// seam down the lump slowly splits open and closes. Its arms are far too long, with an
// extra joint, so the claws drag near the ground. It walks with a real stride: the body
// moves at the speed the legs set, a planted foot stays put, the joints flex through
// each swing, and the body rises a little over each step. It comes in from the left
// toward the man at the wall, and fades before it reaches him.
const CREATURE = { scale: 0.85, hip: 120, swing: 13, period: 1.7 }
function creature() {
  const { scale, hip, swing, period } = CREATURE
  const stride = 2 * hip * Math.sin((swing * Math.PI) / 180) * scale
  const speed = stride / (period / 2)
  const t0 = 0.81
  const t1 = 0.95
  const x0 = -80
  const x1 = x0 + speed * (t1 - t0) * OW.d
  const flesh = '#5a2a22'
  const deep = '#2e1210'
  const mid = '#7a3a2c'
  const rim = '#b0603a'
  const loop = `dur="${period}s" repeatCount="indefinite"`
  // A leg bending backward: the thigh runs down and back to a knee behind the hip, the
  // shin runs down and forward, then a long foot and splayed toes. The whole leg
  // swings from the hip; during the swing the knee folds further.
  const leg = (phase, fill) => {
    const hipVals = phase ? `${swing};${-swing};${swing}` : `${-swing};${swing};${-swing}`
    const kneeVals = phase ? '0;-30;0;0' : '0;0;-30;0'
    const kneeKT = phase ? '0;0.25;0.5;1' : '0;0.5;0.75;1'
    return `<g transform="translate(0 ${-hip})"><g><animateTransform attributeName="transform" type="rotate" values="${hipVals}" ${loop}/>` +
      `<path d="M-7 0Q-14 26 -20 50L-12 54Q-4 30 7 2Z" fill="${fill}"/><circle cx="-16" cy="52" r="5" fill="${fill}"/>` +
      `<g transform="translate(-16 52)"><g><animateTransform attributeName="transform" type="rotate" values="${kneeVals}" keyTimes="${kneeKT}" ${loop}/>` +
      `<path d="M-4 0L4 0L20 50L14 52Z" fill="${fill}"/><circle cx="17" cy="51" r="3.5" fill="${fill}"/>` +
      `<path d="M15 50L22 68L26 68L20 50Z" fill="${fill}"/>` +
      `<path d="M21 66L36 68M21 67L32 72M22 67L14 71" stroke="${fill}" stroke-width="2.4" stroke-linecap="round"/></g></g></g></g>`
  }
  // An arm with an extra joint: upper arm, forearm, a third long segment, and claws.
  const arm = (phase, x, fill) => {
    const vals = phase ? '10;-6;10' : '-6;10;-6'
    const sub = phase ? '-8;6;-8' : '6;-8;6'
    return `<g transform="translate(${x} -188)"><g><animateTransform attributeName="transform" type="rotate" values="${vals}" ${loop}/>` +
      `<path d="M-4 0L5 0L8 56L1 58Z" fill="${fill}"/><circle cx="4" cy="57" r="4" fill="${fill}"/>` +
      `<g transform="translate(4 57)"><g><animateTransform attributeName="transform" type="rotate" values="${sub}" ${loop}/>` +
      `<path d="M-3 0L3 0L2 56L-3 56Z" fill="${fill}"/><circle cx="0" cy="56" r="3.4" fill="${fill}"/>` +
      `<path d="M-2 56L2 56L4 104L0 104Z" fill="${fill}"/>` +
      `<path d="M1 103Q-6 114 -4 124M2 104Q2 116 6 126M3 103Q10 112 12 120" fill="none" stroke="${fill}" stroke-width="2" stroke-linecap="round"/></g></g></g></g>`
  }
  const bob = `<animateTransform attributeName="transform" type="translate" values="0 2;0 -3;0 2" dur="${period / 2}s" repeatCount="indefinite"/>`
  const seam = `<animateTransform attributeName="transform" type="scale" values="1 1;1 1;3.2 1;3.2 1;1 1" keyTimes="0;0.4;0.55;0.75;1" dur="4.4s" repeatCount="indefinite"/>`
  const body = `<g>${bob}` +
    arm(0, 30, deep) + leg(1, deep) +
    // The torso: hunched hard forward, a long hump of a back over a narrow waist.
    `<path d="M-8 -116Q-22 -150 -10 -186Q4 -214 32 -212Q52 -206 56 -186Q58 -168 46 -156Q30 -136 18 -118Q6 -106 -8 -116Z" fill="${flesh}"/>` +
    // Mottling and the shadow side.
    `<ellipse cx="18" cy="-176" rx="12" ry="8" fill="${mid}" opacity="0.7"/><ellipse cx="2" cy="-150" rx="7" ry="10" fill="${deep}" opacity="0.6"/><ellipse cx="34" cy="-198" rx="9" ry="5" fill="${mid}" opacity="0.6"/>` +
    `<path d="M-8 -116Q-22 -150 -10 -186Q-2 -202 12 -208Q0 -190 -2 -160Q-2 -134 6 -112Q0 -110 -8 -116Z" fill="${deep}" opacity="0.7"/>` +
    // The spine: a row of ridges along the back, lit by the rust light.
    `<path d="M-10 -186Q4 -214 32 -212Q52 -206 56 -186" fill="none" stroke="${rim}" stroke-width="2"/>` +
    [[-6, -196], [4, -205], [16, -211], [28, -212], [40, -209], [50, -200]].map(([x, y]) => `<path d="M${x - 3} ${y + 2}L${x} ${y - 6}L${x + 3} ${y + 2}Z" fill="${mid}"/>`).join('') +
    // The ribs.
    `<path d="M28 -186Q40 -180 46 -168M24 -176Q36 -170 40 -158M20 -166Q30 -160 34 -148" fill="none" stroke="${deep}" stroke-width="2"/>` +
    // No head: a swollen lump sunk into the chest, and a seam that splits open.
    `<path d="M42 -170Q62 -176 66 -156Q68 -136 52 -132Q40 -134 38 -150Q36 -164 42 -170Z" fill="${mid}"/>` +
    `<path d="M66 -156Q68 -136 52 -132" fill="none" stroke="${rim}" stroke-width="1.6"/>` +
    `<g transform="translate(54 -152)"><g>${seam}<path d="M-1.2 -14Q-2 0 -1.2 14L1.2 14Q2 0 1.2 -14Z" fill="#120606"/></g></g>` +
    leg(0, flesh) + arm(1, 44, flesh) +
    `</g>`
  return `<g opacity="0">${ao('0;0;1;1;0;0', OW.d, 0, `0;${t0 - 0.01};${t0 + 0.01};${t1 - 0.02};${t1};1`)}` +
    `<g><animateTransform attributeName="transform" type="translate" values="${n0(x0)} 716;${n0(x0)} 716;${n0(x1)} 716;${n0(x1)} 716" keyTimes="0;${t0};${t1};1" dur="${OW.d}s" repeatCount="indefinite"/>` +
    `<g transform="scale(${scale})">${body}</g></g></g>`
}

// ---------------------------------------------------------------- the scene

export function buildScene() {
  const rust = rustStains()
  const grain = (() => {
    const rng = mulberry32(99)
    let dark = ''
    let light = ''
    for (let i = 0; i < 520; i++) {
      const d = `M${n0(rng() * 200)} ${n0(rng() * 200)}h1v1h-1z`
      if (rng() < 0.6) dark += d
      else light += d
    }
    return `<pattern id="sh-grain" width="200" height="200" patternUnits="userSpaceOnUse"><path d="${dark}" fill="#000"/><path d="${light}" fill="#fff" opacity="0.6"/></pattern>`
  })()
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sh-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c3e3b"/><stop offset="0.35" stop-color="#4a4d48"/><stop offset="0.62" stop-color="#6a6d66"/><stop offset="0.7" stop-color="#8a8c84"/></linearGradient>
    <radialGradient id="sh-fog"><stop offset="0" stop-color="#7e7f82" stop-opacity="0.9"/><stop offset="0.55" stop-color="#727378" stop-opacity="0.45"/><stop offset="1" stop-color="#8c8e86" stop-opacity="0"/></radialGradient>
    <pattern id="sh-needles" width="14" height="10" patternUnits="userSpaceOnUse"><rect width="14" height="10" fill="#23251e"/><path d="M1 2h2v1h-2zM7 1h2v1h-2zM11 4h2v1h-2zM4 6h2v1h-2zM9 8h2v1h-2zM2 9h1v1h-1z" fill="#45473a"/><path d="M5 3h1v1h-1zM12 7h1v1h-1zM0 5h1v1h-1z" fill="#5c5c48"/><path d="M3 4h2v1h-2zM10 2h1v1h-1zM6 8h2v1h-2z" fill="#161c14"/></pattern>
    <radialGradient id="sh-mottle-d"><stop offset="0" stop-color="#2a2c29" stop-opacity="0.45"/><stop offset="1" stop-color="#2a2c29" stop-opacity="0"/></radialGradient>
    <radialGradient id="sh-mottle-l"><stop offset="0" stop-color="#7e817a" stop-opacity="0.3"/><stop offset="1" stop-color="#7e817a" stop-opacity="0"/></radialGradient>
    <radialGradient id="sh-blot"><stop offset="0" stop-color="#3a1206" stop-opacity="0.85"/><stop offset="0.6" stop-color="#5a2210" stop-opacity="0.55"/><stop offset="1" stop-color="#6a2a12" stop-opacity="0"/></radialGradient>
    <linearGradient id="sh-glass" gradientUnits="userSpaceOnUse" x1="0" y1="730" x2="0" y2="830"><stop offset="0" stop-color="#6e7e82"/><stop offset="0.5" stop-color="#3e4a4d"/><stop offset="1" stop-color="#232a2c"/></linearGradient>
    <linearGradient id="sh-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e6f74" stop-opacity="0"/><stop offset="0.7" stop-color="#7a7b80" stop-opacity="0.85"/><stop offset="1" stop-color="#7a7b80" stop-opacity="0.95"/></linearGradient>
    <radialGradient id="sh-cold"><stop offset="0" stop-color="#eef4f0" stop-opacity="0.55"/><stop offset="0.3" stop-color="#cfd8d4" stop-opacity="0.18"/><stop offset="1" stop-color="#cfd8d4" stop-opacity="0"/></radialGradient>
    <radialGradient id="sh-rust" cx="0.5" cy="0.55" r="0.75"><stop offset="0" stop-color="#4a1c10" stop-opacity="0.55"/><stop offset="1" stop-color="#1a0806" stop-opacity="0.95"/></radialGradient>
    <radialGradient id="sh-vignette" cx="0.5" cy="0.5" r="0.75"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0a0b0a" stop-opacity="0.8"/></radialGradient>
    ${grain}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sh-sky)"/>
  ${mottle()}
  ${valley()}
  ${wall()}
  ${lot()}
  ${roadDecay()}
  ${rust.low}
  ${man()}
  ${car()}
  ${building()}
  ${buildingDecay()}
  ${rust.high}
  ${pole()}
  ${veil()}
  ${ash()}
  ${otherworld()}
  ${creature()}
  <rect width="${W}" height="${H}" fill="url(#sh-vignette)"/>
  <rect width="${W}" height="${H}" fill="#4a4b4a" opacity="0.2"/>
  <rect width="${W}" height="${H}" fill="url(#sh-grain)" opacity="0.28"/>
</svg>`
}
