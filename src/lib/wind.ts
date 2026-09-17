/**
 * The weather on site, shared by everything that moves with it: netting,
 * banners, dust, the load on the hook. A steady breeze plus gusts. Moving the
 * pointer quickly stirs the air, so the site reacts to the visitor.
 */
export type Wind = {
  /** Unit direction in the horizontal plane. */
  dir: [number, number];
  breeze: number;
  /** Extra strength from a gust, decays back to zero. */
  gust: number;
  /** World position of the pointer disturbance, its velocity and strength. */
  stir: { x: number; y: number; z: number; vx: number; vy: number; vz: number; strength: number };
  time: number;
};

export const wind: Wind = {
  dir: [0.8, 0.6],
  breeze: 0.55,
  gust: 0,
  stir: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, strength: 0 },
  time: 0,
};

/** Wind strength at a moment: slow swells with the occasional gust on top. */
export function windAt(t: number) {
  const swell =
    0.5 +
    0.3 * Math.sin(t * 0.31 + 1.7) +
    0.2 * Math.sin(t * 0.113 + 4.1) +
    0.12 * Math.sin(t * 0.73 + 0.5);
  return wind.breeze * Math.max(0, swell) + wind.gust;
}

export function stepWind(delta: number) {
  wind.time += delta;
  wind.gust = Math.max(0, wind.gust - wind.gust * 1.6 * delta);
  wind.stir.strength = Math.max(0, wind.stir.strength - wind.stir.strength * 5 * delta);
}
