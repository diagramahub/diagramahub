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
