import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { buildScene } from './scene.js'

// Dark fantasy. Dark only: moonlit steel, ash greys, and ember red.
const { theme, problems } = makeColors({
  label: 'Dark fantasy',
  only: 'dark',
  roles: { accent: '#9db8d6', danger: '#e0645a', success: '#88b48c', warning: '#e3b866', pro: '#b49be0' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0a0d12',
        'surface-1': '#11151c',
        'surface-2': '#181d26',
        'surface-3': '#202631',
        'text-primary': '#e9e6e0',
        'text-secondary': '#beb8ae',
        'text-muted': '#918b81',
      },
    },
  },
})

const SCENE_NAME = 'dark-fantasy'
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

    return <Svg source={inStep(SCENE, now)} alt="A menacing castle on a crag above a stormy sea under a pale moon, with lightning, wind-blown fog and breaking waves" isInteractive />
  })
}
