/**
 * Feedback events on site. The structure is dark by default; these are the
 * moments it lights up. Pulses travel through the geometry from an origin,
 * bursts are short particle sprays at a point. Both are read by the scene
 * every frame and fade on their own.
 */

export type Hue = "amber" | "blue" | "white" | "red";

export const HUES: Record<Hue, [number, number, number]> = {
  amber: [1.0, 0.7, 0.28],
  blue: [0.5, 0.72, 1.0],
  white: [0.92, 0.94, 1.0],
  red: [1.0, 0.28, 0.22],
};

export type Pulse = { x: number; y: number; z: number; t0: number; hue: Hue };
export type Burst = { x: number; y: number; z: number; t0: number; hue: Hue; count: number };

export const MAX_PULSES = 8;

export const events = {
  time: 0,
  pulses: [] as Pulse[],
  /** Bursts wait here until the particle system drains them. */
  bursts: [] as Burst[],
};

export function emitPulse(x: number, y: number, z: number, hue: Hue = "amber") {
  events.pulses.push({ x, y, z, t0: events.time, hue });
  if (events.pulses.length > MAX_PULSES) events.pulses.shift();
}

export function emitBurst(x: number, y: number, z: number, hue: Hue = "amber", count = 10) {
  if (events.bursts.length > 24) return;
  events.bursts.push({ x, y, z, t0: events.time, hue, count });
}

/** Scene-wide dials. `glow` is how much the structure lights itself at rest, 0 to 1. */
export const scene = {
  glow: 0.3,
};

/** Where the visitor's cursor is in the world, and how fast it is moving. */
export const cursor = {
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  /** 1 while the pointer is over the scene, eased. */
  active: 0,
  /** 1 while the pointer is over the building itself. */
  onBuilding: 0,
};
