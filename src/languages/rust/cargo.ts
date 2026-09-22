import path from "node:path";
import { parseJsonOutput, runOrThrow } from "../../core/shell.js";

/** Package and library-target names from `cargo metadata` (Cargo's own view of Cargo.toml). */
export function crateInfo(root: string): { pkg: string; lib: string } {
  const out = runOrThrow("cargo", ["metadata", "--format-version", "1", "--no-deps", "--offline", "--manifest-path", path.join(root, "Cargo.toml")]);
  const meta = parseJsonOutput<{ packages: Array<{ name: string; manifest_path: string; targets: Array<{ name: string; kind: string[] }> }> }>(out, "cargo metadata");
  const manifest = path.resolve(root, "Cargo.toml");
  const pkg = meta.packages.find((p) => path.resolve(p.manifest_path) === manifest) ?? meta.packages[0];
  if (!pkg) throw new Error(`cargo metadata: no package in ${manifest}`);
  const lib = pkg.targets.find((t) => t.kind.some((k) => ["lib", "rlib", "dylib", "cdylib", "staticlib", "proc-macro"].includes(k)));
  if (!lib) throw new Error(`${pkg.name} has no library target`);
  return { pkg: pkg.name, lib: lib.name.replaceAll("-", "_") };
}
