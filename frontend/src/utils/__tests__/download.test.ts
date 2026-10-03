import { describe, expect, it } from "vitest";
import { retryAfterSeconds } from "../download";

describe("retryAfterSeconds", () => {
  it("reads the Retry-After header of an axios-like error", () => {
    expect(retryAfterSeconds({ response: { headers: { "retry-after": "42" } } })).toBe(42);
    expect(retryAfterSeconds({ response: { headers: { "retry-after": "1.2" } } })).toBe(2);
  });

  it("returns null when the header is missing or not a positive number", () => {
    expect(retryAfterSeconds({ response: { headers: {} } })).toBeNull();
    expect(retryAfterSeconds({ response: { headers: { "retry-after": "soon" } } })).toBeNull();
    expect(retryAfterSeconds(new Error("network"))).toBeNull();
    expect(retryAfterSeconds(undefined)).toBeNull();
  });
});
