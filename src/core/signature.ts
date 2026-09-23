import type { LanguageAdapter } from "../languages/types.js";
import { checkParam, checkReturn, parseCType } from "./ctype.js";
import type { ContractFunction, Issue, NativeSymbol } from "./model.js";

/**
 * Compare a native symbol to the contract signature ("input API -> output API").
 *
 * The contract is read from the caller's point of view: a call written against the
 * contract (positional args, optional ones may be omitted) must work against the lib,
 * and whatever the lib returns must be something the contract allows.
 */
function checkSignature(fn: ContractFunction, symbol: NativeSymbol, adapter: LanguageAdapter): Issue[] {
  const issues: Issue[] = [];
  const positional = symbol.params.filter((p) => !p.rest && !p.keyword);
  const hasRest = symbol.params.some((p) => p.rest && !p.keyword);
  const requiredKeywords = symbol.params.filter((p) => p.keyword && !p.optional && !p.rest);
  const nativeRequired = positional.filter((p) => !p.optional).length;
  const contractRequired = fn.params.filter((p) => !p.optional).length;
  const contractTotal = fn.params.length;
  let unverified = 0;

  if (requiredKeywords.length > 0) {
    issues.push({
      severity: "error",
      code: "required-keyword",
      message: `requires keyword argument(s) ${requiredKeywords.map((p) => p.name).join(", ")} that the contract does not have`
    });
  }
  if (nativeRequired > contractTotal) {
    // Callers following the contract cannot supply these arguments at all.
    issues.push({
      severity: "error",
      code: "arity",
      message: `requires ${nativeRequired} argument(s), contract passes at most ${contractTotal} (${sig(fn)})`
    });
  } else if (!hasRest && positional.length < contractRequired) {
    issues.push({
      severity: "error",
      code: "arity",
      message: `accepts ${positional.length} argument(s), contract requires ${contractRequired} (${sig(fn)})`
    });
  }

  fn.params.forEach((cp, i) => {
    const np = positional[i];
    if (!np) {
      if (cp.optional && !hasRest && positional.length >= contractRequired) {
        issues.push({ severity: "warning", code: "missing-optional-param", message: `does not support optional parameter "${cp.name}"` });
      }
      return;
    }
    if (cp.optional && !np.optional) {
      issues.push({
        severity: adapter.optionalParams === false ? "warning" : "error",
        code: "param-required",
        message: `parameter "${np.name}" (contract "${cp.name}") is required, contract makes it optional`
      });
    }
    const result = checkParam(parseCType(cp.type), adapter.mapType(np.typeNode, "param", symbol));
    if (result.level === "unverified") unverified++;
    else if (result.level !== "ok") {
      issues.push({ severity: result.level, code: "param-type", message: `parameter "${cp.name}": ${result.reason}` });
    }
  });

  const ret = checkReturn(parseCType(fn.returns), adapter.mapType(symbol.returnsNode, "return", symbol));
  if (ret.level === "unverified") unverified++;
  else if (ret.level !== "ok") issues.push({ severity: ret.level, code: "return-type", message: `return: ${ret.reason}` });

  if (unverified > 0) {
    issues.push({
      severity: "info",
      code: "unverified-types",
      message: `${unverified} type(s) could not be verified statically (untyped or unmapped native types)`
    });
  }
  return issues;
}

/** `cpf: string, strict?: boolean`: a contract function's parameters as text. */
export const paramList = (params: ContractFunction["params"]) => params.map((p) => `${p.name}${p.optional ? "?" : ""}: ${p.type}`).join(", ");

export function sig(fn: ContractFunction): string {
  return `${fn.flatName}(${paramList(fn.params)}) -> ${fn.returns}`;
}

export function nativeSig(s: NativeSymbol): string {
  const params = s.params
    .map((p) => `${p.rest ? "..." : ""}${p.name}${p.optional ? "?" : ""}${p.type ? `: ${p.type}` : ""}`)
    .join(", ");
  return `${s.name}(${params})${s.returns ? ` -> ${s.returns}` : ""}`;
}

/** Pick the overload with the fewest errors, then warnings. */
export function bestOverload(fn: ContractFunction, overloads: NativeSymbol[], adapter: LanguageAdapter) {
  const scored = overloads.map((symbol) => {
    const issues = checkSignature(fn, symbol, adapter);
    const errors = issues.filter((i) => i.severity === "error").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;
    return { symbol, issues, rank: errors * 100 + warnings };
  });
  scored.sort((a, b) => a.rank - b.rank);
  return scored[0];
}

