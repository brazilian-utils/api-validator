import fs from "node:fs";
import path from "node:path";

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function writeJsonFile(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "dist", "build", "target", ".venv"].includes(entry.name)) {
        continue;
      }
      files.push(...walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}
