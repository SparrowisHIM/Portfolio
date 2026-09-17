# Build site

A portfolio under construction. A building made of code, engineered live in
a dark void while you scroll: thin graphite lines fly in, overshoot, snap and
shiver; the crane lowers each floor's frame in on a cable; smoked, near-black
skin grows over finished floors without ever hiding the skeleton. Nothing
glows by default. Light is feedback: a connection flashes, a pulse runs
through the beams, a finished floor sends one lap round its outline, then it
all fades back to dark.

Built by [Efe Ebomwonyi](https://github.com/SparrowisHIM), design engineer.

## What you are looking at

**The skeleton.** `src/lib/structure.ts` turns a seeded site into columns,
beams, outline segments, diagonals, a spine and connection nodes, each with
the moment in its floor's window when it arrives, where it flies in from and
a seed for its personality. The whole building is three instanced draws
(`Structure.tsx`): members, nodes and skin panels, driven by custom shaders
in `src/components/scene/shaders/`.

**The build.** Scroll is damped and mapped to a construction timeline
(`src/lib/construction.ts`). Columns rise and lock, the crane brings the
floor frame and snaps it down, diagonals arrive late, the floor completes.
Scroll back and it comes apart in the same order.

**The skin.** The floor being built stays skeletal; one floor down is half
skinned; three floors down is finished, at 65 to 90 percent opacity with faint
lit edges. Floors still in progress never close fully.

**The cursor.** Hover a finished part and a soft hole x-rays the skin away to
the skeleton; nearby nodes wake up; move away and it heals. Lines close to
the cursor lean toward where it just was, a weak magnetic field, never jelly.
A fast sweep is a gust of wind for the netting and the load on the hook.

**The crane.** A thin dark lattice mast, an A-frame top, a tapered truss jib,
cables, a few node lights, fading into the fog. Its load is a damped
pendulum; the vertical spring is what gives the overshoot and snap.

**The form.** Still a building: offset floor plates, a cantilever or a
setback, a void bay, one twisted floor. **Rebuild** makes another.

**The void.** Black to blue-black, thin fog, a faint grid, a few floating
fragments and sparse dust. Nothing else.

## Interactions

- **Scroll** builds the tower and guides the camera: low at first, rising
  with the build, coming in on the floor being framed and pulling back as it
  completes. Drag sideways for a little orbit.
- **Click a floor** to jump to its section. **Visit the site** opens the
  live project; **Walk in** opens it in place, over the site.
- **Night shift** is the stacking game: the crane swings the next slab over
  the tower; click, tap or press space to land it. Overhang is cut off and
  falls. Best shift is kept in local storage.
- **Components** switches to the yard: the parts the site is built from,
  each one live.

## Stack

- Next.js (App Router), TypeScript
- Tailwind CSS v4
- three.js with `@react-three/fiber`, `@react-three/drei` and
  `@react-three/postprocessing`
- Framer Motion for the HTML overlay and the component yard
- Self-hosted variable fonts (Big Shoulders, Archivo) via Fontsource

Everything in the scene is generated. There are no models or images.

## Run it

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Other scripts: `npm run build`, `npm run lint`.

## Add a floor

Add a project to `src/lib/projects.ts`. Floors are ordered bottom to top.
Set `live` to the URL of the site itself to enable **Visit the site** and
**Walk in**. Set `finished: false` for work still in progress and that floor
never fully closes its skin.

## Credits

The idea of a portfolio that *is* its own pun comes from
[dhin.dev](https://dhin.dev/), a website that is a web. This one is a site that
is a site.
