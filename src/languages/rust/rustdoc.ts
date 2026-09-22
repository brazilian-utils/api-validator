/**
 * Rust public API from rustdoc's JSON output: the compiler's own view of the crate, with
 * macros expanded, `cfg` applied, re-exports and visibility resolved. Needs a nightly
 * toolchain (`-Z unstable-options --output-format json`); the adapter falls back to the
 * source scanner (extract.ts) when none is installed.
 *
 * rustdoc runs on a tiny host crate in the work dir that depends on the lib by path, so
 * nothing (not even Cargo.lock) is written into the lib checkout.
 */
import fs from "node:fs";
import path from "node:path";
import type { NativeSymbol } from "../../core/model.js";
import { run } from "../../core/shell.js";
import type { AdapterContext } from "../types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

export function nightlyToolchain(ctx: AdapterContext): string | undefined {
  const wanted = typeof ctx.lib.options.rustdocToolchain === "string" ? ctx.lib.options.rustdocToolchain : "nightly";
  return run("rustup", ["run", wanted, "rustc", "--version"]).status === 0 ? wanted : undefined;
}

function crateInfo(root: string): { pkg: string; lib: string } {
  const toml = fs.readFileSync(path.join(root, "Cargo.toml"), "utf8");
  const pkg = /\[package\][\s\S]*?\bname\s*=\s*"([^"]+)"/.exec(toml)?.[1];
  if (!pkg) throw new Error("Cargo.toml: package name not found");
  const libSection = /^\[lib\]\s*\n([^[]*)/m.exec(toml)?.[1] ?? "";
  return { pkg, lib: /\bname\s*=\s*"([^"]+)"/.exec(libSection)?.[1] ?? pkg.replaceAll("-", "_") };
}

/** Render a rustdoc JSON type back to Rust syntax (the adapter's type mapper reads that). */
export function typeText(t: Json): string {
  if (!t || typeof t !== "object") return "_";
  if ("primitive" in t) return t.primitive;
  if ("generic" in t) return t.generic;
  if ("borrowed_ref" in t) {
    const r = t.borrowed_ref;
    return `&${r.lifetime ? `${r.lifetime} ` : ""}${r.is_mutable ? "mut " : ""}${typeText(r.type)}`;
  }
  if ("raw_pointer" in t) return `*${t.raw_pointer.is_mutable ? "mut" : "const"} ${typeText(t.raw_pointer.type)}`;
  if ("slice" in t) return `[${typeText(t.slice)}]`;
  if ("array" in t) return `[${typeText(t.array.type)}; ${t.array.len}]`;
  if ("tuple" in t) return t.tuple.length === 0 ? "()" : `(${t.tuple.map(typeText).join(", ")})`;
  if ("resolved_path" in t) {
    const p = t.resolved_path;
    const args = p.args?.angle_bracketed?.args ?? [];
    const rendered = args.map((a: Json) => ("type" in a ? typeText(a.type) : "lifetime" in a ? a.lifetime : "_"));
    return rendered.length ? `${p.path}<${rendered.join(", ")}>` : p.path;
  }
  if ("impl_trait" in t) {
    const bounds = t.impl_trait
      .map((b: Json) => b.trait_bound && typeText({ resolved_path: b.trait_bound.trait }))
      .filter(Boolean);
    return `impl ${bounds.join(" + ")}`;
  }
  if ("dyn_trait" in t) return `dyn ${t.dyn_trait.traits.map((x: Json) => typeText({ resolved_path: x.trait })).join(" + ")}`;
  if ("qualified_path" in t) return `${typeText(t.qualified_path.self_type)}::${t.qualified_path.name}`;
  if ("function_pointer" in t) return "fn";
  return "_";
}

export function extractWithRustdoc(ctx: AdapterContext, toolchain: string): NativeSymbol[] {
  const { pkg, lib } = crateInfo(ctx.root);
  const host = path.join(ctx.workDir, "rustdoc-host");
  fs.mkdirSync(path.join(host, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(host, "Cargo.toml"),
    `[package]\nname = "apivalidator_rustdoc_host"\nversion = "0.0.0"\nedition = "2021"\n\n[dependencies]\n${JSON.stringify(pkg)} = { path = ${JSON.stringify(ctx.root)} }\n\n[workspace]\n`
  );
  fs.writeFileSync(path.join(host, "src", "lib.rs"), "");
  const target = path.join(ctx.workDir, "rustdoc-target");
  const r = run("cargo", [`+${toolchain}`, "rustdoc", "-p", pkg, "--lib", "-q", "--", "-Z", "unstable-options", "--output-format", "json"], {
    cwd: host,
    env: { ...process.env, CARGO_TARGET_DIR: target, RUSTDOCFLAGS: "" },
    timeoutMs: 20 * 60 * 1000
  });
  const file = path.join(target, "doc", `${lib}.json`);
  if (r.status !== 0 || !fs.existsSync(file)) throw new Error(`rustdoc failed: ${r.stderr.trim().split("\n").slice(-10).join("\n")}`);
  const doc: Json = JSON.parse(fs.readFileSync(file, "utf8"));
  const index: Record<string, Json> = doc.index;
  const canonical = (id: number): string | undefined => {
    const p: string[] | undefined = doc.paths?.[id]?.path;
    return p ? p.slice(1).join(".") : undefined;
  };

  const symbols: NativeSymbol[] = [];
  const visited = new Set<string>();
  const emit = (item: Json, publicPath: string[]) => {
    const f = item.inner.function;
    const params = f.sig.inputs.map(([name, ty]: [string, Json]) => ({ name: /^\w+$/.test(name) ? name : "arg", type: typeText(ty) }));
    const name = publicPath.join(".");
    const def = canonical(item.id);
    symbols.push({
      name,
      params,
      returns: f.sig.output ? typeText(f.sig.output) : undefined,
      deprecated: item.deprecation ? true : undefined,
      aliasOf: def && def !== name ? def : undefined,
      location: item.span ? { file: item.span.filename, line: item.span.begin[0] } : undefined,
      meta: { rustPath: publicPath.join("::"), paramTypes: params.map((p: { type: string }) => p.type) }
    });
  };
  const walk = (moduleItem: Json, prefix: string[]) => {
    const key = `${moduleItem.id}@${prefix.join("::")}`;
    if (visited.has(key)) return;
    visited.add(key);
    for (const id of moduleItem.inner.module.items) {
      const item = index[String(id)];
      if (!item || item.visibility !== "public") continue;
      const kind = Object.keys(item.inner)[0];
      if (kind === "function") emit(item, [...prefix, item.name]);
      else if (kind === "module") walk(item, [...prefix, item.name]);
      else if (kind === "use") {
        const u = item.inner.use;
        const target = u.id != null ? index[String(u.id)] : undefined;
        if (!target) continue; // re-export from another crate
        const tkind = Object.keys(target.inner)[0];
        if (u.is_glob && tkind === "module") {
          walk(target, prefix);
        } else if (tkind === "function") emit(target, [...prefix, u.name]);
        else if (tkind === "module") walk(target, [...prefix, u.name]);
      }
    }
  };
  walk(index[String(doc.root)], []);
  return symbols;
}
