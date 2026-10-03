import { describe, expect, it } from "vitest";
import { autoFixRequest } from "../mermaidCheck";

describe("autoFixRequest", () => {
  it("includes the error and the full code, in the user's language", () => {
    const es = autoFixRequest("graph TD\n  A-->", "Parse error on line 2", "es");
    const en = autoFixRequest("graph TD\n  A-->", "Parse error on line 2", "en");
    expect(es).toContain("Corrección automática");
    expect(es).toContain("Parse error on line 2");
    expect(es).toContain("```mermaid\ngraph TD\n  A-->\n```");
    expect(en).toContain("Automatic fix");
  });
});
