import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { apiErrorDetail, apiErrorMessage, apiErrorStatus, resourceLimitDetail } from "../apiError";

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data,
  });
}

describe("apiErrorMessage", () => {
  it("returns the server message when detail is a string", () => {
    expect(apiErrorMessage(httpError(400, { detail: "Nombre duplicado" }))).toBe("Nombre duplicado");
  });

  it("ignores FastAPI validation errors so the caller's fallback is shown", () => {
    const validation = { detail: [{ loc: ["body", "name"], msg: "field required", type: "missing" }] };
    expect(apiErrorMessage(httpError(422, validation))).toBeUndefined();
  });

  it("ignores structured payloads, empty messages and non-HTTP errors", () => {
    expect(apiErrorMessage(httpError(403, { detail: { error: "resource_limit_exceeded" } }))).toBeUndefined();
    expect(apiErrorMessage(httpError(400, { detail: "" }))).toBeUndefined();
    expect(apiErrorMessage(httpError(502, "Bad Gateway"))).toBeUndefined();
    expect(apiErrorMessage(new Error("Network Error"))).toBeUndefined();
    expect(apiErrorMessage(undefined)).toBeUndefined();
  });
});

describe("apiErrorStatus", () => {
  it("returns the HTTP status only for answered requests", () => {
    expect(apiErrorStatus(httpError(404, { detail: "Not found" }))).toBe(404);
    expect(apiErrorStatus(new AxiosError("Network Error"))).toBeUndefined();
    expect(apiErrorStatus(new Error("boom"))).toBeUndefined();
  });
});

describe("resourceLimitDetail", () => {
  it("returns the plan limit payload", () => {
    const detail = { error: "resource_limit_exceeded", resource_type: "projects", current_usage: 1, limit: 1 };
    expect(resourceLimitDetail(httpError(403, { detail }))).toEqual(detail);
    expect(apiErrorDetail(httpError(403, { detail }))).toEqual(detail);
  });

  it("returns undefined for any other error", () => {
    expect(resourceLimitDetail(httpError(403, { detail: "Forbidden" }))).toBeUndefined();
    expect(resourceLimitDetail(httpError(400, { detail: { error: "invalid_upload" } }))).toBeUndefined();
    expect(resourceLimitDetail(new Error("boom"))).toBeUndefined();
  });
});
