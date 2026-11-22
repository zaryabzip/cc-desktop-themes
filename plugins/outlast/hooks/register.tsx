import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { buildScene } from './scene.js'

// Outlast inspired. Dark only: near-black surfaces, cold grey text, a night-vision green accent.
const { theme, problems } = makeColors({
  label: 'Outlast',
  only: 'dark',
  roles: { accent: '#6fdc7a', danger: '#e8584a', success: '#7fd38f', warning: '#e0c060', pro: '#8fb4e0' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0b0d0c',
        'surface-1': '#111413',
        'surface-2': '#161a18',
        'surface-3': '#1b201d',
        'text-primary': '#e3e8e4',
        'text-secondary': '#b3bcb5',
        'text-muted': '#97a199',
      },
    },
  },
})

const SCENE_NAME = 'outlast'
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
  backdrop: { scene: SCENE_NAME, glass: { blur: 2, tint: '#3aff6a', opacity: 0.15 } },
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

    return <Svg source={inStep(SCENE, now)} alt="A remote asylum on a mountain at night in a rainstorm, behind a chain-link fence, seen through a camcorder viewfinder that now and then switches to night vision" isInteractive />
  })
}
