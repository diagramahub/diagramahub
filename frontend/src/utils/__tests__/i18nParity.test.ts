import { describe, expect, it } from "vitest";
import en from "../../i18n/locales/en.json";
import es from "../../i18n/locales/es.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...acc, [path]: value } : { ...acc, ...flatten(value, path) };
  }, {});
}

const esKeys = flatten(es as Tree);
const enKeys = flatten(en as Tree);
const placeholders = (text: string) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

describe("i18n parity", () => {
  it("es.json and en.json have exactly the same keys", () => {
    expect(Object.keys(enKeys).filter((k) => !(k in esKeys))).toEqual([]);
    expect(Object.keys(esKeys).filter((k) => !(k in enKeys))).toEqual([]);
  });

  it("every translation uses the same {{placeholders}} in both languages", () => {
    const mismatched = Object.keys(esKeys).filter(
      (k) => k in enKeys && placeholders(esKeys[k]).join() !== placeholders(enKeys[k]).join(),
    );
    expect(mismatched).toEqual([]);
  });
});

describe("i18n plurals (i18next v4 format: _one / _other)", () => {
  it("no key uses the legacy `_plural` suffix (ignored by i18next 21+)", () => {
    expect(Object.keys(esKeys).filter((k) => k.endsWith("_plural"))).toEqual([]);
  });

  it("counts agree in both languages", async () => {
    const i18next = (await import("i18next")).default.createInstance();
    await i18next.init({ lng: "es", resources: { es: { translation: es }, en: { translation: en } } });
    const t = (key: string, count: number, lng: string) => i18next.t(key, { count, lng });
    expect(t("projectImport.importCount", 1, "es")).toBe("Importar 1 diagrama");
    expect(t("projectImport.importCount", 3, "es")).toBe("Importar 3 diagramas");
    expect(t("projectImport.skipped", 1, "en")).toBe("1 file skipped:");
    expect(t("common.counts.folders", 1, "es")).toBe("1 carpeta");
    expect(t("subscription.features.upToProjects", 5, "es")).toBe("Hasta 5 proyectos");
    expect(t("subscription.features.upToProjects", 1, "en")).toBe("Up to 1 project");
  });
});
