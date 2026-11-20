// Dark fantasy: a sprawling castle on a sheer sea cliff under a pale moon. Towers
// with cone roofs, square keeps with turrets, steep-roofed halls and a cathedral
// spire crowd the cliff top and step down its face. A long arched bridge runs from
// the wanderer's ledge across the misty gap to a gatehouse whose beacon sweeps red.
// Wind from the right: fog scrolls left, the cloak streams, the tree bends, and
// waves break on the cliff. Lightning strikes in the distance.
//
// All motion is SMIL: the desktop app draws the scene in a sandboxed frame where
// SMIL runs and inline CSS does not, so there is no <style>; every colour is a
// presentation attribute. Repeated roof, turret and window shapes are <symbol>s.
// Plain JS: the mod and any preview build from this one file.

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
const N = 128
const XS = Array.from({ length: N + 1 }, (_, i) => (i * W) / N)
const n0 = (v) => Math.round(v)
const n1 = (v) => v.toFixed(1)

const MOON = { x: 1262, y: 196, r: 84 }
const SEA = 760
const RIM = '#b3add6'

// SMIL helpers. Values are ';'-separated.
const SPLINE = '0.42 0 0.58 1'
const evenTimes = (n) => Array.from({ length: n }, (_, i) => (i / (n - 1)).toFixed(3)).join(';')
function at(type, values, dur, begin = 0, kt = '', ease = false, additive = false) {
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

function displace(rng, amp, rough) {
  const h = new Array(N + 1).fill(0)
  h[0] = (rng() - 0.5) * amp
  h[N] = (rng() - 0.5) * amp
  let step = N
  let scale = amp
  while (step > 1) {
    const half = step / 2
    for (let i = half; i < N; i += step) {
      h[i] = (h[i - half] + h[i + half]) / 2 + (rng() - 0.5) * scale
    }
    scale *= rough
    step = half
  }
  return h
}

function ridge(rng, baseY, amp, rough, peaks) {
  const h = displace(rng, amp, rough)
  return XS.map((x, i) => {
    let height = amp * 0.5 + h[i]
    for (const p of peaks) height += p.h * Math.exp(-((x - p.x) ** 2) / (2 * p.w * p.w))
    return baseY - Math.max(0, height)
  })
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const linePath = (ys) => `M0 ${n0(ys[0])}` + ys.slice(1).map((y, i) => ` L${n0(XS[i + 1])} ${n0(y)}`).join('')
const fillPath = (ys) => `${linePath(ys)} L${W} ${H} L0 ${H} Z`
const poly = (pts) => `M${pts.map(([x, y]) => `${n0(x)} ${n0(y)}`).join(' L')}`

// Advance the main random stream exactly as the earlier crag and foundation did,
// so the tree, fog and embers that come later keep their shapes.
function burn(rng, count) {
  for (let i = 0; i < count; i++) rng()
}

// ---------------------------------------------------------------- the rock

// A rock spur rising from the sea and narrowing upward to the castle's footprint.
// Its left slope carries the stepped wall down to the gatehouse where the bridge
// lands; its right face drops sheer into the water. Faint strata and cracks on the
// face, and a jagged crag cap that the castle's plinth sits in. The body and the
// cap share one user-space gradient, so the cap's lower edge does not show.
function spur() {
  const rc = mulberry32(555)
  const left = [[930, 900], [928, 820], [940, 760], [948, 700], [952, 668], [1010, 646], [1060, 606], [1100, 572], [1112, 566]]
  const top = [[1150, 560], [1210, 558], [1270, 557], [1330, 558], [1390, 558], [1440, 560]]
  const right = [[1468, 564], [1478, 604], [1470, 652], [1490, 700], [1484, 745], [1500, 800], [1512, 900]]
  const body = `${poly([...left, ...top, ...right])} Z`
  let waterX = 1490
  for (let i = 1; i < right.length; i++) {
    const [xa, ya] = right[i - 1]
    const [xb, yb] = right[i]
    if (ya <= SEA && yb >= SEA) {
      waterX = xa + ((xb - xa) * (SEA - ya)) / (yb - ya)
      break
    }
  }
  // Strata: long, thin, faint facets that catch a little moonlight, and dark cracks.
  const marks = []
  for (let i = 0; i < 16; i++) {
    const x = 1000 + rc() * 460
    const y0 = 612 + rc() * 50 // below the crag cap's foot (604), so the cap shows no edge
    const len = 80 + rc() * 160
    const w = 6 + rc() * 14
    const lean = (rc() - 0.5) * 14
    const lit = (x - 1000) / 460
    // A facet: its left side in shadow, its right edge catching the moon.
    marks.push(`<path d="M${n0(x)} ${n0(y0)} L${n0(x + w)} ${n0(y0 + 6)} L${n0(x + w + lean)} ${n0(y0 + len)} L${n0(x + lean)} ${n0(y0 + len - 8)} Z" fill="#4a4478" opacity="${n1(0.06 + lit * 0.22)}"/>`)
    marks.push(`<path d="M${n0(x + w)} ${n0(y0 + 6)} L${n0(x + w + lean)} ${n0(y0 + len)}" fill="none" stroke="${RIM}" stroke-opacity="${n1(0.05 + lit * 0.2)}" stroke-width="1"/>`)
    marks.push(`<path d="M${n0(x - 2)} ${n0(y0 + 4)} L${n0(x - 2 + lean * 0.5)} ${n0(y0 + len * 0.6)} L${n0(x + lean)} ${n0(y0 + len)}" fill="none" stroke="#030308" stroke-opacity="0.8" stroke-width="${n1(1.2 + rc() * 1.4)}"/>`)
  }
  // The crag cap: jagged rock over the plinth's foot, rising around the corner towers.
  const cap = [[1102, 604], [1104, 572]]
  for (let x = 1112; x <= 1464; x += 16) {
    const nearTower = Math.min(Math.abs(x - 1141), Math.abs(x - 1440)) < 26
    cap.push([x, 563 - rc() * 9 - (nearTower ? 10 : 0)])
  }
  cap.push([1468, 566], [1478, 604])
  const capTop = cap.slice(1, -1)
  // The rock under the stepped wall, down to the gatehouse.
  const teethB = [[996, 668]]
  for (let i = 0; i <= 7; i++) {
    const t = i / 7
    teethB.push([1000 + 124 * t, 650 - 98 * t - rc() * 16])
  }
  teethB.push([1130, 580], [1060, 640])
  const teeth = `<path d="${poly(teethB)} Z" fill="url(#df-cliff)"/><path d="${poly(cap)} Z" fill="url(#df-cliff)"/>` +
    `<path d="${poly(capTop.filter(([x]) => x > 1290))}" fill="none" stroke="${RIM}" stroke-opacity="0.26" stroke-width="1.1"/>`
  const rim = poly([top[5], ...right.slice(0, 5)])
  return { body, rim, marks: marks.join(''), teeth, waterX }
}

// ---------------------------------------------------------------- the castle

const use = (id, x, y, w, h, color) =>
  `<use href="#${id}" x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}"${color ? ` color="${color}"` : ''}/>`
const win = (x, y, s = 1) => use('c-win', x, y, 3 * s, 7 * s)

// The eye. It blinks (a double blink every 7 s: the lids squash it to a slit about
// its centre and the halo dims). Its slit pupil looks around in quick saccades with
// holds between (left, right, up, down, back to centre), on an 11.4 s loop so the
// glances and blinks fall at different moments each time. The pupil dilates and
// narrows on its own 9.4 s loop. The almond clips the pupil, so it never leaves it.
const BLINK = { s: '1 1;1 1;1 0.04;1 1;1 1;1 0.04;1 1;1 1', o: '1;1;0.35;1;1;0.35;1;1', t: '0;0.84;0.865;0.89;0.915;0.94;0.965;1', d: 7 }
// [x, y, hold in seconds]: where the pupil rests, and for how long.
const GAZE = [[0, 0, 1.6], [-6.5, 0.5, 1.2], [-5, 2.5, 0.5], [0, 0, 1.2], [6.5, -1, 1.1], [4, 2.5, 0.7], [0, -2.5, 0.9], [-3, 0, 1.4], [7, 0.5, 0.9]]
function gazeAnim() {
  const SACCADE = 0.14
  const D = GAZE.reduce((s, g) => s + g[2] + SACCADE, 0)
  const v = []
  const k = []
  let t = 0
  for (const [x, y, hold] of GAZE) {
    v.push(`${x} ${y}`, `${x} ${y}`)
    k.push(t, t + hold)
    t += hold + SACCADE
  }
  v.push(`${GAZE[0][0]} ${GAZE[0][1]}`)
  k.push(D)
  const kt = k.map((x) => (x / D).toFixed(4)).join(';')
  const splines = Array(v.length - 1).fill('0.3 0 0.2 1').join(';')
  return `<animateTransform attributeName="transform" type="translate" values="${v.join(';')}" keyTimes="${kt}" dur="${n1(D)}s" repeatCount="indefinite" calcMode="spline" keySplines="${splines}"/>`
}
const DILATE = { rx: '1.6;1.6;3.6;3.4;1.1;1.2;1.6', ry: '4.6;4.6;5.4;5.3;4.3;4.3;4.6', t: '0;0.18;0.3;0.48;0.6;0.85;1', d: 9.4 }
function eye(cx, cy) {
  const almond = `M${cx - 11} ${cy} Q${cx} ${cy - 9} ${cx + 11} ${cy} Q${cx} ${cy + 9} ${cx - 11} ${cy} Z`
  const spl = (n) => Array(n - 1).fill(SPLINE).join(';')
  const size = (attr, values) =>
    `<animate attributeName="${attr}" values="${values}" keyTimes="${DILATE.t}" dur="${DILATE.d}s" repeatCount="indefinite" calcMode="spline" keySplines="${spl(7)}"/>`
  const pupil = `<ellipse cx="${cx}" cy="${cy}" rx="1.6" ry="4.6" fill="#2a0603">${gazeAnim()}${size('rx', DILATE.rx)}${size('ry', DILATE.ry)}</ellipse>`
  return `<g>${ao('0.7;1;0.7', 4.5)}<g>${ao(BLINK.o, BLINK.d, 0, BLINK.t)}<circle cx="${cx}" cy="${cy}" r="36" fill="url(#df-eye-halo)"/></g>` +
    pivot(cx, cy, at('scale', BLINK.s, BLINK.d, 0, BLINK.t),
      `<clipPath id="df-eye-clip"><path d="${almond}"/></clipPath><path d="${almond}" fill="#ff4a22"/><g clip-path="url(#df-eye-clip)">${pupil}</g>`) +
    `</g>`
}

// A flared roof: concave sides, overhanging eaves, a finial.
function bellRoof(x, top, w, h, c, rim) {
  const e = w * 0.18
  const cx = x + w / 2
  const p = [`<path d="M${n1(x - e)} ${n1(top)} Q${n1(cx - w * 0.1)} ${n1(top - h * 0.3)} ${n1(cx)} ${n1(top - h)} Q${n1(cx + w * 0.1)} ${n1(top - h * 0.3)} ${n1(x + w + e)} ${n1(top)} Z" fill="${c}"/>`]
  p.push(`<line x1="${n1(cx)}" y1="${n1(top - h)}" x2="${n1(cx)}" y2="${n1(top - h - 10)}" stroke="${c}" stroke-width="1.3"/>`)
  if (rim) p.push(`<path d="M${n1(cx)} ${n1(top - h)} Q${n1(cx + w * 0.1)} ${n1(top - h * 0.3)} ${n1(x + w + e)} ${n1(top)}" fill="none" stroke="${RIM}" stroke-opacity="0.32" stroke-width="1.2"/>`)
  return p.join('')
}

function windowColumn(cx, top, h, step, s = 1) {
  const out = []
  for (let y = top + 18; y < top + h - 14; y += step) out.push(win(cx - 1.5 * s, y, s))
  return out.join('')
}

// A round tower standing on `base`: body, corbelled band, flared roof, moonlight on
// its right edge, a column of windows.
function roundTower(x, base, w, h, roofH, c) {
  const top = base - h
  return [
    `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${c}"/>`,
    `<rect x="${x - 2}" y="${top}" width="${w + 4}" height="6" fill="${c}"/>`,
    bellRoof(x, top, w, roofH, c, true),
    `<rect x="${x + w - 1.6}" y="${top + 6}" width="1.6" height="${h - 6}" fill="${RIM}" opacity="0.22"/>`,
    windowColumn(x + w / 2, top, h, 34),
  ].join('')
}

// The keep, rising from inside the walls: body, corner pinnacles, an octagonal
// lantern, a tall flared spire against the moon, the eye and two window columns.
function keepTower(x, wallTop) {
  const w = 60
  const c = '#06080c'
  const top = 220
  const h = wallTop - top
  const lw = 40
  const lx = x + (w - lw) / 2
  const lt = top - 34
  const p = [
    `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${c}"/>`,
    `<rect x="${x - 4}" y="${top}" width="${w + 8}" height="9" fill="${c}"/>`,
    use('c-crenel', x - 4, top - 6, w + 8, 6, c),
    `<rect x="${lx}" y="${lt}" width="${lw}" height="40" fill="${c}"/>`,
    `<rect x="${lx - 3}" y="${lt}" width="${lw + 6}" height="5" fill="${c}"/>`,
    bellRoof(lx, lt, lw, 140, c, true),
    `<rect x="${x + w - 2}" y="${top + 9}" width="2" height="${h - 9}" fill="${RIM}" opacity="0.26"/>`,
  ]
  for (const px of [x - 6, x + w - 6]) {
    p.push(`<rect x="${px}" y="${top - 28}" width="12" height="38" fill="${c}"/>`)
    p.push(bellRoof(px, top - 28, 12, 44, c, px > x))
  }
  p.push(eye(x + w / 2, lt + 20))
  p.push(windowColumn(x + 18, top + 10, h - 20, 30, 1.2), windowColumn(x + w - 18, top + 10, h - 20, 30, 1.2))
  return p.join('')
}

// The gatehouse where the bridge lands, and its tall beacon tower.
function gatehouse(c) {
  return [
    `<rect x="952" y="566" width="52" height="104" fill="${c}"/>`,
    // A tapered foot below the sill, so the bridge deck that runs into the gate ends inside stone.
    `<path d="M952 670 L1004 670 L990 694 L952 694 Z" fill="${c}"/>`,
    use('c-crenel', 950, 560, 56, 7, c),
    `<path d="M958 670 L958 630 Q968 616 978 630 L978 670 Z" fill="#020305"/>`,
    `<path d="M960 670 L960 632 Q968 622 976 632 L976 670 Z" fill="url(#df-gate)"/>`,
    `<rect x="976" y="470" width="26" height="100" fill="${c}"/>`,
    `<rect x="974" y="470" width="30" height="6" fill="${c}"/>`,
    bellRoof(976, 470, 26, 66, c, true),
    `<rect x="1000" y="476" width="2" height="190" fill="${RIM}" opacity="0.24"/>`,
    win(987, 518), win(985, 590),
  ].join('')
}

// The plinth: a battered stone base under the curtain wall, wider at its foot. Its
// face is broken up so it does not read as a flat panel: sloped buttresses, a row of
// corbels under the string course, staggered block joints, arrow slits and a
// portcullised postern gate. Moonlight on its right edge and on each buttress. Its
// foot sits in the crag cap that the rock draws over it.
function plinth() {
  const T = 482
  const B = 566
  const lx = (y) => 1132 - ((y - T) * 20) / (B - T)
  const rx = (y) => 1448 + ((y - T) * 20) / (B - T)
  // Masonry: faint courses, and vertical joints staggered course by course.
  const joints = []
  ;[496, 510, 524, 538, 552].forEach((y, row) => {
    joints.push(`M${n1(lx(y))} ${y}H${n1(rx(y))}`)
    for (let x = 1140 + (row % 2) * 13; x < rx(y) - 6; x += 26) joints.push(`M${x} ${y}v${row === 4 ? 10 : 14}`)
  })
  const buttresses = [1196, 1262, 1324, 1386].map((bx) =>
    `<path d="M${bx - 7} 494 L${bx} 486 L${bx + 7} 494 L${bx + 10} ${B} L${bx - 10} ${B} Z" fill="#12111e"/>` +
    `<path d="M${bx} 486 L${bx + 7} 494 L${bx + 10} ${B}" fill="none" stroke="${RIM}" stroke-opacity="0.22" stroke-width="0.9"/>`).join('')
  const slits = [[1229, true], [1355, false], [1166, false], [1418, true]]
    .map(([sx, lit]) => `<rect x="${sx - 1}" y="505" width="2.2" height="12" fill="${lit ? '#ff7a3a' : '#040307'}" opacity="${lit ? 0.75 : 1}"/>`).join('')
  const gx = 1293
  const gate = `<ellipse cx="${gx}" cy="552" rx="14" ry="10" fill="url(#df-eye-halo)" opacity="0.5"/>` +
    `<path d="M${gx - 8} 560 V540 Q${gx} 530 ${gx + 8} 540 V560 Z" fill="#050307"/>` +
    `<path d="M${gx - 5} 538V560M${gx} 534V560M${gx + 5} 538V560M${gx - 8} 545H${gx + 8}M${gx - 8} 551H${gx + 8}" stroke="#3a2a3e" stroke-width="0.7"/>` +
    `<path d="M${gx - 10} 560 V539 Q${gx} 527 ${gx + 10} 539 V560" fill="none" stroke="#1d1b2c" stroke-width="2"/>`
  let corbels = ''
  for (let x = 1134; x < 1446; x += 9) corbels += `M${x} 485h6l-1.5 5h-3Z`
  return `<path d="M${lx(T)} ${T} L${rx(T)} ${T} L${rx(B)} ${B} L${lx(B)} ${B} Z" fill="url(#df-stone)"/>` +
    `<path d="${joints.join('')}" stroke="#26243c" stroke-opacity="0.4" stroke-width="0.8" fill="none"/>` +
    buttresses + slits + gate +
    `<rect x="1128" y="479" width="324" height="6" fill="#0c0c16"/>` +
    `<path d="${corbels}" fill="#0c0c16"/>` +
    `<path d="M${rx(T)} ${T} L${rx(B)} ${B}" stroke="${RIM}" stroke-opacity="0.32" stroke-width="1.2"/>`
}

// One fortress: the keep and an inner tower rise behind a single outer wall on a
// sloped stone base that continues the rock's slopes. Two big round towers hold the
// corners, two smaller ones stand on the wall, inner halls show only as roofs, and a
// stepped wall climbs the spur from the gatehouse to the left corner tower.
function fortress() {
  const c = '#06080c'
  const wallTop = 440
  const steps = [[1004, 566]]
  for (let k = 1; k <= 5; k++) steps.push([1004 + k * 24, 566 - (k - 1) * 20], [1004 + k * 24, 566 - k * 20])
  const stepped = `<path d="M${steps.map(([x, y]) => `${x} ${y}`).join(' L')} L1128 552 L1004 650 Z" fill="${c}"/>` +
    steps.filter((_, i) => i % 2 === 0).map(([x, y]) => use('c-crenel', x, y - 6, 24, 6, c)).join('') +
    `<path d="M${steps.map(([x, y]) => `${x} ${y}`).join(' L')}" fill="none" stroke="${RIM}" stroke-opacity="0.2" stroke-width="1"/>`
  return [
    keepTower(1232, wallTop),
    roundTower(1300, wallTop, 28, 150, 104, c),
    `<path d="M1168 ${wallTop} L1184 400 L1220 400 L1232 ${wallTop} Z" fill="${c}"/>`,
    `<path d="M1328 ${wallTop} L1340 404 L1374 404 L1392 ${wallTop} Z" fill="${c}"/>`,
    plinth(),
    `<rect x="1138" y="${wallTop}" width="304" height="42" fill="${c}"/>`,
    use('c-crenel', 1138, wallTop - 6, 304, 6, c),
    `<line x1="1138" y1="${wallTop}" x2="1442" y2="${wallTop}" stroke="${RIM}" stroke-opacity="0.2" stroke-width="1"/>`,
    [1176, 1252, 1288, 1386].map((x) => win(x, wallTop + 14, 0.9)).join(''),
    roundTower(1204, 482, 26, 84, 66, c),
    roundTower(1344, 482, 26, 92, 70, c),
    roundTower(1120, 566, 42, 210, 112, c),
    roundTower(1420, 566, 40, 190, 100, c),
    stepped,
    gatehouse(c),
  ].join('')
}

// A black-on-white check of the rock, the fortress and the bridge, to judge the
// silhouette alone.
export function buildSilhouette() {
  const rock = spur()
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <symbol id="c-tri" viewBox="0 0 10 10" preserveAspectRatio="none"><polygon points="0,10 5,0 10,10" fill="currentColor"/></symbol>
    <symbol id="c-crenel" viewBox="0 0 13 3" preserveAspectRatio="none"><path d="M0 0h2v3H0zM3.7 0h2v3h-2zM7.4 0h2v3h-2zM11 0h2v3h-2z" fill="currentColor"/></symbol>
    <symbol id="c-win" viewBox="0 0 3 7" preserveAspectRatio="none"><path d="M0 7V1.5Q1.5 0 3 1.5V7Z" fill="#000"/></symbol>
    <filter id="sil"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/><feComponentTransfer><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#fff"/>
  <g filter="url(#sil)"><path d="${rock.body}" fill="#000"/>${fortress()}${rock.teeth}${bridge()}</g>
</svg>`
}

// The beacon: a red beam sweeps round like a lighthouse's. Seen from the side, its
// length follows the cosine of its angle, so it shrinks into the lamp, flips to the
// other side and grows again; the lamp flares as the beam faces us.
function beacon(x, y) {
  const D = 8
  const curve = 'keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" keySplines="0.42 0 1 1;0 0 0.58 1;0.42 0 1 1;0 0 0.58 1"'
  return `<g transform="translate(${x} ${y})">
    <g><animateTransform attributeName="transform" type="scale" values="1 1;0 1;-1 1;0 1;1 1" ${curve} dur="${D}s" repeatCount="indefinite"/><path d="M0 -3 L720 -30 L720 70 L0 4 Z" fill="url(#df-beam)"/></g>
    <circle r="70" fill="url(#df-lamp)"><animate attributeName="opacity" values="0.35;1;0.35;0.1;0.35" ${curve} dur="${D}s" repeatCount="indefinite"/></circle>
    <circle r="3" fill="#ff7a52"/>
  </g>`
}

// A small torch: a warm point with a halo; some flicker.
const torch = (x, y, flick) =>
  `<g>${flick ? ao('1;0.7;0.95;0.8;1', 3 + flick, -flick, '0;0.4;0.55;0.7;1') : ''}<circle cx="${n0(x)}" cy="${n0(y)}" r="12" fill="url(#df-torch)"/><circle cx="${n0(x)}" cy="${n0(y)}" r="1.8" fill="#ffc47a"/></g>`

// The long bridge: from the wanderer's ledge across the misty gap to the gate.
// A heavy arched deck under a solid battlemented parapet, massive piers that sink
// into the mist, and lanterns on the parapet. The deck's top lands on the gate's
// sill and runs on into the gateway; the parapet stops at the gatehouse's face
// against an end block. The far end takes the same fog as the gatehouse.
const GATE_FACE = 952
function bridge() {
  const P0 = [418, 727]
  const P1 = [700, 640]
  const P2 = [980, 670] // the gate's sill
  const at_ = (t) => [
    (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
    (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
  ]
  // The curve's x rises with t, so bisection finds the deck's top at any x.
  const yAt = (x) => {
    let lo = 0
    let hi = 1
    for (let k = 0; k < 30; k++) {
      const m = (lo + hi) / 2
      if (at_(m)[0] < x) lo = m
      else hi = m
    }
    return at_((lo + hi) / 2)[1]
  }
  const DECK = 22
  const WALL = 9
  const MERLON = 7
  const q = (dy) => `${P0[0]} ${P0[1] + dy} Q${P1[0]} ${P1[1] + dy} ${P2[0]} ${P2[1] + dy}`
  const qBack = (dy) => `${P2[0]} ${P2[1] + dy} Q${P1[0]} ${P1[1] + dy} ${P0[0]} ${P0[1] + dy}`

  const body = (paint) => {
    const p = []
    p.push(`<path d="M${q(0)} L${qBack(DECK)} Z" fill="${paint}"/>`)
    // Parapet wall: one solid band on the deck, from the ledge to the gatehouse face.
    const xs = []
    for (let x = P0[0]; x < GATE_FACE; x += 6) xs.push(x)
    xs.push(GATE_FACE)
    const top = xs.map((x) => [x, yAt(x) - WALL])
    const foot = xs.map((x) => [x, yAt(x) + 1]).reverse()
    p.push(`<path d="${poly([...top, ...foot])} Z" fill="${paint}"/>`)
    // Merlons stand on the wall's top, each sheared to follow the deck's slope.
    const m = []
    for (let x = P0[0] + 4; x + 8 < GATE_FACE - 10; x += 15) {
      const ya = yAt(x) - WALL + 1
      const yb = yAt(x + 8) - WALL + 1
      m.push(`M${n1(x)} ${n1(ya)} L${n1(x + 8)} ${n1(yb)} L${n1(x + 8)} ${n1(yb - MERLON - 1)} L${n1(x)} ${n1(ya - MERLON - 1)} Z`)
    }
    p.push(`<path d="${m.join(' ')}" fill="${paint}"/>`)
    // End blocks: where the parapet meets the gatehouse, and at the ledge, where an
    // abutment seats the deck on the rock (the foreground ledge covers its foot).
    const ye = yAt(GATE_FACE)
    p.push(`<rect x="${GATE_FACE - 12}" y="${n1(ye - WALL - MERLON - 6)}" width="14" height="${n1(WALL + MERLON + 6)}" fill="${paint}"/>`)
    p.push(`<rect x="${P0[0] - 2}" y="${P0[1] - WALL - MERLON - 6}" width="14" height="${WALL + MERLON + 6}" fill="${paint}"/>`)
    p.push(`<path d="M${P0[0] - 14} ${P0[1] - 2} L${P0[0] - 24} 900 L${P0[0] + 34} 900 L${P0[0] + 26} ${P0[1] + DECK - 2} Z" fill="${paint}"/>`)
    // Piers, wider at the foot, and a deep arch rib between each pair.
    const piers = [0.14, 0.32, 0.5, 0.68, 0.86].map(at_)
    for (let i = 0; i < piers.length; i++) {
      const [px, py] = piers[i]
      p.push(`<path d="M${n0(px - 13)} ${n0(py + DECK - 2)} L${n0(px - 19)} 900 L${n0(px + 19)} 900 L${n0(px + 13)} ${n0(py + DECK - 2)} Z" fill="${paint}"/>`)
      if (i > 0) {
        const [qx, qy] = piers[i - 1]
        const mx = (px + qx) / 2
        const my = (py + qy) / 2 + DECK
        p.push(`<path d="M${n0(qx + 13)} ${n0(qy + DECK - 2)} Q${n0(mx)} ${n0(my + 2)} ${n0(px - 13)} ${n0(py + DECK - 2)} L${n0(px - 13)} ${n0(py + 58)} Q${n0(mx)} ${n0(my + 26)} ${n0(qx + 13)} ${n0(qy + 58)} Z" fill="${paint}"/>`)
      }
    }
    for (const t of LANTERNS) {
      const [lx] = at_(t)
      // The post stands on the wall's top, so it never hangs over a gap between merlons.
      const foot = yAt(lx) - WALL + 1
      p.push(`<line x1="${n0(lx)}" y1="${n0(foot)}" x2="${n0(lx)}" y2="${n0(foot - MERLON - 15)}" stroke="${paint}" stroke-width="2.4"/>`)
    }
    return p.join('')
  }

  // Moonlight on the parapet's top, drawn under the merlons so it shows in the gaps.
  const rimXs = []
  for (let x = P0[0]; x <= GATE_FACE - 12; x += 6) rimXs.push([x, yAt(x) - WALL])
  const c = '#07090d'
  // Nothing of the bridge shows past the gate's left jamb: the deck stops at the
  // doorway with its top on the sill, instead of a slab poking into the gatehouse.
  const parts = [
    `<clipPath id="df-bridge-clip"><rect x="0" y="0" width="958" height="${H}"/></clipPath><g clip-path="url(#df-bridge-clip)">`,
    `<path d="M${q(DECK)}" fill="none" stroke="${RIM}" stroke-opacity="0.12" stroke-width="1"/>`,
    body(c),
    `<path d="${poly(rimXs)}" fill="none" stroke="${RIM}" stroke-opacity="0.2" stroke-width="1"/>`,
    body('url(#df-bridge-fog)'),
    `</g>`,
  ]
  LANTERNS.forEach((t, i) => {
    const [lx] = at_(t)
    parts.push(torch(lx, yAt(lx) - WALL - MERLON - 16, i % 2 ? i : 0))
  })
  return parts.join('')
}
const LANTERNS = [0.08, 0.27, 0.46, 0.65, 0.84]

// ---------------------------------------------------------------- the cave

// A cave in the cliff under the castle, with a stone ledge in front of it. A knight
// sits by a campfire on the ledge. The stone is drawn with the cliff, under the fog;
// the fire, its light and the knight are drawn above the fog, so the fire cuts
// through the haze. The ledge sits above the shore rocks, which would hide it lower.
const CAVE = { x: 1250, floor: 672 }
// The camp sits on the cave's own floor, a little back and up from the ledge, so
// the threshold lip (drawn in front) covers the fire's stones and the knight's feet.
const FIRE = { x: 1234, y: 666 }
const CAVE_SHAPE = [[-53, 3], [-51, -12], [-46, -26], [-41, -34], [-36, -44], [-27, -50], [-20, -57], [-9, -58], [0, -63],
  [10, -58], [21, -60], [29, -50], [38, -44], [44, -32], [50, -22], [53, -9], [55, 3]]
const INNER_FLOOR = 667

function caveRock() {
  const { x, floor } = CAVE
  // A jagged rock mouth: [dx, dy from the floor] round the opening, left to right.
  const mouth = CAVE_SHAPE.map(([dx, dy]) => [x + dx, floor + dy])
  const stalactites = [[-20, -56, 5], [-4, -60, 7], [14, -58, 5], [32, -47, 4]]
    .map(([dx, dy, len]) => `<path d="M${x + dx - 2} ${floor + dy} L${x + dx} ${floor + dy + len} L${x + dx + 2} ${floor + dy} Z" fill="#050409"/>`)
    .join('')
  return `<path d="${poly(mouth)} Z" fill="url(#df-cave-in)"/>` +
    stalactites +
    `<path d="${poly(mouth)}" fill="none" stroke="#030308" stroke-width="3.5" stroke-linejoin="round"/>` +
    `<path d="${poly(mouth.slice(8))}" fill="none" stroke="${RIM}" stroke-opacity="0.3" stroke-width="1" stroke-linejoin="round"/>`
}

// The tunnel: the mouth shrunk toward a point deep inside, behind the camp, in two
// darker steps, so the cave goes on past the fire. Drawn above the fire's glow.
function caveTunnel() {
  const { x, floor } = CAVE
  // Behind the fire, so the flames stand out against the deep dark and the knight
  // keeps the fire-lit wall behind him.
  const vx = x - 20
  const vy = floor - 24
  const ring = (k) => poly(CAVE_SHAPE.map(([dx, dy]) => [vx + (x + dx - vx) * k, vy + (floor + dy - vy) * k]))
  return `<path d="${ring(0.56)} Z" fill="#100810" opacity="0.7"/><path d="${ring(0.32)} Z" fill="#030205" opacity="0.92"/>`
}

// The fire's flicker: one irregular loop shared by the glows, so they pulse together.
const FLICK = { v: '0.8;1;0.72;0.95;0.78;1;0.86;0.8', t: '0;0.12;0.26;0.41;0.55;0.7;0.86;1', d: 2.3 }

function campfire() {
  const { x, y } = FIRE
  const flame = (d, fill, dur, begin, sx) =>
    pivot(0, 0, at('scale', `1 1;${sx} 1.16;1.06 0.9;0.94 1.08;1 1`, dur, begin, '', true) + at('skewX', '0;-6;4;-3;0', dur * 1.3, begin, '', true, true),
      `<path d="${d}" fill="${fill}"/>`)
  const sparks = [0, 1, 2, 3, 4].map((i) => {
    const dur = 1.6 + (i % 3) * 0.4
    const dx = [-6, 4, -2, 7, -8][i]
    return `<g opacity="0">${at('translate', `0 -6;${dx} -46`, dur, -i * 0.47)}${ao('0;1;0.8;0', dur, -i * 0.47, '0;0.08;0.6;1')}<circle r="0.9" fill="#ffd27a"/></g>`
  }).join('')
  const smoke = `<g opacity="0">${at('translate', '0 -14;-10 -70', 5.5)}${ao('0;0.09;0', 5.5, 0, '0;0.3;1')}<ellipse rx="5" ry="10" fill="#8a80b8"/></g>`
  return `<g>${ao(FLICK.v, FLICK.d, 0, FLICK.t)}
      <circle cx="${x}" cy="${y - 6}" r="90" fill="url(#df-fire-glow)"/>
      <ellipse cx="${CAVE.x - 8}" cy="${CAVE.floor - 18}" rx="44" ry="30" fill="url(#df-fire-glow)" opacity="0.8"/>
    </g>
    ${caveTunnel()}
    <ellipse cx="${x + 8}" cy="${y}" rx="26" ry="2.6" fill="#ff9a50" opacity="0.22">${ao(FLICK.v, FLICK.d, 0, FLICK.t)}</ellipse>
    <g transform="translate(${x} ${y}) scale(1.1)">
      ${[[-7, 1], [-4, 2.4], [0, 2.8], [4, 2.4], [7, 1]].map(([sx, sy]) => `<ellipse cx="${sx}" cy="${sy}" rx="2.2" ry="1.4" fill="#141220"/>`).join('')}
      <line x1="-6" y1="1.5" x2="6" y2="-0.5" stroke="#1c120c" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="-6" y1="-0.5" x2="6" y2="1.5" stroke="#24160e" stroke-width="2.2" stroke-linecap="round"/>
      ${smoke}
      ${flame('M-5 0 Q-6 -6 -2 -10 Q-1 -14 0 -17 Q2 -12 4 -9 Q6 -5 5 0 Z', '#ff5a14', 0.62, 0, 0.9)}
      ${flame('M-3.5 0 Q-4 -5 -1 -8 Q0 -11 0.5 -13 Q2 -8 3 -6 Q4 -3 3.5 0 Z', '#ff9a2e', 0.47, -0.2, 0.92)}
      ${flame('M-2 0 Q-2.2 -3 -0.5 -5 Q0 -7 0.6 -8 Q1.5 -5 2 -3 Q2.3 -1 2 0 Z', '#ffe08a', 0.38, -0.1, 0.94)}
      ${sparks}
    </g>`
}

// A knight seated on a rock by the fire, facing it (to his left): great helm with a
// visor slit that glows with the fire, a dark plume, a pauldron, one forearm on his
// knee, a crimson cape, a sword planted beside him and a kite shield on the rock.
// His fire-facing edges catch the flicker.
function knight() {
  const steel = '#0d0d17'
  const fireLit = (d, w = 0.8) => `<path d="${d}" fill="none" stroke="#ffb060" stroke-width="${w}" stroke-linecap="round" opacity="0.75">${ao(FLICK.v, FLICK.d, 0, FLICK.t)}</path>`
  return `<g transform="translate(${CAVE.x + 13} ${INNER_FLOOR}) scale(1.1)">
    <path d="M8 0 L13 0 Q14.5 -7 10.5 -11 Q6.8 -7.5 8 0 Z" fill="#10101a"/>
    <path d="M10.5 -9 L10.5 -2 M8.8 -6.5 L12.2 -6.5" stroke="#6a1616" stroke-width="0.8"/>
    <path d="M-8 0 Q-9 -6 -3 -7 L6 -7 Q10 -5 9 0 Z" fill="#141322"/>
    <path d="M3 -20 Q8.5 -12 7.5 -1 L2 -1 Q4 -10 2 -19 Z" fill="#2c0b10"/>
    <path d="M2 -9 L-8 -11.5 Q-10.4 -11.6 -10.4 -9.4 L-11 -1.6 L-15 -0.4 L-15 0.8 L-8 0.8 L-7.4 -7.6 L1 -6 Z" fill="${steel}"/>
    <path d="M-4.2 -8 L4 -7 Q5.2 -14 3 -20 L-3 -21 Q-6.2 -15 -4.2 -8 Z" fill="${steel}"/>
    <ellipse cx="-1" cy="-19.2" rx="4.6" ry="2.6" fill="#11111d"/>
    <path d="M-2.2 -18 Q-6 -15 -8.4 -11.6" stroke="${steel}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M-3.6 -21 L-4.1 -27 Q-1 -30.6 3 -27.6 L3.6 -21 Z" fill="#0f0f1a"/>
    <path d="M1 -29 Q6 -31.5 9.5 -27 Q6 -28.6 2 -27.4 Z" fill="#4a0d12"/>
    <line x1="-4" y1="-25" x2="-0.6" y2="-25" stroke="#ff9a4a" stroke-width="0.7" opacity="0.85">${ao(FLICK.v, FLICK.d, 0, FLICK.t)}</line>
    <line x1="6.2" y1="1" x2="6.2" y2="-15" stroke="#1d1d2a" stroke-width="1.1"/>
    <line x1="6.4" y1="0" x2="6.4" y2="-12" stroke="${RIM}" stroke-width="0.4" stroke-opacity="0.5"/>
    <line x1="4" y1="-12.6" x2="8.4" y2="-12.6" stroke="#1d1d2a" stroke-width="1"/>
    <circle cx="6.2" cy="-15.6" r="0.9" fill="#1d1d2a"/>
    ${fireLit('M-4.1 -27 L-3.6 -21')}
    ${fireLit('M-3 -21 Q-6.2 -15 -4.2 -8')}
    ${fireLit('M-10.4 -9.4 L-11 -1.6 L-15 -0.4')}
    ${fireLit('M-8.4 -11.6 Q-6 -15 -4.6 -16.4', 0.6)}
  </g>`
}

// The threshold: a low rock lip across the cave mouth, drawn in front of the fire and
// the knight, so they read as inside. Coloured like the fogged ledge; the fire's
// glow lights its inner part.
function threshold() {
  const { x, floor } = CAVE
  const lip = [[-58, 20], [-53, -2], [-44, -6], [-31, -8], [-17, -10], [-4, -9], [9, -11], [22, -9], [36, -7], [47, -5], [56, -1], [60, 20]]
    .map(([dx, dy]) => [x + dx, floor + dy])
  const d = `${poly(lip)} Z`
  return `<path d="${d}" fill="url(#df-cave-lip)"/>` +
    `<path d="${poly(lip.slice(1, 8))}" fill="none" stroke="#ffae5a" stroke-opacity="0.55" stroke-width="1" stroke-linejoin="round">${ao(FLICK.v, FLICK.d, 0, FLICK.t)}</path>`
}

// ---------------------------------------------------------------- the sky

function bolt(rng, x0, y0, y1, drift) {
  const pts = [[x0, y0]]
  let x = x0
  let y = y0
  while (y < y1) {
    y += 18 + rng() * 26
    x += (rng() - 0.5) * 40 + drift
    pts.push([x, y])
  }
  const paths = [poly(pts)]
  for (let f = 0; f < 2; f++) {
    const start = pts[2 + Math.floor(rng() * Math.max(1, pts.length - 5))]
    let fx = start[0]
    let fy = start[1]
    const fp = [[fx, fy]]
    const dir = f === 0 ? -1 : 1
    for (let k = 0; k < 4; k++) {
      fy += 14 + rng() * 18
      fx += dir * (10 + rng() * 18)
      fp.push([fx, fy])
    }
    paths.push(poly(fp))
  }
  const layer = (w, op, color) =>
    paths.map((d) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-opacity="${op}" stroke-linejoin="round" stroke-linecap="round"/>`).join('')
  return layer(6, 0.3, '#c9dcff') + layer(2, 1, '#ffffff')
}

const STRIKE = { v: '0;0;1;0.12;0.95;0.35;0;0', t: '0;0.6;0.604;0.612;0.62;0.635;0.655;1' }
const FLASH = { v: '0;0;0.24;0.04;0.2;0;0', t: '0;0.6;0.604;0.612;0.62;0.655;1' }

// A fog strip of soft ellipses, drawn once and repeated with <use>, scrolling left.
function fogBand(rng, y, ry, count, dur, opacity) {
  const parts = []
  for (let i = 0; i < count; i++) {
    const x = (i + rng() * 0.6) * (W / count)
    const rx = 200 + rng() * 180
    parts.push(`<ellipse cx="${n0(x)}" cy="${n0(y + (rng() - 0.5) * ry)}" rx="${n0(rx)}" ry="${n0(ry * (0.7 + rng() * 0.6))}" fill="url(#df-fog-puff)"/>`)
  }
  const id = `df-fog-${n0(y)}`
  return `<g opacity="${opacity}"><g>${at('translate', `0 0;-${W} 0`, dur)}<g id="${id}">${parts.join('')}</g><use href="#${id}" x="${W}"/></g></g>`
}

// Clouds: two tiles of the same noise, each W + XFADE wide, W apart, scroll left by
// W and loop. Each tile fades in over its first XFADE units and out over its last,
// and the tiles start XFADE left of the screen, so the fade-in of the first tile is
// never on screen and the two tiles cross-fade where they meet. Two tiles that meet
// edge to edge leave a thin gap line that travels with the clouds.
// Keep the cost at two filtered tiles moved only by a transform. Heavier clouds (a
// two-screen sheet, a pattern, noise in a mask) cost up to half the frame rate,
// and when the GPU process fails the app stops all backdrop animation.
const XFADE = 120
const TILE = W + XFADE
function cloudLayer(kind, dur) {
  const tile = (x) => `<g transform="translate(${x} 0)"><rect width="${TILE}" height="470" filter="url(#df-clouds-${kind})" mask="url(#df-cloud-xfade-mask)"/></g>`
  return `<g mask="url(#df-cloud-mask)"><g>${at('translate', `0 0;-${W} 0`, dur)}${tile(-XFADE)}${tile(W - XFADE)}</g></g>`
}

// ---------------------------------------------------------------- the foreground

function deadTree(rng) {
  const grow = (x0, y0, ang, len, w, depth) => {
    const bend = (rng() - 0.5) * 0.8
    const x1 = x0 + Math.sin(ang) * len
    const y1 = y0 - Math.cos(ang) * len
    const mx = x0 + Math.sin(ang + bend) * len * 0.55
    const my = y0 - Math.cos(ang + bend) * len * 0.55
    const seg = `<path d="M${n0(x0)} ${n0(y0)} Q${n0(mx)} ${n0(my)} ${n0(x1)} ${n0(y1)}" stroke-width="${n1(w)}"/>`
    if (depth === 0 || w < 0.7) return seg
    const kids = depth > 4 ? 2 : rng() < 0.6 ? 2 : 3
    let inner = ''
    for (let k = 0; k < kids; k++) {
      const a = ang + (k - (kids - 1) / 2) * (0.5 + rng() * 0.35) + (rng() - 0.5) * 0.3
      inner += grow(x1, y1, a, len * (0.62 + rng() * 0.16), w * 0.64, depth - 1)
    }
    const X = n0(x1)
    const Y = n0(y1)
    if (depth === 4) {
      return `${seg}<g>${at('rotate', `0 ${X} ${Y};-3.5 ${X} ${Y};1 ${X} ${Y};0 ${X} ${Y}`, 4.4, -rng() * 4, '0;0.45;0.75;1', true)}${inner}</g>`
    }
    if (depth === 2 && rng() < 0.45) {
      return `${seg}<g>${at('rotate', `0 ${X} ${Y};-6 ${X} ${Y};0 ${X} ${Y}`, 2.1, -rng() * 2, '', true)}${inner}</g>`
    }
    return seg + inner
  }
  const sway = at('rotate', '0 64 930;-1.4 64 930;0.3 64 930;0 64 930', 7, 0, '0;0.4;0.7;1', true)
  return `<g fill="none" stroke="#04060a" stroke-linecap="round">${sway}${grow(64, 930, 0.2, 280, 30, 6)}</g>`
}

function wanderer() {
  const flutter = (dur, begin, skew, stretch) =>
    at('skewY', skew, dur, begin, '', true) + at('scale', stretch, dur, begin, '', true, true)
  const capeA = pivot(-6, -33, flutter(1.1, 0, '0;-8;3;-5;0', '1 1;1.14 1;0.94 1;1.08 1;1 1'),
    '<path d="M-6 -33 Q-28 -31 -50 -18 Q-38 -16 -30 -11 Q-42 -7 -54 -1 Q-32 -1 -12 -2 Z" fill="#04060a"/>')
  const capeB = pivot(-7, -20, flutter(0.8, -0.3, '0;-9;0', '1 1;1.18 1;1 1'),
    '<path d="M-7 -20 Q-26 -14 -42 -3 Q-26 -4 -12 0 Z" fill="#05070b"/>')
  return `<g transform="translate(336 726) scale(1.5)">
    ${capeA}${capeB}
    <path d="M-12 0 Q-10 -18 -9 -30 Q-8 -40 -4 -47 L-7 -56 Q2 -55 6 -46 Q9 -40 8 -32 Q9 -16 12 0 Z" fill="#04060a"/>
    <path d="M0.8 -53 Q4 -50.5 6 -46 Q9 -40 8 -32 Q9 -16 12 0" fill="none" stroke="${RIM}" stroke-opacity="0.38" stroke-width="1.1"/>
    <line x1="15" y1="2" x2="19" y2="-58" stroke="#04060a" stroke-width="2.4" stroke-linecap="round"/>
    <g>
      <circle cx="19" cy="-61" r="17" fill="url(#df-lantern)">${ao('1;0.8;0.95;0.85;1', 5, 0, '0;0.4;0.55;0.7;1')}</circle>
      <circle cx="19" cy="-61" r="4" fill="#ffd08a"/>
      <circle cx="18" cy="-62" r="1.4" fill="#fff3d6"/>
    </g>
  </g>`
}

function ravens() {
  const one = (x, y, s, d, l) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><g>${at('translate', '0 0;70 -18;140 4;60 22;0 0', d, l, '', true)}<path d="M-12 0 Q-6 -7 0 -1 Q6 -7 12 0 Q6 -3 0 2 Q-6 -3 -12 0 Z" fill="#05070a">${at('scale', '1 1;1 -0.4;1 1', 0.9, l / 7, '', true)}</path></g></g>`
  return [one(1060, 250, 1.3, 18, -2), one(1120, 130, 1.1, 22, -9), one(960, 190, 0.9, 26, -14), one(1380, 300, 1, 20, -5)].join('')
}

function embers(rng) {
  return Array.from({ length: 6 }, () => {
    const x = n0(220 + rng() * 1360)
    const y = n0(860 + rng() * 60)
    const r = 0.9 + rng() * 1.4
    const d = 10 + rng() * 8
    const l = -rng() * 18
    const dx = rng() < 0.5 ? -90 : -160
    return `<g transform="translate(${x} ${y})"><g>${at('translate', `0 0;${dx} -560`, d, l)}${ao('0;0.9;0.55;0', d, l, '0;0.12;0.8;1')}<circle r="${n1(r * 4)}" fill="url(#df-ember-glow)"/><circle r="${n1(r)}" fill="#ff9a5a"/></g></g>`
  }).join('')
}

function gusts(rng) {
  return Array.from({ length: 3 }, () => {
    const x = n0(200 + rng() * 1300)
    const y = n0(500 + rng() * 240)
    const len = n0(80 + rng() * 120)
    const d = 2.6 + rng() * 2
    const l = -rng() * 5
    return `<g opacity="0">${at('translate', '240 0;-420 0', d, l)}${ao('0;0.16;0.16;0', d, l, '0;0.15;0.8;1')}<line x1="${x}" y1="${y}" x2="${x + len}" y2="${y - 4}" stroke="#c9d6e0" stroke-width="1.2" stroke-linecap="round"/></g>`
  }).join('')
}

// ---------------------------------------------------------------- the sea

function seaRows() {
  const rows = [
    { y: SEA + 24, a: 2, wl: 34, op: 0.26, w: 1.1, dur: 2.8 },
    { y: SEA + 42, a: 2.6, wl: 44, op: 0.3, w: 1.3, dur: 3.3 },
    { y: SEA + 66, a: 3.4, wl: 58, op: 0.32, w: 1.5, dur: 3.9 },
    { y: SEA + 98, a: 4.4, wl: 76, op: 0.3, w: 1.8, dur: 4.6 },
  ]
  return rows
    .map((r) => {
      const half = r.wl / 2
      let d = `M880 ${r.y} q${half / 2} ${-r.a} ${half} 0`
      for (let x = 880 + half; x < W + r.wl * 2; x += half) d += ` t${half} 0`
      return `<path d="${d}" fill="none" stroke="#86a6b8" stroke-opacity="${r.op}" stroke-width="${r.w}" stroke-linecap="round">${at('translate', `0 0;-${r.wl} 0`, r.dur)}</path>`
    })
    .join('')
}

// A wave breaking on rock. Local frame: the rock face at x=0, the waterline at y=0,
// open sea to the right, scaled by s. One cycle of D seconds: a moonlit swell rolls
// in, rises, curls and slams into the rock; jets of white water fan up the face;
// droplets fly and blow left; whitewater spreads back out; a thin mist drifts off.
// `keep` draws only the first droplets while the random stream still advances
// through all of them, so what comes later keeps its shape.
function crash(rng, x, y, s, D, delay, nParticles, nJets, keep = nParticles) {
  const T = (v) => v.toFixed(3)
  const place = (inner) => `<g transform="translate(${n0(x)} ${n0(y)}) scale(${s})">${inner}</g>`
  const smil = (attr, values, kt) =>
    `<animate attributeName="${attr}" values="${values}" keyTimes="${kt}" dur="${D}s" begin="${n1(delay)}s" repeatCount="indefinite"/>`
  const move = (type, values, kt) =>
    `<animateTransform attributeName="transform" type="${type}" values="${values}" keyTimes="${kt}" dur="${D}s" begin="${n1(delay)}s" repeatCount="indefinite"/>`

  const wp = (fx, h, cx, lx, ly, bx) =>
    `M${fx} 0 C${fx} ${n0(-h * 0.3)} ${cx - 24} ${-h} ${cx} ${-h} C${cx - 12} ${-h} ${lx + 8} ${ly - 10} ${lx} ${ly} C${lx + 12} ${ly + 8} ${cx + 4} ${n0(-h * 0.6)} ${cx + 18} ${n0(-h * 0.55)} C${cx + 70} ${n0(-h * 0.4)} ${bx - 90} -6 ${bx} 0 Z`
  const lp = (fx, h, cx, lx, ly) =>
    `M${cx + 36} ${n0(-h * 0.7)} C${cx + 16} ${n0(-h * 0.95)} ${cx + 6} ${-h} ${cx} ${-h} C${cx - 12} ${-h} ${lx + 8} ${ly - 10} ${lx} ${ly}`
  const shapes = [
    [50, 18, 96, 74, -12, 320],
    [36, 52, 76, 52, -36, 296],
    [30, 92, 62, 24, -66, 270],
    [26, 120, 48, -8, -82, 252],
    [0, 38, 14, -10, -26, 230],
  ]
  const seq = [...shapes, shapes[4]]
  const kt = '0;0.2;0.36;0.45;0.5;1'
  const swell = `<g opacity="0">
      ${smil('opacity', '0;1;1;1;0;0', '0;0.08;0.3;0.47;0.53;1')}
      ${move('translate', '300 0;150 0;54 0;12 0;0 0;0 0', kt)}
      <ellipse cx="120" cy="6" rx="170" ry="10" fill="#02060a" opacity="0.55"/>
      <path d="${wp(...shapes[0])}" fill="url(#df-wave)">${smil('d', seq.map((p) => wp(...p)).join(';'), kt)}</path>
      <path d="${wp(...shapes[0])}" fill="url(#df-wave-face)">${smil('d', seq.map((p) => wp(...p)).join(';'), kt)}</path>
      <path d="${lp(...shapes[0])}" fill="none" stroke="#f2f7fa" stroke-width="4.5" stroke-linecap="round" stroke-opacity="0.95">${smil('d', seq.map((p) => lp(...p)).join(';'), kt)}</path>
    </g>`

  const jets = Array.from({ length: nJets }, (_, j) => {
    const a = -20 + (j / Math.max(1, nJets - 1)) * 30 + (rng() - 0.5) * 8
    const h = 140 + rng() * 110
    const w = 9 + rng() * 8
    const t0 = 0.46 + rng() * 0.03
    return `<g transform="translate(${n0(j * 7)} 0) rotate(${n1(a)})"><g opacity="0">
      ${smil('opacity', '0;0;1;0.8;0;0', `0;${T(t0)};${T(t0 + 0.025)};${T(t0 + 0.14)};${T(t0 + 0.26)};1`)}
      ${move('scale', `1 0;1 0;1 1;1.2 1.12;1.3 1.18;1.3 1.18`, `0;${T(t0)};${T(t0 + 0.07)};${T(t0 + 0.16)};${T(t0 + 0.26)};1`)}
      <path d="M${n1(-w)} 0 Q${n1(-w * 1.1)} ${n0(-h * 0.3)} ${n1(-w * 0.55)} ${n0(-h * 0.5)} Q${n1(-w * 0.8)} ${n0(-h * 0.78)} 0 ${n0(-h)} Q${n1(w * 0.7)} ${n0(-h * 0.72)} ${n1(w * 0.5)} ${n0(-h * 0.46)} Q${n1(w * 1.05)} ${n0(-h * 0.24)} ${n1(w)} 0 Z" fill="url(#df-jet)"/>
    </g></g>`
  }).join('')

  const us = [0, 0.2, 0.4, 0.6, 0.8, 1]
  const spray = Array.from({ length: nParticles }, () => {
    const launch = 0.46 + rng() * 0.06
    const end = Math.min(0.97, launch + 0.28 + rng() * 0.18)
    const hp = 100 + rng() * 220
    const dx = (rng() - 0.3) * 150
    const r = rng() < 0.15 ? 3.5 + rng() * 3 : 1.4 + rng() * 2.2
    const pts = us.map((u) => `${n0(dx * u - 70 * u * u)} ${n0(-4 * hp * u * (1 - u) + 60 * u * u)}`)
    const kts = us.map((u) => T(launch + (end - launch) * u))
    const fade = `0;${T(launch)};${T(launch + 0.015)};${T(launch + (end - launch) * 0.7)};${T(end)};1`
    return `<g transform="translate(${n0(rng() * 40)} ${n0(-rng() * 20)})"><g opacity="0">${smil('opacity', '0;0;1;0.9;0;0', fade)}${move('translate', `0 0;${pts.join(';')};${pts[5]}`, `0;${kts.join(';')};1`)}<circle r="${n1(r)}" fill="#f2f7fa"/></g></g>`
  }).slice(0, keep).join('')

  const foam = `<g opacity="0">
      ${smil('opacity', '0;0;0.95;0.6;0', '0;0.48;0.56;0.8;1')}
      ${move('translate', '0 0;0 0;40 2;130 6', '0;0.5;0.7;1')}
      <ellipse cx="20" cy="-8" rx="44" ry="20" fill="url(#df-spray-g)"/>
      <ellipse cx="60" cy="-2" rx="50" ry="12" fill="url(#df-spray-g)"/>
      <ellipse cx="108" cy="3" rx="58" ry="9" fill="url(#df-spray-g)"/>
      <ellipse cx="40" cy="6" rx="70" ry="6" fill="url(#df-spray-g)"/>
    </g>`
  const mist = `<g opacity="0">
      ${smil('opacity', '0;0;0.3;0', '0;0.52;0.66;1')}
      ${move('translate', '0 0;0 0;-150 -80', '0;0.52;1')}
      <ellipse cx="10" cy="-130" rx="100" ry="76" fill="url(#df-spray-g)"/>
    </g>`
  const dome = `<g opacity="0">${smil('opacity', '0;0;0.95;0.5;0', '0;0.46;0.5;0.68;1')}${pivot(20, 0, move('scale', '0.4 0.2;0.4 0.2;1 1;1.4 1.3;1.5 1.4', '0;0.46;0.53;0.7;1'), '<ellipse cx="20" cy="-34" rx="46" ry="38" fill="url(#df-spray-g)"/>')}</g>`
  const rest = `<ellipse cx="24" cy="2" rx="44" ry="5" fill="url(#df-spray-g)">${smil('opacity', '0.3;0.3;0.95;0.3', '0;0.47;0.56;1')}</ellipse>`
  return place(rest + swell + mist + dome + jets + spray + foam)
}

// Jagged rocks heaped round the cliff's foot at the water, lit on their right faces.
function shoreRocks() {
  const rr = mulberry32(9001)
  const spots = []
  for (let i = 0; i < 10; i++) spots.push([952 + i * 56 + (rr() - 0.5) * 24, SEA + 4 + rr() * 8, 30 + rr() * 38])
  for (let i = 0; i < 5; i++) spots.push([970 + rr() * 520, SEA + 16 + rr() * 44, 10 + rr() * 22])
  spots.sort((a, b) => a[1] - b[1])
  const out = []
  spots.forEach(([cx, by, size], j) => {
    const n = 5 + Math.floor(rr() * 3)
    const pts = [[cx - size * (0.9 + rr() * 0.3), by]]
    for (let k = 1; k < n; k++) {
      const t = k / n
      const x = cx - size + 2 * size * t + (rr() - 0.5) * size * 0.35
      const y = by - size * (0.5 + rr() * 0.9) * (0.3 + 0.7 * Math.sin(Math.PI * t))
      pts.push([x, y])
    }
    pts.push([cx + size * (0.9 + rr() * 0.3), by])
    out.push(`<path d="${poly(pts)} Z" fill="url(#df-rock)"/>`)
    out.push(`<path d="${poly(pts.slice(Math.floor(n / 2)))}" fill="none" stroke="${RIM}" stroke-opacity="0.24" stroke-width="1"/>`)
    const foam = `<ellipse cx="${n0(cx)}" cy="${n0(by)}" rx="${n0(size * 1.15)}" ry="3" fill="url(#df-spray-g)" opacity="0.3"`
    out.push(j % 3 === 0 ? `${foam}>${ao('0.2;0.55;0.2', 3.2, -rr() * 3)}</ellipse>` : `${foam}/>`)
  })
  return out.join('')
}

function sea(rng, waterX) {
  const water = `<path d="M880 ${SEA + 2} L${W} ${SEA - 6} L${W} ${H} L880 ${H} Z" fill="url(#df-sea)"/>`
  const edge = `<path d="M880 ${SEA + 2} L${W} ${SEA - 6}" stroke="#b3add6" stroke-opacity="0.28" stroke-width="1.3"/>`
  const shimmer = Array.from({ length: 8 }, (_, i) => {
    const y = SEA + 8 + i * 11 + rng() * 6
    const half = 10 + rng() * 26 + i * 3
    const x = MOON.x + (rng() - 0.5) * 30
    return `<line x1="${n0(x - half)}" y1="${n0(y)}" x2="${n0(x + half)}" y2="${n0(y)}" stroke="#cfe0ea" stroke-width="1.6" stroke-linecap="round" opacity="0.12">${ao('0.12;0.5;0.12', 2.6, -rng() * 3)}</line>`
  }).join('')
  const hero = crash(rng, waterX, SEA, 1, 6, 0, 40, 6, 14)
  crash(rng, 1376, 850, 0.55, 5.2, -2.6, 10, 4) // advances the stream as the old sea-rock wave did
  return `<g mask="url(#df-sea-mask)">${water}${edge}${seaRows()}${shimmer}</g>${shoreRocks()}${hero}`
}

// ---------------------------------------------------------------- the scene

// The near hills' moonlit rim stops where they run in front of the cliff's foot
// (x 930); past it the rim read as a stray line across the rock.
const NEAR_RIM_END = Math.floor(930 / (W / N)) + 1

export function buildScene(opts = {}) {
  const extras = opts.extras !== false
  const rng = mulberry32(4041)

  const far = ridge(rng, 600, 260, 0.56, [{ x: 520, h: 130, w: 140 }, { x: 860, h: 60, w: 120 }, { x: 1560, h: 50, w: 100 }])
  const mid = ridge(rng, 650, 240, 0.58, [{ x: 260, h: 90, w: 130 }, { x: 700, h: 70, w: 100 }, { x: 1500, h: 80, w: 120 }])
  const near = ridge(rng, 780, 170, 0.6, [{ x: 120, h: 50, w: 160 }, { x: 900, h: 40, w: 140 }]).map((y, i) => {
    const t = smooth(940, 1120, XS[i])
    return y + (SEA + 14 - y) * t
  })
  burn(rng, 306) // the old crag and foundation's draws
  const rock = spur()

  const stars = Array.from({ length: 34 }, () => {
    const x = n0(rng() * W)
    const y = n0(rng() * 260)
    return `<circle cx="${x}" cy="${y}" r="${n1(0.5 + rng() * 0.9)}" fill="#dfe8ee" opacity="${n1(0.25 + rng() * 0.5)}"/>`
  }).slice(0, 20).join('')

  const sky = `
  <rect width="${W}" height="${H}" fill="url(#df-sky)"/>
  ${stars}
  <circle cx="${MOON.x}" cy="${MOON.y}" r="460" fill="url(#df-halo-wide)"/>
  ${cloudLayer('light', 200)}
  <circle cx="${MOON.x}" cy="${MOON.y}" r="150" fill="url(#df-halo-near)"/>
  <circle cx="${MOON.x}" cy="${MOON.y}" r="${MOON.r}" fill="#ecebfb"/>
  <rect x="${MOON.x - MOON.r}" y="${MOON.y - MOON.r}" width="${MOON.r * 2}" height="${MOON.r * 2}" filter="url(#df-moon-tex)" clip-path="url(#df-moon-clip)"/>
  <circle cx="${MOON.x}" cy="${MOON.y}" r="${MOON.r}" fill="url(#df-moon-limb)"/>
  ${cloudLayer('dark', 130)}
  <rect width="${W}" height="620" fill="#b8ccf2" opacity="0">${ao(FLASH.v, 13, 0, FLASH.t)}</rect>
  <rect width="${W}" height="620" fill="#b8ccf2" opacity="0">${ao(FLASH.v, 19, -7, FLASH.t)}</rect>
  <g opacity="0">${ao(STRIKE.v, 13, 0, STRIKE.t)}${bolt(rng, 560, 40, 470, 2)}</g>
  <g opacity="0">${ao(STRIKE.v, 19, -7, STRIKE.t)}${bolt(rng, 1470, 20, 440, -3)}</g>`

  const land = `
  <g>
    <path d="${fillPath(far)}" fill="url(#df-far)"/>
  </g>
  <rect x="0" y="380" width="${W}" height="280" fill="url(#df-fog)"/>
  ${extras ? fogBand(rng, 530, 40, 8, 110, 0.9) : ''}
  <g>
    <path d="${fillPath(mid)}" fill="url(#df-mid)"/>
    <path d="${linePath(mid)}" fill="none" stroke="#b3add6" stroke-opacity="0.2" stroke-width="1.4"/>
  </g>
  <rect x="0" y="480" width="${W}" height="260" fill="url(#df-fog)"/>
  <circle cx="1290" cy="380" r="320" fill="url(#df-red-aura)"/>
  <g>
    <path d="${rock.body}" fill="url(#df-cliff)"/>
    ${rock.marks}
    ${caveRock()}
    <path d="${rock.rim}" fill="none" stroke="#b3add6" stroke-opacity="0.32" stroke-width="1.6"/>
  </g>
  <g>${fortress()}</g>
  <g>${rock.teeth}</g>
  ${beacon(988, 488)}
  <ellipse cx="1290" cy="546" rx="220" ry="30" fill="url(#df-red-fog)"/>
  <rect x="0" y="600" width="${W}" height="160" fill="url(#df-fog)" opacity="0.7"/>
  ${campfire()}
  ${knight()}
  ${threshold()}
  ${extras ? fogBand(rng, 650, 46, 7, 70, 0.9) : ''}
  <g>
    <path d="${fillPath(near)}" fill="url(#df-near)"/>
    <path d="${linePath(near.slice(0, NEAR_RIM_END))}" fill="none" stroke="#b3add6" stroke-opacity="0.14" stroke-width="1.2"/>
  </g>
  <g>${bridge()}</g>
  ${extras ? sea(rng, rock.waterX) : `<path d="M880 ${SEA + 2} L${W} ${SEA - 6} L${W} ${H} L880 ${H} Z" fill="url(#df-sea)" mask="url(#df-sea-mask)"/>`}`

  const fore = extras
    ? `
  ${fogBand(rng, 862, 34, 7, 42, 0.55)}
  <g>
    <path d="M0 900 L0 742 L70 734 L140 738 L210 729 L280 724 L350 726 L400 733 L452 742 L480 790 L530 850 L560 900 Z" fill="#06080c"/>
    <path d="M0 742 L70 734 L140 738 L210 729 L280 724 L350 726 L400 733 L452 742" fill="none" stroke="#b3add6" stroke-opacity="0.18" stroke-width="1.2"/>
  </g>
  ${deadTree(rng)}
  ${wanderer()}
  <g>${ravens()}</g>
  <g>
    <g>${at('translate', '160 0;-200 0;160 0', 180, 0, '', true)}<ellipse cx="${MOON.x - 40}" cy="${MOON.y + 24}" rx="300" ry="14" fill="url(#df-wisp)"/></g>
    <g>${at('translate', '160 0;-200 0;160 0', 180, -40, '', true)}<ellipse cx="${MOON.x + 120}" cy="${MOON.y - 30}" rx="240" ry="10" fill="url(#df-wisp)"/></g>
    <g>${at('translate', '160 0;-200 0;160 0', 180, -70, '', true)}<ellipse cx="${MOON.x - 260}" cy="${MOON.y + 70}" rx="320" ry="16" fill="url(#df-wisp)"/></g>
  </g>
  <g>${gusts(rng)}</g>
  <g>${embers(rng)}</g>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <symbol id="c-tri" viewBox="0 0 10 10" preserveAspectRatio="none"><polygon points="0,10 5,0 10,10" fill="currentColor"/></symbol>
    <symbol id="c-crenel" viewBox="0 0 13 3" preserveAspectRatio="none"><path d="M0 0h2v3H0zM3.7 0h2v3h-2zM7.4 0h2v3h-2zM11 0h2v3h-2z" fill="currentColor"/></symbol>
    <symbol id="c-turret" viewBox="0 0 10 30" preserveAspectRatio="none"><path d="M5 0L10 11H8.5V24L5 30L1.5 24V11H0Z" fill="currentColor"/></symbol>
    <symbol id="c-win" viewBox="0 0 3 7" preserveAspectRatio="none"><path d="M0 7V1.5Q1.5 0 3 1.5V7Z" fill="#ff7a3a"/></symbol>
    <linearGradient id="df-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#06061c"/>
      <stop offset="0.4" stop-color="#151640"/>
      <stop offset="0.7" stop-color="#2f2160"/>
      <stop offset="1" stop-color="#4e3474"/>
    </linearGradient>
    <radialGradient id="df-halo-wide">
      <stop offset="0" stop-color="#cbc4f2" stop-opacity="0.32"/>
      <stop offset="0.3" stop-color="#8b7cc4" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#4a3d82" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="df-halo-near">
      <stop offset="0.4" stop-color="#eee9ff" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#eee9ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="df-moon-limb">
      <stop offset="0.62" stop-color="#7f939d" stop-opacity="0"/>
      <stop offset="1" stop-color="#7f939d" stop-opacity="0.55"/>
    </radialGradient>
    <clipPath id="df-moon-clip"><circle cx="${MOON.x}" cy="${MOON.y}" r="${MOON.r}"/></clipPath>
    <linearGradient id="df-cloud-fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.85"/>
      <stop offset="0.6" stop-color="#fff" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="df-cloud-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="470">
      <rect width="${W}" height="470" fill="url(#df-cloud-fade)"/>
    </mask>
    <!-- One screen of stitched noise per cloud layer, repeated by a pattern. sRGB, not
         the default linearRGB, which keeps too few dark levels and shows contour rings;
         the colours are the old linearRGB ones converted, so the clouds look the same.
         The alpha stretch is gentle (2.2, not 3+) and a fine noise dithers it: a steep
         stretch turns the noise's 8-bit steps into visible contour rings. -->
    <filter id="df-clouds-light" filterUnits="userSpaceOnUse" x="0" y="0" width="${TILE}" height="470" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.0016 0.0062" numOctaves="3" seed="11" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.70  0 0 0 0 0.66  0 0 0 0 0.88  2.2 0 0 0 -0.92" result="c"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="5" result="d"/>
      <feComposite in="c" in2="d" operator="arithmetic" k1="0" k2="1" k3="0.05" k4="-0.025"/>
    </filter>
    <filter id="df-clouds-dark" filterUnits="userSpaceOnUse" x="0" y="0" width="${TILE}" height="470" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.0022 0.008" numOctaves="3" seed="29" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.13  0 0 0 0 0.30  2.2 0 0 0 -0.88" result="c"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="6" result="d"/>
      <feComposite in="c" in2="d" operator="arithmetic" k1="0" k2="1" k3="0.05" k4="-0.025"/>
    </filter>
    <linearGradient id="df-cloud-xfade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${TILE}" y2="0">
      <stop offset="0" stop-color="#000"/>
      <stop offset="${(XFADE / TILE).toFixed(4)}" stop-color="#fff"/>
      <stop offset="${(W / TILE).toFixed(4)}" stop-color="#fff"/>
      <stop offset="1" stop-color="#000"/>
    </linearGradient>
    <mask id="df-cloud-xfade-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${TILE}" height="470">
      <rect width="${TILE}" height="470" fill="url(#df-cloud-xfade)"/>
    </mask>
    <filter id="df-moon-tex" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="3"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.47  0 0 0 0 0.52  1.8 0 0 0 -0.62"/>
    </filter>
    <linearGradient id="df-far" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#252848"/>
      <stop offset="0.7" stop-color="#312f5a"/>
      <stop offset="1" stop-color="#463e70"/>
    </linearGradient>
    <linearGradient id="df-mid" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#141632"/>
      <stop offset="0.7" stop-color="#1c1d3e"/>
      <stop offset="1" stop-color="#2c2a52"/>
    </linearGradient>
    <linearGradient id="df-cliff" gradientUnits="userSpaceOnUse" x1="930" y1="534" x2="1512" y2="644">
      <stop offset="0" stop-color="#08080f"/>
      <stop offset="0.55" stop-color="#121124"/>
      <stop offset="1" stop-color="#2a2744"/>
    </linearGradient>
    <linearGradient id="df-stone" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#08080f"/>
      <stop offset="0.7" stop-color="#0f0f1a"/>
      <stop offset="1" stop-color="#1f1c32"/>
    </linearGradient>
    <linearGradient id="df-near" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#090d12"/>
      <stop offset="1" stop-color="#121a22"/>
    </linearGradient>
    <linearGradient id="df-fog" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#564c86" stop-opacity="0"/>
      <stop offset="1" stop-color="#564c86" stop-opacity="0.5"/>
    </linearGradient>
    <linearGradient id="df-bridge-fog" gradientUnits="userSpaceOnUse" x1="600" y1="0" x2="${GATE_FACE}" y2="0">
      <stop offset="0" stop-color="#564c86" stop-opacity="0"/>
      <stop offset="1" stop-color="#564c86" stop-opacity="0.5"/>
    </linearGradient>
    <radialGradient id="df-fog-puff">
      <stop offset="0" stop-color="#8a80b8" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#8a80b8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="df-wisp">
      <stop offset="0" stop-color="#ded6f6" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ded6f6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="df-win-halo">
      <stop offset="0" stop-color="#ff5a24" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#ff5a24" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="df-eye-halo">
      <stop offset="0" stop-color="#ff3a1a" stop-opacity="0.65"/>
      <stop offset="0.4" stop-color="#c2200f" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#c2200f" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="df-red-aura">
      <stop offset="0" stop-color="#8a1a12" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#8a1a12" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="df-red-fog">
      <stop offset="0" stop-color="#b02a1c" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#b02a1c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="df-lantern">
      <stop offset="0" stop-color="#ffcf88" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#ffcf88" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="df-ember-glow">
      <stop offset="0" stop-color="#ff6a32" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#ff6a32" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="df-cave-lip" gradientUnits="userSpaceOnUse" x1="0" y1="${CAVE.floor - 10}" x2="0" y2="${CAVE.floor + 20}">
      <stop offset="0.45" stop-color="#120f1c"/>
      <stop offset="1" stop-color="#120f1c" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="df-fire-glow">
      <stop offset="0" stop-color="#ff8a3a" stop-opacity="0.55"/>
      <stop offset="0.35" stop-color="#ff6a24" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#ff6a24" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="df-cave-in" gradientUnits="userSpaceOnUse" cx="${FIRE.x + 4}" cy="${CAVE.floor - 4}" r="62">
      <stop offset="0" stop-color="#3c1a0c"/>
      <stop offset="0.45" stop-color="#140a0e"/>
      <stop offset="1" stop-color="#050409"/>
    </radialGradient>
    <radialGradient id="df-torch">
      <stop offset="0" stop-color="#ffb25c" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#ffb25c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="df-gate" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a0d08" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#b8321c" stop-opacity="0.55"/>
    </linearGradient>
    <linearGradient id="df-beam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ff4a28" stop-opacity="0.5"/>
      <stop offset="0.3" stop-color="#ff4a28" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#ff4a28" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="df-lamp">
      <stop offset="0" stop-color="#ff5a30" stop-opacity="0.85"/>
      <stop offset="0.25" stop-color="#ff3a1e" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#ff3a1e" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="df-rock" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#05080c"/>
      <stop offset="0.6" stop-color="#0d141b"/>
      <stop offset="1" stop-color="#24323e"/>
    </linearGradient>
    <linearGradient id="df-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#22404f"/>
      <stop offset="0.25" stop-color="#132a36"/>
      <stop offset="1" stop-color="#04090e"/>
    </linearGradient>
    <linearGradient id="df-sea-fade" gradientUnits="userSpaceOnUse" x1="880" y1="0" x2="1100" y2="0">
      <stop offset="0" stop-color="#000"/>
      <stop offset="1" stop-color="#fff"/>
    </linearGradient>
    <mask id="df-sea-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="url(#df-sea-fade)"/>
    </mask>
    <linearGradient id="df-wave" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7aa2b3"/>
      <stop offset="0.45" stop-color="#36606f"/>
      <stop offset="1" stop-color="#132d3c"/>
    </linearGradient>
    <linearGradient id="df-wave-face" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e8f1f5" stop-opacity="0.45"/>
      <stop offset="0.35" stop-color="#e8f1f5" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#e8f1f5" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="df-jet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6fafc" stop-opacity="0.95"/>
      <stop offset="0.6" stop-color="#f6fafc" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#f6fafc" stop-opacity="0.5"/>
    </linearGradient>
    <radialGradient id="df-spray-g">
      <stop offset="0" stop-color="#f2f7fa" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#f2f7fa" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="df-vignette" cx="0.5" cy="0.5" r="0.78">
      <stop offset="0.5" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.75"/>
    </radialGradient>
    <linearGradient id="df-base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.4"/>
    </linearGradient>
  </defs>
  ${sky}
  ${land}
  ${fore}
  <rect width="${W}" height="${H}" fill="url(#df-base)"/>
  <rect width="${W}" height="${H}" fill="url(#df-vignette)"/>
</svg>`
}
