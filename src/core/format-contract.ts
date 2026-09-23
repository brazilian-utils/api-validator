/**
 * Canonical formatting of contract files (`api-validator fmt`): stable key order and
 * double-quoted strings inside tests, so `"01310200"` can never silently become the
 * number 1310200 when someone edits a vector by hand.
 */
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const DOMAIN_ORDER = ["domain", "title", "description", "aliases", "functions"];
const FN_ORDER = ["summary", "description", "references", "flatName", "aliases", "level", "network", "fallible", "deprecated", "params", "returns", "tests"];
const TEST_ORDER = ["name", "args", "returns", "throws", "matches", "satisfies", "repeat", "note"];

function reorder(map: YAML.YAMLMap, order: string[]) {
  const rank = (k: unknown) => {
    const i = order.indexOf(String((k as YAML.Scalar).value ?? k));
    return i < 0 ? order.length : i;
  };
  map.items.sort((a, b) => rank(a.key) - rank(b.key));
}

function quoteStrings(node: unknown) {
  if (YAML.isScalar(node) && typeof node.value === "string") node.type = "QUOTE_DOUBLE";
  else if (YAML.isSeq(node)) node.items.forEach(quoteStrings);
  else if (YAML.isMap(node)) node.items.forEach((p) => quoteStrings(p.value));
}

export function formatContractFile(file: string): boolean {
  const before = fs.readFileSync(file, "utf8");
  const doc = YAML.parseDocument(before);
  const root = doc.contents as YAML.YAMLMap;
  reorder(root, DOMAIN_ORDER);
  const fns = root.get("functions") as YAML.YAMLMap | undefined;
  for (const pair of fns?.items ?? []) {
    const fn = pair.value as YAML.YAMLMap;
    reorder(fn, FN_ORDER);
    for (const t of (fn.get("tests") as YAML.YAMLSeq | undefined)?.items ?? []) {
      const test = t as YAML.YAMLMap;
      reorder(test, TEST_ORDER);
      const args = test.get("args", true) as unknown as YAML.YAMLSeq | undefined;
      if (args) args.flow = true;
      quoteStrings(args);
      quoteStrings(test.get("returns", true));
      quoteStrings(test.get("matches", true));
    }
  }
  const after = doc.toString({ lineWidth: 140, flowCollectionPadding: false });
  if (after !== before) fs.writeFileSync(file, after);
  return after !== before;
}

export function formatContractDir(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .filter((f) => formatContractFile(path.join(dir, f)));
}
