import { describe, expect, it } from "vitest";
import { aiErrorMessage } from "../aiErrors";

const t = (key: string) => `t:${key}`;
const err = (detail: unknown) => ({ response: { status: 422, data: { detail } } });

describe("aiErrorMessage", () => {
  it("translates the known error codes", () => {
    expect(aiErrorMessage(err({ error: "response_truncated" }), t, "fallback")).toBe("t:ai.errors.truncated");
    expect(aiErrorMessage(err({ error: "empty_response" }), t, "fallback")).toBe("t:ai.errors.empty");
  });

  it("never returns an object (React can't render it)", () => {
    expect(aiErrorMessage(err({ error: "something_new", extra: 1 }), t, "fallback")).toBe("t:fallback");
  });

  it("keeps string details and falls back otherwise", () => {
    expect(aiErrorMessage(err("Proveedor no disponible"), t, "fallback")).toBe("Proveedor no disponible");
    expect(aiErrorMessage(new Error("network"), t, "fallback")).toBe("t:fallback");
  });
});
