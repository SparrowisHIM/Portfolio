/**
 * When a section's copy is on screen, and why these numbers.
 *
 * Every section on the front page is one viewport tall, and every card
 * reads its own section with `useScroll({ offset: ["start end", "end
 * start"] })`. That offset runs the section's progress over *two*
 * viewports — from the section's top touching the bottom of the screen to
 * its bottom touching the top — so one viewport of scroll is 0.5 of `p`,
 * and `p = 0.5` is the section filling the screen exactly.
 *
 * `useScrollProgress` hands the rest of the page a section index of
 * `round(progress * (count - 1))`, which switches a *half* viewport before
 * the section element starts. That index is what the levels rule reads and
 * what the scene builds against, so the copy has to be tied to the same
 * window or the page says one thing and the model does another. In this
 * section's own `p`, the boundary below it is at 0.25 and the boundary
 * above it at 0.75.
 *
 * So: arrive over the 100px after the lower boundary, leave over the 100px
 * before the upper one. The arithmetic that makes that work is
 * `OUT[1] = IN[0] + 0.5`: the next section starts exactly one viewport
 * further down the page, which is 0.5 of `p`, so that identity lands this
 * card's last frame on the next card's first. IN starts a hair early, so
 * the two graze rather than leaving a pixel of scroll with nothing on it.
 *
 * Two ways to get this wrong, both of which were in the page:
 *
 * - **Too far apart** and the column empties. The windows were `[0.24,
 *   0.42]` in and `[0.58, 0.75]` out — the exit ran a third of a section
 *   early — and measuring the computed opacity of all seven cards across
 *   the scroll showed every floor boundary passing through a frame with
 *   nothing on screen at all. Five blank moments on the way up. That reads
 *   as "the scroll is not talking" without ever looking like a bug.
 * - **Too far overlapped** and they smear. A symmetric crossfade in one
 *   fixed slot puts "VAULT MARKET" and "KINETIC NETWORK GLOBE" on the same
 *   pixels at 56% and 44%, which is worse than the hole. The cards are the
 *   same shape in the same place, so they have to take turns.
 *
 * `LIFT` is what makes the turn read as a level change rather than a
 * dissolve: the outgoing card rises as it goes, the incoming one comes up
 * from below. Transform only, and dropped under reduced motion.
 */
export const COPY_IN = [0.24, 0.3] as const;
export const COPY_OUT = [0.69, 0.75] as const;

/** Fade in, hold, fade out. For every section with one above and below. */
export const COPY_BAND = [...COPY_IN, ...COPY_OUT] as const;
export const COPY_KEYS = [0, 1, 1, 0] as const;

/** Pixels the copy travels through the handover. */
export const LIFT = 18;
export const LIFT_KEYS = [LIFT, 0, 0, -LIFT] as const;
