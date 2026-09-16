# Build site

A portfolio under construction.

Every project is a floor of a tower that is still going up. Scroll to climb the
building: the floor you are reading lights up, the crane keeps slewing overhead,
and the roof is where you get in touch. Press **Rebuild** and the whole site is
torn down and put up again from a new seed: a different footprint, different
scaffolding, a different corner for the crane.

Built by [Efe Ebomwonyi](https://github.com/SparrowisHIM).

## How it works

- **Procedural site.** `src/lib/site-generator.ts` turns a seed into floors,
  columns, scaffolding, work lamps and a crane. The same seed always builds the
  same site, so a link to a site number is a link to that exact building.
- **One scene, scroll-driven.** The tower is a single `react-three-fiber`
  canvas pinned behind the page. Page scroll maps to a camera path
  (`CameraRig.tsx`) that rises floor by floor and swings across the open face
  of the building. Text panels for each floor sit on top as ordinary HTML.
- **Light as feedback.** The active floor is the only thing that changes when
  you scroll: its glazing glows and a lamp inside switches on. Floor panels
  fade in with the same flicker a sodium lamp makes when it strikes.
- **Rebuild.** A new seed regenerates the site and lowers each floor into place
  from above, staggered from the ground up.
- **Reduced motion.** With `prefers-reduced-motion`, the intro fly-in, crane
  slew, dust drift and floor drop are all skipped. Scrolling still moves the
  camera, because that is the reader's own action.

## Stack

- Next.js (App Router), TypeScript
- Tailwind CSS v4
- three.js with `@react-three/fiber` and `@react-three/drei`
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
the first entry is the ground floor. Set `finished: false` for work still in
progress and that floor renders as raw structure instead of glazed.

## Credits

The idea of a portfolio that *is* its own pun comes from
[dhin.dev](https://dhin.dev/), a website that is a web. This one is a site that
is a site.
