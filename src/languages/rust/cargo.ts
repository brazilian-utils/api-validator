import path from "node:path";
import { parseJsonOutput, runOrThrow } from "../../core/shell.js";

interface CargoPackage {
  name: string;
  edition?: string;
  manifest_path: string;
  targets: Array<{ name: string; kind: string[] }>;
  dependencies?: Array<{ name: string; rename?: string | null; kind?: string | null }>;
}

/**
 * Package and library-target names from `cargo metadata` (Cargo's own view of Cargo.toml),
 * plus the crate names an integration test can `use`: normal and dev dependencies.
 */
export function crateInfo(root: string): { pkg: string; lib: string; edition: string; testDeps: string[] } {
  const out = runOrThrow("cargo", ["metadata", "--format-version", "1", "--no-deps", "--offline", "--manifest-path", path.join(root, "Cargo.toml")]);
  const meta = parseJsonOutput<{ packages: CargoPackage[] }>(out, "cargo metadata");
  const manifest = path.resolve(root, "Cargo.toml");
  const pkg = meta.packages.find((p) => path.resolve(p.manifest_path) === manifest) ?? meta.packages[0];
  if (!pkg) throw new Error(`cargo metadata: no package in ${manifest}`);
  const lib = pkg.targets.find((t) => t.kind.some((k) => ["lib", "rlib", "dylib", "cdylib", "staticlib", "proc-macro"].includes(k)));
  if (!lib) throw new Error(`${pkg.name} has no library target`);
  const testDeps = (pkg.dependencies ?? [])
    .filter((d) => !d.kind || d.kind === "dev")
    .map((d) => (d.rename ?? d.name).replaceAll("-", "_"))
    .sort();
  return { pkg: pkg.name, lib: lib.name.replaceAll("-", "_"), edition: pkg.edition ?? "2015", testDeps };
}
