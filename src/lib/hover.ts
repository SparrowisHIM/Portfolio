/**
 * Which storey the pointer is on, and how lit each one is.
 *
 * A module-level store rather than React state, for the same reason `cursor`
 * in pulses.ts is one: the value is read from the frame loop by every
 * instanced draw in the building, and routing a pointer move through a
 * re-render would hand each `instancedMesh` a fresh `args` array — which is
 * the rebuild that empties the matrix buffer and blanks the building. Only
 * the label needs the DOM, and it keeps its own state.
 */
export const hover = {
  /** Storey under the pointer, or -1 for none. */
  index: -1,
  /**
   * Eased 0..1 highlight per storey. Damped once per frame by `HoverGlow`
   * before anything reads it, so a storey warms up and cools down instead of
   * snapping between two states.
   */
  glow: [] as number[],
};

/** A new site is a new set of storeys, and none of them are hovered. */
export function resetHover(levels: number) {
  hover.index = -1;
  hover.glow = new Array(levels).fill(0);
}
