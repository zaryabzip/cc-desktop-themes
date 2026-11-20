import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { buildScene } from './scene.js'

// Silent Hill 2 inspired. Dark only: ash-grey surfaces, bone-white text, a rust accent.
const { theme, problems } = makeColors({
  label: 'Silent Hill 2',
  only: 'dark',
  roles: { accent: '#c87a4a', danger: '#d85a4a', success: '#8fae84', warning: '#d0b064', pro: '#a69cc0' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0f100f',
        'surface-1': '#151615',
        'surface-2': '#1b1c1b',
        'surface-3': '#1f201f',
        'text-primary': '#e6e3da',
        'text-secondary': '#bcb8ad',
        'text-muted': '#9e9a8f',
      },
    },
  },
})

const SCENE_NAME = 'silent-hill-2'
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

    return <Svg source={inStep(SCENE, now)} alt="An overlook above a fogged valley of pines: a man at a stone wall, an abandoned car in the lot, a flickering streetlight on a wooden pole, falling ash" isInteractive />
  })
}
