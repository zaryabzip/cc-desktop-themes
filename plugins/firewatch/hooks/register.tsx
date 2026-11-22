import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { buildScene } from './scene.js'

// Firewatch inspired. Dark only: deep plum surfaces, warm cream text, a sunset orange accent.
const { theme, problems } = makeColors({
  label: 'Firewatch',
  only: 'dark',
  roles: { accent: '#f28a5a', danger: '#e8504a', success: '#8fd39a', warning: '#f0c060', pro: '#c8a0e0' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#120a12',
        'surface-1': '#180f18',
        'surface-2': '#1e141e',
        'surface-3': '#251925',
        'text-primary': '#f3e6e0',
        'text-secondary': '#cbb9b8',
        'text-muted': '#ab9a9c',
      },
    },
  },
})

const SCENE_NAME = 'firewatch'
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

    return <Svg source={inStep(SCENE, now)} alt="Ridge after ridge of pine forest at sunset, a fire lookout tower with a lit cab, the smoke of a distant wildfire and birds crossing the sky" isInteractive />
  })
}
