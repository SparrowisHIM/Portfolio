# Architecture

How Portfolio v1 is put together, and the things that are easy to break.

## Data flow

```
seed ──► generateSite()            src/lib/site-generator.ts
           │  massing, column grid, crane, plinth, lamp colour
           ▼
         buildParts()              src/lib/building.ts
           │  a flat list of placed boxes; each names the floor that owns it
           │  and when in that floor's progress it arrives
           ▼
scroll ──► useScrollProgress()     src/hooks/useScrollProgress.ts
           │  damped 0..N+1 "construction time"
           ▼
         floorProgress(), cranePose(), weldLevel()
           │                        src/lib/construction.ts
           ▼
         scene components read the build time from a ref in useFrame
```

React only re-renders on section changes. Everything that moves every frame
reads refs or module-level stores (`src/lib/hover.ts`, `orbit.ts`,
`pulses.ts`, `wind.ts`, `stack-game.ts`) inside `useFrame`.

## The construction timeline

Per floor `N`, in floor-local progress (`floorProgress(N, f)`):

```
0.05 – 0.51   perimeter columns grow up out of slab N-1
0.06          slings go on at the laydown
0.12          HITCH_AT: the plate leaves the pile
0.66          PLACED_AT: the crane lets go, slab N lands
0.66 – 0.92   the four corners of slab N are welded off
0.70 – 0.96   the core grows up off slab N
```

The core grows after the slab lands, not before. A core running a storey
ahead reads as a shaft floating in mid air.

## Scene modules

| Module | Role |
| --- | --- |
| `SiteScene.tsx` | Canvas, renderer, post-processing, performance monitor, loader gate |
| `Building.tsx` | One instanced draw per material; per-storey pick volumes for clicking |
| `Crane.tsx` + `lib/crane-parts.ts` | Steelwork geometry (pure) and the animated rig |
| `SiteYard.tsx` + `yard-layout.ts` | Laydown pile and yard dressing; a pure placement solver |
| `Welding.tsx` | Arc, pooled sparks (one `Points` buffer), cooling glow |
| `Workers.tsx` | The crew, placed on the working scaffold lift |
| `Scaffold.tsx`, `Hoarding.tsx` | Scaffold runs (clip-plane reveal) and the site fence |
| `CameraRig.tsx` | Scroll-driven keyframed camera and the drag orbit |
| `StackGame.tsx` + `lib/stack-game.ts` | Night Shift renderer and its framework-free engine |
| `GameEnvironment.tsx` | The night city around the game platform |

## Load-bearing details

- **Instance matrices are written from the frame loop, not an effect.** r3f
  rebuilds an `instancedMesh` whenever its `args` change, and the new one has
  empty matrices. Any caching of instance data must be keyed on the mesh
  object as well (see `SiteYard`).
- **Never toggle `visible` on a light.** three.js bakes the number of active
  lights into every shader program, so flipping one recompiles the whole
  scene. The welding arc drives `intensity` to zero instead.
- **`<EffectComposer multisampling={0}>` with SMAA.** On Intel UHD through
  ANGLE/D3D11, any composer multisampling above 0 outputs a black frame while
  the scene underneath renders fine. If the thin steel needs better AA, raise
  DPR, not MSAA.
- **The loader has a 2.5 s fallback.** A background tab never fires
  `requestAnimationFrame`, so without it the visitor would get a black page.
- **three 0.186 removed `PCFSoftShadowMap`**, which r3f asks for by default.
  The canvas asks for `shadows="percentage"`.
- **Tone mapping is `NeutralToneMapping` at 1.4 exposure.** ACES crushed the
  mid greys that concrete lives in.
- **Check a texture's linear value before blaming the lights.** A `#6a7480`
  fill is 0.15 linear, which is asphalt, not concrete.
- **The `PerformanceMonitor` floor has to sit below normal variance.** A floor
  inside the noise protects nothing and strips the bloom off a scene that is
  running fine.
- **Small instanced things shouldn't cast shadows.** Taking hats, heads and
  reflective strips out of the crew's shadow pass saved about eight frames.
- **Coplanar faces z-fight.** The plinth top sits a reveal below the ground
  slab's soffit for that reason.

## Seeing the real frame

The desktop app's browser pane only paints while it's visible, so it's
unreliable for screenshots. `tools/cdp.py` drives a separate Chrome window
over the DevTools protocol and captures real GPU frames at any size:

```bash
chrome --remote-debugging-port=9222 --user-data-dir=<temp dir> http://localhost:3000
python tools/cdp.py --out shot.png --w 1440 --h 900 --scroll 0.5 --wait 4
```

Scroll fractions are of `documentElement.scrollHeight`.
