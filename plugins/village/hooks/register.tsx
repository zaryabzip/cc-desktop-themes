import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { buildScene } from './scene.js'

// Village: Resident Evil Village inspired. Dark only: cold slate surfaces, frost-white text, a lamplight gold accent.
const { theme, problems } = makeColors({
  label: 'Village',
  only: 'dark',
  roles: { accent: '#d2b07a', danger: '#e8706a', success: '#7fc7a0', warning: '#e8c26a', pro: '#a9b4e0' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0e1118',
        'surface-1': '#141821',
        'surface-2': '#1a1f2a',
        'surface-3': '#1c2130',
        'text-primary': '#e6e9f0',
        'text-secondary': '#b6bdcb',
        'text-muted': '#99a1b1',
      },
    },
  },
})

const SCENE_NAME = 'village'
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

    return <Svg source={inStep(SCENE, now)} alt="A snowbound mountain valley in a storm, with a gothic castle on a ridge, a village in the fog below it, a turning windmill and falling snow" isInteractive />
  })
}
