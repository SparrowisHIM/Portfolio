# Build site — handoff

Working notes for the scroll-to-build front side. Delete when it stops being
useful.

## Where this is

Next.js 16 App Router, TypeScript, Tailwind v4, three.js via
react-three-fiber, Framer Motion. Dev server `npm run dev` on port 3000.
Everything committed and pushed on `main`.

The front side is a **concrete-frame building under construction, presented
as a model on a plinth in a black studio**, engineered live as you scroll,
floor by floor. A tower crane lifts a precast plate off a laydown stack and
lands it on the frame; the connections are welded off; the storey glazes and
lights up as the build moves above it. Efe rates it by eye and it has to make
people stop — portfolio, X, job visibility.

The site itself is built: hoarded, scaffolded, populated, lit, with a crane
that behaves like a crane and a laydown that behaves like a laydown.
Hovering a finished storey names its project and the orbit comes off its
leash once it tops out.

## Read this first: where the project is going

There are two sides. **The front page** is the construction site. **The
component yard** at `/components` is the other, and Efe has now set the bar
for it: `https://www.imdaryl.com/`, at that level of detail and with that
many pieces. He has said he does not care if it takes a week.

**The front page is finished first.** Do not start the yard until it is.

**Efe rates the front page a 6 out of 10.** The first job of the next
session is an audit: go through it honestly at desktop and work out what is
keeping it off a 9. What follows is what he has already named. It is not
the whole list, and finding the rest is the point of the audit.

### What he has named

1. **The building is badly placed.** It takes almost the whole centre of
   the frame. The composition needs rebalancing: more air, a clearer
   relationship to the copy column.
2. **The scroll animation "is not talking".** Nothing tells you where you
   are in the climb or what the scroll is doing. The mobile floor rail does
   exactly this job; desktop has no equivalent.
3. **The crane is broken between floor five and the roof section.** See
   *Known broken*. Measured, not guessed.
4. **Everything is very broken on a fast scroll.** Same root cause.
5. **Every floor needs its project link.** Only `vault-market` has a `live`
   URL in `projects.ts`. Floors 2 and 3 are `finished: true` with no link,
   so they render "Fit-out in progress. Opens soon.", contradicting their
   own flag. **Efe has to supply four URLs** - ask, they cannot be invented.
6. **The night shift is to be fixed**, not rebuilt from scratch as the note
   below assumed. A reference is coming. Until it arrives the *Do not
   touch* rule still stands.

## The reference: imdaryl.com

Go and look at it yourself - the scratchpad does not survive a session, so
there is no frame kept here, and nothing of theirs is committed to this
repo. `get_page_text` gives the whole structure in one call and is the
fastest way in. For frames, point `tools/cdp.py` at it: the page is heavy
and the driver times out on it more often than not, so take them one at a
time with a long wait rather than in a loop.

**We are not copying it.** It is a paper-white technical drawing sheet and
this is a black construction site at night. What transfers is the
discipline, and specifically five things.

- **A continuous annotation layer.** Rulers with tick marks down both
  edges, live cursor coordinates, a stated drawing scale, crop marks. Every
  section titled `SHEET 01 - IDENTITY`, `SHEET 02 - ASSEMBLY ORDER`. Every
  figure captioned `Fig 0.1 - Nine pieces. Each cell is one thing I made.`
  Nothing is unlabelled. This site already has one sentence in that voice -
  `Site no. 20260916, arc lighting` - and it is the best line on the page.
  There should be a system of them.
- **A third type register.** Display for headlines, sans for body,
  **monospace for annotation**. We have the first two. The monospace voice
  is what carries the drawing-sheet feel and it is missing.
- **Live data in the chrome.** His header carries his city, the local time
  and the weather. A site has a clock, a shift and a forecast.
- **Density.** Each of his sections carries a paragraph, a figure, a
  caption, a grid, filters, a sort and a count. Our floors carry a title,
  two lines, a stack list and two links. Ours is thin, and that is most of
  the gap between a 6 and a 9.
- **Invitations to play, stated plainly.** *N.B. this drawing is live. drag
  the track, pull a keyframe. nothing here is precious.* We have a model
  you can orbit and storeys you can point at, and we say none of it. The
  hint Efe removed was the wrong *form* - a fading tooltip - not the wrong
  idea. His works because it is in the annotation voice, permanent, and
  sounds like a person rather than a product tour.

For the yard specifically: note the **filter and sort bar** (`SORT: Oldest
first / Newest first / A-Z`, `CARRYING: Design Motion Brand Web Launch
Social Edu`, with a live `6 / 6` count), the **status tags** (`IN THE
WORKS`), the **date ranges**, and the **draggable timeline**. That is the
shape of the yard.

## Known broken

### The crane flies through the building

Between floor five finishing and the roof section - scroll 0.86 to 1.0 -
the site tops out, `craneJob` goes idle, and the pose jumps in one frame
from the hook resting on the laydown to holding a plate over the roof:
**22.75 units of travel and 0.95 radians of slew.**

`Crane.tsx` eases the jib so it is not a teleport, and that is exactly what
makes it visible: it *flies*, and the flight goes through the frame.
Checked against the building envelope, **54 of 99 steps along that path are
inside it** - the plate enters the west face at 10.7m and comes out of the
roof at 21.2m.

**Easing a discontinuity is not the same as not having one.** The fix is
one of: give the crane a real cycle for that hand-over, the same as every
other lift; or route the eased path over the building rather than through
it, hoisting before slewing the way a crane actually works; or do not hold
a plate at idle at all.

**The same mechanism is why fast scrolling is broken.** `Smoother` damps
the section at 5.5 and the jib eases at 7, so a scroll crossing several
floors in a second hands the crane a pose it can only reach by flying, and
it takes the shortest route - through the structure, every time. Anything
that fixes the hand-over has to fix this too or it has fixed nothing.
**The test is dragging the scrollbar top to bottom in one movement, not
scrolling gently.**

### The composition

The model sits centre-right and fills most of the frame. `HERO.shift`, the
keyframe radii in `buildKeyframes` and the plinth size all feed it. The
deck has been widened twice for content reasons, which makes the model
bigger in frame each time - **check the framing after any change to
`plinth()`.**

## Do not touch

- The night-shift game: `src/lib/stack-game.ts`,
  `src/components/scene/StackGame.tsx`, `src/components/overlay/NightShift.tsx`.
  The `game.active` block in `Crane.tsx` stays byte-for-byte.
  **Efe now wants the game fixed rather than rebuilt from scratch, and is
  sending a reference for it.** Until that arrives, leave these files alone
  and do not let them block anything.
- The component yard: `src/app/components/`, `src/components/yard/`.

## Ground rules

- Small conventional commits directly on `main`, pushed after each. Never a
  branch. Nothing in messages or metadata that reads as AI.
- `npx tsc --noEmit -p .` and `npm run lint` before every commit.
- Bash heredocs with backticks or apostrophes break on this machine. Write
  python patch scripts to the scratchpad and run them with `python`.
- **Do not stop to ask for a look between steps.** Efe has asked explicitly:
  work through a list, screenshot-check yourself, keep going, report at the
  end. Raise a problem the moment you see one, but do not pause on it.

## How this building came to be, and what not to repeat

A designer told Efe the old site looked **too AI generated**. The cause was
not the lighting. Fourteen commits on 09-17 between 16:36 and 16:38 had
replaced a materially rich, populated night construction site with an
instanced skeletal wireframe, deleting the crew, the site dressing, the
structural floors, the core, six textures and fourteen materials. What was
left was glowing line work in a void — which is the house style of every
three.js demo on the internet.

Two dead ends were burned before that was understood:

- **Four surface treatments** (`?look=current|lit|ink|day`) were built over the
  wireframe to fix it with light. Efe rejected all of them; the drawing
  treatment in particular "looks like we are trying to force a geometry of a
  building on a pattern". Reverted. **Do not reach for a shader when the
  problem is that there is nothing in the scene.**
- **A restore of the deleted rich site** was designed and never asked for.
  Efe only wanted an opinion on a recording. Answer what is asked.

Efe then supplied two references: a concrete-frame tower under construction on
a plinth, black background, lower storeys glazed and warm inside, upper
storeys bare frame, crane placing a plate, two figures, a welder. His two
rules, which still hold:

1. **No impossible structures.** The eye knows where load goes; plates
   floating on nothing read as wrong before you can say why.
2. **The animation carries the energy.** The spectacle belongs to the process
   of the thing going up, not to a strange silhouette.

## What is built

- `src/lib/site-generator.ts` — one consistent frame, repeated. Same plate on
  every storey, a regular column grid (`BAYS_X`/`BAYS_Z`, middle left out for
  the core), columns dead straight top to bottom. `offset`/`extend`/
  `rotation`/`void` are kept at rest so `construction.ts`, the crane, the
  pointer and the game keep their contract. **Changing the shape is a data
  change in `generateSite`, not a code change.**
- `src/lib/building.ts` — the building as a flat list of placed boxes, each
  naming the floor whose progress owns it and when in that progress it
  arrives. Columns, slabs, core, curtain wall, lit ceilings, fit-out, edge
  protection, starter bars, stacked material. Also `plinth()`, `weldLevel()`,
  `weldSpots()`.
- `src/components/scene/Building.tsx` — one instanced draw per material,
  matrices written **from the frame loop** (not an effect — that is the
  blank-building bug). Plinth, uplights, one interior lamp per glazed storey,
  and the per-storey pick volumes for floor clicking.
- `src/components/scene/Workers.tsx` — the crew. A welder at the arc, a
  banksman on the highest slab, and two scaffolders per run riding the
  working lift as it is erected. The lift comes from `workingLift` in
  `Scaffold.tsx`, which is the same expression the clip plane uses, so
  nobody stands on boards that have not gone up yet.

  **Only the torso and legs cast shadows.** A figure is forty pixels tall
  here and its shadow is a smudge, but the hat, brim, head and two
  reflective strips were each taking their own draw in the shadow pass.
  Cutting them gained about eight frames — more than the four new people
  cost, so the site runs faster populated than it did empty. Worth
  remembering for anything else instanced and small.
- `src/components/scene/Welding.tsx` — the arc at the joint being made, plus
  the four corners of a plate burning off for ~2.6s as it lands.
- `src/components/scene/Workers.tsx` — two figures: a welder at the arc, a
  banksman on the highest slab with his arm up while the load is on the hook.
- `src/components/scene/SiteYard.tsx` — the laydown stack, cabin, skip, rebar,
  lighting mast, cones, pallets, and the light shafts off the mast heads.

  **The beams are cones, not haze.** `Beam.tsx`, shared with the crane. There is nothing in the air here to
  scatter in and adding some means shading every pixel in the frame for it.
  The cone fades on two axes: along its length from the lamp, so the shaft
  is gone before it reaches the deck and the ellipse it would cut there
  goes with it; and across it by `abs(dot(normal, view))`, so the middle is
  brightest. **Get that second one backwards** — using `1 - abs(dot(...))`,
  which is the rim-light reflex — **and you get a hollow tube with two
  bright edges, which reads as a cone-shaped object rather than as light.**

  Back faces only. Both walls shades the shaft twice and doubles it against
  itself down the middle; the far wall alone gives the same gradient.

  They are aimed short of the tower, at the deck in front of it. The mast
  stands outside the scaffold runs, so anything it points at the building
  is cut off by them within a couple of metres.
- `src/components/scene/StudioEnvironment.tsx` — a lighting rig built in code
  and pre-filtered into a cube map, so the glass has something to reflect.
- `Crane.tsx`, `CameraRig.tsx`, `SiteScene.tsx`, `Pointer.tsx`.

### Sequencing, which took three goes to get right

Per floor `N`, in floor-local progress:

```
0.05 – 0.51   perimeter columns grow up out of slab N-1
0.66          PLACED_AT: the crane lets go, slab N lands
0.66 – 0.92   the four corners of slab N burn off
0.70 – 0.96   the CORE grows up off slab N
0.72 – 0.80   edge protection
```

**The core comes after the slab, not before.** It used to run a storey ahead
and read as a shaft standing in mid air. Efe called this out specifically:
"the slab should drop before the pillar grows" — and by pillar he means the
centre core, not the perimeter columns.

Growth is a `growth` field on a `Part`: the part rises out of its own base
with the foot planted, and retracts the same way scrolling back down.

### The crane

- Stands **on the plinth** with everything else. It used to be four metres
  clear of the base, planted in black beside the model at y = 0 while
  everything else sat at the plinth top — that was most of why it read as
  disconnected.
- **It is dark, and that is a decision, not the default.** `CRANE_PAINT` in
  `materials.ts`. It was tried in a works yellow and in a light grey — both
  read well, both made the crane a second subject beside the building. Efe
  chose dark. `CRANE_PAINT_YELLOW` and `CRANE_PAINT_GREY` are kept there as
  one-line swaps.

  It is *not* the near-black it started as: `#23272d` at metalness 0.55 is
  about 0.018 in linear, darker than the studio it stands in, and a dark
  metal in a dark room has nothing to reflect either. A matt dark steel
  catches the key on the chords and the platforms. **The repaint is not what
  fixed the crane** — the geometry that went in with it did: the kentledge,
  the ladder, the rest platforms and the machinery deck. On screen the two
  darks are nearly the same; the crane before and after is not.
- **The lifting gear stays painted** while the crane is dark, which is how
  site gear is and the only way the spreader reads against the underside of
  a plate.
- Mast is `totalHeight + 3.5..4.3`. Half a metre taller than it was, because
  the hook hangs a full rigging below the trolley now and on a short mast
  over the top level the hoist height worked out *above* the rope's own
  anchor. `cranePose` also clamps the hook a `MIN_ROPE` below the trolley.
  Taller still and the jib spends the whole scroll above the frame.
- Carries a **precast plate 7.4 × 3.2m**, about a quarter of the floor. It
  used to carry a plate the size of the entire floor plate, which was the
  largest object in the hero frame; then a 3.4m plank, which was too small to
  look like it was building anything.
- **The machinery deck throws a shaft.** It hangs off the slew, so the jib
  points it at whatever is being built and it sweeps across the site as the
  crane swings — the one piece of lighting here that moves. Narrower, weaker
  and with a much slower length falloff than the mast's: it is twenty-five
  metres up and four times as long, so the same cone at the same settings is
  a translucent wedge across half the frame, and the same falloff dies out
  before it reaches anything and hangs in the air as a cone with no end.
  One shaft, not two — the pair sat on top of each other and read as one.
- Picks off a **real stack** that draws down as the building goes up and
  then holds at `STACK_MIN`. It used to run to nothing by the top floor,
  which reads as a yard that has finished rather than one that is working.
  **`STACK_MIN` sets the height of the whole pile**, not just its floor:
  the drawdown is one plate per lift and there are four lifts, so the pile
  always starts four taller than it ends. At a floor of four it started at
  eight — over three metres on a seven by three footprint, which reads as a
  monolith and was the biggest thing on the deck at the arrival. Two.
  If it ever needs to hold more than it is tall, split it into two stacks
  side by side rather than raising the floor.

### The arrival is framed on the crane, not the deck

Before a floor is up the deck is four metres tall and the crane is thirty,
and the old shot was framed on the deck — so the mast ran off the top of
the frame. That was invisible while the crane was a dark silhouette and
became the first thing you saw once it was not.

`lookY` sits at the middle of the whole subject (crane top 30, plinth
bottom about -1) and the radius holds thirty-seven units, so the margins
come out even. The deck ends up low in frame; that is what a thirty-unit
subject does in a 16:9 window, and it is why the wordmark on the left
carries the other half of the composition. It also gives the first section
something to do — scrolling to floor one is a dolly in from here.

### The view angle is fixed, on purpose

`VIEW_SIDE` and `CRANE_CORNER` in `site-generator.ts` are constants, not
seeded. Efe picked this composition — crane on the left with the jib
running right over the building, the tower corner-on, the laydown at the
foot of the crane — and every load has to open on it. A seeded view side
meant every rebuild was a different photograph of a different building.
Rebuild still varies the lighting rig, the plate sizes, the crane
distances, the scaffold sides and the yard jitter.

### The top level is a lift like any other

`craneJob` returns `idle`. Without it, "working the top level" and "nothing
left to build" both came back as `index === floors.length`, the pose read
the second, and the cap slab arrived with no crane involved — Efe's "the
fifth floor has no animation, the roof just appears".

The landing height for that lift is `topLevel.y`, not `floors[index].y`:
there is one more slab than there are storeys, and the clamped index used
to give the storey below the one being capped.

### The lift, and why it is one file's worth of constants

The plate used to *appear* on the hook: `loaded` was true from t = 0, and
the hook's height over the yard was `0.16 + SLAB_THICKNESS * (n + 1)` — a
guess. The yard meanwhile stacked `SLAB` (0.34) plates on `plinth().top`.
Two thicknesses, two ideas of where the deck was, so the plate on the hook
was never where the pile was.

`construction.ts` now owns `PLATE_T`, `DECK_Y`, `STACK_PITCH` and
`stackPlateY(i)`, and `building.ts` takes `SLAB` and `plinth().top` from
them. The import only goes that way — `building.ts` already imports from
`construction.ts` for `plinth()`, so construction can never import back.

With one pile to agree on, the lift is:

```
0.00 – 0.06   empty hook comes down onto the top plate
0.06          SLINGS_AT: spreader lands, slings onto the anchors
0.12          HITCH_AT: weight transfers; the plate leaves the pile from
              exactly where it sat, and `remainingSlabs` drops by one
0.12 – 0.32   hoist
```

`yardHookY` adds the lifted plate back onto the count while it is in the
air, or the plate drops a whole pitch in the frame it is picked.

### The plate turns on the way over

Plates lie **tangentially** in the laydown — `yardTurn`, a quarter turn —
and land **square** on the frame. So a lift includes a rotation, and the
pose carries it: `rotation` eases from `yardTurn` to the floor's own over
the swing, with the slew.

Only the plate used to be turned by it. The gear was not, so the spreader
came down across the pile at right angles to the plate it was picking,
with its slings hanging off the edges into thin air. Efe spotted it in a
screenshot inside a minute. The plate, the spreader and the anchors now sit
in one `rig` group that carries the yaw; the hook block stays outside it,
because a hook does not care which way a load is pointing.

**The probe that found it** was worth more than the looking: the hook was
exactly over the pile and the heights were exactly right, which ruled out
everything except orientation.

### The lifting gear

Hook block with an actual hook, a bridle, and a spreader frame two thirds
of the plate wide with four slings hanging near vertical onto anchors cast
into the plate. It was a box, a disc, and four slings running from a short
bar out to the plate corners — over a seven metre plate that is two degrees
off horizontal, and they read as scratches lying on the concrete.

Painted (`m.rigging`), for the same reason as the crane: dark steel against
the underside of a plate is nothing at all. The whole assembly has to fit
in `HOOK_ABOVE_SLAB` minus half a plate — about a metre — so the budget is
block 0.30, hook 0.20, bridle 0.18, beam, slings 0.32. **Do not grow
`HOOK_ABOVE_SLAB` without checking the hook still clears its own trolley.**

### Two things the repaint uncovered

Neither was caused by it. Both were invisible while `m.crane` was near
black and obvious the moment it was not, and both would still be wrong with
the crane dark — just unseeable. They are fixed on their own merits, and
the crane has since gone back to dark without either returning. **When you
change a material, look at everything that shares it — and when something
appears with a colour change, ask whether it was always there.**

- The **site lighting mast** used `m.crane`, so it turned into a gold post.
  It has `m.lampMast` now. It also stood *inside* the laydown: the dressing
  is placed on bearings off the open face and the laydown is snapped to an
  axis, so the two could land in the same spot. `SiteYard` now puts the
  mast on the opposite hand from the pile.
- The **spreader** stayed on the hook after release — `hitched` had a lower
  bound and no upper one — so it was left lying across the roof and poking
  through slab edges on the way home.

### Hover waits for topping out

The ground floor is complete from the first frame, so on arrival — nothing
built, a bare slab on an empty deck — pointing at it produced a card
reading "Vault Market, handed over". The gate is `topped`, which is what
the feature was for: *hover on the finished building*. Clicking is still
gated only on the storey being complete, as it was before.

### The laydown

Timber between every pair of plates. The gap was there so the pile did not
read as one solid block; empty, all it did was put a shadowed void between
two lit faces, and Efe saw it straight away as a black line running through
the stack. The dunnage runs past the ends of the plates and sits out near
the edges, so it reads from any face — tucked into the middle it was only
visible through the gap it was meant to be filling.

### The hero lighting pass

The plinth top is the largest surface in the opening frame and it was an
untextured slab lit evenly from above — nothing for the eye to go to.
`siteDeckTexture` gives it tyre tracks, damp patches, dust and scuff, which is
the cheapest way to make a big surface read. And the lighting mast now carries
a real `spotLight`: it stood there with two bright lamp faces lighting
nothing, which is why the deck had no reason for any part of it to be brighter
than any other. The default spot target is world origin, which is the middle
of the site, so it rakes the deck and up the building without needing a target
object. First pass at intensity 260 blew the core out; 95 with a wide angle
and high penumbra is a rake, not a flood.

### The laydown

`yardAxis` / `yardRadius` / `yardPosition` / `yardTurn` in `construction.ts`.
Snapped to an axis and set at a **computed** distance, because a rectangle
reaches furthest at its corners: a fixed radius that clears the flat of the
building still lands inside its corner, and the plates were intersecting the
slab. The plinth carries an **apron on the laydown side only** — mirroring it
doubled the empty deck for nothing.

### Hover: the finished tower is the navigation

Point at a storey that is complete and it warms up, a line of light runs
round the slab that caps it, its interior lamp comes up 75%, and the project
name pins itself to the plate in 3D. Clicking jumps to that project, which
it already did — nothing said so.

- **The hovered storey is derived from part height, not from `Part.floor`.**
  That field is a *timing* field and the two diverge by design: glazing on
  storey N is placed by floor N + `CLAD_LAG`. `storeyOf` in `Building.tsx`
  divides the part's own y by `FLOOR_HEIGHT`, which also puts a slab with
  the storey below it — the one it caps, which is the band the eye reads.
- **The label anchors to whichever plate corner projects furthest right**,
  recomputed per frame. On a convex plate that corner is always on the
  silhouette, so the card leaves the building along its outline. The near
  corner, which is the obvious choice, projects into the middle of the
  elevation and puts the card over the thing it is naming.
- **The glass is deliberately not tinted.** `#0e141b` is about 0.004 in
  linear, so a factor of twelve would be needed before anything showed.
  The storey lights from the inside instead, where the lamp already is.
- Instance colours are written white **on mount** so the shader compiles with
  `USE_INSTANCING_COLOR` once at startup. Letting `setColorAt` create the
  attribute on first hover swaps the program for every material in the scene
  mid-interaction. The per-frame write is skipped unless the summed glow
  moved, so a still building uploads nothing.

### Free orbit, once it has topped out

While the site is going up the drag stays on its old ±0.45 leash: the build
has a front, the scaffolded faces and the laydown are not the shot, and the
keyframes are directing. The topped-out latch unlocks a full turn and adds an
elevation.

**The tilt rotates radius and rise together.** They are the two legs of a
right angle on the look point, so swinging the pair rides the camera over the
model at constant distance; lifting `rise` alone drifts away from the subject
as it climbs. Clamped to `PITCH_LOW`/`PITCH_HIGH` so it never goes under the
plinth or all the way to a plan view.

A press only becomes a drag past `DRAG_SLOP` pixels of travel. Without that,
`orbit.dragging` went true on every pointerdown, the hover label blinked
under the click, and a click on a storey was indistinguishable from a swing.

## Mobile

It was the desktop layout shrunk, and it did not survive the shrinking. The
camera backed off 35% on every shot, the copy sat under a gradient covering
more than half the screen, and the arrival was a strip of deck with black
above and below.

- **`fit` finally means what it says.** Every keyframe asked for the full
  portrait correction. Vertical field of view does not change with aspect, so
  a shot bound by the *height* of the tower needs almost none (roof: 0.6) and
  a close shot of a floor *plate* needs most of it. **Check which dimension
  binds before backing the camera off.**
- **A keyframe may hand over a different shot upright**, through `tall`.
  Blended continuously by `upright`, not switched at a breakpoint, or the
  shot jumps while the device is being turned. The arrival is the case that
  proves the mechanism: before a floor is up the only tall thing on site is
  the crane, so upright it stands opposite the crane and the mast rises out
  of the middle of the deck. Two closer variants were tried first and both
  were worse — one left the yard a strip at the bottom, the other filled the
  frame with the cabin.
- **The copy cards are `fixed`, not `sticky`.** Sticky only ever pulls an
  element back *up* toward an edge; this needs it held *down* at the foot of
  the viewport while its section is still arriving. Left in flow, two cards
  meet half-lit in the middle of the screen between floors. The hero needed
  its own scroll fade as a result — nothing carries a fixed card away — and
  `md:opacity-100!` pins the wide layout back to what it was.
- **The floor rail** (`FloorRail.tsx`) is the phone's hover: a column of call
  buttons down the right edge, roof at the top, the one you are on lit.
  Anchors, not buttons, so the back button and the keyboard come free.
- Night shift and Rebuild move to the **left edge as glyphs**, opposite the
  rail. The bottom right is where the card lives now, and two pills sitting
  on the copy was the first thing wrong with the small layout.
- **The sideways slide eases out as the frame narrows.** A tablet held
  upright still shows the copy column but has nowhere near the width to pay
  for `HERO.shift`, and at full strength it walked the building off the right
  edge at 768 × 1024. That width is the worst case: `md:` is min-width 768,
  so it gets the wide *layout* with an almost fully portrait *camera*.
- Cards clear the home indicator with
  `bottom-[max(1.25rem,env(safe-area-inset-bottom))]`.

## The components that were still lying there

The 09-17 strip did not delete the rich site, it stopped rendering it.
Eight scene components survived in the repo with nothing importing them,
and finding that is worth more than any of them individually — **before
building site dressing, check whether it is already written.**

Revived, because they fit a model on a plinth:

- **`Scaffold.tsx`** — rebuilt rather than switched on. See below.
- **`Bursts.tsx`** — `Crane.tsx` has called `emitBurst` on every release
  since it was written and nothing drew the result; the queue filled to its
  cap of 24 and sat there.

Left dormant, because they undo the presentation Efe approved:

- **`Atmosphere.tsx`** gives the void a ground plane and a horizon, and
  **`Ground.tsx`** is a ground plane. The whole point of the current scene
  is an object on a plinth in a black studio. A horizon turns it back into
  a site standing in a landscape.
- **`Structure.tsx`** is the old skeletal renderer. That is the thing a
  designer called too AI generated. Do not.
- **`WorkLights.tsx`** puts light masts on the ground outside the building
  and needs `Atmosphere`'s haze for its cones to scatter in. The idea worth
  taking from it is the visible beam, on the lighting mast already standing
  on the plinth.
- **`Cloth.tsx`** and **`Dust.tsx`** — still unused. Cloth is verlet
  netting/banners with wind and pointer interaction; the scaffold netting is
  a static sheet for now and Cloth is the upgrade if it needs to move.

## The site stands somewhere now

`Surroundings.tsx`: a night sky with a horizon and stars, and a ground to
stand on. Efe's words were *right now it's just pitch black*, and he is
right — a black void reads as a product shot, not as a place, and a tower
in it has no distance and no scale.

- **The sky** is a back-side sphere with a two-band gradient and a tight
  glow sitting on the horizon line. **Below the horizon it falls away
  fast.** The first pass took thirty metres to get dark, and because the
  ground disc fades out with distance, that mid navy showed *through* the
  fade and read as a floodlit floor stretching to the horizon — a bright
  ground that was not the ground at all.
- **The ground is unlit**, with the spill from the site painted into its
  texture. As a lit standard material it cost a tenth of the frame rate on
  its own: it is the largest surface in the frame and it was evaluating
  every light plus the studio cube map, per pixel, for a surface nothing
  moves on. **Measured: 34.0 with no surroundings at all, 33.4 with the sky
  and stars and no ground, 29.8 with the lit ground, 33.1 with it unlit.**
  The sky was never the expensive part, which is the opposite of what it
  looked like before measuring.
- Not `Atmosphere.tsx` or `Ground.tsx`. Ground is a glowing setting-out
  grid — house style. Atmosphere is closer, and its haze is worth taking if
  the work lights ever get visible beams, but its horizon shell is built
  round a different scene scale.

### The name board

`bannerTexture` in textures.ts, hung on the hoarding on `site.viewSide` —
the one face guaranteed to point at the camera. Two things it has to do:

- **Shrink to fit.** The name is data, and at a fixed size "EFE EBOMWONYI"
  ran off the end of the board and lost its last letter.
- **Stand proud of the posts**, not of the panels. The posts stick out
  further than the sheeting and were cutting across it.

The board is drawn on a square canvas and cropped to a band of the right
aspect, because `make` only draws squares and a square texture stretched
onto a long board stretches the type with it.

### The hoarding, and what it exposed

`Hoarding.tsx`. Painted ply on posts with a capping rail, warning plates,
and a gated opening on the face the laydown is served across. Up from the
first frame — you hoard a site before you start. Blue, which is what half
the hoarding in the country is and what the reference site used; it sits at
the boundary rather than in the middle of it, so it frames the deck instead
of competing with the building, which is the opposite of what happened when
the crane was painted.

**A fence at the edge of the deck is a test of whether anything is actually
on the deck**, and two things were not:

- **The crane base.** It stands as close to the building as it can while
  clearing it, and the plinth only carried an apron on the laydown side, so
  the kentledge hung a metre and a quarter out in the black. Invisible from
  the front, where the crane always is. `plinth()` is now asymmetric on the
  crane axis as well as the laydown one — as much as the crane asks for on
  its side, the old margin on the other — and `Crane.tsx` clamps its base
  to the deck that is left, minus room for the fence to pass outside it.
- **The site dressing.** Cabin, skip, rebar, mast, cones and pallets are
  placed on bearings off the open face at radii that know nothing about the
  shape of the deck. Efe caught the cabin standing half in and half out of
  the fence. `insideHoarding` pulls each one in by its own footprint: the
  bearing decides where a thing belongs, the deck decides whether it fits.

Gate leaves were the first idea and cannot work. There is only 380mm of
deck outside the line, so a swung leaf hangs off the plinth — the exact
fault just fixed on the crane base — and swung inward it lands in the
laydown, because the gate belongs on the side the pile is served across. An
opening with a header over it reads as a gate on its own.

### The scaffold

Rebuilt, not switched on. The old one drew a single run with only the
standards at full height and everything dense confined to a working band,
because *a mesh in front of a frame drawn in 4cm steel simply hides it*.
That was right against the wireframe and is backwards against solid
concrete: a scaffold is supposed to read as a mesh in front of a solid, and
it is most of what makes a site look like a site.

Now: two rows of standards on base plates and sole boards, boarded at every
lift, ledgers and transoms, facade bracing that zigzags, guard rail, mid
rail and toe board, a ladder in the end bay, and debris netting on the
outer face where `run.netted`. Real sizes — 48mm tube, 225mm boards, a
guard rail at 950mm. It costs nothing to be right and the proportions are
half of why scaffolding reads.

Two things to know if you touch it:

- **It stands on the deck**, in a group offset by `DECK_Y`, not on the
  origin. The clip plane is world space, so it is set in world terms.
- **Galvanised, not near-black emissive.** The old tube colour was `#1e2635`
  with an emissive term — glowing line work again, and against pale concrete
  it would read as dark hairlines.

## Traps that cost real time

- **The old `concreteTexture` fills with `#6a7480`.** That is 0.15 in linear,
  so any material using it as a map lands near 0.10 albedo — asphalt. A lot of
  light was thrown at the building before this was measured rather than
  guessed at. `boardConcreteTexture` sits around 0.45. **Check the linear
  value of a texture before blaming the lights.**
- **ACES tone mapping crushes the midtones.** `THREE.NeutralToneMapping` holds
  mid greys. Exposure is 1.4.
- **Never toggle `visible` on a light.** three bakes the count of active lights
  into every shader program, so flipping one recompiles every material in the
  scene. The welding arc was doing it several times a second. Drive
  `intensity` to zero instead.
- **Coplanar faces z-fight.** The plinth top and the ground slab top were both
  at exactly y = 0 and the ground floor striped. `plinth().top` sits a reveal
  below the slab soffit.
- **three 0.186 removed `PCFSoftShadowMap`**, which r3f asks for by default.
  Ask for `shadows="percentage"`.
- **The `PerformanceMonitor` floor has to move when the scene grows.** It
  was 32 when this was a frame and a crane. With the scaffold, hoarding,
  ground, sky, crew and light shafts the scene runs 32 to 40 on the machine
  it is tuned on, so 32 sat inside the normal variance and the monitor spent
  its time stripping the bloom off a scene that was running fine. It is 26.
  **A floor inside the noise protects nothing and costs the look.**
- **Adding an environment map costs a sample on every standard material.** It
  took the scene from 47 to 38 fps, under the `PerformanceMonitor` floor.
  Clawed back by cutting the plinth uplights to two real lights (the eight lit
  discs are geometry), dropping shadow casting from cones/pallets/rebar, and
  lowering the monitor floor to 32. **45 fps** now.
- **An environment also adds fill**, so the key and ambient that were raised to
  fight a dark scene will clip every upward-facing slab to white once it is
  in. Rebalance after adding it.

## The composer multisampling blackout — do not undo this

`<EffectComposer multisampling={0}>` with `<SMAA />`. On Intel UHD through
ANGLE/D3D11, **any** multisampling above 0 makes the composer output a fully
black frame while the scene underneath is perfect. `rich` is `min-width:
768px`, so it only ever bit desktop. Fixed in 56b597e. If the thin steel ever
needs better AA than SMAA gives, raise DPR — not MSAA.

## How to actually see the site

**Do not use the desktop app's Browser pane.** It only paints while it is
actually composited, it is capped by however wide the pane happens to be in
the UI, and it drags Efe into resizing windows. A whole session was lost to
it: rAF never fires when it is hidden, so any `await` on a frame times out and
every damped value crawls.

**Use the CDP driver instead.** It lives in the repo at `tools/cdp.py` —
a pure-python WebSocket client, no packages. It used to be recreated in the
scratchpad every session; it is committed now, so improve that copy.

**Launch Chrome detached, from PowerShell `Start-Process`.** Backgrounding it
from the Bash tool with `&` puts it in that call's process group and it is
killed the moment the call returns — the debug port answers once and is gone
by the next command.

```powershell
Start-Process -FilePath "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList @(
  "--remote-debugging-port=9222",
  "--user-data-dir=$scratch\chrome-profile",
  "--no-first-run","--no-default-browser-check",
  "--window-size=1480,1000","--window-position=40,40",
  "--disable-features=CalculateNativeWinOcclusion",
  "http://localhost:3000")
```

```sh
python cdp.py --out shot.png --url http://localhost:3000 --scroll 0.45 --wait 5
python cdp.py --out shot.png --w 390 --h 844 --scroll 1 --wait 5   # a phone
python cdp.py --out shot.png --scroll 1 --mouse 900,520            # hover
python cdp.py --out shot.png --scroll 1 --mouse 900,520 --click
python cdp.py --out shot.png --scroll 1 --drag "950,450,-420,0"    # orbit
python cdp.py --out shot.png --scroll 0.8 --eval "window.scrollY"
python cdp.py --out shot.png --scroll 0.3 --clip "600,540,300,190" --zoom 4
```

`--clip` takes a viewport rectangle and a scale, which is the only way to
get a close look at something small: the renderer keeps drawing at the
pinned viewport, so nothing about the framing or the detail changes. It is
how the hook and the laydown were judged. Clip is in *document*
coordinates, so the driver adds the scroll offset for you.

Real GPU frames at any size, and Efe can work over the top of it. Things the
driver has to do, each learned the hard way:

- **`Page.bringToFront` and `Emulation.setFocusEmulationEnabled` before
  anything.** A hidden page has rAF throttled to about **one frame a second**.
  Three rounds were spent "fixing performance" that was never slow — the fps
  measurement was the bug. `--disable-features=CalculateNativeWinOcclusion`
  covers occlusion, not backgrounding.
- **Pin the viewport** with `Emulation.setDeviceMetricsOverride`. Note this
  forces `devicePixelRatio` to 1, so any `dpr` change is invisible to the
  measurement.
- **Wait for the canvas, not `readyState`.** A Turbopack recompile finishes
  long after the document is complete, and a capture taken early comes back as
  a ~13KB near-black PNG.
- **Re-assert the scroll just before capturing.** Focus emulation can pull a
  focused link into view during the settle and quietly move the shot.
- Measuring fps needs an armed counter read back in a **second** call — a
  promise that waits on rAF never resolves when rAF is the thing stalling.
  **Reload between runs.** Arming a second counter without one leaves the
  first rAF loop incrementing the same object and the numbers come back above
  the refresh rate. 38 fps in dev on this machine at every scroll position,
  measured against 67da2b9 as a control — the 45 in these notes was a
  different day, not a regression.
- **`urllib` cannot reach `127.0.0.1:9222`.** Chrome binds the debug port on
  `[::1]` only here, and `curl` resolving it is not evidence that Python
  will. Use `localhost`.
- **Scroll fractions are of `documentElement.scrollHeight`**, not
  `body.scrollHeight`. The sections are pulled up under the canvas with
  `-mt-[100vh]`, so the two differ by a viewport and `--scroll 1` lands a
  whole section short of the roof.

There is also `tools/measure.py`: a pure-stdlib PNG reader that
prints the first and last rows holding a lit pixel within a column band. It
is how the model's on-screen height was fitted to the phone stage. **Measure
the capture rather than reading it by eye** — eyeballing storey spacing was
out by 40% and sent a whole round of framing the wrong way.

Efe scrolling the real window while a capture runs will move the shot and can
trigger Rebuild. That is not a bug; ask before chasing it.

## Architecture

- `src/lib/site-generator.ts` — seeded site, massing, crane, scaffold, core.
- `src/lib/construction.ts` — scroll-to-build timeline. `floorProgress`,
  `cranePose`, `PLACED_AT 0.66`, `HOVER 0.55`, `PLANK`, the yard helpers.
- `src/lib/building.ts` — the building as parts, plus the plinth and the weld
  positions.
- `src/components/scene/` — `Building`, `Crane`, `Welding`, `Workers`,
  `SiteYard`, `StudioEnvironment`, `CameraRig`, `SiteScene`, `Pointer`.
- `src/lib/hover.ts`, `src/lib/orbit.ts` — module-level stores, the same
  pattern as `cursor` in `pulses.ts`. Which storey the pointer is on, and
  whether the camera is being dragged. **Not React state**: a pointer move
  that re-renders hands every `instancedMesh` a fresh `args` array, which is
  the rebuild that empties the matrix buffer.
- `src/components/overlay/FloorRail.tsx`, `ToppedOut.tsx` — the phone's floor
  navigation, and the one line that says the orbit is off its leash.

### Things that are load-bearing and easy to break

- **Instance matrices are filled from the frame loop**, not an effect. r3f
  rebuilds an `instancedMesh` whenever its `args` change and the replacement
  has an empty matrix. This cost hours once already.
- **The loader has a 2.5s fallback** (`Ready` in `SiteScene.tsx`). Without it a
  background tab never fires rAF and the visitor gets a black page.
- `Instances.tsx` still fills from a `useLayoutEffect`. It has not bitten, but
  it is the same hazard.
- Rewriting the tail of `building.ts` once truncated `weldLevel`/`weldSpots`
  off the end. TypeScript caught it; run it after any bulk file rewrite.

## Things Efe has removed

- **The topped-out hint.** A line that faded in at the end saying the orbit
  was free. He did not like it; it is gone, component and all. The orbit is
  still free — see *Free orbit*.

  **Do not reintroduce a tutorial.** But note what the reference does with
  the same problem: *N.B. this drawing is live. drag the track, pull a
  keyframe. nothing here is precious.* Permanent, in the annotation voice,
  and it sounds like a person. That is a different thing from a tooltip
  that fades in to tell you how to use the page, and it is probably the
  form the invitation should eventually take here. Ask before building it.

## Outstanding

In the order Efe wants them.

### Finish the front page

1. **Audit it.** He rates it a 6. Find the rest of the gap; the named items
   are only a start. See *Read this first*.
2. **Fix the crane hand-over and the fast scroll.** One root cause, two
   symptoms. See *Known broken*.
3. **Place the building better**, and give the scroll something that talks.
4. **Links on every floor.** Needs four URLs from Efe.
5. **The annotation layer**, in the monospace voice the reference uses.
6. **Fix the night shift.** Reference to come. Until it lands the *Do not
   touch* rule stands; `CranePose.hitched` is optional precisely so that
   block has stayed byte-for-byte.

### Then the component yard

`/components`, at imdaryl.com's level of detail and count. A week is fine.
Do not start it before the front page is signed off.

### Loose ends, any time

- **Mobile.** Built and pushed, then parked: Efe has not decided what he
  wants there. Behind `md:` and the `tall` keyframe overrides, so it is
  self-contained if it needs reworking.
- The `metadataBase` warning in `next build`, plus an OpenGraph block. Ten
  minutes, and without it an X post has no preview card - which matters for
  a site whose whole purpose is being seen.
- Load time. 1.4s in production. Chase only if Efe finds it slow.
- `Instances.tsx` still fills from a `useLayoutEffect` rather than the frame
  loop. It has not bitten, but it is the same hazard as the blank building.

## Recent history

```
c5c6c0d the arrival holds the whole crane
7a9f76c the crane stopped teleporting between the fourth floor and the end
60cdf21 the crane goes back to dark, and keeps what actually fixed it
0bfb348 five things Efe circled, and the top floor gets a lift at last
34ac10c a crane that reads as a machine, and a lift that starts on the pile
7dd62d2 a phone gets its own shot of the site, and a lift panel to travel in
9615260 once it has topped out, the orbit comes off its leash
ae47a4f point at a storey and it tells you whose floor it is
67da2b9 a deck that has been worked on, and a mast that actually lights it
272bc60 the laydown stands clear of the building, so the lift has a journey
3c3de49 fewer lights and casters, and a balance that does not clip the slabs
0652560 a studio environment, so the glass has something to give back
011d62a the crane lifts a piece of the floor, on a base wide enough to stack
c013892 a crane that stands on the site and stays in the shot while it works
cced74e the core climbs off the slab, and the corners burn off as it lands
dc82095 light the building properly, it was reading as a silhouette
```

## What working with Efe is like

He judges by eye, from screen recordings, and he is right almost every
time. When he says something is off, it is off — go and find the cause
rather than tuning numbers. Show him the change, do not describe it. He
would rather hear "this is still wrong and here is why" than a confident
summary of work that did not land.

He has asked twice for more judgement, not less: pick the best option and say
why, flag problems the moment you see them rather than burying them in a
report, and do not mirror his opinion back at him. He has also asked to be
asked before a big detour — but not to be stopped between steps of an agreed
list.
