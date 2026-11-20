# cc-desktop-themes

Animated themes for the Claude Code desktop app. Each theme sets the app's colours and draws a living scene behind your sessions.

I made these for my own enjoyment. Anyone is free to use them, change them or build on them.

> **Heads-up: these can be heavy.** The scenes animate all the time, and on my laptop they use roughly 30–50% of one CPU core and make it run warm. If your machine heats up or your battery drains, switch back to a plain theme.

## Themes

### Dark Fantasy

![Dark Fantasy](docs/dark-fantasy.jpg)

A menacing castle on a sheer sea cliff under an indigo and violet sky, with a watching red eye in the keep.

Moving parts:
- clouds and fog drift, and lightning strikes in the distance;
- waves break on the rocks, and a beacon sweeps red over the sea;
- the eye blinks and looks around;
- torches flicker along the bridge, and a knight rests by a campfire in a cave under the castle;
- ravens circle, and embers rise.

UI colours: moonlit steel, ash grey and ember red.

### Disco Elysium

![Disco Elysium](docs/disco-elysium.jpg)

Inspired by Disco Elysium: a frozen harbour town under a painted, expressionist sky, with an orange blast behind a cumulus bank.

Moving parts:
- an aerostat drifts on spinning rotors, and the blast pulses;
- clouds billow, chimney smoke rises, and a gantry trolley runs along its girder;
- windows flicker and their reflections shimmer in the water;
- ice floes drift, snow falls and gulls circle;
- a figure on the pier smokes.

UI colours: teal-black panels, cream text and an orange accent.

Disco Elysium inspired. Not affiliated with ZA/UM, and no game assets are used: every shape is drawn in code.

## Install

Install one theme at a time. Both themes set the backdrop when a session starts, so with two enabled, whichever runs last wins.

At the prompt of a Claude Code terminal session:

```
/plugin install dark-fantasy --marketplace zaryabzip/cc-desktop-themes
```

```
/plugin install disco-elysium --marketplace zaryabzip/cc-desktop-themes
```

Answer `y` to add the marketplace, then pick a scope (the user scope is first).

From a shell:

```bash
claude plugin install dark-fantasy --marketplace zaryabzip/cc-desktop-themes
```

```bash
claude plugin install disco-elysium --marketplace zaryabzip/cc-desktop-themes
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `zaryabzip/cc-desktop-themes`, then **Add plugin**.

New sessions show the theme. In a session that is already open, run `/reload-plugins`.

## Switch themes

```bash
claude plugin disable disco-elysium@cc-desktop-themes && claude plugin enable dark-fantasy@cc-desktop-themes
```

Swap the names to go the other way. Open sessions keep the theme they loaded: run `/reload-plugins` in each, or quit the app fully and reopen it.

## Notes

- The animated scene draws in the desktop app (and the mobile app). A terminal session gets the colours only.
- Each scene is one SVG with SMIL animation, built in `hooks/scene.js`. The moving parts avoid filters to keep the cost down, but a full-window animated scene still costs real CPU (see the heads-up above).
- If the backdrop ever stops moving, quit the app fully and reopen it. The app turns backdrop animation off when its GPU falls back to software rendering.
- `hooks/make-colors.js` is the colour helper from Claude Code's plugin authoring kit, copied in unchanged as the kit asks.

## Make your own

Start from either theme. `hooks/register.tsx` sets the colours and the backdrop; `hooks/scene.js` draws the scene. Keep the scene under 131,072 characters, the app's limit for a backdrop.

## License

MIT. See [LICENSE](LICENSE).
