import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AI_PROVIDER_MODELS } from "../../types/ai";

// The backend catalog is the source of truth (context windows, parameters,
// defaults); the pickers must offer exactly its `listed` models.
const catalogPath = resolve(__dirname, "../../../../backend/app/api/v1/ai_providers/model_catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
  models: { provider: string; id: string; listed?: boolean; recommended?: boolean }[];
};

describe("AI model catalog", () => {
  it("frontend pickers list exactly the backend's listed models, in order, with the same recommended one", () => {
    for (const [provider, options] of Object.entries(AI_PROVIDER_MODELS)) {
      const listed = catalog.models.filter((m) => m.provider === provider && m.listed);
      expect(options.map((o) => o.id), provider).toEqual(listed.map((m) => m.id));
      expect(options.filter((o) => o.recommended).map((o) => o.id), provider).toEqual(
        listed.filter((m) => m.recommended).map((m) => m.id),
      );
    }
  });
});
