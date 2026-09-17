# Build site — handoff

Working notes for the scroll-to-build front side. Delete when it stops being
useful.

## Where this is

Next.js 16 App Router, TypeScript, Tailwind v4, three.js via
react-three-fiber, Framer Motion. Dev server `npm run dev` on port 3000.
Everything committed and pushed on `main`.

The front side is **a building made of code, not a building rendered by
code**. Dark void, thin skeletal structure engineered live as you scroll,
floor by floor, bottom to top. The crane carries each floor's frame in and
snaps it down. Light is feedback: dark by default, glow on events, fade.
Efe rates it out of 10 and it has to make people stop — portfolio, X, job
visibility. It was a 5, then a 6; the last few passes moved it but it is
not there.

## Do not touch

- The night-shift game: `src/lib/stack-game.ts`,
  `src/components/scene/StackGame.tsx`, `src/components/overlay/NightShift.tsx`.
  The `game.active` block in `Crane.tsx` stays byte-for-byte.
- The component yard: `src/app/components/`, `src/components/yard/`.

## Ground rules

- Small conventional commits directly on `main`, pushed after each. Never a
  branch. Nothing in messages or metadata that reads as AI.
- `npx tsc --noEmit -p .` and `npm run lint` before every commit.
- Bash heredocs with backticks or apostrophes break on this machine. Write
  python patch scripts to the scratchpad and run them with `python`.

## Status: the regression was reverted in 91d9c35

Efe confirmed from a recording that the structure looked better a few
commits earlier. Cause identified and undone: the shaders are now back to
their 35a6213 state — the frame he called "very good, almost there" — while
keeping the blank-building fix (544251a), which only touched components.

What was wrong, for when these ideas get retried:

- **389cbf7 curtain wall + deck** pushed skin opacity far too high (plate
  alpha 0.88, spandrel 0.95). The smoked glass became milky white plastic
  and the lower floors turned into featureless pale slabs. The curtain wall
  idea is good; the alphas need to be a fraction of that.
- **044f748 cladding** hid most of the frame on finished floors. Efe's own
  idea and still right, but stacked with the opacity above it subtracted
  everything at once — frame gone *and* glass opaque leaves nothing to look
  at. Retry it alone, gently, with the glass still dark.
- Between them the active floor's columns also blew out to neon lemon
  yellow instead of sodium orange.

Lesson: these were two subtractive changes shipped back to back without
being judged together. Change one thing that removes detail, then look.

## Earlier notes on the same regression

Efe says the building looks **worse now than it did a few commits ago**.
Prime suspect, in order:

1. **`389cbf7` curtain wall + deck.** Raised skin opacity a lot: plate
   alpha up to `0.88`, spandrel band up to `0.95`. Likely turns the lower
   floors into solid muddy boxes and buries the frame. Cheapest test:
   `git revert 389cbf7`, look, then re-apply with much lower alphas.
2. **`044f748` cladding.** Hides most of the frame on floors below the one
   being built (`keep = mix(1.0, bones, clad)`), which was Efe's own idea
   and is right in principle. Combined with (1) the two may be
   over-subtracting: frame hidden *and* glass opaque leaves nothing to look
   at. If reverting (1) alone is not enough, soften `bones` upward.

Both are in the skin/member shaders, so they are cheap to dial. Get a
screen recording from Efe before and after — his recordings have been by
far the most reliable signal in this project.

## THE TARGET — read this before changing anything

Efe supplied a reference (two panels, "Real-time assembly" and "Exploded
view"; ask him to re-share it). Panel A is the front side we are building.
His words: *"it is a beautiful structure and I am not talking about the
luminosity but the structure."* So the gap is geometry and composition, not
light. Stop tuning colour and glow — that part is close enough.

What the reference has that we do not:

1. **Density.** Theirs is a fine mesh. Every bay is subdivided, every face
   is gridded, and the eye reads fabric rather than sticks. Ours is sparse:
   a handful of beams per floor. This is the single biggest gap. More
   elements at smaller scale, not thicker ones.
2. **Nodes at every intersection.** Hundreds of small bright points where
   members cross. A huge part of why theirs reads as precise engineering.
   Ours has a few per floor.
3. **Proportion.** Theirs is a tower — clearly taller than wide. Ours is
   squat: five floors on a wide plate reads as a low box. Either more
   floors, or a smaller footprint, or both.
4. **Glass as discrete framed panels.** Theirs is a unitised curtain wall —
   many individual rectangles, each with its own frame, stacked in a grid.
   Ours is one big quad per bay. (The 389cbf7 attempt at this was right in
   spirit and wrong in execution: it went opaque instead of staying a fine
   frame on dark glass.)
5. **An interior.** Theirs has partitions, rooms, stairs and furniture-scale
   objects glowing inside the volume. Ours is completely hollow, which is
   why it reads as a diagram. Even crude interior partitions would
   transform the depth.
6. **A glazed circulation core** running the full height as a distinct
   shaft, separate from the plates. We have a core in the data but it does
   not read.
7. **Slab plates that overhang the glass**, with a grid drawn on the plate
   surface, so each floor is a bright horizontal plane.
8. **Construction-drawing annotation:** dotted leader lines running off the
   structure into space, dimension lines, small callouts. Distinctive and
   cheap — pure line work, no lighting.
9. **A few detached panels floating near the building**, as if waiting to be
   placed. We deleted the old floating fragments; the reference shows the
   controlled version of that idea.

Suggested order of attack: density and nodes first (biggest gap, contained
to src/lib/structure.ts), then proportion, then the interior, then annotation
lines. The curtain wall and cladding retries come after those.

## How to actually see the site

**Do not trust a single capture.** Hard-won:

- The dev server goes stale after a batch of edits and silently serves a
  broken scene. After any compile error, `rm -rf .next` and restart —
  restarting `next dev` alone does **not** clear the Turbopack cache. A
  whole session was lost to this.
- The desktop app's Browser pane and Claude-in-Chrome are *different
  browsers*. Reading the console of one while testing the other tells you
  nothing.
- An occluded Chrome window barely runs a frame loop, so anything damped
  (camera, scaffold clip, lamp aim) needs frames pumped into it before a
  screenshot means anything. Take 10–16 throwaway screenshots, keep the last.
- `PerformanceMonitor` disables bloom when FPS drops. Under a loaded machine
  that makes the whole scene near-black and looks exactly like a code bug.
  It burned many rounds. If a capture is black, suspect this first.
- A scratch CDP driver was used: launch Chrome with
  `--remote-debugging-port=9222` and drive it over a small pure-python
  WebSocket client. Screenshots are real GPU frames at any scroll position.
- **Frame rate does not tell you the window is painting.** An occluded window
  still reports 40-115fps from rAF while `Page.captureScreenshot` hands back a
  blank frame — and underneath it the scene is in perfect health: camera
  finite and in the right place, `uProgress` correct, draw calls flowing,
  console clean. It reads exactly like a rendering bug and it is not one.
  `Page.bringToFront` is not enough either; it raises the tab inside its
  window, not the window above other apps. The only reliable test: take two
  captures 1.2s apart and compare bytes. A live scene never repeats a frame,
  so identical captures mean the frame is a lie — retry, do not believe it.
  This cost a long detour here: Rebuild looked completely broken, blanking the
  whole scene including the ground plane, and **Rebuild is fine**. Every black
  frame was the capture.
- `--headless=new` with `--enable-unsafe-swiftshader` looked like the way out
  of that and is not: every capture came back identical and empty. Drive a
  real window.
- `location.reload()` restores the scroll position. Reload while parked at the
  roof and the site tops out before you have looked at anything, so a "first
  pass" capture is really a finished tower. Scroll to 0 and set
  `history.scrollRestoration = 'manual'` before reloading.

Measured load, on this machine:

| | |
|---|---|
| dev server | 2.84s (2.5s of that is the loader fallback timing out) |
| production `next build` + `next start` | 1.38–1.44s |

## Architecture

- `src/lib/site-generator.ts` — seeded site, massing plan, crane, scaffold,
  core, per-floor data.
- `src/lib/construction.ts` — scroll-to-build timeline. `floorProgress`,
  `cranePose`, `PLACED_AT 0.66`, `HOVER 0.9`.
- `src/lib/structure.ts` — packs every member, node and skin panel into
  typed arrays with timing. Section sizes at the top drive the whole line
  hierarchy: `COLUMN .085 / OUTLINE .085 / FASCIA .036 / BEAM .032 /
  DIAG .018 / RAIL .016`.
- `src/components/scene/Structure.tsx` + `shaders/member.ts` +
  `shaders/skin.ts` — three instanced draws. Assembly, flashes, pulses,
  cladding, x-ray, shear, tear and tint all run in the shaders.
- `Crane.tsx`, `WorkLights.tsx`, `Atmosphere.tsx`, `Scaffold.tsx`,
  `Pointer.tsx`, `Bursts.tsx`, `Dust.tsx`, `Ground.tsx`, `CameraRig.tsx`,
  `SiteScene.tsx`.

### Things that are load-bearing and easy to break

- **Instance matrices are filled from the frame loop**, not an effect
  (`Structure.tsx`, `fill()`). r3f rebuilds an `instancedMesh` whenever its
  `args` change and the replacement has an empty matrix. Filling from an
  effect caused a blank building roughly half of all loads for hours. Do
  not move it back into an effect.
- **The loader has a 2.5s fallback** (`Ready` in `SiteScene.tsx`). Without
  it a background tab never fires rAF and the visitor gets a black page.
- **The scene must stay legible with bloom off.** Base steel carries the
  drawing; bloom only lifts events. It used to rely on bloom entirely and
  went black on any machine that dipped below 40fps.
- **Columns take the mass offset but not the twist**
  (`columnsFor(grid, offset, 0, …)`). Rotating them too gave every floor its
  own corner posts standing on nothing — the building read as floating trays.
- **Thin members and a distant camera do not mix.** Past ~25 units the 4cm
  steel goes sub-pixel and the building disappears. Stand-back shots gain
  their view by dropping and flattening, never by retreating.

## Outstanding — Efe's list, his priority order

1. ~~Latch the build at the top.~~ **Done.** The smoothed scroll value is
   two clocks now. `section` still follows the scroll both ways and drives
   the camera; `build` drives construction and only runs forward, stopping
   the moment the last level is complete (`toppedOutAt`, one frame past the
   top level's window). Scrolling back down moves the camera over a finished
   building instead of dismantling it. Rebuild drops the latch *and* sends
   the page back to the ground, because once a site tops out that is the only
   way to watch the next one go up. Camera, scroll shear and the warm band
   still read `section`; the crane, scaffold, work lights, floor progress and
   the glazing read `build`.
2. **Free orbit once finished.** Drag is clamped to ±0.45 rad with no
   vertical control. After topping out it should unlock: full 360°, vertical
   tilt within limits, scroll-to-zoom.
3. **Hover on the finished building.** Suggested and not yet agreed: extend
   the existing storey x-ray so pointing at a floor lights it as a *project*
   — glass opens, skeleton returns, plate edge pulses, project name pinned
   to the slab in 3D, click to open. Turns the finished tower into the
   navigation.
4. **Load time.** 1.4s in production. Chase only if Efe still finds it slow;
   profile rather than guess (structure build on the main thread, three
   shader compiles).
5. **Phase 3 and beyond, never started:** site hoarding carrying the
   wordmark, uplit — this was the best idea from Efe's old reference
   recording and it also retires the header-collision problem currently
   patched in CSS. Then material stacks at the site boundary. Human figures
   for scale were explicitly deferred.

Also open: mobile is deliberately untouched and Efe wants something
different there, not the desktop experience shrunk.

## Recent history

```
389cbf7 curtain wall with spandrels and mullions, profiled deck   <- suspect
544251a fill instance matrices from the frame loop                <- keep
044f748 clad floors keep edges lose frame; hover x-rays a storey  <- suspect
35a6213 slab edges, edge protection, one colour system per floor
445b0d1 real contrast in line work, sodium against steel, glass
e5641cd commit to steel and sodium, glass edge, frame floats clear
49e854a floor reads as a structural grid, stray bracing out
91d5380 columns run straight through the stack
6a871e3 scaffold struck back to standards and one working lift
0d1824c keep each mass over the grid below it
ab37f08 massing moves big enough to read
```

## What working with Efe is like

He judges by eye, from screen recordings, and he is right almost every
time. When he says something is off, it is off — go and find the cause
rather than tuning numbers. Show him the change, do not describe it. He
would rather hear "this is still wrong and here is why" than a confident
summary of work that did not land.
