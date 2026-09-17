# Build site

A portfolio under construction. A night-shift construction site, generated
from a seed, where every project is a floor of a tower that goes up while you
scroll. The site is alive: the crane swings the slabs in, a crew welds and
walks the scaffold, the debris netting and the hoarding banner move in the
wind, and the visitor carries a work lamp that stirs the air as it sweeps.

Built by [Efe Ebomwonyi](https://github.com/SparrowisHIM), design engineer.

## What is on site

**The tower.** Steel H-section columns rise from the slab below with starter
bars at the top, beams are set down on them, the crane lands the slab, edge
protection and orange netting go up, then the curtain wall (mullions,
transoms, spandrels, glass) rises and the lights come on. Scroll back down and
it all comes apart in reverse. A slip-formed lift core with a climbing
formwork rig runs a storey ahead of the frame.

**The crane.** A braced lattice mast with a ladder, slewing ring, A-frame
tower top with pendant ties, a tapered truss jib, a counter-jib with concrete
ballast and a winch, a hazard-striped trolley, twin hoist ropes, a hook block,
a spreader beam and four slings to the slab corners. The load hangs as a
damped pendulum and leans in the wind. Beacon on the apex, obstruction light
on the tip, a lit cab.

**Scaffolding.** Tube-and-coupler runs with base plates and sole boards,
ledgers, transoms, couplers at every junction, face bracing, boarded lifts
with toe boards and guardrails, ladders, and green debris netting that flaps.
It climbs with the building; everything above the built height is clipped.

**The crew.** Seven hi-vis figures: a welder crouched at whichever column is
being raised, a banksman on the top slab watching the load come in, walkers on
the scaffold boards and people on the ground. They walk, bob and turn.

**The rest.** Plywood hoarding with a gate and a printed banner, a lit site
cabin, a generator with a cable to the crane, a skip, rebar and steel laydown,
pallets, cones, puddles that catch the lights, a road with a kerb and cool LED
street lights against the warm sodium site.

**Weather.** A steady breeze with gusts moves the netting, the banner, the
dust and the load on the hook. Sweeping the pointer quickly is a gust.

## Interactions

- **Scroll** builds the tower. `src/lib/construction.ts` maps scroll to a
  build stage for every floor; the whole site is a function of that number.
- **Move the pointer** and the work lamp follows. Pass it over the banner or
  the netting and the sheet is pushed away; move fast and it ripples.
- **Drag sideways** to walk around the site. Vertical drag still scrolls.
- **Click a floor** to jump to its section. **Visit the site** opens the
  live project; **Walk in** opens it in place, over the site.
- **Rebuild** tears the site down and puts it up from a new seed: footprint,
  scaffolding, crane corner, dressing and lighting rig all change.
- **Night shift** is the game. The crane swings the next slab back and forth
  over the tower; click, tap or press space to land it. Whatever hangs over
  the edge is cut off and falls. Dead-level drops flash; three in a row win
  some slab back. Best shift is kept in local storage.
- **Components** switches to the yard: the parts the site is built from, each
  one live. Magnetic button, scrambled headline, card stack, segmented
  control, rolling counter, a toast lowered in on a cable, hold to confirm.

## Stack

- Next.js (App Router), TypeScript
- Tailwind CSS v4
- three.js with `@react-three/fiber`, `@react-three/drei` and
  `@react-three/postprocessing`
- Framer Motion for the HTML overlay and the component yard
- Self-hosted variable fonts (Big Shoulders, Archivo) via Fontsource

Everything in the scene is generated: geometry from `src/lib/geometry.ts`
(struts, lattices, trusses, H-sections), textures drawn on canvases in
`src/lib/textures.ts` (concrete, netting, hazard stripes, decking, hoarding,
the banner). There are no models or images to download.

## Run it

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Other scripts: `npm run build`, `npm run lint`.

## Add a floor

Add a project to `src/lib/projects.ts`. Floors are ordered bottom to top, so
the first entry is the ground floor and is finished before the visitor
arrives. Set `live` to the URL of the site itself to enable **Visit the
site** and **Walk in**. Set `finished: false` for work still in progress and
that floor stays partly open, with edge protection instead of glass.

## Add a part to the yard

Drop a component into `src/components/yard/demos/` and give it a bay in
`src/components/yard/ComponentYard.tsx`. Every demo should respect
`useReducedMotion`.

## Credits

The idea of a portfolio that *is* its own pun comes from
[dhin.dev](https://dhin.dev/), a website that is a web. This one is a site that
is a site.
