# Portfolio v1 — Build Site

> **Archived.** This is the first version of my portfolio, finished and frozen
> in September 2026. Version 2 is a different idea, built from scratch.

**Live:** [portfolio-v1.vercel.app](https://portfolio-v1.vercel.app)

A portfolio that is a construction site. A concrete-frame tower goes up floor
by floor as you scroll: a tower crane lifts each precast slab off a laydown
pile and lands it on the frame, the connections are welded off, and each
finished storey glazes, lights up and becomes one of my projects. At the top
there is a stacking game, **Night Shift**.

Everything in the scene is generated in code from a seed. There are no 3D
models, no image assets and no textures on disk.

Built by [Efe Ebomwonyi](https://github.com/SparrowisHIM), design engineer.

## What's in it

**The site.** A seeded building on a plinth in a black studio: a hoarded
yard with scaffold, a working crew, a site cabin, a lighting mast and a
laydown pile that shrinks as the tower grows. **Rebuild** generates another.

**The build.** Scroll is damped and mapped to a construction timeline.
Perimeter columns rise, the crane slews, hoists and lands the slab, four
welding arcs burn it off with sparks that bounce once and cool, then the core
grows up off it. Scroll back and it comes apart in the same order.

**The crane.** A lattice tower crane with a spreader beam, slings and a
hook block. The load is a damped spring pendulum that the wind leans on, and
the jib's lag behind the timeline is capped so a fast scroll can't swing it
through the building.

**The floors.** Each storey is a project: title, stack, status and a link to
the live site. **Walk in** opens it in place over the scene. Click a finished
storey in the model to travel to it.

**The sheet.** The page is drawn as an architectural sheet: rulers, a title
block, a levels rule, a floor schedule. Those pieces only show up when the
window has room for them.

**Night Shift.** A stacking game on its own platform in a night-time city.
The crane swings a prefab floor over the tower; click, tap or press Space to
drop it. Off-centre landings shift the tower's balance, and when balance
runs out the tower falls. Your best score is kept in local storage.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript
- [three.js](https://threejs.org) via `@react-three/fiber`, `@react-three/drei`
  and `@react-three/postprocessing`
- Framer Motion for the HTML overlay
- Tailwind CSS v4
- Self-hosted variable fonts via Fontsource: Big Shoulders, Archivo, Roboto Mono

## Run it

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

| Script          | What it does                                           |
| --------------- | ------------------------------------------------------ |
| `npm run dev`   | Development server                                     |
| `npm run build` | Production build                                       |
| `npm run lint`  | ESLint                                                 |
| `npm test`      | Night Shift engine tests (`tools/test-stack-game.mjs`) |

## Project structure

```
src/
  app/                 layout, page, OpenGraph image, globals.css
  components/
    SiteExperience.tsx the page: scroll state, overlay and scene wiring
    overlay/           HTML layer: hero, floor panels, sheet furniture, game HUD
    scene/             three.js layer: building, crane, yard, crew, camera, game
  hooks/               scroll progress, media queries
  lib/                 pure logic: site generator, construction timeline,
                       building parts, crane geometry, game engine, textures
tools/
  test-stack-game.mjs  game engine tests (no test framework needed)
  cdp.py               captures real GPU frames from Chrome over CDP
  measure.py           finds the model's bounds in a capture
```

How it works, and the traps that cost real time, are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Changing the floors

The projects live in `src/lib/projects.ts`, ordered bottom to top. The number
of projects sets the number of storeys. Set `live` to a deployment URL to
enable **Visit the site** and **Walk in**, and set `finished: false` for
work that's still in progress.

## Credits

The idea of a portfolio that *is* its own pun comes from
[dhin.dev](https://dhin.dev/), a website that is a web. This one is a site
that is a site.

## License

© 2026 Efe Ebomwonyi. All rights reserved. The code is public to read and
learn from; please don't redeploy it as your own portfolio.
