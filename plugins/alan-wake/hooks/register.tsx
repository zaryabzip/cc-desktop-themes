import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { buildScene } from './scene.js'

// Alan Wake inspired. Dark only: deep navy surfaces, cold white text, a lamplight yellow accent.
const { theme, problems } = makeColors({
  label: 'Alan Wake',
  only: 'dark',
  roles: { accent: '#f2c46a', danger: '#e8584a', success: '#7fd3a0', warning: '#e0c060', pro: '#8fb4e0' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0a0d14',
        'surface-1': '#10141c',
        'surface-2': '#151a24',
        'surface-3': '#1a2030',
        'text-primary': '#e6ebf3',
        'text-secondary': '#b4bdcc',
        'text-muted': '#97a1b3',
      },
    },
  },
})

const SCENE_NAME = 'alan-wake'
const SCENE = buildScene()

// Each answer to the Backdrop render makes the app build a new frame for the Svg,
// and SMIL in a new frame starts again at 0 s. Shift every animation back by the
// wall clock, so a rebuilt frame carries on where the last one was. All animations
// repeat indefinitely, so a negative begin only seeks into the loop. The clock is
// taken modulo one day to keep the numbers small.
function inStep(svg: string, nowMs: number): string {
  // Rounded to the scene's 1/24 s clock, so its stepped animations stay on shared frames.
  const t = Math.round(((nowMs / 1000) % 86400) * 24) / 24
  return svg.replace(/<(animateTransform|animate)\b([^>]*?)(\/?)>/g, (_m, tag: string, attrs: string, close: string) => {
    const b = /\sbegin="(-?[\d.]+)s"/.exec(attrs)
    const begin = (b ? Number.parseFloat(b[1]) : 0) - t
    const rest = b ? attrs.replace(b[0], '') : attrs
    return `<${tag}${rest} begin="${begin.toFixed(3)}s"${close}>`
  })
}

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: SCENE_NAME, glass: { blur: 0, opacity: 0 } },
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

    return <Svg source={inStep(SCENE, now)} alt="A lake at night with a lighthouse beam sweeping the water, a cabin with a lit window, and a man on a dock searching the far shore with a flashlight" isInteractive />
  })
}
