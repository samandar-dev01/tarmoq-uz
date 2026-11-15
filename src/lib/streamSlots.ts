/**
 * A counter for "at most N of these at once". Used by the streaming health check so that a stranger can not hold
 * an unlimited number of open connections. Like the rate limiter it lives in memory, which is correct while the
 * app runs as one instance.
 */
export type SlotLimiter = {
  /** Takes a slot and returns the function that gives it back, or null when every slot is in use. */
  acquire(): (() => void) | null;
  active(): number;
};

export function createSlotLimiter(max: number): SlotLimiter {
  let active = 0;
  return {
    acquire() {
      if (active >= max) return null;
      active += 1;
      let released = false;
      // Safe to call more than once: a stream can end and be cancelled at nearly the same moment.
      return () => {
        if (released) return;
        released = true;
        active -= 1;
      };
    },
    active: () => active,
  };
}
