import { describe, expect, it } from "vitest";
import { createEventHelper } from "../event-typing";

describe("typed template events", () => {
  it("keeps named native handlers as zero-cost identities", () => {
    const event = createEventHelper();
    const click = event.click((value) => value.preventDefault());
    const pointerup = event.pointerup((value) => value.pointerId);
    const input = event.input((value) => value.currentTarget.value);
    const keydown = event.keydown((value) => value.key);

    expect(event.click(click)).toBe(click);
    expect(event.pointerup(pointerup)).toBe(pointerup);
    expect(event.input(input)).toBe(input);
    expect(event.keydown(keydown)).toBe(keydown);
  });

  it("keeps the callable compatibility form", () => {
    const event = createEventHelper();
    const handler = event<KeyboardEvent>((value) => value.key);

    expect(event(handler)).toBe(handler);
  });
});
