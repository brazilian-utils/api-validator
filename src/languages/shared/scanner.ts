import fs from "node:fs";

/**
 * Lexical helpers for adapters that parse source text directly (Rust, Erlang, F#/C#).
 * `clean` blanks out comments and string/char literal contents while preserving offsets and
 * newlines, so brace matching and regexes on the cleaned text are not fooled by `{` inside a
 * string or `fn` inside a comment, and offsets still map to the original source.
 */

export interface CleanOptions {
  line?: string[];
  block?: Array<[string, string]>;
  /** Nested block comments (Rust, F#). */
  nestedBlock?: boolean;
  strings?: string[];
  /** Rust raw strings r"..." / r#"..."#. */
  rustRaw?: boolean;
  /** Treat 'x' as a char literal (but not Rust lifetimes 'a). */
  chars?: boolean;
  /** F# / C# verbatim strings @"..." and triple-quoted """...""". */
  verbatim?: boolean;
}

export function clean(src: string, o: CleanOptions): string {
  const out = src.split("");
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== "\n") out[k] = " ";
  };
  let i = 0;
  outer: while (i < src.length) {
    for (const l of o.line ?? []) {
      if (src.startsWith(l, i)) {
        const end = src.indexOf("\n", i);
        const j = end < 0 ? src.length : end;
        blank(i, j);
        i = j;
        continue outer;
      }
    }
    for (const [open, close] of o.block ?? []) {
      if (src.startsWith(open, i)) {
        let depth = 1;
        let j = i + open.length;
        while (j < src.length && depth > 0) {
          if (o.nestedBlock && src.startsWith(open, j)) {
            depth++;
            j += open.length;
          } else if (src.startsWith(close, j)) {
            depth--;
            j += close.length;
          } else j++;
        }
        blank(i, j);
        i = j;
        continue outer;
      }
    }
    if (o.verbatim && src.startsWith('"""', i)) {
      const end = src.indexOf('"""', i + 3);
      const j = end < 0 ? src.length : end + 3;
      blank(i + 1, j - 1);
      i = j;
      continue;
    }
    if (o.verbatim && src.startsWith('@"', i)) {
      let j = i + 2;
      while (j < src.length) {
        if (src[j] === '"' && src[j + 1] === '"') j += 2;
        else if (src[j] === '"') break;
        else j++;
      }
      blank(i + 2, j);
      i = j + 1;
      continue;
    }
    if (o.rustRaw) {
      const m = /^b?r(#*)"/.exec(src.slice(i, i + 20));
      if (m && (i === 0 || !/\w/.test(src[i - 1]))) {
        const close = `"${m[1]}`;
        const end = src.indexOf(close, i + m[0].length);
        const j = end < 0 ? src.length : end + close.length;
        blank(i + m[0].length, j - close.length);
        i = j;
        continue;
      }
    }
    if ((o.strings ?? []).includes(src[i])) {
      const q = src[i];
      let j = i + 1;
      while (j < src.length && src[j] !== q) j += src[j] === "\\" ? 2 : 1;
      blank(i + 1, j);
      i = j + 1;
      continue;
    }
    if (o.chars && src[i] === "'") {
      const m = /^'(\\(x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]+\}|.)|[^\\'\n])'/.exec(src.slice(i, i + 14));
      if (m) {
        blank(i + 1, i + m[0].length - 1);
        i += m[0].length;
        continue;
      }
    }
    i++;
  }
  return out.join("");
}

const OPEN: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

/** Index just after the bracket matching the one at `start`. */
export function matchBracket(text: string, start: number): number {
  const stack: string[] = [];
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (OPEN[c]) stack.push(OPEN[c]);
    else if (c === ")" || c === "]" || c === "}") {
      if (stack.pop() !== c) return -1;
      if (stack.length === 0) return i + 1;
    }
  }
  return -1;
}

/** Index just after the `>` matching the `<` at `start` (ignores `->`/`=>`). */
export function matchAngle(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "<") depth++;
    else if (c === ">" && text[i - 1] !== "-" && text[i - 1] !== "=") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Split on `sep` at nesting depth 0 of (), [], {}, <>. */
export function splitTopLevel(text: string, sep = ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let angle = 0;
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === "<") angle++;
    else if (c === ">" && text[i - 1] !== "-" && text[i - 1] !== "=") angle = Math.max(0, angle - 1);
    else if (c === sep && depth === 0 && angle === 0) {
      parts.push(text.slice(last, i));
      last = i + 1;
    }
  }
  parts.push(text.slice(last));
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

/** Read a source file as UTF-8 without a byte-order mark (Windows editors add one). */
export function readSource(file: string): string {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}
