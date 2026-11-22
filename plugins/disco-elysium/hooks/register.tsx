import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { buildScene } from './scene.js'

// Disco Elysium. Dark only: teal-black surfaces, cream text, an orange accent.
const { theme, problems } = makeColors({
  label: 'Disco Elysium',
  only: 'dark',
  roles: { accent: '#e8962a', danger: '#e0645a', success: '#88c2a4', warning: '#e3c06a', pro: '#9fb7e8' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0d1214',
        'surface-1': '#13191c',
        'surface-2': '#192125',
        'surface-3': '#1c2428',
        'text-primary': '#ece4d0',
        'text-secondary': '#c4baa2',
        'text-muted': '#a39880',
      },
    },
  },
})

const SCENE_NAME = 'disco-elysium'
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
  backdrop: { scene: SCENE_NAME, glass: { blur: 2, tint: '#c89a4a', opacity: 0.15 } },
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

    return <Svg source={inStep(SCENE, now)} alt="Martinaise harbour under a painted expressionist sky: aerostats, Revachol in the haze, a frozen harbour, a pier with cranes and a wooden church" isInteractive />
  })
}
