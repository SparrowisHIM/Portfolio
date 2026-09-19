/**
 * The state of the camera drag, shared the way `cursor` and `hover` are.
 *
 * `dragging` is read by the floor picker: swinging the camera round the site
 * sweeps the pointer across every storey on the way, and a run of labels
 * firing off behind the drag is noise rather than navigation. It only goes
 * true once the pointer has genuinely travelled, so a click on a storey is
 * still a click.
 */
export const orbit = {
  dragging: false,
  /** True once the site has topped out and the orbit is off its leash. */
  free: false,
};
