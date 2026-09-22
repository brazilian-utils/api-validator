// Conformance runner for JavaScript/TypeScript libs. Protocol: src/languages/shared/process-runner.ts
import { pathToFileURL } from "node:url";

const MARK = "\u0000JSON\u0000";

function toJson(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Map) return Object.fromEntries([...value].map(([k, v]) => [k, toJson(v)]));
  if (value instanceof Set) return [...value].map(toJson);
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJson(v)]));
  if (typeof value === "function") return "<function>";
  return value;
}

const input = JSON.parse(await new Promise((resolve) => {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => (data += c));
  process.stdin.on("end", () => resolve(data));
}));

const mod = await import(pathToFileURL(process.argv[2]).href);
const results = [];
for (const call of input.calls) {
  try {
    let target = mod;
    for (const part of call.symbol.split(".")) target = target?.[part];
    if (typeof target !== "function") {
      results.push({ id: call.id, ok: false, error: `symbol ${call.symbol} not found`, unsupported: true });
      continue;
    }
    const value = await target(...call.args);
    results.push({ id: call.id, ok: true, value: toJson(value) });
  } catch (e) {
    results.push({ id: call.id, ok: false, error: `${e?.name ?? "Error"}: ${e?.message ?? e}` });
  }
}
process.stdout.write(MARK + JSON.stringify(results));
