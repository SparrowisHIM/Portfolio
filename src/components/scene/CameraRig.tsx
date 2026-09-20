"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Site } from "@/lib/site-generator";
import { HERO } from "@/lib/site-generator";
import { floorProgress, smoothstep } from "@/lib/construction";
import { game, stackTop } from "@/lib/stack-game";
import { orbit } from "@/lib/orbit";

type Keyframe = {
  /** Height the camera looks at. */
  lookY: number;
  /** Camera height above the look point. */
  rise: number;
  /** Orbit radius. */
  radius: number;
  /** Orbit angle in radians. */
  angle: number;
  /**
   * How much of the portrait correction this shot wants, 0 to 1. A floor
   * plate is a wide subject and needs the camera back on a narrow screen;
   * the finished tower is tall and barely does.
   */
  fit: number;
  /**
   * What this shot becomes on a phone held upright, blended in by how narrow
   * the screen is.
   *
   * A shot composed for a landscape frame does not simply crop to a portrait
   * one. The arrival is the case that proves it: nothing is built yet, so the
   * subject is a four metre deck, and in a frame twice as tall as it is wide
   * no amount of backing off or sliding up turns that into a composition —
   * it is a strip of light with black above and below. The phone needs a
   * different shot of the same site, and the tall thing on a site before
   * anything is built is the crane.
   */
  tall?: Partial<Omit<Keyframe, "tall">>;
};

type CameraRigProps = {
  site: Site;
  /** Smoothed section value: 0 ground, 1..N floors, N+1 roof. */
  section: RefObject<number>;
  /** Construction time, which stops once the site tops out. */
  build: RefObject<number>;
  /** Latched once the last level is complete. Unlocks the orbit. */
  topped: RefObject<boolean>;
  sectionCount: number;
  /** When false the camera snaps to its target instead of easing. */
  animate: boolean;
  /** The intro fly-in waits until the loader is gone. */
  started: boolean;
  /**
   * Fraction of the orbit radius to slide the camera sideways, so the tower
   * sits beside the text column instead of behind it.
   */
  shiftX?: number;
  /** Fraction of the orbit radius to slide the camera down, lifting the tower on screen. */
  shiftY?: number;
};

const INTRO_SECONDS = 2.6;

/**
 * How far the drag may swing the camera.
 *
 * While the site is going up the orbit is on a short leash: the build has a
 * front, the scaffolded faces and the laydown are not the shot, and the
 * keyframes are doing the directing. Once it has topped out there is nothing
 * left to direct and the model is finished on every face, so the leash comes
 * off and the drag gets a vertical axis too.
 */
const LEASH = 0.45;
/** Elevation of the camera above the look point, as an angle. */
const PITCH_LOW = -0.2;
const PITCH_HIGH = 1.05;
/** Past this much pointer travel a press is a drag, not a click. */
const DRAG_SLOP = 4;

/*
  How far back the whole run sits on a landscape screen.

  The model was sixty-five percent of the frame's width and running off the
  right edge with no margin at all, so it covered the middle of the picture
  and left the copy column nothing to sit beside. One number for every
  shot, because they all had the same problem and they have to stay in
  proportion to each other — pulling one keyframe back would just break the
  rhythm between them.

  It eases out as the screen narrows and is gone by portrait: the phone has
  its own framing through the keyframes' `tall` overrides and does not have
  a copy column to make room for.
*/
const WIDE_BACK = 1.24;

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * A keyframe eased toward its portrait version by `p`.
 *
 * Written into a scratch object rather than returned fresh, because this
 * runs twice a frame for the whole life of the page.
 */
function shape(out: Keyframe, k: Keyframe, p: number) {
  const t = k.tall;
  out.lookY = t?.lookY === undefined ? k.lookY : lerp(k.lookY, t.lookY, p);
  out.rise = t?.rise === undefined ? k.rise : lerp(k.rise, t.rise, p);
  out.radius = t?.radius === undefined ? k.radius : lerp(k.radius, t.radius, p);
  out.fit = t?.fit === undefined ? k.fit : lerp(k.fit, t.fit, p);
  // Angles take the short way round, or turning the phone walks the camera
  // the long way about the site.
  out.angle =
    t?.angle === undefined
      ? k.angle
      : k.angle + shortestTurn(t.angle - k.angle) * p;
  return out;
}

/** The same turn expressed as the smaller of the two ways round. */
function shortestTurn(delta: number) {
  const wrapped = ((delta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return wrapped;
}

/**
 * How far back each floor stands, 0 for close on the work and 1 for the full
 * elevation. Alternating gives the climb a rhythm; a run of identical shots
 * reads as one long shot.
 */
const RHYTHM = [0.35, 1, 0.5, 0.9, 0.3];

export function buildKeyframes(site: Site): Keyframe[] {
  // A three-quarter view, held. The building is an object on a plinth now,
  // not a tower you stand under, and an object shot wants the whole of its
  // subject in frame — the old rig deliberately cropped, because cropping is
  // what made thin line work read as big. Solid concrete does not need that,
  // and the proportion is only worth having if it is visible.
  const sweep = 0.55;
  const start = site.viewAngle - sweep / 2;
  const step = sweep / (site.floors.length + 1);
  // Enough distance to hold roughly twenty-four units of height at this fov.
  // The old ceiling of about twenty-five units was set by 4cm steel going
  // sub-pixel; the smallest thing here is a 5cm handrail against a 44cm
  // column, so standing back no longer costs the drawing.
  const far = 43;
  // Standing opposite the crane puts its mast behind the tower instead of
  // beside it. On a landscape screen there is room for both; upright there
  // is not, and a crane cropped off the edge of the frame is a crane that
  // has stopped working.
  const facingCrane = Math.atan2(-site.crane.position[0], -site.crane.position[2]);
  const frames: Keyframe[] = [
    /*
      Arrival: the whole crane, standing over a site nothing has been built
      on yet.

      The subject is not the deck. Before a single floor is up the deck is
      four metres tall and the crane is thirty, and a shot framed on the
      deck cut the mast off at the top of the frame — which was fine while
      the crane was a dark silhouette and became the first thing you saw
      once it was not. Framed on the crane, the arrival is a poster: the
      wordmark down the left, the whole machine down the right, the laydown
      and the cabin at its feet, and the hook hanging in the middle of the
      air the building is about to fill. It also gives the first section
      something to do — scrolling to floor one is a dolly in from here.

      lookY sits at the middle of the subject so the margins come out even:
      the crane tops out at thirty, the plinth bottoms out at about minus
      one, and the frame holds thirty-seven.
    */
    {
      lookY: 14.1,
      rise: 3.2,
      radius: far * 1.1,
      angle: site.viewAngle + HERO.angleOffset * 0.5,
      fit: 0.9,
      // Upright, the arrival turns to face the crane down the barrel: stand
      // opposite it and it rises out of the middle of the deck instead of
      // running off the left edge, which gives the shot the one vertical
      // the site has before a single floor is up.
      tall: {
        lookY: 14.8,
        rise: 3.0,
        radius: far * 1.54,
        fit: 0,
        angle: facingCrane,
      },
    },
  ];
  // Floors: rise with the build so the working level stays around the upper
  // third, without ever losing the base.
  site.floors.forEach((floor, i) => {
    const back = RHYTHM[i % RHYTHM.length];
    // Aimed a little high, so the jib and the hook stay in the shot with
    // the level being worked on. A crane you cannot see is not working.
    const lookY = lerp(floor.y * 0.5 + 4.6, site.totalHeight * 0.54, back);
    const radius = lerp(far * 0.82, far, back) + i * 0.5;
    frames.push({
      lookY,
      rise: lerp(2.2, 4.6, back) + i * 0.3,
      radius,
      angle: start + step * (i + 1),
      // A close shot on a floor is looking at a plate, which is wide; a long
      // one is looking at the stack, which is tall. Only the first needs the
      // camera back on a narrow screen.
      fit: lerp(0.85, 0.55, back),
      // Upright, every floor lifts and stands back a little. The copy card
      // has the bottom third of the screen, so the shot has to hold both the
      // level being worked and the hook over it inside what is left — and
      // the three-quarter view is worth keeping to do it, because swinging
      // round to put the mast behind the tower flattens the elevation and
      // still leaves the jib above the frame.
      tall: { lookY: lookY + 3.4, radius: radius * 1.12 },
    });
  });
  // Roof: the finished elevation, square on to the clear face.
  frames.push({
    lookY: site.totalHeight * 0.46,
    rise: 5.0,
    radius: far * 1.1,
    angle: start + sweep,
    // Almost none. Vertical field of view does not change with aspect, and
    // this shot is bound by the height of the tower, not its width — backing
    // off for a portrait screen here only makes the subject a thumbnail.
    fit: 0.6,
  });
  return frames;
}

/**
 * Scroll guides the camera: it starts low, rises with the build, drifts
 * round the open face, comes in on the floor being built and pulls back as
 * that floor completes. Drag adds a little orbit; the pointer adds parallax.
 */
export function CameraRig({ site, section, build, topped, sectionCount, animate, started, shiftX = 0, shiftY = 0 }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const domElement = useThree((s) => s.gl.domElement);
  const frames = useMemo(() => buildKeyframes(site), [site]);
  const intro = useRef(animate ? 0 : 1);
  const pointer = useRef({ x: 0, y: 0 });
  const current = useRef<Keyframe | null>(null);
  const look = useRef(new THREE.Vector3());
  // Scratch for the two keyframes being blended toward their portrait forms.
  const shapeA = useMemo<Keyframe>(() => ({ lookY: 0, rise: 0, radius: 0, angle: 0, fit: 0 }), []);
  const shapeB = useMemo<Keyframe>(() => ({ lookY: 0, rise: 0, radius: 0, angle: 0, fit: 0 }), []);
  const drag = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    travel: 0,
    yaw: 0,
    yawAt: 0,
    pitch: 0,
    pitchAt: 0,
  });

  // A rebuild is a different site standing in a different place. Carrying the
  // old orbit over would open the new one from behind.
  useEffect(() => {
    const state = drag.current;
    state.yaw = 0;
    state.yawAt = 0;
    state.pitch = 0;
    state.pitchAt = 0;
    orbit.free = false;
    orbit.dragging = false;
  }, [site]);

  // Drag to walk round the site. Sideways always; up and down once the site
  // has topped out and there is a finished object to walk round.
  useEffect(() => {
    const state = drag.current;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || game.active) return;
      state.active = true;
      state.travel = 0;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!state.active) return;
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.travel += Math.abs(dx) + Math.abs(dy);
      // Below the slop this is still a press on a storey, not a swing of the
      // camera, so the hover label stays up and the click lands.
      if (state.travel > DRAG_SLOP) orbit.dragging = true;
      const leash = orbit.free ? Math.PI : LEASH;
      state.yaw = THREE.MathUtils.clamp(state.yaw - dx * 0.003, -leash, leash);
      if (orbit.free) {
        state.pitch = THREE.MathUtils.clamp(state.pitch + dy * 0.004, -0.5, 1.0);
      }
    };
    const up = () => {
      state.active = false;
      orbit.dragging = false;
    };
    domElement.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      domElement.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      orbit.dragging = false;
    };
  }, [domElement]);

  useFrame((state, delta) => {
    const f = section.current ?? 0;
    const i = Math.min(frames.length - 2, Math.max(0, Math.floor(f)));
    const t = f - i;
    // Portrait screens see a narrower slice. How far to back off depends on
    // the shot: each keyframe says how much of the correction it wants, and
    // may hand over a different shot entirely.
    const aspect = state.size.width / state.size.height;
    // 0 on anything landscape, 1 on a phone held upright, and a real blend
    // across the tablet widths in between — a shot that snapped at a
    // breakpoint would jump while the device was being turned.
    const upright = THREE.MathUtils.clamp((1.3 - aspect) / 0.68, 0, 1);
    const a = upright > 0 ? shape(shapeA, frames[i], upright) : frames[i];
    const b = upright > 0 ? shape(shapeB, frames[i + 1], upright) : frames[i + 1];
    // A portrait shot crops the sides of a floor plate rather than backing
    // off until the tower is a thumbnail: close and cropped reads, distant
    // and complete does not.
    const need = aspect < 1.3 ? THREE.MathUtils.clamp(1.3 / aspect, 1, 1.35) : 1;
    const fit = (1 + (need - 1) * lerp(a.fit, b.fit, t)) * (1 + (WIDE_BACK - 1) * (1 - upright));
    const target: Keyframe = {
      lookY: lerp(a.lookY, b.lookY, t),
      rise: lerp(a.rise, b.rise, t),
      radius: lerp(a.radius, b.radius, t) * fit,
      // A narrow screen cannot afford to walk round onto a scaffolded face,
      // so it keeps most of the swing but stays near the clear view angle.
      angle: site.viewAngle + (lerp(a.angle, b.angle, t) - site.viewAngle) * (aspect < 1.3 ? 0.55 : 1),
      fit,
    };

    // Come in while a floor is being framed, pull back as it completes. On a
    // topped-out site every floor reads as complete, so this is the long shot.
    const active = Math.round(f);
    if (active >= 1 && active < sectionCount - 1) {
      const p = floorProgress(active, build.current ?? f);
      const framing = smoothstep(0.2, 0.62, p) * (1 - smoothstep(0.66, 0.95, p));
      const done = smoothstep(0.66, 0.98, p);
      target.radius *= 1 - 0.05 * framing + 0.06 * done;
      target.rise += 0.3 * done;
    }

    // Night shift: hold on the top of the stack and drift slowly round it.
    if (game.active) {
      const roof = frames[frames.length - 1];
      target.lookY = stackTop() - 0.6;
      target.rise = 3.2;
      target.radius = (20 + game.score * 0.25) * fit;
      target.angle = roof.angle - 0.3 + Math.sin(game.time * 0.12) * 0.35;
    }

    // Intro: start far and low, ease in to the ground-level shot.
    if (intro.current < 1) {
      if (started) intro.current = Math.min(1, intro.current + delta / INTRO_SECONDS);
      const e = easeOutExpo(intro.current);
      target.radius = lerp(target.radius + 40, target.radius, e);
      target.rise = lerp(target.rise + 4, target.rise, e);
      target.angle = lerp(target.angle - 0.5, target.angle, e);
    }

    // Gentle pointer parallax.
    pointer.current.x = THREE.MathUtils.damp(pointer.current.x, state.pointer.x, 3, delta);
    pointer.current.y = THREE.MathUtils.damp(pointer.current.y, state.pointer.y, 3, delta);

    const smoothing = animate ? 3.5 : 1000;
    const c = current.current ?? { ...target };
    c.lookY = THREE.MathUtils.damp(c.lookY, target.lookY, smoothing, delta);
    c.rise = THREE.MathUtils.damp(c.rise, target.rise, smoothing, delta);
    c.radius = THREE.MathUtils.damp(c.radius, target.radius, smoothing, delta);
    c.angle = THREE.MathUtils.damp(c.angle, target.angle, smoothing, delta);
    current.current = c;

    // The leash comes off the moment the site tops out. The night shift is
    // its own shot and keeps the short one.
    orbit.free = (topped.current ?? false) && !game.active;

    const d = drag.current;
    const smoothDrag = animate ? 6 : 1000;
    d.yawAt = THREE.MathUtils.damp(d.yawAt, d.yaw, smoothDrag, delta);
    d.pitchAt = THREE.MathUtils.damp(d.pitchAt, orbit.free ? d.pitch : 0, smoothDrag, delta);
    const angle = c.angle + pointer.current.x * 0.06 + d.yawAt;

    // Radius and rise are the two legs of a right angle on the look point,
    // so tilting is a rotation of that pair rather than a lift: swing them
    // together and the camera rides over the model at a constant distance
    // instead of drifting away from it as it climbs.
    const reach = Math.hypot(c.radius, c.rise);
    const elevation = THREE.MathUtils.clamp(
      Math.atan2(c.rise, c.radius) + d.pitchAt,
      PITCH_LOW,
      PITCH_HIGH,
    );
    const radius = reach * Math.cos(elevation);
    const rise = reach * Math.sin(elevation);

    camera.position.set(Math.sin(angle) * radius, c.lookY + rise + pointer.current.y * 0.5, Math.cos(angle) * radius);
    look.current.set(0, c.lookY, 0);
    camera.lookAt(look.current);

    // Slide along the camera's own axes; orientation stays the same. Scaled
    // by the orbit radius actually in use, or tilting overhead would drag
    // the model sideways out of the frame as the radius closed up.
    const shift = game.active ? 0 : 1;
    // The sideways slide exists to clear a copy column beside the tower.
    // A tablet held upright still shows that column but has nowhere near
    // the width to pay for it, and the full slide walks the building off
    // the right edge — so it eases out as the frame narrows, and the
    // gradient behind the copy does the rest.
    camera.translateX(-radius * shiftX * (1 - upright * 0.8) * shift);
    camera.translateY(-radius * shiftY * shift);
  });

  return null;
}
