import { describe, expect, it } from "vitest";
import { createSlotLimiter } from "@/lib/streamSlots";

describe("createSlotLimiter", () => {
  it("hands out at most `max` slots", () => {
    const slots = createSlotLimiter(2);
    expect(slots.acquire()).toBeTypeOf("function");
    expect(slots.acquire()).toBeTypeOf("function");
    expect(slots.acquire()).toBeNull();
    expect(slots.active()).toBe(2);
  });

  it("frees a slot on release", () => {
    const slots = createSlotLimiter(1);
    const release = slots.acquire()!;
    expect(slots.acquire()).toBeNull();
    release();
    expect(slots.active()).toBe(0);
    expect(slots.acquire()).toBeTypeOf("function");
  });

  it("counts a double release only once", () => {
    const slots = createSlotLimiter(2);
    const a = slots.acquire()!;
    slots.acquire();
    a();
    a();
    expect(slots.active()).toBe(1);
  });

  it("with a limit of zero refuses everything", () => {
    expect(createSlotLimiter(0).acquire()).toBeNull();
  });
});
