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

**As of this session the building is working and Efe is happy with it.**
Hovering a finished storey names its project, the orbit comes off its leash
once the site tops out, and a phone gets its own framing of the model with a
floor rail to travel in. What is left is in *Outstanding*, and the biggest
thing on it is a game Efe wants to rebuild himself.

## Do not touch

- The night-shift game: `src/lib/stack-game.ts`,
  `src/components/scene/StackGame.tsx`, `src/components/overlay/NightShift.tsx`.
  The `game.active` block in `Crane.tsx` stays byte-for-byte.
  **Efe has said the game is broken and will be rebuilt from scratch later.**
  Do not spend time on it; do not let it block anything.
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
- `src/components/scene/Welding.tsx` — the arc at the joint being made, plus
  the four corners of a plate burning off for ~2.6s as it lands.
- `src/components/scene/Workers.tsx` — two figures: a welder at the arc, a
  banksman on the highest slab with his arm up while the load is on the hook.
- `src/components/scene/SiteYard.tsx` — the laydown stack, cabin, skip, rebar,
  lighting mast, cones, pallets.
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
- Mast is `totalHeight + 2.9..3.7`. Taller and the jib spends the whole
  scroll above the frame.
- Carries a **precast plate 7.4 × 3.2m**, about a quarter of the floor. It
  used to carry a plate the size of the entire floor plate, which was the
  largest object in the hero frame; then a 3.4m plank, which was too small to
  look like it was building anything.
- Picks off a **real stack** that shrinks as the building goes up.

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
```

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

## Outstanding

Hover navigation, free orbit and mobile are done — see the sections above.
What is left:

1. **The night-shift game**, which Efe will rebuild as a whole game. Still do
   not touch the files listed under *Do not touch*.
2. Load time. 1.4s in production. Chase only if Efe finds it slow.
3. The `metadataBase` warning in `next build`. One line in `layout.tsx` once
   there is a real domain.
4. `Instances.tsx` still fills from a `useLayoutEffect` rather than the frame
   loop. It has not bitten, but it is the same hazard as the blank building.

## Recent history

```
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
