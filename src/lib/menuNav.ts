/** Where a key moves the focus in an open menu: the next item, the previous one, the first or the last. */
export type MenuMove = "next" | "prev" | "first" | "last";

const MOVES = new Map<string, MenuMove>([
  ["ArrowDown", "next"],
  ["ArrowUp", "prev"],
  ["Home", "first"],
  ["End", "last"],
]);

/** The move a key asks for, or null when the key is not a movement key. */
export const menuMoveFor = (key: string): MenuMove | null => MOVES.get(key) ?? null;

/**
 * The index to focus after a move, from the index that has the focus now (-1 when none of the items has it).
 * Next and previous wrap round at the ends; with no item there is nothing to focus (-1).
 */
export function menuNextIndex(move: MenuMove, current: number, count: number): number {
  if (count <= 0) return -1;
  if (move === "first") return 0;
  if (move === "last") return count - 1;
  if (move === "next") return current < 0 || current >= count - 1 ? 0 : current + 1;
  return current <= 0 ? count - 1 : current - 1;
}
