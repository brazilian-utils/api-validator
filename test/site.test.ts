import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { parseGuide, type GuideFile, type GuideNode } from "../site/src/lib/guides.mjs";

/** A library checkout with a docs/ tree: guides, a reference page and example files. */
function checkout(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lib-"));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

const GUIDE = `---
title: "Document field"
description: "A field that masks as you type."
---

Intro with a [sibling guide](address-form.md), the [reference](../utilities.md#formatcpf) and [another page](../getting-started.md#size).

<div class="example" data-name="React">

The hook owns the input.

<div class="variant" data-variant="CPF" data-demo="/snippets/live/?dir=cpf/react&example=cpf-field.tsx">

<div class="file" data-file="cpf-field.tsx">

[cpf-field.tsx](../snippets/cpf/react/cpf-field.tsx ':include :type=code tsx')

</div>

</div>

</div>

<div class="example" data-name="Vanilla">

<div class="file" data-file="field.html">

\`\`\`html
<input id="cpf" />
\`\`\`

</div>

</div>

Closing words.
`;

describe("library guides", () => {
  const dir = checkout({
    "docs/guides/document-field.md": GUIDE,
    "docs/guides/address-form.md": "# other",
    "docs/utilities.md": "### formatCpf\n",
    "docs/snippets/cpf/react/cpf-field.tsx": 'import { formatCpf } from "@brazilian-utils/brazilian-utils";\n'
  });
  const warnings: string[] = [];
  const guide = parseGuide({
    lib: { id: "javascript", repo: "o/js", root: "docs", guides: { en: "docs/guides" }, reference: { en: "docs/utilities.md" } },
    src: { dir, url: "https://github.com/o/js/blob/main/" },
    file: path.join(dir, "docs/guides/document-field.md"),
    locale: "en",
    siblings: ["address-form", "document-field"],
    status: { libs: { javascript: { functions: { "cpf.format": { status: "ok", symbol: "formatCpf" }, "cpf.isValid": { status: "ok", symbol: "isValidCpf" } } } } },
    specs: [{ id: "cpf", domain: "cpf", operations: [{ id: "format", label: { en: "Format", "pt-BR": "Formatar" } }] }],
    warn: (w) => warnings.push(w)
  });

  it("reads the front matter and splits prose from example groups", () => {
    assert.equal(guide.title, "Document field");
    assert.deepEqual(guide.blocks.map((b) => b.type), ["markdown", "examples", "markdown"]);
    const [, examples] = guide.blocks;
    assert.ok(examples.type === "examples");
    assert.deepEqual(examples.examples.map((e) => e.name), ["React", "Vanilla"]);
  });

  it("nests variants and files, inlines included files and keeps fenced ones", () => {
    const [, block] = guide.blocks;
    assert.ok(block.type === "examples");
    const react = block.examples[0];
    assert.equal(react.intro, "The hook owns the input.");
    const cpf = react.children[0] as GuideNode;
    assert.equal(cpf.kind, "variant");
    assert.equal(cpf.name, "CPF");
    const file = cpf.children[0] as GuideFile;
    assert.deepEqual([file.name, file.lang], ["cpf-field.tsx", "tsx"]);
    assert.match(file.code, /import \{ formatCpf \}/);
    const html = block.examples[1].children[0] as GuideFile;
    assert.deepEqual([html.lang, html.code], ["html", '<input id="cpf" />']);
    assert.deepEqual(warnings, []);
  });

  it("moves demos under /lib-assets/<lib>/, relative to the docs root", () => {
    const [, block] = guide.blocks;
    assert.ok(block.type === "examples");
    assert.equal((block.examples[0].children[0] as GuideNode).demo, "/lib-assets/javascript/snippets/live/?dir=cpf/react&example=cpf-field.tsx");
  });

  it("rewrites links: sibling guides and reference anchors stay on the site, the rest goes to GitHub", () => {
    const [intro] = guide.blocks;
    assert.ok(intro.type === "markdown");
    assert.match(intro.text, /\[sibling guide\]\(\/guides\/javascript\/address-form\/\)/);
    assert.match(intro.text, /\[reference\]\(\/utils\/cpf\/#format\)/);
    assert.match(intro.text, /\[another page\]\(https:\/\/github\.com\/o\/js\/blob\/main\/docs\/getting-started\.md#size\)/);
  });

  it("lists the contract functions its code calls", () => {
    assert.deepEqual(guide.fns, ["cpf.format"]);
  });
});
