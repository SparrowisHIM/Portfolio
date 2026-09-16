# Build site

A portfolio under construction.

Every project is a floor of a tower that goes up while you scroll. Arrive at a
floor and you watch it get built: the columns rise with welding sparks at the
top, the crane lifts that floor's slab out of the yard, swings it over and
lowers it onto the columns, then the glazing rises and the lamp comes on.
Scroll back down and it comes apart again in reverse. The roof is where you
get in touch, with the next slab already hanging from the hook.

Press **Rebuild** and the whole site is torn down and put up again from a new
seed: a different footprint, different scaffolding, a different corner for the
crane, sometimes a different lighting rig.

Built by [Efe Ebomwonyi](https://github.com/SparrowisHIM), design engineer.

## What it does

- **Scroll is the construction schedule.** `src/lib/construction.ts` maps the
  page's scroll position to a build stage for every floor. Columns, slabs,
  glazing, scaffolding height, the crane's slew, trolley and hook, and the
  slab stack in the yard are all functions of that one number, so the whole
  site is scrubbable and reversible.
- **The load swings.** The slab on the hook is a damped pendulum that lags the
  crane and settles after every move. The cable is drawn from the trolley to
  wherever the load actually is.
- **You hold a work lamp.** A spotlight beside the camera aims wherever the
  pointer is, so moving the mouse sweeps light across the site.
- **Drag to walk around.** Sideways drag orbits the tower. Vertical drag still
  scrolls, on touch too.
- **Click a floor** in the scene to jump to its section. **Walk in** on a
  floor with a live build and the project opens in place, over the site.
- **Procedural site.** `src/lib/site-generator.ts` turns a seed into floors,
  columns, scaffolding, work lamps, the crane and the yard. Same seed, same
  site.
- **Cinematic pass.** Bloom on the lamps, a vignette and film grain. If the
  frame rate drops, the effects and pixel ratio are reduced automatically.
- **Reduced motion.** With `prefers-reduced-motion`, the intro fly-in, crane
  slew lag, dust drift, sparks and loader animation are skipped. Scrolling
  still builds the tower, because that is the reader's own action.

## Stack

- Next.js (App Router), TypeScript
- Tailwind CSS v4
- three.js with `@react-three/fiber`, `@react-three/drei` and
  `@react-three/postprocessing`
- Framer Motion for the HTML overlay

Everything in the scene is generated geometry. There are no models or textures
to download.

## Run it

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Other scripts: `npm run build`, `npm run lint`.

## Add a floor

Add a project to `src/lib/projects.ts`. Floors are ordered bottom to top, so
the first entry is the ground floor and is finished before the visitor arrives.
Set `live` to a URL to enable **Walk in**. Set `finished: false` for work still
in progress and that floor's columns render as bare steel.

## Credits

The idea of a portfolio that *is* its own pun comes from
[dhin.dev](https://dhin.dev/), a website that is a web. This one is a site that
is a site.
