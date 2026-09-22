// Public API of a Go module, type-checked with golang.org/x/tools/go/packages and go/types
// (the same foundation as golang.org/x/exp/apidiff). Packages are loaded with the default
// build context, so build constraints are honoured.
//
// usage: go run . <repo_root>     (from this directory)
// Prints "\x00JSON\x00" followed by {"symbols": [...], "warnings": [...]}.
package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/types"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/tools/go/packages"
)

type param struct {
	Name     string `json:"name"`
	Type     string `json:"type,omitempty"`
	Optional bool   `json:"optional,omitempty"`
	Rest     bool   `json:"rest,omitempty"`
}

type location struct {
	File string `json:"file"`
	Line int    `json:"line"`
}

type symbol struct {
	Name       string         `json:"name"`
	Params     []param        `json:"params"`
	Returns    string         `json:"returns,omitempty"`
	Deprecated bool           `json:"deprecated,omitempty"`
	Location   location       `json:"location"`
	Meta       map[string]any `json:"meta"`
}

func main() {
	root, _ := filepath.Abs(os.Args[1])
	cfg := &packages.Config{
		Mode: packages.NeedName | packages.NeedTypes | packages.NeedSyntax | packages.NeedFiles | packages.NeedModule,
		Dir:  root,
	}
	pkgs, err := packages.Load(cfg, "./...")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	symbols := []symbol{}
	warnings := []string{}
	for _, pkg := range pkgs {
		for _, e := range pkg.Errors {
			warnings = append(warnings, e.Error())
		}
		if pkg.Types == nil || pkg.Name == "main" || isInternal(pkg.PkgPath) {
			continue
		}
		modPath := ""
		if pkg.Module != nil {
			modPath = pkg.Module.Path
		}
		rel := strings.TrimPrefix(strings.TrimPrefix(pkg.PkgPath, modPath), "/")
		prefix := ""
		if rel != "" {
			prefix = strings.ReplaceAll(rel, "/", ".") + "."
		}
		docs := funcDocs(pkg.Syntax)
		// Types from other packages are written with their package name (time.Time); types of
		// this package unqualified (Address), as a Go user of the package would read them.
		qualifier := func(p *types.Package) string {
			if p == pkg.Types {
				return ""
			}
			return p.Name()
		}
		scope := pkg.Types.Scope()
		for _, name := range scope.Names() {
			fn, ok := scope.Lookup(name).(*types.Func)
			if !ok || !fn.Exported() {
				continue
			}
			sig := fn.Type().(*types.Signature)
			var params []param
			paramTypes := []string{}
			for i := 0; i < sig.Params().Len(); i++ {
				v := sig.Params().At(i)
				t := types.TypeString(v.Type(), qualifier)
				rest := sig.Variadic() && i == sig.Params().Len()-1
				pname := v.Name()
				if pname == "" || pname == "_" {
					pname = fmt.Sprintf("arg%d", i)
				}
				if rest {
					t = strings.TrimPrefix(t, "[]")
					paramTypes = append(paramTypes, "..."+t)
				} else {
					paramTypes = append(paramTypes, t)
				}
				params = append(params, param{Name: pname, Type: t, Optional: rest, Rest: rest})
			}
			if params == nil {
				params = []param{}
			}
			results := []string{}
			for i := 0; i < sig.Results().Len(); i++ {
				results = append(results, types.TypeString(sig.Results().At(i).Type(), qualifier))
			}
			returns := strings.Join(results, ", ")
			if len(results) > 1 {
				returns = "(" + returns + ")"
			}
			pos := pkg.Fset.Position(fn.Pos())
			file, _ := filepath.Rel(root, pos.Filename)
			symbols = append(symbols, symbol{
				Name:       prefix + name,
				Params:     params,
				Returns:    returns,
				Deprecated: isDeprecated(docs[name]),
				Location:   location{File: filepath.ToSlash(file), Line: pos.Line},
				Meta: map[string]any{
					"importPath": pkg.PkgPath,
					"package":    pkg.Name,
					"func":       name,
					"paramTypes": paramTypes,
					"results":    results,
				},
			})
		}
	}
	sort.Slice(symbols, func(i, j int) bool { return symbols[i].Name < symbols[j].Name })
	out, _ := json.Marshal(map[string]any{"symbols": symbols, "warnings": warnings})
	os.Stdout.WriteString("\x00JSON\x00")
	os.Stdout.Write(out)
}

func isInternal(path string) bool {
	for _, part := range strings.Split(path, "/") {
		if part == "internal" {
			return true
		}
	}
	return false
}

// funcDocs maps top-level function names to their doc comments.
func funcDocs(files []*ast.File) map[string]*ast.CommentGroup {
	docs := map[string]*ast.CommentGroup{}
	for _, f := range files {
		for _, d := range f.Decls {
			if fd, ok := d.(*ast.FuncDecl); ok && fd.Recv == nil {
				docs[fd.Name.Name] = fd.Doc
			}
		}
	}
	return docs
}

// isDeprecated follows the Go convention: a paragraph starting with "Deprecated: ".
func isDeprecated(doc *ast.CommentGroup) bool {
	if doc == nil {
		return false
	}
	for _, para := range strings.Split(doc.Text(), "\n\n") {
		if strings.HasPrefix(strings.TrimSpace(para), "Deprecated: ") {
			return true
		}
	}
	return false
}
