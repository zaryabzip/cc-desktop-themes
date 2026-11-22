import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { buildScene } from './scene.js'

// Cyberpunk 2077 inspired. Dark only: deep navy surfaces, cool white text, a neon cyan accent.
const { theme, problems } = makeColors({
  label: 'Cyberpunk 2077',
  only: 'dark',
  roles: { accent: '#3ad7e6', danger: '#ff5c7a', success: '#5ee6a8', warning: '#f5d547', pro: '#c87cff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0b0d14',
        'surface-1': '#11141d',
        'surface-2': '#171b26',
        'surface-3': '#1b2030',
        'text-primary': '#e8eef6',
        'text-secondary': '#b8c2d2',
        'text-muted': '#99a4b6',
      },
    },
  },
})

const SCENE_NAME = 'cyberpunk-2077'
const SCENE = buildScene()

// Each answer to the Backdrop render makes the app build a new frame for the Svg,
// and SMIL in a new frame starts again at 0 s. Shift every animation back by the
// wall clock, so a rebuilt frame carries on where the last one was. All animations
// repeat indefinitely, so a negative begin only seeks into the loop. The clock is
// taken modulo one day to keep the numbers small.
function inStep(svg: string, nowMs: number): string {
  const t = (nowMs / 1000) % 86400
  return svg.replace(/<(animateTransform|animate)\b([^>]*?)(\/?)>/g, (_m, tag: string, attrs: string, close: string) => {
    const b = /\sbegin="(-?[\d.]+)s"/.exec(attrs)
    const begin = (b ? Number.parseFloat(b[1]) : 0) - t
    const rest = b ? attrs.replace(b[0], '') : attrs
    return `<${tag}${rest} begin="${begin.toFixed(2)}s"${close}>`
  })
}

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: SCENE_NAME, glass: { blur: 2, tint: '#3ad7e6', opacity: 0.15 } },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // While you build: the line that would stop Desktop painting this look.
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    const set = await $.theme.set(LOOK)

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.scene !== SCENE_NAME) {
      return next(e)
    }

    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)
    const now = await $.clock.now()

    return <Svg source={inStep(SCENE, now)} alt="A neon megacity seen from a dusty roadside, with a parked wedge sports car, flying cars, and a sky that turns from day to night and back" isInteractive />
  })
}
